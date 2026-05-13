import { createPluginContext } from '~/app-plugins/api'
import type { Plugin, PluginManifest } from '~/types/plugin'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const manifest: PluginManifest = {
  id: 'test.plugin',
  name: 'Test Plugin',
  version: '1.0.0',
}

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('plugins store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('registers plugin UI specs with fully qualified ids and disposes them', () => {
    const store = usePluginsStore()
    const cleanups: Array<() => void> = []
    const ctx = createPluginContext(manifest, cleanups)
    const onClick = vi.fn()

    const dispose = ctx.api.ui.addSidebarButton({
      id: 'open',
      icon: 'i-lucide-panel-right',
      location: 'left-sidebar-footer',
      onClick,
      order: 10,
    })

    expect(store.sidebarButtons).toHaveLength(1)
    expect(store.sidebarButtons[0]).toMatchObject({
      id: 'open',
      pluginId: 'test.plugin',
      fqid: 'test.plugin:open',
      order: 10,
    })
    expect(cleanups).toContain(dispose)

    dispose()

    expect(store.sidebarButtons).toHaveLength(0)
  })

  it('opens and closes plugin modals through the registered handle', () => {
    const store = usePluginsStore()
    const cleanups: Array<() => void> = []
    const ctx = createPluginContext(manifest, cleanups)
    const onClose = vi.fn()
    const ModalBody = defineComponent({ template: '<div />' })

    const handle = ctx.api.ui.openModal({
      id: 'details',
      component: ModalBody,
      onClose,
    })

    expect(handle.id).toBe('test.plugin:details')
    expect(store.modals).toHaveLength(1)

    handle.close()

    expect(store.modals).toHaveLength(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('replaces duplicate registrations and keeps dispose scoped to its own registration', () => {
    const store = usePluginsStore()
    const cleanups: Array<() => void> = []
    const ctx = createPluginContext(manifest, cleanups)

    const firstDispose = ctx.api.ui.addSidebarButton({
      id: 'open',
      icon: 'i-lucide-panel-left',
      location: 'left-sidebar-footer',
      onClick: vi.fn(),
    })

    const secondClick = vi.fn()
    ctx.api.ui.addSidebarButton({
      id: 'open',
      icon: 'i-lucide-panel-right',
      location: 'left-sidebar-footer',
      onClick: secondClick,
    })

    expect(store.sidebarButtons).toHaveLength(1)
    expect(store.sidebarButtons[0]).toMatchObject({
      fqid: 'test.plugin:open',
      icon: 'i-lucide-panel-right',
    })

    firstDispose()

    expect(store.sidebarButtons).toHaveLength(1)

    store.sidebarButtons[0]?.onClick()

    expect(secondClick).toHaveBeenCalledTimes(1)
  })

  it('awaits async deactivate before cleanup finishes', async () => {
    const store = usePluginsStore()
    const order: string[] = []
    let resolveDeactivate: (() => void) | undefined

    const plugin: Plugin = {
      manifest,
      activate(ctx) {
        ctx.onUnload(() => order.push('cleanup'))
      },
      deactivate: () => new Promise<void>((resolve) => {
        resolveDeactivate = () => {
          order.push('deactivate')
          resolve()
        }
      }),
    }

    await store.load(plugin)
    const unloadPromise = store.unload(manifest.id)
    await Promise.resolve()

    expect(order).toEqual([])

    resolveDeactivate?.()
    await unloadPromise

    expect(order).toEqual(['deactivate', 'cleanup'])
    expect(store.loaded.has(manifest.id)).toBe(false)
  })

  it('deduplicates concurrent load calls for the same plugin', async () => {
    const store = usePluginsStore()
    let resolveActivate: (() => void) | undefined
    const activate = vi.fn(() => new Promise<void>((resolve) => {
      resolveActivate = resolve
    }))
    const plugin: Plugin = { manifest, activate }

    const first = store.load(plugin)
    const second = store.load(plugin)

    await waitForMicrotasks()

    expect(activate).toHaveBeenCalledTimes(1)

    resolveActivate?.()
    await Promise.all([first, second])

    expect(activate).toHaveBeenCalledTimes(1)
    expect(store.loaded.has(manifest.id)).toBe(true)
  })

  it('contains plugin callback errors so they do not escape callers', () => {
    const store = usePluginsStore()
    const cleanups: Array<() => void> = []
    const ctx = createPluginContext(manifest, cleanups)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ctx.api.ui.addCommand({
      id: 'explode',
      label: 'Explode',
      onRun: () => {
        throw new Error('boom')
      },
      visible: () => {
        throw new Error('visible boom')
      },
    })

    expect(() => store.commandPaletteItems[0]?.onRun()).not.toThrow()
    expect(store.commandPaletteItems[0]?.visible?.()).toBe(false)
    expect(errorSpy).toHaveBeenCalledTimes(2)
  })
})
