<script setup lang="ts">
import type { SidebarButtonLocation } from '~/types/plugin'

const props = defineProps<{
  location: SidebarButtonLocation
  size?: 'xs' | 'sm' | 'md'
}>()

const plugins = usePluginsStore()
const buttons = plugins.buttonsFor(props.location)

function isVisible(fn?: () => boolean) {
  return fn ? fn() !== false : true
}

function isActive(fn?: () => boolean) {
  return fn ? fn() === true : false
}
</script>

<template>
  <template
    v-for="button in buttons"
    :key="button.fqid"
  >
    <UButton
      v-if="isVisible(button.visible)"
      :icon="button.icon"
      :label="button.label"
      :size="props.size ?? 'xs'"
      :color="isActive(button.active) ? 'primary' : 'neutral'"
      :variant="isActive(button.active) ? 'subtle' : 'ghost'"
      :title="button.title ?? button.label"
      @click="button.onClick"
    />
  </template>
</template>
