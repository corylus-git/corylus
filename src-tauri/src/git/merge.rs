use git2::{
    build::CheckoutBuilder, AnnotatedCommit, MergeOptions, Object, Repository, RepositoryState,
};
use log::{debug, trace};
use tauri::Window;

use crate::{
    error::{BackendError, DefaultResult, Result},
    window_events::{TypedEmit, WindowEvents},
};

use super::{
    index::do_commit, model::graph::GraphChangeData, with_backend, with_backend_mut, GitBackend,
    StateType,
};

#[tauri::command]
pub async fn merge(
    state: StateType<'_>,
    window: Window,
    from: &str,
    no_fast_forward: bool,
) -> DefaultResult {
    with_backend_mut(state, |backend| {
        do_merge(backend, window, from, no_fast_forward)
    })
    .await
}

pub fn do_merge(
    backend: &mut GitBackend,
    window: Window,
    from: &str,
    no_fast_forward: bool,
) -> DefaultResult {
    debug!(
        "Merging {} into current branch (no_fast_forward: {}).",
        from, no_fast_forward
    );
    let (is_branch, source_obj, source_commit) = get_source_ref(&backend.repo, from)?;
    let target_ref = backend
        .repo
        .head()?
        .shorthand()
        .unwrap_or("<unknown>")
        .to_string();
    let (analysis, preference) = backend.repo.merge_analysis(&[&source_commit])?;
    trace!("Performing merge. source_commit = {}, is_branch = {}, target_ref = {}, analysis = {:?}, preference = {:?}, no_fast_forward = {}", 
        source_commit.id(), is_branch, target_ref, analysis, preference, no_fast_forward);
    if analysis.is_fast_forward() && !preference.is_no_fast_forward() && !no_fast_forward {
        fast_forward(window, &backend, &source_obj, &mut backend.repo.head()?)?;
    } else {
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
            window.typed_emit(WindowEvents::StatusChanged, ())?;
            return Err(BackendError::new(
                "Merge cannot be committed due to conflicts. Please check the index for details.",
            ));
        }
        let message = if is_branch {
            format!("Merge branch '{}' into {}", from, target_ref)
        } else {
            format!("Merge {} into {}", from, target_ref)
        };
        let parent_commit_ids = source_commit.id();
        drop(source_obj);
        drop(source_commit);
        do_commit(backend, window, &message, false, vec![parent_commit_ids])?;
        backend.repo.cleanup_state()?;
    };
    Ok(())
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
    backend: &GitBackend,
    target: &Object,
    head_ref: &mut git2::Reference,
) -> DefaultResult {
    let head_name = head_ref
        .name()
        .ok_or_else(|| BackendError::new("Cannot fast-forward detached head"))?;
    let target_id_str = target
        .short_id()?
        .as_str()
        .ok_or_else(|| BackendError::new("Cannot fast-forward to unknown target OID."))?
        .to_string();
    let ref_log_message = format!("Fast-forwarding {} to {}", head_name, target_id_str);
    debug!("{}", ref_log_message);
    let mut checkout_opts = CheckoutBuilder::new();
    checkout_opts.safe();
    backend
        .repo
        .checkout_tree(target, Some(&mut checkout_opts))?;
    head_ref.set_target(target.id(), &ref_log_message)?;
    window.typed_emit(WindowEvents::StatusChanged, ())?;
    window.typed_emit(
        WindowEvents::HistoryChanged,
        GraphChangeData {
            total: backend.graph.lines.len(),
            change_end_idx: 0,
            change_start_idx: backend.graph.lines.len(),
        },
    )?;
    window.typed_emit(WindowEvents::BranchesChanged, ())?;
    Ok(())
}

#[tauri::command]
pub async fn is_merge(state: StateType<'_>) -> Result<bool> {
    with_backend(state, |backend| {
        let state = backend.repo.state();
        log::trace!("Repository state: {:?}", state);
        Ok(state == RepositoryState::Merge)
    })
    .await
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
        window.typed_emit(WindowEvents::StatusChanged, ())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn get_merge_message(state: StateType<'_>) -> Result<Option<String>> {
    with_backend(state, |backend| Ok(Some(backend.repo.message()?))).await
}
