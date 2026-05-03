import type { FileFilterSettings, ImageFormat, AutoConvertSettings } from './index'

export type { AutoConvertSettings }
export type { ImageFormat }

export type UploadMode = 'adjacent' | 'adjacent-folder' | 'global-folder'

export type MediaNamingMode = 'original' | 'document-index' | 'hash'

export interface CompressionSettings {
  enabled: boolean
  /** Max dimension for the larger side (width or height) */
  maxDimension?: number
  /** Quality 0.0 - 1.0 */
  quality?: number
  format?: ImageFormat
}

export interface MediaSettings {
  uploadMode: UploadMode
  /** Relative path inside vault when uploadMode is 'global-folder' */
  globalFolder?: string
  compression?: CompressionSettings
}

export interface MediaDirSettings {
  mode: UploadMode
  /** Relative path for global-folder, or subfolder name for adjacent-folder. */
  folder?: string
  naming: MediaNamingMode
}

export interface SelectOption {
  label: string
  value: string
}

export interface BaseFieldSchema {
  key: string
  label: string
  required?: boolean
  default?: unknown
}

export interface TextFieldSchema extends BaseFieldSchema {
  type: 'text'
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface TextareaFieldSchema extends BaseFieldSchema {
  type: 'textarea'
  minLength?: number
  maxLength?: number
  rows?: number
}

export interface NumberFieldSchema extends BaseFieldSchema {
  type: 'number'
  min?: number
  max?: number
  step?: number
  integer?: boolean
}

export interface SelectFieldSchema extends BaseFieldSchema {
  type: 'select'
  options: SelectOption[]
}

export interface MultiSelectFieldSchema extends BaseFieldSchema {
  type: 'multi-select'
  options: SelectOption[]
  minItems?: number
  maxItems?: number
}

export interface CheckboxFieldSchema extends BaseFieldSchema {
  type: 'checkbox'
}

export interface RadioFieldSchema extends BaseFieldSchema {
  type: 'radio'
  options: SelectOption[]
}

export interface ImageFieldSchema extends BaseFieldSchema {
  type: 'image'
  accept?: string[]
  maxSizeKb?: number
}

export interface FileFieldSchema extends BaseFieldSchema {
  type: 'file'
  accept?: string[]
  maxSizeKb?: number
}

export interface DateFieldSchema extends BaseFieldSchema {
  type: 'date'
  min?: string
  max?: string
}

export interface DateTimeFieldSchema extends BaseFieldSchema {
  type: 'datetime'
  min?: string
  max?: string
}

export type FieldSchema
  = | TextFieldSchema
    | TextareaFieldSchema
    | NumberFieldSchema
    | SelectFieldSchema
    | MultiSelectFieldSchema
    | CheckboxFieldSchema
    | RadioFieldSchema
    | ImageFieldSchema
    | FileFieldSchema
    | DateFieldSchema
    | DateTimeFieldSchema

export interface Schema {
  // Glob pattern relative to vault root, e.g. "src/**/*.md"
  glob: string
  fields: FieldSchema[]
}

export interface VaultConfig {
  version: number
  /** Relative folder inside the vault treated as content root (e.g. "src") */
  contentRoot?: string
  mediaDir?: MediaDirSettings
  media?: MediaSettings
  autoConvert?: AutoConvertSettings
  schemas?: Schema[]
  filters?: FileFilterSettings
  excludes?: string[]
}

export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  version: 1,
  mediaDir: {
    mode: 'adjacent-folder',
    folder: 'media',
    naming: 'original',
  },
}

export const SITE_VAULT_CONFIG: VaultConfig = {
  version: 1,
  contentRoot: 'src',
  mediaDir: {
    mode: 'global-folder',
    folder: 'src/public/media',
    naming: 'document-index',
  },
}

export const CUSTOM_VAULT_CONFIG: VaultConfig = {
  version: 1,
  mediaDir: {
    mode: 'adjacent-folder',
    folder: 'media',
    naming: 'original',
  },
}

