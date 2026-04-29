use crate::models::attachment::AttachmentDto;
use crate::repositories::attachment_repository;

pub fn add_attachment(item_id: String, path: String) -> AttachmentDto {
    attachment_repository::add(item_id, path)
}
