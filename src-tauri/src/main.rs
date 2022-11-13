#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

mod git;
mod error;
mod settings;

use std::sync::Arc;

use settings::{load_settings};
use git::{git_open, is_git_dir, AppState};
use tauri::async_runtime::Mutex;

use crate::{git::{
    get_commit_stats,
    index::{commit, get_status, stage, unstage}, diff::get_diff,
}, settings::get_settings};

// #[cfg(not(test))]
fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(AppState {
            git: None,
            settings: load_settings()
        })))
        .invoke_handler(tauri::generate_handler![
            get_settings,
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
