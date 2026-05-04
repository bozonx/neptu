<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { isImageFileName } from '~/composables/useImageConvert'

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
const backgroundColor = ref('#ffffff')
const isConverting = ref(false)
const previewUrl = ref('')

const qualitySupported = computed(() => format.value !== 'png')

watch(() => props.filePath, (path) => {
  if (path) {
    previewUrl.value = convertFileSrc(path)
  }
  else {
    previewUrl.value = ''
  }
}, { immediate: true })

const formatItems = [
  { label: 'WebP', value: 'webp' as const },
  { label: 'PNG', value: 'png' as const },
  { label: 'JPEG', value: 'jpeg' as const },
]

async function submitConvert() {
  if (!props.filePath || !isImageFileName(props.filePath)) return

  isConverting.value = true
  try {
    const vault = vaults.findVaultForPath(props.filePath)
    if (!vault) throw new Error('Vault not found')

    const finalPath = await vaults.convertImageFile(vault.id, props.filePath, {
      format: format.value,
      quality: qualitySupported.value ? quality.value : undefined,
      maxDimension: maxDimension.value || undefined,
      backgroundColor: preserveTransparency.value && format.value !== 'jpeg' ? undefined : backgroundColor.value,
      preserveTransparency: preserveTransparency.value,
    })

    toast.add({
      title: t('toast.convertSuccess', 'Image converted'),
      description: finalPath.split(/[\\/]/).pop(),
      color: 'success',
    })

    emit('convert', finalPath)
    open.value = false
  }
  catch (error) {
    toast.add({
      title: t('toast.convertFailed', 'Conversion failed'),
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
            alt="Preview"
          />
        </div>

        <UFormField :label="$t('convertImage.format', 'Format')">
          <URadioGroup
            v-model="format"
            :items="formatItems"
          />
        </UFormField>

        <UFormField
          v-if="qualitySupported"
          :label="$t('convertImage.quality', 'Quality')"
        >
          <div class="flex items-center gap-3">
            <USlider
              v-model="quality"
              :min="0.1"
              :max="1"
              :step="0.05"
              class="flex-1"
            />
            <span class="text-sm text-muted w-12 text-right">{{ Math.round(quality * 100) }}%</span>
          </div>
        </UFormField>

        <UFormField :label="$t('convertImage.maxDimension', 'Max dimension (px)')">
          <UInput
            v-model="maxDimension"
            type="number"
            :min="1"
            :placeholder="$t('convertImage.maxDimensionPlaceholder', 'Original size')"
          />
        </UFormField>

        <UCheckbox
          v-model="preserveTransparency"
          :label="$t('convertImage.preserveTransparency', 'Preserve transparency')"
        />

        <UFormField
          v-if="!preserveTransparency || format === 'jpeg'"
          :label="$t('convertImage.backgroundColor', 'Background color')"
        >
          <UInput
            v-model="backgroundColor"
            type="text"
            placeholder="#ffffff"
          />
        </UFormField>
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
