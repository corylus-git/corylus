#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

mod error;
mod git;
mod settings;

use std::sync::Arc;

use git::{git_open, is_git_dir, AppState};
use settings::load_settings;
use tauri::async_runtime::Mutex;

use crate::{
    git::{
        diff::get_diff,
        get_branches, get_graph_entries,
        history::{get_affected_branches, get_commit, get_commit_stats},
        index::{commit, get_status, stage, unstage},
        remote::{get_remotes, push}, stash::{get_stashes, stash, get_stash_stats}
    },
    settings::get_settings,
};

// #[cfg(not(test))]
fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(AppState {
            git: None,
            settings: load_settings(),
        })))
        .invoke_handler(tauri::generate_handler![
            get_settings,
            get_branches,
            is_git_dir,
            git_open,
            get_commit,
            get_commit_stats,
            get_stash_stats,
            get_stashes,
            stash,
            get_diff,
            get_status,
            stage,
            unstage,
            commit,
            get_graph_entries,
            get_affected_branches,
            get_remotes,
            push
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
