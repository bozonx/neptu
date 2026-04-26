import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { join, sep } from '@tauri-apps/api/path'
import type { FileNode } from '~/types'

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

  async function createMarkdown(dirPath: string, fileName: string) {
    const safe = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    const fullPath = await join(dirPath, safe)
    await writeTextFile(fullPath, '')
    return fullPath
  }

  /**
   * Recursively scans a directory and returns a tree of folders and `.md` files.
   * Hidden (`.git`, `.neptu`, …) and system folders are skipped, but empty
   * subdirectories are kept so the user can still create notes inside them.
   */
  async function scanMarkdownTree(rootPath: string): Promise<FileNode[]> {
    async function walk(dirPath: string): Promise<FileNode[]> {
      const entries = await readDir(dirPath)
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (!entry.name) continue

        if (entry.isDirectory) {
          if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
          const childPath = await join(dirPath, entry.name)
          const children = await walk(childPath)
          nodes.push({
            name: entry.name,
            path: childPath,
            isDir: true,
            children,
          })
        }
        else if (entry.isFile && entry.name.toLowerCase().endsWith('.md')) {
          const childPath = await join(dirPath, entry.name)
          nodes.push({
            name: entry.name,
            path: childPath,
            isDir: false,
          })
        }
      }

      // Sort: directories first, then files; alphabetically within each group
      nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return nodes
    }

    return walk(rootPath)
  }

  return {
    pickDirectory,
    ensureDir,
    readText,
    writeText,
    deleteFile,
    createMarkdown,
    scanMarkdownTree,
    sep,
  }
}
