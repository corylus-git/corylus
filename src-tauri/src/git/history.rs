use std::collections::HashMap;

use git2::{Delta, DiffOptions, Oid, Patch, Pathspec, PathspecFlags, Sort};
use tauri::Window;

use crate::error::BackendError;

use super::{
    graph::calculate_graph_layout,
    model::{
        git::{
            Commit, CommitStats, CommitStatsData, DiffStat, DiffStatus, FileStats, FullCommitData,
            GraphNodeData, ParentReference, StashData,
        },
        graph::GraphLayoutData,
    },
    with_backend, with_backend_mut, StateType,
};

fn replace_in_history(
    oid: &str,
    replace_with: &[ParentReference],
    commits: Vec<Commit>,
) -> Vec<Commit> {
    commits
        .into_iter()
        .map(|c| match &c {
            Commit::Stash(_) => c,
            Commit::Commit(data) => {
                let mut new_parents: Vec<ParentReference> = c
                    .as_graph_node()
                    .parents()
                    .into_iter()
                    .filter(|p| p.oid != oid)
                    .map(|p| p.clone())
                    .collect();
                if new_parents.len() < c.as_graph_node().parents().len() {
                    new_parents.extend_from_slice(replace_with);
                }
                Commit::Commit(FullCommitData {
                    oid: data.oid.clone(),
                    short_oid: data.short_oid.clone(),
                    parents: new_parents,
                    author: data.author.clone(),
                    message: data.message.clone(),
                    committer: data.committer.clone(),
                })
            }
        })
        .collect()
}

fn has_changes(
    commit: &git2::Commit,
    ps: &Pathspec,
    diffopts: &mut DiffOptions,
    repo: &git2::Repository,
) -> Result<bool, BackendError> {
    let parents = commit.parent_count();
    if parents == 0 {
        let tree = commit.tree()?;
        Ok(ps.match_tree(&tree, PathspecFlags::NO_MATCH_ERROR).is_ok())
    } else {
        // do we have any diff to a parent matching the path spec?
        let tree = commit.tree()?;
        let matching_parent = commit.parents().find(|parent| {
            let parent_tree_result = parent.tree();
            if let Ok(parent_tree) = parent_tree_result {
                let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(diffopts));
                diff.map(|d| d.deltas().count() > 0).unwrap_or(false)
            } else {
                false
            }
        });
        Ok(matching_parent.is_some())
    }
}

/// build a graph in the form of an adjecency map from the given commits
fn build_adjecency_map(commits: &Vec<Commit>) -> HashMap<String, Vec<String>> {
    let mut result = HashMap::<String, Vec<String>>::new();
    for commit in commits {
        result.insert(
            commit.as_graph_node().oid().to_owned(),
            commit
                .as_graph_node()
                .parents()
                .iter()
                .map(|p| p.oid.clone())
                .collect(),
        );
    }
    result
}

fn has_indirect_path(graph: &HashMap<String, Vec<String>>, start: &str, end: &str, is_start: bool) -> bool {
    let neighbors = graph.get(start);
    if let Some(n) = neighbors {
        for neighbor in n {
            if neighbor == end {
                return !is_start // paths only count if this is an indirect path
            } else {
                if has_indirect_path(graph, neighbor, end, false) {
                    return true
                }
            }
        }
        false
    }
    else {
        false
    }
}

fn transitive_reduction(commits: Vec<Commit>) -> Vec<Commit> {
    let mut result = vec![];
    let graph = build_adjecency_map(&commits);
    for commit in commits {
        if commit.as_graph_node().parents().len() > 1 {
            let mut simplified_parents = vec![];
            // should actually always match as we're not touching stashes
            if let Commit::Commit(mut data) = commit {
                // check whether we have multiple connections to the same parent
                for parent in data.parents {
                    if !has_indirect_path(&graph, &data.oid, &parent.oid, true) {
                        simplified_parents.push(parent);
                    }
                }
                data.parents = simplified_parents;
                result.push(Commit::Commit(data));
            }
        }
        else {
            result.push(commit);
        }
    }
    result
}

