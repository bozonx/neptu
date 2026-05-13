import { describe, expect, it } from 'vitest'
import {
  makePathAbsoluteFromRoot,
  makePathRelativeToRoot,
  normalizeRelativePath,
  resolveAbsolutePath,
} from '../../utils/paths'

describe('path utilities', () => {
  it('converts paths between absolute and root-relative forms', () => {
    expect(makePathRelativeToRoot('/vault/notes/today.md', '/vault')).toBe('notes/today.md')
    expect(makePathRelativeToRoot('/vault', '/vault')).toBe('.')
    expect(makePathAbsoluteFromRoot('notes/today.md', '/vault')).toBe('/vault/notes/today.md')
    expect(makePathAbsoluteFromRoot('.', '/vault')).toBe('/vault')
  })

  it('normalizes relative paths for persisted settings', () => {
    expect(normalizeRelativePath(' \\notes\\daily\\ ')).toBe('notes/daily')
    expect(normalizeRelativePath('/notes/daily/')).toBe('notes/daily')
  })

  it('resolves document-relative asset paths and ignores external URLs', () => {
    expect(resolveAbsolutePath('/vault/notes/today.md', '../media/image.png')).toBe('/vault/media/image.png')
    expect(resolveAbsolutePath('/vault/notes/today.md', 'https://example.test/image.png')).toBeNull()
  })
})
