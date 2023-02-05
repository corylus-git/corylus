use serde::Serialize;

use crate::error::BackendError;

use super::git::DiffStatus;

#[derive(Clone, Serialize, PartialEq, Debug, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    /**
     * The file path this status applies to
     */
    pub path: String,

    /**
     * The status of this file in the working copy
     */
    pub workdir_status: DiffStatus,

    /**
     * The status of this file in the index/staging area
     */
    pub index_status: DiffStatus,

    /**
     * Denotes whether the file is currently staged in any form
     */
    pub is_staged: bool,

    /**
     * Denotes whether the file is currently in conflict due to a broken merge
     */
    pub is_conflicted: bool,
}

impl TryFrom<git2::StatusEntry<'_>> for IndexStatus {
    type Error = BackendError;

    fn try_from(value: git2::StatusEntry<'_>) -> Result<Self, Self::Error> {
        Ok(Self {
            path: value
                .path()
                .ok_or(BackendError::new(
                    "Cannot get index status for entry without path",
                ))?
                .into(),
            workdir_status: get_workdir_status(&value),
            index_status: get_index_status(&value),
            is_staged: get_index_status(&value) != DiffStatus::Ignored, // TODO check whether this actually makes sense in here or whether this is purely a frontend thing
            is_conflicted: value.status().is_conflicted(),
        })
    }
}

pub fn get_workdir_status(entry: &git2::StatusEntry<'_>) -> DiffStatus {
    let status = entry.status();
    if status.is_wt_new() {
        DiffStatus::Untracked
    } else if status.is_wt_modified() {
        DiffStatus::Modified
    } else if status.is_wt_deleted() {
        DiffStatus::Deleted
    } else if status.is_wt_renamed() {
        DiffStatus::Renamed
    } else {
        DiffStatus::Unmodified
    }
}

fn get_index_status(entry: &git2::StatusEntry<'_>) -> DiffStatus {
    let status = entry.status();
    if status.is_index_new() {
        DiffStatus::Added
    } else if status.is_index_modified() {
        DiffStatus::Modified
    } else if status.is_index_deleted() {
        DiffStatus::Deleted
    } else if status.is_index_renamed() {
        DiffStatus::Renamed
    } else {
        DiffStatus::Unmodified
    }
}
