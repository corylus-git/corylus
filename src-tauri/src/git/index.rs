use super::{model::index::IndexStatus, StateType};

#[tauri::command]
pub async fn get_status(state: StateType<'_>) -> Result<Vec<IndexStatus>, String> {
    let backend_guard = state.backend.lock().await;
    (*backend_guard)
        .as_ref()
        .map(|backend| backend.get_status())
        .unwrap_or(Err("No directory open.".to_string()))
}
