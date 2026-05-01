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
    const dispose = ctx.api.ui.addRightSidebarView({
      id: 'main',
      icon: 'i-lucide-link',
      title: 'Backlinks',
      order: 15,
      component: BacklinksView,
    })
    ctx.onUnload(dispose)
  },
}
