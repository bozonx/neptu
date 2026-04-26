<script setup lang="ts">
import { DEFAULT_FILE_FILTERS, type FileFilterGroup, type FileFilterSettings, type FileNode, type GitCommitMode, type Vault, type VaultType } from '~/types'
import VaultTree from '~/components/VaultTree.vue'
import SettingsDialog from '~/components/SettingsDialog.vue'

const settings = useSettingsStore()
const vaults = useVaultsStore()
const editor = useEditorStore()
const tabs = useTabsStore()
const git = useGitStore()
const toast = useToast()

const settingsOpen = ref(false)

const addVaultOpen = ref(false)
const newVaultName = ref('')
const newVaultType = ref<VaultType>('local')
const newVaultPath = ref<string | null>(null)
const newGitMode = ref<'connect' | 'init'>('connect')
const newCommitMode = ref<GitCommitMode>('auto')
const newCommitDebounceSec = ref(5)

const newNoteOpen = ref(false)
const newNoteName = ref('')
const newNoteCtx = ref<{ vault: Vault, dir: string } | null>(null)

const editVaultOpen = ref(false)
const editingVault = ref<Vault | null>(null)
const editVaultName = ref('')
const editVaultPath = ref<string | null>(null)
const editCommitMode = ref<GitCommitMode>('auto')
const editCommitDebounceSec = ref(5)
const editShowHidden = ref(false)
const editFilters = ref<FileFilterSettings>({ groups: [] })
const newCustomExt = ref('')

const vaultTypeItems = [
  { label: 'Local folder', value: 'local' },
  { label: 'Git repository (local)', value: 'git' },
] satisfies Array<{ label: string, value: VaultType, disabled?: boolean }>

const gitModeItems = [
  { label: 'Connect existing repository', value: 'connect' as const },
  { label: 'Initialize new repository', value: 'init' as const },
]

const commitModeItems = [
  { label: 'Auto-commit (debounced)', value: 'auto' as const },
  { label: 'Manual (Commit button)', value: 'manual' as const },
]

function resetAddForm() {
  newVaultName.value = ''
  newVaultPath.value = null
  newVaultType.value = 'local'
  newGitMode.value = 'connect'
  newCommitMode.value = 'auto'
  newCommitDebounceSec.value = settings.settings.defaultCommitDebounceMs / 1000
}

watch(addVaultOpen, (value) => {
  if (value) resetAddForm()
})

function addCustomExtension(group: FileFilterGroup) {
  const raw = newCustomExt.value.trim().toLowerCase().replace(/^\.+/, '')
  if (!raw) return
  if (!group.extensions.some((e) => e.ext === raw)) {
    group.extensions.push({ ext: raw, enabled: true })
  }
  newCustomExt.value = ''
}

async function browseFolder() {
  try {
    const path = await useFs().pickDirectory({ title: 'Select vault folder' })
    if (path) newVaultPath.value = path
  }
  catch (error) {
    toast.add({ title: 'Cannot open dialog', description: String(error), color: 'error' })
  }
}

async function browseEditFolder() {
  try {
    const path = await useFs().pickDirectory({ title: 'Select vault folder' })
    if (path) editVaultPath.value = path
  }
  catch (error) {
    toast.add({ title: 'Cannot open dialog', description: String(error), color: 'error' })
  }
}

