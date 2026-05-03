<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FileNode } from '~/types'
import type { DailyNotesMonth } from '~/composables/useDailyNotes'

const props = defineProps<{
  // When true, the tree adapts to the content height instead of stretching
  // to fill the parent (used when embedded inside the single-column sidebar).
  inline?: boolean
}>()

const settings = useSettingsStore()
const tabs = useTabsStore()
const toast = useToast()
const { t } = useI18n()

const dn = useDailyNotes()

const baseDir = computed(() =>
  dn.getBaseDir(settings.mainRepoPath, settings.settings.dailyNotesPath),
)

const showEmptyMonths = ref(true)
const months = ref<DailyNotesMonth[]>([])
const loading = ref(false)

const todayFileName = computed(() => dn.formatFileName(new Date()))

async function loadTree() {
  if (!baseDir.value) return
  loading.value = true
  months.value = await dn.buildTree(baseDir.value, showEmptyMonths.value)
  loading.value = false
}

watch([baseDir, showEmptyMonths], loadTree, { immediate: true })

const currentMonth = computed(() => dn.formatMonthFolder(new Date()))

const expandedMonths = ref<Record<string, boolean>>({})

watch(months, (val) => {
  for (const m of val) {
    if (expandedMonths.value[m.name] === undefined) {
      expandedMonths.value[m.name] = m.name === currentMonth.value
    }
  }
}, { immediate: true })

function toggleMonth(name: string) {
  expandedMonths.value[name] = !expandedMonths.value[name]
}

async function onCreate() {
  if (!baseDir.value) return
  try {
    const path = await dn.createDailyNote(baseDir.value)
    await loadTree()
    await tabs.openFile(path)
    if (settings.mainRepoPath) {
      await dn.commitIfGit(settings.mainRepoPath)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.createNoteFailed'), description: String(error), color: 'error' })
  }
}

async function onOpen(file: FileNode) {
  await tabs.openFile(file.path)
}

function isToday(file: FileNode): boolean {
  return file.name === todayFileName.value
}

async function onDeleteFile(file: FileNode) {
  if (!baseDir.value) return
  try {
    await dn.deleteFile(file.path)
    await loadTree()
    if (settings.mainRepoPath) {
      await dn.commitIfGit(settings.mainRepoPath)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.deleteFailed'), description: String(error), color: 'error' })
  }
}

async function onDeleteFolder(month: DailyNotesMonth) {
  if (!baseDir.value) return
  try {
    await dn.deleteFolder(month.path)
    await loadTree()
    if (settings.mainRepoPath) {
      await dn.commitIfGit(settings.mainRepoPath)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.deleteFailed'), description: String(error), color: 'error' })
  }
}

function fileMenuItems(file: FileNode): DropdownMenuItem[][] {
  return [[
    { label: t('sidebar.deleteFile'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => onDeleteFile(file) },
  ]]
}

function folderMenuItems(month: DailyNotesMonth): DropdownMenuItem[][] {
  return [[
    { label: t('sidebar.deleteFolder'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => onDeleteFolder(month) },
  ]]
}
</script>

<template>
  <div :class="props.inline ? 'flex flex-col' : 'flex flex-col h-full'">
    <!-- Header -->
    <div class="flex items-center justify-between px-2 py-1.5 border-b border-default shrink-0">
      <div class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-calendar-days"
          class="size-3.5 text-muted shrink-0"
        />
        <span class="text-[10px] font-semibold text-muted uppercase tracking-wider">{{ $t('sidebar.dailyNotes') }}</span>
      </div>
      <UButton
        icon="i-lucide-plus"
        size="xs"
        color="neutral"
        variant="ghost"
        :title="$t('sidebar.createDailyNote')"
        @click="onCreate"
      />
    </div>

    <!-- Tree -->
    <div :class="props.inline ? 'p-2' : 'flex-1 overflow-auto p-2 min-h-0'">
      <div
        v-if="loading"
        class="text-xs text-muted px-2 py-1"
      >
        {{ $t('sidebar.loading') }}...
      </div>
      <div
        v-else-if="months.length === 0"
        class="text-xs text-muted px-2 py-1"
      >
        {{ $t('sidebar.noDailyNotes') }}
      </div>

      <div
        v-for="month in months"
        :key="month.name"
        class="mb-1"
      >
        <!-- Month folder -->
        <UContextMenu
          :items="folderMenuItems(month)"
          :modal="false"
        >
          <div
            class="flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer hover:bg-elevated transition-colors select-none"
            @click="toggleMonth(month.name)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3 text-muted shrink-0 transition-transform"
              :class="{ 'rotate-90': expandedMonths[month.name] }"
            />
            <UIcon
              name="i-lucide-folder"
              class="size-3.5 text-muted shrink-0"
            />
            <span class="truncate text-xs text-default flex-1">{{ month.name }}</span>
            <span class="text-[10px] text-muted tabular-nums">{{ month.files.length }}</span>
          </div>
        </UContextMenu>

        <!-- Files -->
        <div
          v-if="expandedMonths[month.name]"
          class="pl-5 mt-0.5 space-y-0.5"
        >
          <UContextMenu
            v-for="file in month.files"
            :key="file.path"
            :items="fileMenuItems(file)"
            :modal="false"
          >
            <div
              class="flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer hover:bg-elevated transition-colors select-none"
              :class="{ 'bg-primary/10 text-primary': isToday(file) }"
              @click="onOpen(file)"
            >
              <UIcon
                name="i-lucide-file-text"
                class="size-3.5 shrink-0"
                :class="isToday(file) ? 'text-primary' : 'text-muted'"
              />
              <span class="truncate text-xs flex-1">{{ file.name.replace('.md', '') }}</span>
            </div>
          </UContextMenu>
        </div>
      </div>
    </div>
  </div>
</template>
