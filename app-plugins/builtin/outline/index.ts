import type { Plugin } from '~/types/plugin'
import OutlineView from './OutlineView.vue'

export const outlinePlugin: Plugin = {
  manifest: {
    id: 'com.neptu.outline',
    name: 'Outline',
    version: '1.0.0',
    description: 'Shows the heading structure of the current markdown file.',
  },
  activate(ctx) {
    const { t } = useI18n()
    const viewFqid = `${ctx.manifest.id}:main`
    const plugins = usePluginsStore()
    const tabs = useTabsStore()
    ctx.api.ui.addRightSidebarView({
      id: 'main',
      icon: 'i-lucide-list-tree',
      title: t('sidebar.outline'),
      order: 10,
      component: OutlineView,
    })
    ctx.api.ui.addCommand({
      id: 'open-outline',
      label: () => t('commands.openOutline'),
      icon: 'i-lucide-list-tree',
      onRun: () => {
        plugins.setActiveRightSidebarView(viewFqid)
        tabs.rightSidebarCollapsed = false
      },
    })
  },
}
