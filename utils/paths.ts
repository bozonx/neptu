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

export function relativePath(fromDir: string, toPath: string): string {
  const from = stripTrailingSlash(fromDir).replace(/\\/g, '/').split('/').filter(Boolean)
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
