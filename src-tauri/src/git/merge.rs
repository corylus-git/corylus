use git2::{build::CheckoutBuilder, AnnotatedCommit, MergeOptions, Object, Repository};
use tauri::Window;

use crate::error::{Result, DefaultResult, BackendError};

use super::{index::do_commit, with_backend_mut, StateType};

#[tauri::command]
pub async fn merge(
    state: StateType<'_>,
    window: Window,
    from: &str,
    no_fast_forward: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        let (is_branch, source_obj, source_commit) = get_source_ref(&backend.repo, from)?;
        // limit the lifetime of the backend borrow to not collide with do_commit below
        let (analysis, preference) = backend.repo.merge_analysis(&[&source_commit])?;
        if analysis.is_fast_forward() && !preference.is_no_fast_forward() && !no_fast_forward {
            fast_forward(window, &backend.repo, &source_obj, from)?;
        }
        else {
            let mut merge_opts = MergeOptions::new();
            merge_opts.patience(true).find_renames(true);
            let mut checkout_opts = CheckoutBuilder::new();
            checkout_opts
                .safe()
                .conflict_style_merge(true)
                .allow_conflicts(true);
            backend.repo.merge(
                &[&source_commit],
                Some(&mut merge_opts),
                Some(&mut checkout_opts),
            )?;
            if backend.repo.index()?.has_conflicts() {
                window.emit("status-changed", ())?;
                return Err(BackendError::new("Merge cannot be committed due to conflicts. Please check the index for details."));
            }
            let message = if is_branch {
                format!("Merge branch '{}' into {}", from, "<todo>")
            } else {
                format!("Merge {} into {}", from, "<todo>")
            };
            drop(source_obj);
            drop(source_commit);
            do_commit(backend, window, &message, false)?;
            backend.repo.cleanup_state()?;
        };
        Ok(())
    })
    .await
}

fn get_source_ref<'repo>(
    repo: &'repo Repository,
    from: &str,
) -> Result<(bool, Object<'repo>, AnnotatedCommit<'repo>)> {
    let (source_obj, source_ref) = repo.revparse_ext(from)?;
    let is_branch = source_ref.map_or(false, |r| r.is_branch());
    let source_commit = repo.find_annotated_commit(source_obj.id())?;
    Ok((is_branch, source_obj, source_commit))
}

fn fast_forward(
    window: Window,
    repo: &Repository,
    target: &Object,
    target_ref_name: &str,
) -> DefaultResult {
    let mut checkout_opts = CheckoutBuilder::new();
    checkout_opts.safe();
    repo.checkout_tree(target, Some(&mut checkout_opts))?;
    repo.set_head(target_ref_name)?;
    window.emit("status-changed", ())?;
    window.emit("history-changed", ())?;
    Ok(())
}

#[tauri::command]
pub async fn abort_merge(state: StateType<'_>, window: Window) -> DefaultResult {
    with_backend_mut(state, |backend| {
        // TODO there is actually a reset mode --merge in the Git CLI which is currently not
        // implemented by libgit2 (and therefore git2-rs) -> evaluate in which cases this might
        // present a problem and if we can warn users about these
        let head = backend.repo.head()?.peel_to_commit()?;
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe();
        backend.repo.reset(
            head.as_object(),
            git2::ResetType::Hard,
            Some(&mut checkout_opts),
        )?;
        window.emit("status-changed", ())?;
        Ok(())
    })
    .await
}