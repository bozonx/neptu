export function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  let regexStr = '^'
  for (const seg of segments) {
    if (regexStr !== '^') regexStr += '\\/'
    regexStr += seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^/]*').replace(/\\\?/g, '[^/]')
    // Support ** (any depth) — simplistic: replace ** with .* and remove extra escaping
  }
  // Naive ** support: re-relax after escaping
  regexStr = regexStr.replace(/\\\*\\\*/g, '.*')
  regexStr += '(/.*|$)'
  return new RegExp(regexStr)
}
