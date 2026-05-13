export interface ParsedWikilink {
  target: string
  alias: string | null
  anchor: string | null
}

/**
 * Matches an Obsidian-style wikilink `[[target|alias]]` on a single line.
 * The inner part may not contain `[`, `]` or newlines.
 */
export const WIKILINK_REGEX = /\[\[([^[\]\n]+?)\]\]/g

export function parseWikilinkInner(inner: string): ParsedWikilink {
  const raw = inner.trim()
  if (!raw) return { target: '', alias: null, anchor: null }

  const pipeIdx = raw.indexOf('|')
  const targetPart = pipeIdx === -1 ? raw : raw.slice(0, pipeIdx).trim()
  const alias = pipeIdx === -1 ? null : raw.slice(pipeIdx + 1).trim() || null

  const hashIdx = targetPart.indexOf('#')
  const target = hashIdx === -1 ? targetPart : targetPart.slice(0, hashIdx).trim()
  const anchor = hashIdx === -1 ? null : targetPart.slice(hashIdx + 1).trim() || null

  return { target, alias, anchor }
}

export function formatWikilink(parsed: ParsedWikilink): string {
  let inner = parsed.target
  if (parsed.anchor) inner += `#${parsed.anchor}`
  if (parsed.alias) inner += `|${parsed.alias}`
  return `[[${inner}]]`
}

/**
 * Display label for a wikilink:
 *   - alias if provided
 *   - else `target#anchor` if anchor is present
 *   - else target
 */
export function wikilinkLabel(parsed: ParsedWikilink): string {
  if (parsed.alias) return parsed.alias
  if (parsed.anchor) return `${parsed.target}#${parsed.anchor}`
  return parsed.target
}
