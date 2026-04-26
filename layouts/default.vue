<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
</script>

<template>
  <UDashboardGroup class="h-screen">
    <UDashboardSidebar
      v-slot="{ collapsed }"
      collapsible
      resizable
      :ui="{ root: 'min-w-72' }"
    >
      <AppSidebar :collapsed="collapsed" />
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
