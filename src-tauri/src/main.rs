#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(test)]
#[macro_use]
extern crate lazy_static;
extern crate enum_display_derive;

mod api;
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
use tracing::Level;
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use crate::{
    api::{
        branches::{
            change_branch, checkout_remote_branch, create_branch, delete_branch, get_branches,
            get_unmerged_branches, reset,
        },
        config::get_config,
        graph::{find_commits, get_graph_entries, get_index},
        index::{
            apply_diff, checkout, commit, discard_changes, get_conflicts, get_status,
            resolve_conflict_manually, stage, unstage,
        },
        rebase::{rebase, rebase_status},
        remote::{add_remote, clone, delete_remote, fetch, get_remotes, pull, push, update_remote},
        tags::{create_tag, get_tags},
    },
    git::{
        add_to_gitignore,
        diff::get_diff,
        files::{get_blame, get_file_contents, get_files},
        history::{
            get_affected_branches, get_commit, get_commit_stats, get_commits, get_graph,
            get_history_size,
        },
        load_repo,
        merge::{abort_merge, get_merge_message, is_merge, merge},
        stash::{apply_stash, drop_stash, get_stash_stats, get_stashes, stash},
        worktree::{checkout_worktree, get_worktrees},
    },
    log::send_log,
    settings::{get_settings, update_history, update_settings},
};

// #[cfg(not(test))]
fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env())
        .with_max_level(Level::TRACE)
        .finish();
    // TODO ignoring this error is OK
    tracing::subscriber::set_global_default(subscriber)
        .map_err(|e| println!("Could not initialize logging and tracing: {:?}", e));

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
            load_repo,
            clone,
            get_history_size,
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
            get_blame,
            get_conflicts,
            resolve_conflict_manually
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
