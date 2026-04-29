<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { useGitStore } from '~/stores/git'
import { useSettingsStore } from '~/stores/settings'
import { useTabsStore } from '~/stores/tabs'

const editorStore = useEditorStore()
const gitStore = useGitStore()
const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const toast = useToast()
const { t } = useI18n()

const stats = computed(() => {
  const text = editorStore.activeSelectionText || editorStore.currentContent
  const chars = text.length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  if (editorStore.activeSelectionText) {
    return `${words} words, ${chars} chars (selected)`
  }
  return `${words} words, ${chars} chars`
})

const currentVault = computed(() => editorStore.currentVault)
const isManualGit = computed(() => {
  const v = currentVault.value
  return v?.type === 'git' && v.git?.commitMode === 'manual'
})
const showCommit = computed(() => {
  if (!isManualGit.value || !currentVault.value) return false
  const vId = currentVault.value.id
  return gitStore.status[vId]?.dirty ?? false
})
const committing = computed(() => {
  if (!currentVault.value) return false
  return gitStore.commitStatus[currentVault.value.id] === 'committing'
})

const pendingCommit = computed(() => {
  if (!currentVault.value) return false
  return gitStore.pendingCommits[currentVault.value.id] ?? false
})

async function handleCommit() {
  const vault = currentVault.value
  if (!vault || vault.type !== 'git') return
  gitStore.cancelCommit(vault.id)
  const useAuto = settingsStore.settings.gitAutoMessage ?? true
  let message: string | undefined
  if (!useAuto) {
    const input = prompt(t('git.commitMessagePrompt'))
    if (input === null) return
    message = input.trim() || undefined
  }
  try {
    await gitStore.commit(vault.id, message)
    toast.add({ title: t('toast.commitCompleted'), color: 'success' })
    await gitStore.refreshStatus(vault.id)
  }
  catch (error) {
    toast.add({ title: t('toast.commitFailed'), description: String(error), color: 'error' })
  }
}

async function toggleAutoMessage() {
  await settingsStore.updateSettings({
    gitAutoMessage: !settingsStore.settings.gitAutoMessage,
  })
}
</script>

<template>
  <div
    v-if="editorStore.currentFilePath"
    class="fixed bottom-0 right-0 h-7 pl-3 pr-1 bg-elevated border-t border-l border-default text-xs text-muted flex items-center whitespace-nowrap z-40 gap-2 max-w-full"
  >
    <span class="pointer-events-none truncate min-w-0">{{ stats }}</span>

    <UIcon
      v-if="pendingCommit"
      name="i-lucide-loader-circle"
      class="size-3.5 shrink-0 animate-spin text-muted"
      :title="$t('git.pendingCommit')"
    />

    <template v-if="isManualGit">
      <USwitch
        :model-value="settingsStore.settings.gitAutoMessage ?? true"
        size="xs"
        :label="$t('git.autoMessage')"
        @update:model-value="toggleAutoMessage"
      />
      <UButton
        icon="i-lucide-git-commit"
        size="xs"
        color="neutral"
        variant="ghost"
        class="w-5 h-5 justify-center px-0 shrink-0"
        :title="$t('git.commit')"
        :disabled="!showCommit"
        :loading="committing"
        @click="handleCommit"
      />
    </template>

    <UButton
      :icon="tabsStore.rightSidebarCollapsed ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right'"
      size="xs"
      color="neutral"
      variant="ghost"
      class="w-5 h-5 justify-center px-0 shrink-0"
      :title="tabsStore.rightSidebarCollapsed ? $t('sidebar.showRightSidebar') : $t('sidebar.hideRightSidebar')"
      @click="tabsStore.rightSidebarCollapsed = !tabsStore.rightSidebarCollapsed"
    />
  </div>
</template>
