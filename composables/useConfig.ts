import { appConfigDir, join } from '@tauri-apps/api/path'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, type AppConfig, type UiState } from '~/types'

const CONFIG_FILE = 'config.json'
const UI_STATE_FILE = 'ui-state.json'

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  mainRepoPath: null,
  vaults: [],
  settings: { ...DEFAULT_SETTINGS },
  groups: [],
}

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
      return envDir
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
      return {
        version: 1,
        mainRepoPath: parsed.mainRepoPath ?? null,
        vaults: parsed.vaults ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        groups: parsed.groups ?? [],
      }
    }
    catch {
      await fs.writeText(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return { ...DEFAULT_CONFIG }
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
        activeRightTab: parsed.activeRightTab ?? DEFAULT_UI_STATE.activeRightTab,
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
