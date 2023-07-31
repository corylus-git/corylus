use tauri::Window;

use super::{
    model::{
        git::{Commit, FullCommitData},
        graph::LayoutListEntry,
    },
    with_backend, GitBackend, StateType,
};

use crate::{
    error::{DefaultResult, Result},
    git::{
        graph_generator::GraphGenerator,
        history::{load_history_iter, map_commit},
        model::graph::GraphChangeData,
        with_backend_mut,
    },
    window_events::{TypedEmit, WindowEvents},
};

#[tauri::command]
pub async fn get_graph_entries(
    state: StateType<'_>,
    window: Window,
    start_idx: usize,
    end_idx: usize,
) -> Result<Vec<LayoutListEntry>> {
    log::debug!("Getting graph entries from {} to {}", start_idx, end_idx);
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
        log::debug!(
            "Returning graph entries: {:?}",
            return_batch.iter().map(|e| e.commit.as_graph_node().oid()),
        );
        Ok(return_batch)
    })
    .await
}

fn get_missing_oids(backend: &GitBackend) -> Vec<git2::Oid> {
    backend
        .graph
        .lines
        .last()
        .unwrap() // TODO I don't like this unwrap here
        .rails
        .iter()
        .filter_map(|entry| {
            entry
                .as_ref()
                .and_then(|e| git2::Oid::from_str(e.expected_parent.as_str()).ok())
        })
        .collect()
}

fn get_new_graph_lines(
    backend: &GitBackend,
    missing_oids: &[git2::Oid],
    batch_size: usize,
) -> Result<Vec<LayoutListEntry>> {
    let new_commits = load_history_iter(&backend.repo, None, Some(&missing_oids))?
        .filter_map(|c| {
            log::debug!("Result: {:?}", c);
            c.ok()
        })
        .filter_map(|c| map_commit(&c, false).ok());
    Ok(GraphGenerator::new(
        new_commits,
        Some(backend.graph.lines.last().unwrap().rails.clone()),
    )
    .take(batch_size)
    .collect())
}

fn load_more_graph_entries(
    backend: &mut GitBackend,
    additional_size: usize,
    window: Window,
) -> DefaultResult {
    let old_length = backend.graph.lines.len();
    log::debug!(
        "Need to calculate {} more graph lines. Currently have {}",
        additional_size,
        backend.graph.lines.len()
    );
    let missing_oids = get_missing_oids(&backend);
    log::debug!("Missing OIDs: {:?}", missing_oids);
    let new_lines = get_new_graph_lines(&backend, &missing_oids, additional_size + 50)?;
    backend.graph.lines.extend(new_lines);
    backend.graph.rails = backend.graph.lines.last().unwrap().rails.clone(); // TODO I don't like this unwrap()
    log::debug!("Graph now has {} lines", backend.graph.lines.len());
    emit_change_event(backend, window, old_length)?;
    Ok(())
}

fn emit_change_event(backend: &GitBackend, window: Window, old_length: usize) -> DefaultResult {
    if backend.graph.lines.len() != old_length {
        // TODO do a proper detection whether there are more lines to be had
        window.typed_emit(
            WindowEvents::HistoryChanged,
            GraphChangeData {
                total: backend.graph.lines.len() + 50,
                change_start_idx: 0,
                change_end_idx: backend.graph.lines.len(),
            },
        )?;
    } else {
        // when the graph length has stabilized, we can emit the proper length
        window.typed_emit(
            WindowEvents::HistoryChanged,
            GraphChangeData {
                total: backend.graph.lines.len(),
                change_start_idx: 0,
                change_end_idx: backend.graph.lines.len(),
            },
        )?;
    };
    Ok(())
}

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
