import { defineStore } from 'pinia'
import type { CommitStatus, GitAuthor, GitStatusInfo } from '~/types'
import { buildCommitMessage, getEffectiveCommitDebounceMs, getEffectiveCommitMode } from '~/utils/git'

/**
 * Per-vault scheduled commit timers. Lives outside reactive state so that
 * Pinia does not try to make `setTimeout` handles reactive.
 */
const commitTimers = new Map<string, ReturnType<typeof setTimeout>>()
const operationQueues = new Map<string, Promise<unknown>>()

export function clearGitCommitTimers() {
  for (const timer of commitTimers.values()) {
    clearTimeout(timer)
  }
  commitTimers.clear()
}

/**
 * Owns git-related runtime state: per-vault status, commit status and the
 * debounced auto-commit pipeline. Author resolution honours app settings
 * first, then falls back to git's global config.
 */
export const useGitStore = defineStore('git', () => {
  const status = ref<Record<string, GitStatusInfo>>({})
  const statusErrors = ref<Record<string, string | null>>({})
  const commitStatus = ref<Record<string, CommitStatus>>({})
  const pendingCommits = ref<Record<string, boolean>>({})

  function effectiveCommitMode(vaultId: string) {
    const vault = useVaultsStore().findById(vaultId)
    if (!vault || vault.type !== 'git') return 'manual'
    return getEffectiveCommitMode(vault, useSettingsStore().settings.defaultCommitMode)
  }

  function enqueue<T>(vaultId: string, operation: () => Promise<T>): Promise<T> {
    const previous = operationQueues.get(vaultId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(operation)
    const queued = next.catch(() => undefined).finally(() => {
      if (operationQueues.get(vaultId) === queued) operationQueues.delete(vaultId)
    })
    operationQueues.set(vaultId, queued)
    return next
  }

  async function refreshStatus(vaultId: string) {
    const vaults = useVaultsStore()
    const vault = vaults.findById(vaultId)
    if (!vault || vault.type !== 'git') return
    const git = useGit()
    try {
      status.value[vaultId] = await git.status(vault.path)
      statusErrors.value[vaultId] = null
    }
    catch (error) {
      console.error('Failed to read git status', vault.path, error)
      statusErrors.value[vaultId] = error instanceof Error ? error.message : String(error)
    }
  }

  async function refreshAllStatuses() {
    const vaults = useVaultsStore()
    await Promise.all(
      vaults.list
        .filter((v) => v.type === 'git')
        .map((v) => refreshStatus(v.id)),
    )
  }

  /**
   * Resolves the commit author. App settings take precedence over git's
   * global config so users can override it per-installation.
   */
  async function resolveAuthor(): Promise<{ name: string, email: string } | null> {
    const { settings } = useSettingsStore()
    const overrideName = settings.gitAuthorName.trim()
    const overrideEmail = settings.gitAuthorEmail.trim()
    if (overrideName && overrideEmail) {
      return { name: overrideName, email: overrideEmail }
    }
    const git = useGit()
    let global: GitAuthor = { name: null, email: null }
    try {
      global = await git.globalAuthor()
    }
    catch {
      // Fall back to empty strings below
    }
    const name = overrideName || (global.name ?? '').trim()
    const email = overrideEmail || (global.email ?? '').trim()
    if (!name || !email) return null
    return { name, email }
  }

  function cancelCommit(vaultId: string) {
    const t = commitTimers.get(vaultId)
    if (t) {
      clearTimeout(t)
      commitTimers.delete(vaultId)
    }
    pendingCommits.value[vaultId] = false
  }

  /**
   * Schedules a debounced auto-commit for a git vault in `auto` mode.
   * The timer is cancelled by `cancelCommit` whenever the user types
   * (so the commit only runs after the next autosave settles).
   */
  function scheduleCommit(vaultId: string) {
    const vault = useVaultsStore().findById(vaultId)
    if (!vault || vault.type !== 'git' || !vault.git) return
    const settings = useSettingsStore()
    if (getEffectiveCommitMode(vault, settings.settings.defaultCommitMode) !== 'auto') return
    cancelCommit(vaultId)
    const delay = getEffectiveCommitDebounceMs(vault, settings.settings.defaultCommitDebounceMs)
    pendingCommits.value[vaultId] = true
    const handle = setTimeout(() => {
      commitTimers.delete(vaultId)
      pendingCommits.value[vaultId] = false
      commit(vaultId).catch((error) => {
        console.error('Auto-commit failed', error)
      })
    }, delay)
    commitTimers.set(vaultId, handle)
  }

  async function commit(vaultId: string, message?: string) {
    return enqueue(vaultId, async () => {
      const vault = useVaultsStore().findById(vaultId)
      if (!vault || vault.type !== 'git') return

      cancelCommit(vaultId)
      await useEditorStore().flushVault(vault)
      cancelCommit(vaultId)

      const author = await resolveAuthor()
      if (!author) {
        commitStatus.value[vaultId] = 'error'
        throw new Error(
          'Git author is not configured. Set it in Settings or run '
          + '`git config --global user.name/email`.',
        )
      }

      commitStatus.value[vaultId] = 'committing'
      try {
        const git = useGit()
        // Pre-flight to build a more meaningful message
        const current = await git.status(vault.path)
        statusErrors.value[vaultId] = null
        if (!current.dirty) {
          commitStatus.value[vaultId] = 'idle'
          status.value[vaultId] = current
          return
        }
        const settings = useSettingsStore()
        const count = current.changedFiles
        const autoMessage = buildCommitMessage(settings.settings.gitAutoMessageTemplate, count)
        const finalMessage = message?.trim() || autoMessage
        const result = await git.commitAll({
          path: vault.path,
          message: finalMessage,
          authorName: author.name,
          authorEmail: author.email,
        })
        status.value[vaultId] = result.committed
          ? { dirty: false, changedFiles: 0 }
          : await git.status(vault.path)
        statusErrors.value[vaultId] = null
        commitStatus.value[vaultId] = result.committed ? 'committed' : 'idle'
      }
      catch (error) {
        commitStatus.value[vaultId] = 'error'
        throw error
      }
    })
  }

  async function commitIfAuto(vaultId: string) {
    cancelCommit(vaultId)
    if (effectiveCommitMode(vaultId) === 'auto') {
      await commit(vaultId)
    }
    else {
      await refreshStatus(vaultId)
    }
  }

  async function pull(vaultId: string) {
    return enqueue(vaultId, async () => {
      const vault = useVaultsStore().findById(vaultId)
      if (!vault || vault.type !== 'git') return ''
      const output = await useGit().pull(vault.path)
      await refreshStatus(vaultId)
      return output
    })
  }

  async function push(vaultId: string) {
    return enqueue(vaultId, async () => {
      const vault = useVaultsStore().findById(vaultId)
      if (!vault || vault.type !== 'git') return ''
      const output = await useGit().push(vault.path)
      await refreshStatus(vaultId)
      return output
    })
  }

  async function sync(vaultId: string) {
    await commit(vaultId)
    await pull(vaultId)
    return push(vaultId)
  }

  function resetCommitStatus(vaultId: string) {
    commitStatus.value[vaultId] = 'idle'
  }

  /** Drops cached status for a removed vault. */
  function dropVault(vaultId: string) {
    cancelCommit(vaultId)
    Reflect.deleteProperty(status.value, vaultId)
    Reflect.deleteProperty(statusErrors.value, vaultId)
    Reflect.deleteProperty(commitStatus.value, vaultId)
    Reflect.deleteProperty(pendingCommits.value, vaultId)
    operationQueues.delete(vaultId)
  }

  onScopeDispose(() => {
    clearGitCommitTimers()
  })

  return {
    status,
    statusErrors,
    commitStatus,
    pendingCommits,
    effectiveCommitMode,
    refreshStatus,
    refreshAllStatuses,
    resolveAuthor,
    cancelCommit,
    scheduleCommit,
    commit,
    commitIfAuto,
    pull,
    push,
    sync,
    resetCommitStatus,
    dropVault,
    clearTimers: clearGitCommitTimers,
  }
})
