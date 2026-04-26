<script setup lang="ts">
useHead({
  title: 'Neptu',
  htmlAttrs: { lang: 'en' },
})
</script>

<template>
  <UApp class="h-full">
    <NuxtLayout class="h-full">
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
