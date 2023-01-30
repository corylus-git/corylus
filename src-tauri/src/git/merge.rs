use git2::{build::CheckoutBuilder, MergeOptions};
use tauri::Window;

use crate::error::BackendError;

use super::{index::do_commit, with_backend_mut, StateType};

#[tauri::command]
pub async fn merge(
    state: StateType<'_>,
    window: Window,
    from: &str,
    no_fast_forward: bool,
) -> Result<(), BackendError> {
    with_backend_mut(state, |backend| {
        let is_branch: bool;
        // limit the lifetime of the backend borrow to not collide with do_commit below
        {
            let (source_obj, source_ref) = backend.repo.revparse_ext(from)?;
            is_branch = source_ref.map_or(false, |r| r.is_branch());
            let mut merge_opts = MergeOptions::new();
            merge_opts.patience(true).find_renames(true);
            let source_commit = backend.repo.find_annotated_commit(source_obj.id())?;
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
        };
        if backend.repo.index()?.has_conflicts() {
            window.emit("status-changed", ())?;
            return Err(BackendError { message: "Merge cannot be committed due to conflicts. Please check the index for details.".to_owned()});
        }
        let message = if is_branch {
            format!("Merge branch '{}' into {}", from, "<todo>")
        } else {
            format!("Merge {} into {}", from, "<todo>")
        };
        do_commit(backend, window, &message, false)
    })
    .await
}
