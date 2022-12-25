use git2::StatusOptions;

use crate::error::BackendError;

use super::{model::git::FileStats, with_backend, StateType};

#[tauri::command]
pub async fn get_files(state: StateType<'_>) -> Result<Vec<FileStats>, BackendError> {
    with_backend(state, |backend| {
        let mut status_options = StatusOptions::new();
        status_options.include_ignored(false)
            .include_untracked(true)
            .include_unmodified(true)
            .recurse_ignored_dirs(false)
            .recurse_untracked_dirs(true);
        let statuses = backend
            .repo
            .statuses(Some(&mut status_options))?
            .iter()
            .map(|status| FileStats::from(status)).collect();
        Ok(statuses)
    })
    .await
}
