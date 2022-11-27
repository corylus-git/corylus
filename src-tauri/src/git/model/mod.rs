pub mod graph;
pub mod git;
pub mod index;
pub mod remote;

/**
 * Information about a single branch
 */
#[derive(Clone, serde::Serialize)]
#[serde(rename_all="camelCase")]
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
    pub worktree: Option<String>
}