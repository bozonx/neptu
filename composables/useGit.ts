import { invoke } from '@tauri-apps/api/core'
import type { CommitResult, GitAuthor, GitStatusInfo } from '~/types'

/**
 * Thin wrapper around the Rust-side git commands powered by `git2`.
 */
export function useGit() {
  function isRepo(path: string): Promise<boolean> {
    return invoke<boolean>('git_is_repo', { path })
  }

  async function initRepo(path: string): Promise<void> {
    await invoke('git_init_repo', { path })
  }

  function status(path: string): Promise<GitStatusInfo> {
    return invoke<GitStatusInfo>('git_status', { path })
  }

  function globalAuthor(): Promise<GitAuthor> {
    return invoke<GitAuthor>('git_global_author')
  }

  function pull(path: string): Promise<string> {
    return invoke<string>('git_pull', { path })
  }

  function push(path: string): Promise<string> {
    return invoke<string>('git_push', { path })
  }

  function commitAll(payload: {
    path: string
    message: string
    authorName: string
    authorEmail: string
  }): Promise<CommitResult> {
    return invoke<CommitResult>('git_commit_all', payload)
  }

  function diff(path: string, filePath?: string): Promise<string> {
    return invoke<string>('git_diff', { path, filePath })
  }

  return {
    isRepo,
    initRepo,
    status,
    globalAuthor,
    pull,
    push,
    commitAll,
    diff,
  }
}
