import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gitMock = vi.hoisted(() => ({
  status: vi.fn(),
  globalAuthor: vi.fn(),
  commitAll: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
}))

mockNuxtImport('useGit', () => {
  return () => gitMock
})

mockNuxtImport('useI18n', () => {
  return () => ({ t: (key: string) => key })
})

describe('git store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gitMock.globalAuthor.mockResolvedValue({ name: 'Test', email: 'test@example.com' })
    gitMock.status.mockResolvedValue({ dirty: true, changedFiles: 1 })
    gitMock.commitAll.mockResolvedValue({ committed: true, oid: 'abc', changedFiles: 1 })
    gitMock.pull.mockResolvedValue('Pulled successfully')
    gitMock.push.mockResolvedValue('Pushed successfully')

    const settings = useSettingsStore()
    settings.settings.defaultCommitMode = 'auto'
    settings.settings.gitAuthorName = 'Test'
    settings.settings.gitAuthorEmail = 'test@example.com'

    const vaults = useVaultsStore()
    vaults.list = [
      {
        id: 'vault-1',
        name: 'Notes',
        type: 'git',
        path: '/repo',
        git: { commitMode: 'respect_config' },
      },
    ]
  })

  it('auto-commits respect_config vaults when the global mode is auto', async () => {
    const git = useGitStore()

    await git.commitIfAuto('vault-1')

    expect(gitMock.commitAll).toHaveBeenCalledWith(expect.objectContaining({
      path: '/repo',
      authorName: 'Test',
      authorEmail: 'test@example.com',
    }))
    expect(git.status['vault-1']).toEqual({ dirty: false, changedFiles: 0 })
  })

  it('refreshes status without committing respect_config vaults when the global mode is manual', async () => {
    const settings = useSettingsStore()
    settings.settings.defaultCommitMode = 'manual'
    const git = useGitStore()

    await git.commitIfAuto('vault-1')

    expect(gitMock.commitAll).not.toHaveBeenCalled()
    expect(gitMock.status).toHaveBeenCalledWith('/repo')
    expect(git.status['vault-1']).toEqual({ dirty: true, changedFiles: 1 })
  })

  it('keeps the previous clean status when a refresh fails and records the error', async () => {
    const git = useGitStore()
    git.status['vault-1'] = { dirty: false, changedFiles: 0 }
    gitMock.status.mockRejectedValueOnce(new Error('missing repo'))

    await git.refreshStatus('vault-1')

    expect(git.status['vault-1']).toEqual({ dirty: false, changedFiles: 0 })
    expect(git.statusErrors['vault-1']).toBe('missing repo')
  })
})
