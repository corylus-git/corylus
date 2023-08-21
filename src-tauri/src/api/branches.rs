use git2::{build::CheckoutBuilder, BranchType, Oid, Repository, ResetType};
use tauri::Window;
use tracing::instrument;

use crate::{
    error::{BackendError, DefaultResult, Result},
    window_events::{TypedEmit, WindowEvents},
};

use crate::git::{
    history::do_get_graph,
    model::{
        get_upstream,
        git::SourceType,
        graph::{GraphChangeData, GraphLayoutData},
        BranchInfo,
    },
    with_backend, with_backend_mut,
    worktree::load_worktrees,
    StateType,
};

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_branches(state: StateType<'_>) -> Result<Vec<BranchInfo>> {
    with_backend(state, |backend| {
        let branches = backend.repo.branches(None)?;
        let worktrees = load_worktrees(backend)?;
        // TODO don't like the common_* code. Seems too complex
        let common_path = backend
            .repo
            .path()
            .to_str()
            .and_then(|p| p.split("/.git/").next());
        let common_branch = common_path.and_then(|cp| {
            Repository::open(cp)
                .map(|r| r.head().ok().and_then(|h| h.name().map(|n| n.to_owned())))
                .ok()
                .flatten()
        });

        let result = branches.filter_map(|branch| {
            branch.ok().and_then(|b| {
                let worktree = worktrees.iter().find(|wt| {
                    wt.branch
                        .as_ref()
                        .map_or(false, |wtb| wtb == b.0.get().name().unwrap_or(""))
                });
                BranchInfo::try_from(&b).ok().map(|mut bi| {
                    bi.worktree = if common_branch.as_deref() == b.0.get().name() {
                        bi.is_on_common_path = true;
                        common_path.map(|cp| cp.to_owned())
                    } else {
                        worktree.map(|wt| wt.path.clone())
                    };
                    bi.upstream = get_upstream(&b.0, &backend.repo)?;
                    Ok(bi)
                })
            })
        });
        let results: Result<Vec<BranchInfo>> = result.collect();
        tracing::debug!("Branches: {:?}", results);
        results
    })
    .await
}

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_unmerged_branches(state: StateType<'_>) -> Result<Vec<String>> {
    with_backend(state, |backend| {
        let head = backend.repo.head()?.resolve()?.peel_to_commit()?.id();
        Ok(backend
            .branches
            .iter()
            .filter_map(|b| {
                let oid = Oid::from_str(&b.head).ok()?;
                if backend.repo.graph_descendant_of(head, oid).ok()? {
                    Some(b.ref_name.clone())
                } else {
                    None
                }
            })
            .collect())
    })
    .await
}

#[instrument(skip(state, window), err)]
#[tauri::command]
pub async fn delete_branch(
    state: StateType<'_>,
    window: Window,
    branch: &str,
    remove_remote: bool,
) -> DefaultResult {
    with_backend(state, |backend| {
        let mut branch = backend.repo.find_branch(branch, git2::BranchType::Local)?;
        if remove_remote {
            let mut upstream = branch.upstream()?;
            upstream.delete()?;
        };
        branch.delete()?;
        window.typed_emit(WindowEvents::BranchesChanged, {})?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err)]
#[tauri::command]
pub async fn create_branch(
    state: StateType<'_>,
    window: Window,
    name: &str,
    source: &str,
    source_type: SourceType,
    checkout: bool,
) -> DefaultResult {
    with_backend(state, |backend| {
        let source_commit = match source_type {
            SourceType::Branch => backend
                .repo
                .find_branch(source, git2::BranchType::Local)?
                .into_reference()
                .peel_to_commit()?,
            SourceType::Commit => backend.repo.find_commit(Oid::from_str(source)?)?,
        };
        let branch = backend.repo.branch(name, &source_commit, false)?;
        if checkout {
            let reference = branch.into_reference();
            backend.repo.checkout_tree(
                reference.peel_to_commit()?.tree()?.as_object(),
                Some(CheckoutBuilder::new().safe()),
            )?;
            backend.repo.set_head(reference.name().ok_or_else(|| {
                BackendError::new(
                    "Could not get ref name of new branch. Cannot check out after creation",
                )
            })?)?;
        };
        window.typed_emit(WindowEvents::BranchesChanged, {})?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err)]
#[tauri::command]
pub async fn change_branch(state: StateType<'_>, window: Window, ref_name: &str) -> DefaultResult {
    with_backend(state, |backend| {
        let (object, reference) = backend
            .repo
            .revparse_ext(format!("refs/heads/{}", ref_name).as_str())?;
        let commit = object.peel_to_commit()?;
        backend.repo.checkout_tree(
            commit.tree()?.as_object(),
            Some(CheckoutBuilder::new().safe()),
        )?;
        if let Some(r) = reference {
            backend.repo.set_head(r.name().ok_or_else(|| {
                BackendError::new("Cannot get reference name of the branch. Not updating HEAD")
            })?)?;
        }
        window.typed_emit(WindowEvents::BranchesChanged, {})?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err)]
#[tauri::command]
pub async fn checkout_remote_branch(
    state: StateType<'_>,
    window: Window,
    ref_name: &str,
    local_name: &str,
) -> DefaultResult {
    with_backend(state, |backend| {
        if backend
            .repo
            .find_branch(local_name, BranchType::Local)
            .is_ok()
        {
            return Err(BackendError::new(format!(
                "A branch with the name {} already exists locally and cannot be overwritten.",
                local_name
            )));
        }
        let (object, reference) = backend.repo.revparse_ext(ref_name)?;
        if reference.as_ref().map_or(true, |r| !r.is_remote()) {
            return Err(BackendError::new(format!(
                "{} is not pointing to a remote branch and cannot be tracked locally",
                ref_name
            )));
        }
        let commit = object.peel_to_commit()?;
        backend.repo.checkout_tree(
            commit.tree()?.as_object(),
            Some(CheckoutBuilder::new().safe()),
        )?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        let mut local_branch = backend.repo.branch(local_name, &commit, false)?;
        local_branch.set_upstream(Some(ref_name))?;
        backend
            .repo
            .set_head(local_branch.get().name().ok_or_else(|| {
                BackendError::new("Designated HEAD branch has no name. Internal program error")
            })?)?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        Ok(())
    })
    .await
}

#[instrument(skip(state, window), err)]
#[tauri::command]
pub async fn reset(
    state: StateType<'_>,
    window: Window,
    to_ref: &str,
    mode: &str,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let target = backend.repo.revparse_single(to_ref)?;
        let reset_type = match mode {
            "soft" => Ok(ResetType::Soft),
            "mixed" => Ok(ResetType::Mixed),
            "hard" => Ok(ResetType::Hard),
            _ => Err(BackendError::new(format!(
                "Unsupported reset type \"{}\"",
                mode
            ))),
        }?;
        backend.repo.reset(&target, reset_type, None)?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        window.typed_emit(WindowEvents::BranchesChanged, ())?;
        // TODO this repeats code from git_open -> don't like this current setup
        let new_graph = GraphLayoutData {
            lines: do_get_graph(&backend.repo, None)?.collect(),
            rails: vec![],
        };
        backend.graph = new_graph;
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