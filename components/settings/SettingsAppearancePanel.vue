<script setup lang="ts">
import type { AppSettings } from '~/types'

defineEmits<{
  toggleLayoutMode: []
}>()

const layoutMode = defineModel<AppSettings['layoutMode']>('layoutMode', { required: true })
const theme = defineModel<AppSettings['theme']>('theme', { required: true })
const tabDisplayMode = defineModel<AppSettings['tabDisplayMode']>('tabDisplayMode', { required: true })
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.appearance') }}
      </h3>
      <UFormField :label="$t('settings.theme')">
        <URadioGroup
          v-model="theme"
          orientation="horizontal"
          :items="[
            { label: $t('settings.system'), value: 'system' },
            { label: $t('settings.light'), value: 'light' },
            { label: $t('settings.dark'), value: 'dark' },
          ]"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.themeHint') }}
        </p>
      </UFormField>

      <UFormField :label="$t('settings.layoutMode')">
        <UButton
          size="sm"
          :label="layoutMode === 'desktop' ? $t('settings.switchToMobile') : $t('settings.switchToDesktop')"
          @click="$emit('toggleLayoutMode')"
        />
      </UFormField>

      <UFormField :label="$t('settings.tabDisplayMode')">
        <URadioGroup
          v-model="tabDisplayMode"
          orientation="horizontal"
          :items="[
            { label: $t('settings.tabDisplaySingleLine'), value: 'single_line' },
            { label: $t('settings.tabDisplayMultiLine'), value: 'multi_line' },
            { label: $t('settings.tabDisplayLeftVertical'), value: 'left_vertical' },
          ]"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.tabDisplayModeHint') }}
        </p>
      </UFormField>
    </section>
  </div>
</template>
