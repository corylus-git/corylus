use git2::{Oid, build::CheckoutBuilder};
use tauri::Window;

use crate::error::BackendError;

use super::{model::BranchInfo, with_backend, StateType};

#[tauri::command]
pub async fn get_branches(state: StateType<'_>) -> Result<Vec<BranchInfo>, BackendError> {
    with_backend(state, |backend| {
        let branches = backend.repo.branches(None)?;
        let result = branches.filter_map(|branch| branch.ok().map(|b| BranchInfo::try_from(b).ok()).flatten());
        Ok(result.collect())
    })
    .await
}

#[tauri::command]
pub async fn get_unmerged_branches(state: StateType<'_>) -> Result<Vec<String>, BackendError> {
    with_backend(state, |backend| {
        let head = backend.repo.head()?.resolve()?.peel_to_commit()?.id();
        Ok(backend
            .branches
            .iter()
            .filter_map(|b| {
                let oid = Oid::from_str(&b.head).ok()?;
                if backend.repo.graph_descendant_of(head, oid).ok()? {
                    Some(b.ref_name.clone())
                } else {
                    None
                }
            })
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn delete_branch(
    state: StateType<'_>,
    window: Window,
    branch: &str,
    remove_remote: bool,
) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let mut branch = backend.repo.find_branch(branch, git2::BranchType::Local)?;
        if remove_remote {
            branch.upstream().map(|mut u| u.delete())?;
        };
        branch.delete()?;
        window.emit("branches-changed", {});
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn create_branch(
    state: StateType<'_>,
    window: Window,
    name: &str,
    source: &str,
    checkout: bool
) -> Result<(), BackendError> {
    with_backend(state, |backend| {
        let source_commit = backend.repo.find_branch(source, git2::BranchType::Local)?.into_reference().peel_to_commit()?;
        let branch = backend.repo.branch(name, &source_commit, false)?;
        if checkout {
            let reference = branch.into_reference();
            backend.repo.checkout_tree(reference.peel_to_commit()?.tree()?.as_object(), Some(CheckoutBuilder::new().safe()))?;
            backend.repo.set_head(reference.name().ok_or(BackendError { message: "Could not get ref name of new branch. Cannot check out after creation".to_owned() })?)?;
        };
        window.emit("branches-changed", {});
        Ok(())
    })
    .await
}
