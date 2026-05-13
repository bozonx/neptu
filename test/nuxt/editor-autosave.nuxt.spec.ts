import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorBuffer } from '~/stores/editor/types'
import type { Vault } from '~/types'

const fsMock = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

const gitMock = vi.hoisted(() => ({
  status: vi.fn(),
  commitAll: vi.fn(),
  globalAuthor: vi.fn(),
}))

mockNuxtImport('useFs', () => {
  return () => fsMock
})

mockNuxtImport('useGit', () => {
  return () => gitMock
})

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function tick() {
  await Promise.resolve()
  await Promise.resolve()
}

function makeBuffer(content = ''): EditorBuffer {
  return {
    content,
    isDirty: false,
    saveStatus: 'idle',
    saveError: null,
    openEpoch: Date.now(),
    revision: 0,
    lastEditTimestamp: Date.now(),
  }
}

function installVault(vault: Vault) {
  const vaults = useVaultsStore()
  vaults.list = [vault]
  return vault
}

describe('editor autosave', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fsMock.writeText.mockResolvedValue(undefined)
    gitMock.status.mockResolvedValue({ dirty: true, changedFiles: 1 })
    gitMock.commitAll.mockResolvedValue({ committed: true, oid: 'abc', changedFiles: 1 })
    gitMock.globalAuthor.mockResolvedValue({ name: 'Test User', email: 'test@example.com' })
  })

  it('keeps dirty and writes a second snapshot when content changes during an in-flight save', async () => {
    const path = '/vault/note.md'
    installVault({ id: 'v1', name: 'Vault', type: 'local', path: '/vault' })
    const editor = useEditorStore()
    editor.buffers[path] = makeBuffer('initial')

    const firstWrite = deferred()
    fsMock.writeText
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined)

    editor.setContent(path, 'first')
    const savePromise = editor.save(path)
    await tick()

    expect(fsMock.writeText).toHaveBeenCalledTimes(1)
    expect(fsMock.writeText).toHaveBeenNthCalledWith(1, path, 'first')

    editor.setContent(path, 'second')
    firstWrite.resolve()
    await savePromise

    expect(fsMock.writeText).toHaveBeenCalledTimes(2)
    expect(fsMock.writeText).toHaveBeenNthCalledWith(2, path, 'second')
    expect(editor.buffers[path]?.isDirty).toBe(false)
    expect(editor.buffers[path]?.content).toBe('second')
  })

  it('serializes overlapping save calls for the same file', async () => {
    const path = '/vault/note.md'
    installVault({ id: 'v1', name: 'Vault', type: 'local', path: '/vault' })
    const editor = useEditorStore()
    editor.buffers[path] = makeBuffer('initial')

    const firstWrite = deferred()
    fsMock.writeText
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined)

    editor.setContent(path, 'first')
    const firstSave = editor.save(path)
    await tick()

    const secondSave = editor.save(path)
    editor.setContent(path, 'second')
    await tick()

    expect(fsMock.writeText).toHaveBeenCalledTimes(1)

    firstWrite.resolve()
    await Promise.all([firstSave, secondSave])

    expect(fsMock.writeText).toHaveBeenCalledTimes(2)
    expect(fsMock.writeText).toHaveBeenNthCalledWith(1, path, 'first')
    expect(fsMock.writeText).toHaveBeenNthCalledWith(2, path, 'second')
    expect(editor.buffers[path]?.isDirty).toBe(false)
  })

  it('flushes dirty editor buffers before committing a git vault', async () => {
    const path = '/repo/note.md'
    const vault = installVault({
      id: 'git-vault',
      name: 'Repo',
      type: 'git',
      path: '/repo',
      git: { commitMode: 'auto' },
    })
    const settings = useSettingsStore()
    settings.settings.gitAuthorName = 'Test User'
    settings.settings.gitAuthorEmail = 'test@example.com'

    const editor = useEditorStore()
    editor.buffers[path] = makeBuffer('initial')
    editor.setContent(path, 'dirty before commit')

    await useGitStore().commit(vault.id)

    expect(fsMock.writeText).toHaveBeenCalledWith(path, 'dirty before commit')
    expect(gitMock.commitAll).toHaveBeenCalledWith(expect.objectContaining({
      path: vault.path,
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    }))
    expect(editor.buffers[path]?.isDirty).toBe(false)
  })
})
