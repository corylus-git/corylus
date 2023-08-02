use git2::BlameHunk;
use serde::Serialize;

use super::git::TimeWithOffset;

/**
 * Information about a single block of lines penned by a specific author.
 */
#[derive(Serialize, Debug)]
pub struct BlameInfo {
    /**
     * The OID of the commit the last change occured
     */
    pub oid: String,
    /**
     * The short OID of the commit
     */
    pub short_oid: String,
    /**
     * The author of the commit/those lines in the file
     */
    pub author: String,
    /**
     * The email of the author
     */
    pub mail: String,
    /**
     * The date of the commit that changed those lines
     */
    pub timestamp: TimeWithOffset,
    /**
     * The message summary of the commit (i.e. the first line)
     */
    pub summary: String,
    /**
     * The lines belonging to this block in the file
     */
    pub content: Vec<String>,
}

impl BlameInfo {
    pub fn from_hunk(blame: BlameHunk, commit: &git2::Commit, lines: &Vec<String>) -> Self {
        Self {
            oid: blame.final_commit_id().to_string(),
            short_oid: commit
                .as_object()
                .short_id()
                .map_or_else(
                    |_| String::from("<invalid>"),
                    |i| i.as_str().unwrap_or("<invalid>").to_string(),
                )
                .to_string(),
            author: blame
                .final_signature()
                .name()
                .unwrap_or("(unknown)")
                .to_string(),
            mail: blame
                .final_signature()
                .email()
                .unwrap_or("<unknown>")
                .to_string(),
            timestamp: TimeWithOffset {
                utc_seconds: blame.final_signature().when().seconds(),
                offset_seconds: blame.final_signature().when().offset_minutes() * 60,
            },
            summary: commit.summary().unwrap_or("<invalid summary>").to_owned(),
            content: lines
                .iter()
                .skip(blame.final_start_line())
                .take(blame.lines_in_hunk())
                .cloned()
                .collect(),
        }
    }
}
