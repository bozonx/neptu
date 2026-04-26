<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
</script>

<template>
  <UDashboardGroup class="h-screen">
    <UDashboardSidebar
      resizable
      :ui="{ root: 'min-w-72' }"
    >
      <AppSidebar />
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
