use std::{collections::HashMap, time::Instant};

use git2::{Delta, DiffOptions, Oid, Patch, Pathspec, PathspecFlags, Repository, Sort};

use crate::error::{BackendError, Result};

use super::{
    graph_generator::GraphGenerator,
    model::{
        git::{
            Commit, CommitStats, CommitStatsData, DiffStat, DiffStatus, FileStats, FullCommitData,
            ParentReference, StashData,
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
                    .iter()
                    .filter(|p| p.oid != oid)
                    .cloned()
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
) -> Result<bool> {
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

fn has_indirect_path(
    graph: &HashMap<String, Vec<String>>,
    start: &str,
    end: &str,
    is_start: bool,
) -> bool {
    let neighbors = graph.get(start);
    if let Some(n) = neighbors {
        for neighbor in n {
            if neighbor == end {
                return !is_start; // paths only count if this is an indirect path
            } else if has_indirect_path(graph, neighbor, end, false) {
                return true;
            }
        }
        false
    } else {
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
        } else {
            result.push(commit);
        }
    }
    result
}

// TODO this is missing the pathspec case because we don't have a way to retroactively change the commits we've already returned.
// maybe we need to consume the revwalk until we've stabilised all parents for a specific commit before returning this commit
pub fn load_history_iter<'a>(
    repo: &'a git2::Repository,
    pathspec: Option<&'a str>,
    from_oids: Option<&[git2::Oid]>,
) -> Result<impl Iterator<Item = Result<git2::Commit<'a>>>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    if let Some(oids) = from_oids {
        for &reference in oids {
            revwalk.push(reference)?;
        }
    } else {
        revwalk.push_glob("heads")?;
        revwalk.push_glob("remotes")?;
    }
    let ps = Pathspec::new(pathspec)?;
    let mut diffopts = DiffOptions::new();
    if let Some(p) = pathspec {
        log::debug!("Loading history for path spec {}", p);
        diffopts.pathspec(p);
    }

    Ok(revwalk.filter_map(move |res| {
        let commit = res.and_then(|oid| repo.find_commit(oid));

        commit
            .map(|commit| {
                if pathspec.is_none() {
                    return Some(Ok(commit));
                }
                has_changes(&commit, &ps, &mut diffopts, repo)
                    .map(|has_changes| {
                        if has_changes {
                            Some(Ok(commit))
                        } else {
                            // TODO here we need to "rewrite" history
                            None
                        }
                    })
                    .unwrap_or_else(|e| Some(Err(e)))
            })
            .unwrap_or_else(|e| Some(Err(e.into())))
    }))
}

pub fn load_history(repo: &git2::Repository, pathspec: Option<&str>) -> Result<Vec<Commit>> {
    let start = Instant::now();
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    revwalk.push_glob("heads")?;
    revwalk.push_glob("remotes")?;

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
        if pathspec.is_none() || has_changes(&commit, &ps, &mut diffopts, repo)? {
            internal_history.push(output);
        } else {
            internal_history = replace_in_history(
                output.as_graph_node().oid(),
                output.as_graph_node().parents(),
                internal_history,
            );
        }
    }

    Ok(if pathspec.is_some() {
        // do not reduce for full graphs as this algorithm is currently really inefficient
        transitive_reduction(internal_history)
    } else {
        log::debug!(
            "Loaded {} history elements in {} ms",
            internal_history.len(),
            start.elapsed().as_millis()
        );
        internal_history
    })
}

#[tauri::command]
pub async fn get_history_size(state: StateType<'_>) -> Result<usize> {
    with_backend(state, |backend| {
        let additional_lines_estimate =
            backend
                .graph
                .lines
                .last()
                .map_or(100, |line| if line.has_parent_line { 100 } else { 0 }); // we'll just tack some additional lines onto the end in case there are parents, but we don't load them yet
        Ok(backend.graph.lines.len() + additional_lines_estimate)
    })
    .await
}

#[tauri::command]
pub async fn get_commits(state: StateType<'_>, pathspec: Option<&str>) -> Result<Vec<Commit>> {
    with_backend(state, |backend| load_history(&backend.repo, pathspec)).await
}

#[tauri::command]
pub async fn get_graph(state: StateType<'_>, pathspec: Option<&str>) -> Result<GraphLayoutData> {
    with_backend(state, |backend| {
        Ok(GraphLayoutData {
            lines: do_get_graph(&backend.repo, pathspec)?.collect(),
            rails: vec![],
        })
    })
    .await
}

