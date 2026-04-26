<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
</script>

<template>
  <div class="flex flex-col h-screen">
    <TopBar />
    <div class="flex flex-1 min-h-0">
      <UDashboardSidebar
        resizable
        :ui="{ root: 'min-w-72' }"
      >
        <AppSidebar />
      </UDashboardSidebar>

      <slot />
    </div>
  </div>
</template>
