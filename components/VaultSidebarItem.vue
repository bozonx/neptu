<script setup lang="ts">
import type { FileFilterSettings, FileNode, Vault } from '~/types'
import type { DropdownMenuItem } from '@nuxt/ui'

interface Props {
  vault: Vault
  expanded: boolean
  nodes: FileNode[]
  activePath: string | null
  filters?: FileFilterSettings
  expandedFolders?: Record<string, boolean>
  allowVaultDrag?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  toggleFolder: [path: string]
  createNote: [vault: Vault, dir?: string]
  createFolder: [vault: Vault, dir?: string]
  editVault: [vault: Vault]
  removeVault: [vault: Vault]
}>()

const settings = useSettingsStore()
const editor = useEditorStore()
const git = useGitStore()
const tabs = useTabsStore()
const vaults = useVaultsStore()
const dnd = useDnd()
const toast = useToast()
const { t } = useI18n()

const isDropTarget = ref(false)

function onDragOver(event: DragEvent) {
  if (!dnd.draggedPath.value) return
  // Don't allow dropping into the same vault root if it's already there
  // but moveNode already handles this check.
  // We should also check if we are not dropping a parent into its own child root (which is impossible anyway)

  event.preventDefault()
  dnd.updateCopyMode(event)
  dnd.handleAutoScroll(event)
  isDropTarget.value = true
}

function onDragLeave() {
  isDropTarget.value = false
}

async function onDrop(event: DragEvent) {
  if (!dnd.draggedPath.value) return
  isDropTarget.value = false

  const sourcePath = dnd.draggedPath.value
  const targetDir = props.vault.path

  try {
    if (event.shiftKey) {
      await vaults.copyNode(sourcePath, targetDir)
    }
    else {
      await vaults.moveNode(sourcePath, targetDir)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.moveFailed', 'Move failed'), description: String(error), color: 'error' })
  }
}

function onVaultDragStart(event: DragEvent) {
  if (!props.allowVaultDrag) return
  dnd.onVaultDragStart(event, props.vault.id)
}

function onVaultDragEnd() {
  dnd.onDragEnd()
}

function vaultMenuItems(): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = []
  const top: DropdownMenuItem[] = [
    { label: t('vault.newFolderBtn'), icon: 'i-lucide-folder-plus', onSelect: () => emit('createFolder', props.vault) },
    { label: t('vault.editVault'), icon: 'i-lucide-pencil', onSelect: () => emit('editVault', props.vault) },
  ]
  if (props.vault.path !== settings.mainRepoPath) {
    top.push({
      label: t('vault.removeFromApp'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => emit('removeVault', props.vault),
    })
  }
  if (top.length) groups.push(top)
  if (props.vault.type === 'git') {
    groups.push([
      { label: t('vault.pull'), icon: 'i-lucide-git-pull-request', onSelect: () => handlePull() },
      { label: t('vault.push'), icon: 'i-lucide-git-pull-request-arrow', onSelect: () => handlePush() },
    ])
  }
  return groups
}

async function handleSync() {
  if (props.vault.type !== 'git') return
  try {
    await git.commit(props.vault.id)
  }
  catch (error) {
    toast.add({ title: t('toast.syncFailed'), description: String(error), color: 'error' })
    return
  }
  try {
    await useGit().pull(props.vault.path)
  }
  catch (error) {
    toast.add({ title: t('toast.commitPullFailed'), description: String(error), color: 'error' })
    await git.refreshStatus(props.vault.id)
    return
  }
  try {
    await useGit().push(props.vault.path)
    toast.add({ title: t('toast.syncCompleted'), color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('toast.commitPushFailed'), description: String(error), color: 'error' })
  }
  await git.refreshStatus(props.vault.id)
}

async function handlePull() {
  if (props.vault.type !== 'git') return
  try {
    const output = await useGit().pull(props.vault.path)
    toast.add({ title: t('toast.pullCompleted'), description: output || undefined, color: 'success' })
    await git.refreshStatus(props.vault.id)
  }
  catch (error) {
    toast.add({ title: t('toast.pullFailed'), description: String(error), color: 'error' })
  }
}

async function handlePush() {
  if (props.vault.type !== 'git') return
  try {
    const output = await useGit().push(props.vault.path)
    toast.add({ title: t('toast.pushCompleted'), description: output || undefined, color: 'success' })
    await git.refreshStatus(props.vault.id)
  }
  catch (error) {
    toast.add({ title: t('toast.pushFailed'), description: String(error), color: 'error' })
  }
}

const showCommit = computed(() => {
  if (props.vault.type !== 'git' || !props.vault.git) return false
  const dirty = git.status[props.vault.id]?.dirty ?? false
  const pending = git.pendingCommits[props.vault.id] ?? false
  if (props.vault.git.commitMode === 'manual') return dirty
  return pending
})

const committing = computed(() => git.commitStatus[props.vault.id] === 'committing')

async function handleVaultCommit() {
  if (props.vault.type !== 'git') return
  git.cancelCommit(props.vault.id)
  const isManual = props.vault.git?.commitMode === 'manual'
  const useAuto = settings.settings.gitAutoMessage ?? true
  let message: string | undefined
  if (isManual && !useAuto) {
    const input = prompt(t('git.commitMessagePrompt'))
    if (input === null) return
    message = input.trim() || undefined
  }
  try {
    await git.commit(props.vault.id, message)
    toast.add({ title: t('toast.commitCompleted'), color: 'success' })
    await git.refreshStatus(props.vault.id)
  }
  catch (error) {
    toast.add({ title: t('toast.commitFailed'), description: String(error), color: 'error' })
  }
}

function openFile(path: string) {
  tabs.openFile(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFileFailed'), description: String(error), color: 'error' })
  })
}

