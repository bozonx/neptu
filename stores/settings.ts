import { defineStore } from 'pinia'
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

  async function applyConfig(appConfig: AppConfig) {
    settings.value = { ...DEFAULT_SETTINGS, ...appConfig.settings }

    const vaults = useVaultsStore()
    await vaults.hydrate(appConfig.vaults ?? [], mainRepoPath.value ?? '', appConfig.groups ?? [])

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
    }
    await config.saveAppConfig(data)
  }

  return {
    mainRepoPath,
    initialized,
    settings,
    needsMainRepo,
    init,
    setMainRepo,
    updateSettings,
    persist,
  }
})
