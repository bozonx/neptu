import type { Ref } from 'vue'
import type { FileFilterSettings, Vault } from '~/types'
import type { AutoConvertSettings } from '~/types/vault-config'
import {
  basename,
  dirname,
  fileExt,
  fileStem,
  replacePathPrefix,
  stripLeadingDot,
} from '~/utils/paths'
import { applyAutoConvert, getVisibleImportIssue } from '~/utils/vaults/media'

interface VaultFileActionsContext {
  t: (key: string, params?: Record<string, unknown>) => string
  confirm: { ask: (title: string, message: string) => Promise<boolean> }
  favorites: Ref<string[]>
  findById: (id: string) => Vault | null
  findVaultForPath: (filePath: string) => Vault | null
  refreshTree: (vault: Vault) => Promise<void>
  getEffectiveFilters: (vault: Vault) => FileFilterSettings
  getEffectiveExcludes: (vault: Vault) => string[]
  getEffectiveAutoConvert: (vault: Vault) => AutoConvertSettings | undefined
}

export function createVaultFileActions(ctx: VaultFileActionsContext) {
  async function createVaultFolder(
    vault: Vault,
    parentDir: string,
    folderName: string,
  ) {
    const fs = useFs()
    const fullPath = await fs.createFolder(parentDir, folderName)
    await ctx.refreshTree(vault)
    return fullPath
  }

  async function moveNode(sourcePath: string, targetDirPath: string) {
    const fs = useFs()
    const editor = useEditorStore()
    const git = useGitStore()
    const name = basename(sourcePath)
    const destPath = await fs.join(targetDirPath, name)
    const sourceInfo = await fs.stat(sourcePath)

    if (sourcePath === destPath) return

    if (await fs.exists(destPath)) {
      const overwrite = await ctx.confirm.ask(
        ctx.t('confirm.overwriteTitle'),
        ctx.t('confirm.overwriteMessage', { name }),
      )
      if (!overwrite) return
    }

    const sourceVault = ctx.findVaultForPath(sourcePath)
    const targetVault = ctx.findVaultForPath(targetDirPath)

    if (sourceVault) await editor.flushVault(sourceVault)
    if (targetVault && targetVault.id !== sourceVault?.id)
      await editor.flushVault(targetVault)

    await fs.moveFile(sourcePath, destPath)
    useSearchStore().removeFile(sourcePath)

    if (sourceVault) await ctx.refreshTree(sourceVault)
    if (targetVault && targetVault.id !== sourceVault?.id)
      await ctx.refreshTree(targetVault)

    await useTabsStore().updatePath(
      sourcePath,
      destPath,
      sourceInfo.isDirectory,
    )

    const favoritesChanged = updateMovedFavorites(
      ctx.favorites,
      sourcePath,
      destPath,
      sourceInfo.isDirectory,
    )

    if (sourceVault?.type === 'git') {
      await git.commitIfAuto(sourceVault.id)
    }
    if (targetVault?.type === 'git' && targetVault.id !== sourceVault?.id) {
      await git.commitIfAuto(targetVault.id)
    }
    if (favoritesChanged) await useSettingsStore().persist()
  }

  async function copyNode(sourcePath: string, targetDirPath: string) {
    const fs = useFs()
    const editor = useEditorStore()
    const git = useGitStore()
    const name = basename(sourcePath)
    const destPath = await fs.join(targetDirPath, name)

    if (sourcePath === destPath) return

    if (await fs.exists(destPath)) {
      const overwrite = await ctx.confirm.ask(
        ctx.t('confirm.overwriteTitle'),
        ctx.t('confirm.overwriteMessage', { name }),
      )
      if (!overwrite) return
    }

    const targetVault = ctx.findVaultForPath(targetDirPath)
    if (targetVault) await editor.flushVault(targetVault)

    const info = await fs.stat(sourcePath)
    if (info.isDirectory) {
      await fs.copyFolder(sourcePath, destPath)
    }
    else {
      await fs.copyFile(sourcePath, destPath)
    }

    if (targetVault) {
      await ctx.refreshTree(targetVault)
      if (targetVault.type === 'git') {
        await git.commitIfAuto(targetVault.id)
      }
    }
  }

  async function renameNode(
    vaultId: string,
    sourcePath: string,
    newName: string,
  ) {
    if (!newName.trim()) return

    const fs = useFs()
    const editor = useEditorStore()
    const git = useGitStore()
    const tabs = useTabsStore()

    const vault = ctx.findById(vaultId)
    if (!vault) return

    const dir = dirname(sourcePath)
    const destPath = await fs.join(dir, newName.trim())

    if (sourcePath === destPath) return

    if (await fs.exists(destPath)) {
      throw new Error(`An item named "${newName}" already exists.`)
    }

    const sourceInfo = await fs.stat(sourcePath)

    await editor.flushVault(vault)
    await fs.renameFile(sourcePath, destPath)
    useSearchStore().removeFile(sourcePath)
    await ctx.refreshTree(vault)
    await tabs.updatePath(sourcePath, destPath, sourceInfo.isDirectory)

    const favoritesChanged = updateMovedFavorites(
      ctx.favorites,
      sourcePath,
      destPath,
      sourceInfo.isDirectory,
    )

    if (vault.type === 'git') {
      await git.commitIfAuto(vault.id)
    }
    if (favoritesChanged) await useSettingsStore().persist()
  }

  async function importExternalFiles(
    paths: string[],
    targetDir: string,
  ): Promise<string[]> {
    const fs = useFs()
    const vault = ctx.findVaultForPath(targetDir)
    if (!vault) return []

    const importedPaths: string[] = []
    const hiddenPaths: string[] = []
    const filters = ctx.getEffectiveFilters(vault)
    const excludes = ctx.getEffectiveExcludes(vault)
    const settingsStore = useSettingsStore()
    const showHidden = settingsStore.settings.showHiddenFiles

    for (const sourcePath of paths) {
      try {
        const name = stripLeadingDot(basename(sourcePath))
        const destPath = await fs.join(targetDir, name)
        let importedPath = destPath

        if (sourcePath === destPath) {
          importedPaths.push(destPath)
          continue
        }

        let finalDestPath = destPath
        if (await fs.exists(destPath)) {
          const destDir = dirname(destPath)
          const name = basename(destPath)
          const stem = fileStem(name)
          const ext = fileExt(name)
          let suffix = 2
          let candidate = await fs.join(destDir, `${stem}-${suffix}${ext}`)
          while (await fs.exists(candidate)) {
            suffix++
            candidate = await fs.join(destDir, `${stem}-${suffix}${ext}`)
          }
          finalDestPath = candidate
        }

        const info = await fs.stat(sourcePath)
        if (info.isDirectory) {
          await fs.copyFolder(sourcePath, finalDestPath)
          importedPaths.push(finalDestPath)
        }
        else {
          await fs.copyFile(sourcePath, finalDestPath)
          const finalPath = await applyAutoConvert(
            vault,
            finalDestPath,
            ctx.getEffectiveAutoConvert,
          )
          importedPath = finalPath
          importedPaths.push(finalPath)
        }

        const hiddenName = getVisibleImportIssue(importedPath, {
          showHidden,
          filters,
          excludes,
        })
        if (hiddenName) hiddenPaths.push(hiddenName)
      }
      catch (e) {
        console.error('Failed to import file', sourcePath, e)
      }
    }

    if (importedPaths.length > 0) {
      await ctx.refreshTree(vault)
      if (vault.type === 'git') {
        const git = useGitStore()
        await git.commitIfAuto(vault.id)
      }
    }

    if (hiddenPaths.length > 0) {
      const { useToast } = await import('#imports')
      const toast = useToast()
      toast.add({
        title: ctx.t('toast.hiddenFilesImported'),
        description: ctx.t('toast.hiddenFilesImportedDesc', {
          files: hiddenPaths.join(', '),
        }),
        color: 'warning',
      })
    }

    return importedPaths
  }

  return {
    createVaultFolder,
    moveNode,
    copyNode,
    renameNode,
    importExternalFiles,
  }
}

function updateMovedFavorites(
  favorites: Ref<string[]>,
  sourcePath: string,
  destPath: string,
  isDirectory: boolean,
): boolean {
  let changed = false
  favorites.value = favorites.value.map((favoritePath) => {
    const nextPath = isDirectory
      ? replacePathPrefix(favoritePath, sourcePath, destPath)
      : favoritePath === sourcePath
        ? destPath
        : favoritePath
    if (nextPath !== favoritePath) changed = true
    return nextPath
  })
  return changed
}
