pub mod config;
pub mod git;
pub mod graph;
pub mod index;
pub mod remote;

use crate::error::BackendError;

/**
 * Information about a single branch
 */
#[derive(Clone, serde::Serialize)]
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
    // upstream?: UpstreamInfo;
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
    fn try_from(branch: &(git2::Branch, git2::BranchType)) -> Result<Self, Self::Error> {
        if let Some((remote, branch_name)) = split_branch_name(branch) {
            Ok(BranchInfo {
                ref_name: branch_name,
                current: branch.0.is_head(),
                head: branch
                    .0
                    .get()
                    .peel_to_commit()?
                    .id()
                    .to_string(),
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
