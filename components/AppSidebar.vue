<script setup lang="ts">
import type { FileNode, Vault, VaultType } from '~/types'
import VaultTree from '~/components/VaultTree.vue'

const vaults = useVaultsStore()
const toast = useToast()

const addVaultOpen = ref(false)
const newVaultName = ref('')
const newVaultType = ref<VaultType>('local')
const newVaultPath = ref<string | null>(null)

const newNoteOpen = ref(false)
const newNoteName = ref('')
const newNoteCtx = ref<{ vault: Vault, dir: string } | null>(null)

const vaultTypeItems = [
  { label: 'Local folder', value: 'local' },
  { label: 'Git repository', value: 'git', disabled: true },
  { label: 'GitHub', value: 'github', disabled: true },
  { label: 'GitLab', value: 'gitlab', disabled: true },
] satisfies Array<{ label: string, value: VaultType, disabled?: boolean }>

async function browseFolder() {
  const fs = useFs()
  try {
    const path = await fs.pickDirectory({ title: 'Select vault folder' })
    if (path) newVaultPath.value = path
  }
  catch (error) {
    toast.add({ title: 'Cannot open dialog', description: String(error), color: 'error' })
  }
}

async function submitNewVault() {
  if (!newVaultPath.value) return
  try {
    await vaults.addVault({
      name: newVaultName.value,
      type: newVaultType.value,
      path: newVaultPath.value,
    })
    addVaultOpen.value = false
    newVaultName.value = ''
    newVaultPath.value = null
    newVaultType.value = 'local'
  }
  catch (error) {
    toast.add({ title: 'Failed to add vault', description: String(error), color: 'error' })
  }
}

function openCreateNote(vault: Vault, dir?: string) {
  newNoteCtx.value = { vault, dir: dir ?? vault.path }
  newNoteName.value = ''
  newNoteOpen.value = true
}

async function submitCreateNote() {
  if (!newNoteCtx.value || !newNoteName.value.trim()) return
  try {
    await vaults.createNote({
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
    await vaults.deleteNote({ vault, path: node.path })
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
  vaults.openFile(path).catch((error: unknown) => {
    toast.add({ title: 'Failed to open file', description: String(error), color: 'error' })
  })
}

// Per-vault expansion state in the sidebar.
// The main repository is expanded by default so the user can start editing immediately.
const expandedVaults = ref<Record<string, boolean>>({})

watchEffect(() => {
  for (const vault of vaults.vaults) {
    if (expandedVaults.value[vault.id] !== undefined) continue
    expandedVaults.value[vault.id] = vault.path === vaults.mainRepoPath
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

    <div class="flex-1 overflow-auto">
      <div v-if="vaults.vaults.length === 0" class="text-sm text-muted px-2 py-4">
        No vaults yet. Add a folder to get started.
      </div>

      <div v-for="vault in vaults.vaults" :key="vault.id" class="mb-2">
        <div
          class="group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated"
          @click="toggleVault(vault)"
        >
          <UIcon
            :name="expandedVaults[vault.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-4 text-muted shrink-0"
          />
          <UIcon
            :name="vault.path === vaults.mainRepoPath ? 'i-lucide-folder-heart' : 'i-lucide-folder'"
            class="size-4 shrink-0"
            :class="vault.path === vaults.mainRepoPath ? 'text-primary' : 'text-muted'"
          />
          <span class="truncate flex-1 text-sm font-medium">{{ vault.name }}</span>
          <UButton
            icon="i-lucide-file-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            title="New note"
            class="opacity-0 group-hover:opacity-100"
            @click.stop="openCreateNote(vault)"
          />
          <UButton
            v-if="vault.path !== vaults.mainRepoPath"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            title="Remove from list"
            class="opacity-0 group-hover:opacity-100"
            @click.stop="handleRemoveVault(vault)"
          />
        </div>

        <VaultTree
          v-if="expandedVaults[vault.id]"
          :vault="vault"
          :nodes="vaults.trees[vault.id] ?? []"
          :active-path="vaults.currentFilePath"
          @open="openFile"
          @delete="(n) => handleDelete(vault, n)"
          @create-in="(d) => openCreateNote(vault, d)"
        />
      </div>
    </div>

    <UModal v-model:open="addVaultOpen" title="Add vault">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" hint="Optional, defaults to folder name">
            <UInput v-model="newVaultName" placeholder="My notes" />
          </UFormField>

          <UFormField label="Type">
            <URadioGroup v-model="newVaultType" :items="vaultTypeItems" />
          </UFormField>

          <UFormField label="Folder">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newVaultPath ?? ''"
                readonly
                placeholder="No folder selected"
                class="flex-1"
              />
              <UButton icon="i-lucide-folder-search" label="Browse" @click="browseFolder" />
            </div>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="addVaultOpen = false" />
          <UButton
            label="Add"
            :disabled="!newVaultPath"
            @click="submitNewVault"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="newNoteOpen" title="New note">
      <template #body>
        <UFormField label="File name" hint="`.md` is added automatically">
          <UInput v-model="newNoteName" placeholder="my-note" autofocus />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="newNoteOpen = false" />
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
