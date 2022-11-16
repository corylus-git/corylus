use git2::{Delta, DiffOptions, Oid, Patch};
use tauri::Window;

use crate::error::BackendError;

use super::{
    model::git::{
        Commit, DiffStat, DiffStatus, FileStats, FullCommitData, GitCommitStats, GitPerson,
        ParentReference, TimeWithOffset,
    },
    with_backend_mut, StateType,
};

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

        let incoming_diff = commit
            .parent(1)
            .and_then(|parent| parent.tree())
            .and_then(|tree| {
                backend.repo.diff_tree_to_tree(
                    Some(&tree),
                    commit.tree().as_ref().ok(),
                    Some(DiffOptions::new().patience(true)),
                )
            })?;
        let incoming = map_diff(&incoming_diff);
        window.emit(
            "commitStatsChanged",
            GitCommitStats {
                commit: map_commit(&commit),
                direct,
                incoming,
            },
        );
        Ok(())
    })
    .await
}

fn map_diff(diff: &git2::Diff) -> Vec<DiffStat> {
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

pub fn map_commit(commit: &git2::Commit) -> Commit {
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
