import {
  copyFile as tauriCopyFile,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'
import type { FileFilterSettings, FileNode, FileSortMode } from '~/types'

// Non-hidden directories we still want to skip while scanning vaults.
// Dot-prefixed directories are filtered by `startsWith('.')`.
const SKIP_DIRS = new Set(['node_modules'])

/**
 * Native filesystem helpers backed by Tauri plugins.
 * All paths are absolute; passing relative paths is not supported.
 */
export function useFs() {
  async function pickDirectory(options?: { defaultPath?: string, title?: string }) {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: options?.defaultPath,
      title: options?.title,
    })
    if (selected === null || Array.isArray(selected)) return null
    return selected
  }

  async function ensureDir(path: string) {
    if (!(await exists(path))) {
      await mkdir(path, { recursive: true })
    }
  }

  async function readText(path: string) {
    return await readTextFile(path)
  }

  async function writeText(path: string, content: string) {
    await writeTextFile(path, content)
  }

  async function deleteFile(path: string) {
    await remove(path)
  }

  async function renameFile(oldPath: string, newPath: string) {
    await rename(oldPath, newPath)
  }

  async function copyFile(src: string, dest: string) {
    await tauriCopyFile(src, dest)
  }

  async function copyFolder(src: string, dest: string) {
    await ensureDir(dest)
    const entries = await readDir(src)
    for (const entry of entries) {
      const srcPath = await join(src, entry.name)
      const destPath = await join(dest, entry.name)
      if (entry.isDirectory) {
        await copyFolder(srcPath, destPath)
      }
      else {
        await tauriCopyFile(srcPath, destPath)
      }
    }
  }

  async function moveFile(src: string, dest: string) {
    // rename works for both files and folders
    await rename(src, dest)
  }

  async function createMarkdown(dirPath: string, fileName: string) {
    const safe = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    const fullPath = await join(dirPath, safe)
    await writeTextFile(fullPath, '')
    return fullPath
  }

  async function createFolder(dirPath: string, folderName: string) {
    const safe = folderName.trim()
    if (!safe) throw new Error('Folder name cannot be empty')
    const fullPath = await join(dirPath, safe)
    await ensureDir(fullPath)
    return fullPath
  }

  /**
   * Recursively scans a directory and returns a tree of folders and files
   * matching the vault's enabled extension groups. Empty subdirectories
   * are kept so the user can still create notes inside them.
   */
  async function scanMarkdownTree(
    rootPath: string,
    options: { showHidden?: boolean, filterSettings?: FileFilterSettings, sortMode?: FileSortMode, excludes?: string[] } = {},
  ): Promise<FileNode[]> {
    const { showHidden = false, filterSettings, sortMode = 'nameAsc', excludes } = options
    const normRoot = rootPath.replace(/[/]+$/, '')

    const enabledExts = new Set<string>()
    if (filterSettings) {
      for (const group of filterSettings.groups) {
        if (!group.enabled) continue
        for (const e of group.extensions) {
          if (e.enabled) enabledExts.add(e.ext.toLowerCase())
        }
      }
    }
    else {
      enabledExts.add('md')
    }

    function getExt(name: string): string | null {
      const idx = name.lastIndexOf('.')
      if (idx <= 0 || idx === name.length - 1) return null
      return name.slice(idx + 1).toLowerCase()
    }

    function getGroupIndex(node: FileNode): number {
      const isHidden = node.name.startsWith('.')
      if (node.isDir && isHidden) return 0
      if (node.isDir) return 1
      if (isHidden) return 2
      return 3
    }

    function compareNodes(a: FileNode, b: FileNode): number {
      const ga = getGroupIndex(a)
      const gb = getGroupIndex(b)
      if (ga !== gb) return ga - gb

      switch (sortMode) {
        case 'nameDesc':
          return b.name.localeCompare(a.name)
        case 'mtimeDesc':
          return (b.mtime ?? 0) - (a.mtime ?? 0)
        case 'mtimeAsc':
          return (a.mtime ?? 0) - (b.mtime ?? 0)
        case 'birthtimeDesc':
          return (b.birthtime ?? 0) - (a.birthtime ?? 0)
        case 'birthtimeAsc':
          return (a.birthtime ?? 0) - (b.birthtime ?? 0)
        case 'nameAsc':
        default:
          return a.name.localeCompare(b.name)
      }
    }

    function isExcluded(absPath: string): boolean {
      if (!excludes || excludes.length === 0) return false
      let rel = absPath.slice(normRoot.length)
      if (rel.startsWith('/') || rel.startsWith('\\')) rel = rel.slice(1)
      for (const pattern of excludes) {
        const norm = pattern.replace(/[\\/]+$/, '')
        if (rel === norm || rel.startsWith(norm + '/') || rel.startsWith(norm + '\\')) return true
      }
      return false
    }

    async function walk(dirPath: string): Promise<FileNode[]> {
      const entries = await readDir(dirPath)
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (!entry.name) continue

        const isHidden = entry.name.startsWith('.')
        if (entry.isDirectory) {
          if (SKIP_DIRS.has(entry.name)) continue
          if (isHidden && !showHidden) continue
          const childPath = await join(dirPath, entry.name)
          if (isExcluded(childPath)) continue
          const children = await walk(childPath)
          const info = await stat(childPath).catch(() => null)
          nodes.push({
            name: entry.name,
            path: childPath,
            isDir: true,
            mtime: info?.mtime ? info.mtime.getTime() : undefined,
            birthtime: info?.birthtime ? info.birthtime.getTime() : undefined,
            children,
          })
        }
        else if (entry.isFile) {
          if (isHidden && !showHidden) continue
          const ext = getExt(entry.name)
          if (!ext || !enabledExts.has(ext)) continue
          const childPath = await join(dirPath, entry.name)
          if (isExcluded(childPath)) continue
          const info = await stat(childPath).catch(() => null)
          nodes.push({
            name: entry.name,
            path: childPath,
            isDir: false,
            mtime: info?.mtime ? info.mtime.getTime() : undefined,
            birthtime: info?.birthtime ? info.birthtime.getTime() : undefined,
          })
        }
      }

      nodes.sort(compareNodes)
      return nodes
    }

    return walk(normRoot)
  }

  return {
    pickDirectory,
    ensureDir,
    exists,
    readText,
    writeText,
    deleteFile,
    renameFile,
    copyFile,
    copyFolder,
    moveFile,
    createMarkdown,
    createFolder,
    scanMarkdownTree,
    stat,
    join,
  }
}
