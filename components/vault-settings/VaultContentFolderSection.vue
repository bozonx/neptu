<script setup lang="ts">
defineProps<{
  effectiveContentFolder: string
  hasOverride: boolean
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const contentFolder = defineModel<string>('contentFolder', { required: true })
const editing = defineModel<boolean>('editing', { required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ $t('vault.contentFolder') }}
      </h4>
      <UButton
        v-if="!editing"
        size="xs"
        color="neutral"
        variant="ghost"
        :label="$t('vault.edit')"
        @click="editing = true"
      />
    </div>
    <template v-if="!editing">
      <div class="text-sm flex items-center gap-2">
        <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
          {{ effectiveContentFolder || $t('vault.contentFolderRoot') }}
        </span>
        <span class="text-xs text-muted">
          {{ hasOverride ? $t('vault.customValue') : $t('vault.fromVaultFile') }}
        </span>
      </div>
    </template>
    <template v-else>
      <UFormField :hint="$t('vault.contentFolderHint')">
        <UInput
          v-model="contentFolder"
          :placeholder="$t('vault.contentFolderPlaceholder')"
        />
      </UFormField>
      <UButton
        size="xs"
        color="neutral"
        variant="link"
        :label="$t('vault.resetToFileDefaults')"
        @click="emit('reset')"
      />
    </template>
  </div>
</template>
