import { InputRule, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { openOrCreateWikilink } from '~/composables/useWikilink'
import { parseWikilinkInner, wikilinkLabel } from '~/utils/wikilink'

interface WikilinkAttrs {
  target: string
  alias: string | null
  anchor: string | null
}

/**
 * Obsidian-style `[[target|alias]]` inline links.
 *
 * The node round-trips through markdown via a custom `marked` tokenizer:
 * - WYSIWYG mode renders an anchor chip whose label is the alias (or target).
 * - Source mode keeps the raw `[[...]]` syntax untouched (the textarea never
 *   sees the rendered node — it works against the buffer's markdown).
 *
 * Clicking a wikilink opens the target file in the active editor; if the
 * target does not exist yet an empty `.md` file is created in the resolved
 * location (same directory as the current document, or vault-relative when
 * the target contains a path separator).
 */
export const Wikilink = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addStorage() {
    return { documentPath: null as string | null }
  },

  addAttributes() {
    return {
      target: { default: '' },
      alias: { default: null as string | null },
      anchor: { default: null as string | null },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as WikilinkAttrs
    const label = wikilinkLabel(attrs)
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wikilink': 'true',
        'data-target': attrs.target,
        'data-alias': attrs.alias ?? '',
        'data-anchor': attrs.anchor ?? '',
        'href': '#',
        'class': 'neptu-wikilink',
      }),
      label,
    ]
  },

  markdownTokenName: 'wikilink',
  markdownTokenizer: {
    name: 'wikilink',
    level: 'inline',
    start: (src: string) => src.indexOf('[['),
    tokenize: (src: string) => {
      const match = /^\[\[([^[\]\n]+?)\]\]/.exec(src)
      if (!match) return undefined
      const parsed = parseWikilinkInner(match[1]!)
      if (!parsed.target) return undefined
      return {
        type: 'wikilink',
        raw: match[0],
        wikilinkTarget: parsed.target,
        wikilinkAlias: parsed.alias,
        wikilinkAnchor: parsed.anchor,
      }
    },
  },
  parseMarkdown(token: Record<string, unknown>) {
    return {
      type: 'wikilink',
      attrs: {
        target: (token.wikilinkTarget as string | undefined) ?? '',
        alias: (token.wikilinkAlias as string | null | undefined) ?? null,
        anchor: (token.wikilinkAnchor as string | null | undefined) ?? null,
      },
    }
  },
  renderMarkdown(node: { attrs?: Partial<WikilinkAttrs> }) {
    const target = node.attrs?.target ?? ''
    const alias = node.attrs?.alias ?? null
    const anchor = node.attrs?.anchor ?? null
    let inner = target
    if (anchor) inner += `#${anchor}`
    if (alias) inner += `|${alias}`
    return `[[${inner}]]`
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^[\]\n]+?)\]\]$/,
        handler: ({ chain, range, match }) => {
          const parsed = parseWikilinkInner(match[1] ?? '')
          if (!parsed.target) return
          chain()
            .deleteRange(range)
            .insertContent({
              type: 'wikilink',
              attrs: parsed,
            })
            .run()
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this
    return [
      new Plugin({
        key: new PluginKey('wikilink-click'),
        props: {
          handleClickOn(_view, _pos, node, _nodePos, event) {
            if (node.type.name !== 'wikilink') return false
            event.preventDefault()
            event.stopPropagation()
            const attrs = node.attrs as WikilinkAttrs
            if (!attrs.target) return true
            const documentPath = extension.storage.documentPath as string | null
            void openOrCreateWikilink(attrs.target, documentPath)
            return true
          },
        },
      }),
    ]
  },
})
