use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::template::TemplateDto;
use crate::utils::ids;

fn row_to_template(row: &rusqlite::Row) -> rusqlite::Result<TemplateDto> {
    Ok(TemplateDto {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        content: row.get(3)?,
        built_in: false,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn get_all(db: &DbState) -> Result<Vec<TemplateDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, content, created_at, updated_at
             FROM templates ORDER BY updated_at DESC, name COLLATE NOCASE ASC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let templates = stmt
        .query_map([], row_to_template)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()));
    templates
}

pub fn create(
    db: &DbState,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let id = ids::new_id("tpl");
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO templates (id, name, description, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, name, description, content, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(TemplateDto {
        id,
        name,
        description,
        content,
        built_in: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update(
    db: &DbState,
    id: &str,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();

    let affected = conn
        .execute(
            "UPDATE templates
             SET name = ?1, description = ?2, content = ?3, updated_at = ?4
             WHERE id = ?5",
            params![name, description, content, now, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("Template {}", id)));
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, content, created_at, updated_at
             FROM templates WHERE id = ?1",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    stmt.query_row(params![id], row_to_template)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn delete(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let affected = conn
        .execute("DELETE FROM templates WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("Template {}", id)));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_crud_roundtrip() {
        let db = crate::test_support::test_db();
        let created = create(
            &db,
            "会议记录".to_string(),
            "记录会议结论".to_string(),
            "# 会议记录".to_string(),
        )
        .expect("create template");

        assert!(created.id.starts_with("tpl-"));
        assert!(!created.built_in);
        assert_eq!(get_all(&db).expect("get templates").len(), 1);

        let updated = update(
            &db,
            &created.id,
            "更新后的模板".to_string(),
            "新的说明".to_string(),
            "## 结论".to_string(),
        )
        .expect("update template");
        assert_eq!(updated.name, "更新后的模板");
        assert_eq!(updated.content, "## 结论");

        delete(&db, &created.id).expect("delete template");
        assert!(get_all(&db).expect("get templates").is_empty());
    }

    #[test]
    fn update_and_delete_missing_template_return_not_found() {
        let db = crate::test_support::test_db();
        assert!(matches!(
            update(
                &db,
                "tpl-missing",
                "name".to_string(),
                String::new(),
                String::new(),
            ),
            Err(AppError::NotFound(_))
        ));
        assert!(matches!(
            delete(&db, "tpl-missing"),
            Err(AppError::NotFound(_))
        ));
    }
}
