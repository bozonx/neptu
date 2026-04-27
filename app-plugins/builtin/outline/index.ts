import { useI18n } from 'vue-i18n'
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
    const dispose = ctx.api.ui.addRightSidebarView({
      id: 'main',
      icon: 'i-lucide-list-tree',
      title: t('sidebar.outline'),
      order: 10,
      component: OutlineView,
    })
    ctx.onUnload(dispose)
  },
}
