use std::fs;
use std::path::Path;

use git2::{Reference, Repository, WorktreeAddOptions};

use crate::error::BackendError;

use super::model::git::Worktree;
use super::{with_backend, GitBackend, StateType};

#[tauri::command]
pub async fn get_worktrees(state: StateType<'_>) -> Result<Vec<Worktree>, BackendError> {
    with_backend(state, load_worktrees).await
}

pub fn load_worktrees(backend: &GitBackend) -> Result<Vec<Worktree>, BackendError> {
    Ok(backend
        .repo
        .worktrees()?
        .iter()
        .filter_map(|name| {
            name.map(|n| {
                backend.repo.find_worktree(n).ok().map(|wt| {
                    let r = Repository::open_from_worktree(&wt);
                    Worktree {
                        name: wt.name().unwrap_or_default().to_string(),
                        path: wt.path().to_string_lossy().to_string(),
                        branch: r
                            .as_ref()
                            .ok()
                            .and_then(|rep| rep.head().ok())
                            .and_then(|h| h.name().map(|n| n.to_owned())),
                        oid: r
                            .as_ref()
                            .ok()
                            .and_then(|rep| rep.head().ok())
                            .and_then(|h| h.peel_to_commit().ok())
                            .map(|c| c.id().to_string()),
                        is_valid: wt.validate().is_ok(),
                    }
                })
            })
        })
        .map(|o| o.unwrap())
        .collect())
}

#[tauri::command]
pub async fn checkout_worktree(
    state: StateType<'_>,
    ref_name: &str,
    path: &str,
) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let reference = backend.repo.find_reference(ref_name)?;

        let mut options = WorktreeAddOptions::new();
        let target_path = Path::new(path);
        let name = target_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or(BackendError {
                message: "Could not derive worktree name from path".to_owned(),
            })?;
        log::debug!(
            "Creating worktree with name {} from {} at {}",
            ref_name,
            ref_name,
            path
        );
        options.reference(Some(&reference));
        if target_path.exists() {
            if fs::read_dir(target_path)
                .map(|d| d.count() != 0)
                .map_err(|e| BackendError {
                    message: format!("Could not read target directory. {}", e),
                })?
            {
                return Err(BackendError {
                    message: "Cannot create worktree in non-empty directory.".to_owned(),
                });
            }
            fs::remove_dir(target_path).map_err(|e| BackendError {message: format!("Could not remove and recreate target directory. {}", e)})?;
        }
        let worktree = backend.repo.worktree(name, target_path, Some(&options))?;
        let r = Repository::open_from_worktree(&worktree)?;
        r.checkout_head(None)?;
        Ok(())
    })
    .await
    .map_err(|e| {
        log::error!("Could not check out worktree {}", e.to_string());
        e
    })
}
