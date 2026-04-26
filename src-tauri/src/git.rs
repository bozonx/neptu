use git2::{Config, IndexAddOption, Repository, Signature, StatusOptions};
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

#[derive(Serialize)]
pub struct CommitResult {
    pub committed: bool,
    pub oid: Option<String>,
    #[serde(rename = "changedFiles")]
    pub changed_files: u32,
}

#[tauri::command]
pub fn git_is_repo(path: String) -> bool {
    Repository::open(&path).is_ok()
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
pub fn git_global_author() -> GitAuthor {
    let cfg = match Config::open_default() {
        Ok(c) => c,
        Err(_) => {
            return GitAuthor {
                name: None,
                email: None,
            }
        }
    };
    GitAuthor {
        name: cfg.get_string("user.name").ok(),
        email: cfg.get_string("user.email").ok(),
    }
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

#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .arg("pull")
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git pull failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .arg("push")
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git push failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
