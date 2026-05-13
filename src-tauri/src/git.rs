use git2::{
    Config, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks, Repository,
    Signature, StatusOptions,
};
use serde::Serialize;

#[derive(Serialize)]
pub struct GitStatus {
    pub dirty: bool,
    #[serde(rename = "changedFiles")]
    pub changed_files: u32,
}

#[derive(Serialize)]
pub struct GitAuthor {
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct CommitResult {
    pub committed: bool,
    pub oid: Option<String>,
    #[serde(rename = "changedFiles")]
    pub changed_files: u32,
}

fn setup_remote_callbacks() -> RemoteCallbacks<'static> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, allowed_types| {
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            return git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"));
        }
        git2::Cred::default()
    });
    callbacks
}

#[tauri::command]
pub fn git_is_repo(path: String) -> Result<bool, String> {
    match Repository::open(&path) {
        Ok(_) => Ok(true),
        Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(false),
        Err(e) => Err(format!("Failed to open repository at '{}': {}", path, e)),
    }
}

#[tauri::command]
pub fn git_init_repo(path: String) -> Result<(), String> {
    Repository::init(&path).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .exclude_submodules(true);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| e.to_string())?;
    let count = statuses.len() as u32;
    Ok(GitStatus {
        dirty: count > 0,
        changed_files: count,
    })
}

/// Reads `user.name` / `user.email` from git's global/system config.
/// Returns `None` for fields that are not set anywhere.
#[tauri::command]
pub fn git_global_author() -> Result<GitAuthor, String> {
    let cfg = Config::open_default()
        .map_err(|e| format!("Failed to open git config: {e}"))?;
    Ok(GitAuthor {
        name: cfg.get_string("user.name").ok(),
        email: cfg.get_string("user.email").ok(),
    })
}

/// Stages all changes (respecting `.gitignore`) and creates a commit.
/// Returns `committed: false` if the working tree matches HEAD.
#[tauri::command]
pub fn git_commit_all(
    path: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<CommitResult, String> {
    if author_name.trim().is_empty() || author_email.trim().is_empty() {
        return Err("Git author is not configured".into());
    }

    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    // Stage everything (respects .gitignore)
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit().map_err(|e| e.to_string())?),
        Err(_) => None,
    };

    // No-op if tree is identical to HEAD's tree
    if let Some(ref parent) = parent_commit {
        if parent.tree_id() == tree_oid {
            return Ok(CommitResult {
                committed: false,
                oid: None,
                changed_files: 0,
            });
        }
    }

    // Count files in the staged diff for the commit message / UI
    let parent_tree = parent_commit.as_ref().and_then(|c| c.tree().ok());
    let diff = repo
        .diff_tree_to_index(parent_tree.as_ref(), Some(&index), None)
        .map_err(|e| e.to_string())?;
    let changed_files = diff.deltas().count() as u32;

    let sig =
        Signature::now(&author_name, &author_email).map_err(|e| e.to_string())?;
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    Ok(CommitResult {
        committed: true,
        oid: Some(oid.to_string()),
        changed_files,
    })
}

/// Fast-forward pull from the default remote (`origin`).
/// Non-fast-forward merges are rejected so the user can resolve them manually.
#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("No remote 'origin' configured: {e}"))?;

    let callbacks = setup_remote_callbacks();
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)
        .map_err(|e| format!("Fetch failed: {e}"))?;

    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| format!("No FETCH_HEAD after fetch: {e}"))?;
    let fetch_commit = fetch_head.peel_to_commit().map_err(|e| e.to_string())?;
    let fetch_oid = fetch_commit.id();

    let mut head = repo.head().map_err(|e| e.to_string())?;
    let current_commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    if current_commit.id() == fetch_oid {
        return Ok("Already up to date".to_string());
    }

    let merge_base = repo.merge_base(current_commit.id(), fetch_oid)
        .map_err(|e| format!("Cannot determine merge base: {e}"))?;

    if merge_base != current_commit.id() {
        return Err(
            "Pull requires a non-fast-forward merge, which is not supported. \
             Please resolve manually.".to_string(),
        );
    }

    head.set_target(fetch_oid, "Fast-forward pull")
        .map_err(|e| e.to_string())?;

    Ok("Pulled successfully".to_string())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("No remote 'origin' configured: {e}"))?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let branch_name = head.shorthand().ok_or("Invalid branch name")?;
    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch_name);

    let callbacks = setup_remote_callbacks();
    let mut opts = PushOptions::new();
    opts.remote_callbacks(callbacks);

    remote.push(&[&refspec], Some(&mut opts))
        .map_err(|e| format!("Push failed: {e}"))?;

    Ok("Pushed successfully".to_string())
}

