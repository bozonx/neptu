import { createPluginContext } from '~/app-plugins/api'
import type { PluginManifest } from '~/types/plugin'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const manifest: PluginManifest = {
  id: 'test.plugin',
  name: 'Test Plugin',
  version: '1.0.0',
}

describe('plugins store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
})
