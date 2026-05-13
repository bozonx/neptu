use git2::{
    Config, FetchOptions, IndexAddOption, Oid, PushOptions, RemoteCallbacks, Repository, Signature,
    StatusOptions,
};
use serde::Serialize;
use std::{
    error::Error,
    fmt::{self, Display},
    path::Path,
};

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

#[derive(Debug)]
enum GitError {
    AuthorNotConfigured,
    FailedToOpenRepository { path: String, source: git2::Error },
    GitConfigOpen(git2::Error),
    MissingOrigin(git2::Error),
    MissingFetchHead(git2::Error),
    FetchFailed(git2::Error),
    PushFailed(git2::Error),
    CannotDetermineMergeBase(git2::Error),
    InvalidBranchName,
    NonFastForwardPull,
    RelativizePath(std::path::StripPrefixError),
    Git(git2::Error),
}

impl Display for GitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AuthorNotConfigured => write!(f, "Git author is not configured"),
            Self::FailedToOpenRepository { path, source } => {
                write!(f, "Failed to open repository at '{}': {}", path, source)
            }
            Self::GitConfigOpen(source) => {
                write!(f, "Failed to open git config: {source}")
            }
            Self::MissingOrigin(source) => {
                write!(f, "No remote 'origin' configured: {source}")
            }
            Self::MissingFetchHead(source) => {
                write!(f, "No FETCH_HEAD after fetch: {source}")
            }
            Self::FetchFailed(source) => write!(f, "Fetch failed: {source}"),
            Self::PushFailed(source) => write!(f, "Push failed: {source}"),
            Self::CannotDetermineMergeBase(source) => {
                write!(f, "Cannot determine merge base: {source}")
            }
            Self::InvalidBranchName => write!(f, "Invalid branch name"),
            Self::NonFastForwardPull => write!(
                f,
                "Pull requires a non-fast-forward merge, which is not supported. \
                 Please resolve manually."
            ),
            Self::RelativizePath(source) => {
                write!(f, "failed to relativize path: {source}")
            }
            Self::Git(source) => write!(f, "{source}"),
        }
    }
}

impl Error for GitError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::FailedToOpenRepository { source, .. }
            | Self::GitConfigOpen(source)
            | Self::MissingOrigin(source)
            | Self::MissingFetchHead(source)
            | Self::FetchFailed(source)
            | Self::PushFailed(source)
            | Self::CannotDetermineMergeBase(source)
            | Self::Git(source) => Some(source),
            Self::RelativizePath(source) => Some(source),
            Self::AuthorNotConfigured | Self::InvalidBranchName | Self::NonFastForwardPull => None,
        }
    }
}

impl From<git2::Error> for GitError {
    fn from(value: git2::Error) -> Self {
        Self::Git(value)
    }
}

type GitResult<T> = Result<T, GitError>;

