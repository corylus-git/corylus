use git2::RepositoryState;
use log::debug;
use serde::Deserialize;
use tauri::Window;

use crate::{
    error::DefaultResult,
    window_events::{TypedEmit, WindowEvents},
};

use super::{
    history::do_get_graph,
    model::graph::{GraphChangeData, GraphLayoutData},
    GitBackend,
};

pub fn do_stage(repo: &git2::Repository, path: &str) -> DefaultResult {
    let mut index = repo.index()?;
    index.add_all([path], git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn do_commit(
    backend: &mut GitBackend,
    window: Window,
    message: &str,
    amend: bool,
    merge_parents: Vec<git2::Oid>,
) -> DefaultResult {
    let tree_id = backend.repo.index()?.write_tree()?;
    {
        backend.repo.index()?.write()?;

        let tree = backend.repo.find_tree(tree_id)?;
        let head = backend.repo.head().and_then(|h| h.peel_to_commit())?;
        let signature = backend.repo.signature()?;
        if amend {
            let amended = head.amend(Some("HEAD"), None, None, None, Some(message), Some(&tree))?;
            debug!("Amended commit {:?}->{:?}", head, amended);
        } else {
            let mut parents = vec![head];
            let additional_parent_commits: std::result::Result<Vec<git2::Commit>, git2::Error> =
                merge_parents
                    .iter()
                    .map(|id| backend.repo.find_commit(*id))
                    .collect();
            parents.extend(additional_parent_commits?);
            if backend.repo.state() == RepositoryState::Merge {
                let mut repo = git2::Repository::open(backend.repo.path())?;
                repo.mergehead_foreach(|head| {
                    let commit = backend.repo.find_commit(*head);
                    if let Ok(commit) = commit {
                        parents.push(commit);
                        true
                    } else {
                        false
                    }
                })?;
            }
            let parent_refs: Vec<&git2::Commit> = parents.iter().collect(); // the call below expects references to the commits, which is a bit complicated with the owned commits above

            let oid = backend.repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &parent_refs,
            )?;

            if backend.repo.state() == git2::RepositoryState::Merge
                && !backend.repo.index()?.has_conflicts()
            {
                backend.repo.cleanup_state()?;
                window.typed_emit(WindowEvents::RepoStateChanged, ())?;
            }
            debug!("Committed {}", oid);
        }
    }
    // load_history(&backend.repo, None)?;
    // TODO those have nothing to do in here. References to Tauri should only live in the API module
    window.typed_emit(WindowEvents::StatusChanged, ())?;
    window.typed_emit(WindowEvents::BranchesChanged, ())?;
    // TODO this repeats code from git_open -> don't like this current setup
    let lines = do_get_graph(&backend.repo, None)?.collect();
    backend.graph = GraphLayoutData {
        lines,
        rails: vec![],
    };
    window.typed_emit(
        WindowEvents::HistoryChanged,
        GraphChangeData {
            total: backend.graph.lines.len(),
            change_end_idx: 0,
            change_start_idx: backend.graph.lines.len(),
        },
    )?;
    Ok(())
}

#[derive(Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    Ours,
    Theirs,
}
