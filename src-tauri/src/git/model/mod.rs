pub mod config;
pub mod git;
pub mod graph;
pub mod index;
pub mod remote;

use git2::{Branch, ErrorCode, Repository};

use crate::error::{BackendError, Result};

/**
 * information about an upstream branch
 */
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamInfo {
    /**
     * The name of the remote this upstream is located at
     */
    pub remote_name: String,
    /**
     * The ref name of the upstream branch
     */
    pub ref_name: String,
    /**
     * indicates, that the upstream branch is no longer available, e.g. after being deleted
     * remotely and purged on fetch
     */
    pub upstream_missing: bool,
    /**
     * how many commits are on the local branch not found on the remote
     */
    pub ahead: usize,
    /**
     * how many commits are on the remote branch, not found on the local
     */
    pub behind: usize,
}

/**
 * Information about a single branch
 */
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    /**
     * The ref name of the branch
     */
    pub ref_name: String,
    /**
     * The OID of the current HEAD of that branch
     */
    pub head: String,
    /**
     * the remote this branch belongs to, if any
     */
    pub remote: Option<String>,
    /**
     * the branch is the currently checked out branch
     */
    pub current: bool,
    /**
     * The upstream tracking branch, if any
     */
    pub upstream: Option<UpstreamInfo>,
    /**
     * For remote branches: which local branch tracks this remote branch?
     */
    pub tracked_by: Option<String>,
    /**
     * true if the branch is a detached HEAD
     */
    pub is_detached: bool,
    /**
     * the worktree directory this branch is checked out at
     */
    pub worktree: Option<String>,
    /**
     * Indicates that this branch is checked out at the common path (i.e. the
     * actual repository, not a worktree
     */
    pub is_on_common_path: bool,
}

impl TryFrom<&(git2::Branch<'_>, git2::BranchType)> for BranchInfo {
    type Error = BackendError;
    fn try_from(
        branch: &(git2::Branch, git2::BranchType),
    ) -> std::result::Result<Self, Self::Error> {
        if let Some((remote, branch_name)) = split_branch_name(branch) {
            Ok(BranchInfo {
                ref_name: branch_name,
                current: branch.0.is_head(),
                upstream: None,
                head: branch.0.get().peel_to_commit()?.id().to_string(),
                remote,
                tracked_by: None,
                is_detached: false,
                worktree: None,
                is_on_common_path: false,
            })
        } else {
            Err(BackendError {
                message: "Could not tranform branch".to_owned(),
            })
        }
    }
}

pub fn get_upstream(branch: &Branch, repo: &Repository) -> Result<Option<UpstreamInfo>> {
    if branch
        .get()
        .name()
        .map_or(false, |n| n.starts_with("refs/remotes"))
    {
        return Ok(None); // remote branches do not have an upstream
    }
    let upstream = branch.upstream();
    match upstream {
        Err(error) => {
            if error.code() == ErrorCode::NotFound {
                Ok(None)
            } else {
                log::error!("Cannot get upstream: {}", error);
                Err(error.into())
            }
        }
        Ok(u) => {
            let (ahead, behind) = repo.graph_ahead_behind(
                branch.get().peel_to_commit()?.id(),
                u.get().peel_to_commit()?.id(),
            )?;
            let remote_name = get_remote_name(
                    u.get().name().ok_or(BackendError {
                        message: "Cannot get remote name from non-existent branch name".to_owned(),
                    })?,
                    repo,
                )?;
            Ok(Some(UpstreamInfo {
                ahead,
                behind,
                ref_name: u
                    .name()?
                    .ok_or(BackendError {
                        message: "Cannot reference upstream branch without name".to_owned(),
                    })?
                    .split_at(remote_name.len() + 1)
                    .1
                    .to_owned(),
                upstream_missing: false, // TODO how do we detect a deleted upstream?
                remote_name,
            }))
        }
    }
}

fn get_remote_name(branch_name: &str, repo: &Repository) -> Result<String> {
    let remotes = repo.remotes()?;
    let mut valid_remotes: Vec<&str> = remotes.iter().flatten().collect();
    valid_remotes.sort_unstable_by_key(|r| r.len());
    valid_remotes
        .iter()
        .find(|&r| branch_name.contains(r))
        .map(|&r| r.to_owned())
        .ok_or(BackendError {
            message: "Could not find fitting remote for given branch".to_owned(),
        })
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
