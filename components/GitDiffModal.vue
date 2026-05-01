<script setup lang="ts">
const props = defineProps<{
  vaultId?: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const vaultsStore = useVaultsStore()
const { diff } = useGit()

const diffText = ref('')
const loading = ref(false)

watch(isOpen, async (val) => {
  if (val && props.vaultId) {
    loading.value = true
    diffText.value = ''
    try {
      const vault = vaultsStore.findById(props.vaultId)
      if (vault) {
        diffText.value = await diff(vault.path)
      }
    }
    catch (e) {
      console.error(e)
      diffText.value = 'Failed to load diff.'
    }
    finally {
      loading.value = false
    }
  }
  else {
    diffText.value = ''
  }
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('git.uncommittedChanges')"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div
        v-if="loading"
        class="flex justify-center p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
      </div>
      <div
        v-else-if="!diffText"
        class="p-8 text-center text-muted"
      >
        {{ $t('git.noChanges') }}
      </div>
      <GitDiffViewer
        v-else
        :diff="diffText"
        class="max-h-[60vh] overflow-y-auto"
      />
    </template>
  </UModal>
</template>
