import type { FileNode } from '~/types'
import { buildCommitMessage } from '~/utils/git'

export interface DailyNotesMonth {
  name: string
  path: string
  files: FileNode[]
}

/** Composable for daily-notes filesystem operations and tree building. */
export function useDailyNotes() {
  const fs = useFs()

  function getBaseDir(mainRepoPath: string | null, dailyNotesPath: string): string | null {
    if (!mainRepoPath) return null
    return `${mainRepoPath.replace(/[/\\]+$/, '')}/${dailyNotesPath.replace(/^[/\\]+/, '')}`
  }

  function formatMonthFolder(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }

  function formatFileName(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}.md`
  }

  async function buildTree(
    baseDir: string,
    showEmptyMonths: boolean,
  ): Promise<DailyNotesMonth[]> {
    const months: DailyNotesMonth[] = []
    const entries = await fs.readDir(baseDir).catch(() => [] as { name: string, isDirectory: boolean, isFile: boolean }[])

    for (const entry of entries) {
      if (!entry.isDirectory || !/^\d{4}-\d{2}$/.test(entry.name)) continue
      const monthPath = await fs.join(baseDir, entry.name)
      const files: FileNode[] = []
      const fileEntries = await fs.readDir(monthPath).catch(() => [] as { name: string, isDirectory: boolean, isFile: boolean }[])
      for (const f of fileEntries) {
        if (!f.isFile || !f.name.endsWith('.md')) continue
        const fullPath = await fs.join(monthPath, f.name)
        const info = await fs.stat(fullPath).catch(() => null)
        files.push({
          name: f.name,
          path: fullPath,
          isDir: false,
          mtime: info?.mtime ? info.mtime.getTime() : undefined,
          birthtime: info?.birthtime ? info.birthtime.getTime() : undefined,
        })
      }
      files.sort((a, b) => b.name.localeCompare(a.name))
      if (showEmptyMonths || files.length > 0) {
        months.push({ name: entry.name, path: monthPath, files })
      }
    }

    months.sort((a, b) => b.name.localeCompare(a.name))
    return months
  }

  async function ensureMonthFolder(baseDir: string, date: Date): Promise<string> {
    await fs.ensureDir(baseDir)
    const monthFolder = formatMonthFolder(date)
    const monthPath = await fs.join(baseDir, monthFolder)
    await fs.ensureDir(monthPath)
    return monthPath
  }

  async function createDailyNote(baseDir: string, date?: Date): Promise<string> {
    const targetDate = date ?? new Date()
    const monthPath = await ensureMonthFolder(baseDir, targetDate)
    const fileName = formatFileName(targetDate)
    const filePath = await fs.join(monthPath, fileName)
    const exists = await fs.exists(filePath)
    if (!exists) {
      await fs.writeText(filePath, '')
    }
    return filePath
  }

  async function deleteFile(filePath: string): Promise<void> {
    await fs.deleteFile(filePath)
  }

  async function deleteFolder(folderPath: string): Promise<void> {
    await fs.deleteFolder(folderPath)
  }

  async function commitIfGit(mainRepoPath: string): Promise<void> {
    const git = useGit()
    const isGit = await git.isRepo(mainRepoPath)
    if (!isGit) return
    const gitStore = useGitStore()
    const author = await gitStore.resolveAuthor()
    if (!author) return
    const settings = useSettingsStore().settings
    if (settings.defaultCommitMode !== 'auto') return
    const current = await git.status(mainRepoPath)
    const autoMessage = buildCommitMessage(settings.gitAutoMessageTemplate, current.changedFiles)
    await git.commitAll({
      path: mainRepoPath,
      message: autoMessage,
      authorName: author.name,
      authorEmail: author.email,
    })
  }

  async function moveDailyNotes(oldBaseDir: string, newBaseDir: string): Promise<void> {
    await fs.ensureDir(newBaseDir)
    const entries = await fs.readDir(oldBaseDir).catch(() => [] as { name: string, isDirectory: boolean, isFile: boolean }[])
    for (const entry of entries) {
      const oldPath = await fs.join(oldBaseDir, entry.name)
      const newPath = await fs.join(newBaseDir, entry.name)
      const exists = await fs.exists(newPath)
      if (exists) {
        if (entry.isDirectory) {
          const subEntries = await fs.readDir(oldPath).catch(() => [] as { name: string, isDirectory: boolean, isFile: boolean }[])
          for (const sub of subEntries) {
            if (sub.isFile && sub.name.endsWith('.md')) {
              const oldFile = await fs.join(oldPath, sub.name)
              const newFile = await fs.join(newPath, sub.name)
              if (!(await fs.exists(newFile))) {
                await fs.renameFile(oldFile, newFile)
              }
            }
          }
        }
      }
      else {
        await fs.renameFile(oldPath, newPath)
      }
    }
  }

  return {
    getBaseDir,
    formatMonthFolder,
    formatFileName,
    buildTree,
    ensureMonthFolder,
    createDailyNote,
    deleteFile,
    deleteFolder,
    commitIfGit,
    moveDailyNotes,
  }
}
