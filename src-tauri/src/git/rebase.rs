use git2::RepositoryState;
use tauri::Window;

use crate::error::{DefaultResult, BackendError, Result};

use super::{StateType, with_backend_mut, model::{graph::GraphChangeData, index::RebaseStatusInfo}, history::do_get_graph, with_backend};

#[tauri::command]
pub async fn rebase_status(state: StateType<'_>) -> Result<Option<RebaseStatusInfo>>
{
    with_backend(state, |backend| {
        log::debug!("Repo state {:?}", backend.repo.state());
        if backend.repo.state() == RepositoryState::RebaseMerge {
            Ok(Some(RebaseStatusInfo {
                patch: "<todo>".to_owned(),
                message: "<todo>".to_owned()
            }))
        }
        else {
            Ok(None)
        }
    }).await
}

#[tauri::command]
pub async fn rebase(state: StateType<'_>, window: Window, target: &str) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let onto = backend.repo.revparse_single(target)?.peel_to_commit()?;
        let onto_commit = backend.repo.find_annotated_commit(onto.id())?;
        let mut rebase = backend.repo.rebase(None, None, Some(&onto_commit), None)?;
        let committer = backend.repo.signature()?;
        while let Some(operation) = rebase.next() {
            match operation {
                Ok(op) => {
                    if backend.repo.index()?.has_conflicts() {
                        window.emit("status-changed", ())?;
                        let failed_commit = backend.repo.find_commit(op.id())?;
                        return Err(BackendError::new(format!(
                            "Failed to merge commit {}: {}. Please fix the issues and continue.",
                            failed_commit.as_object().short_id()?.as_str().unwrap_or("<invalid OID>"),
                            failed_commit.message().unwrap_or("<invalid message>")
                        )));
                    }
                    rebase.commit(None, &committer, None)?;
                }
                Err(e) => {
                    Err(e)?;
                }
            }
        }
        rebase.finish(None)?;
        window.emit("status-changed", ())?;
        window.emit("branches-changed", ())?;
        // TODO this repeats code from git_open -> don't like this current setup
        backend.graph = do_get_graph(backend, None)?;
        window.emit(
            "history-changed",
            GraphChangeData {
                total: backend.graph.lines.len(),
                change_end_idx: 0,
                change_start_idx: backend.graph.lines.len(),
            },
        )?;
        Ok(())
    })
    .await
    .map_err(|e| {
        log::error!("rebase failed: {:?}", e);
        e
    })
}
