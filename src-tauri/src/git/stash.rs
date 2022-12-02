use git2::{DiffOptions, Oid, StashFlags};
use tauri::Window;

use crate::error::BackendError;

use super::{
    history::map_diff,
    model::git::{Commit, StashData, CommitStats, StashStatsData},
    with_backend, with_backend_mut, StateType,
};

#[tauri::command]
pub async fn stash(
    state: StateType<'_>,
    window: Window,
    message: Option<&str>,
    untracked: bool,
) -> Result<(), BackendError> {
    with_backend_mut(state, |backend| {
        backend.repo.stash_save2(
            &backend.repo.signature()?,
            message,
            if untracked {
                Some(StashFlags::INCLUDE_UNTRACKED)
            } else {
                None
            },
        )?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn get_stashes(state: StateType<'_>) -> Result<Vec<Commit>, BackendError> {
    with_backend_mut(state, |backend| {
        let mut stashes_data = vec![];
        backend.repo.stash_foreach(|idx, message, oid| {
            stashes_data.push((idx, message.to_owned(), oid.to_owned()));
            true
        });
        stashes_data
            .iter()
            .map(|(idx, message, oid)| {
                let commit = backend.repo.find_commit(*oid)?;
                Ok(Commit::Stash(StashData {
                    ref_name: format!("stash@{{{}}}", idx).to_owned(),
                    oid: oid.to_string(),
                    short_oid: "".to_owned(),
                    message: commit.message().unwrap_or("").to_owned(),
                    parents: vec![],
                    author: commit.author().into(),
                }))
            })
            .collect()
    })
    .await
}

#[tauri::command]
pub async fn get_stash_stats(
    state: StateType<'_>,
    window: Window,
    oid: &str,
) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let stash_commit =
            Oid::from_str(oid).and_then(|parsed_oid| backend.repo.find_commit(parsed_oid))?;
        let direct_diff = backend.repo.diff_tree_to_tree(
            stash_commit.parent(0)?.tree().ok().as_ref(),
            stash_commit.tree().ok().as_ref(),
            Some(DiffOptions::new().patience(true)),
        )?;
        let direct = map_diff(&direct_diff);
        let index_stats = stash_commit
            .parent(1)
            .and_then(|commit| commit.tree())
            .and_then(|index_tree| {
                backend.repo.diff_tree_to_tree(
                    stash_commit.parent(0).unwrap().tree().ok().as_ref(), // we know the tree must be there
                    Some(&index_tree),
                    Some(DiffOptions::new().patience(true)),
                )
            })
            .ok()
            .and_then(|diff| Some(map_diff(&diff)));
        let untracked_stats = stash_commit
            .parent(2)
            .and_then(|commit| commit.tree())
            .and_then(|untracked_tree| {
                backend.repo.diff_tree_to_tree(
                    None, // the untracked stash parent has no parent commits
                    Some(&untracked_tree),
                    Some(DiffOptions::new().patience(true)),
                )
            })
            .ok()
            .and_then(|diff| Some(map_diff(&diff)));
        window.emit(
            "commitStatsChanged",
            CommitStats::Stash(StashStatsData {
                stash: StashData::try_from(&stash_commit)?,
                changes: direct,
                index: index_stats,
                untracked: untracked_stats,
            }),
        );
        Ok(())
    })
    .await
}
