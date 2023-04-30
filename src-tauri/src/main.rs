#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(test)]
#[macro_use]
extern crate lazy_static;
extern crate enum_display_derive;

mod error;
mod git;
mod log;
mod settings;
mod window_events;

use std::sync::Arc;

use git::{git_open, is_git_dir, AppState};
use settings::load_settings;
use simple_logger::SimpleLogger;
use tauri::async_runtime::Mutex;

use crate::{
    git::{
        add_to_gitignore,
        branches::{
            change_branch, checkout_remote_branch, create_branch, delete_branch, get_branches,
            get_unmerged_branches, reset,
        },
        config::get_config,
        diff::get_diff,
        files::{get_blame, get_file_contents, get_files},
        get_graph_entries,
        graph::{find_commits, get_index},
        history::{get_affected_branches, get_commit, get_commit_stats, get_commits, get_graph},
        index::{apply_diff, checkout, commit, discard_changes, get_status, stage, unstage},
        merge::{abort_merge, get_merge_message, is_merge, merge},
        rebase::{rebase, rebase_status},
        remote::{add_remote, delete_remote, fetch, get_remotes, pull, push, update_remote},
        stash::{apply_stash, drop_stash, get_stash_stats, get_stashes, stash},
        tags::{create_tag, get_tags},
        worktree::{checkout_worktree, get_worktrees},
    },
    log::send_log,
    settings::{get_settings, update_history, update_settings},
};

// #[cfg(not(test))]
fn main() {
    SimpleLogger::new()
        .init()
        .unwrap_or_else(|err| println!("Could not initialize logger. {}", err));

    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(AppState {
            git: None,
            settings: load_settings(),
        })))
        .invoke_handler(tauri::generate_handler![
            send_log,
            get_settings,
            update_settings,
            update_history,
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
            checkout,
            get_graph,
            get_graph_entries,
            get_affected_branches,
            get_remotes,
            push,
            fetch,
            pull,
            add_remote,
            update_remote,
            delete_remote,
            get_branches,
            get_unmerged_branches,
            create_branch,
            delete_branch,
            change_branch,
            checkout_remote_branch,
            reset,
            rebase,
            rebase_status,
            get_worktrees,
            checkout_worktree,
            get_tags,
            create_tag,
            get_config,
            get_files,
            get_file_contents,
            apply_diff,
            discard_changes,
            add_to_gitignore,
            merge,
            is_merge,
            abort_merge,
            get_merge_message,
            get_index,
            find_commits,
            get_blame
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