function openFileInNewPanel(path: string) {
  tabs.openFileInNewPanel(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFilePanelFailed'), description: String(error), color: 'error' })
  })
}

async function handleDelete(node: FileNode) {
  const needsConfirm = props.vault.type === 'git'
    ? settings.settings.confirmDeleteGit
    : settings.settings.confirmDeleteLocal
  if (needsConfirm && !confirm(t('confirm.deleteFile', { name: node.name }))) return
  try {
    await editor.deleteNote({ vault: props.vault, path: node.path })
  }
  catch (error) {
    toast.add({ title: t('toast.deleteFailed'), description: String(error), color: 'error' })
  }
}
</script>

<template>
  <div>
    <UContextMenu
      :items="vaultMenuItems()"
      :modal="false"
      class="w-full block"
    >
      <div
        class="group flex flex-col gap-1 px-2 py-1.5 rounded-md cursor-pointer bg-elevated transition-all"
        :class="[
          isDropTarget ? 'bg-primary/20 ring-2 ring-inset ring-primary/50' : 'hover:ring-1 hover:ring-inset hover:ring-border/50',
        ]"
        :draggable="allowVaultDrag"
        @click="emit('toggle')"
        @dragstart="onVaultDragStart"
        @dragend="onVaultDragEnd"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <div class="flex items-center gap-1 min-w-0">
          <UIcon
            :name="vault.path === settings.mainRepoPath ? 'i-lucide-folder-heart' : vault.type === 'git' ? 'i-lucide-git-branch' : 'i-lucide-folder'"
            class="size-4 shrink-0"
            :class="vault.path === settings.mainRepoPath ? 'text-primary' : 'text-muted'"
          />
          <span class="truncate text-sm font-medium">{{ vault.name }}</span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-muted shrink-0 transition-transform"
            :class="{ 'rotate-90': expanded }"
          />
        </div>

        <div class="flex items-center justify-between gap-1 min-w-0 h-6">
          <span class="text-xs text-muted capitalize">
            {{ vault.type }}{{ vault.contentType && vault.contentType !== 'vault' ? ` / ${$t(`vault.contentType${vault.contentType.charAt(0).toUpperCase() + vault.contentType.slice(1)}`)}` : '' }}{{ vault.path === settings.mainRepoPath ? ` - ${$t('vault.main')}` : '' }}
          </span>
          <div class="flex items-center gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            <UButton
              icon="i-lucide-file-plus"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="$t('vault.newNoteBtn')"
              @click.stop="emit('createNote', vault)"
            />
            <UButton
              v-if="vault.type === 'git'"
              icon="i-lucide-refresh-cw"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="$t('vault.sync')"
              @click.stop="handleSync()"
            />
            <UButton
              v-if="vault.type === 'git'"
              icon="i-lucide-git-commit"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="$t('git.commit')"
              :disabled="!showCommit"
              :loading="committing"
              @click.stop="handleVaultCommit()"
            />
            <UDropdownMenu
              :items="vaultMenuItems()"
              :modal="false"
              size="xs"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="$t('vault.more')"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>
    </UContextMenu>

    <VaultTree
      v-if="expanded"
      :vault="vault"
      :nodes="nodes"
      :active-path="activePath"
      :filters="filters"
      :expanded-folders="expandedFolders"
      @open="openFile"
      @open-in-new-panel="openFileInNewPanel"
      @delete="handleDelete"
      @create-in="(d) => emit('createNote', vault, d)"
      @create-subfolder="(d) => emit('createFolder', vault, d)"
      @toggle-folder="(p: string) => emit('toggleFolder', p)"
    />
  </div>
</template>
