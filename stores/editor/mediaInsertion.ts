import { isAudioFile, isImageFile, isVideoFile } from '~/utils/fileTypes'
import type { InsertTriggerPayload } from './types'

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

export function useEditorMediaInsertion(currentFilePath: Ref<string | null>) {
  const insertTrigger = ref<InsertTriggerPayload | null>(null)

  function insertText(
    path: string,
    text: string,
    options?: { coords?: { x: number, y: number }, replaceTarget?: 'media-at-coords' },
  ) {
    insertTrigger.value = { path, text, id: Date.now(), coords: options?.coords, replaceTarget: options?.replaceTarget }
  }

  function insertImportedFiles(
    files: Array<string | { path: string, markdownPath: string }>,
    targetPath = currentFilePath.value,
    options?: { coords?: { x: number, y: number }, replaceTarget?: 'media-at-coords' },
  ) {
    if (!targetPath) return

    let insertedText = ''
    for (const file of files) {
      const path = typeof file === 'string' ? file : file.path
      const markdownPath = typeof file === 'string' ? `./${basename(path)}` : file.markdownPath
      const name = path.split(/[/\\]/).pop() || ''
      if (isImageFile(path)) {
        insertedText += `\n![${name}](${markdownPath})\n`
      }
      else if (isVideoFile(path)) {
        insertedText += `\n[🎬 ${name}](${markdownPath})\n`
      }
      else if (isAudioFile(path)) {
        insertedText += `\n[🔊 ${name}](${markdownPath})\n`
      }
      else {
        insertedText += `\n[${name}](${markdownPath})\n`
      }
    }

    if (insertedText) {
      insertText(targetPath, insertedText.trim() + '\n', options)
    }
  }

  return {
    insertTrigger,
    insertText,
    insertImportedFiles,
  }
}
