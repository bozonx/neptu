import { load as loadStore } from '@tauri-apps/plugin-store'
import { join } from '@tauri-apps/api/path'
import type { AppConfig } from '~/types'

const SYSTEM_STORE_FILE = 'neptu.json'
const MAIN_REPO_KEY = 'mainRepoPath'
const NEPTU_DIR = '.neptu'
const CONFIG_FILE = 'config.json'

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  projects: [],
}

/**
 * Persistent configuration helpers.
 *
 * The system store keeps only a pointer to the main repository.
 * The main repository owns `.neptu/config.json` so the user can sync settings
 * between devices via their preferred sync method.
 */
export function useConfig() {
  const fs = useFs()

  async function getMainRepoPath(): Promise<string | null> {
    const store = await loadStore(SYSTEM_STORE_FILE)
    const value = await store.get<string>(MAIN_REPO_KEY)
    return value ?? null
  }

  async function setMainRepoPath(path: string): Promise<void> {
    const store = await loadStore(SYSTEM_STORE_FILE)
    await store.set(MAIN_REPO_KEY, path)
    await store.save()
  }

  async function getConfigFilePath(repoPath: string): Promise<string> {
    const dir = await join(repoPath, NEPTU_DIR)
    return await join(dir, CONFIG_FILE)
  }

  async function loadAppConfig(repoPath: string): Promise<AppConfig> {
    const dir = await join(repoPath, NEPTU_DIR)
    await fs.ensureDir(dir)
    const configPath = await join(dir, CONFIG_FILE)

    try {
      const raw = await fs.readMarkdown(configPath)
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      return {
        version: 1,
        projects: parsed.projects ?? [],
      }
    }
    catch {
      // First run inside this repo: write defaults
      await fs.writeMarkdown(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return { ...DEFAULT_CONFIG }
    }
  }

  async function saveAppConfig(repoPath: string, config: AppConfig): Promise<void> {
    const configPath = await getConfigFilePath(repoPath)
    await fs.writeMarkdown(configPath, JSON.stringify(config, null, 2))
  }

  return {
    getMainRepoPath,
    setMainRepoPath,
    loadAppConfig,
    saveAppConfig,
  }
}
