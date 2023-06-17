use std::path::Path;

use git2::{build::CheckoutBuilder, RepositoryState, Status};
use log::{debug, error};
use serde::Deserialize;
use tauri::Window;

use crate::{
    error::{BackendError, DefaultResult, Result},
    window_events::{TypedEmit, WindowEvents},
};

use super::{
    git_merge_file::get_merge_conflict,
    history::{do_get_graph, load_history},
    model::{graph::GraphChangeData, index::IndexStatus},
    with_backend, with_backend_mut, GitBackend, StateType,
};

#[tauri::command]
pub async fn get_status(state: StateType<'_>) -> Result<Vec<IndexStatus>> {
    with_backend(state, |backend| {
        let statuses = backend.repo.statuses(None)?;

        let mut output = Vec::new();
        for status in statuses.iter() {
            if !status.status().is_ignored() {
                output.push(IndexStatus::try_from(status)?);
            }
        }

        Ok(output)
    })
    .await
}

#[tauri::command]
pub async fn stage(window: Window, state: StateType<'_>, path: &str) -> DefaultResult {
    with_backend(state, |backend| {
        do_stage(&backend.repo, path)?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

pub fn do_stage(repo: &git2::Repository, path: &str) -> DefaultResult {
    let mut index = repo.index()?;
    index.add_all([path], git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

#[tauri::command]
pub async fn unstage(window: Window, state: StateType<'_>, path: &str) -> DefaultResult {
    with_backend(state, |backend| {
        let head = backend.repo.head()?.peel_to_commit()?;
        log::debug!("Unstaging {}", path);
        backend
            .repo
            .reset_default(Some(&head.into_object()), [path])?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn commit(
    window: Window,
    state: StateType<'_>,
    message: &str,
    amend: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        do_commit(backend, window, message, amend, vec![])
    })
    .await
    .map_err(|e| {
        // TODO replace this with .inspect_err() as it becomes stable
        error!("Could not commit. {}", e);
        e
    })
}

pub fn do_commit(
    backend: &mut GitBackend,
    window: Window,
    message: &str,
    amend: bool,
    merge_parents: Vec<git2::Oid>,
) -> DefaultResult {
    let tree_id = backend.repo.index()?.write_tree()?;
    {
        backend.repo.index()?.write()?;

        let tree = backend.repo.find_tree(tree_id)?;
        let head = backend.repo.head().and_then(|h| h.peel_to_commit())?;
        let signature = backend.repo.signature()?;
        if amend {
            let amended = head.amend(Some("HEAD"), None, None, None, Some(message), Some(&tree))?;
            debug!("Amended commit {:?}->{:?}", head, amended);
        } else {
            let mut parents = vec![head];
            let additional_parent_commits: std::result::Result<Vec<git2::Commit>, git2::Error> =
                merge_parents
                    .iter()
                    .map(|id| backend.repo.find_commit(*id))
                    .collect();
            parents.extend(additional_parent_commits?);
            if backend.repo.state() == RepositoryState::Merge {
                let mut repo = git2::Repository::open(backend.repo.path())?;
                repo.mergehead_foreach(|head| {
                    let commit = backend.repo.find_commit(*head);
                    if let Ok(commit) = commit {
                        parents.push(commit);
                        true
                    } else {
                        false
                    }
                })?;
            }
            let parent_refs: Vec<&git2::Commit> = parents.iter().collect(); // the call below expects references to the commits, which is a bit complicated with the owned commits above

            let oid = backend.repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &parent_refs,
            )?;

            if backend.repo.state() == git2::RepositoryState::Merge
                && !backend.repo.index()?.has_conflicts()
            {
                backend.repo.cleanup_state()?;
                window.typed_emit(WindowEvents::RepoStateChanged, ())?;
            }
            debug!("Committed {}", oid);
        }
    }
    load_history(&backend.repo, None)?;
    window.typed_emit(WindowEvents::StatusChanged, ())?;
    window.typed_emit(WindowEvents::BranchesChanged, ())?;
    // TODO this repeats code from git_open -> don't like this current setup
    backend.graph = do_get_graph(backend, None)?;
    window.typed_emit(
        WindowEvents::HistoryChanged,
        GraphChangeData {
            total: backend.graph.lines.len(),
            change_end_idx: 0,
            change_start_idx: backend.graph.lines.len(),
        },
    )?;
    Ok(())
}

#[tauri::command]
pub async fn apply_diff(
    window: Window,
    state: StateType<'_>,
    diff: &str,
    to_working_copy: bool,
) -> DefaultResult {
    with_backend(state, |backend| {
        log::debug!(
            "Applying diff to {} (to working copy: {})",
            diff,
            to_working_copy
        );
        let diff = git2::Diff::from_buffer(diff.as_bytes())?;

        let location = if to_working_copy {
            git2::ApplyLocation::WorkDir
        } else {
            git2::ApplyLocation::Index
        };
        backend.repo.apply(&diff, location, None)?;
        // }
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        window.typed_emit(WindowEvents::DiffChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn discard_changes(window: Window, state: StateType<'_>, path: &str) -> DefaultResult {
    with_backend(state, |backend| {
        let p = Path::new(path);
        let state = if p.is_file() {
            backend.repo.status_file(p)?
        } else {
            // This is not ideal as directories are actually not tracked in Git, but we're forcing
            // the code below to recognize the dir as changed in order to discard all changes
            // underneath the path
            Status::WT_MODIFIED
        };
        log::debug!(
            "Discarding changes for {}. Current state: {:?}",
            path,
            state
        );
        if state.is_wt_modified() || state.is_wt_new() {
            let mut co = CheckoutBuilder::new();
            co.path(path)
                .force()
                .update_index(false)
                .remove_untracked(true);
            backend.repo.checkout_head(Some(&mut co))?;
        }
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[derive(Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    Ours,
    Theirs,
}

#[tauri::command]
pub async fn checkout(
    state: StateType<'_>,
    window: Window,
    rev: Option<&str>,
    path: Option<&str>,
    resolution: Option<ConflictResolution>,
) -> DefaultResult {
    with_backend(state, |backend| {
        let mut co = CheckoutBuilder::new();
        if let Some(p) = path {
            co.path(p);
        }
        if let Some(_r) = resolution {
            co.force();
        }
        if let Some(r) = rev {
            let obj = backend.repo.revparse_single(r)?;
            backend.repo.checkout_tree(&obj, Some(&mut co))?;
        } else {
            backend.repo.checkout_head(Some(&mut co))?;
        }
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn get_conflicts(state: StateType<'_>, path: &str) -> Result<Option<String>> {
    with_backend(state, |backend| {
        let p = path.as_bytes();
        let matching_conflict = backend.repo.index()?.conflicts()?.find_map(|c| {
            c.ok().and_then(|conflict| {
                if conflict.our.is_some() && conflict.our.as_ref().unwrap().path == p {
                    Some(conflict)
                } else {
                    None
                }
            })
        });

        let mut opts = git2::MergeOptions::new();
        opts.patience(true)
            .fail_on_conflict(false)
            .standard_style(true);
        matching_conflict
            .map(|c| get_merge_conflict(&backend.repo, c, opts))
            .transpose()
    })
    .await
}

#[tauri::command]
pub async fn resolve_conflict_manually(
    state: StateType<'_>,
    window: Window,
    path: &str,
    code: &str,
) -> DefaultResult {
    with_backend(state, |backend| {
        let file_path = backend
            .repo
            .workdir()
            .map(|p| p.join(path))
            .ok_or_else(|| BackendError::new("Cannot resolve conflict repo without workdir"))?;
        std::fs::write(file_path, code).map_err(|e| BackendError::new(e.to_string()))?;
        do_stage(&backend.repo, path)?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}
