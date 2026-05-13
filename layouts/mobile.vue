<script setup lang="ts">
const editor = useEditorStore()
const tabsStore = useTabsStore()
const settings = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)

const activeTab = computed(() => {
  return tabsStore.mobileTabs.find((t) => t.id === tabsStore.mobileActiveId)
})

// Global save error notification
watch(() => {
  const path = activeTab.value?.filePath
  return path ? editor.buffers[path]?.saveError : null
}, (error) => {
  if (error) {
    toast.add({
      title: t('toast.saveFailed'),
      description: error,
      color: 'error',
    })
  }
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-default text-default">
    <!-- Mobile Top Bar -->
    <header class="h-12 border-b border-default flex items-center px-3 gap-2 shrink-0 bg-default z-10">
      <UButton
        icon="i-lucide-menu"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="leftDrawerOpen = true"
      />

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <UIcon
          name="i-lucide-book-marked"
          class="size-5 text-primary shrink-0"
        />
        <span class="font-semibold text-sm truncate">Neptu</span>
      </div>

      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-settings"
          size="sm"
          color="neutral"
          variant="ghost"
          :title="$t('sidebar.settings')"
          @click="settings.openSettingsDialog()"
        />
        <!-- Right Sidebar Toolbar moved to Top Bar -->
        <FileSidebarToolbar
          class="bg-elevated/50 rounded-lg px-1 py-0.5"
          @click.capture="rightDrawerOpen = true"
        />
      </div>
    </header>

    <!-- Central Content -->
    <main class="flex-1 min-h-0 overflow-hidden relative">
      <slot />
    </main>

    <!-- Left Drawer (Mobile Navigation) -->
    <USlideover
      v-model:open="leftDrawerOpen"
      side="left"
      :title="$t('sidebar.navigation')"
    >
      <template #content>
        <div class="flex-1 overflow-hidden">
          <AppSidebar />
        </div>
      </template>
    </USlideover>

    <!-- Right Drawer (Mobile File Info/Outline) -->
    <USlideover
      v-model:open="rightDrawerOpen"
      side="right"
      :title="$t('sidebar.fileDetails')"
    >
      <template #content>
        <div class="flex-1 overflow-hidden">
          <!-- Toolbar hidden because it is already in the Top Bar -->
          <FileSidebar :show-toolbar="false" />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
</style>
