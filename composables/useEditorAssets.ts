import { convertFileSrc } from '@tauri-apps/api/core'
import { resolveAbsolutePath } from '~/utils/paths'

export function convertLocalFileSrc(path: string): string {
  try {
    return convertFileSrc(path)
  }
  catch {
    return path
  }
}

/**
 * Resolves an `src` / `href` value (possibly relative) found in a document
 * into a URL the WebView can load. External URLs and `data:` / `blob:` are
 * returned unchanged. For local paths we go through Tauri's asset protocol
 * via `convertFileSrc`.
 */
export function resolveAssetUrl(documentPath: string | null, src: string): string {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:')) return src
  if (/^[a-z]+:\/\//i.test(src)) return src
  if (!documentPath) return src

  const abs = resolveAbsolutePath(documentPath, src)
  if (!abs) return src
  return convertLocalFileSrc(abs)
}
