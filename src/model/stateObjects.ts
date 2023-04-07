import { Maybe } from '../util/maybe';

/**
 * information about an upstream branch
 */
export interface UpstreamInfo {
    /**
     * The name of the remote this upstream is located at
     */
    remoteName: string;
    /**
     * The ref name of the upstream branch
     */
    refName: string;
    /**
     * indicates, that the upstream branch is no longer available, e.g. after being deleted
     * remotely and purged on fetch
     */
    upstreamMissing?: boolean;
    /**
     * how many commits are on the local branch not found on the remote
     */
    ahead: number;
    /**
     * how many commits are on the remote branch, not found on the local
     */
    behind: number;
}

/**
 * Information about a single branch
 */
export interface BranchInfo {
    /**
     * The ref name of the branch
     */
    refName: string;
    /**
     * The OID of the current HEAD of that branch
     */
    head: string;
    /**
     * the remote this branch belongs to
     */
    remote?: string;
    /**
     * the branch is the currently checked out branch
     */
    current?: boolean;
    /**
     * The upstream tracking branch, if any
     */
    upstream?: UpstreamInfo;
    /**
     * For remote branches: which local branch tracks this remote branch?
     */
    trackedBy?: string;
    /**
     * true if the branch is a detached HEAD
     */
    isDetached?: boolean;
    /**
     * the worktree directory this branch is checked out at
     */
    worktree?: string;
    /**
     *
    */
    isOnCommonPath: boolean;
}

/**
 * information about a tag in the repository
 */
export interface Tag {
    /**
     * The name of the tag
     */
    name: string;

    /**
     * The OID of the tag itself
     */
    oid?: string;

    /**
     * The OID of the commit this tag refers to
     */
    taggedOid: string;
}

/**
 * meta information about remotes as provided by isomorphic-git
 */
export interface RemoteMeta {
    /**
     * The name of the remote
     */
    remote: string;
    /**
     * The URL this remote can be reached under
     */
    url: string;
}

/**
 * Extended information about remotes with its branches attached
 */
export interface Remote extends RemoteMeta {
    /**
     * The branches available at this remote
     */
    branches: BranchInfo[];
}

export interface Person {
    readonly name: string;
    readonly email: string;
}

export interface Timestamp {
    utcSeconds: number;
    offsetSeconds: number;
}

export interface GitPerson extends Person {
    readonly timestamp: Timestamp
}
// TODO check whether this works if a commit is from a different timezone
export function formatTimestamp(timestamp: Timestamp) {
    return new Date((timestamp.utcSeconds) * 1000).toLocaleString();
}

/**
 * Meta-information about the currently pending commit
 */
export interface PendingCommit {
    readonly message: string;
    readonly parents: string[];
}

/**
 * A reference to a parent with short and full OID
 */
export interface ParentReference {
    oid: string;
    short_oid: string;
}

/**
 * Meta-information about a commit without
 */
export interface Stash {
    type: 'stash';
    readonly refName: string;
    readonly oid: string;
    readonly shortOid: string;
    readonly message: string;
    readonly parents: ParentReference[];
    readonly author: GitPerson;
}

/**
 * meta-information about a commit
 */
export interface FullCommit {
    type: 'commit';
    readonly oid: string;
    readonly shortOid: string;
    readonly message: string;
    readonly parents: ParentReference[];
    readonly author: GitPerson;
    readonly committer: GitPerson;
}

export type Commit = Stash | FullCommit;

/**
 * The status a file can have in a diff
 */
export type DiffStatus =
    | 'added'
    | 'modified'
    | 'deleted'
    | 'renamed'
    | 'conflict'
    | 'unknown'
    | 'unmodified'
    | 'untracked';

export interface IndexStatus {
    /**
     * The file path this status applies to
     */
    path: string;

    /**
     * The status of this file in the working copy
     */
    workdirStatus: DiffStatus;

    /**
     * The status of this file in the index/staging area
     */
    indexStatus: DiffStatus;

    /**
     * Denotes whether the file is currently staged in any form
     */
    isStaged: boolean;

    /**
     * Denotes whether the file is currently in conflict due to a broken merge
     */
    isConflicted: boolean;
}

export interface FileStats {
    /**
     * the status of the file in this commit
     */
    status: DiffStatus;
    /**
     * The path of the object these stats apply to
     */
    path: string;
}

/**
 * Statistics of a specific entry in a diff (as output by git show --stat)
 */
export interface DiffStat {
    /**
     * Details about the file this refers to
     */
    file: FileStats;
    /**
     * The source of the difference (i.e. named source like index or untracked for stashes or specific parent for merge commits)
     */
    source?: string;
    /**
     * The old path, if any. Only applicable to renamed files
     */
    oldPath?: string;
    /**
     * The number of added lines
     */
    additions: number;
    /**
     * The number of deleted lines
     */
    deletions: number;
}

/**
 * A more detailled version of the commit including the diff stats
 */
export interface CommitStatsData {
    /**
     * The type as delivered from the backend
     */
    type: 'commit';
    /**
     * The commit these stats belong to
     */
    readonly commit: FullCommit;

    /**
     * The changes directly in this commit
     */
    readonly direct: readonly DiffStat[];

    /**
     * The incoming changes, i.e. the changes between a merge commit and its first parent
     * Only valid filled for merge commits
     */
    readonly incoming?: readonly DiffStat[];
}

export interface StashStatsData {
    /**
     * The type as delivered from the backend
     */
    type: 'stash';
    /**
    * The stash these stats belong to
    */
    readonly stash: Stash;

    readonly changes: readonly DiffStat[];

    readonly index?: readonly DiffStat[];
    
    readonly untracked?: readonly DiffStat[];
}

export type CommitStats = CommitStatsData | StashStatsData;

/**
 * Blame info about a file
 */
export interface BlameInfo {
    oid: string;
    author: string;
    mail: string;
    timestamp: Date;
    summary: string;
    content: readonly string[];
}

/**
 * Interface describing a single action in an interactive rebase process
 */
export interface RebaseAction {
    /**
     * The action to be taken with the commit (pick, drop etc.)
     */
    action: string;
    /**
     * The commit in question
     */
    commit: Commit;
}

/**
 * Information about a possible rebase, that is currently in progress
 */
export interface RebaseStatusInfo {
    /**
     * Commits that were already done
     */
    done: readonly RebaseAction[];
    /**
     * The current patch that causes a conflict during the rebase
     */
    patch: string;
    /**
     * The current message of the commit that caused the conflict
     */
    message: string;
    /**
     * The commits that are still open to be rebased
     */
    todo: readonly RebaseAction[];
}
