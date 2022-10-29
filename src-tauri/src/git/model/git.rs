use serde::Serialize;

/**
 * A reference to a parent with short and full OID
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct ParentReference {
    pub oid: String,
    pub short_oid: String
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct TimeWithOffset {
    pub utc_seconds: i64, 
    pub offset_seconds: i32
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct GitPerson {
    pub name: String,
    pub email: String,
    pub timestamp: TimeWithOffset
}

pub trait GraphNodeData {
    fn oid<'a>(&'a self) -> &'a str;
    fn parents<'a>(&'a self) -> &'a Vec<ParentReference>;
}

/**
 * Detailed information about a commit
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct FullCommitData {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub parents: Vec<ParentReference>,
    pub author: GitPerson,
    pub committer: GitPerson
}

impl GraphNodeData for FullCommitData {
    fn oid<'a>(&'a self) -> &'a str {
        &self.oid
    }

    fn parents<'a>(&'a self) -> &'a Vec<ParentReference> {
        &self.parents
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(tag = "type")]
pub enum Commit {
    FullCommit(FullCommitData),
}

impl Commit {
    pub fn as_graph_node(&self) -> &dyn GraphNodeData {
        match self {
            Commit::FullCommit(data) => data
        }
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub enum DiffStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Conflict,
    Unknown,
    Unmodified,
    Untracked
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct FileStats {
    /**
     * the status of the file in this commit
     */
    pub status: DiffStatus,
    /**
     * The path of the object these stats apply to
     */
    pub path: Option<String>
}

/**
 * Statistics of a specific entry in a diff (as output by git show --stat)
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct DiffStat {
    /**
     * The file this diff stat refers to
     */
    pub file: FileStats,
    /**
     * The source of the difference (i.e. named source like index or untracked for stashes or specific parent for merge commits)
     */
    pub source: Option<String>,
    /**
     * The old path, if any. Only applicable to renamed files
     */
    pub old_path: Option<String>,
    /**
     * The number of added lines
     */
    pub additions: usize,
    /**
     * The number of deleted lines
     */
    pub deletions: usize
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct GitCommitStats {
    /**
     * The commit these stats belong to
     */
    pub commit: Commit,

    /**
     * The changes directly in this commit
     */
    pub direct: Vec<DiffStat>,

    /**
     * The incoming changes, i.e. the changes between a merge commit and its first parent
     * Only valid filled for merge commits
     */
    pub incoming: Vec<DiffStat>

}