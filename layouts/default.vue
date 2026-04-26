<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <TopBar />
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <UDashboardSidebar
        resizable
        :ui="{ root: 'min-w-72' }"
      >
        <AppSidebar />
      </UDashboardSidebar>

      <div class="flex-1 min-h-0 overflow-hidden">
        <slot />
      </div>
    </div>
  </div>
</template>
