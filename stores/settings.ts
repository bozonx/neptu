import { defineStore } from 'pinia'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type InstanceConfig,
  type SharedConfig,
  type SharedSettings,
  type Vault,
} from '~/types'
import { isAbsolutePath, makePathAbsoluteFromRoot, makePathRelativeToRoot } from '~/utils/paths'

function toRelativeVaults(vaults: Vault[], root: string): Vault[] {
  return vaults.map((v) => {
    const rel = makePathRelativeToRoot(v.path, root)
    if (rel !== v.path) return { ...v, path: rel }
    return { ...v }
  })
}

function fromRelativeVaults(vaults: Vault[], root: string): Vault[] {
  return vaults.map((v) => {
    if (isAbsolutePath(v.path)) return v
    return { ...v, path: makePathAbsoluteFromRoot(v.path, root) }
  })
}

function toRelativeFavorites(abs: string[], root: string): string[] {
  return abs.map((p) => makePathRelativeToRoot(p, root))
}

function fromRelativeFavorites(rel: string[], root: string): string[] {
  return rel.map((p) => makePathAbsoluteFromRoot(p, root))
}

const SHARED_SETTINGS_KEYS: Array<keyof SharedSettings> = [
  'autosaveDebounceMs',
  'defaultCommitDebounceMs',
  'gitAuthorName',
  'gitAuthorEmail',
  'fileSortMode',
  'showHiddenFiles',
  'confirmDeleteLocal',
  'confirmDeleteGit',
  'useTrash',
  'enabledPlugins',
  'defaultCommitMode',
  'gitAutoMessage',
  'gitAutoMessageTemplate',
  'dailyNotesPath',
]

function pickSharedSettings(s: AppSettings): SharedSettings {
  const result = {} as Record<keyof SharedSettings, unknown>
  for (const key of SHARED_SETTINGS_KEYS) {
    result[key] = s[key as keyof AppSettings]
  }
  return result as SharedSettings
}

/**
 * Owns the pointer to the user's main repository and application-wide
 * preferences. Persistence is split:
 *   - Instance config (Tauri app dir)  → mainRepoPath, UI settings
 *   - Shared config (mainRepo/.neptu/) → vaults, groups, favorites, shared settings
 */
export const useSettingsStore = defineStore('settings', () => {
  const mainRepoPath = ref<string | null>(null)
  const initialized = ref(false)
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  const settingsDialogOpen = ref(false)
  const settingsDialogTab = ref('general')

  function openSettingsDialog(tab = 'general') {
    settingsDialogTab.value = tab
    settingsDialogOpen.value = true
  }

  const needsMainRepo = computed(
    () => initialized.value && !mainRepoPath.value,
  )

  async function init() {
    const config = useConfig()
    const { instance, migratedShared } = await config.loadInstanceConfig()
    mainRepoPath.value = instance.mainRepoPath ?? null

    // Apply instance settings
    settings.value = { ...DEFAULT_SETTINGS, ...instance.settings }

    if (mainRepoPath.value) {
      const shared = migratedShared
        ? (migratedShared as SharedConfig)
        : await config.loadSharedConfig(mainRepoPath.value)
      await applyShared(shared)
    }
    else if (migratedShared) {
      // Edge case: legacy config had shared data but no mainRepoPath.
      await applyShared(migratedShared as SharedConfig)
    }

    initialized.value = true
  }

  async function setMainRepo(path: string) {
    const config = useConfig()
    await config.ensureNeptuDir(path)

    // Ensure shared config file exists so it can be synced later
    const shared = await config.loadSharedConfig(path)

    mainRepoPath.value = path
    await persistInstance()
    await applyShared(shared)
  }

  async function applyShared(shared: Partial<SharedConfig>) {
    const s = shared as SharedConfig
    settings.value = { ...settings.value, ...s.settings }

    const root = mainRepoPath.value ?? ''
    const vaults = useVaultsStore()
    await vaults.hydrate(
      fromRelativeVaults(s.vaults ?? [], root),
      root,
      s.groups ?? [],
      fromRelativeFavorites(s.favorites ?? [], root),
    )

    const git = useGitStore()
    await git.refreshAllStatuses()
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    const oldDailyPath = settings.value.dailyNotesPath
    const newDailyPath = patch.dailyNotesPath
    if (newDailyPath !== undefined && newDailyPath !== oldDailyPath && mainRepoPath.value) {
      const dn = useDailyNotes()
      const oldBase = dn.getBaseDir(mainRepoPath.value, oldDailyPath)
      const newBase = dn.getBaseDir(mainRepoPath.value, newDailyPath)
      if (oldBase && newBase && oldBase !== newBase) {
        try {
          await dn.moveDailyNotes(oldBase, newBase)
          if (mainRepoPath.value) {
            await dn.commitIfGit(mainRepoPath.value)
          }
        }
        catch (error) {
          console.error('Failed to migrate daily notes', error)
        }
      }
    }
    settings.value = { ...settings.value, ...patch }
    if (patch.defaultCommitMode === 'manual') {
      const vaults = useVaultsStore()
      const git = useGitStore()
      for (const vault of vaults.list) {
        if (vault.type === 'git' && (vault.git?.commitMode ?? 'respect_config') === 'respect_config') {
          git.cancelCommit(vault.id)
        }
      }
    }
    await persist()
  }

  /**
   * Writes both instance and shared configs.
   */
  async function persist() {
    await persistInstance()
    if (mainRepoPath.value) {
      await persistShared()
    }
  }

  async function persistInstance() {
    const config = useConfig()
    const instance: InstanceConfig = {
      version: 1,
      mainRepoPath: mainRepoPath.value,
      settings: {
        layoutMode: settings.value.layoutMode,
        theme: settings.value.theme,
        locale: settings.value.locale,
        tabDisplayMode: settings.value.tabDisplayMode,
      },
    }
    await config.saveInstanceConfig(instance)
  }

  async function persistShared() {
    const config = useConfig()
    const vaults = useVaultsStore()
    const root = mainRepoPath.value!
    const shared: SharedConfig = {
      version: 1,
      vaults: toRelativeVaults(vaults.list, root),
      groups: vaults.groups,
      favorites: toRelativeFavorites(vaults.favorites, root),
      settings: pickSharedSettings(settings.value),
    }
    await config.saveSharedConfig(root, shared)
  }

  return {
    mainRepoPath,
    initialized,
    settings,
    needsMainRepo,
    settingsDialogOpen,
    settingsDialogTab,
    openSettingsDialog,
    init,
    setMainRepo,
    updateSettings,
    persist,
  }
})
