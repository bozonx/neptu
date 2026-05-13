import { globToRegex } from '~/utils/glob'
import type { FileFilterSettings, FileNode, FileSortMode } from '~/types'

export const SKIPPED_TREE_DIRS = new Set(['node_modules', '.git'])

export function getEnabledFileExtensions(filterSettings?: FileFilterSettings): Set<string> {
  const enabledExts = new Set<string>()
  if (!filterSettings) {
    enabledExts.add('md')
    return enabledExts
  }

  for (const group of filterSettings.groups) {
    if (!group.enabled) continue
    for (const extension of group.extensions) {
      if (extension.enabled) enabledExts.add(extension.ext.toLowerCase())
    }
  }
  return enabledExts
}

export function getFileExtension(name: string): string | null {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return null
  return name.slice(idx + 1).toLowerCase()
}

export function createExcludeMatcher(rootPath: string, excludes?: string[]): (absPath: string) => boolean {
  const normRoot = rootPath.replace(/[/]+$/, '')
  const excludeRegexes = excludes ? excludes.map(globToRegex) : []
  if (excludeRegexes.length === 0) return () => false

  return (absPath: string) => {
    let rel = absPath.slice(normRoot.length)
    if (rel.startsWith('/') || rel.startsWith('\\')) rel = rel.slice(1)
    return excludeRegexes.some((re) => re.test(rel))
  }
}

function getGroupIndex(node: FileNode): number {
  const isHidden = node.name.startsWith('.')
  if (node.isDir && isHidden) return 0
  if (node.isDir) return 1
  if (isHidden) return 2
  return 3
}

export function compareFileNodes(sortMode: FileSortMode = 'nameAsc'): (a: FileNode, b: FileNode) => number {
  return (a, b) => {
    const aGroup = getGroupIndex(a)
    const bGroup = getGroupIndex(b)
    if (aGroup !== bGroup) return aGroup - bGroup

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
}
