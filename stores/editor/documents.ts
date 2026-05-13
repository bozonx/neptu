import type { Vault } from '~/types'

interface CreateFilePayload {
  vault: Vault
  fileName: string
  parentDir?: string
}

export function useEditorDocuments(resetBuffer: (path?: string) => void) {
  async function createNote(payload: CreateFilePayload) {
    const fs = useFs()
    const dir = payload.parentDir ?? useVaultsStore().getEffectiveContentRoot(payload.vault)
    const fullPath = await fs.createMarkdown(dir, payload.fileName)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      const git = useGitStore()
      await git.commit(payload.vault.id)
      await git.refreshStatus(payload.vault.id)
    }
    await useTabsStore().openFile(fullPath)
    useSearchStore().updateFile(fullPath, '')
    return fullPath
  }

  async function createFile(payload: CreateFilePayload) {
    const fs = useFs()
    const dir = payload.parentDir ?? useVaultsStore().getEffectiveContentRoot(payload.vault)
    const fullPath = await fs.createFile(dir, payload.fileName)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      const git = useGitStore()
      await git.commit(payload.vault.id)
      await git.refreshStatus(payload.vault.id)
    }
    await useTabsStore().openFile(fullPath)
    useSearchStore().updateFile(fullPath, '')
    return fullPath
  }

  async function deleteNote(payload: { vault: Vault, path: string }) {
    const fs = useFs()
    if (payload.vault.type === 'git') useGitStore().cancelCommit(payload.vault.id)
    resetBuffer(payload.path)

    await useTabsStore().dropByPath(payload.path)
    const settings = useSettingsStore()
    if (payload.vault.type === 'local' && settings.settings.useTrash) {
      await fs.moveToTrash(payload.path, payload.vault.path)
    }
    else {
      await fs.deleteFile(payload.path)
    }
    useSearchStore().removeFile(payload.path)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      const git = useGitStore()
      await git.commit(payload.vault.id)
      await git.refreshStatus(payload.vault.id)
    }
  }

  return {
    createNote,
    createFile,
    deleteNote,
  }
}
