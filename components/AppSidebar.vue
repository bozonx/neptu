<script setup lang="ts">
import type { GitCommitMode, Vault, VaultType, VaultGroup } from '~/types'
import SettingsDialog from '~/components/SettingsDialog.vue'
import VaultSidebarItem from '~/components/VaultSidebarItem.vue'

const settings = useSettingsStore()
const vaults = useVaultsStore()
const editor = useEditorStore()
const git = useGitStore()
const toast = useToast()
const { t } = useI18n()

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

const mainVault = computed(() => vaults.list.find((v) => v.path === settings.mainRepoPath))
const otherUngroupedVaults = computed(() =>
  vaults.list.filter((v) => !v.groupId && v.path !== settings.mainRepoPath),
)
function vaultsInGroup(groupId: string) {
  return vaults.list.filter((v) => v.groupId === groupId)
}

const vaultTypeItems = [
  { label: t('vault.localFolder'), value: 'local' },
  { label: t('vault.gitRepo'), value: 'git' },
] satisfies Array<{ label: string, value: VaultType, disabled?: boolean }>

const gitModeItems = [
  { label: t('vault.connectExisting'), value: 'connect' as const },
  { label: t('vault.initNew'), value: 'init' as const },
]

const commitModeItems = [
  { label: t('vault.autoCommit'), value: 'auto' as const },
  { label: t('vault.manualCommit'), value: 'manual' as const },
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
    toast.add({ title: t('toast.cannotOpenDialog'), description: String(error), color: 'error' })
  }
}

