use git2::Oid;

use crate::error::BackendError;

use super::{
    model::git::{Diff, FileDiff},
    with_backend, DiffSourceType, StateType,
};

#[tauri::command]
pub async fn get_diff(
    state: StateType<'_>,
    source: DiffSourceType,
    commit_id: Option<&str>,
    to_parent: Option<&str>,
    path: Option<&str>,
    untracked: Option<bool>,
) -> Result<Vec<FileDiff>, BackendError> {
    with_backend(state, |backend| match &source {
        DiffSourceType::Commit => {
            let parent = to_parent.map(|p| p.to_owned()).or_else(|| {
                if source == DiffSourceType::Commit {
                    commit_id
                        .map(|id| {
                            Oid::from_str(id)
                                .and_then(|oid| backend.repo.find_commit(oid))
                                .and_then(|commit| commit.parent_id(0))
                                .and_then(|oid| Ok(oid.to_string()))
                                .ok()
                        })
                        .flatten()
                } else {
                    None
                }
            });
            let diff = backend.load_diff(commit_id, parent.as_deref(), &[path])?;
            Ok(Diff::try_from(diff)?.0)
        },
        DiffSourceType::Workdir => {
            let mut opts = git2::DiffOptions::new();
            opts.patience(true);
            if let Some(p) = path {
                opts.pathspec(p);
            }
            let diff = backend.repo.diff_index_to_workdir(None, Some(&mut opts))?;
            Ok(Diff::try_from(diff)?.0)
        },
        DiffSourceType::Index => {
            let head = backend.repo.head()?.peel_to_tree()?;
            let mut opts = git2::DiffOptions::new();
            opts.patience(true);
            if let Some(p) = path {
                opts.pathspec(p);
            }
            let diff = backend.repo.diff_tree_to_index(Some(&head), None, Some(&mut opts))?;
            Ok(Diff::try_from(diff)?.0)
        },
        DiffSourceType::Stash => {
            if let Some(cid) = commit_id {
                let parent = backend.repo.find_commit(Oid::from_str(cid)?)?.parent(0)?.id().to_string();
                let diff = backend.load_diff(commit_id, Some(&parent), &[path])?;
                Ok(Diff::try_from(diff)?.0)
            }
            else {
                Err(BackendError::new("Cannot load diff of unidentified stash"))
            }
        },
        _ => Err(BackendError::new("Unknown diff source type")),
    })
    .await
}
