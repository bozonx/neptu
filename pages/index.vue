<script setup lang="ts">
import Editor from '~/components/Editor.vue'
import FirstRunDialog from '~/components/FirstRunDialog.vue'

const settings = useSettingsStore()
const { isTauri } = useTauri()

const ready = ref(false)
const initError = ref<string | null>(null)

onMounted(async () => {
  if (!isTauri.value) {
    ready.value = true
    return
  }
  try {
    await settings.init()
  }
  catch (error) {
    initError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    ready.value = true
  }
})
</script>

<template>
  <div class="contents">
    <Editor />

    <FirstRunDialog v-if="ready && settings.needsMainRepo" />

    <UModal
      v-if="!isTauri && ready"
      :open="true"
      :dismissible="false"
      title="Tauri runtime required"
      description="Neptu needs the Tauri runtime to access the filesystem. Run `pnpm tauri:dev` instead of `pnpm dev`."
    />

    <UModal
      v-if="initError"
      :open="true"
      title="Initialization error"
      :description="initError"
    />
  </div>
</template>
