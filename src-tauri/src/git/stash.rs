use git2::{DiffOptions, Oid, StashApplyOptions, StashFlags};
use tauri::Window;

use crate::{
    error::{BackendError, DefaultResult, Result},
    window_events::{TypedEmit, WindowEvents},
};

use super::{
    history::map_diff,
    model::git::{Commit, CommitStats, StashData, StashStatsData},
    with_backend_mut, GitBackend, StateType,
};

#[tauri::command]
pub async fn stash(
    state: StateType<'_>,
    window: Window,
    message: Option<&str>,
    untracked: bool,
) -> DefaultResult {
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
        window.typed_emit(WindowEvents::StashesChanged, {})?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn get_stashes(state: StateType<'_>) -> Result<Vec<Commit>> {
    with_backend_mut(state, |backend| {
        let stashes = get_stashes_data(backend)?;
        stashes
            .iter()
            .map(|(idx, _message, oid)| {
                let commit = backend.repo.find_commit(*oid)?;
                Ok(Commit::Stash(StashData {
                    ref_name: format!("stash@{{{}}}", idx),
                    oid: oid.to_string(),
                    short_oid: "".to_owned(),
                    message: commit.message().unwrap_or("").to_owned(),
                    parents: vec![],
                    author: commit.author().into(),
                }))
            })
            .collect::<Result<Vec<Commit>>>()
    })
    .await
}

fn get_stashes_data(backend: &mut GitBackend) -> Result<Vec<(usize, String, git2::Oid)>> {
    let mut stashes_data = vec![];
    backend.repo.stash_foreach(|idx, message, oid| {
        stashes_data.push((idx, message.to_owned(), oid.to_owned()));
        true
    })?;
    Ok(stashes_data)
}

#[tauri::command]
pub async fn get_stash_stats(state: StateType<'_>, window: Window, oid: &str) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let stash_idx = find_stash_idx(oid, backend)?;
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
            .map(|diff| map_diff(&diff));
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
            .map(|diff| map_diff(&diff));
        let mut stash = StashData::try_from(&stash_commit)?;
        stash.ref_name = format!("stash@{{{}}}", stash_idx);
        window.typed_emit(
            WindowEvents::CommitStatsChanged,
            CommitStats::Stash(StashStatsData {
                stash,
                changes: direct,
                index: index_stats,
                untracked: untracked_stats,
            }),
        )?;
        Ok(())
    })
    .await
}

fn find_stash_idx(oid: &str, backend: &mut GitBackend) -> Result<usize> {
    let id = Oid::from_str(oid)?;
    let stashes = get_stashes_data(backend)?;
    stashes
        .iter()
        .find(|(_, _, stash_id)| stash_id == &id)
        .map(|(idx, _, _)| *idx)
        .ok_or_else(|| BackendError::new("Could not find selected stash"))
}

#[tauri::command]
pub async fn apply_stash(
    state: StateType<'_>,
    window: Window,
    oid: &str,
    delete_after_apply: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let stash_idx = find_stash_idx(oid, backend)?;
        let mut opts = StashApplyOptions::new();
        opts.reinstantiate_index();
        if delete_after_apply {
            backend.repo.stash_pop(stash_idx, Some(&mut opts))?;
        } else {
            backend.repo.stash_apply(stash_idx, Some(&mut opts))?;
        }
        window.typed_emit(WindowEvents::StashesChanged, ())?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn drop_stash(state: StateType<'_>, window: Window, oid: &str) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let mut opts = StashApplyOptions::new();
        opts.reinstantiate_index();
        let stash_idx = find_stash_idx(oid, backend)?;
        backend.repo.stash_drop(stash_idx)?;
        window.typed_emit(WindowEvents::StashesChanged, ())?;
        Ok(())
    })
    .await
}
