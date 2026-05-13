import type { Editor } from '@tiptap/core'
import type { FileNode, Vault } from '~/types'
import { dirname, fileStem, relativePath } from '~/utils/paths'

export interface LinkSuggestionItem {
  /** File stem without extension (e.g. "Note") */
  stem: string
  /** Full file name with extension (e.g. "Note.md") */
  name: string
  /** Absolute path */
  path: string
  /** Vault-relative path with extension (e.g. "folder/Note.md") */
  vaultRelative: string
  /** Vault-relative path without extension (e.g. "folder/Note") */
  vaultRelativeStem: string
  /** Whether this is a markdown file (preferred for wikilinks) */
  isMarkdown: boolean
}

export interface LinkSuggestionContext {
  mode: 'wiki' | 'markdown'
  query: string
  displayText: string
  start: number
  end: number
}

interface FlattenContext {
  contentRoot: string
  out: LinkSuggestionItem[]
}

function pushNode(node: FileNode, ctx: FlattenContext) {
  if (node.isDir) {
    if (node.children) {
      for (const child of node.children) pushNode(child, ctx)
    }
    return
  }
  const isMarkdown = node.name.toLowerCase().endsWith('.md')
  const stem = fileStem(node.name)
  const rel = relativePath(ctx.contentRoot, node.path).replace(/^\.\//, '')
  const relStem = isMarkdown && rel.toLowerCase().endsWith('.md') ? rel.slice(0, -3) : rel
  ctx.out.push({
    stem,
    name: node.name,
    path: node.path,
    vaultRelative: rel,
    vaultRelativeStem: relStem,
    isMarkdown,
  })
}

/**
 * Flattens the file tree of the vault that owns `documentPath` into a list
 * of suggestion items used by the link autocomplete popup.
 */
export function listSuggestionFiles(documentPath: string | null): { vault: Vault | null, items: LinkSuggestionItem[] } {
  if (!documentPath) return { vault: null, items: [] }
  const vaultsStore = useVaultsStore()
  const vault = vaultsStore.findVaultForPath(documentPath)
  if (!vault) return { vault: null, items: [] }
  const tree = vaultsStore.trees[vault.id] ?? []
  const contentRoot = vaultsStore.getEffectiveContentRoot(vault)
  const ctx: FlattenContext = { contentRoot, out: [] }
  for (const node of tree) pushNode(node, ctx)
  return { vault, items: ctx.out }
}

/**
 * Score-based fuzzy filter. Prefers prefix matches on the stem, then
 * substring matches on the stem, then substring on the relative path.
 * Returns up to `limit` items, sorted best-first.
 */
export function filterSuggestions(
  items: LinkSuggestionItem[],
  query: string,
  options?: { documentPath?: string | null, mode?: 'wiki' | 'markdown', limit?: number },
): LinkSuggestionItem[] {
  const limit = options?.limit ?? 20
  const mode = options?.mode ?? 'wiki'
  const docDir = options?.documentPath ? dirname(options.documentPath) : null
  const q = query.trim().toLowerCase()

  const filtered = mode === 'wiki' ? items.filter((it) => it.isMarkdown) : items

  if (!q) {
    const sorted = [...filtered].sort((a, b) => {
      const sameDirA = docDir && dirname(a.path) === docDir ? 1 : 0
      const sameDirB = docDir && dirname(b.path) === docDir ? 1 : 0
      if (sameDirA !== sameDirB) return sameDirB - sameDirA
      return a.stem.localeCompare(b.stem)
    })
    return sorted.slice(0, limit)
  }

  const scored: Array<{ item: LinkSuggestionItem, score: number }> = []
  for (const item of filtered) {
    const stem = item.stem.toLowerCase()
    const rel = item.vaultRelativeStem.toLowerCase()
    let score = -1
    if (stem === q) score = 1000
    else if (stem.startsWith(q)) score = 800 - (stem.length - q.length)
    else if (stem.includes(q)) score = 500 - stem.indexOf(q)
    else if (rel.includes(q)) score = 200 - rel.indexOf(q)
    if (score < 0) continue
    if (docDir && dirname(item.path) === docDir) score += 50
    scored.push({ item, score })
  }
  scored.sort((a, b) => b.score - a.score || a.item.stem.localeCompare(b.item.stem))
  return scored.slice(0, limit).map((s) => s.item)
}

/**
 * Collect plain text and corresponding ProseMirror positions backward from
 * the cursor up to `maxChars`. Skips non-text inline atoms (e.g. existing
 * wikilinks) so only raw typed text is considered.
 */
function collectTextBeforeEditor(editor: Editor): { text: string, positions: number[] } {
  const { from } = editor.state.selection
  const $from = editor.state.doc.resolve(from)
  const blockStart = $from.start()
  const text: string[] = []
  const positions: number[] = []

  editor.state.doc.nodesBetween(blockStart, from, (node, pos) => {
    if (node.isText && node.text) {
      const sliceStart = Math.max(pos, blockStart)
      const sliceEnd = Math.min(pos + node.text.length, from)
      const slice = node.text.slice(sliceStart - pos, sliceEnd - pos)
      for (let i = 0; i < slice.length; i++) {
        text.push(slice[i]!)
        positions.push(sliceStart + i)
      }
    }
    else if (node.type.name === 'hardBreak') {
      text.push('\n')
      positions.push(pos)
    }
    return true
  })

  return { text: text.join(''), positions }
}

/**
 * Find link suggestion context in a TipTap editor (WYSIWYG mode).
 */
export function findEditorLinkContext(editor: Editor): LinkSuggestionContext | null {
  const { from } = editor.state.selection
  const { text, positions } = collectTextBeforeEditor(editor)

  const wikiMatch = text.match(/\[\[([^[\]\n]*)$/)
  if (wikiMatch) {
    const idx = text.length - wikiMatch[0].length
    const query = wikiMatch[1]!
    return {
      mode: 'wiki',
      query,
      displayText: query,
      start: positions[idx]!,
      end: from,
    }
  }

  const mdMatch = text.match(/\[([^[\]\n]*)\]\(([^)]*)$/)
  if (mdMatch) {
    const displayText = mdMatch[1]!
    const query = mdMatch[2]!
    const idx = text.length - mdMatch[0].length
    return {
      mode: 'markdown',
      query,
      displayText,
      start: positions[idx]!,
      end: from,
    }
  }

  return null
}

/**
 * Find link suggestion context in a plain text string (source mode).
 */
export function findLinkContextInText(text: string, cursorPos: number): LinkSuggestionContext | null {
  const textBefore = text.slice(0, cursorPos)

  const wikiMatch = textBefore.match(/\[\[([^[\]\n]*)$/)
  if (wikiMatch) {
    const query = wikiMatch[1]!
    const start = cursorPos - wikiMatch[0].length
    return {
      mode: 'wiki',
      query,
      displayText: query,
      start,
      end: cursorPos,
    }
  }

  const mdMatch = textBefore.match(/\[([^[\]\n]*)\]\(([^)]*)$/)
  if (mdMatch) {
    const displayText = mdMatch[1]!
    const query = mdMatch[2]!
    const start = cursorPos - mdMatch[0].length
    return {
      mode: 'markdown',
      query,
      displayText,
      start,
      end: cursorPos,
    }
  }

  return null
}
