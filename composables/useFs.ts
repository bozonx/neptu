import {
  copyFile as tauriCopyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { dirname, join } from '@tauri-apps/api/path'
import { load, dump } from 'js-yaml'
import type { FileFilterSettings, FileNode, FileSortMode } from '~/types'
import {
  compareFileNodes,
  createExcludeMatcher,
  getEnabledFileExtensions,
  getFileExtension,
  SKIPPED_TREE_DIRS,
} from '~/utils/vaults/tree'

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

  async function readBytes(path: string) {
    return await readFile(path)
  }

  async function listDir(path: string) {
    return await readDir(path)
  }

  async function writeText(path: string, content: string) {
    await writeTextFile(path, content)
  }

  async function writeBytes(path: string, content: Uint8Array) {
    await writeFile(path, content)
  }

  async function readYaml<T = unknown>(path: string): Promise<T> {
    const raw = await readTextFile(path)
    return load(raw) as T
  }

  async function writeYaml(path: string, data: unknown): Promise<void> {
    await writeTextFile(path, dump(data, { indent: 2, lineWidth: -1 }))
  }

  async function deleteFile(path: string) {
    await remove(path)
  }

  async function deleteFolder(path: string) {
    await remove(path, { recursive: true })
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

  function basename(path: string): string {
    const parts = path.split(/[\\/]/)
    return parts[parts.length - 1] ?? path
  }

  async function moveFile(src: string, dest: string) {
    // rename works for both files and folders
    await rename(src, dest)
  }

  async function moveToTrash(filePath: string, vaultPath: string) {
    const normalizedVault = vaultPath.replace(/[/\\]+$/, '')
    const sep = filePath.includes('\\') ? '\\' : '/'
    const relativePath = filePath.startsWith(normalizedVault + sep)
      ? filePath.slice(normalizedVault.length + 1)
      : filePath
    const trashDir = await join(normalizedVault, '.trash')
    let destPath = await join(trashDir, relativePath)

    // If destination exists, append timestamp to filename
    if (await exists(destPath)) {
      const name = basename(destPath)
      const lastDot = name.lastIndexOf('.')
      const baseName = lastDot > 0 ? name.slice(0, lastDot) : name
      const ext = lastDot > 0 ? name.slice(lastDot) : ''
      const timestamp = Date.now()
      const newName = `${baseName}-${timestamp}${ext}`
      const destDir = await dirname(destPath)
      destPath = await join(destDir, newName)
    }

    const destDir = await dirname(destPath)
    await ensureDir(destDir)
    await rename(filePath, destPath)
  }

  async function createMarkdown(dirPath: string, fileName: string) {
    const safe = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    const fullPath = await join(dirPath, safe)
    await writeTextFile(fullPath, '')
    return fullPath
  }

  async function createFile(dirPath: string, fileName: string) {
    const safe = fileName.trim()
    if (!safe) throw new Error('File name cannot be empty')
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

    const enabledExts = getEnabledFileExtensions(filterSettings)
    const isExcluded = createExcludeMatcher(normRoot, excludes)

    async function walk(dirPath: string): Promise<FileNode[]> {
      const entries = await readDir(dirPath)
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (!entry.name) continue

        const isHidden = entry.name.startsWith('.')
        if (entry.isDirectory) {
          if (SKIPPED_TREE_DIRS.has(entry.name)) continue
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
          const ext = getFileExtension(entry.name)
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

      nodes.sort(compareFileNodes(sortMode))
      return nodes
    }

    return walk(normRoot)
  }

  /**
   * Recursively scans a directory and returns a tree of all folders and files.
   * No filtering is applied — everything except `.git` is returned.
   */
  async function scanDir(rootPath: string): Promise<FileNode[]> {
    const normRoot = rootPath.replace(/[/]+$/, '')

    async function walk(dirPath: string): Promise<FileNode[]> {
      const entries = await readDir(dirPath)
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (!entry.name) continue
        if (entry.name === '.git') continue
        const childPath = await join(dirPath, entry.name)
        if (entry.isDirectory) {
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

      nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return nodes
    }

    return walk(normRoot)
  }

  return {
    pickDirectory,
    ensureDir,
    exists,
    readText,
    readBytes,
    readDir: listDir,
    writeText,
    writeBytes,
    readYaml,
    writeYaml,
    deleteFile,
    deleteFolder,
    renameFile,
    copyFile,
    copyFolder,
    moveFile,
    moveToTrash,
    createMarkdown,
    createFile,
    createFolder,
    scanMarkdownTree,
    scanDir,
    stat,
    join,
  }
}
