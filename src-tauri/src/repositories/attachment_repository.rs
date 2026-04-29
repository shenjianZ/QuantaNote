use crate::models::attachment::AttachmentDto;
use crate::utils::ids;

pub fn add(item_id: String, path: String) -> AttachmentDto {
    AttachmentDto {
        id: ids::prefixed_id("attachment", &path),
        item_id,
        path,
    }
}
