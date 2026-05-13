export function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] ?? path
}

export function dirname(path: string): string {
  const norm = path.replace(/[/\\]+$/, '')
  const parts = norm.split(/[/\\]/)
  parts.pop()
  return parts.join('/') || '/'
}

export function stripTrailingSlash(path: string): string {
  return path.replace(/[/\\]+$/, '')
}

export function stripLeadingDot(name: string): string {
  return name.replace(/^\.+/, '')
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)
}

export function makePathRelativeToRoot(path: string, root: string): string {
  const normalizedRoot = stripTrailingSlash(root)
  const prefix = `${normalizedRoot}/`
  if (path === normalizedRoot) return '.'
  if (path.startsWith(prefix)) return path.slice(prefix.length)
  return path
}

export function makePathAbsoluteFromRoot(path: string, root: string): string {
  if (isAbsolutePath(path)) return path
  if (path === '.' || path === '') return root
  return `${stripTrailingSlash(root)}/${path.replace(/^[/\\]+/, '')}`
}

export function relativePath(fromDir: string, toPath: string): string {
  const from = stripTrailingSlash(fromDir)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  const to = toPath.replace(/\\/g, '/').split('/').filter(Boolean)
  while (from.length && to.length && from[0] === to[0]) {
    from.shift()
    to.shift()
  }
  const rel = [...from.map(() => '..'), ...to].join('/')
  if (!rel || rel.startsWith('../')) return rel
  return `./${rel}`
}

export function fileExt(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(lastDot).toLowerCase() : ''
}

export function normalizeRelativePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

/**
 * Resolve a (possibly relative) path against a document path.
 * Returns the absolute path. External URLs and absolute paths are returned as-is.
 */
export function fileStem(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

export function replacePathPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string {
  if (path === oldPrefix) return newPrefix

  const sep
    = oldPrefix.endsWith('/') || oldPrefix.endsWith('\\')
      ? oldPrefix
      : `${oldPrefix}/`
  if (!path.startsWith(sep)) return path

  const targetBase
    = newPrefix.endsWith('/') || newPrefix.endsWith('\\')
      ? newPrefix.slice(0, -1)
      : newPrefix
  return `${targetBase}/${path.slice(sep.length)}`
}

export function resolveAbsolutePath(
  documentPath: string,
  relOrAbs: string,
): string | null {
  if (!relOrAbs) return null
  if (
    /^[a-z]+:\/\//i.test(relOrAbs)
    || relOrAbs.startsWith('data:')
    || relOrAbs.startsWith('blob:')
  ) {
    return null
  }
  if (relOrAbs.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(relOrAbs)) {
    return relOrAbs.replace(/\\/g, '/')
  }

  const baseDir = stripTrailingSlash(dirname(documentPath)).replace(/\\/g, '/')
  const segments = baseDir.split('/').filter(Boolean)
  const isUnix = baseDir.startsWith('/')

  for (const part of relOrAbs.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      segments.pop()
      continue
    }
    segments.push(part)
  }
  return (isUnix ? '/' : '') + segments.join('/')
}
