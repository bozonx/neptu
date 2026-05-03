import type { ConvertibleImageFormat } from '~/types'

export interface ConvertOptions {
  format: ConvertibleImageFormat
  quality?: number
  maxDimension?: number
  backgroundColor?: string
  preserveTransparency: boolean
}

export function extensionForFormat(format: ConvertibleImageFormat): string {
  switch (format) {
    case 'webp': return '.webp'
    case 'jpeg': return '.jpg'
    case 'png': return '.png'
    default: return '.png'
  }
}

function mimeForFormat(format: ConvertibleImageFormat): string {
  switch (format) {
    case 'webp': return 'image/webp'
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    default: return 'image/png'
  }
}

export function mimeFromImageFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'svg':
      return 'image/svg+xml'
    default:
      return `image/${ext || 'png'}`
  }
}

function needsBackground(format: ConvertibleImageFormat, hasAlpha: boolean, preserveTransparency: boolean): boolean {
  if (!hasAlpha) return false
  // JPEG never supports transparency.
  if (format === 'jpeg') return true
  if (preserveTransparency) return false
  return true
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer.slice(0))
}

/**
 * Browser-side image conversion using Canvas API.
 * Returns the converted bytes and the new file extension.
 */
export async function convertImageBuffer(
  sourceBytes: Uint8Array,
  sourceMime: string,
  options: ConvertOptions,
): Promise<{ bytes: Uint8Array, ext: string }> {
  const blob = new Blob([new Uint8Array(sourceBytes)], { type: sourceMime || 'image/png' })
  const bitmap = await createImageBitmap(blob)

  let { width, height } = bitmap

  if (options.maxDimension && options.maxDimension > 0) {
    const max = Math.max(width, height)
    if (max > options.maxDimension) {
      const scale = options.maxDimension / max
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to get 2d context')

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = bitmap.width
  tempCanvas.height = bitmap.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) throw new Error('Failed to get temp context')
  tempCtx.drawImage(bitmap, 0, 0)
  const fullImageData = tempCtx.getImageData(0, 0, bitmap.width, bitmap.height)
  const hasAlpha = fullImageData.data.some((v, i) => i % 4 === 3 && v < 255)
  bitmap.close()

  const useBackground = needsBackground(options.format, hasAlpha, options.preserveTransparency)

  if (useBackground) {
    ctx.fillStyle = options.backgroundColor || '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.drawImage(tempCanvas, 0, 0, width, height)

  const mime = mimeForFormat(options.format)
  const quality = options.quality !== undefined
    ? Math.max(0, Math.min(1, options.quality))
    : undefined

  const resultBlob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality)
  })

  if (!resultBlob) throw new Error('Canvas toBlob returned null')

  const bytes = await blobToUint8Array(resultBlob)
  return { bytes, ext: extensionForFormat(options.format) }
}

export function replaceExtension(fileName: string, newExt: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot > 0) {
    return fileName.slice(0, lastDot) + newExt
  }
  return fileName + newExt
}

export function isImageFileName(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'svg'].includes(ext)
}
