use std::path::Path;

use git2::PushOptions;
use git2::{build::RepoBuilder, FetchOptions, RemoteCallbacks};
use tauri::Window;
use tracing::instrument;
use tracing::{debug, error};

use crate::git::remote::do_fetch;
use crate::{
    error::{BackendError, DefaultResult, Result},
    git::{load_repo, model::graph::GraphChangeData},
    window_events::{TypedEmit, WindowEvents},
};

use crate::git::{
    credentials::make_credentials_callback, git_open, merge::do_merge, model::remote::RemoteMeta,
    with_backend, with_backend_mut, StateType,
};

#[instrument(skip(state), err, ret)]
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
#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn push(
    state: StateType<'_>,
    window: Window,
    remote: String,
    branch: Option<String>,
    upstream: Option<String>,
    set_upstream: Option<bool>,
    _force: Option<bool>,
    push_tags: Option<bool>,
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
        let mut refspecs = if branch_ref.is_some() {
            vec![branch_ref.unwrap()]
        } else {
            vec![]
        };
        if push_tags.unwrap_or(false) {
            backend.repo.tag_foreach(|_, name| {
                let name_string = String::from_utf8(name.to_owned());
                if let Err(e) = name_string {
                    error!("Could not map tag name to UTF-8: {}", e);
                } else if let Ok(name) = name_string {
                    refspecs.push(name);
                }
                true
            })?;
        }
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

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn fetch(
    state: StateType<'_>,
    window: Window,
    remote: Option<&str>,
    ref_spec: Option<&str>,
    prune: bool,
    fetch_tags: bool,
) -> DefaultResult {
    tracing::trace!(
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

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn add_remote(
    state: StateType<'_>,
    window: Window,
    name: &str,
    url: &str,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        tracing::trace!("Adding new remote {} -> {}", name, url);
        backend.repo.remote(name, url)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn update_remote(
    state: StateType<'_>,
    window: Window,
    name: &str,
    url: &str,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        tracing::trace!("Updating remote {} -> {}", name, url);
        backend.repo.remote_set_url(name, url)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn delete_remote(state: StateType<'_>, window: Window, name: &str) -> DefaultResult {
    with_backend_mut(state, |backend| {
        tracing::trace!("Removing remote {}", name);
        backend.repo.remote_delete(name)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn pull(
    state: StateType<'_>,
    window: Window,
    remote: &str,
    remote_branch: &str,
    no_fast_forward: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        do_fetch(&backend.repo, remote, false, false, Some(remote_branch))?;
        let from_ref = backend
            .repo
            .revparse_ext(&format!("{}/{}", remote, remote_branch))?
            .1
            .ok_or_else(|| BackendError::new("Could not parse remote branch reference"))?;
        if from_ref.peel_to_commit()?.id() != backend.repo.head()?.peel_to_commit()?.id() {
            tracing::debug!("Remote has a updates. Merging.");
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

#[instrument(skip(state, window), err, ret)]
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
    {
        let mut builder = RepoBuilder::new();
        let mut fetch_opts = FetchOptions::new();
        let mut cbs = RemoteCallbacks::new();
        cbs.transfer_progress(|progress| {
            window.typed_emit(
                WindowEvents::Progress,
                progress.received_objects() * 100 / progress.total_objects(),
            );
            true
        });
        fetch_opts.remote_callbacks(cbs);
        builder.fetch_options(fetch_opts);
        builder.clone(url, Path::new(local_dir))?;
    }
    // git2::Repository::clone(url, local_dir)?;
    debug!("Finished clone from {} to {}", url, local_dir);
    git_open(state.clone(), local_dir).await?;
    load_repo(state, window).await
}