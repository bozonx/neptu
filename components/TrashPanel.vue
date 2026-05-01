<script setup lang="ts">
import type { FileNode, Vault } from '~/types'

const fs = useFs()
const toast = useToast()
const { t } = useI18n()

const vaults = useVaultsStore()
const settings = useSettingsStore()

interface TrashVault {
  vault: Vault
  nodes: FileNode[]
  expanded: boolean
}

const trashVaults = ref<TrashVault[]>([])
const loading = ref(false)

const localVaults = computed(() => vaults.list.filter((v) => v.type === 'local'))

async function loadTrash() {
  loading.value = true
  const result: TrashVault[] = []
  for (const vault of localVaults.value) {
    const trashPath = await fs.join(vault.path, '.trash')
    if (await fs.exists(trashPath)) {
      try {
        const nodes = await fs.scanDir(trashPath)
        if (nodes.length > 0) {
          result.push({ vault, nodes, expanded: true })
        }
      }
      catch {
        // ignore
      }
    }
  }
  trashVaults.value = result
  loading.value = false
}

onMounted(loadTrash)
watch(() => settings.settings.useTrash, loadTrash)
watch(() => vaults.list, loadTrash, { deep: true })

async function permanentlyDelete(node: FileNode, _vault: Vault) {
  if (!confirm(t('confirm.deleteFile', { name: node.name }))) return
  try {
    await fs.deleteFile(node.path)
    await loadTrash()
  }
  catch (error) {
    toast.add({
      title: t('toast.deleteFailed'),
      description: String(error),
      color: 'error',
    })
  }
}

async function restore(node: FileNode, vault: Vault) {
  const trashPrefix = await fs.join(vault.path, '.trash')
  const normalizedTrash = trashPrefix.replace(/[/\\]+$/, '')
  const relativePath = node.path.startsWith(normalizedTrash + '/') || node.path.startsWith(normalizedTrash + '\\')
    ? node.path.slice(normalizedTrash.length + 1)
    : node.path

  const destPath = await fs.join(vault.path, relativePath)

  // Ensure destination directory exists
  const destDir = destPath.substring(0, destPath.lastIndexOf(node.name) - 1)
  await fs.ensureDir(destDir)

  // If destination exists, append timestamp
  let finalDest = destPath
  if (await fs.exists(destPath)) {
    const name = node.name
    const lastDot = name.lastIndexOf('.')
    const baseName = lastDot > 0 ? name.slice(0, lastDot) : name
    const ext = lastDot > 0 ? name.slice(lastDot) : ''
    const timestamp = Date.now()
    const newName = `${baseName}-${timestamp}${ext}`
    finalDest = await fs.join(destDir, newName)
  }

  try {
    await fs.moveFile(node.path, finalDest)
    await loadTrash()
    await vaults.refreshTree(vault)
  }
  catch (error) {
    toast.add({
      title: t('toast.moveFailed'),
      description: String(error),
      color: 'error',
    })
  }
}

function openFile(path: string) {
  useTabsStore().openFile(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFileFailed'), description: String(error), color: 'error' })
  })
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="px-3 py-2 border-b border-default flex items-center justify-between">
      <span class="text-sm font-medium">{{ $t('sidebar.trash') }}</span>
      <UButton
        icon="i-lucide-refresh-cw"
        size="xs"
        color="neutral"
        variant="ghost"
        :loading="loading"
        @click="loadTrash"
      />
    </div>

    <div
      v-if="loading"
      class="flex-1 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-muted"
      />
    </div>
    <div
      v-else-if="trashVaults.length === 0"
      class="flex-1 flex items-center justify-center text-sm text-muted px-4 text-center"
    >
      {{ $t('sidebar.noTrash') }}
    </div>
    <div
      v-else
      class="flex-1 overflow-y-auto py-1"
    >
      <div
        v-for="tv in trashVaults"
        :key="tv.vault.id"
        class="mb-2"
      >
        <div
          class="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-elevated/50"
          @click="tv.expanded = !tv.expanded"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 text-muted transition-transform"
            :class="{ 'rotate-90': tv.expanded }"
          />
          <UIcon
            name="i-lucide-folder"
            class="size-4 text-muted"
          />
          <span class="text-sm font-medium truncate">{{ tv.vault.name }}</span>
        </div>
        <TrashTree
          v-if="tv.expanded"
          :nodes="tv.nodes"
          :vault="tv.vault"
          @open="openFile"
          @restore="(n: FileNode) => restore(n, tv.vault)"
          @delete="(n: FileNode) => permanentlyDelete(n, tv.vault)"
        />
      </div>
    </div>
  </div>
</template>