pub struct CommitBatchIterator<'iter_lifetime> {
    repo: &'iter_lifetime Repository,
    unseen_oids: Vec<git2::Oid>,
    batch_size: usize,
}

impl CommitBatchIterator<'_> {
    pub fn new<'repo_lifetime>(
        repo: &'repo_lifetime Repository,
        batch_size: usize,
        from_revs: &[&str],
    ) -> Result<CommitBatchIterator<'repo_lifetime>> {
        let rev_oids: Result<Vec<git2::Oid>> = from_revs
            .iter()
            .filter_map(|rev| {
                repo.revparse_ext(rev)
                    .ok()
                    .and_then(|(_, reference)| reference)
            })
            .map(|reference| {
                reference
                    .peel_to_commit()
                    .map(|c| c.id())
                    .map_err(|e| BackendError::new(format!("Could not map OID {}", e.message())))
            })
            .collect();
        Ok(CommitBatchIterator {
            repo,
            unseen_oids: rev_oids?,
            batch_size,
        })
    }
}

impl Iterator for CommitBatchIterator<'_> {
    type Item = Vec<Commit>;

    fn next(&mut self) -> Option<Self::Item> {
        let iter = load_history_iter(&self.repo, None, Some(&self.unseen_oids)).ok()?; // TODO log the error instead of turning it into a missing element
        let next_batch: Vec<Commit> = iter
            .filter_map(|res| res.ok())
            .filter_map(|c| map_commit(&c, false).ok())
            .collect();
        self.unseen_oids.extend(next_batch.iter().flat_map(|entry| {
            entry
                .as_graph_node()
                .parents()
                .iter()
                .filter_map(|parent| Oid::from_str(&parent.oid).ok())
        }));
        self.unseen_oids = self
            .unseen_oids
            .iter()
            .cloned() // TODO don't like this here. Actually we want to replace the unseen_oids above in one step
            .filter(|oid| {
                next_batch
                    .iter()
                    .any(|entry| oid.to_string() == entry.as_graph_node().oid())
            })
            .collect();
        if next_batch.is_empty() {
            None
        } else {
            Some(next_batch)
        }
    }
}

pub fn do_get_graph<'repo_lifetime>(
    repo: &'repo_lifetime git2::Repository,
    pathspec: Option<&'repo_lifetime str>,
) -> Result<GraphGenerator<'repo_lifetime>> {
    // TODO once we got the iter-variant to support pathspec we can remove this distinction
    if pathspec.is_some() {
        // let commits = load_history(&backend.repo, pathspec)?.into_iter();
        // let graph_layout = GraphGenerator::new(commits);
        // Ok(graph_layout)
        Err(BackendError::new("Currently broken due to type errors"))
    } else {
        let commits = load_history_iter(&repo, pathspec, None)?
            .filter_map(|res| res.ok())
            .filter_map(|c| map_commit(&c, false).ok());
        let graph_layout = GraphGenerator::new(Box::new(commits), None);

        Ok(graph_layout)
    }
}

#[tauri::command]
pub async fn get_commit(state: StateType<'_>, ref_name_or_oid: &str) -> Result<Commit> {
    log::trace!("Requesting commit information for {}", ref_name_or_oid);
    with_backend(state, |backend| {
        let obj = backend.repo.revparse_single(ref_name_or_oid)?;
        let commit = obj.peel_to_commit()?;
        map_commit(&commit, false)
    })
    .await
}

#[tauri::command]
pub async fn get_commit_stats(state: StateType<'_>, oid: &str) -> Result<CommitStats> {
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
            .map(|diff| map_diff(&diff))
            .ok();

        let commit_stats = CommitStats::Commit(CommitStatsData {
            commit: FullCommitData::try_from(&commit)?,
            direct,
            incoming,
        });
        Ok(commit_stats)
    })
    .await
}

#[tauri::command]
pub async fn get_affected_branches(state: StateType<'_>, oid: String) -> Result<Vec<String>> {
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
            let (_, additions, deletions) = Patch::from_diff(diff, idx)
                .ok()
                .flatten()
                .and_then(|p| p.line_stats().ok())
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

pub fn map_commit(commit: &git2::Commit, is_stash: bool) -> Result<Commit> {
    if is_stash {
        Ok(Commit::Stash(StashData::try_from(commit)?))
    } else {
        Ok(Commit::Commit(FullCommitData::try_from(commit)?))
    }
}
