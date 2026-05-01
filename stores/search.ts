import { defineStore } from 'pinia'
import type { FileNode, Vault } from '~/types'

export interface SearchDoc {
  path: string
  name: string
  content: string
  vaultId: string
  vaultName: string
}

export interface SearchResult {
  doc: SearchDoc
  score: number
  nameMatch: boolean
  contentMatch: boolean
  snippets: string[]
}

/**
 * In-memory full-text search index across all vaults.
 * The index is built lazily when the search panel is first opened.
 */
export const useSearchStore = defineStore('search', () => {
  const docs = ref<Map<string, SearchDoc>>(new Map())
  const isIndexing = ref(false)
  const indexError = ref<string | null>(null)

  function getEnabledTextExtensions(): Set<string> {
    const exts = new Set<string>()
    for (const group of useVaultsStore().list) {
      const filters = group.filters
      if (!filters) continue
      for (const g of filters.groups) {
        if (!g.enabled) continue
        for (const e of g.extensions) {
          if (e.enabled) exts.add(e.ext.toLowerCase())
        }
      }
    }
    if (exts.size === 0) {
      exts.add('md')
      exts.add('txt')
      exts.add('yaml')
      exts.add('yml')
    }
    return exts
  }

  async function buildIndex() {
    if (isIndexing.value) return
    isIndexing.value = true
    indexError.value = null
    docs.value.clear()

    const vaults = useVaultsStore()
    const fs = useFs()
    const enabledExts = getEnabledTextExtensions()

    try {
      for (const vault of vaults.list) {
        const tree = vaults.trees[vault.id] ?? []
        await indexTree(vault, tree, fs, enabledExts)
      }
    }
    catch (error) {
      indexError.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      isIndexing.value = false
    }
  }

  async function indexTree(vault: Vault, nodes: FileNode[], fs: ReturnType<typeof useFs>, enabledExts: Set<string>) {
    for (const node of nodes) {
      if (node.isDir && node.children) {
        await indexTree(vault, node.children, fs, enabledExts)
      }
      else if (!node.isDir) {
        const ext = node.name.slice(node.name.lastIndexOf('.') + 1).toLowerCase()
        if (!enabledExts.has(ext)) continue

        try {
          const content = await fs.readText(node.path)
          docs.value.set(node.path, {
            path: node.path,
            name: node.name,
            content,
            vaultId: vault.id,
            vaultName: vault.name,
          })
        }
        catch {
          // Skip unreadable files
        }
      }
    }
  }

  function updateFile(path: string, content: string) {
    const vaults = useVaultsStore()
    const vault = vaults.findVaultForPath(path)
    if (!vault) return

    const existing = docs.value.get(path)
    if (existing) {
      existing.content = content
    }
    else {
      const name = path.split(/[\\/]/).pop() ?? path
      docs.value.set(path, {
        path,
        name,
        content,
        vaultId: vault.id,
        vaultName: vault.name,
      })
    }
  }

  function removeFile(path: string) {
    docs.value.delete(path)
  }

  function search(query: string): SearchResult[] {
    const q = query.toLowerCase().trim()
    if (!q) return []

    const terms = q.split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []

    const results: SearchResult[] = []

    for (const doc of docs.value.values()) {
      const nameLower = doc.name.toLowerCase()
      const contentLower = doc.content.toLowerCase()
      let score = 0
      let nameMatch = false
      let contentMatch = false
      let allMatch = true

      for (const term of terms) {
        const inName = nameLower.includes(term)
        const inContent = contentLower.includes(term)
        if (!inName && !inContent) {
          allMatch = false
          break
        }
        if (inName) {
          nameMatch = true
          score += term === nameLower ? 100 : 10
        }
        if (inContent) {
          contentMatch = true
          score += 1
        }
      }

      if (!allMatch) continue

      const snippets = extractSnippets(doc.content, terms)
      results.push({ doc, score, nameMatch, contentMatch, snippets })
    }

    results.sort((a, b) => b.score - a.score)
    return results
  }

  function extractSnippets(content: string, terms: string[], maxSnippets = 2): string[] {
    const snippets: string[] = []
    const usedRanges = new Set<string>()
    const context = 40
    const contentLower = content.toLowerCase()

    for (const term of terms) {
      let pos = 0
      while ((pos = contentLower.indexOf(term, pos)) !== -1) {
        const start = Math.max(0, pos - context)
        const end = Math.min(content.length, pos + term.length + context)
        const rangeKey = `${start}-${end}`
        if (usedRanges.has(rangeKey)) {
          pos += term.length
          continue
        }
        usedRanges.add(rangeKey)

        let snippet = content.slice(start, end)
        if (start > 0) snippet = '...' + snippet
        if (end < content.length) snippet = snippet + '...'
        snippets.push(snippet.trim())
        if (snippets.length >= maxSnippets) return snippets
        pos += term.length
      }
    }

    return snippets
  }

  return {
    docs,
    isIndexing,
    indexError,
    buildIndex,
    updateFile,
    removeFile,
    search,
  }
})
