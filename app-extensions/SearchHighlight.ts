import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SearchOptions {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  activeIndex: number
}

export interface SearchMatch {
  from: number
  to: number
}

const KEY = new PluginKey<SearchState>('neptuSearch')

interface SearchState {
  matches: SearchMatch[]
  activeIndex: number
  decorations: DecorationSet
}

const EMPTY_STATE: SearchState = {
  matches: [],
  activeIndex: -1,
  decorations: DecorationSet.empty,
}

function buildRegex(options: SearchOptions): RegExp | null {
  const { query, caseSensitive, wholeWord, regex } = options
  if (!query) return null
  const flags = caseSensitive ? 'g' : 'gi'
  try {
    if (regex) return new RegExp(query, flags)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = wholeWord ? `\\b${escaped}\\b` : escaped
    return new RegExp(pattern, flags)
  }
  catch {
    return null
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    neptuSearch: {
      setSearchQuery: (options: SearchOptions) => ReturnType
      setActiveSearchIndex: (index: number) => ReturnType
      clearSearch: () => ReturnType
      replaceCurrentMatch: (replacement: string) => ReturnType
      replaceAllMatches: (replacement: string) => ReturnType
    }
  }
}

/**
 * Highlights all occurrences of a query string and tracks the active match
 * index. Replace operations work on the plain document text, so they keep
 * existing marks/nodes intact for non-overlapping matches.
 */
export const SearchHighlight = Extension.create({
  name: 'neptuSearch',

  addStorage() {
    return {
      options: {
        query: '',
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        activeIndex: 0,
      } as SearchOptions,
      matches: [] as SearchMatch[],
    }
  },

  addCommands() {
    return {
      setSearchQuery: (options) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(KEY, { type: 'set', options })
          dispatch(tr)
        }
        return true
      },
      setActiveSearchIndex: (index) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(KEY, { type: 'index', index })
          dispatch(tr)
        }
        return true
      },
      clearSearch: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(KEY, { type: 'clear' })
          dispatch(tr)
        }
        return true
      },
      replaceCurrentMatch: (replacement) => ({ state, dispatch }) => {
        const search = KEY.getState(state)
        if (!search || search.matches.length === 0) return false
        const match = search.matches[search.activeIndex] ?? search.matches[0]
        if (!match) return false
        if (dispatch) {
          const tr = state.tr.insertText(replacement, match.from, match.to)
          dispatch(tr)
        }
        return true
      },
      replaceAllMatches: (replacement) => ({ state, dispatch }) => {
        const search = KEY.getState(state)
        if (!search || search.matches.length === 0) return false
        if (dispatch) {
          const tr = state.tr
          // Walk backwards so earlier ranges stay valid.
          for (let i = search.matches.length - 1; i >= 0; i--) {
            const match = search.matches[i]!
            tr.insertText(replacement, match.from, match.to)
          }
          dispatch(tr)
        }
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this
    return [
      new Plugin<SearchState>({
        key: KEY,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, prev) {
            const meta = tr.getMeta(KEY) as { type: string, options?: SearchOptions, index?: number } | undefined
            let state = prev
            let options = extension.storage.options as SearchOptions

            if (meta?.type === 'clear') {
              extension.storage.options = { ...options, query: '' }
              extension.storage.matches = []
              return EMPTY_STATE
            }
            if (meta?.type === 'set' && meta.options) {
              options = meta.options
              extension.storage.options = options
            }
            if (meta?.type === 'index' && typeof meta.index === 'number') {
              state = { ...prev, activeIndex: meta.index }
            }

            const docChanged = tr.docChanged
            const optionsChanged = meta?.type === 'set'
            if (!docChanged && !optionsChanged && meta?.type !== 'index') return prev

            const regex = buildRegex(options)
            if (!regex) {
              extension.storage.matches = []
              return EMPTY_STATE
            }

            const matches: SearchMatch[] = []
            tr.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              regex.lastIndex = 0
              let m: RegExpExecArray | null
              while ((m = regex.exec(node.text))) {
                if (m[0].length === 0) {
                  regex.lastIndex += 1
                  continue
                }
                matches.push({ from: pos + m.index, to: pos + m.index + m[0].length })
              }
            })

            extension.storage.matches = matches

            const activeIndex = matches.length === 0
              ? -1
              : Math.max(0, Math.min(state.activeIndex < 0 ? 0 : state.activeIndex, matches.length - 1))

            const decorations = DecorationSet.create(tr.doc, matches.map((match, i) => Decoration.inline(match.from, match.to, {
              class: i === activeIndex ? 'neptu-search-match neptu-search-match-active' : 'neptu-search-match',
            })))

            return { matches, activeIndex, decorations }
          },
        },
        props: {
          decorations(state) {
            return KEY.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

export function getSearchState(editorState: import('@tiptap/pm/state').EditorState): SearchState | null {
  return KEY.getState(editorState) ?? null
}
