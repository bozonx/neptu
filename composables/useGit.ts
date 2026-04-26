import { invoke } from '@tauri-apps/api/core'
import type { CommitResult, GitAuthor, GitStatusInfo } from '~/types'

/**
 * Thin wrapper around the Rust-side git commands powered by `git2`.
 */
export function useGit() {
  function isRepo(path: string): Promise<boolean> {
    return invoke<boolean>('git_is_repo', { path })
  }

  function initRepo(path: string): Promise<void> {
    return invoke<void>('git_init_repo', { path })
  }

  function status(path: string): Promise<GitStatusInfo> {
    return invoke<GitStatusInfo>('git_status', { path })
  }

  function globalAuthor(): Promise<GitAuthor> {
    return invoke<GitAuthor>('git_global_author')
  }

  function commitAll(payload: {
    path: string
    message: string
    authorName: string
    authorEmail: string
  }): Promise<CommitResult> {
    return invoke<CommitResult>('git_commit_all', payload)
  }

  return {
    isRepo,
    initRepo,
    status,
    globalAuthor,
    commitAll,
  }
}
