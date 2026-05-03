import { createHighlighter, type BundledLanguage, type BundledTheme } from 'shiki'

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

const COMMON_LANGS: BundledLanguage[] = [
  'javascript',
  'typescript',
  'vue',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'toml',
  'rust',
  'python',
  'bash',
  'sql',
  'xml',
  'ini',
  'markdown',
  'dockerfile',
  'go',
  'java',
  'c',
  'cpp',
  'jsx',
  'tsx',
]

const THEMES: BundledTheme[] = ['github-light', 'github-dark']

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: THEMES,
      langs: COMMON_LANGS,
    })
  }
  return highlighterPromise
}

export interface ShikiHighlightOptions {
  code: string
  lang: string
  theme: 'light' | 'dark'
}

export async function highlightCode(options: ShikiHighlightOptions): Promise<string> {
  const shiki = await getHighlighter()
  const theme = options.theme === 'dark' ? 'github-dark' : 'github-light'
  return shiki.codeToHtml(options.code, {
    lang: options.lang as BundledLanguage,
    theme,
  })
}

export function useShiki() {
  return { highlightCode }
}
