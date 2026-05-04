<script setup lang="ts">
import type { ConflictChoice } from '~/stores/vaults'

const props = defineProps<{
  open: boolean
  fileName: string
  showRememberOption?: boolean
}>()

const emit = defineEmits<{
  resolve: [value: { choice: ConflictChoice, remember: boolean }]
  cancel: []
}>()

const remember = ref(false)

watch(() => props.open, (next) => {
  if (next) remember.value = false
})

function pick(choice: ConflictChoice) {
  emit('resolve', { choice, remember: remember.value })
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="$t('editor.overwrite.title')"
    :description="$t('editor.overwrite.description', { name: props.fileName })"
    :dismissible="true"
    @update:open="(value) => { if (!value) emit('cancel') }"
  >
    <template #body>
      <div
        v-if="props.showRememberOption"
        class="pb-2"
      >
        <UCheckbox
          v-model="remember"
          :label="$t('editor.overwrite.rememberChoice')"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('editor.overwrite.skip')"
          @click="pick('skip')"
        />
        <UButton
          color="warning"
          variant="soft"
          :label="$t('editor.overwrite.overwrite')"
          @click="pick('overwrite')"
        />
        <UButton
          color="primary"
          :label="$t('editor.overwrite.rename')"
          @click="pick('rename')"
        />
      </div>
    </template>
  </UModal>
</template>
