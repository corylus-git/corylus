use tauri::Window;

use crate::error::{DefaultResult, Result};
use crate::window_events::{TypedEmit, WindowEvents};

use crate::git::model::git::Tag;
use crate::git::{with_backend, StateType};

#[tauri::command]
pub async fn get_tags(state: StateType<'_>) -> Result<Vec<Tag>> {
    with_backend(state, |backend| {
        let mut tags = Vec::<Tag>::new();
        backend.repo.tag_foreach(|tag_id, tag_name| {
            let target = backend
                .repo
                .find_tag(tag_id)
                .map(|tag| tag.target_id().to_string())
                .ok();
            log::debug!(
                "Tag: {} ({}) -> {:?}",
                String::from_utf8_lossy(tag_name),
                tag_id,
                target
            );

            tags.push(Tag {
                name: String::from_utf8_lossy(tag_name.split_at(10).1).to_string(), // just remove the refs/tags/ part
                oid: target.as_ref().map(|_| tag_id.to_string()), // if the target exists, the tag has an own OID
                tagged_oid: target.unwrap_or_else(|| tag_id.to_string()), // if no target exists, the tag has no own object
            });
            true
        })?;
        Ok(tags)
    })
    .await
}

#[tauri::command]
pub async fn create_tag(
    state: StateType<'_>,
    window: Window,
    name: &str,
    ref_name: &str,
    message: Option<&str>,
) -> DefaultResult {
    with_backend(state, |backend| {
        let object = backend.repo.revparse_single(ref_name)?;
        let tagger = backend.repo.signature()?;
        if let Some(m) = message {
            backend.repo.tag(name, &object, &tagger, m, false)?;
        } else {
            backend.repo.tag_lightweight(name, &object, false)?;
        }
        window.typed_emit(WindowEvents::TagsChanged, ())?;
        Ok(())
    })
    .await
}
