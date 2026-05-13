import type { SaveStatus } from '~/types'
import type { Schema } from '~/types/vault-config'

export interface EditorBuffer {
  content: string
  isDirty: boolean
  saveStatus: SaveStatus
  saveError: string | null
  openEpoch: number
  revision: number
  lastEditTimestamp: number
  frontmatter?: Record<string, unknown>
  extraFrontmatter?: Record<string, unknown>
  schema?: Schema | null
}

export interface InsertTriggerPayload {
  path: string
  text: string
  id: number
  coords?: { x: number, y: number }
  replaceTarget?: 'media-at-coords'
}
