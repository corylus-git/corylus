use serde::Serialize;

use crate::error::BackendError;

/**
 * A reference to a parent with short and full OID
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ParentReference {
    pub oid: String,
    pub short_oid: String,
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimeWithOffset {
    pub utc_seconds: i64,
    pub offset_seconds: i32,
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitPerson {
    pub name: String,
    pub email: String,
    pub timestamp: TimeWithOffset,
}

pub trait GraphNodeData {
    fn oid<'a>(&'a self) -> &'a str;
    fn parents<'a>(&'a self) -> &'a Vec<ParentReference>;
}

/**
 * Detailed information about a commit
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullCommitData {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub parents: Vec<ParentReference>,
    pub author: GitPerson,
    pub committer: GitPerson,
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
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Commit {
    Commit(FullCommitData),
}

impl Commit {
    pub fn as_graph_node(&self) -> &dyn GraphNodeData {
        match self {
            Commit::Commit(data) => data,
        }
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum DiffStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Conflict,
    Unknown,
    Unmodified,
    Untracked,
}

impl From<git2::Delta> for DiffStatus {
    fn from(delta: git2::Delta) -> Self {
        match delta {
            git2::Delta::Added => DiffStatus::Added,
            git2::Delta::Deleted => DiffStatus::Deleted,
            git2::Delta::Modified => DiffStatus::Modified,
            git2::Delta::Unmodified => DiffStatus::Unmodified,
            git2::Delta::Renamed => DiffStatus::Renamed,
            git2::Delta::Conflicted => DiffStatus::Conflict,
            git2::Delta::Untracked => DiffStatus::Untracked,
            _ => DiffStatus::Unknown,
        }
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileStats {
    /**
     * the status of the file in this commit
     */
    pub status: DiffStatus,
    /**
     * The path of the object these stats apply to
     */
    pub path: Option<String>,
}

/**
 * Statistics of a specific entry in a diff (as output by git show --stat)
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
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
    pub deletions: usize,
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
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
    pub incoming: Vec<DiffStat>,
}

/**
 * struct representing the diff of a single file
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    /**
     * The diff header for this file
     */
    pub header: Vec<String>,

    /**
     * The old name of the file
     */
    pub old_name: String,
    /**
     * The new name of the file. Might be identical to the old name
     */
    pub new_name: String,

    /**
     * The chunks contained in this file
     */
    pub chunks: Vec<DiffChunk>,
}

/**
 * struct representing a chunk in a diff
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiffChunk {
    /**
     * The chunk header as present in the input
     */
    pub header: String,

    /**
     * The lines, as present in the input
     */
    pub lines: Vec<DiffLine>,
}

impl TryFrom<git2::DiffHunk<'_>> for DiffChunk {
    type Error = String;
    fn try_from(hunk: git2::DiffHunk) -> Result<Self, Self::Error> {
        Ok(Self {
            header: String::from_utf8_lossy(hunk.header()).to_string().split("\n").collect(),
            lines: vec![],
        })
    }
}
/**
 * An individual line in the diff
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineData {
    /**
     * The content of the line _including_ the type marker at the start
     */
    pub content: String,

    /**
     * The number of this line in the old version of the file
     */
    pub old_number: Option<u32>,

    /**
     * The number of this line in the new version of the file
     */
    pub new_number: Option<u32>,
}

impl TryFrom<git2::DiffLine<'_>> for DiffLineData {
    type Error = String;
    fn try_from(diff_line: git2::DiffLine) -> Result<Self, Self::Error> {
        Ok(DiffLineData {
            content: String::from_utf8_lossy(diff_line.content()).into_owned(),
            old_number: diff_line.old_lineno(),
            new_number: diff_line.new_lineno(),
        })
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum DiffLine {
    Insert(DiffLineData),
    Delete(DiffLineData),
    Context(DiffLineData),
    PseudoContext(DiffLineData),
    Timeout(DiffLineData),
}

impl TryFrom<git2::DiffLine<'_>> for DiffLine {
    type Error = String;
    fn try_from(diff_line: git2::DiffLine) -> Result<Self, Self::Error> {
        Ok(match diff_line.origin_value() {
            git2::DiffLineType::Context => Self::Context(diff_line.try_into()?),
            git2::DiffLineType::Addition => Self::Insert(diff_line.try_into()?),
            git2::DiffLineType::Deletion => Self::Delete(diff_line.try_into()?),
            git2::DiffLineType::ContextEOFNL => Self::PseudoContext(diff_line.try_into()?),
            git2::DiffLineType::AddEOFNL => Self::PseudoContext(diff_line.try_into()?),
            git2::DiffLineType::DeleteEOFNL => Self::PseudoContext(diff_line.try_into()?),
            _ => Self::PseudoContext(diff_line.try_into()?), // TODO not really correct, but then again the remaining values should not occur anyway
        })
    }
}

/**
 * Wrapper type used in the From implementation
 */
pub struct Diff(pub Vec<FileDiff>);

impl TryFrom<git2::Diff<'_>> for Diff {
    type Error = BackendError;

    fn try_from(diff: git2::Diff) -> Result<Self, Self::Error> {
        let mut diffs = vec![];
        diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
            handle_line(delta, hunk, line, &mut diffs)
        })?;
        Ok(Diff(diffs))
    }
}

fn handle_line(
    _: git2::DiffDelta<'_>,
    _: Option<git2::DiffHunk>,
    line: git2::DiffLine<'_>,
    diffs: &mut Vec<FileDiff>,
) -> bool {
    match line.origin_value() {
        git2::DiffLineType::FileHeader => {
            diffs.push(FileDiff {
                header: String::from_utf8_lossy(line.content())
                    .split("\n")
                    .map(|s| s.to_owned())
                    .collect(),
                old_name: "old".to_owned(), // TODO extract the value from the header
                new_name: "new".to_owned(), // TODO extract the value from the header
                chunks: vec![],
            });
            true
        }
        git2::DiffLineType::HunkHeader => diffs
            .last_mut()
            .and_then(|diff| {
                diff.chunks.push(DiffChunk {
                    header: String::from_utf8_lossy(line.content())
                        .split("\n")
                        .map(|s| s.to_owned())
                        .collect(),
                    lines: vec![],
                });
                Some(true)
            })
            .unwrap_or(false),
        git2::DiffLineType::Binary => false,
        _ => push_line(line, diffs)
    }
}

fn push_line(line: git2::DiffLine<'_>, diffs: &mut Vec<FileDiff>) -> bool {
    diffs.last_mut().and_then(|diff| diff.chunks.last_mut()).and_then(|chunk| {
        chunk.lines.push(line.try_into().ok()?);
        Some(true)
    })
    .unwrap_or(false)
}