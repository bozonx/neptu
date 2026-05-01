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

        <template v-if="ctx.newContentType.value === 'site'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeSiteDesc') }}
          </p>
        </template>

        <template v-if="ctx.newContentType.value === 'custom'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeCustomDesc') }}
          </p>
          <UFormField :label="$t('vault.contentStructure')">
            <URadioGroup
              :model-value="ctx.newContentStructureId.value"
              :items="ctx.contentStructureItems.value"
              @update:model-value="ctx.setNewContentStructureId"
            />
          </UFormField>
          <p
            v-if="ctx.selectedNewContentStructure.value"
            class="text-xs text-muted"
          >
            {{ ctx.selectedNewContentStructureDescription.value }}
          </p>
          <p
            v-else
            class="text-xs text-muted"
          >
            {{ $t('vault.contentStructureCustomDesc') }}
          </p>
        </template>

        <USeparator class="my-2" />

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('sidebar.vaultOverrides') }}
          </h3>
          <p class="text-xs text-muted">
            {{ $t('vault.creationOverridesHint') }}
          </p>

          <UFormField
            v-if="ctx.newContentType.value !== 'vault'"
          >
            <UCheckbox
              v-model="ctx.newOverrideContentFolder.value"
              :label="$t('vault.overrideContentFolder')"
            />
            <UInput
              v-if="ctx.newOverrideContentFolder.value"
              v-model="ctx.newContentFolder.value"
              :placeholder="$t('vault.contentFolderHint')"
              class="mt-2"
            />
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="ctx.newOverrideFilters.value"
              :label="$t('vault.overrideFileFilters')"
            />
            <div
              v-if="ctx.newOverrideFilters.value"
              class="mt-2 space-y-3"
            >
              <div
                v-for="group in ctx.newFilters.value.groups"
                :key="group.label"
                class="space-y-2"
              >
                <UCheckbox
                  :label="$t(`filters.${group.label}`)"
                  :model-value="group.enabled"
                  @update:model-value="(v: boolean | 'indeterminate') => ctx.setNewFilterGroupEnabled(group.label, v)"
                />
                <div
                  v-if="group.enabled"
                  class="flex flex-wrap gap-2 ml-6"
                >
                  <UCheckbox
                    v-for="ext in group.extensions"
                    :key="ext.ext"
                    :label="`.${ext.ext}`"
                    :model-value="ext.enabled"
                    @update:model-value="(v: boolean | 'indeterminate') => ctx.setNewFilterExtensionEnabled(group.label, ext.ext, v)"
                  />
                </div>
                <div
                  v-if="group.editable && group.enabled"
                  class="flex items-center gap-2 ml-6"
                >
                  <UInput
                    :model-value="ctx.newCustomExt.value"
                    :placeholder="$t('vault.addCustomExtension')"
                    size="xs"
                    class="w-36"
                    @update:model-value="(value: string | number) => ctx.setNewCustomExt(String(value))"
                    @keydown.enter="ctx.addNewCustomExtension(group.label)"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="ctx.addNewCustomExtension(group.label)"
                  />
                </div>
              </div>
            </div>
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="ctx.newOverrideExcludes.value"
              :label="$t('vault.overrideExcludes')"
            />
            <div
              v-if="ctx.newOverrideExcludes.value"
              class="mt-2 space-y-2"
            >
              <div class="flex items-center gap-2">
                <UInput
                  v-model="ctx.newExcludeInput.value"
                  :placeholder="$t('vault.excludePlaceholder')"
                  class="flex-1"
                  @keydown.enter="() => { const raw = ctx.newExcludeInput.value.trim(); if (raw && !ctx.newExcludes.value.includes(raw)) { ctx.newExcludes.value.push(raw); ctx.newExcludeInput.value = '' } }"
                />
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="ghost"
                  @click="() => { const raw = ctx.newExcludeInput.value.trim(); if (raw && !ctx.newExcludes.value.includes(raw)) { ctx.newExcludes.value.push(raw); ctx.newExcludeInput.value = '' } }"
                />
              </div>
              <div
                v-if="ctx.newExcludes.value.length"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-for="(item, idx) in ctx.newExcludes.value"
                  :key="idx"
                  color="neutral"
                  variant="soft"
                  class="font-mono text-xs"
                  :label="item"
                  @close="ctx.newExcludes.value.splice(idx, 1)"
                />
              </div>
            </div>
          </UFormField>

          <UFormField>
            <UCheckbox
              :model-value="ctx.newOverrideMediaDir.value"
              :label="$t('vault.overrideMediaDir')"
              @update:model-value="ctx.setNewOverrideMediaDir"
            />
            <div
              v-if="ctx.newOverrideMediaDir.value"
              class="mt-2 space-y-3"
            >
              <UFormField :label="$t('vault.mediaMode')">
                <ButtonGroupToggle
                  :model-value="ctx.newMediaMode.value"
                  :items="ctx.mediaModeItems"
                  @update:model-value="ctx.setNewMediaMode"
                />
              </UFormField>
              <UFormField
                v-if="ctx.newMediaMode.value !== 'adjacent'"
                :label="$t('vault.mediaFolder')"
                :hint="ctx.newMediaMode.value === 'global-folder' ? $t('vault.mediaGlobalFolderHint') : $t('vault.mediaAdjacentFolderHint')"
              >
                <UInput
                  :model-value="ctx.newMediaFolder.value"
                  @update:model-value="ctx.setNewMediaFolder"
                />
              </UFormField>
              <UFormField :label="$t('vault.mediaNaming')">
                <ButtonGroupToggle
                  :model-value="ctx.newMediaNaming.value"
                  :items="ctx.mediaNamingItems"
                  @update:model-value="ctx.setNewMediaNaming"
                />
              </UFormField>
            </div>
          </UFormField>
        </section>
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

        <template v-if="ctx.newContentType.value === 'site'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeSiteDesc') }}
          </p>
        </template>

        <template v-if="ctx.newContentType.value === 'custom'">
          <p class="text-xs text-muted">
            {{ $t('vault.contentTypeCustomDesc') }}
          </p>
          <UFormField :label="$t('vault.contentStructure')">
            <URadioGroup
              :model-value="ctx.newContentStructureId.value"
              :items="ctx.contentStructureItems.value"
              @update:model-value="ctx.setNewContentStructureId"
            />
          </UFormField>
          <p
            v-if="ctx.selectedNewContentStructure.value"
            class="text-xs text-muted"
          >
            {{ ctx.selectedNewContentStructureDescription.value }}
          </p>
          <p
            v-else
            class="text-xs text-muted"
          >
            {{ $t('vault.contentStructureCustomDesc') }}
          </p>
        </template>

        <USeparator class="my-2" />

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('sidebar.vaultOverrides') }}
          </h3>
          <p class="text-xs text-muted">
            {{ $t('vault.creationOverridesHint') }}
          </p>

          <UFormField
            v-if="ctx.newContentType.value !== 'vault'"
          >
            <UCheckbox
              v-model="ctx.newOverrideContentFolder.value"
              :label="$t('vault.overrideContentFolder')"
            />
            <UInput
              v-if="ctx.newOverrideContentFolder.value"
              v-model="ctx.newContentFolder.value"
              :placeholder="$t('vault.contentFolderHint')"
              class="mt-2"
            />
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="ctx.newOverrideFilters.value"
              :label="$t('vault.overrideFileFilters')"
            />
            <div
              v-if="ctx.newOverrideFilters.value"
              class="mt-2 space-y-3"
            >
              <div
                v-for="group in ctx.newFilters.value.groups"
                :key="group.label"
                class="space-y-2"
              >
                <UCheckbox
                  :label="$t(`filters.${group.label}`)"
                  :model-value="group.enabled"
                  @update:model-value="(v: boolean | 'indeterminate') => ctx.setNewFilterGroupEnabled(group.label, v)"
                />
                <div
                  v-if="group.enabled"
                  class="flex flex-wrap gap-2 ml-6"
                >
                  <UCheckbox
                    v-for="ext in group.extensions"
                    :key="ext.ext"
                    :label="`.${ext.ext}`"
                    :model-value="ext.enabled"
                    @update:model-value="(v: boolean | 'indeterminate') => ctx.setNewFilterExtensionEnabled(group.label, ext.ext, v)"
                  />
                </div>
                <div
                  v-if="group.editable && group.enabled"
                  class="flex items-center gap-2 ml-6"
                >
                  <UInput
                    :model-value="ctx.newCustomExt.value"
                    :placeholder="$t('vault.addCustomExtension')"
                    size="xs"
                    class="w-36"
                    @update:model-value="(value: string | number) => ctx.setNewCustomExt(String(value))"
                    @keydown.enter="ctx.addNewCustomExtension(group.label)"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="ctx.addNewCustomExtension(group.label)"
                  />
                </div>
              </div>
            </div>
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="ctx.newOverrideExcludes.value"
              :label="$t('vault.overrideExcludes')"
            />
            <div
              v-if="ctx.newOverrideExcludes.value"
              class="mt-2 space-y-2"
            >
              <div class="flex items-center gap-2">
                <UInput
                  v-model="ctx.newExcludeInput.value"
                  :placeholder="$t('vault.excludePlaceholder')"
                  class="flex-1"
                  @keydown.enter="() => { const raw = ctx.newExcludeInput.value.trim(); if (raw && !ctx.newExcludes.value.includes(raw)) { ctx.newExcludes.value.push(raw); ctx.newExcludeInput.value = '' } }"
                />
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="ghost"
                  @click="() => { const raw = ctx.newExcludeInput.value.trim(); if (raw && !ctx.newExcludes.value.includes(raw)) { ctx.newExcludes.value.push(raw); ctx.newExcludeInput.value = '' } }"
                />
              </div>
              <div
                v-if="ctx.newExcludes.value.length"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-for="(item, idx) in ctx.newExcludes.value"
                  :key="idx"
                  color="neutral"
                  variant="soft"
                  class="font-mono text-xs"
                  :label="item"
                  @close="ctx.newExcludes.value.splice(idx, 1)"
                />
              </div>
            </div>
          </UFormField>

          <UFormField>
            <UCheckbox
              :model-value="ctx.newOverrideMediaDir.value"
              :label="$t('vault.overrideMediaDir')"
              @update:model-value="ctx.setNewOverrideMediaDir"
            />
            <div
              v-if="ctx.newOverrideMediaDir.value"
              class="mt-2 space-y-3"
            >
              <UFormField :label="$t('vault.mediaMode')">
                <ButtonGroupToggle
                  :model-value="ctx.newMediaMode.value"
                  :items="ctx.mediaModeItems"
                  @update:model-value="ctx.setNewMediaMode"
                />
              </UFormField>
              <UFormField
                v-if="ctx.newMediaMode.value !== 'adjacent'"
                :label="$t('vault.mediaFolder')"
                :hint="ctx.newMediaMode.value === 'global-folder' ? $t('vault.mediaGlobalFolderHint') : $t('vault.mediaAdjacentFolderHint')"
              >
                <UInput
                  :model-value="ctx.newMediaFolder.value"
                  @update:model-value="ctx.setNewMediaFolder"
                />
              </UFormField>
              <UFormField :label="$t('vault.mediaNaming')">
                <ButtonGroupToggle
                  :model-value="ctx.newMediaNaming.value"
                  :items="ctx.mediaNamingItems"
                  @update:model-value="ctx.setNewMediaNaming"
                />
              </UFormField>
            </div>
          </UFormField>
        </section>
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

  <!-- Rename Node -->
  <UModal
    v-model:open="ctx.renameNodeOpen.value"
    :title="$t('vault.rename', 'Rename')"
  >
    <template #body>
      <UFormField :label="$t('vault.newName', 'New Name')">
        <UInput
          v-model="ctx.renameNodeName.value"
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
          @click="ctx.renameNodeOpen.value = false"
        />
        <UButton
          :label="$t('vault.rename', 'Rename')"
          :disabled="!ctx.renameNodeName.value.trim() || ctx.renameNodeName.value.trim() === ctx.renameNodeCtx.value?.node.name"
          @click="ctx.submitRenameNode"
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
