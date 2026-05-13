use std::{
    error::Error,
    fmt::{self, Display},
    fs::File,
    io::Write,
    path::Path,
};

#[derive(Debug)]
enum FileOpsError {
    MissingParent,
    Io(std::io::Error),
    Persist(tempfile::PersistError),
}

impl Display for FileOpsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingParent => write!(f, "target path has no parent directory"),
            Self::Io(source) => write!(f, "{source}"),
            Self::Persist(source) => write!(f, "{source}"),
        }
    }
}

impl Error for FileOpsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io(source) => Some(source),
            Self::Persist(source) => Some(source),
            Self::MissingParent => None,
        }
    }
}

impl From<std::io::Error> for FileOpsError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<tempfile::PersistError> for FileOpsError {
    fn from(value: tempfile::PersistError) -> Self {
        Self::Persist(value)
    }
}

fn sync_parent_dir(path: &Path) -> Result<(), std::io::Error> {
    #[cfg(unix)]
    {
        if let Some(parent) = path.parent() {
            File::open(parent)?.sync_all()?;
        }
    }
    Ok(())
}

fn write_text_atomic_impl(path: &Path, content: &str) -> Result<(), FileOpsError> {
    let parent = path.parent().ok_or(FileOpsError::MissingParent)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    temp.write_all(content.as_bytes())?;
    temp.as_file_mut().sync_all()?;
    temp.persist(path)?;
    sync_parent_dir(path)?;
    Ok(())
}

#[tauri::command]
pub fn write_text_atomic(path: String, content: String) -> Result<(), String> {
    write_text_atomic_impl(Path::new(&path), &content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_write_text_atomic_creates_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("note.md");

        write_text_atomic_impl(&path, "hello").unwrap();

        assert_eq!(fs::read_to_string(path).unwrap(), "hello");
    }

    #[test]
    fn test_write_text_atomic_replaces_existing_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("note.md");
        fs::write(&path, "old").unwrap();

        write_text_atomic_impl(&path, "new").unwrap();

        assert_eq!(fs::read_to_string(path).unwrap(), "new");
    }
}
