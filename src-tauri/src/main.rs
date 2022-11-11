#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

mod git;
mod error;

use std::sync::Arc;

use git::{git_open, is_git_dir, AppState};
use tauri::async_runtime::Mutex;

use crate::git::{
    get_commit_stats, get_diff,
    index::{commit, get_status, stage, unstage},
};

// #[cfg(not(test))]
fn main() {
    tauri::Builder::default()
        .manage(AppState {
            backend: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            is_git_dir,
            git_open,
            get_commit_stats,
            get_diff,
            get_status,
            stage,
            unstage,
            commit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
