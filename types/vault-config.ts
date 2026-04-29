export type UploadMode = 'adjacent' | 'adjacent-folder' | 'global-folder'

export type ImageFormat = 'webp' | 'jpeg' | 'png' | 'avif'

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
  media?: MediaSettings
  schemas?: Schema[]
}

export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  version: 1,
}

/** Basic runtime validation for a parsed VaultConfig */
export function isValidVaultConfig(obj: unknown): obj is VaultConfig {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.version !== 'number') return false
  if (o.contentRoot !== undefined && typeof o.contentRoot !== 'string') return false
  if (o.media !== undefined && !isValidMediaSettings(o.media)) return false
  if (o.schemas !== undefined && !Array.isArray(o.schemas)) return false
  if (Array.isArray(o.schemas)) {
    for (const s of o.schemas) {
      if (!isValidSchema(s)) return false
    }
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
