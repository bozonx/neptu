<script setup lang="ts">
const settings = useSettingsStore()
const toast = useToast()

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
      title: 'Failed to set main repository',
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
    title="Welcome to Neptu"
    description="Choose a main repository — a folder where your notes will live."
  >
    <template #body>
      <div class="space-y-3 text-sm">
        <p>
          The main repository is just a regular folder on your computer.
          It will be added as your first vault.
        </p>
        <p class="text-muted">
          App settings are stored in the Tauri app config directory.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          icon="i-lucide-folder-open"
          label="Choose folder"
          :loading="loading"
          @click="chooseMainRepo"
        />
      </div>
    </template>
  </UModal>
</template>
