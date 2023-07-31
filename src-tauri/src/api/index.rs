use std::path::Path;

use git2::{build::CheckoutBuilder, Status};
use log::error;
use tauri::Window;

use crate::{
    error::{BackendError, DefaultResult, Result},
    git::{
        git_merge_file::get_merge_conflict,
        index::{do_commit, do_stage, ConflictResolution},
        model::index::IndexStatus,
        with_backend, with_backend_mut, StateType,
    },
    window_events::{TypedEmit, WindowEvents},
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
