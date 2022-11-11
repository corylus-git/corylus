use tauri::Window;

use crate::error::BackendError;

use super::{model::index::IndexStatus, StateType};

#[tauri::command]
pub async fn get_status(state: StateType<'_>) -> Result<Vec<IndexStatus>, BackendError> {
    let backend_guard = state.backend.lock().await;
    (*backend_guard)
        .as_ref()
        .map(|backend| backend.get_status())
        .unwrap_or(Err(BackendError { message: "No directory open.".to_string() })) // TODO perhaps this whole repeating code could be simplified into a function or a macro
}

#[tauri::command]
pub async fn stage(window: Window, state: StateType<'_>, path: &str) -> Result<(), BackendError> {
    let backend_guard = state.backend.lock().await;
    (*backend_guard)
        .as_ref()
        .map(|backend| {
            backend.stage(path)?;
            window.emit("status-changed", ());
            Ok(())
        })
        .unwrap_or(Err(BackendError { message: "No directory open.".to_string() }))
}

#[tauri::command]
pub async fn unstage(window: Window, state: StateType<'_>, path: &str) -> Result<(), BackendError> {
    let backend_guard = state.backend.lock().await;
    (*backend_guard)
        .as_ref()
        .map(|backend| {
            backend.unstage(path)?;
            window.emit("status-changed", ());
            Ok(())
        })
        .unwrap_or(Err(BackendError { message: "No directory open.".to_string() }))
}

#[tauri::command]
pub async fn commit(state: StateType<'_>, message: &str, amend: bool) -> Result<(), BackendError> {
    let backend_guard = state.backend.lock().await;
    let result = (*backend_guard)
        .as_ref()
        .map(|backend| backend.commit(message));
    result.unwrap_or(Err(BackendError { message: "No directory open.".to_string()}))
}
