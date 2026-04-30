<script setup lang="ts">
import type { SidebarDialogsContext } from '~/composables/useSidebarDialogs'

defineProps<{ ctx: SidebarDialogsContext }>()
</script>

<template>
  <!-- Add Local Vault -->
  <UModal
    v-model:open="ctx.addLocalVaultOpen.value"
    :title="$t('sidebar.addLocalVault')"
  >
    <template #body>
      <div class="space-y-3">
        <UFormField
          :label="$t('vault.name')"
          :hint="$t('vault.nameHint')"
        >
          <UInput
            v-model="ctx.newVaultName.value"
            :placeholder="$t('vault.myNotesPlaceholder')"
          />
        </UFormField>

        <UFormField :label="$t('vault.folder')">
          <div class="flex items-center gap-2">
            <UInput
              :model-value="ctx.newVaultPath.value ?? ''"
              readonly
              :placeholder="$t('vault.noFolderSelected')"
              class="flex-1"
            />
            <UButton
              icon="i-lucide-folder-search"
              :label="$t('vault.browse')"
              @click="ctx.browseFolder"
            />
          </div>
        </UFormField>

        <UFormField :label="$t('vault.contentType')">
          <ButtonGroupToggle
            v-model="ctx.newContentType.value"
            :items="ctx.contentTypeItems"
          />
        </UFormField>

        <p
          v-if="ctx.newContentType.value === 'vault'"
          class="text-xs text-muted"
        >
          {{ $t('vault.contentTypeVaultDesc') }}
        </p>

        <template v-if="ctx.newContentType.value === 'blog'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeBlogDesc') }}
          </p>
        </template>

        <template v-if="ctx.newContentType.value === 'custom'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeCustomDesc') }}
          </p>
          <UFormField :label="$t('vault.siteLangMode')">
            <URadioGroup
              v-model="ctx.newSiteLangMode.value"
              :items="ctx.siteLangModeItems"
            />
          </UFormField>
        </template>

        <UFormField
          v-if="ctx.newContentType.value !== 'vault'"
          :label="$t('vault.contentFolder')"
          :hint="$t('vault.contentFolderHint')"
        >
          <UInput v-model="ctx.newContentFolder.value" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('vault.cancel')"
          @click="ctx.addLocalVaultOpen.value = false"
        />
        <UButton
          :label="$t('vault.add')"
          :disabled="!ctx.newVaultPath.value"
          @click="ctx.submitNewVault"
        />
      </div>
    </template>
  </UModal>

  <!-- Add Git Vault -->
  <UModal
    v-model:open="ctx.addGitVaultOpen.value"
    :title="$t('sidebar.addGitVault')"
  >
    <template #body>
      <div class="space-y-3">
        <UFormField
          :label="$t('vault.name')"
          :hint="$t('vault.nameHint')"
        >
          <UInput
            v-model="ctx.newVaultName.value"
            :placeholder="$t('vault.myNotesPlaceholder')"
          />
        </UFormField>

        <UFormField :label="$t('vault.folder')">
          <div class="flex items-center gap-2">
            <UInput
              :model-value="ctx.newVaultPath.value ?? ''"
              readonly
              :placeholder="$t('vault.noFolderSelected')"
              class="flex-1"
            />
            <UButton
              icon="i-lucide-folder-search"
              :label="$t('vault.browse')"
              @click="ctx.browseFolder"
            />
          </div>
        </UFormField>

        <UFormField :label="$t('vault.repository')">
          <URadioGroup
            v-model="ctx.newGitMode.value"
            :items="ctx.gitModeItems"
          />
        </UFormField>

        <UFormField :label="$t('vault.commitMode')">
          <ButtonGroupToggle
            v-model="ctx.newCommitMode.value"
            :items="ctx.commitModeItems"
          />
        </UFormField>

        <UFormField
          v-if="ctx.showCommitDebounce.value"
          :label="$t('vault.commitDebounce')"
          :hint="$t('vault.commitDebounceHint')"
        >
          <UInput
            v-model="ctx.newCommitDebounceSec.value"
            type="number"
            :min="0"
            :step="0.5"
          />
        </UFormField>

        <UFormField :label="$t('vault.contentType')">
          <ButtonGroupToggle
            v-model="ctx.newContentType.value"
            :items="ctx.contentTypeItems"
          />
        </UFormField>

        <p
          v-if="ctx.newContentType.value === 'vault'"
          class="text-xs text-muted"
        >
          {{ $t('vault.contentTypeVaultDesc') }}
        </p>

        <template v-if="ctx.newContentType.value === 'blog'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeBlogDesc') }}
          </p>
        </template>

        <template v-if="ctx.newContentType.value === 'custom'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeCustomDesc') }}
          </p>
          <UFormField :label="$t('vault.siteLangMode')">
            <URadioGroup
              v-model="ctx.newSiteLangMode.value"
              :items="ctx.siteLangModeItems"
            />
          </UFormField>
        </template>

        <UFormField
          v-if="ctx.newContentType.value !== 'vault'"
          :label="$t('vault.contentFolder')"
          :hint="$t('vault.contentFolderHint')"
        >
          <UInput v-model="ctx.newContentFolder.value" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('vault.cancel')"
          @click="ctx.addGitVaultOpen.value = false"
        />
        <UButton
          :label="$t('vault.add')"
          :disabled="!ctx.newVaultPath.value"
          @click="ctx.submitNewVault"
        />
      </div>
    </template>
  </UModal>

  <!-- Edit Vault Drawer -->
  <VaultSettingsDrawer
    v-model:open="ctx.editVaultOpen.value"
    :vault="ctx.editingVault.value"
    @close="ctx.editingVault.value = null"
    @remove="ctx.openRemoveVaultConfirm"
  />

  <!-- New Folder -->
  <UModal
    v-model:open="ctx.newFolderOpen.value"
    :title="$t('vault.newFolder')"
  >
    <template #body>
      <UFormField :label="$t('vault.folderName')">
        <UInput
          v-model="ctx.newFolderName.value"
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
          @click="ctx.newFolderOpen.value = false"
        />
        <UButton
          :label="$t('vault.create')"
          :disabled="!ctx.newFolderName.value.trim()"
          @click="ctx.submitCreateFolder"
        />
      </div>
    </template>
  </UModal>

  <!-- Remove Vault Confirm -->
  <UModal
    v-model:open="ctx.removeVaultConfirmOpen.value"
    :title="$t('vault.removeVault')"
  >
    <template #body>
      <p class="text-sm">
        {{ $t('vault.removeVaultConfirm', { name: ctx.removeVaultConfirmTarget.value?.name }) }}
      </p>
      <p class="text-xs text-muted mt-1">
        {{ $t('vault.removeVaultHint') }}
      </p>
      <UFormField class="mt-3">
        <UCheckbox
          v-model="ctx.removeVaultClearSettings.value"
          :label="$t('vault.removeVaultClearSettings')"
        />
      </UFormField>
      <p class="text-xs text-muted mt-1">
        {{ $t('vault.removeVaultClearSettingsHint') }}
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('vault.cancel')"
          @click="ctx.removeVaultConfirmOpen.value = false"
        />
        <UButton
          color="error"
          :label="$t('vault.removeFromApp')"
          @click="ctx.submitRemoveVault"
        />
      </div>
    </template>
  </UModal>

  <!-- Create Group -->
  <UModal
    v-model:open="ctx.createGroupOpen.value"
    :title="$t('vault.createGroup')"
  >
    <template #body>
      <UFormField :label="$t('vault.groupName')">
        <UInput
          v-model="ctx.newGroupName.value"
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
          @click="ctx.createGroupOpen.value = false"
        />
        <UButton
          :label="$t('vault.create')"
          :disabled="!ctx.newGroupName.value.trim()"
          @click="ctx.submitCreateGroup"
        />
      </div>
    </template>
  </UModal>

  <!-- Rename Group -->
  <UModal
    v-model:open="ctx.renameGroupOpen.value"
    :title="$t('sidebar.renameGroup')"
  >
    <template #body>
      <UFormField :label="$t('vault.groupName')">
        <UInput
          v-model="ctx.renameGroupName.value"
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
          @click="ctx.renameGroupOpen.value = false"
        />
        <UButton
          :label="$t('vault.save')"
          :disabled="!ctx.renameGroupName.value.trim()"
          @click="ctx.submitRenameGroup"
        />
      </div>
    </template>
  </UModal>

  <!-- Remove Group Confirm -->
  <UModal
    v-model:open="ctx.removeGroupConfirmOpen.value"
    :title="$t('sidebar.ungroup')"
  >
    <template #body>
      <p class="text-sm">
        {{ $t('vault.deleteGroupConfirm', { name: ctx.removeGroupConfirmTarget.value?.name }) }}
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
          @click="ctx.removeGroupConfirmOpen.value = false"
        />
        <UButton
          color="error"
          :label="$t('sidebar.ungroup')"
          @click="ctx.submitRemoveGroup"
        />
      </div>
    </template>
  </UModal>

  <!-- New Note -->
  <UModal
    v-model:open="ctx.newNoteOpen.value"
    :title="$t('vault.newNote')"
  >
    <template #body>
      <UFormField
        :label="$t('vault.fileName')"
        :hint="$t('vault.fileNameHint')"
      >
        <UInput
          v-model="ctx.newNoteName.value"
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
          @click="ctx.newNoteOpen.value = false"
        />
        <UButton
          :label="$t('vault.create')"
          :disabled="!ctx.newNoteName.value.trim()"
          @click="ctx.submitCreateNote"
        />
      </div>
    </template>
  </UModal>
</template>
