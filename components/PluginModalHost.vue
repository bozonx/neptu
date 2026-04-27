<script setup lang="ts">
const plugins = usePluginsStore()

function onOpenChange(fqid: string, value: boolean) {
  if (!value) plugins.closeModal(fqid)
}
</script>

<template>
  <UModal
    v-for="modal in plugins.modals"
    :key="modal.fqid"
    :open="true"
    @update:open="(value: boolean) => onOpenChange(modal.fqid, value)"
  >
    <template #body>
      <component
        :is="modal.component"
        v-bind="modal.props ?? {}"
        @close="plugins.closeModal(modal.fqid)"
      />
    </template>
  </UModal>
</template>
