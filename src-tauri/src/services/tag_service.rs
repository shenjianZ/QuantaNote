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

pub fn rename_tag(db: &DbState, old_name: &str, new_name: &str) -> Result<TagDto, AppError> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::Validation("标签名不能为空".to_string()));
    }
    tag_repository::rename_tag(db, old_name, &new_name)
}

pub fn update_tag_color(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    tag_repository::update_tag_color(db, name, color)
}

pub fn get_tag_item_counts(db: &DbState) -> Result<Vec<(String, String, i64)>, AppError> {
    tag_repository::get_tag_item_counts(db)
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

    #[test]
    fn get_all_tags_returns_empty_initially() {
        let db = crate::test_support::test_db();
        let tags = get_all_tags(&db).unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn create_tag_returns_dto() {
        let db = crate::test_support::test_db();
        let tag = create_tag(&db, "rust", "cyan").unwrap();
        assert_eq!(tag.name, "rust");
        assert_eq!(tag.color, "cyan");
    }

    #[test]
    fn get_tags_for_item_after_set() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db, "T".to_string(), "note".to_string(), None,
        ).unwrap();
        set_item_tags(&db, &item.id, vec!["go".to_string()]).unwrap();

        let tags = get_tags_for_item(&db, &item.id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "go");
    }

    #[test]
    fn get_all_mappings_returns_empty_initially() {
        let db = crate::test_support::test_db();
        let mappings = get_all_item_tag_mappings(&db).unwrap();
        assert!(mappings.is_empty());
    }

    #[test]
    fn rename_tag_trims_name() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let renamed = rename_tag(&db, "rust", "  rust-lang  ").unwrap();
        assert_eq!(renamed.name, "rust-lang");
    }

    #[test]
    fn rename_tag_rejects_empty_name() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let result = rename_tag(&db, "rust", "  ");
        assert!(result.is_err());
    }

    #[test]
    fn update_tag_color_works() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let updated = update_tag_color(&db, "rust", "purple").unwrap();
        assert_eq!(updated.color, "purple");
    }

    #[test]
    fn get_tag_item_counts_works() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();
        let counts = get_tag_item_counts(&db).unwrap();
        assert_eq!(counts.len(), 1);
        assert_eq!(counts[0].2, 0);
    }
}