async function submitNewVault() {
  if (!newVaultPath.value) return

  // Block git vault creation until an author is configured (in app settings or git's global config)
  if (newVaultType.value === 'git') {
    const author = await git.resolveAuthor()
    if (!author) {
      toast.add({
        title: 'Configure git author first',
        description: 'Set author name/email in Settings or run `git config --global user.name/email`.',
        color: 'warning',
      })
      settingsOpen.value = true
      return
    }
  }

  try {
    await vaults.addVault({
      name: newVaultName.value,
      type: newVaultType.value,
      path: newVaultPath.value,
      gitMode: newVaultType.value === 'git' ? newGitMode.value : undefined,
      git: newVaultType.value === 'git'
        ? {
            commitMode: newCommitMode.value,
            commitDebounceMs: Math.max(0, Math.round(newCommitDebounceSec.value * 1000)),
          }
        : undefined,
    })
    addVaultOpen.value = false
    resetAddForm()
  }
  catch (error) {
    toast.add({
      title: 'Failed to add vault',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

function openCreateNote(vault: Vault, dir?: string) {
  newNoteCtx.value = { vault, dir: dir ?? vault.path }
  newNoteName.value = ''
  newNoteOpen.value = true
}

function openEditVault(vault: Vault) {
  editingVault.value = vault
  editVaultName.value = vault.name
  editVaultPath.value = vault.path
  editCommitMode.value = vault.git?.commitMode ?? 'auto'
  editCommitDebounceSec.value = (vault.git?.commitDebounceMs ?? settings.settings.defaultCommitDebounceMs) / 1000
  editShowHidden.value = vault.showHidden ?? false
  editFilters.value = vault.filters
    ? JSON.parse(JSON.stringify(vault.filters))
    : JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS))
  editVaultOpen.value = true
}

async function submitEditVault() {
  if (!editingVault.value) return
  try {
    const isGit = editingVault.value.type === 'git'
    await vaults.updateVault(editingVault.value.id, {
      name: editVaultName.value,
      path: editVaultPath.value ?? undefined,
      git: isGit
        ? {
            commitMode: editCommitMode.value,
            commitDebounceMs: Math.max(0, Math.round(editCommitDebounceSec.value * 1000)),
          }
        : undefined,
      filters: editFilters.value,
      showHidden: editShowHidden.value,
    })
    editVaultOpen.value = false
    editingVault.value = null
    editVaultName.value = ''
    editVaultPath.value = null
  }
  catch (error) {
    toast.add({
      title: 'Failed to update vault',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

async function submitCreateNote() {
  if (!newNoteCtx.value || !newNoteName.value.trim()) return
  try {
    await editor.createNote({
      vault: newNoteCtx.value.vault,
      fileName: newNoteName.value.trim(),
      parentDir: newNoteCtx.value.dir,
    })
    newNoteOpen.value = false
  }
  catch (error) {
    toast.add({ title: 'Failed to create note', description: String(error), color: 'error' })
  }
}

async function handleDelete(vault: Vault, node: FileNode) {
  if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
  try {
    await editor.deleteNote({ vault, path: node.path })
  }
  catch (error) {
    toast.add({ title: 'Failed to delete', description: String(error), color: 'error' })
  }
}

async function handleRemoveVault(vault: Vault) {
  if (!confirm(`Remove "${vault.name}" from the list? Files on disk are kept intact.`)) return
  await vaults.removeVault(vault.id)
}

function openFile(path: string) {
  tabs.openFile(path).catch((error: unknown) => {
    toast.add({ title: 'Failed to open file', description: String(error), color: 'error' })
  })
}

// Per-vault expansion state in the sidebar.
// The main repository is expanded by default so the user can start editing immediately.
const expandedVaults = ref<Record<string, boolean>>({})

watchEffect(() => {
  for (const vault of vaults.list) {
    if (expandedVaults.value[vault.id] !== undefined) continue
    expandedVaults.value[vault.id] = vault.path === settings.mainRepoPath
  }
})

function toggleVault(vault: Vault) {
  expandedVaults.value[vault.id] = !expandedVaults.value[vault.id]
}
</script>

<template>
  <div class="flex flex-col h-full gap-3 p-2">
    <UButton
      icon="i-lucide-folder-plus"
      label="Add vault"
      block
      @click="addVaultOpen = true"
    />

    <SettingsDialog v-model:open="settingsOpen" />

    <div class="flex-1 overflow-auto">
      <div
        v-if="vaults.list.length === 0"
        class="text-sm text-muted px-2 py-4"
      >
        No vaults yet. Add a folder to get started.
      </div>

      <div
        v-for="vault in vaults.list"
        :key="vault.id"
        class="mb-2"
      >
        <div
          class="group flex flex-col gap-1 px-2 py-1.5 rounded-md cursor-pointer bg-elevated hover:ring-1 hover:ring-inset hover:ring-border/50"
          @click="toggleVault(vault)"
        >
          <div class="flex items-center gap-1 min-w-0">
            <UIcon
              :name="vault.path === settings.mainRepoPath ? 'i-lucide-folder-heart' : vault.type === 'git' ? 'i-lucide-git-branch' : 'i-lucide-folder'"
              class="size-4 shrink-0"
              :class="vault.path === settings.mainRepoPath ? 'text-primary' : 'text-muted'"
            />
            <span class="truncate text-sm font-medium">{{ vault.name }}</span>
            <UIcon
              v-if="!expandedVaults[vault.id]"
              name="i-lucide-chevron-right"
              class="size-4 text-muted shrink-0"
            />
          </div>

          <div class="flex items-center justify-end gap-1 min-w-0 h-6">
            <span class="text-xs text-muted capitalize hidden md:block md:opacity-100 md:group-hover:opacity-0 transition-opacity">
              {{ vault.type }}
            </span>
            <div class="flex items-center gap-1 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto transition-opacity">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                title="Edit vault"
                @click.stop="openEditVault(vault)"
              />
              <UButton
                icon="i-lucide-file-plus"
                size="xs"
                color="neutral"
                variant="ghost"
                title="New note"
                @click.stop="openCreateNote(vault)"
              />
              <UButton
                v-if="vault.path !== settings.mainRepoPath"
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                title="Remove from list"
                @click.stop="handleRemoveVault(vault)"
              />
            </div>
          </div>
        </div>

        <VaultTree
          v-if="expandedVaults[vault.id]"
          :vault="vault"
          :nodes="vaults.trees[vault.id] ?? []"
          :active-path="editor.currentFilePath"
          :filters="vault.filters"
          @open="openFile"
          @delete="(n) => handleDelete(vault, n)"
          @create-in="(d) => openCreateNote(vault, d)"
        />
      </div>
    </div>

    <UButton
      icon="i-lucide-settings"
      label="Settings"
      color="neutral"
      variant="ghost"
      block
      @click="settingsOpen = true"
    />

    <UModal
      v-model:open="addVaultOpen"
      title="Add vault"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField
            label="Name"
            hint="Optional, defaults to folder name"
          >
            <UInput
              v-model="newVaultName"
              placeholder="My notes"
            />
          </UFormField>

          <UFormField label="Type">
            <URadioGroup
              v-model="newVaultType"
              :items="vaultTypeItems"
            />
          </UFormField>

          <UFormField label="Folder">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newVaultPath ?? ''"
                readonly
                placeholder="No folder selected"
                class="flex-1"
              />
              <UButton
                icon="i-lucide-folder-search"
                label="Browse"
                @click="browseFolder"
              />
            </div>
          </UFormField>

          <template v-if="newVaultType === 'git'">
            <UFormField label="Repository">
              <URadioGroup
                v-model="newGitMode"
                :items="gitModeItems"
              />
            </UFormField>

            <UFormField label="Commit mode">
              <URadioGroup
                v-model="newCommitMode"
                :items="commitModeItems"
              />
            </UFormField>

            <UFormField
              v-if="newCommitMode === 'auto'"
              label="Commit debounce (seconds)"
              hint="Counted from the last autosave; new edits reset it."
            >
              <UInput
                v-model="newCommitDebounceSec"
                type="number"
                :min="0"
                :step="0.5"
              />
            </UFormField>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="addVaultOpen = false"
          />
          <UButton
            label="Add"
            :disabled="!newVaultPath"
            @click="submitNewVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="editVaultOpen"
      title="Edit vault"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name">
            <UInput
              v-model="editVaultName"
              placeholder="Vault name"
            />
          </UFormField>

          <UFormField label="Folder">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="editVaultPath ?? ''"
                readonly
                placeholder="No folder selected"
                class="flex-1"
                :disabled="editingVault?.path === settings.mainRepoPath"
              />
              <UButton
                icon="i-lucide-folder-search"
                label="Browse"
                :disabled="editingVault?.path === settings.mainRepoPath"
                @click="browseEditFolder"
              />
            </div>
          </UFormField>

          <template v-if="editingVault?.type === 'git'">
            <UFormField label="Commit mode">
              <URadioGroup
                v-model="editCommitMode"
                :items="commitModeItems"
              />
            </UFormField>
            <UFormField
              v-if="editCommitMode === 'auto'"
              label="Commit debounce (seconds)"
            >
              <UInput
                v-model="editCommitDebounceSec"
                type="number"
                :min="0"
                :step="0.5"
              />
            </UFormField>
          </template>

          <UFormField label="Show hidden files and folders">
            <USwitch v-model="editShowHidden" />
          </UFormField>

          <section class="space-y-2">
            <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
              File filters
            </h4>
            <div
              v-for="group in editFilters.groups"
              :key="group.label"
              class="space-y-1"
            >
              <div class="flex items-center gap-2">
                <UCheckbox
                  :label="group.label"
                  :model-value="group.enabled"
                  @update:model-value="(v: boolean | 'indeterminate') => { if (typeof v === 'boolean') group.enabled = v }"
                />
              </div>
              <div
                v-if="group.enabled"
                class="flex flex-wrap gap-2 ml-6"
              >
                <UCheckbox
                  v-for="ext in group.extensions"
                  :key="ext.ext"
                  :label="`.${ext.ext}`"
                  :model-value="ext.enabled"
                  @update:model-value="(v: boolean | 'indeterminate') => { if (typeof v === 'boolean') ext.enabled = v }"
                />
              </div>
              <div
                v-if="group.editable && group.enabled"
                class="flex items-center gap-2 ml-6"
              >
                <UInput
                  v-model="newCustomExt"
                  placeholder="Add custom extension"
                  size="xs"
                  class="w-36"
                  @keydown.enter="addCustomExtension(group)"
                />
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="addCustomExtension(group)"
                />
              </div>
            </div>
          </section>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="editVaultOpen = false"
          />
          <UButton
            label="Save"
            :disabled="!editVaultName.trim()"
            @click="submitEditVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="newNoteOpen"
      title="New note"
    >
      <template #body>
        <UFormField
          label="File name"
          hint="`.md` is added automatically"
        >
          <UInput
            v-model="newNoteName"
            placeholder="my-note"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="newNoteOpen = false"
          />
          <UButton
            label="Create"
            :disabled="!newNoteName.trim()"
            @click="submitCreateNote"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
