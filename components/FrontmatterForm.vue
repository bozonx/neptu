<script setup lang="ts">
const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()
const collapsed = ref(true)

const buffer = computed(() => editorStore.buffers[props.filePath])
const schema = computed(() => buffer.value?.schema ?? null)
const frontmatter = computed(() => buffer.value?.frontmatter ?? {})

function updateField(key: string, value: unknown) {
  const fm = { ...frontmatter.value, [key]: value }
  editorStore.setFrontmatter(props.filePath, fm)
}
</script>

<template>
  <div
    v-if="schema && schema.fields.length"
    class="border-b border-default bg-elevated/30 shrink-0"
  >
    <UButton
      variant="ghost"
      size="xs"
      color="neutral"
      class="w-full justify-between px-3 py-2 h-auto"
      @click="collapsed = !collapsed"
    >
      <span class="text-xs font-medium">Frontmatter</span>
      <UIcon
        :name="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
        class="size-4"
      />
    </UButton>

    <div
      v-show="!collapsed"
      class="px-3 pb-3 space-y-3"
    >
      <FrontmatterField
        v-for="field in schema.fields"
        :key="field.key"
        :field="field"
        :model-value="frontmatter[field.key]"
        @update:model-value="(v: unknown) => updateField(field.key, v)"
      />
    </div>
  </div>
</template>
