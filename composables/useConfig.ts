import { appConfigDir, join, resolve } from '@tauri-apps/api/path'
import { type } from '@tauri-apps/plugin-os'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, type AppConfig, type AppSettings, type UiState } from '~/types'

const CONFIG_FILE = 'config.json'
const UI_STATE_FILE = 'ui-state.json'

/**
 * Persistent configuration helpers.
 *
 * Config lives in the Tauri app config directory by default so the OS can back
 * it up. Override with `VITE_NEPTU_DEV_DIR` env variable for development.
 * Two JSON files are written:
 *   - config.json    → AppConfig (vaults, settings, groups, mainRepoPath)
 *   - ui-state.json  → UiState (active tab, etc.)
 */
export function useConfig() {
  const fs = useFs()

  async function configDir(): Promise<string> {
    const envDir = import.meta.env.VITE_NEPTU_DEV_DIR as string | undefined
    if (envDir) {
      return await resolve(envDir)
    }
    return await appConfigDir()
  }

  async function getConfigPath(): Promise<string> {
    return await join(await configDir(), CONFIG_FILE)
  }

  async function getUiStatePath(): Promise<string> {
    return await join(await configDir(), UI_STATE_FILE)
  }

  async function loadAppConfig(): Promise<AppConfig> {
    const configPath = await getConfigPath()
    await fs.ensureDir(await configDir())

    try {
      const raw = await fs.readText(configPath)
      const parsed = JSON.parse(raw) as Partial<AppConfig>

      // Migrate old 'auto' layoutMode to platform-specific default
      const rawSettings = parsed.settings as Record<string, unknown> | undefined
      if (rawSettings?.layoutMode === 'auto') {
        const osType = await type()
        const detected = ['ios', 'android'].includes(osType) ? 'mobile' : 'desktop'
        parsed.settings = { ...(parsed.settings ?? DEFAULT_SETTINGS), layoutMode: detected } as AppSettings
      }

      const config: AppConfig = {
        version: 1,
        mainRepoPath: parsed.mainRepoPath ?? null,
        vaults: parsed.vaults ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        groups: parsed.groups ?? [],
      }

      // Save back migrated config so 'auto' does not persist
      if (parsed.settings?.layoutMode) {
        await fs.writeText(configPath, JSON.stringify(config, null, 2))
      }

      return config
    }
    catch {
      const osType = await type()
      const detectedLayout = ['ios', 'android'].includes(osType) ? 'mobile' : 'desktop'
      const config: AppConfig = {
        version: 1,
        mainRepoPath: null,
        vaults: [],
        settings: { ...DEFAULT_SETTINGS, layoutMode: detectedLayout },
        groups: [],
      }
      await fs.writeText(configPath, JSON.stringify(config, null, 2))
      return config
    }
  }

  async function saveAppConfig(config: AppConfig): Promise<void> {
    const configPath = await getConfigPath()
    await fs.writeText(configPath, JSON.stringify(config, null, 2))
  }

  async function loadUiState(): Promise<UiState> {
    const path = await getUiStatePath()
    try {
      const raw = await fs.readText(path)
      const parsed = JSON.parse(raw) as Partial<UiState>
      return {
        ...DEFAULT_UI_STATE,
        ...parsed,
      }
    }
    catch {
      return { ...DEFAULT_UI_STATE }
    }
  }

  async function saveUiState(state: UiState): Promise<void> {
    const path = await getUiStatePath()
    await fs.writeText(path, JSON.stringify(state, null, 2))
  }

  return {
    getConfigPath,
    getUiStatePath,
    loadAppConfig,
    saveAppConfig,
    loadUiState,
    saveUiState,
  }
}
