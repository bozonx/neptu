<script setup lang="ts">
const settings = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

const open = ref(true)
const loading = ref(false)

async function chooseMainRepo() {
  loading.value = true
  try {
    const fs = useFs()
    const path = await fs.pickDirectory({ title: 'Select main repository folder' })
    if (!path) return
    await settings.setMainRepo(path)
    open.value = false
  }
  catch (error) {
    toast.add({
      title: t('toast.setMainRepoFailed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="false"
    :title="$t('welcome.title')"
    :description="$t('welcome.description')"
  >
    <template #body>
      <div class="space-y-3 text-sm">
        <p>
          {{ $t('welcome.info1') }}
          {{ $t('welcome.info2') }}
        </p>
        <p class="text-muted">
          {{ $t('welcome.info3') }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          icon="i-lucide-folder-open"
          :label="$t('welcome.chooseFolder')"
          :loading="loading"
          @click="chooseMainRepo"
        />
      </div>
    </template>
  </UModal>
</template>
