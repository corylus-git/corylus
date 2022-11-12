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
        window.emit("status-changed", ());
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn unstage(window: Window, state: StateType<'_>, path: &str) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let head = backend.repo.head()?.peel_to_commit()?;
        backend
            .repo
            .reset_default(Some(&head.into_object()), [path])?;
        window.emit("status-changed", ());
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
            let oid = backend.repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&head],
            )?;
        }
        backend.load_history(&window);
        window.emit("status-changed", {});
        Ok(())
    })
    .await
}
