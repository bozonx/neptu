<script setup lang="ts">
import type { Vault } from '~/types'

const props = defineProps<{
  vault: Vault | null
  mainRepoPath: string | null
}>()

const emit = defineEmits<{
  (e: 'browse'): void
}>()

const name = defineModel<string>('name', { required: true })
const path = defineModel<string | null>('path', { required: true })
const showNameInput = defineModel<boolean>('showNameInput', { required: true })

const isMainRepo = computed(() => props.vault?.path === props.mainRepoPath)

function clearName() {
  showNameInput.value = false
  name.value = props.vault?.name ?? ''
}
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
      {{ $t('vault.name') }}
    </h3>
    <UFormField :label="$t('vault.folder')">
      <div class="flex items-center gap-2">
        <UInput
          :model-value="path ?? ''"
          readonly
          :placeholder="$t('vault.noFolderSelected')"
          class="flex-1"
          :disabled="isMainRepo"
        />
        <UButton
          icon="i-lucide-folder-search"
          :label="$t('vault.browse')"
          :disabled="isMainRepo"
          @click="emit('browse')"
        />
      </div>
    </UFormField>

    <div class="flex items-center gap-2">
      <UButton
        v-if="!showNameInput"
        size="xs"
        color="neutral"
        variant="link"
        :label="$t('vault.setVisibleName')"
        @click="showNameInput = true"
      />
    </div>

    <UFormField
      v-if="showNameInput"
      :label="$t('vault.name')"
    >
      <ClearableInput
        v-model="name"
        :placeholder="vault?.name ?? $t('vault.vaultNamePlaceholder')"
        @clear="clearName"
      />
    </UFormField>
  </section>
</template>
