use crate::error::BackendError;

use super::{model::remote::RemoteMeta, with_backend, StateType};

#[tauri::command]
pub async fn get_remotes(state: StateType<'_>) -> Result<Vec<RemoteMeta>, BackendError> {
    with_backend(state, |backend| {
        let remote_names = backend.repo.remotes()?;
        let remotes = remote_names
            .iter()
            .map(|r| r.map(|name| backend.repo.find_remote(name)))
            .flatten()
            .flatten();
        Ok(remotes
            .filter_map(|remote| {
                if let Some(name) = remote.name() {
                    if let Some(url) = remote.url() {
                        Some(RemoteMeta {
                            remote: name.to_owned(),
                            url: url.to_owned(),
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect())
    })
    .await
}
