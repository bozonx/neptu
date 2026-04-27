<script setup lang="ts">
const editor = useEditorStore()
const vaults = useVaultsStore()
const { locale } = useI18n()
const fs = useFs()

const fileName = computed(() => {
  if (!editor.currentFilePath) return null
  const parts = editor.currentFilePath.split(/[\\/]/)
  return parts[parts.length - 1]
})

const vaultName = computed(() => {
  if (!editor.currentFilePath) return null
  return vaults.findVaultForPath(editor.currentFilePath)?.name
})

const fileStat = ref<{ mtime: number | null, birthtime: number | null }>({ mtime: null, birthtime: null })

watch(() => editor.currentFilePath, async (path) => {
  if (!path) {
    fileStat.value = { mtime: null, birthtime: null }
    return
  }
  try {
    const info = await fs.stat(path)
    fileStat.value = {
      mtime: info.mtime ? info.mtime.getTime() : null,
      birthtime: info.birthtime ? info.birthtime.getTime() : null,
    }
  }
  catch {
    fileStat.value = { mtime: null, birthtime: null }
  }
}, { immediate: true })

function fmtDate(ts: number | null): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString(locale.value)
}
</script>

<template>
  <section>
    <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
      {{ $t('sidebar.fileInfo') }}
    </h3>
    <div class="space-y-3">
      <div>
        <div class="text-[10px] text-muted uppercase">
          {{ $t('sidebar.name') }}
        </div>
        <div
          class="text-sm font-medium truncate"
          :title="fileName ?? ''"
        >
          {{ fileName }}
        </div>
      </div>
      <div>
        <div class="text-[10px] text-muted uppercase">
          {{ $t('sidebar.vault') }}
        </div>
        <div class="text-sm truncate">
          {{ vaultName }}
        </div>
      </div>
      <div>
        <div class="text-[10px] text-muted uppercase">
          {{ $t('sidebar.path') }}
        </div>
        <div class="text-[11px] text-muted break-all leading-relaxed">
          {{ editor.currentFilePath }}
        </div>
      </div>
      <div>
        <div class="text-[10px] text-muted uppercase">
          {{ $t('sidebar.modified') }}
        </div>
        <div class="text-sm">
          {{ fmtDate(fileStat.mtime) }}
        </div>
      </div>
      <div>
        <div class="text-[10px] text-muted uppercase">
          {{ $t('sidebar.created') }}
        </div>
        <div class="text-sm">
          {{ fmtDate(fileStat.birthtime) }}
        </div>
      </div>
    </div>
  </section>
</template>
