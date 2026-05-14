<script setup lang="ts">
import { isConvertibleImageFileName } from '~/composables/useImageConvert'

interface Props {
  filePath: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  convert: [newPath: string]
}>()

const { t } = useI18n()
const toast = useToast()
const vaults = useVaultsStore()

const format = ref<'webp' | 'png' | 'jpeg'>('webp')
const quality = ref(0.85)
const maxDimension = ref<number | undefined>(undefined)
const preserveTransparency = ref(true)
const preserveExif = ref(false)
const backgroundColor = ref('#ffffff')
const isConverting = ref(false)
const previewUrl = ref('')

watch(() => props.filePath, (path) => {
  if (path) {
    previewUrl.value = convertLocalFileSrc(path)
  }
  else {
    previewUrl.value = ''
  }
}, { immediate: true })

async function submitConvert() {
  if (!props.filePath || !isConvertibleImageFileName(props.filePath)) return

  isConverting.value = true
  try {
    const vault = vaults.findVaultForPath(props.filePath)
    if (!vault) throw new Error('Vault not found')

    const finalPath = await vaults.convertImageFile(vault.id, props.filePath, {
      format: format.value,
      quality: format.value !== 'png' ? quality.value : undefined,
      maxDimension: maxDimension.value || undefined,
      backgroundColor: preserveTransparency.value && format.value !== 'jpeg' ? undefined : backgroundColor.value,
      preserveTransparency: preserveTransparency.value,
      preserveExif: format.value !== 'png' && preserveExif.value,
    })

    toast.add({
      title: t('toast.convertSuccess'),
      description: finalPath.split(/[\\/]/).pop(),
      color: 'success',
    })

    emit('convert', finalPath)
    open.value = false
  }
  catch (error) {
    toast.add({
      title: t('toast.convertFailed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
  finally {
    isConverting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="$t('convertImage.title', 'Convert Image')"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex justify-center bg-elevated/30 rounded-md p-4">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            class="max-h-48 max-w-full object-contain rounded shadow-sm"
            :alt="$t('convertImage.previewAlt')"
          />
        </div>

        <ImageConvertOptionsForm
          v-model:format="format"
          v-model:quality="quality"
          v-model:max-dimension="maxDimension"
          v-model:preserve-transparency="preserveTransparency"
          v-model:preserve-exif="preserveExif"
          v-model:background-color="backgroundColor"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('vault.cancel')"
          @click="open = false"
        />
        <UButton
          :label="$t('convertImage.convert', 'Convert')"
          :loading="isConverting"
          @click="submitConvert"
        />
      </div>
    </template>
  </UModal>
</template>