async function submitNewVault() {
  if (!newVaultPath.value) return

  // Block git vault creation until an author is configured (in app settings or git's global config)
  if (newVaultType.value === 'git') {
    const author = await git.resolveAuthor()
    if (!author) {
      toast.add({
        title: t('toast.configureGitAuthor'),
        description: t('toast.gitAuthorHint'),
        color: 'warning',
      })
      settings.openSettingsDialog()
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
      title: t('toast.addVaultFailed'),
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
    toast.add({ title: t('toast.createNoteFailed'), description: String(error), color: 'error' })
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
    toast.add({ title: t('toast.removeVaultFailed'), description: String(error), color: 'error' })
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
    toast.add({ title: t('toast.createFolderFailed'), description: String(error), color: 'error' })
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
    <SettingsDialog v-model:open="settings.settingsDialogOpen" />

    <UContextMenu
      :items="[
        [
          { label: $t('sidebar.addVault'), icon: 'i-lucide-folder-plus', onSelect: () => addVaultOpen = true },
          { label: $t('sidebar.createGroup'), icon: 'i-lucide-folder-closed-plus', onSelect: () => openCreateGroup() },
        ],
      ]"
      :modal="false"
    >
      <div class="flex-1 overflow-auto p-2">
        <div
          v-if="vaults.list.length === 0"
          class="text-sm text-muted px-2 py-4"
        >
          {{ $t('sidebar.noVaults') }}
        </div>

        <VaultSidebarItem
          v-if="mainVault"
          :key="mainVault.id"
          class="mb-2"
          :vault="mainVault"
          :expanded="expandedVaults[mainVault.id] ?? false"
          :nodes="vaults.trees[mainVault.id] ?? []"
          :active-path="editor.currentFilePath"
          :filters="mainVault.filters"
          @toggle="toggleVault(mainVault)"
          @create-note="(v) => openCreateNote(v)"
          @create-folder="(v) => openCreateFolder(v)"
          @edit-vault="(v) => openEditVault(v)"
          @remove-vault="(v) => openRemoveVaultConfirm(v)"
        />

        <div
          v-if="mainVault && otherUngroupedVaults.length"
          class="my-2 border-t border-default"
        />

        <VaultSidebarItem
          v-for="vault in otherUngroupedVaults"
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
          <UContextMenu
            :items="[[{ label: $t('sidebar.deleteGroup'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => openRemoveGroupConfirm(group) }]]"
            :modal="false"
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
                :items="[[{ label: $t('sidebar.deleteGroup'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => openRemoveGroupConfirm(group) }]]"
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
          </UContextMenu>

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
    </UContextMenu>

    <div class="flex items-center gap-1 p-2 border-t border-default shrink-0">
      <div class="flex-1 flex items-center gap-1">
        <UButton
          icon="i-lucide-folder-plus"
          :label="$t('sidebar.addVault')"
          size="xs"
          variant="ghost"
          @click="addVaultOpen = true"
        />
        <UButton
          icon="i-lucide-folder-closed-plus"
          :label="$t('sidebar.createGroup')"
          size="xs"
          variant="ghost"
          @click="openCreateGroup"
        />
        <PluginButtons location="left-sidebar-footer" />
      </div>
      <UButton
        icon="i-lucide-settings"
        size="xs"
        color="neutral"
        variant="ghost"
        :title="$t('sidebar.settings')"
        @click="settings.openSettingsDialog()"
      />
    </div>

    <UModal
      v-model:open="addVaultOpen"
      :title="$t('sidebar.addVault')"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField
            :label="$t('vault.name')"
            :hint="$t('vault.nameHint')"
          >
            <UInput
              v-model="newVaultName"
              :placeholder="$t('vault.myNotesPlaceholder')"
            />
          </UFormField>

          <UFormField :label="$t('vault.type')">
            <URadioGroup
              v-model="newVaultType"
              :items="vaultTypeItems"
            />
          </UFormField>

          <UFormField :label="$t('vault.folder')">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newVaultPath ?? ''"
                readonly
                :placeholder="$t('vault.noFolderSelected')"
                class="flex-1"
              />
              <UButton
                icon="i-lucide-folder-search"
                :label="$t('vault.browse')"
                @click="browseFolder"
              />
            </div>
          </UFormField>

          <template v-if="newVaultType === 'git'">
            <UFormField :label="$t('vault.repository')">
              <URadioGroup
                v-model="newGitMode"
                :items="gitModeItems"
              />
            </UFormField>

            <UFormField :label="$t('vault.commitMode')">
              <URadioGroup
                v-model="newCommitMode"
                :items="commitModeItems"
              />
            </UFormField>

            <UFormField
              v-if="newCommitMode === 'auto'"
              :label="$t('vault.commitDebounce')"
              :hint="$t('vault.commitDebounceHint')"
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
            :label="$t('vault.cancel')"
            @click="addVaultOpen = false"
          />
          <UButton
            :label="$t('vault.add')"
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
      :title="$t('vault.newFolder')"
    >
      <template #body>
        <UFormField :label="$t('vault.folderName')">
          <UInput
            v-model="newFolderName"
            :placeholder="$t('vault.myFolderPlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="newFolderOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newFolderName.trim()"
            @click="submitCreateFolder"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeVaultConfirmOpen"
      :title="$t('vault.removeVault')"
    >
      <template #body>
        <p class="text-sm">
          {{ $t('vault.removeVaultConfirm', { name: removeVaultConfirmTarget?.name }) }}
        </p>
        <p class="text-xs text-muted mt-1">
          {{ $t('vault.removeVaultHint') }}
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="removeVaultConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('vault.remove')"
            @click="submitRemoveVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="createGroupOpen"
      :title="$t('vault.createGroup')"
    >
      <template #body>
        <UFormField :label="$t('vault.groupName')">
          <UInput
            v-model="newGroupName"
            :placeholder="$t('vault.workVaultsPlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="createGroupOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newGroupName.trim()"
            @click="submitCreateGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeGroupConfirmOpen"
      :title="$t('sidebar.deleteGroup')"
    >
      <template #body>
        <p class="text-sm">
          {{ $t('vault.deleteGroupConfirm', { name: removeGroupConfirmTarget?.name }) }}
        </p>
        <p class="text-xs text-muted mt-1">
          {{ $t('vault.deleteGroupHint') }}
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="removeGroupConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('vault.delete')"
            @click="submitRemoveGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="newNoteOpen"
      :title="$t('vault.newNote')"
    >
      <template #body>
        <UFormField
          :label="$t('vault.fileName')"
          :hint="$t('vault.fileNameHint')"
        >
          <UInput
            v-model="newNoteName"
            :placeholder="$t('vault.myNotePlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="newNoteOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newNoteName.trim()"
            @click="submitCreateNote"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
