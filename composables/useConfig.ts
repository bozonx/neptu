import { appConfigDir, join, resolve } from '@tauri-apps/api/path'
import { type } from '@tauri-apps/plugin-os'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import {
  DEFAULT_INSTANCE_SETTINGS,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_UI_STATE,
  type AppConfig,
  type InstanceConfig,
  type InstanceSettings,
  type SharedConfig,
  type SharedSettings,
  type UiState,
} from '~/types'

const CONFIG_FILE = 'config.json'
const UI_STATE_FILE = 'ui-state.json'
const NEPTU_DIR = '.neptu'
const SHARED_CONFIG_FILE = 'config.json'
const PLUGINS_DIR = 'plugins'
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

let instanceConfigPathCache: string | null = null
let uiStatePathCache: string | null = null

const instanceConfigWriter = createSerializedWriter<InstanceConfig>(async (data) => {
  if (!instanceConfigPathCache) return
  await writeTextFile(instanceConfigPathCache, JSON.stringify(data, null, 2))
})

const uiStateWriter = createSerializedWriter<UiState>(async (data) => {
  if (!uiStatePathCache) return
  await writeTextFile(uiStatePathCache, JSON.stringify(data, null, 2))
})

/**
 * Flushes any pending debounced writes. Call on app shutdown.
 */
export async function flushPendingWrites() {
  await Promise.all([instanceConfigWriter.flush(), uiStateWriter.flush()])
}

