pub mod graph;
pub mod index;
pub mod diff;
mod model;

use std::{sync::Arc};

use git2::{Delta, DiffOptions, Oid, Patch, Repository, Sort};
use serde::{Deserialize, Serialize};
use tauri::{async_runtime::Mutex, Window};

use crate::error::BackendError;

use self::{
    graph::calculate_graph_layout,
    model::{
        git::{
            Commit, DiffStat, DiffStatus, FileStats, FullCommitData,
            GitCommitStats, GitPerson, ParentReference, TimeWithOffset,
        },
        graph::{GraphChangeData, GraphLayoutData, LayoutListEntry},
        BranchInfo,
    },
};

pub type BackendType = Arc<Mutex<Option<GitBackend>>>;
pub type StateType<'a> = tauri::State<'a, AppState>;

pub struct GitBackend {
    repo: Repository,
    branches: Vec<BranchInfo>,
    pub graph: GraphLayoutData,
}

pub struct AppState {
    pub backend: BackendType,
}

impl GitBackend {
    pub fn new(path: &str) -> Result<GitBackend, String> {
        Repository::open(path)
            .map(|repo| GitBackend {
                repo,
                branches: vec![],
                graph: GraphLayoutData {
                    lines: vec![],
                    rails: vec![],
                },
            })
            .map_err(|e| e.message().to_owned())
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
        window.emit("branchesChanged", &self.branches);
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
                        .map(|commit| map_commit(&commit))
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

    pub fn load_commit_stats(&self, window: Window, oid: &str) {
        let diff_result = Oid::from_str(oid)
            .and_then(|parsed_oid| self.repo.find_commit(parsed_oid))
            .and_then(|commit| {
                let direct: Vec<DiffStat> = self
                    .repo
                    .diff_tree_to_tree(
                        commit.parent(0)?.tree().ok().as_ref(),
                        commit.tree().ok().as_ref(),
                        Some(DiffOptions::new().patience(true)),
                    )
                    .map(|diff| {
                        diff.deltas()
                            .enumerate()
                            .map(|(idx, delta)| {
                                let (_, additions, deletions) = Patch::from_diff(&diff, idx)
                                    .ok()
                                    .flatten()
                                    .map(|p| p.line_stats().ok())
                                    .flatten()
                                    .unwrap_or((0, 0, 0));
                                DiffStat {
                                    file: FileStats {
                                        status: DiffStatus::from(delta.status()),
                                        path: delta
                                            .new_file()
                                            .path()
                                            .map(|p| p.to_string_lossy().to_string()),
                                    },
                                    source: None,
                                    old_path: if delta.status() == Delta::Renamed {
                                        delta
                                            .old_file()
                                            .path()
                                            .map(|p| p.to_string_lossy().to_string())
                                    } else {
                                        None
                                    },
                                    additions,
                                    deletions,
                                }
                            })
                            .collect()
                    })
                    .unwrap_or(vec![]);
                // TODO this prevents us from correctly handling Octopus merges for now
                // TODO map as above
                let incoming = commit
                    .parent(1)
                    .and_then(|parent| parent.tree())
                    .and_then(|tree| {
                        self.repo.diff_tree_to_tree(
                            Some(&tree),
                            commit.tree().as_ref().ok(),
                            Some(DiffOptions::new().patience(true)),
                        )
                    });

                Ok(GitCommitStats {
                    commit: map_commit(&commit),
                    direct,
                    incoming: vec![],
                })
            });
        if let Ok(diff) = diff_result {
            window.emit("commitStatsChanged", diff);
        } else {
            // TODO log
        };
    }

    fn load_diff(
        &self,
        commit_id: Option<&str>,
        to_parent: Option<&str>,
        pathspec: &[Option<&str>],
    ) -> Result<git2::Diff, BackendError> {
        let oid = commit_id
            .map(|id| Oid::from_str(id))
            .transpose()?;
        let commit_tree = oid
            .map(|coid| {
                self.repo
                    .find_commit(coid)
                    .and_then(|c| c.tree())
            })
            .transpose()?;
        let parent_commit_oid = to_parent
            .map(|id| Oid::from_str(id))
            .transpose()?;
        let parent_commit_tree = parent_commit_oid
            .map(|pid| {
                self.repo
                    .find_commit(pid)
                    .and_then(|c| c.tree())
            })
            .transpose()?;
        let mut diff_opts = DiffOptions::new();
        diff_opts.patience(true);
        pathspec.iter().for_each(|&ps| {
            if let Some(p) = ps {
                diff_opts.pathspec(p);
            }
        });
        Ok(self.repo
            .diff_tree_to_tree(
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

fn map_commit(commit: &git2::Commit) -> Commit {
    // TODO this ignores too many errors
    Commit::Commit(FullCommitData {
        oid: commit.as_object().id().to_string(),
        short_oid: commit
            .as_object()
            .short_id()
            .unwrap()
            .as_str()
            .unwrap()
            .to_owned(),
        message: commit.message_raw().unwrap().to_owned(),
        parents: commit
            .parents()
            .into_iter()
            .map(|p| ParentReference {
                oid: p.id().to_string(),
                short_oid: p
                    .as_object()
                    .short_id()
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_owned(),
            })
            .collect(),
        author: GitPerson {
            name: commit.author().name().unwrap().to_owned(),
            email: commit.author().email().unwrap().to_owned(),
            timestamp: TimeWithOffset {
                utc_seconds: commit.time().seconds(),
                offset_seconds: commit.time().offset_minutes() * 60,
            },
        },
        committer: GitPerson {
            name: commit.committer().name().unwrap().to_owned(),
            email: commit.committer().email().unwrap().to_owned(),
            timestamp: TimeWithOffset {
                utc_seconds: commit.time().seconds(),
                offset_seconds: commit.time().offset_minutes() * 60,
            },
        },
    })
}

#[tauri::command]
pub async fn get_graph_entries(
    state: StateType<'_>,
    start_idx: usize,
    end_idx: usize,
) -> Result<Vec<LayoutListEntry>, String> {
    let backend_guard = state.backend.lock().await;
    Ok((*backend_guard)
        .as_ref()
        .map_or(vec![], |b| b.graph.lines.clone()))
}

#[tauri::command]
pub async fn git_open(state: StateType<'_>, window: Window, path: &str) -> Result<(), String> {
    let backend = GitBackend::new(path)?;
    // WARNING Check whether this "open" really has to happen like this or whether this creates the lock file and blocks the git repo...
    let mut backend_guard = state.backend.lock().await;
    (*backend_guard) = Some(backend);
    // TODO spawn of extra thread and possibly lock inside the backend
    (*backend_guard).as_mut().map(|s| s.load_repo_data(&window));
    Ok(())
}

#[tauri::command]
pub fn is_git_dir(name: &str) -> bool {
    Repository::open(name).is_ok()
}

#[tauri::command]
pub async fn get_commit_stats(
    state: StateType<'_>,
    window: Window,
    oid: &str,
) -> Result<(), String> {
    let mut backend_guard = state.backend.lock().await;
    (*backend_guard)
        .as_mut()
        .map(|s| s.load_commit_stats(window, oid));
    Ok(())
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DiffSourceType {
    Workdir,
    Index,
    Commit,
    Stash,
}

pub async fn with_backend<F: FnOnce(&GitBackend) -> Result<R, BackendError>, R>(state: StateType<'_>, op: F) -> Result<R, BackendError>
{
    let backend_guard = state.backend.lock().await;
    if let Some(backend) = (*backend_guard).as_ref() {
        op(backend)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}

pub async fn with_backend_mut<F: FnOnce(&mut GitBackend) -> Result<R, BackendError>, R>(state: StateType<'_>, op: F) -> Result<R, BackendError>
{
    let mut backend_guard = state.backend.lock().await;
    if let Some(backend) = (*backend_guard).as_mut() {
        op(backend)
    } else {
        Err(BackendError::new("Cannot load diff without open git repo"))
    }
}