#[derive(Debug, PartialEq, Eq)]
enum PullAction {
    AlreadyUpToDate,
    FastForward,
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

fn validate_author(author_name: &str, author_email: &str) -> GitResult<()> {
    if author_name.trim().is_empty() || author_email.trim().is_empty() {
        return Err(GitError::AuthorNotConfigured);
    }

    Ok(())
}

fn author_from_config(cfg: &Config) -> GitAuthor {
    GitAuthor {
        name: cfg.get_string("user.name").ok(),
        email: cfg.get_string("user.email").ok(),
    }
}

fn push_refspec(branch_name: &str) -> String {
    format!("refs/heads/{0}:refs/heads/{0}", branch_name)
}

fn file_pathspec(repo_root: &Path, file_path: &Path) -> GitResult<String> {
    Ok(file_path
        .strip_prefix(repo_root)
        .map_err(GitError::RelativizePath)?
        .to_string_lossy()
        .to_string())
}

fn pull_action(
    current_oid: Oid,
    fetch_oid: Oid,
    merge_base_oid: Option<Oid>,
) -> GitResult<PullAction> {
    if current_oid == fetch_oid {
        return Ok(PullAction::AlreadyUpToDate);
    }

    if merge_base_oid != Some(current_oid) {
        return Err(GitError::NonFastForwardPull);
    }

    Ok(PullAction::FastForward)
}

fn git_init_repo_impl(path: &str) -> GitResult<()> {
    Repository::init(path).map(|_| ()).map_err(GitError::from)
}

fn git_status_impl(repo: &Repository) -> GitResult<GitStatus> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .exclude_submodules(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    let count = statuses.len() as u32;
    Ok(GitStatus {
        dirty: count > 0,
        changed_files: count,
    })
}

fn git_global_author_impl() -> GitResult<GitAuthor> {
    let cfg = Config::open_default().map_err(GitError::GitConfigOpen)?;
    Ok(author_from_config(&cfg))
}

fn git_commit_all_impl(
    repo: &Repository,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> GitResult<CommitResult> {
    validate_author(author_name, author_email)?;

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };

    if let Some(ref parent) = parent_commit {
        if parent.tree_id() == tree_oid {
            return Ok(CommitResult {
                committed: false,
                oid: None,
                changed_files: 0,
            });
        }
    }

    let parent_tree = parent_commit.as_ref().and_then(|c| c.tree().ok());
    let diff = repo.diff_tree_to_index(parent_tree.as_ref(), Some(&index), None)?;
    let changed_files = diff.deltas().count() as u32;

    let sig = Signature::now(author_name, author_email)?;
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;

    Ok(CommitResult {
        committed: true,
        oid: Some(oid.to_string()),
        changed_files,
    })
}

fn git_pull_impl(repo: &Repository) -> GitResult<String> {
    let mut remote = repo
        .find_remote("origin")
        .map_err(GitError::MissingOrigin)?;

    let callbacks = setup_remote_callbacks();
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    remote
        .fetch(&[] as &[&str], Some(&mut fetch_opts), None)
        .map_err(GitError::FetchFailed)?;

    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(GitError::MissingFetchHead)?;
    let fetch_commit = fetch_head.peel_to_commit()?;
    let fetch_oid = fetch_commit.id();

    let mut head = repo.head()?;
    let current_commit = head.peel_to_commit()?;
    let current_oid = current_commit.id();

    let merge_base = if current_oid == fetch_oid {
        None
    } else {
        Some(
            repo.merge_base(current_oid, fetch_oid)
                .map_err(GitError::CannotDetermineMergeBase)?,
        )
    };

    match pull_action(current_oid, fetch_oid, merge_base)? {
        PullAction::AlreadyUpToDate => Ok("Already up to date".to_string()),
        PullAction::FastForward => {
            head.set_target(fetch_oid, "Fast-forward pull")?;
            Ok("Pulled successfully".to_string())
        }
    }
}

fn git_push_impl(repo: &Repository) -> GitResult<String> {
    let mut remote = repo
        .find_remote("origin")
        .map_err(GitError::MissingOrigin)?;

    let head = repo.head()?;
    let branch_name = head.shorthand().ok_or(GitError::InvalidBranchName)?;
    let refspec = push_refspec(branch_name);

    let callbacks = setup_remote_callbacks();
    let mut opts = PushOptions::new();
    opts.remote_callbacks(callbacks);

    remote
        .push(&[&refspec], Some(&mut opts))
        .map_err(GitError::PushFailed)?;

    Ok("Pushed successfully".to_string())
}

fn git_diff_impl(
    repo: &Repository,
    repo_root: &Path,
    file_path: Option<&Path>,
) -> GitResult<String> {
    let head_tree = match repo.head() {
        Ok(head) => Some(head.peel_to_tree()?),
        Err(_) => None,
    };

    let mut opts = git2::DiffOptions::new();
    opts.include_untracked(true);
    if let Some(file) = file_path {
        opts.pathspec(file_pathspec(repo_root, file)?);
    }

    let diff = if let Some(ref tree) = head_tree {
        repo.diff_tree_to_workdir(Some(tree), Some(&mut opts))
    } else {
        repo.diff_tree_to_workdir(None, Some(&mut opts))
    }?;

    let mut buf = Vec::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        buf.extend_from_slice(line.content());
        true
    })?;

    Ok(String::from_utf8_lossy(&buf).to_string())
}

#[tauri::command]
pub fn git_is_repo(path: String) -> Result<bool, String> {
    match Repository::open(&path) {
        Ok(_) => Ok(true),
        Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(false),
        Err(source) => Err(GitError::FailedToOpenRepository { path, source }.to_string()),
    }
}

#[tauri::command]
pub fn git_init_repo(path: String) -> Result<(), String> {
    git_init_repo_impl(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    git_status_impl(&repo).map_err(|e| e.to_string())
}

/// Reads `user.name` / `user.email` from git's global/system config.
/// Returns `None` for fields that are not set anywhere.
#[tauri::command]
pub fn git_global_author() -> Result<GitAuthor, String> {
    git_global_author_impl().map_err(|e| e.to_string())
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
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    git_commit_all_impl(&repo, &message, &author_name, &author_email).map_err(|e| e.to_string())
}

/// Fast-forward pull from the default remote (`origin`).
/// Non-fast-forward merges are rejected so the user can resolve them manually.
#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    git_pull_impl(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    git_push_impl(&repo).map_err(|e| e.to_string())
}

/// Returns a unified diff of the working tree against HEAD.
/// When `file_path` is provided only that file is diffed (absolute path).
#[tauri::command]
pub fn git_diff(path: String, file_path: Option<String>) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let repo_root = Path::new(&path);
    let file_path = file_path.as_deref().map(Path::new);
    git_diff_impl(&repo, repo_root, file_path).map_err(|e| e.to_string())
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
