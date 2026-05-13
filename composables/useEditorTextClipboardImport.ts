import { isImageFile } from '~/utils/fileTypes'

interface ClipboardMediaItem {
  name: string
  type?: string
  bytes: Uint8Array
}

export function useEditorTextClipboardImport(options: {
  getFilePath: () => string
}) {
  const editorStore = useEditorStore()
  const importHelper = useEditorImport()
  const { t } = useI18n()
  const toast = useToast()

  function clipboardImageName(file: File, index: number): string {
    if (file.name) return file.name
    switch (file.type) {
      case 'image/jpeg': return `clipboard-image-${index + 1}.jpg`
      case 'image/webp': return `clipboard-image-${index + 1}.webp`
      case 'image/gif': return `clipboard-image-${index + 1}.gif`
      case 'image/avif': return `clipboard-image-${index + 1}.avif`
      case 'image/svg+xml': return `clipboard-image-${index + 1}.svg`
      default: return `clipboard-image-${index + 1}.png`
    }
  }

  function clipboardHasImportableImages(event: ClipboardEvent): boolean {
    const hasImageFiles = Array.from(event.clipboardData?.files ?? [])
      .some((file) => file.type.startsWith('image/') || isImageFile(file.name))
    if (hasImageFiles) return true

    return /<img\b[^>]*\bsrc=["']data:image\//i.test(event.clipboardData?.getData('text/html') ?? '')
  }

  async function dataUrlToMediaItem(src: string, index: number): Promise<ClipboardMediaItem | null> {
    const match = src.match(/^data:([^;,]+)[^,]*,(.*)$/)
    if (!match) return null

    const response = await fetch(src)
    const type = match[1] ?? response.headers.get('content-type') ?? 'image/png'
    return {
      name: clipboardImageName(new File([], '', { type }), index),
      type,
      bytes: new Uint8Array(await response.arrayBuffer()),
    }
  }

  async function importClipboardImages(event: ClipboardEvent): Promise<boolean> {
    const filePath = options.getFilePath()
    if (!filePath) return false
    const files = Array.from(event.clipboardData?.files ?? [])
      .filter((file) => file.type.startsWith('image/') || isImageFile(file.name))

    const html = event.clipboardData?.getData('text/html') ?? ''
    if (files.length === 0 && !clipboardHasImportableImages(event)) return false

    event.preventDefault()
    event.stopPropagation()

    try {
      const items: ClipboardMediaItem[] = files.length > 0
        ? await Promise.all(files.map(async (file, index) => ({
            name: clipboardImageName(file, index),
            type: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })))
        : []

      if (items.length === 0) {
        const dataItems = await Promise.all(
          Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img[src^="data:image/"]'))
            .map((image, index) => dataUrlToMediaItem(image.getAttribute('src') ?? '', index)),
        )
        for (const item of dataItems) {
          if (item) items.push(item)
        }
      }

      const onConflict = importHelper.makeAskPolicy()
      const imported = await useVaultsStore().importMediaBytesForDocument(items, filePath, { onConflict })
      if (imported.length > 0) {
        editorStore.insertImportedFiles(imported, filePath)
        return true
      }
    }
    catch (error) {
      toast.add({
        title: t('toast.importFailed'),
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
      })
    }

    return true
  }

  return {
    clipboardHasImportableImages,
    importClipboardImages,
  }
}
