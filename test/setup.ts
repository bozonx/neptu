import { vi } from 'vitest'

vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/tmp/neptu-test-config'),
  basename: vi.fn(async (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? ''),
  dirname: vi.fn(async (path: string) => path.split(/[\\/]/).slice(0, -1).join('/') || '/'),
  join: vi.fn(async (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')),
  resolve: vi.fn(async (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => null),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  readFile: vi.fn(async () => new Uint8Array()),
  readTextFile: vi.fn(async () => {
    throw new Error('File does not exist')
  }),
  remove: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ isDirectory: false, isFile: true })),
  writeFile: vi.fn(async () => undefined),
  writeTextFile: vi.fn(async () => undefined),
}))

vi.mock('@tauri-apps/plugin-os', () => ({
  type: vi.fn(async () => 'linux'),
}))

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