pub fn load_history(
    repo: &git2::Repository,
    pathspec: Option<&str>,
) -> Result<Vec<Commit>, BackendError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    revwalk.push_glob("heads/*")?;

    let ps = Pathspec::new(pathspec)?;
    let mut diffopts = DiffOptions::new();
    if let Some(p) = pathspec {
        log::debug!("Loading history for path spec {}", p);
        diffopts.pathspec(p);
    }

    let mut internal_history = vec![];
    for current in revwalk {
        let commit = current.and_then(|oid| repo.find_commit(oid))?;
        let output = map_commit(&commit, false)?;
        if has_changes(&commit, &ps, &mut diffopts, &repo)? {
            internal_history.push(output);
        } else {
            internal_history = replace_in_history(
                output.as_graph_node().oid(),
                output.as_graph_node().parents(),
                internal_history,
            );
        }
    }

    Ok(transitive_reduction(internal_history))
}

#[tauri::command]
pub async fn get_commits(
    state: StateType<'_>,
    pathspec: Option<&str>,
) -> Result<Vec<Commit>, BackendError> {
    with_backend(state, |backend| load_history(&backend.repo, pathspec)).await
}

#[tauri::command]
pub async fn get_graph(
    state: StateType<'_>,
    pathspec: Option<&str>,
) -> Result<GraphLayoutData, BackendError> {
    with_backend(state, |backend| {
        let commits = load_history(&backend.repo, pathspec)?;
        Ok(calculate_graph_layout(commits))
    })
    .await
}

#[tauri::command]
pub async fn get_commit(state: StateType<'_>, refNameOrOid: &str) -> Result<Commit, BackendError> {
    with_backend(state, |backend| {
        let parsed_oid =
            Oid::from_str(refNameOrOid).or_else(|_| backend.repo.refname_to_id(refNameOrOid))?;
        let commit = backend.repo.find_commit(parsed_oid)?;
        map_commit(&commit, false)
    })
    .await
}

#[tauri::command]
pub async fn get_commit_stats(
    state: StateType<'_>,
    window: Window,
    oid: &str,
) -> Result<(), BackendError> {
    with_backend_mut(state, |backend| {
        let commit =
            Oid::from_str(oid).and_then(|parsed_oid| backend.repo.find_commit(parsed_oid))?;
        let direct_diff = backend.repo.diff_tree_to_tree(
            commit.parent(0)?.tree().ok().as_ref(),
            commit.tree().ok().as_ref(),
            Some(DiffOptions::new().patience(true)),
        )?;
        let direct = map_diff(&direct_diff);

        let incoming = commit
            .parent(1)
            .and_then(|parent| parent.tree())
            .and_then(|tree| {
                backend.repo.diff_tree_to_tree(
                    Some(&tree),
                    commit.tree().as_ref().ok(),
                    Some(DiffOptions::new().patience(true)),
                )
            })
            .and_then(|diff| Ok(map_diff(&diff)))
            .ok();

        window.emit(
            "commitStatsChanged",
            CommitStats::Commit(CommitStatsData {
                commit: FullCommitData::try_from(&commit)?,
                direct,
                incoming,
            }),
        );
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn get_affected_branches(
    state: StateType<'_>,
    oid: String,
) -> Result<Vec<String>, BackendError> {
    with_backend(state, |backend| {
        let parsed_oid = Oid::from_str(&oid)?;
        let affected_branches = backend.branches.iter().filter(|&b| {
            Oid::from_str(b.head.as_str()).map_or(false, |candidate_oid| {
                backend
                    .repo
                    .graph_descendant_of(parsed_oid, candidate_oid)
                    .unwrap_or(false)
            })
        });
        Ok(affected_branches.map(|b| b.ref_name.clone()).collect())
    })
    .await
}

pub fn map_diff(diff: &git2::Diff) -> Vec<DiffStat> {
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
}

pub fn map_commit(commit: &git2::Commit, is_stash: bool) -> Result<Commit, BackendError> {
    if is_stash {
        Ok(Commit::Stash(StashData::try_from(commit)?))
    } else {
        Ok(Commit::Commit(FullCommitData::try_from(commit)?))
    }
}
