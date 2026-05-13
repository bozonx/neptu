import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  loadInstanceConfig: vi.fn(),
  loadSharedConfig: vi.fn(),
  saveInstanceConfig: vi.fn(),
  saveSharedConfig: vi.fn(),
  ensureNeptuDir: vi.fn(),
}))

mockNuxtImport('useConfig', () => {
  return () => configMock
})

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    configMock.loadInstanceConfig.mockResolvedValue({
      instance: {
        version: 1,
        mainRepoPath: null,
        settings: {
          theme: 'dark',
          locale: 'ru-RU',
        },
      },
    })
  })

  it('loads instance settings and marks initialization complete', async () => {
    const settings = useSettingsStore()

    await settings.init()

    expect(settings.initialized).toBe(true)
    expect(settings.mainRepoPath).toBeNull()
    expect(settings.settings.theme).toBe('dark')
    expect(settings.settings.locale).toBe('ru-RU')
  })

  it('persists instance settings when app settings change without a main repository', async () => {
    const settings = useSettingsStore()
    await settings.init()

    await settings.updateSettings({ theme: 'light' })

    expect(configMock.saveInstanceConfig).toHaveBeenCalledWith({
      version: 1,
      mainRepoPath: null,
      settings: expect.objectContaining({
        theme: 'light',
        locale: 'ru-RU',
      }),
    })
    expect(configMock.saveSharedConfig).not.toHaveBeenCalled()
  })
})
