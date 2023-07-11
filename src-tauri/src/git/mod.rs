pub mod branches;
pub mod config;
pub mod credentials;
pub mod diff;
pub mod files;
pub mod git_merge_file;
pub mod graph;
pub mod history;
pub mod index;
pub mod merge;
pub mod model;
pub mod rebase;
pub mod remote;
pub mod stash;
pub mod tags;
pub mod worktree;

use std::{fs::OpenOptions, io::Write, sync::Arc};

use git2::{DiffOptions, Oid, Repository};
use log::info;
use serde::{Deserialize, Serialize};
use tauri::{async_runtime::Mutex, Window};

use crate::{
    error::{BackendError, DefaultResult},
    settings::Settings,
    window_events::{TypedEmit, WindowEvents},
};

use self::{
    history::do_get_graph,
    model::{
        graph::{GraphChangeData, GraphLayoutData, LayoutListEntry},
        BranchInfo,
    },
};

pub struct AppState {
    pub git: Option<GitBackend>,
    pub settings: Settings,
}

pub type StateType<'a> = tauri::State<'a, Arc<Mutex<AppState>>>;

pub struct GitBackend {
    repo: Repository,
    branches: Vec<BranchInfo>,
    pub graph: GraphLayoutData,
}

impl GitBackend {
    pub fn new(path: &str) -> Result<GitBackend, BackendError> {
        let repo = Repository::open(path)?;

        if repo.is_shallow() {
            Err(BackendError::new(format!(
                "{} is a shallow clone, which is currently not supported.",
                path
            )))
        } else {
            Ok(GitBackend {
                repo,
                branches: vec![],
                graph: GraphLayoutData {
                    lines: vec![],
                    rails: vec![],
                },
            })
        }
    }

    // pub fn load_history(&mut self, window: &Window) -> DefaultResult {
    //     let mut revwalk = self.repo.revwalk().unwrap(); // TODO
    //     revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    //     revwalk.push_glob("heads/*")?;
    //     let commits: Vec<Commit> = revwalk
    //         .filter_map(|c| {
    //             c.ok().map(|oid| {
    //                 self.repo
    //                     .find_commit(oid)
    //                     .ok()
    //                     .map(|commit| map_commit(&commit, false).unwrap()) // TODO this should not reference into the child
    //             })
    //         })
    //         .map(|e| e.unwrap())
    //         .collect();
    //     self.graph = calculate_graph_layout(commits);
    //     window.typed_emit(
    //         "HistoryChanged",
    //         GraphChangeData {
    //             total: self.graph.lines.len(),
    //             change_start_idx: 0,
    //             change_end_idx: self.graph.lines.len(),
    //         },
    //     )?;
    //     window.typed_emit("graphChanged", &self.graph)?;
    //     Ok(())
    // }
    //
    // pub fn load_repo_data(&mut self, window: &Window) -> DefaultResult {
    //     self.load_history(window)?;
    //     Ok(())
    // }
    //
    fn load_diff(
        &self,
        commit_id: Option<&str>,
        to_parent: Option<&str>,
        pathspec: &[Option<&str>],
    ) -> Result<git2::Diff, BackendError> {
        let oid = commit_id.map(Oid::from_str).transpose()?;
        let commit_tree = oid
            .map(|coid| self.repo.find_commit(coid).and_then(|c| c.tree()))
            .transpose()?;
        let parent_commit_oid = to_parent.map(Oid::from_str).transpose()?;
        let parent_commit_tree = parent_commit_oid
            .map(|pid| self.repo.find_commit(pid).and_then(|c| c.tree()))
            .transpose()?;
        let mut diff_opts = DiffOptions::new();
        diff_opts.patience(true);
        pathspec.iter().for_each(|&ps| {
            if let Some(p) = ps {
                diff_opts.pathspec(p);
            }
        });
        Ok(self.repo.diff_tree_to_tree(
            parent_commit_tree.as_ref(),
            commit_tree.as_ref(),
            Some(&mut diff_opts),
        )?)
    }
}

