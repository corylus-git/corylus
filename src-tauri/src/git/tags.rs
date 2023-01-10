use crate::error::BackendError;

use super::model::git::Tag;
use super::{with_backend, StateType};

#[tauri::command]
pub async fn get_tags(state: StateType<'_>) -> Result<Vec<Tag>, BackendError> {
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
