use tracing::instrument;

use crate::error::Result;

use crate::git::{
    model::config::{GitConfigEntry, GitConfigLevel},
    with_backend, StateType,
};

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_config(state: StateType<'_>) -> Result<Vec<GitConfigEntry>> {
    with_backend(state, |backend| {
        let mut config = vec![];
        backend.repo.config()?.entries(None)?.for_each(|entry| {
            config.push(GitConfigEntry {
                name: entry.name().unwrap_or("").to_owned(),
                value: entry.value().unwrap_or("").to_owned(),
                level: GitConfigLevel::from(entry.level()),
            })
        })?;
        Ok(config)
    })
    .await
}
