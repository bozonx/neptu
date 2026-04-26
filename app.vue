<script setup lang="ts">
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

const settings = useSettingsStore()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('lg')

useHead({
  title: 'Neptu',
  htmlAttrs: { lang: 'en' },
})

const layoutName = computed(() => {
  const mode = settings.settings.layoutMode
  if (mode === 'desktop') return 'desktop'
  if (mode === 'mobile') return 'mobile'
  
  // 'auto' mode
  return isDesktop.value ? 'desktop' : 'mobile'
})
</script>

<template>
  <UApp class="h-full">
    <NuxtLayout :name="layoutName" class="h-full">
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
