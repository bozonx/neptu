<script setup lang="ts">
import type { GitCommitMode, Vault } from '~/types'

interface ToggleItem<T extends string = string> {
  label: string
  value: T
}

const props = defineProps<{
  vault: Vault | null
  defaultCommitDebounceMs: number
  commitModeItems: ToggleItem<GitCommitMode>[]
  showCommitDebounce: boolean
}>()

const commitMode = defineModel<GitCommitMode>('commitMode', { required: true })
const commitDebounceSec = defineModel<number>('commitDebounceSec', { required: true })
const editingCommitDebounce = defineModel<boolean>('editingCommitDebounce', { required: true })

const currentDebounceSec = computed(() =>
  ((props.vault?.git?.commitDebounceMs ?? props.defaultCommitDebounceMs) / 1000).toFixed(1),
)

function resetDebounce() {
  editingCommitDebounce.value = false
  commitDebounceSec.value = props.defaultCommitDebounceMs / 1000
}
</script>

<template>
  <section
    v-if="vault?.type === 'git'"
    class="space-y-3"
  >
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
      {{ $t('settings.git') }}
    </h3>
    <UFormField :label="$t('vault.commitMode')">
      <ButtonGroupToggle
        v-model="commitMode"
        :items="commitModeItems"
      />
    </UFormField>
    <UFormField
      v-if="showCommitDebounce"
      :label="$t('vault.commitDebounce')"
    >
      <template v-if="!editingCommitDebounce">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
            {{ currentDebounceSec }}s
          </span>
          <span
            v-if="vault?.git?.commitDebounceMs !== undefined"
            class="text-xs text-muted"
          >
            {{ $t('vault.customValue') }}
          </span>
          <span
            v-else
            class="text-xs text-muted"
          >
            {{ $t('vault.fromConfig') }}
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :label="$t('vault.edit')"
            @click="editingCommitDebounce = true"
          />
        </div>
      </template>
      <template v-else>
        <UInput
          v-model="commitDebounceSec"
          type="number"
          :min="1"
          :step="0.5"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="link"
          :label="$t('vault.resetToConfigDefault')"
          @click="resetDebounce"
        />
      </template>
    </UFormField>
  </section>
</template>
