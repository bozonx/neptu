import { appConfigDir, join, resolve } from '@tauri-apps/api/path'
import { type } from '@tauri-apps/plugin-os'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, type AppConfig, type AppSettings, type UiState } from '~/types'

const CONFIG_FILE = 'config.json'
const UI_STATE_FILE = 'ui-state.json'
const PERSIST_DEBOUNCE_MS = 200

/**
 * Serialized + debounced writer. Coalesces rapid writes (pane drag, autosave
 * bursts) and guarantees only one filesystem write is in flight per file at a
 * time. The latest pending payload always wins.
 */
function createSerializedWriter<T>(write: (data: T) => Promise<void>) {
  let pending: { data: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null

  async function drain() {
    timer = null
    while (pending) {
      const { data } = pending
      pending = null
      inFlight = write(data)
        .catch((error) => {
          console.error('[useConfig] persist failed', error)
        })
        .finally(() => {
          inFlight = null
        })
      await inFlight
    }
  }

  return {
    schedule(data: T) {
      pending = { data }
      if (timer) return
      timer = setTimeout(() => {
        void drain()
      }, PERSIST_DEBOUNCE_MS)
    },
    async flush() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (inFlight) {
        try {
          await inFlight
        }
        catch {
          // already logged
        }
      }
      await drain()
    },
  }
}

let configPathCache: string | null = null
let uiStatePathCache: string | null = null

const configWriter = createSerializedWriter<AppConfig>(async (data) => {
  if (!configPathCache) return
  await writeTextFile(configPathCache, JSON.stringify(data, null, 2))
})

const uiStateWriter = createSerializedWriter<UiState>(async (data) => {
  if (!uiStatePathCache) return
  await writeTextFile(uiStatePathCache, JSON.stringify(data, null, 2))
})

/**
 * Flushes any pending debounced writes. Call on app shutdown.
 */
export async function flushPendingWrites() {
  await Promise.all([configWriter.flush(), uiStateWriter.flush()])
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
    configPathCache = configPath
    uiStatePathCache = await getUiStatePath()
    await fs.ensureDir(await configDir())
    // Make sure any pending debounced write has landed before we read it back.
    await configWriter.flush()

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
    if (!configPathCache) configPathCache = await getConfigPath()
    configWriter.schedule(config)
  }

  async function loadUiState(): Promise<UiState> {
    const path = await getUiStatePath()
    if (!uiStatePathCache) uiStatePathCache = path
    await uiStateWriter.flush()
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
    if (!uiStatePathCache) uiStatePathCache = await getUiStatePath()
    uiStateWriter.schedule(state)
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
