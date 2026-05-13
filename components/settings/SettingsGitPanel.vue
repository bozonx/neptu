<script setup lang="ts">
import type { AppSettings } from '~/types'

defineProps<{
  detectedHint: string
}>()

const defaultCommitMode = defineModel<AppSettings['defaultCommitMode']>('defaultCommitMode', { required: true })
const commitSec = defineModel<number>('commitSec', { required: true })
const authorName = defineModel<string>('authorName', { required: true })
const authorEmail = defineModel<string>('authorEmail', { required: true })
const gitAutoMessage = defineModel<boolean>('gitAutoMessage', { required: true })
const gitAutoMessageTemplate = defineModel<string>('gitAutoMessageTemplate', { required: true })

const { t } = useI18n()
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-4">
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
        {{ $t('settings.git') }}
      </h3>
      <UFormField :label="$t('settings.defaultCommitMode')">
        <ButtonGroupToggle
          v-model="defaultCommitMode"
          :items="[
            { label: $t('vault.autoCommit'), value: 'auto' },
            { label: $t('vault.manualCommit'), value: 'manual' },
          ]"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.defaultCommitModeHint') }}
        </p>
      </UFormField>

      <UFormField :label="$t('settings.defaultCommitDebounce')">
        <UInput
          v-model="commitSec"
          type="number"
          :min="1"
          :step="0.5"
          class="w-32"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.defaultCommitDebounceHint') }}
        </p>
      </UFormField>

      <UFormField :label="$t('settings.authorName')">
        <UInput
          v-model="authorName"
          :placeholder="$t('settings.authorHint')"
          class="w-full"
        />
        <p class="text-xs text-muted mt-1">
          {{ detectedHint }}
        </p>
      </UFormField>

      <UFormField :label="$t('settings.authorEmail')">
        <UInput
          v-model="authorEmail"
          type="email"
          :placeholder="$t('settings.authorHint')"
          class="w-full"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.authorHint') }}
        </p>
      </UFormField>

      <UFormField :label="$t('settings.gitAutoMessage')">
        <USwitch v-model="gitAutoMessage" />
        <p class="text-xs text-muted mt-1">
          {{ $t('settings.gitAutoMessageHint') }}
        </p>
      </UFormField>

      <UFormField :label="$t('git.gitAutoMessageTemplate')">
        <UInput
          v-model="gitAutoMessageTemplate"
          :placeholder="t('settings.gitAutoMessageTemplatePlaceholder')"
          class="w-full"
        />
        <p class="text-xs text-muted mt-1">
          {{ $t('git.gitAutoMessageTemplateHint') }}
        </p>
      </UFormField>
    </section>
  </div>
</template>
