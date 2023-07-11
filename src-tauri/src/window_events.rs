use std::fmt::Display;

use serde::Serialize;
use tauri::Window;
use ts_rs::TS;

#[derive(TS, enum_display_derive::Display)]
#[ts(export)]
pub enum WindowEvents {
    SettingsChanged,
    BranchesChanged,
    StatusChanged,
    HistoryChanged,
    DiffChanged,
    GraphChanged,
    StashesChanged,
    CommitStatsChanged,
    TagsChanged,
    Progress,
    RepoStateChanged,
    MergeMessageChanged,
}

pub trait TypedEmit {
    fn typed_emit<S>(&self, ev: WindowEvents, payload: S) -> Result<(), tauri::Error>
    where
        S: Serialize + Clone;
}

impl TypedEmit for Window {
    fn typed_emit<S>(&self, ev: WindowEvents, payload: S) -> Result<(), tauri::Error>
    where
        S: Serialize + Clone,
    {
        self.emit(&ev.to_string(), payload)
    }
}
