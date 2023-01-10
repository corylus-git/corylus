use log::{error, debug};
use tauri::Window;

use crate::error::BackendError;

use super::{model::index::IndexStatus, with_backend, StateType, with_backend_mut};

#[tauri::command]
pub async fn get_status(state: StateType<'_>) -> Result<Vec<IndexStatus>, BackendError> {
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
pub async fn stage(window: Window, state: StateType<'_>, path: &str) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let mut index = backend.repo.index()?;
        index.add_all([path], git2::IndexAddOption::DEFAULT, None)?;
        window.emit("status-changed", ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn unstage(window: Window, state: StateType<'_>, path: &str) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let head = backend.repo.head()?.peel_to_commit()?;
        log::debug!("Unstaging {}", path);
        backend
            .repo
            .reset_default(Some(&head.into_object()), [path])?;
        window.emit("status-changed", ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn commit(window: Window, state: StateType<'_>, message: &str, amend: bool) -> Result<(), BackendError> {
    with_backend_mut(state, |backend| {
        let tree_id = backend.repo.index()?.write_tree()?;
        {
            backend.repo.index()?.write()?;
            let tree = backend.repo.find_tree(tree_id)?;
            let head = backend.repo.head().and_then(|h| h.peel_to_commit())?;
            let signature = backend.repo.signature()?;
            if amend {
                let amended = head.amend(
                    Some("HEAD"),
                    None,
                    None,
                    None,
                    Some(message),
                    Some(&tree))?;
                debug!("Amended commit {:?}->{:?}", head, amended);
            } else {
                let oid = backend.repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    message,
                    &tree,
                    &[&head],
                )?;
                debug!("Committed {}", oid);
            }
        }
        backend.load_history(&window)?;
        window.emit("status-changed", ())?;
        window.emit("branches-changed", ())?;
        Ok(())
    })
    .await
    .map_err(|e| {
        // TODO replace this with .inspect_err() as it becomes stable
        error!("Could not commit. {}", e); 
        e
    })
}

#[tauri::command]
pub async fn apply_diff(window: Window, state: StateType<'_>, diff: &str, revert: bool) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        log::debug!("Applying diff to index: {}", diff);
        let diff = git2::Diff::from_buffer(diff.as_bytes())?;
        let head_tree = backend.repo.head()?.peel_to_tree()?;
        let mut index = backend.repo.apply_to_tree(&head_tree, &diff, None)?;
        backend.repo.set_index(&mut index)?;
        window.emit("status-changed", ())?;
        window.emit("diff-changed", ())?;
        Ok(())
    }).await
}
