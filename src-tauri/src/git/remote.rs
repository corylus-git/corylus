use std::{collections::HashSet, path::Path};

use git2::{AutotagOption, FetchOptions, FetchPrune, PushOptions, RemoteCallbacks};
use log::debug;
use tauri::Window;

use crate::error::{BackendError, DefaultResult, Result};

use super::{
    credentials::make_credentials_callback, model::remote::RemoteMeta, with_backend,
    with_backend_mut, StateType,
};

#[tauri::command]
pub async fn get_remotes(state: StateType<'_>) -> Result<Vec<RemoteMeta>> {
    with_backend(state, |backend| {
        let remote_names = backend.repo.remotes()?;
        let remotes = remote_names
            .iter()
            .filter_map(|r| r.map(|name| backend.repo.find_remote(name)))
            .flatten();
        Ok(remotes
            .filter_map(|remote| {
                if let Some(name) = remote.name() {
                    remote.url().map(|u| RemoteMeta {
                        remote: name.to_owned(),
                        url: u.to_owned(),
                    })
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
    _set_upstream: Option<bool>,
    _force: Option<bool>,
    _push_tags: Option<bool>,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let mut remote = backend.repo.find_remote(&remote)?;
        let mut branch_ref = branch.map(|b| format!("refs/heads/{}", b));
        if let Some(u) = upstream {
            branch_ref = branch_ref.map(|br| format!("{}:refs/heads/{}", br, u));
        }
        let mut remote_callbacks = RemoteCallbacks::new();
        remote_callbacks.credentials(make_credentials_callback(&backend.repo));
        let mut options = PushOptions::new();
        options.remote_callbacks(remote_callbacks);
        let refspecs = if branch_ref.is_some() {
            vec![branch_ref.unwrap()]
        } else {
            vec![]
        };
        debug!(
            "Pushing to {} {:?}",
            remote.name().unwrap_or("<invalid>"),
            refspecs
        );
        remote.push(&refspecs, Some(&mut options))?;
        debug!("Success");
        window.emit("branches_changed", {})?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn fetch(
    state: StateType<'_>,
    window: Window,
    remote: Option<&str>,
    ref_spec: Option<&str>,
    prune: bool,
    fetch_tags: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        backend
            .repo
            .remotes()?
            .iter()
            .try_for_each(|remote_name| -> DefaultResult {
                if let Some(name) = remote_name {
                    if remote.is_none() || remote.unwrap() == name {
                        debug!("Fetching changes from remote {}", name);
                        let mut r = backend.repo.find_remote(name)?;
                        let mut options = FetchOptions::new();
                        options.prune(if prune {
                            FetchPrune::On
                        } else {
                            FetchPrune::Off
                        });
                        options.download_tags(if fetch_tags {
                            AutotagOption::All
                        } else {
                            AutotagOption::None
                        });
                        let fetch_refspec = r.fetch_refspecs()?;
                        let default_refspec: Vec<&str> = fetch_refspec.iter().flatten().collect();
                        r.fetch(
                            &ref_spec.map_or(default_refspec, |rs| vec![rs]),
                            Some(&mut options),
                            None,
                        )?;
                        debug!("Fetched changes from {}", name);
                    }
                }
                Ok(())
            })?;
        window.emit("branches_changed", {})?;
        window.emit("history_changed", {})?;
        Ok(())
    })
    .await
}
//
// #[tauri::command]
// pub async fn pull(
// ) -> Result<>
//
