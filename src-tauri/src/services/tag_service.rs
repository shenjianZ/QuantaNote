use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::TagDto;
use crate::repositories::tag_repository;

pub fn get_all_tags(db: &DbState) -> Result<Vec<TagDto>, AppError> {
    tag_repository::get_all_tags(db)
}

pub fn get_all_item_tag_mappings(db: &DbState) -> Result<Vec<(String, String)>, AppError> {
    tag_repository::get_all_item_tag_mappings(db)
}

pub fn create_tag(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    tag_repository::create_tag(db, name, color)
}

pub fn delete_tag(db: &DbState, name: &str) -> Result<(), AppError> {
    tag_repository::delete_tag(db, name)
}

pub fn get_tags_for_item(db: &DbState, item_id: &str) -> Result<Vec<TagDto>, AppError> {
    tag_repository::get_tags_for_item(db, item_id)
}

pub fn set_item_tags(db: &DbState, item_id: &str, tag_names: Vec<String>) -> Result<(), AppError> {
    let tag_names: Vec<String> = tag_names
        .into_iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect();

    for name in &tag_names {
        let existing = tag_repository::get_tag_by_name(db, name);
        if existing.is_none() {
            tag_repository::create_tag(db, name, "cyan")?;
        }
    }
    tag_repository::set_item_tags(db, item_id, tag_names)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_item_tags_creates_missing_tags_and_skips_blank_names() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "标签测试".to_string(),
            "note".to_string(),
            None,
        )
        .expect("create item");

        set_item_tags(
            &db,
            &item.id,
            vec![" rust ".to_string(), "".to_string(), "tauri".to_string()],
        )
        .expect("set tags");

        let tags = get_tags_for_item(&db, &item.id).expect("item tags");
        let names: Vec<String> = tags.into_iter().map(|tag| tag.name).collect();
        assert_eq!(names, vec!["rust".to_string(), "tauri".to_string()]);

        let all = get_all_tags(&db).expect("all tags");
        assert_eq!(all.len(), 2);
        assert!(all.iter().all(|tag| tag.color == "cyan"));
    }

    #[test]
    fn delete_tag_removes_item_mappings() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "标签删除".to_string(),
            "note".to_string(),
            None,
        )
        .expect("create item");
        set_item_tags(&db, &item.id, vec!["rust".to_string()]).expect("set tags");

        delete_tag(&db, "rust").expect("delete tag");

        let tags = get_tags_for_item(&db, &item.id).expect("item tags");
        assert!(tags.is_empty());
    }
}
