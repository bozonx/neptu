<script setup lang="ts">
import type { GitCommitMode, Vault, VaultType, VaultGroup } from '~/types'
import SettingsDialog from '~/components/SettingsDialog.vue'
import VaultSidebarItem from '~/components/VaultSidebarItem.vue'

const settings = useSettingsStore()
const vaults = useVaultsStore()
const editor = useEditorStore()
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

const newFolderOpen = ref(false)
const newFolderName = ref('')
const newFolderCtx = ref<{ vault: Vault, dir: string } | null>(null)

const editVaultOpen = ref(false)
const editingVault = ref<Vault | null>(null)

const removeVaultConfirmOpen = ref(false)
const removeVaultConfirmTarget = ref<Vault | null>(null)

const createGroupOpen = ref(false)
const newGroupName = ref('')
const removeGroupConfirmOpen = ref(false)
const removeGroupConfirmTarget = ref<VaultGroup | null>(null)
const expandedGroups = ref<Record<string, boolean>>({})

const ungroupedVaults = computed(() => vaults.list.filter((v) => !v.groupId))
function vaultsInGroup(groupId: string) {
  return vaults.list.filter((v) => v.groupId === groupId)
}

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

async function browseFolder() {
  try {
    const path = await useFs().pickDirectory({ title: 'Select vault folder' })
    if (path) newVaultPath.value = path
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
  editVaultOpen.value = true
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

function openRemoveVaultConfirm(vault: Vault) {
  removeVaultConfirmTarget.value = vault
  removeVaultConfirmOpen.value = true
}

async function submitRemoveVault() {
  if (!removeVaultConfirmTarget.value) return
  try {
    await vaults.removeVault(removeVaultConfirmTarget.value.id)
    removeVaultConfirmOpen.value = false
    removeVaultConfirmTarget.value = null
    // If the edit modal is open for the same vault, close it
    if (editingVault.value && !vaults.findById(editingVault.value.id)) {
      editVaultOpen.value = false
      editingVault.value = null
    }
  }
  catch (error) {
    toast.add({ title: 'Failed to remove vault', description: String(error), color: 'error' })
  }
}

function toggleGroup(group: VaultGroup) {
  expandedGroups.value[group.id] = !expandedGroups.value[group.id]
}

function openCreateGroup() {
  newGroupName.value = ''
  createGroupOpen.value = true
}

async function submitCreateGroup() {
  if (!newGroupName.value.trim()) return
  await vaults.addGroup(newGroupName.value.trim())
  createGroupOpen.value = false
}

function openRemoveGroupConfirm(group: VaultGroup) {
  removeGroupConfirmTarget.value = group
  removeGroupConfirmOpen.value = true
}

async function submitRemoveGroup() {
  if (!removeGroupConfirmTarget.value) return
  await vaults.removeGroup(removeGroupConfirmTarget.value.id)
  removeGroupConfirmOpen.value = false
  removeGroupConfirmTarget.value = null
}

function openCreateFolder(vault: Vault, dir?: string) {
  newFolderCtx.value = { vault, dir: dir ?? vault.path }
  newFolderName.value = ''
  newFolderOpen.value = true
}

async function submitCreateFolder() {
  if (!newFolderCtx.value || !newFolderName.value.trim()) return
  try {
    await vaults.createVaultFolder(newFolderCtx.value.vault, newFolderCtx.value.dir, newFolderName.value.trim())
    newFolderOpen.value = false
  }
  catch (error) {
    toast.add({ title: 'Failed to create folder', description: String(error), color: 'error' })
  }
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
  <div class="flex flex-col h-full bg-default">
    <SettingsDialog v-model:open="settingsOpen" />

    <div class="flex-1 overflow-auto p-2">
      <div
        v-if="vaults.list.length === 0"
        class="text-sm text-muted px-2 py-4"
      >
        No vaults yet. Add a folder to get started.
      </div>

      <VaultSidebarItem
        v-for="vault in ungroupedVaults"
        :key="vault.id"
        class="mb-2"
        :vault="vault"
        :expanded="expandedVaults[vault.id] ?? false"
        :nodes="vaults.trees[vault.id] ?? []"
        :active-path="editor.currentFilePath"
        :filters="vault.filters"
        @toggle="toggleVault(vault)"
        @create-note="(v) => openCreateNote(v)"
        @create-folder="(v) => openCreateFolder(v)"
        @edit-vault="(v) => openEditVault(v)"
        @remove-vault="(v) => openRemoveVaultConfirm(v)"
      />

      <div
        v-for="group in vaults.groups"
        :key="group.id"
        class="mb-2"
      >
        <div
          class="group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer bg-elevated/50 hover:ring-1 hover:ring-inset hover:ring-border/50"
          @click="toggleGroup(group)"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-muted shrink-0 transition-transform"
            :class="{ 'rotate-90': expandedGroups[group.id] }"
          />
          <UIcon
            name="i-lucide-folder-closed"
            class="size-4 text-muted shrink-0"
          />
          <span class="truncate text-sm font-medium flex-1">{{ group.name }}</span>
          <UDropdownMenu
            :items="[[{ label: 'Delete group', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => openRemoveGroupConfirm(group) }]]"
            :modal="false"
            size="xs"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              color="neutral"
              variant="ghost"
              title="More"
              @click.stop
            />
          </UDropdownMenu>
        </div>

        <div
          v-if="expandedGroups[group.id]"
          class="pl-3 mt-1 space-y-1"
        >
          <VaultSidebarItem
            v-for="vault in vaultsInGroup(group.id)"
            :key="vault.id"
            class="mb-2"
            :vault="vault"
            :expanded="expandedVaults[vault.id] ?? false"
            :nodes="vaults.trees[vault.id] ?? []"
            :active-path="editor.currentFilePath"
            :filters="vault.filters"
            @toggle="toggleVault(vault)"
            @create-note="(v) => openCreateNote(v)"
            @create-folder="(v) => openCreateFolder(v)"
            @edit-vault="(v) => openEditVault(v)"
            @remove-vault="(v) => openRemoveVaultConfirm(v)"
          />
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 p-2 border-t border-default shrink-0">
      <div class="flex-1 flex items-center gap-1">
        <UButton
          icon="i-lucide-folder-plus"
          label="Add vault"
          size="xs"
          variant="ghost"
          @click="addVaultOpen = true"
        />
        <UButton
          icon="i-lucide-folder-closed-plus"
          label="Create group"
          size="xs"
          variant="ghost"
          @click="openCreateGroup"
        />
      </div>
      <UButton
        icon="i-lucide-settings"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Settings"
        @click="settingsOpen = true"
      />
    </div>

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

    <VaultSettingsDrawer
      v-model:open="editVaultOpen"
      :vault="editingVault"
      @close="editingVault = null"
      @remove="openRemoveVaultConfirm"
    />

    <UModal
      v-model:open="newFolderOpen"
      title="New folder"
    >
      <template #body>
        <UFormField label="Folder name">
          <UInput
            v-model="newFolderName"
            placeholder="my-folder"
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
            @click="newFolderOpen = false"
          />
          <UButton
            label="Create"
            :disabled="!newFolderName.trim()"
            @click="submitCreateFolder"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeVaultConfirmOpen"
      title="Remove vault"
    >
      <template #body>
        <p class="text-sm">
          Remove "<strong>{{ removeVaultConfirmTarget?.name }}</strong>" from the app?
        </p>
        <p class="text-xs text-muted mt-1">
          The folder and all its files on disk will remain intact. Only the app settings are removed.
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="removeVaultConfirmOpen = false"
          />
          <UButton
            color="error"
            label="Remove"
            @click="submitRemoveVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="createGroupOpen"
      title="Create group"
    >
      <template #body>
        <UFormField label="Group name">
          <UInput
            v-model="newGroupName"
            placeholder="Work vaults"
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
            @click="createGroupOpen = false"
          />
          <UButton
            label="Create"
            :disabled="!newGroupName.trim()"
            @click="submitCreateGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeGroupConfirmOpen"
      title="Delete group"
    >
      <template #body>
        <p class="text-sm">
          Delete "<strong>{{ removeGroupConfirmTarget?.name }}</strong>"?
        </p>
        <p class="text-xs text-muted mt-1">
          Vaults inside this group will be ungrouped. No files or data will be deleted.
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="removeGroupConfirmOpen = false"
          />
          <UButton
            color="error"
            label="Delete"
            @click="submitRemoveGroup"
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
