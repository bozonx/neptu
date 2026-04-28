import { defineStore } from 'pinia'
import { basename, join } from '@tauri-apps/api/path'
import { DEFAULT_SETTINGS, type AppConfig, type AppSettings } from '~/types'

/**
 * Owns the pointer to the user's main repository and application-wide
 * preferences. Also acts as the single seam for persisting `AppConfig` to
 * the Tauri app config directory (`config.json`).
 *
 * Other stores call `persist()` after mutating data that lives in the config
 * (currently: `useVaultsStore` after vault changes). Persistence is centralized
 * here to keep a single writer for the file.
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
    const appConfig = await config.loadAppConfig()
    mainRepoPath.value = appConfig.mainRepoPath ?? null
    initialized.value = true
    if (mainRepoPath.value) {
      await applyConfig(appConfig)
    }
  }

  async function setMainRepo(path: string) {
    mainRepoPath.value = path
    await persist()
    const config = useConfig()
    const appConfig = await config.loadAppConfig()
    await applyConfig(appConfig)
  }

  async function changeMainRepo(newPath: string) {
    const oldPath = mainRepoPath.value
    if (!oldPath || oldPath === newPath) return

    const fs = useFs()
    const oldNeptu = await join(oldPath, '.neptu')
    const newNeptu = await join(newPath, '.neptu')

    if (await fs.exists(oldNeptu)) {
      try {
        await fs.renameFile(oldNeptu, newNeptu)
      }
      catch (error) {
        console.error('Failed to move .neptu folder:', error)
      }
    }

    const vaults = useVaultsStore()
    const mainVault = vaults.list.find((v) => v.path === oldPath)
    if (mainVault) {
      mainVault.path = newPath
      mainVault.name = await basename(newPath)
    }

    mainRepoPath.value = newPath
    await persist()
    const config = useConfig()
    const appConfig = await config.loadAppConfig()
    await applyConfig(appConfig)
  }

  async function applyConfig(appConfig: AppConfig) {
    settings.value = { ...DEFAULT_SETTINGS, ...appConfig.settings }

    const vaults = useVaultsStore()
    await vaults.hydrate(appConfig.vaults ?? [], mainRepoPath.value ?? '', appConfig.groups ?? [], appConfig.favorites ?? [])

    const git = useGitStore()
    await git.refreshAllStatuses()
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch }
    await persist()
  }

  /**
   * Serializes current settings + vault list to disk.
   */
  async function persist() {
    const config = useConfig()
    const vaults = useVaultsStore()
    const data: AppConfig = {
      version: 1,
      mainRepoPath: mainRepoPath.value,
      settings: { ...settings.value },
      vaults: vaults.list,
      groups: vaults.groups,
      favorites: vaults.favorites,
    }
    await config.saveAppConfig(data)
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
    changeMainRepo,
    updateSettings,
    persist,
  }
})