/**
 * Persistent configuration helpers.
 *
 * Two independent stores:
 *   - Instance config  → Tauri app config dir / `config.json`
 *   - Shared config    → `<mainRepo>/.neptu/config.json` (user-synced)
 *   - UI state         → Tauri app config dir / `ui-state.json`
 *   - Plugin state     → `<mainRepo>/.neptu/plugins/<id>.json`
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

  async function getInstanceConfigPath(): Promise<string> {
    return await join(await configDir(), CONFIG_FILE)
  }

  async function getUiStatePath(): Promise<string> {
    return await join(await configDir(), UI_STATE_FILE)
  }

  async function sharedConfigPath(mainRepoPath: string): Promise<string> {
    return await join(mainRepoPath, NEPTU_DIR, SHARED_CONFIG_FILE)
  }

  async function ensureNeptuDir(mainRepoPath: string): Promise<void> {
    const dir = await join(mainRepoPath, NEPTU_DIR)
    await fs.ensureDir(dir)
  }

  /**
   * Load instance-specific config from the Tauri app config directory.
   * If a legacy AppConfig is detected (contains vaults/groups/favorites),
   * it is split: shared fields are returned in `migratedShared` so the
   * caller can write them to `.neptu/config.json`, while the instance
   * file is rewritten in the new format.
   */
  async function loadInstanceConfig(): Promise<{ instance: InstanceConfig, migratedShared?: Partial<SharedConfig> }> {
    const configPath = await getInstanceConfigPath()
    instanceConfigPathCache = configPath
    uiStatePathCache = await getUiStatePath()
    await fs.ensureDir(await configDir())
    await instanceConfigWriter.flush()

    try {
      const raw = await fs.readText(configPath)
      const parsed = JSON.parse(raw) as Partial<AppConfig>

      const hasLegacyShared = Array.isArray(parsed.vaults) || Array.isArray(parsed.groups) || Array.isArray(parsed.favorites)

      const rawSettings = parsed.settings as Record<string, unknown> | undefined
      let instanceSettings: InstanceSettings = { ...DEFAULT_INSTANCE_SETTINGS, ...(parsed.settings ?? {}) }
      if (rawSettings?.layoutMode === 'auto') {
        const osType = await type()
        const detected = ['ios', 'android'].includes(osType) ? 'mobile' : 'desktop'
        instanceSettings = { ...instanceSettings, layoutMode: detected }
      }

      const instance: InstanceConfig = {
        version: 1,
        mainRepoPath: parsed.mainRepoPath ?? null,
        settings: instanceSettings,
      }

      if (hasLegacyShared) {
        const legacy = parsed.settings ?? {}
        const sharedSettings: SharedSettings = {
          ...DEFAULT_SHARED_SETTINGS,
          autosaveDebounceMs: (legacy as Partial<SharedSettings>).autosaveDebounceMs ?? DEFAULT_SHARED_SETTINGS.autosaveDebounceMs,
          defaultCommitDebounceMs: (legacy as Partial<SharedSettings>).defaultCommitDebounceMs ?? DEFAULT_SHARED_SETTINGS.defaultCommitDebounceMs,
          gitAuthorName: (legacy as Partial<SharedSettings>).gitAuthorName ?? DEFAULT_SHARED_SETTINGS.gitAuthorName,
          gitAuthorEmail: (legacy as Partial<SharedSettings>).gitAuthorEmail ?? DEFAULT_SHARED_SETTINGS.gitAuthorEmail,
          fileSortMode: (legacy as Partial<SharedSettings>).fileSortMode ?? DEFAULT_SHARED_SETTINGS.fileSortMode,
          showHiddenFiles: (legacy as Partial<SharedSettings>).showHiddenFiles ?? DEFAULT_SHARED_SETTINGS.showHiddenFiles,
          enabledPlugins: (legacy as Partial<SharedSettings>).enabledPlugins ?? DEFAULT_SHARED_SETTINGS.enabledPlugins,
        }

        const migratedShared: Partial<SharedConfig> = {
          version: 1,
          vaults: parsed.vaults ?? [],
          groups: parsed.groups ?? [],
          favorites: parsed.favorites ?? [],
          settings: sharedSettings,
        }

        // Rewrite instance config in the new (split) format
        await fs.writeText(configPath, JSON.stringify(instance, null, 2))
        return { instance, migratedShared }
      }

      return { instance }
    }
    catch {
      const osType = await type()
      const detectedLayout = ['ios', 'android'].includes(osType) ? 'mobile' : 'desktop'
      const instance: InstanceConfig = {
        version: 1,
        mainRepoPath: null,
        settings: { ...DEFAULT_INSTANCE_SETTINGS, layoutMode: detectedLayout },
      }
      await fs.writeText(configPath, JSON.stringify(instance, null, 2))
      return { instance }
    }
  }

  async function saveInstanceConfig(config: InstanceConfig): Promise<void> {
    if (!instanceConfigPathCache) instanceConfigPathCache = await getInstanceConfigPath()
    instanceConfigWriter.schedule(config)
  }

  async function loadSharedConfig(mainRepoPath: string): Promise<SharedConfig> {
    const path = await sharedConfigPath(mainRepoPath)
    await ensureNeptuDir(mainRepoPath)
    try {
      const raw = await fs.readText(path)
      const parsed = JSON.parse(raw) as Partial<SharedConfig>
      return {
        version: 1,
        vaults: parsed.vaults ?? [],
        groups: parsed.groups ?? [],
        favorites: parsed.favorites ?? [],
        settings: { ...DEFAULT_SHARED_SETTINGS, ...(parsed.settings ?? {}) },
      }
    }
    catch {
      const config: SharedConfig = {
        version: 1,
        vaults: [],
        groups: [],
        favorites: [],
        settings: { ...DEFAULT_SHARED_SETTINGS },
      }
      await fs.writeText(path, JSON.stringify(config, null, 2))
      return config
    }
  }

  async function saveSharedConfig(mainRepoPath: string, config: SharedConfig): Promise<void> {
    const path = await sharedConfigPath(mainRepoPath)
    await ensureNeptuDir(mainRepoPath)
    await fs.writeText(path, JSON.stringify(config, null, 2))
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

  async function getPluginStatePath(mainRepoPath: string, pluginId: string): Promise<string> {
    const dir = await join(mainRepoPath, NEPTU_DIR, PLUGINS_DIR)
    await fs.ensureDir(dir)
    const safe = pluginId.replace(/[^a-zA-Z0-9._-]/g, '_')
    return await join(dir, `${safe}.json`)
  }

  async function loadPluginState<T = unknown>(mainRepoPath: string, pluginId: string): Promise<T | null> {
    try {
      const path = await getPluginStatePath(mainRepoPath, pluginId)
      const raw = await fs.readText(path)
      return JSON.parse(raw) as T
    }
    catch {
      return null
    }
  }

  async function savePluginState<T = unknown>(mainRepoPath: string, pluginId: string, value: T): Promise<void> {
    const path = await getPluginStatePath(mainRepoPath, pluginId)
    await writeTextFile(path, JSON.stringify(value, null, 2))
  }

  return {
    getInstanceConfigPath,
    getUiStatePath,
    loadInstanceConfig,
    saveInstanceConfig,
    loadSharedConfig,
    saveSharedConfig,
    ensureNeptuDir,
    loadUiState,
    saveUiState,
    loadPluginState,
    savePluginState,
  }
}
