<script setup lang="ts">
import type { FileNode, Project, ProjectType } from '~/types'
import ProjectTree from '~/components/ProjectTree.vue'

const projects = useProjectsStore()
const toast = useToast()

const addProjectOpen = ref(false)
const newProjectName = ref('')
const newProjectType = ref<ProjectType>('local')
const newProjectPath = ref<string | null>(null)

const newNoteOpen = ref(false)
const newNoteName = ref('')
const newNoteCtx = ref<{ project: Project, dir: string } | null>(null)

const projectTypeItems = [
  { label: 'Local folder', value: 'local' },
  { label: 'Git repository', value: 'git', disabled: true },
  { label: 'GitHub', value: 'github', disabled: true },
  { label: 'GitLab', value: 'gitlab', disabled: true },
] satisfies Array<{ label: string, value: ProjectType, disabled?: boolean }>

async function browseFolder() {
  const fs = useFs()
  try {
    const path = await fs.pickDirectory({ title: 'Select project folder' })
    if (path) newProjectPath.value = path
  }
  catch (error) {
    toast.add({ title: 'Cannot open dialog', description: String(error), color: 'error' })
  }
}

async function submitNewProject() {
  if (!newProjectPath.value) return
  try {
    await projects.addProject({
      name: newProjectName.value,
      type: newProjectType.value,
      path: newProjectPath.value,
    })
    addProjectOpen.value = false
    newProjectName.value = ''
    newProjectPath.value = null
    newProjectType.value = 'local'
  }
  catch (error) {
    toast.add({ title: 'Failed to add project', description: String(error), color: 'error' })
  }
}

function openCreateNote(project: Project, dir?: string) {
  newNoteCtx.value = { project, dir: dir ?? project.path }
  newNoteName.value = ''
  newNoteOpen.value = true
}

async function submitCreateNote() {
  if (!newNoteCtx.value || !newNoteName.value.trim()) return
  try {
    await projects.createNote({
      project: newNoteCtx.value.project,
      fileName: newNoteName.value.trim(),
      parentDir: newNoteCtx.value.dir,
    })
    newNoteOpen.value = false
  }
  catch (error) {
    toast.add({ title: 'Failed to create note', description: String(error), color: 'error' })
  }
}

async function handleDelete(project: Project, node: FileNode) {
  if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
  try {
    await projects.deleteNote({ project, path: node.path })
  }
  catch (error) {
    toast.add({ title: 'Failed to delete', description: String(error), color: 'error' })
  }
}

async function handleRemoveProject(project: Project) {
  if (!confirm(`Remove "${project.name}" from the list? Files on disk are kept intact.`)) return
  await projects.removeProject(project.id)
}

function openFile(path: string) {
  projects.openFile(path).catch((error: unknown) => {
    toast.add({ title: 'Failed to open file', description: String(error), color: 'error' })
  })
}

// Per-project expansion state in the sidebar.
// The main repository is expanded by default so the user can start editing immediately.
const expandedProjects = ref<Record<string, boolean>>({})

watchEffect(() => {
  for (const project of projects.projects) {
    if (expandedProjects.value[project.id] !== undefined) continue
    expandedProjects.value[project.id] = project.path === projects.mainRepoPath
  }
})

function toggleProject(project: Project) {
  expandedProjects.value[project.id] = !expandedProjects.value[project.id]
}
</script>

<template>
  <div class="flex flex-col h-full gap-3 p-2">
    <UButton
      icon="i-lucide-folder-plus"
      label="Add project"
      block
      @click="addProjectOpen = true"
    />

    <div class="flex-1 overflow-auto">
      <div v-if="projects.projects.length === 0" class="text-sm text-muted px-2 py-4">
        No projects yet. Add a folder to get started.
      </div>

      <div v-for="project in projects.projects" :key="project.id" class="mb-2">
        <div
          class="group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated"
          @click="toggleProject(project)"
        >
          <UIcon
            :name="expandedProjects[project.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-4 text-muted shrink-0"
          />
          <UIcon
            :name="project.path === projects.mainRepoPath ? 'i-lucide-folder-heart' : 'i-lucide-folder'"
            class="size-4 shrink-0"
            :class="project.path === projects.mainRepoPath ? 'text-primary' : 'text-muted'"
          />
          <span class="truncate flex-1 text-sm font-medium">{{ project.name }}</span>
          <UButton
            icon="i-lucide-file-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            title="New note"
            class="opacity-0 group-hover:opacity-100"
            @click.stop="openCreateNote(project)"
          />
          <UButton
            v-if="project.path !== projects.mainRepoPath"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            title="Remove from list"
            class="opacity-0 group-hover:opacity-100"
            @click.stop="handleRemoveProject(project)"
          />
        </div>

        <ProjectTree
          v-if="expandedProjects[project.id]"
          :project="project"
          :nodes="projects.trees[project.id] ?? []"
          :active-path="projects.currentFilePath"
          @open="openFile"
          @delete="(n) => handleDelete(project, n)"
          @create-in="(d) => openCreateNote(project, d)"
        />
      </div>
    </div>

    <UModal v-model:open="addProjectOpen" title="Add project">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" hint="Optional, defaults to folder name">
            <UInput v-model="newProjectName" placeholder="My notes" />
          </UFormField>

          <UFormField label="Type">
            <URadioGroup v-model="newProjectType" :items="projectTypeItems" />
          </UFormField>

          <UFormField label="Folder">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newProjectPath ?? ''"
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
          <UButton color="neutral" variant="ghost" label="Cancel" @click="addProjectOpen = false" />
          <UButton
            label="Add"
            :disabled="!newProjectPath"
            @click="submitNewProject"
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
