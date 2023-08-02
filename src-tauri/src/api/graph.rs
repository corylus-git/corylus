use tauri::Window;
use tracing::instrument;

use crate::error::Result;
use crate::git::model::graph::load_more_graph_entries;
use crate::git::{
    model::{
        git::{Commit, FullCommitData},
        graph::LayoutListEntry,
    },
    with_backend, StateType,
};

use crate::git::with_backend_mut;

#[instrument(skip(state, window), err, ret, err, ret)]
#[tauri::command]
pub async fn get_graph_entries(
    state: StateType<'_>,
    window: Window,
    start_idx: usize,
    end_idx: usize,
) -> Result<Vec<LayoutListEntry>> {
    with_backend_mut(state, |backend| {
        if start_idx > backend.graph.lines.len() {
            load_more_graph_entries(backend, end_idx - backend.graph.lines.len(), window)?;
        }
        let return_batch: Vec<LayoutListEntry> = backend
            .graph
            .lines
            .iter()
            .skip(start_idx)
            .take(end_idx - start_idx)
            .cloned()
            .collect();
        Ok(return_batch)
    })
    .await
}

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_index(state: StateType<'_>, oid: &str) -> Result<Option<usize>> {
    with_backend(state, |backend| {
        Ok(backend
            .graph
            .lines
            .iter()
            .position(|line| match &line.commit {
                Commit::Commit(c) => c.oid == oid,
                Commit::Stash(s) => s.oid == oid,
            }))
    })
    .await
}

fn match_commit(c: &FullCommitData, search_term: &str) -> bool {
    c.author.name.to_lowercase().contains(search_term)
        || c.author.email.to_lowercase().contains(search_term)
        || c.message.to_lowercase().contains(search_term)
        || c.short_oid.to_lowercase().contains(search_term)
        || c.oid.to_lowercase().contains(search_term)
}

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn find_commits(state: StateType<'_>, search_term: &str) -> Result<Vec<usize>> {
    with_backend(state, |backend| {
        Ok(backend
            .graph
            .lines
            .iter()
            .enumerate()
            .filter_map(|(i, c)| match &c.commit {
                Commit::Commit(c) => {
                    if match_commit(c, search_term) {
                        Some(i)
                    } else {
                        None
                    }
                }
                Commit::Stash(_) => None,
            })
            .collect())
    })
    .await
}
