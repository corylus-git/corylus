use git2::{Direction, PushOptions};
use log::debug;
use tauri::Window;

use crate::error::BackendError;

use super::{model::remote::RemoteMeta, with_backend, with_backend_mut, StateType};

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

#[tauri::command]
pub async fn push(
    state: StateType<'_>,
    window: Window,
    remote: String,
    branch: Option<String>,
    upstream: Option<String>,
    set_upstream: Option<bool>,
    force: Option<bool>,
    push_tags: Option<bool>,
) -> Result<(), BackendError> {
    with_backend_mut(state, |backend| {
        let mut remote = backend.repo.find_remote(&remote)?;
        let mut branch_ref = branch.map(|b| format!("refs/heads/{}", b));
        if let Some(u) = upstream {
            branch_ref = branch_ref.map(|br| format!("{}:refs/heads/{}", br, u));
        }
        let mut options = PushOptions::new();
        let refspecs = if branch_ref.is_some() {
            vec![branch_ref.unwrap()]
        } else {
            vec![]
        };
        debug!("Pushing to {} {:?}", remote.name().unwrap_or("<invalid>"), refspecs);
        remote.push(
            &refspecs,
            Some(&mut options),
        )?;
        debug!("Success");
        window.emit("branches_changed", {});
        Ok(())
    })
    .await
}