fn split_branch_name(
    branch: &(git2::Branch, git2::BranchType),
) -> Option<(Option<String>, String)> {
    if let Ok(Some(branch_name)) = branch.0.name() {
        if branch.1 == git2::BranchType::Remote {
            if let Some((remote, suffix)) = branch_name.split_once('/') {
                Some((Some(remote.to_owned()), suffix.to_owned()))
            } else {
                None
            }
        } else {
            Some((None, branch_name.to_owned()))
        }
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_graph_entries(
    state: StateType<'_>,
    start_idx: usize,
    end_idx: usize,
) -> Result<Vec<LayoutListEntry>, BackendError> {
    log::debug!("Getting graph entries from {} to {}", start_idx, end_idx);
    with_backend(state, |backend| {
        Ok(backend
            .graph
            .lines
            .iter()
            .skip(start_idx)
            .take(end_idx - start_idx)
            .cloned()
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn git_open(state: StateType<'_>, path: &str) -> DefaultResult {
    // WARNING Check whether this "open" really has to happen like this or whether this creates the lock file and blocks the git repo...
    let mut s = state.lock().await;
    s.git = Some(GitBackend::new(path)?);
    // TODO spawn of extra thread and possibly lock inside the backend
    info!("Successfully opened repo at {}", path);
    Ok(())
}

#[tauri::command]
pub async fn load_repo(state: StateType<'_>, window: Window) -> DefaultResult {
    with_backend_mut(state, |backend| {
        backend.graph = do_get_graph(backend, None)?;
        log::debug!(
            "Graph changed. Emitting event. {}",
            backend.graph.lines.len()
        );
        window.typed_emit(WindowEvents::GraphChanged, &backend.graph)?;
        window.typed_emit(
            WindowEvents::HistoryChanged,
            GraphChangeData {
                total: backend.graph.lines.len(),
                change_start_idx: 0,
                change_end_idx: backend.graph.lines.len(),
            },
        )?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub fn is_git_dir(name: &str) -> bool {
    Repository::open(name).is_ok()
}

#[tauri::command]
pub async fn add_to_gitignore(
    state: StateType<'_>,
    window: Window,
    pattern: &str,
) -> DefaultResult {
    with_backend(state, |backend| {
        let mut ignore_file_path = backend.repo.path().to_owned();
        if ignore_file_path.ends_with(".git") {
            ignore_file_path = ignore_file_path
                .parent()
                .ok_or_else(|| {
                    BackendError::new("Could not find repository root path.".to_owned())
                })?
                .to_path_buf();
        }
        ignore_file_path = ignore_file_path.join(".gitignore");
        let mut ignore_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(ignore_file_path)
            .map_err(|e| BackendError::new(e.to_string()))?;
        ignore_file
            .write(format!("{}\n", pattern).as_bytes())
            .map_err(|e| BackendError::new(e.to_string()))?;
        ignore_file
            .flush()
            .map_err(|e| BackendError::new(e.to_string()))?;
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[derive(Deserialize, Serialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum DiffSourceType {
    Workdir,
    Index,
    Commit,
    Stash,
}

pub async fn with_state<F: FnOnce(&AppState) -> std::result::Result<R, E>, R, E>(
    state: StateType<'_>,
    op: F,
) -> Result<R, E> {
    let state_guard = state.lock().await;
    op(&state_guard)
}

pub async fn with_state_mut<F: FnOnce(&mut AppState) -> std::result::Result<R, E>, R, E>(
    state: &StateType<'_>,
    op: F,
) -> Result<R, E> {
    let mut state_guard = state.lock().await;
    op(&mut state_guard)
}

pub async fn with_backend<F: FnOnce(&GitBackend) -> std::result::Result<R, BackendError>, R>(
    state: StateType<'_>,
    op: F,
) -> Result<R, BackendError> {
    let state_guard = state.lock().await;
    if let Some(git) = state_guard.git.as_ref() {
        op(git)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}

pub async fn with_backend_mut<
    F: FnOnce(&mut GitBackend) -> std::result::Result<R, BackendError>,
    R,
>(
    state: StateType<'_>,
    op: F,
) -> Result<R, BackendError> {
    let mut state_guard = state.lock().await;
    if let Some(git) = state_guard.git.as_mut() {
        op(git)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}
