import { load, dump } from 'js-yaml'
import type { Schema, VaultConfig } from '~/types/vault-config'
import { globToRegex } from '~/utils/glob'

export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown> | null
  body: string
  rawYaml: string | null
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const trimmed = content.replace(/^\ufeff/, '')
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, body: trimmed, rawYaml: null }
  }
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: null, body: trimmed, rawYaml: null }
  }
  const rawYaml = match[1]!
  const body = match[2]!
  try {
    const frontmatter = load(rawYaml) as Record<string, unknown> | null
    return { frontmatter: frontmatter ?? {}, body, rawYaml }
  }
  catch {
    return { frontmatter: null, body: trimmed, rawYaml: null }
  }
}

export function synthesizeFile(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const keys = Object.keys(frontmatter)
  if (keys.length === 0) {
    return body
  }
  const yaml = dump(frontmatter, { indent: 2, lineWidth: -1, sortKeys: true })
  return `---\n${yaml}---\n${body}`
}

export function findSchemaForFile(
  filePath: string,
  vaultPath: string,
  vaultConfig: VaultConfig | null | undefined,
): Schema | null {
  if (!vaultConfig?.schemas?.length) return null
  const base = vaultPath.replace(/[/\\]+$/, '')
  const rel = filePath.slice(base.length).replace(/^[/\\]/, '')
  for (const schema of vaultConfig.schemas) {
    const re = globToRegex(schema.glob)
    if (re.test(rel)) return schema
  }
  return null
}

export function splitFrontmatter(
  frontmatter: Record<string, unknown>,
  schema: Schema | null,
): {
  schemaValues: Record<string, unknown>
  extraFrontmatter: Record<string, unknown>
} {
  if (!schema) {
    return { schemaValues: {}, extraFrontmatter: { ...frontmatter } }
  }
  const schemaKeys = new Set(schema.fields.map((f: { key: string }) => f.key))
  const schemaValues: Record<string, unknown> = {}
  const extraFrontmatter: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (schemaKeys.has(key)) {
      schemaValues[key] = value
    }
    else {
      extraFrontmatter[key] = value
    }
  }
  return { schemaValues, extraFrontmatter }
}

export function useFrontmatter() {
  return {
    parseFrontmatter,
    synthesizeFile,
    findSchemaForFile,
    splitFrontmatter,
  }
}