/// Returns a unified diff of the working tree against HEAD.
/// When `file_path` is provided only that file is diffed (absolute path).
#[tauri::command]
pub fn git_diff(path: String, file_path: Option<String>) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    let head_tree = match repo.head() {
        Ok(head) => Some(head.peel_to_tree().map_err(|e| e.to_string())?),
        Err(_) => None,
    };

    let mut opts = git2::DiffOptions::new();
    opts.include_untracked(true);
    if let Some(ref fp) = file_path {
        let repo_root = std::path::Path::new(&path);
        let file = std::path::Path::new(fp);
        let relative = file
            .strip_prefix(repo_root)
            .map_err(|e| format!("failed to relativize path: {}", e))?
            .to_string_lossy()
            .to_string();
        opts.pathspec(relative);
    }

    let diff = if let Some(ref tree) = head_tree {
        repo.diff_tree_to_workdir(Some(tree), Some(&mut opts))
    }
    else {
        repo.diff_tree_to_workdir(None, Some(&mut opts))
    }
    .map_err(|e| e.to_string())?;

    let mut buf = Vec::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        buf.extend_from_slice(line.content());
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&buf).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_git_is_repo_detects_git_directory() {
        let temp = tempfile::tempdir().unwrap();
        Repository::init(temp.path()).unwrap();
        assert!(git_is_repo(temp.path().to_string_lossy().to_string()).unwrap());
    }

    #[test]
    fn test_git_is_repo_returns_false_for_non_repo() {
        let temp = tempfile::tempdir().unwrap();
        assert!(!git_is_repo(temp.path().to_string_lossy().to_string()).unwrap());
    }

    #[test]
    fn test_git_init_repo_creates_repo() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        git_init_repo(path.clone()).unwrap();
        assert!(git_is_repo(path).unwrap());
    }

    #[test]
    fn test_git_status_counts_untracked() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        fs::write(temp.path().join("note.md"), "hello").unwrap();
        let status = git_status(path).unwrap();
        assert!(status.dirty);
        assert_eq!(status.changed_files, 1);
    }

    #[test]
    fn test_git_commit_all_creates_first_commit_on_empty_repo() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        // No HEAD yet — the commit will create the first one even with an empty tree.
        // This is expected git behaviour for a brand-new repository.
        let result = git_commit_all(
            path,
            "test".to_string(),
            "Test".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap();
        assert!(result.committed);
    }

    #[test]
    fn test_git_commit_all_stages_and_commits() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        fs::write(temp.path().join("note.md"), "hello").unwrap();
        let result = git_commit_all(
            path,
            "Initial commit".to_string(),
            "Test".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap();
        assert!(result.committed);
        assert_eq!(result.changed_files, 1);
        assert!(result.oid.is_some());
    }

    #[test]
    fn test_git_commit_all_is_idempotent() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        fs::write(temp.path().join("note.md"), "hello").unwrap();

        let first = git_commit_all(
            path.clone(),
            "Initial".to_string(),
            "Test".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap();
        assert!(first.committed);

        let second = git_commit_all(
            path,
            "Again".to_string(),
            "Test".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap();
        assert!(!second.committed);
        assert_eq!(second.changed_files, 0);
    }

    #[test]
    fn test_git_commit_all_rejects_empty_author() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        let err = git_commit_all(
            path,
            "test".to_string(),
            "".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap_err();
        assert!(err.contains("author"));
    }

    #[test]
    fn test_git_diff_empty_repo() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        let diff = git_diff(path, None).unwrap();
        assert!(diff.is_empty());
    }

    #[test]
    fn test_git_diff_shows_changes() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        fs::write(temp.path().join("note.md"), "hello").unwrap();
        git_commit_all(
            path.clone(),
            "Initial".to_string(),
            "Test".to_string(),
            "test@example.com".to_string(),
        )
        .unwrap();
        fs::write(temp.path().join("note.md"), "world").unwrap();
        let diff = git_diff(path, None).unwrap();
        assert!(diff.contains("world"));
    }
}
