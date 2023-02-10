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
mod log;

use std::sync::Arc;

use git::{git_open, is_git_dir, AppState};
use settings::load_settings;
use simple_logger::SimpleLogger;
use tauri::async_runtime::Mutex;

use crate::{
    git::{
        diff::get_diff,
        get_graph_entries, add_to_gitignore,
        history::{get_affected_branches, get_commit, get_commit_stats, get_graph, get_commits},
        index::{commit, get_status, stage, unstage, apply_diff, discard_changes},
        remote::{get_remotes, push, fetch}, stash::{get_stashes, stash, get_stash_stats, apply_stash, drop_stash},
        branches::{get_branches, get_unmerged_branches, create_branch, delete_branch, change_branch, checkout_remote_branch},
        worktree::{get_worktrees, checkout_worktree},
        tags::{get_tags, create_tag},
        config::get_config,
        files::get_files,
        merge::{merge, abort_merge}
    },
    settings::get_settings, log::send_log,
};

// #[cfg(not(test))]
fn main() {
    SimpleLogger::new().init().unwrap_or_else(|err| println!("Could not initialize logger. {}", err));

    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(AppState {
            git: None,
            settings: load_settings(),
        })))
        .invoke_handler(tauri::generate_handler![
            send_log,
            get_settings,
            get_branches,
            is_git_dir,
            git_open,
            get_commits,
            get_commit,
            get_commit_stats,
            get_stash_stats,
            get_stashes,
            stash,
            apply_stash,
            drop_stash,
            get_diff,
            get_status,
            stage,
            unstage,
            commit,
            get_graph,
            get_graph_entries,
            get_affected_branches,
            get_remotes,
            push,
            fetch,
            get_branches,
            get_unmerged_branches,
            create_branch,
            delete_branch,
            change_branch,
            checkout_remote_branch,
            get_worktrees,
            checkout_worktree,
            get_tags,
            create_tag,
            get_config,
            get_files,
            apply_diff,
            discard_changes,
            add_to_gitignore,
            merge,
            abort_merge
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
