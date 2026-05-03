export type EditorViewType
  = | 'markdown'
    | 'plain'
    | 'code'
    | 'image'
    | 'video'
    | 'audio'
    | 'vault-config'
    | 'unsupported'
    | 'virtual'

const IMAGE_EXTENSIONS = ['avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico']

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx']
const PLAIN_TEXT_EXTENSIONS = ['txt', 'log']
const CODE_EXTENSIONS_TO_LANG: Record<string, string> = {
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  vue: 'vue',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  rs: 'rust',
  toml: 'toml',
  xml: 'xml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  ini: 'ini',
  env: 'ini',
}

/**
 * Returns true when a file should be opened in the markdown editor.
 */
export function isMarkdownFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return MARKDOWN_EXTENSIONS.includes(ext)
}

export function isImageFile(filePath: string): boolean {
  const name = filePath.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) return false
  return IMAGE_EXTENSIONS.includes(name.substring(lastDot + 1).toLowerCase())
}

function getFileExtension(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return name.substring(lastDot + 1).toLowerCase()
}

/**
 * Returns the highlight.js / Shiki language id for a code file,
 * or `null` if the file is not classified as code.
 */
export function getCodeLanguage(filePath: string): string | null {
  const ext = getFileExtension(filePath)
  return CODE_EXTENSIONS_TO_LANG[ext] ?? null
}

export function getEditorViewType(filePath: string | null): EditorViewType {
  if (!filePath) return 'unsupported'

  // Handle virtual pages
  if (filePath.startsWith('neptu://')) {
    return 'virtual'
  }

  const name = filePath.split(/[/\\]/).pop() || ''
  const lowerName = name.toLowerCase()

  if (lowerName === '.neptu-vault.yaml' || lowerName === '.neptu-vault.yml') {
    return 'vault-config'
  }

  const ext = getFileExtension(filePath)
  if (!ext) {
    // No extension — treat as plain text by default.
    return 'plain'
  }

  if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown'
  if (PLAIN_TEXT_EXTENSIONS.includes(ext)) return 'plain'
  if (ext in CODE_EXTENSIONS_TO_LANG) return 'code'

  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'

  const videoExts = ['avi', 'mp4', 'mkv', 'webm', 'mov']
  if (videoExts.includes(ext)) return 'video'

  const audioExts = ['weba', 'mp3', 'aac', 'm4a', 'opus', 'wav', 'ogg']
  if (audioExts.includes(ext)) return 'audio'

  return 'unsupported'
}

/**
 * Returns true if the view type represents text content stored on disk
 * (i.e. a buffer needs to be loaded with `readText`).
 */
export function isTextViewType(viewType: EditorViewType): boolean {
  return viewType === 'markdown'
    || viewType === 'plain'
    || viewType === 'code'
    || viewType === 'vault-config'
}
