use crate::error::BackendError;

use super::{model::config::{GitConfigEntry, GitConfigLevel}, StateType, with_backend};

#[tauri::command]
pub async fn get_config(state: StateType<'_>) -> Result<Vec<GitConfigEntry>, BackendError>
{
    with_backend(state, |backend| {
        let mut config = vec![];
        backend.repo.config()?.entries(None)?.for_each(|entry| {
            config.push(GitConfigEntry { 
                name: entry.name().unwrap_or("").to_owned(), 
                value: entry.value().unwrap_or("").to_owned(),
                level: GitConfigLevel::from(entry.level())
            })
        })?;
        Ok(config)
    }).await
}