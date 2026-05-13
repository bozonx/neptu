import { describe, expect, it } from 'vitest'
import { formatWikilink, parseWikilinkInner, wikilinkLabel, WIKILINK_REGEX } from '../../utils/wikilink'

describe('wikilink parsing', () => {
  it('parses bare target', () => {
    expect(parseWikilinkInner('Note Name')).toEqual({
      target: 'Note Name',
      alias: null,
      anchor: null,
    })
  })

  it('parses target with alias', () => {
    expect(parseWikilinkInner('Note Name|Display')).toEqual({
      target: 'Note Name',
      alias: 'Display',
      anchor: null,
    })
  })

  it('parses target with anchor', () => {
    expect(parseWikilinkInner('Note#Section')).toEqual({
      target: 'Note',
      alias: null,
      anchor: 'Section',
    })
  })

  it('parses target with anchor and alias', () => {
    expect(parseWikilinkInner('Note#Section|Display')).toEqual({
      target: 'Note',
      alias: 'Display',
      anchor: 'Section',
    })
  })

  it('trims whitespace', () => {
    expect(parseWikilinkInner('  Note  |  Alias  ')).toEqual({
      target: 'Note',
      alias: 'Alias',
      anchor: null,
    })
  })

  it('round-trips with formatWikilink', () => {
    const parsed = parseWikilinkInner('folder/Note#h1|Label')
    expect(formatWikilink(parsed)).toBe('[[folder/Note#h1|Label]]')
  })

  it('produces display label', () => {
    expect(wikilinkLabel({ target: 'Note', alias: null, anchor: null })).toBe('Note')
    expect(wikilinkLabel({ target: 'Note', alias: null, anchor: 'h1' })).toBe('Note#h1')
    expect(wikilinkLabel({ target: 'Note', alias: 'X', anchor: 'h1' })).toBe('X')
  })

  it('matches multiple wikilinks via regex', () => {
    const text = 'See [[One]] and [[Two|2]] but not [single] or [[bad'
    const matches = Array.from(text.matchAll(WIKILINK_REGEX)).map((m) => m[1])
    expect(matches).toEqual(['One', 'Two|2'])
  })
})
