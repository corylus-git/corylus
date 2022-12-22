pub mod diff;
pub mod graph;
pub mod history;
pub mod index;
pub mod model;
pub mod remote;
pub mod stash;
pub mod branches;

use std::sync::Arc;

use git2::{DiffOptions, Oid, Repository, Sort};
use log::info;
use serde::{Deserialize, Serialize};
use tauri::{async_runtime::Mutex, Window};

use crate::{error::BackendError, settings::Settings};

use self::{
    graph::calculate_graph_layout,
    history::map_commit,
    model::{
        graph::{GraphChangeData, GraphLayoutData, LayoutListEntry},
        BranchInfo, git::Commit,
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
        Ok(Repository::open(path).map(|repo| GitBackend {
            repo,
            branches: vec![],
            graph: GraphLayoutData {
                lines: vec![],
                rails: vec![],
            },
        })?)
    }

    pub fn load_branches(&mut self, window: &Window) {
        let branches_result = self.repo.branches(None).map(|branches| {
            let branch_data: Vec<BranchInfo> = branches
                .filter_map(|b| {
                    if let Ok(branch) = b {
                        if let Some((remote, branch_name)) = split_branch_name(&branch) {
                            Some(BranchInfo {
                                ref_name: branch_name,
                                current: (&branch.0).is_head(),
                                head: branch
                                    .0
                                    .into_reference()
                                    .peel_to_commit()
                                    .unwrap()
                                    .id()
                                    .to_string(),
                                remote,
                                tracked_by: None,
                                is_detached: false,
                                worktree: None,
                            })
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();
            branch_data
        });
        self.branches = branches_result.unwrap_or_default();
        window.emit("branches-changed", {});
    }

    pub fn load_history(&mut self, window: &Window) {
        let mut revwalk = self.repo.revwalk().unwrap(); // TODO
        revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME);
        revwalk.push_glob("heads/*");
        let commits: Vec<Commit> = revwalk
            .filter_map(|c| {
                c.ok().map(|oid| {
                    self.repo
                        .find_commit(oid)
                        .ok()
                        .map(|commit| map_commit(&commit, false).unwrap()) // TODO this should not reference into the child
                })
            })
            .map(|e| e.unwrap())
            .collect();
        self.graph = calculate_graph_layout(commits);
        window.emit(
            "historyChanged",
            GraphChangeData {
                total: self.graph.lines.len(),
                change_start_idx: 0,
                change_end_idx: self.graph.lines.len(),
            },
        );
        window.emit("graphChanged", &self.graph);
    }

    pub fn load_repo_data(&mut self, window: &Window) {
        self.load_branches(window);
        self.load_history(window);
    }

    fn load_diff(
        &self,
        commit_id: Option<&str>,
        to_parent: Option<&str>,
        pathspec: &[Option<&str>],
    ) -> Result<git2::Diff, BackendError> {
        let oid = commit_id.map(|id| Oid::from_str(id)).transpose()?;
        let commit_tree = oid
            .map(|coid| self.repo.find_commit(coid).and_then(|c| c.tree()))
            .transpose()?;
        let parent_commit_oid = to_parent.map(|id| Oid::from_str(id)).transpose()?;
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
            if let Some((remote, suffix)) = branch_name.split_once("/") {
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
pub async fn git_open(
    state: StateType<'_>,
    window: Window,
    path: &str,
) -> Result<(), BackendError> {
    // WARNING Check whether this "open" really has to happen like this or whether this creates the lock file and blocks the git repo...
    with_state_mut(state, |s| {
        s.git = Some(GitBackend::new(path)?);
        // TODO spawn of extra thread and possibly lock inside the backend
        s.git.as_mut().unwrap().load_repo_data(&window);
        info!("Successfully opened repo at {}", path);
        Ok(())
    })
    .await
}

#[tauri::command]
pub fn is_git_dir(name: &str) -> bool {
    Repository::open(name).is_ok()
}

#[tauri::command]
pub async fn get_branches(state: StateType<'_>) -> Result<Vec<BranchInfo>, BackendError> {
    with_backend(state, |backend| Ok(backend.branches.clone())).await
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DiffSourceType {
    Workdir,
    Index,
    Commit,
    Stash,
}

pub async fn with_state<F: FnOnce(&AppState) -> Result<R, E>, R, E>(
    state: StateType<'_>,
    op: F,
) -> Result<R, E> {
    let state_guard = state.lock().await;
    op(&*state_guard)
}

pub async fn with_state_mut<F: FnOnce(&mut AppState) -> Result<R, E>, R, E>(
    state: StateType<'_>,
    op: F,
) -> Result<R, E> {
    let mut state_guard = state.lock().await;
    op(&mut *state_guard)
}

pub async fn with_backend<F: FnOnce(&GitBackend) -> Result<R, BackendError>, R>(
    state: StateType<'_>,
    op: F,
) -> Result<R, BackendError> {
    let state_guard = state.lock().await;
    if let Some(git) = (*state_guard).git.as_ref() {
        op(&git)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}

pub async fn with_backend_mut<F: FnOnce(&mut GitBackend) -> Result<R, BackendError>, R>(
    state: StateType<'_>,
    op: F,
) -> Result<R, BackendError> {
    let mut state_guard = state.lock().await;
    if let Some(git) = (*state_guard).git.as_mut() {
        op(git)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}
