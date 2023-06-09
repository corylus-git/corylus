use git2::{AutotagOption, FetchOptions, FetchPrune, PushOptions, RemoteCallbacks};
use log::debug;
use tauri::Window;

use crate::{
    error::{BackendError, DefaultResult, Result},
    git::model::graph::GraphChangeData,
    window_events::{TypedEmit, WindowEvents},
};

use super::{
    credentials::make_credentials_callback, git_open, merge::do_merge, model::remote::RemoteMeta,
    with_backend, with_backend_mut, StateType,
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
    set_upstream: Option<bool>,
    _force: Option<bool>,
    _push_tags: Option<bool>,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let mut remote_obj = backend.repo.find_remote(&remote)?;
        let mut branch_ref = branch.as_ref().map(|b| format!("refs/heads/{}", b));
        if let Some(u) = upstream.as_ref() {
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
        debug!("Pushing to {} {:?}", remote, refspecs);
        remote_obj.push(&refspecs, Some(&mut options))?;
        debug!("Success");
        if let (Some(set_upstream), Some(branch)) = (set_upstream, branch) {
            if set_upstream {
                let mut local_branch =
                    backend.repo.find_branch(&branch, git2::BranchType::Local)?;
                let upstream_ref = upstream.as_ref().map(|u| format!("{}/{}", remote, u));
                debug!("Setting upstream of {} to {:?}", branch, upstream_ref);
                local_branch.set_upstream(upstream_ref.as_ref().map(|u| u.as_str()))?;
            }
        }
        window.typed_emit(WindowEvents::BranchesChanged, {})?;
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
    log::trace!(
        "Invoking fetch(remote={:?}, ref_spec={:?}, prune={}, fetch_tags={})",
        remote,
        ref_spec,
        prune,
        fetch_tags
    );
    with_backend_mut(state, |backend| {
        backend
            .repo
            .remotes()?
            .iter()
            .try_for_each(|remote_name| -> DefaultResult {
                if let Some(name) = remote_name {
                    if remote.is_none() || remote.unwrap() == name {
                        do_fetch(&backend.repo, name, prune, fetch_tags, ref_spec)?;
                    }
                }
                Ok(())
            })?;
        window.typed_emit(WindowEvents::BranchesChanged, {})?;
        window.typed_emit(
            WindowEvents::HistoryChanged,
            GraphChangeData {
                total: backend.graph.lines.len(),
                change_end_idx: 0,
                change_start_idx: backend.graph.lines.len(),
            },
        )?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn add_remote(
    state: StateType<'_>,
    window: Window,
    name: &str,
    url: &str,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        log::trace!("Adding new remote {} -> {}", name, url);
        backend.repo.remote(name, url)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn update_remote(
    state: StateType<'_>,
    window: Window,
    name: &str,
    url: &str,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        log::trace!("Updating remote {} -> {}", name, url);
        backend.repo.remote_set_url(name, url)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn delete_remote(state: StateType<'_>, window: Window, name: &str) -> DefaultResult {
    with_backend_mut(state, |backend| {
        log::trace!("Removing remote {}", name);
        backend.repo.remote_delete(name)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

fn do_fetch(
    repo: &git2::Repository,
    name: &str,
    prune: bool,
    fetch_tags: bool,
    ref_spec: Option<&str>,
) -> DefaultResult {
    debug!("Fetching changes from remote {}", name);
    let mut r = repo.find_remote(name)?;
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
    Ok(())
}

#[tauri::command]
pub async fn pull(
    state: StateType<'_>,
    window: Window,
    remote: &str,
    remote_branch: &str,
    no_fast_forward: bool, // TODO I don't like this name, that results from serializing 'noFF' on the typescript side of things
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        do_fetch(&backend.repo, remote, false, false, Some(remote_branch))?;
        let from_ref = backend
            .repo
            .revparse_ext(&format!("{}/{}", remote, remote_branch))?
            .1
            .ok_or_else(|| BackendError::new("Could not parse remote branch reference"))?;
        if from_ref.peel_to_commit()?.id() != backend.repo.head()?.peel_to_commit()?.id() {
            log::debug!("Remote has a updates. Merging.");
            let ref_name = from_ref
                .name()
                .ok_or_else(|| BackendError::new("Target reference has no valid name"))?
                .to_owned();
            drop(from_ref); // no longer needed, but referenced indirectly, causing the do_merge call to not be able to borrow mutably
            do_merge(backend, window.clone(), &ref_name, no_fast_forward)?;
        }
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        window.typed_emit(WindowEvents::HistoryChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn clone(
    state: StateType<'_>,
    window: Window,
    url: &str,
    local_dir: &str,
) -> DefaultResult {
    std::fs::create_dir(local_dir).map_err(|e| {
        BackendError::new(format!(
            "Cannot create new directory to clone into. {}",
            e.to_string()
        ))
    })?;
    debug!("Starting clone from {} to {}", url, local_dir);
    git2::Repository::clone(url, local_dir)?;
    debug!("Finished clone from {} to {}", url, local_dir);
    git_open(state, window, local_dir).await
}
