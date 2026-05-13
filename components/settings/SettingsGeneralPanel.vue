<script setup lang="ts">
import type { AppSettings } from '~/types'

defineProps<{
  mainRepoPath: string | null
  configPath: string
}>()

const emit = defineEmits<{
  browseMainFolder: []
  submitChangeMainRepo: []
  copyConfigPath: []
}>()

const locale = defineModel<AppSettings['locale']>('locale', { required: true })
const confirmDeleteLocal = defineModel<boolean>('confirmDeleteLocal', { required: true })
const confirmDeleteGit = defineModel<boolean>('confirmDeleteGit', { required: true })
const useTrash = defineModel<boolean>('useTrash', { required: true })
const autosaveSec = defineModel<number>('autosaveSec', { required: true })
const newMainPath = defineModel<string>('newMainPath', { required: true })
const dailyNotesPath = defineModel<string>('dailyNotesPath', { required: true })

const { t } = useI18n()

const localeItems = computed(() => [
  { label: t('settings.auto'), value: 'auto' },
  { label: 'English', value: 'en-US' },
  { label: 'Русский', value: 'ru-RU' },
])
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.interface') }}
      </h3>
      <UFormField :label="$t('settings.language')">
        <USelect
          v-model="locale"
          :items="localeItems"
          class="w-48"
        />
      </UFormField>
    </section>

    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.safety') }}
      </h3>
      <UFormField :hint="$t('settings.confirmDeleteHint')">
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2">
            <USwitch v-model="confirmDeleteLocal" />
            <span class="text-sm">{{ $t('settings.confirmDeleteLocal') }}</span>
          </label>
          <label class="flex items-center gap-2">
            <USwitch v-model="confirmDeleteGit" />
            <span class="text-sm">{{ $t('settings.confirmDeleteGit') }}</span>
          </label>
          <label class="flex items-center gap-2">
            <USwitch v-model="useTrash" />
            <span class="text-sm">{{ $t('settings.useTrash') }}</span>
          </label>
        </div>
      </UFormField>
    </section>

    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.editor') }}
      </h3>
      <UFormField :label="$t('settings.autosaveDebounce')">
        <UInput
          v-model="autosaveSec"
          type="number"
          :min="0.1"
          :step="0.1"
          class="w-32"
          :title="$t('settings.autosaveDebounceHint')"
        />
      </UFormField>
    </section>

    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.mainVault') }}
      </h3>
      <UFormField :label="$t('settings.currentFolder')">
        <div class="flex items-center gap-2">
          <UInput
            :model-value="newMainPath || mainRepoPath || ''"
            readonly
            class="flex-1 text-xs"
          />
          <UButton
            icon="i-lucide-folder-search"
            :label="$t('vault.browse')"
            size="sm"
            @click="emit('browseMainFolder')"
          />
          <UButton
            :label="$t('settings.change')"
            size="sm"
            :disabled="!newMainPath"
            @click="emit('submitChangeMainRepo')"
          />
        </div>
      </UFormField>
      <p class="text-xs text-muted mt-1">
        {{ $t('settings.currentFolderHint') }}
      </p>
    </section>

    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.dailyNotes') }}
      </h3>
      <UFormField :label="$t('settings.dailyNotesPath')">
        <UInput
          v-model="dailyNotesPath"
          class="w-full"
          :placeholder="t('settings.dailyNotesPathPlaceholder')"
        />
      </UFormField>
      <p class="text-xs text-muted mt-1">
        {{ $t('settings.dailyNotesPathHint') }}
      </p>
    </section>

    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.storage') }}
      </h3>
      <UFormField :label="$t('settings.configPath')">
        <div class="flex items-center gap-2">
          <UInput
            :model-value="configPath"
            readonly
            class="flex-1 text-xs"
          />
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            :disabled="!configPath"
            @click="emit('copyConfigPath')"
          />
        </div>
      </UFormField>
      <div class="text-xs text-muted space-y-1">
        <p>{{ $t('settings.storageInfo1') }}</p>
        <p>{{ $t('settings.storageInfo2') }}</p>
      </div>
    </section>
  </div>
</template>
