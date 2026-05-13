<script setup lang="ts">
const {
  builtinPlugins,
  isPluginEnabled,
  togglePlugin,
} = useSettingsPlugins()

const { t } = useI18n()

const pluginI18n: Record<string, { name: string, description: string }> = {
  'com.neptu.backlinks': { name: 'plugins.backlinksName', description: 'plugins.backlinksDescription' },
  'com.neptu.file-info': { name: 'plugins.fileInfoName', description: 'plugins.fileInfoDescription' },
  'com.neptu.history': { name: 'plugins.historyName', description: 'plugins.historyDescription' },
  'com.neptu.outline': { name: 'plugins.outlineName', description: 'plugins.outlineDescription' },
  'com.neptu.content-types': { name: 'plugins.contentTypesName', description: 'plugins.contentTypesDescription' },
}
</script>

<template>
  <div class="space-y-6">
    <section>
      <h3 class="text-sm font-bold text-muted uppercase tracking-wider mb-4">
        {{ $t('settings.systemPlugins') }}
      </h3>
      <div class="space-y-3">
        <div
          v-for="plugin in builtinPlugins"
          :key="plugin.manifest.id"
          class="flex items-center justify-between p-3 rounded-lg border border-default bg-elevated/30"
        >
          <div>
            <div class="font-medium text-sm">
              {{ t(pluginI18n[plugin.manifest.id]?.name || plugin.manifest.name || '') }}
            </div>
            <div class="text-xs text-muted">
              {{ t(pluginI18n[plugin.manifest.id]?.description || plugin.manifest.description || '') }}
            </div>
          </div>
          <USwitch
            :model-value="isPluginEnabled(plugin.manifest.id)"
            @update:model-value="(value) => togglePlugin(plugin.manifest.id, value)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
