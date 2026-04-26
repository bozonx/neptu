<script setup lang="ts">
const vaults = useVaultsStore()
const toast = useToast()

const open = ref(true)
const loading = ref(false)

async function chooseMainRepo() {
  loading.value = true
  try {
    const fs = useFs()
    const path = await fs.pickDirectory({ title: 'Select main repository folder' })
    if (!path) return
    await vaults.setMainRepo(path)
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
    description="Choose a main repository — a folder where your notes and the synced settings (.neptu) will live."
  >
    <template #body>
      <div class="space-y-3 text-sm">
        <p>
          The main repository is just a regular folder on your computer.
          A hidden <code>.neptu</code> directory will be created inside to store
          your vaults list and preferences.
        </p>
        <p class="text-muted">
          You can sync this folder with any tool you like (Git, Syncthing, iCloud, Dropbox)
          to share settings between devices.
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
