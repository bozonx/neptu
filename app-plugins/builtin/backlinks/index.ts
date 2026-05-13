import type { Plugin } from '~/types/plugin'
import BacklinksView from './BacklinksView.vue'

export const backlinksPlugin: Plugin = {
  manifest: {
    id: 'com.neptu.backlinks',
    name: 'Backlinks',
    version: '1.0.0',
    description: 'Shows files that link to the current note.',
  },
  activate(ctx) {
    const { t } = useI18n()
    const viewFqid = `${ctx.manifest.id}:main`
    const plugins = usePluginsStore()
    const tabs = useTabsStore()
    ctx.api.ui.addRightSidebarView({
      id: 'main',
      icon: 'i-lucide-link',
      title: t('sidebar.backlinks'),
      order: 15,
      component: BacklinksView,
    })
    ctx.api.ui.addCommand({
      id: 'open-backlinks',
      label: () => t('commands.openBacklinks'),
      icon: 'i-lucide-link',
      onRun: () => {
        plugins.setActiveRightSidebarView(viewFqid)
        tabs.rightSidebarCollapsed = false
      },
    })
  },
}