export const BLOG_VAULT_CONFIG: VaultConfig = {
  version: 1,
  contentRoot: 'src',
  mediaDir: {
    mode: 'global-folder',
    folder: 'src/public/media',
    naming: 'document-index',
  },
  schemas: [
    {
      glob: 'src/post/**/*.md',
      fields: [
        { key: 'title', type: 'text', label: 'Title', required: true },
        { key: 'date', type: 'datetime', label: 'Publication date', required: true },
        { key: 'description', type: 'textarea', label: 'Description', required: false },
        { key: 'previewText', type: 'textarea', label: 'Replace text for preview', required: false },
        { key: 'descrAsPreview', type: 'checkbox', label: 'Use description as a preview', default: true },
        { key: 'canonical', type: 'text', label: 'Canonical URL', default: 'self', required: false },
        { key: 'jsonLd', type: 'textarea', label: 'JSON-LD in YAML format', required: false },
        { key: 'cover', type: 'image', label: 'Cover', required: false },
        { key: 'coverDescr', type: 'text', label: 'Cover description', required: false },
        { key: 'coverAlt', type: 'text', label: 'Cover alt text', required: false },
        { key: 'commentUrl', type: 'text', label: 'Comment URL', required: false },
        { key: 'authorId', type: 'select', label: 'Author', required: false, options: [{ label: 'Ivan K', value: 'ivan-k' }] },
        { key: 'videoLink', type: 'text', label: 'Video URL', required: false },
        { key: 'videoLinkLang', type: 'select', label: 'Video language', default: '', required: false, options: [{ label: 'Default', value: '' }, { label: 'Russian', value: 'RU' }, { label: 'English', value: 'EN' }] },
        { key: 'podcastCastbox', type: 'text', label: 'Podcast Castbox', required: false },
        { key: 'podcastSoundstream', type: 'text', label: 'Podcast Soundstream', required: false },
        { key: 'podcastSpotify', type: 'text', label: 'Podcast Spotify', required: false },
        { key: 'podcastVk', type: 'text', label: 'Podcast VK', required: false },
        { key: 'podcastYandexmusic', type: 'text', label: 'Podcast Yandex Music', required: false },
        { key: 'tags', type: 'text', label: 'Tags', required: false },
      ],
    },
  ],
}

/** Basic runtime validation for a parsed VaultConfig */
export function isValidVaultConfig(obj: unknown): obj is VaultConfig {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.version !== 'number') return false
  if (o.contentRoot !== undefined && typeof o.contentRoot !== 'string') return false
  if (o.mediaDir !== undefined && !isValidMediaDirSettings(o.mediaDir)) return false
  if (o.media !== undefined && !isValidMediaSettings(o.media)) return false
  if (o.autoConvert !== undefined && !isValidAutoConvertSettings(o.autoConvert)) return false
  if (o.schemas !== undefined && !Array.isArray(o.schemas)) return false
  if (Array.isArray(o.schemas)) {
    for (const s of o.schemas) {
      if (!isValidSchema(s)) return false
    }
  }
  if (o.filters !== undefined && !isValidFileFilterSettings(o.filters)) return false
  if (o.excludes !== undefined && !isValidExcludes(o.excludes)) return false
  return true
}

function isValidMediaDirSettings(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (!['adjacent', 'adjacent-folder', 'global-folder'].includes(o.mode as string)) return false
  if (o.folder !== undefined && typeof o.folder !== 'string') return false
  if (!['original', 'document-index', 'hash'].includes(o.naming as string)) return false
  return true
}

function isValidFileFilterSettings(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.groups)) return false
  for (const g of o.groups) {
    if (!g || typeof g !== 'object') return false
    const group = g as Record<string, unknown>
    if (typeof group.label !== 'string') return false
    if (typeof group.enabled !== 'boolean') return false
    if (typeof group.editable !== 'boolean') return false
    if (!Array.isArray(group.extensions)) return false
    for (const e of group.extensions) {
      if (!e || typeof e !== 'object') return false
      const ext = e as Record<string, unknown>
      if (typeof ext.ext !== 'string') return false
      if (typeof ext.enabled !== 'boolean') return false
    }
  }
  return true
}

function isValidExcludes(obj: unknown): boolean {
  if (!Array.isArray(obj)) return false
  for (const item of obj) {
    if (typeof item !== 'string') return false
  }
  return true
}

function isValidMediaSettings(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (!['adjacent', 'adjacent-folder', 'global-folder'].includes(o.uploadMode as string)) return false
  if (o.globalFolder !== undefined && typeof o.globalFolder !== 'string') return false
  if (o.compression !== undefined && !isValidCompressionSettings(o.compression)) return false
  return true
}

function isValidCompressionSettings(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return false
  if (o.maxDimension !== undefined && typeof o.maxDimension !== 'number') return false
  if (o.quality !== undefined && typeof o.quality !== 'number') return false
  if (o.format !== undefined && typeof o.format !== 'string') return false
  return true
}

function isValidAutoConvertSettings(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return false
  if (!['webp', 'jpeg', 'png'].includes(o.format as string)) return false
  if (o.quality !== undefined && typeof o.quality !== 'number') return false
  if (o.maxDimension !== undefined && typeof o.maxDimension !== 'number') return false
  if (o.backgroundColor !== undefined && typeof o.backgroundColor !== 'string') return false
  if (typeof o.preserveTransparency !== 'boolean') return false
  return true
}

function isValidSchema(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.glob !== 'string') return false
  if (!Array.isArray(o.fields)) return false
  for (const f of o.fields) {
    if (!isValidField(f)) return false
  }
  return true
}

function isValidField(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.key !== 'string') return false
  if (typeof o.label !== 'string') return false
  const type = o.type as string
  const validTypes = [
    'text', 'textarea', 'number', 'select', 'multi-select',
    'checkbox', 'radio', 'image', 'file', 'date', 'datetime',
  ]
  if (!validTypes.includes(type)) return false
  return true
}
