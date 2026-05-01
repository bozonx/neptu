export type EditorViewType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'vault-config'
  | 'unsupported'
  | 'virtual'

export function getEditorViewType(filePath: string | null): EditorViewType {
  if (!filePath) return 'unsupported'

  // Handle virtual pages
  if (filePath.startsWith('neptu://')) {
    return 'virtual'
  }

  const name = filePath.split(/[\/\\]/).pop() || ''
  const lowerName = name.toLowerCase()

  if (lowerName === '.neptu-vault.yaml' || lowerName === '.neptu-vault.yml') {
    return 'vault-config'
  }

  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) {
    // No extension, default to text or unsupported? Code editors usually treat no ext as text.
    return 'text'
  }

  const ext = lowerName.substring(lastDot + 1)

  const textExts = ['md', 'txt', 'yaml', 'yml', 'json', 'js', 'ts', 'vue', 'html', 'css', 'rs', 'toml']
  if (textExts.includes(ext)) return 'text'

  const imageExts = ['avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico']
  if (imageExts.includes(ext)) return 'image'

  const videoExts = ['avi', 'mp4', 'mkv', 'webm', 'mov']
  if (videoExts.includes(ext)) return 'video'

  const audioExts = ['weba', 'mp3', 'aac', 'm4a', 'opus', 'wav', 'ogg']
  if (audioExts.includes(ext)) return 'audio'

  // If it's a known code extension we missed, we might want a bigger list,
  // but for now, we can fallback to unsupported.
  // Actually, anything not explicitly matched could be text or unsupported.
  // For a robust editor, unknown extensions usually fallback to text or unsupported.
  // Let's fallback to unsupported and let the user handle it.
  return 'unsupported'
}
