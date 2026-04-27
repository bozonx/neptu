import { useI18n } from 'vue-i18n'
import type { Plugin } from '~/types/plugin'
import FileInfoView from './FileInfoView.vue'

export const fileInfoPlugin: Plugin = {
  manifest: {
    id: 'com.neptu.file-info',
    name: 'File Info',
    version: '1.0.0',
    description: 'Shows name, vault and path of the current file.',
  },
  activate(ctx) {
    const { t } = useI18n()
    const dispose = ctx.api.ui.addRightSidebarView({
      id: 'main',
      icon: 'i-lucide-info',
      title: t('sidebar.fileInfo'),
      order: 20,
      component: FileInfoView,
    })
    ctx.onUnload(dispose)
  },
}
