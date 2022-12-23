use git2::Repository;

use crate::error::BackendError;

use super::model::git::Worktree;
use super::{with_backend, GitBackend, StateType};

#[tauri::command]
pub async fn get_worktrees(state: StateType<'_>) -> Result<Vec<Worktree>, BackendError> {
    with_backend(state, |backend| load_worktrees(backend)).await
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
                            .and_then(|c| Some(c.id().to_string())),
                        is_valid: wt.validate().is_ok(),
                    }
                })
            })
        })
        .map(|o| o.unwrap())
        .collect())
}
