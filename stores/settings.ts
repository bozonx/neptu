import { defineStore } from 'pinia'
import { DEFAULT_SETTINGS, type AppConfig, type AppSettings } from '~/types'

/**
 * Owns the pointer to the user's main repository and application-wide
 * preferences. Also acts as the single seam for persisting `AppConfig` to
 * `<mainRepoPath>/.neptu/config.json`.
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
    mainRepoPath.value = await config.getMainRepoPath()
    initialized.value = true
    if (mainRepoPath.value) {
      await loadFromRepo(mainRepoPath.value)
    }
  }

  async function setMainRepo(path: string) {
    const config = useConfig()
    await config.setMainRepoPath(path)
    mainRepoPath.value = path
    await loadFromRepo(path)
  }

  async function loadFromRepo(repoPath: string) {
    const config = useConfig()
    const appConfig = await config.loadAppConfig(repoPath)
    settings.value = { ...DEFAULT_SETTINGS, ...appConfig.settings }

    const vaults = useVaultsStore()
    await vaults.hydrate(appConfig.vaults, repoPath)

    const git = useGitStore()
    await git.refreshAllStatuses()
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch }
    await persist()
  }

  /**
   * Serializes current settings + vault list to disk. Safe no-op while no
   * main repository is set (e.g. during the first-run wizard).
   */
  async function persist() {
    if (!mainRepoPath.value) return
    const config = useConfig()
    const vaults = useVaultsStore()
    const data: AppConfig = {
      version: 1,
      settings: { ...settings.value },
      vaults: vaults.list,
    }
    await config.saveAppConfig(mainRepoPath.value, data)
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
