<script setup lang="ts">
import type { SearchDoc } from '~/stores/search'

interface Backlink {
  path: string
  name: string
  context: string[]
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function resolvePath(base: string, rel: string): string {
  const stack = base.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean)
  const parts = rel.replace(/\\/g, '/').split('/')
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      stack.pop()
    }
    else {
      stack.push(part)
    }
  }
  return stack.join('/')
}

function findBacklinks(targetPath: string, docs: Map<string, SearchDoc>): Backlink[] {
  const vaults = useVaultsStore()
  const targetVault = vaults.findVaultForPath(targetPath)
  if (!targetVault) return []

  const targetRoot = normalizePath(vaults.getEffectiveContentRoot(targetVault))
  const normTarget = normalizePath(targetPath)

  const results: Backlink[] = []

  for (const doc of docs.values()) {
    if (doc.path === targetPath) continue
    if (doc.vaultId !== targetVault.id) continue

    const content = doc.content
    let found = false
    const contextLines: string[] = []

    const normDocPath = normalizePath(doc.path)
    const sourceDir = normDocPath.substring(0, normDocPath.lastIndexOf('/') + 1)

    // Markdown links
    const mdRegex = /\[([^\]]*)\]\(([^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = mdRegex.exec(content)) !== null) {
      const link = m[2]!
      const lineStart = content.lastIndexOf('\n', m.index) + 1
      const lineEnd = content.indexOf('\n', m.index)
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)

      const resolved = normalizePath(resolvePath(sourceDir ?? '', link))
      const resolvedFromRoot = normalizePath(resolvePath(targetRoot ?? '', link))

      if (resolved === normTarget || resolvedFromRoot === normTarget) {
        found = true
        const trimmed = line.trim()
        if (contextLines.length < 2 && !contextLines.includes(trimmed)) {
          contextLines.push(trimmed)
        }
      }
    }

    // Wiki links
    const wikiRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
    while ((m = wikiRegex.exec(content)) !== null) {
      const link = m[1]!.trim()
      const lineStart = content.lastIndexOf('\n', m.index) + 1
      const lineEnd = content.indexOf('\n', m.index)
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)

      let resolved = normalizePath(resolvePath(targetRoot, link))
      if (!resolved.toLowerCase().endsWith('.md')) {
        resolved += '.md'
      }

      if (resolved === normTarget) {
        found = true
        const trimmed = line.trim()
        if (contextLines.length < 2 && !contextLines.includes(trimmed)) {
          contextLines.push(trimmed)
        }
      }
    }

    if (found) {
      results.push({
        path: doc.path,
        name: doc.name,
        context: contextLines,
      })
    }
  }

  return results
}

const editor = useEditorStore()
const search = useSearchStore()
const tabs = useTabsStore()

const backlinks = ref<Backlink[]>([])
const isLoading = ref(false)

async function computeBacklinks() {
  if (!editor.currentFilePath) {
    backlinks.value = []
    return
  }

  if (search.docs.size === 0 && !search.isIndexing) {
    await search.buildIndex()
  }

  if (search.docs.size === 0) {
    backlinks.value = []
    return
  }

  isLoading.value = true
  backlinks.value = findBacklinks(editor.currentFilePath, search.docs)
  isLoading.value = false
}

watch(() => editor.currentFilePath, computeBacklinks, { immediate: true })
watch(() => search.docs.size, () => {
  if (editor.currentFilePath) {
    void computeBacklinks()
  }
})

function openFile(path: string) {
  tabs.openFile(path).catch((error: unknown) => {
    console.error('Failed to open backlinked file', error)
  })
}
</script>

<template>
  <section>
    <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
      {{ $t('sidebar.backlinks') }}
    </h3>
    <div
      v-if="isLoading"
      class="text-xs text-muted italic px-2 py-8 text-center"
    >
      {{ $t('sidebar.loading') }}
    </div>
    <div
      v-else-if="backlinks.length === 0"
      class="text-xs text-muted italic px-2 py-8 text-center border-2 border-dashed border-default rounded-lg"
    >
      {{ $t('sidebar.noBacklinks') }}
    </div>
    <div
      v-else
      class="space-y-3"
    >
      <button
        v-for="link in backlinks"
        :key="link.path"
        class="w-full text-left px-2 py-1.5 rounded hover:bg-elevated text-xs transition-colors"
        @click="openFile(link.path)"
      >
        <div class="font-medium truncate">
          {{ link.name }}
        </div>
        <div
          v-for="(ctx, i) in link.context"
          :key="i"
          class="text-muted mt-1 truncate text-[11px] leading-relaxed"
        >
          {{ ctx }}
        </div>
      </button>
    </div>
  </section>
</template>
