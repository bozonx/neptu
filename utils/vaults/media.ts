import {
  convertImageBuffer,
  extensionForFormat,
  isImageFileName,
  mimeFromImageFileName,
  replaceExtension,
  type ConvertOptions,
} from '~/composables/useImageConvert'
import type { MediaDirSettings, Vault } from '~/types'
import type { AutoConvertSettings } from '~/types/vault-config'
import {
  basename,
  dirname,
  fileExt,
  fileStem,
  normalizeRelativePath,
  relativePath,
  stripTrailingSlash,
} from '~/utils/paths'

export type ConflictChoice = 'rename' | 'overwrite' | 'skip'
export type ConflictPolicy
  = | ConflictChoice
    | ((info: { name: string, existingPath: string }) => Promise<ConflictChoice>)

export function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'image/gif':
      return '.gif'
    case 'image/avif':
      return '.avif'
    case 'image/svg+xml':
      return '.svg'
    default:
      return ''
  }
}

export function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'media'
  )
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const data = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function writeConvertedImage(
  filePath: string,
  options: ConvertOptions,
): Promise<string> {
  const fs = useFs()
  const sourceBytes = await fs.readBytes(filePath)
  const { bytes, ext } = await convertImageBuffer(
    sourceBytes,
    mimeFromImageFileName(filePath),
    options,
  )

  const dir = filePath.includes('\\')
    ? filePath.slice(0, filePath.lastIndexOf('\\'))
    : filePath.slice(0, filePath.lastIndexOf('/'))
  const newName = replaceExtension(filePath.split(/[\\/]/).pop()!, ext)
  let newPath = await fs.join(dir, newName)

  let suffix = 2
  while (newPath !== filePath && (await fs.exists(newPath))) {
    const baseName = newName.slice(0, newName.lastIndexOf('.'))
    newPath = await fs.join(dir, `${baseName}-${suffix}${ext}`)
    suffix++
  }

  await fs.writeBytes(newPath, bytes)
  if (newPath !== filePath) {
    await fs.deleteFile(filePath)
  }
  return newPath
}

export async function applyAutoConvert(
  vault: Vault,
  filePath: string,
  getSettings: (vault: Vault) => AutoConvertSettings | undefined,
): Promise<string> {
  const settings = getSettings(vault)
  if (!settings?.enabled || !isImageFileName(filePath)) return filePath

  const ext = fileExt(filePath)
  if (ext === '.svg' || ext === '.gif') return filePath

  // Skip conversion when there is no resize and the format already matches.
  // This preserves EXIF and avoids a pointless re-encode.
  if (!settings.maxDimension && ext === extensionForFormat(settings.format)) {
    return filePath
  }

  try {
    return await writeConvertedImage(filePath, {
      format: settings.format,
      quality: settings.quality,
      maxDimension: settings.maxDimension,
      backgroundColor: settings.backgroundColor,
      preserveTransparency: settings.preserveTransparency,
    })
  }
  catch (error) {
    console.warn(
      '[vaults] Failed to auto-convert image, keeping original',
      filePath,
      error,
    )
    return filePath
  }
}

export async function resolveMediaDestination(
  vault: Vault,
  documentPath: string,
  sourceName: string,
  index: number,
  sourceBytes: Uint8Array | undefined,
  settings: MediaDirSettings,
  options?: { conflict?: ConflictChoice },
): Promise<{
  destPath: string
  markdownPath: string
  existed: boolean
} | null> {
  const fs = useFs()
  const documentDir = dirname(documentPath)
  const ext = fileExt(sourceName)
  const documentStem = sanitizeFilenamePart(fileStem(basename(documentPath)))

  let destDir = documentDir
  if (settings.mode === 'global-folder') {
    const folder = normalizeRelativePath(settings.folder || 'media')
    destDir = await fs.join(stripTrailingSlash(vault.path), folder)
  }
  else if (settings.mode === 'adjacent-folder') {
    const folder = sanitizeFilenamePart(settings.folder || 'media')
    destDir = await fs.join(documentDir, folder)
  }

  let baseName: string
  if (settings.naming === 'document-index') {
    baseName = `${documentStem}-${index + 1}`
  }
  else if (settings.naming === 'hash') {
    if (!sourceBytes)
      throw new Error('Source bytes are required for hash-based media naming')
    baseName = await hashBytes(sourceBytes)
  }
  else {
    baseName = sanitizeFilenamePart(fileStem(sourceName))
  }

  const initialPath = await fs.join(destDir, `${baseName}${ext}`)
  const existed = await fs.exists(initialPath)
  const policy = options?.conflict ?? 'rename'

  if (existed && policy === 'skip') return null
  if (existed && policy === 'overwrite') {
    return {
      destPath: initialPath,
      markdownPath: relativePath(documentDir, initialPath),
      existed,
    }
  }

  let candidate = initialPath
  let suffix = 2
  while (await fs.exists(candidate)) {
    candidate = await fs.join(destDir, `${baseName}-${suffix}${ext}`)
    suffix += 1
  }

  return {
    destPath: candidate,
    markdownPath: relativePath(documentDir, candidate),
    existed,
  }
}

export async function resolveConflictPolicy(
  vault: Vault,
  documentPath: string,
  sourceName: string,
  index: number,
  sourceBytes: Uint8Array | undefined,
  settings: MediaDirSettings,
  policy: ConflictPolicy | undefined,
): Promise<{ destPath: string, markdownPath: string } | null> {
  const probe = await resolveMediaDestination(
    vault,
    documentPath,
    sourceName,
    index,
    sourceBytes,
    settings,
    { conflict: 'rename' },
  )
  if (!probe) return null
  if (!probe.existed || !policy) return probe

  let choice: ConflictChoice
  if (typeof policy === 'function') {
    const initial = await resolveMediaDestination(
      vault,
      documentPath,
      sourceName,
      index,
      sourceBytes,
      settings,
      { conflict: 'overwrite' },
    )
    const existingPath = initial?.destPath ?? probe.destPath
    choice = await policy({ name: sourceName, existingPath })
  }
  else {
    choice = policy
  }

  if (choice === 'rename') return probe
  return resolveMediaDestination(
    vault,
    documentPath,
    sourceName,
    index,
    sourceBytes,
    settings,
    { conflict: choice },
  )
}

export function getVisibleImportIssue(
  importedPath: string,
  options: {
    showHidden: boolean
    filters: {
      groups: Array<{ enabled: boolean, extensions: Array<{ ext: string }> }>
    }
    excludes: string[]
  },
): string | null {
  const importedName = basename(importedPath)
  if (!options.showHidden && importedName.startsWith('.')) return importedName

  const extMatch = importedName.match(/\.([^.]+)$/)
  const ext = extMatch ? (extMatch[1]?.toLowerCase() ?? '') : ''
  const isExcluded = options.excludes.some((pattern) =>
    importedName.includes(pattern),
  )
  if (isExcluded) return importedName

  if (!ext) return null

  let matchesGroup = false
  let hasAnyEnabledGroup = false
  for (const group of options.filters.groups) {
    if (group.enabled) {
      hasAnyEnabledGroup = true
      if (group.extensions.some((e) => e.ext.toLowerCase() === ext)) {
        matchesGroup = true
        break
      }
    }
  }

  return hasAnyEnabledGroup && !matchesGroup ? importedName : null
}
