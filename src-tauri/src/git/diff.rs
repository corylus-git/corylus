use std::{convert::TryFrom, fs::read, path::Path};

use git2::{Oid, Patch};
use tracing::instrument;

use crate::error::{BackendError, Result};

use super::{
    model::git::{Diff, FileDiff},
    with_backend, DiffSourceType, StateType,
};

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_diff(
    state: StateType<'_>,
    source: DiffSourceType,
    commit_id: Option<&str>,
    to_parent: Option<&str>,
    path: Option<&str>,
    untracked: Option<bool>,
) -> Result<Vec<FileDiff>> {
    tracing::debug!(
        "Retrieving diff for source {:?}({:?} -> {:?}), path: {:?}",
        source,
        commit_id,
        to_parent,
        path
    );
    with_backend(state, |backend| match &source {
        DiffSourceType::Commit => {
            let parent = if let Some(p_id) = to_parent {
                Some(backend.repo.revparse_single(p_id)?.id())
            } else if let Some(id) = commit_id {
                let oid = Oid::from_str(id)?;
                let commit = backend.repo.find_commit(oid)?;
                Some(commit.parent_id(0)?)
            } else {
                None
            };
            tracing::trace!(
                "Getting diff for commit: {:?} -> {:?}, path {:?}",
                commit_id,
                parent,
                path
            );
            let diff =
                backend.load_diff(commit_id, parent.map(|p| p.to_string()).as_deref(), &[path])?;
            Ok(Diff::try_from(diff)?.0)
        }
        DiffSourceType::Workdir => {
            let mut opts = git2::DiffOptions::new();
            opts.patience(true);
            if let Some(p) = path {
                if untracked.unwrap_or(false) {
                    let empty = vec![];
                    let full_path = backend
                        .repo
                        .workdir()
                        .map(|repo_dir| repo_dir.join(p))
                        .ok_or(BackendError::new(format!("Could not resolve path {}", p)))?;
                    let contents = read(full_path).map_err(|e| BackendError::new(e.to_string()))?;
                    let mut patch = Patch::from_buffers(
                        &empty,
                        None,
                        &contents,
                        Some(Path::new(p)),
                        Some(&mut opts),
                    )?;
                    let diff = git2::Diff::from_buffer(&(patch.to_buf()?))?;
                    return Ok(Diff::try_from(diff)?.0);
                }
                opts.pathspec(p);
            }
            let diff = backend.repo.diff_index_to_workdir(None, Some(&mut opts))?;
            Ok(Diff::try_from(diff)?.0)
        }
        DiffSourceType::Index => {
            let head = backend.repo.head()?.peel_to_tree()?;
            let mut opts = git2::DiffOptions::new();
            opts.patience(true);
            if let Some(p) = path {
                opts.pathspec(p);
            }
            let diff = backend
                .repo
                .diff_tree_to_index(Some(&head), None, Some(&mut opts))?;
            Ok(Diff::try_from(diff)?.0)
        }
        DiffSourceType::Stash => {
            if let Some(cid) = commit_id {
                let parent = backend
                    .repo
                    .find_commit(Oid::from_str(cid)?)?
                    .parent(0)?
                    .id()
                    .to_string();
                let diff = backend.load_diff(commit_id, Some(&parent), &[path])?;
                Ok(Diff::try_from(diff)?.0)
            } else {
                Err(BackendError::new("Cannot load diff of unidentified stash"))
            }
        }
    })
    .await
}
