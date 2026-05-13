import { join } from '@tauri-apps/api/path'
import type { FileNode, Vault } from '~/types'
import { dirname, fileExt, fileStem } from '~/utils/paths'

interface ResolveResult {
  vault: Vault
  path: string
  exists: boolean
}

/**
 * Resolve a wikilink target (the inner `[[...]]` value without alias/anchor)
 * to an absolute file path within the same vault as `documentPath`.
 *
 * Resolution order:
 *   1. If `target` contains a path separator, treat it as vault-relative.
 *   2. Otherwise scan the vault tree for any file with a matching basename
 *      (with or without `.md`). Prefer files in the same directory as the
 *      current document.
 *   3. If nothing matches, return a synthesised path (the file does not exist
 *      yet): vault-relative paths land at the content root, bare names land
 *      next to the current document.
 */
export async function resolveWikilink(target: string, documentPath: string | null): Promise<ResolveResult | null> {
  const clean = target.trim()
  if (!clean) return null

  const vaultsStore = useVaultsStore()
  const vault = documentPath ? vaultsStore.findVaultForPath(documentPath) : null
  if (!vault) return null

  const tree = vaultsStore.trees[vault.id] ?? []
  const contentRoot = vaultsStore.getEffectiveContentRoot(vault)

  const hasSeparator = clean.includes('/') || clean.includes('\\')
  const normalized = clean.replace(/\\/g, '/').replace(/^\/+/, '')
  const withExt = fileExt(normalized) ? normalized : `${normalized}.md`

  if (hasSeparator) {
    const absolute = await join(contentRoot, withExt)
    const match = findNodeByAbsolute(tree, absolute)
    return { vault, path: match?.path ?? absolute, exists: !!match }
  }

  const matches = findNodesByBasename(tree, normalized)
  if (matches.length > 0) {
    const docDir = documentPath ? dirname(documentPath) : null
    const sameDirMatch = docDir ? matches.find((node) => dirname(node.path) === docDir) : null
    const preferred = sameDirMatch ?? matches[0]!
    return { vault, path: preferred.path, exists: true }
  }

  const parentDir = documentPath ? dirname(documentPath) : contentRoot
  const absolute = await join(parentDir, withExt)
  return { vault, path: absolute, exists: false }
}

/**
 * Resolve a wikilink, then open the matching file. If the file does not
 * exist yet it is created (empty) in the resolved location.
 */
export async function openOrCreateWikilink(target: string, documentPath: string | null): Promise<void> {
  const resolved = await resolveWikilink(target, documentPath)
  if (!resolved) return

  const tabs = useTabsStore()
  if (resolved.exists) {
    await tabs.openFile(resolved.path)
    return
  }

  const editor = useEditorStore()
  const parentDir = dirname(resolved.path)
  const fileName = resolved.path.slice(parentDir.length + 1)
  await editor.createNote({
    vault: resolved.vault,
    fileName: fileStem(fileName),
    parentDir,
  })
}

function findNodesByBasename(nodes: FileNode[], name: string): FileNode[] {
  const wanted = name.toLowerCase()
  const wantedWithMd = wanted.endsWith('.md') ? wanted : `${wanted}.md`
  const wantedNoExt = wanted.endsWith('.md') ? wanted.slice(0, -3) : wanted
  const out: FileNode[] = []

  function walk(list: FileNode[]) {
    for (const node of list) {
      if (node.isDir) {
        if (node.children) walk(node.children)
        continue
      }
      const lower = node.name.toLowerCase()
      const stem = lower.endsWith('.md') ? lower.slice(0, -3) : lower
      if (lower === wanted || lower === wantedWithMd || stem === wantedNoExt) {
        out.push(node)
      }
    }
  }
  walk(nodes)
  return out
}

function findNodeByAbsolute(nodes: FileNode[], absolutePath: string): FileNode | null {
  for (const node of nodes) {
    if (!node.isDir && node.path === absolutePath) return node
    if (node.isDir && node.children) {
      const inner = findNodeByAbsolute(node.children, absolutePath)
      if (inner) return inner
    }
  }
  return null
}
