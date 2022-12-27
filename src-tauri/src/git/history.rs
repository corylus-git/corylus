use git2::{Delta, DiffOptions, Oid, Patch, Sort, Pathspec, PathspecFlags};
use tauri::Window;

use crate::error::BackendError;

use super::{
    model::{
        git::{
            Commit, CommitStats, CommitStatsData, DiffStat, DiffStatus, FileStats, FullCommitData,
            StashData,
        },
        graph::GraphLayoutData,
    },
    with_backend, with_backend_mut, StateType, graph::calculate_graph_layout,
};

pub fn load_history(repo: &git2::Repository, pathspec: Option<&str>) -> Result<Vec<Commit>, BackendError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    revwalk.push_glob("heads/*")?;

    let ps = Pathspec::new(pathspec)?;
    let mut diffopts = DiffOptions::new();
    if let Some(p) = pathspec {
        log::debug!("Loading history for path spec {}", p);
        diffopts.pathspec(p);
    }

    Ok(revwalk
        .filter_map(|c| {
            let commit = c.ok().map(|oid| repo.find_commit(oid).ok()).flatten()?;
            let parents = commit.parent_count();
            if parents == 0 {
                let tree = commit.tree().ok()?;
                if ps.match_tree(&tree, PathspecFlags::NO_MATCH_ERROR).is_ok() {
                    map_commit(&commit, false).ok()
                }
                else {
                    None
                }
            } else {
                // do we have any diff to a parent matching the path spec?
                let tree = commit.tree().ok()?;
                let matching_parent = commit.parents().find(|parent| {
                    let parent_tree_result = parent.tree();
                    if let Ok(parent_tree) = parent_tree_result {
                        let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut diffopts));
                        diff.map(|d| d.deltas().count() > 0).unwrap_or(true)
                    } else {
                        false
                    }
                });
                matching_parent.map(|_| map_commit(&commit, false).ok()).flatten() // if any parent diff matches, the commit is in the history
            }
        })
        .collect())
}

#[tauri::command]
pub async fn get_commits( 
    state: StateType<'_>,
    pathspec: Option<&str>,
) -> Result<Vec<Commit>, BackendError>
{
    with_backend(state, |backend| {
        load_history(&backend.repo, pathspec)
    }).await
}

#[tauri::command]
pub async fn get_graph(
    state: StateType<'_>,
    pathspec: Option<&str>,
) -> Result<GraphLayoutData, BackendError> {
    with_backend(state, |backend| {
        let commits = load_history(&backend.repo, pathspec)?;
        Ok(calculate_graph_layout(commits))
    }).await
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
