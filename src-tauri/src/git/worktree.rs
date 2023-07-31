use std::fs;
use std::path::Path;

use git2::{Repository, WorktreeAddOptions};

use crate::error::{BackendError, DefaultResult, LoggingDefaultUnwrapper, Result};

use super::model::git::Worktree;
use super::{with_backend, GitBackend, StateType};

#[tauri::command]
pub async fn get_worktrees(state: StateType<'_>) -> Result<Vec<Worktree>> {
    with_backend(state, load_worktrees).await
}

fn map_worktree(repo: &Repository, name: &str) -> Result<Worktree> {
    let wt = repo.find_worktree(name)?;
    let wt_instance = Repository::open_from_worktree(&wt)?;
    let wt_head = wt_instance.head()?;
    let wt_head_commit = wt_head.peel_to_commit()?.id().to_string();
    let wt_branch = wt_head.name().map(|n| n.to_string());
    Ok(Worktree {
        name: wt.name().map(|n| n.to_string()),
        path: wt
            .path()
            .to_str()
            .map(|n| n.to_string())
            .ok_or_else(|| BackendError::new("Worktree does not have a path assigned."))?,
        branch: wt_branch,
        oid: Some(wt_head_commit),
        is_valid: wt.validate().is_ok(),
    })
}

pub fn load_worktrees(backend: &GitBackend) -> Result<Vec<Worktree>> {
    Ok(backend
        .repo
        .worktrees()?
        .iter()
        .filter_map(|name| {
            name.and_then(|n| {
                map_worktree(&backend.repo, n).ok_or_log("Could not map worktree info")
            })
        })
        .collect())
}

#[tauri::command]
pub async fn checkout_worktree(state: StateType<'_>, ref_name: &str, path: &str) -> DefaultResult {
    with_backend(state, |backend| {
        let reference = backend.repo.find_reference(ref_name)?;

        let mut options = WorktreeAddOptions::new();
        let target_path = Path::new(path);
        let name = target_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or(BackendError::new(
                "Could not derive worktree name from path",
            ))?;
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
                .map_err(|e| BackendError::new(format!("Could not read target directory. {}", e)))?
            {
                return Err(BackendError::new(
                    "Cannot create worktree in non-empty directory.",
                ));
            }
            fs::remove_dir(target_path).map_err(|e| {
                BackendError::new(format!(
                    "Could not remove and recreate target directory. {}",
                    e
                ))
            })?;
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
