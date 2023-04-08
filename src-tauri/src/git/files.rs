use std::path::Path;

use git2::StatusOptions;
use log::debug;

use crate::error::{BackendError, Result};

use super::{model::git::FileStats, with_backend, StateType};

#[tauri::command]
pub async fn get_files(state: StateType<'_>) -> Result<Vec<FileStats>> {
    with_backend(state, |backend| {
        let mut status_options = StatusOptions::new();
        status_options
            .include_ignored(false)
            .include_untracked(true)
            .include_unmodified(true)
            .recurse_ignored_dirs(false)
            .recurse_untracked_dirs(true);
        let statuses = backend
            .repo
            .statuses(Some(&mut status_options))?
            .iter()
            .map(FileStats::from)
            .collect();
        Ok(statuses)
    })
    .await
}

#[tauri::command]
pub async fn get_file_contents(state: StateType<'_>, path: &str, rev: &str) -> Result<Vec<u8>> {
    with_backend(state, |backend| {
        debug!("Getting contents of {} at {}", path, rev);
        if rev == "workdir" {
            let repo_path = backend.repo.workdir().ok_or_else(|| {
                BackendError::new(
                    "Repository has no work dir. This should not have cause this request",
                )
            })?;
            let full_path = repo_path.join(path);
            log::trace!("Reading contents of {:?} from disk", full_path.as_os_str());
            Ok(std::fs::read(full_path).map_err(|e| {
                log::error!("Could not read file from workdir. {}", e.to_string());
                BackendError::new(format!(
                    "Could not read file from workdir. {}",
                    e.to_string()
                ))
            })?)
        } else {
            let revision = backend.repo.revparse_single(rev)?;
            let tree = revision.peel_to_tree()?;
            let p = Path::new(path);
            let file_object = tree.get_path(p)?.to_object(&backend.repo)?;
            Ok(file_object
                .as_blob()
                .ok_or_else(|| {
                    BackendError::new(format!(
                        "Cannot read contents of {} at revision {}",
                        path, rev
                    ))
                })?
                .content()
                .into())
        }
    })
    .await
}
