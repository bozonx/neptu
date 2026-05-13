<script setup lang="ts">
const emit = defineEmits<{
  (e: 'reset'): void
}>()

defineProps<{
  hasOverride: boolean
}>()

const excludes = defineModel<string[]>('excludes', { required: true })
const editing = defineModel<boolean>('editing', { required: true })
const newExclude = defineModel<string>('newExclude', { required: true })

function addExclude() {
  const raw = newExclude.value.trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
  if (!raw) return
  if (!excludes.value.includes(raw)) {
    excludes.value.push(raw)
  }
  newExclude.value = ''
}

function removeExclude(idx: number) {
  excludes.value.splice(idx, 1)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ $t('vault.excludes') }}
      </h4>
      <UButton
        v-if="!editing"
        size="xs"
        color="neutral"
        variant="ghost"
        :label="$t('vault.edit')"
        @click="editing = true"
      />
    </div>
    <template v-if="!editing">
      <p
        v-if="excludes.length === 0"
        class="text-sm text-muted"
      >
        {{ $t('vault.noExcludes') }}
      </p>
      <div
        v-else
        class="space-y-1"
      >
        <div
          v-for="item in excludes"
          :key="item"
          class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded"
        >
          {{ item }}
        </div>
      </div>
      <div class="text-xs text-muted mt-1">
        {{ hasOverride ? $t('vault.customValue') : $t('vault.fromVaultFile') }}
      </div>
    </template>
    <template v-else>
      <p class="text-xs text-muted">
        {{ $t('vault.excludesHint') }}
      </p>
      <div class="flex items-center gap-2">
        <UInput
          v-model="newExclude"
          :placeholder="$t('vault.excludePlaceholder')"
          class="flex-1"
          @keydown.enter="addExclude"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          @click="addExclude"
        />
      </div>
      <div
        v-if="excludes.length > 0"
        class="space-y-1"
      >
        <div
          v-for="(item, idx) in excludes"
          :key="idx"
          class="flex items-center justify-between rounded-md bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-sm"
        >
          <span class="font-mono text-xs">{{ item }}</span>
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="removeExclude(idx)"
          />
        </div>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="link"
        :label="$t('vault.resetToFileDefaults')"
        @click="emit('reset')"
      />
    </template>
  </div>
</template>
