import type { Plugin } from '~/types/plugin'
import HistoryView from './HistoryView.vue'

export const historyPlugin: Plugin = {
  manifest: {
    id: 'com.neptu.history',
    name: 'History',
    version: '1.0.0',
    description: 'Shows recently modified files across all vaults.',
  },
  activate(ctx) {
    const { t } = useI18n()
    const dispose = ctx.api.ui.addLeftSidebarView({
      id: 'main',
      icon: 'i-lucide-clock',
      title: t('sidebar.history'),
      order: 10,
      component: HistoryView,
    })
    ctx.onUnload(dispose)
  },
}
