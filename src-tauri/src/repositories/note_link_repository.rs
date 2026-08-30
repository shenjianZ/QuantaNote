use std::collections::HashSet;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::note_link::{
    NoteLinkDto, NoteLinkGraphDto, NoteLinkGraphEdgeDto, NoteLinkGraphNodeDto,
};

#[derive(Debug, Clone)]
struct NoteRecord {
    id: String,
    title: String,
    content: String,
}

/// Extract unique wiki-link targets in source order.
///
/// Fenced code blocks are ignored so examples such as `[[target]]` do not
/// accidentally become relationships.
pub fn extract_targets(content: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut seen = HashSet::new();
    let mut in_fenced_code = false;

    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fenced_code = !in_fenced_code;
            continue;
        }
        if in_fenced_code {
            continue;
        }

        let mut rest = line;
        while let Some(start) = rest.find("[[") {
            let after_start = &rest[start + 2..];
            let Some(end) = after_start.find("]]") else {
                break;
            };
            let raw_target = after_start[..end].trim();
            let target = raw_target
                .split_once('|')
                .map(|(target, _)| target)
                .unwrap_or(raw_target)
                .trim();
            if !target.is_empty() {
                let key = target.to_lowercase();
                if seen.insert(key) {
                    targets.push(target.to_string());
                }
            }
            rest = &after_start[end + 2..];
        }
    }

    targets
}

fn normalized_title(title: &str) -> String {
    title.trim().to_lowercase()
}

fn load_notes(db: &DbState) -> Result<Vec<NoteRecord>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut statement = conn
        .prepare(
            "SELECT id, title, content
             FROM items
             WHERE deleted_at IS NULL
             ORDER BY updated_at DESC",
        )
        .map_err(|error| AppError::Database(error.to_string()))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
            })
        })
        .map_err(|error| AppError::Database(error.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Database(error.to_string()));
    rows
}

fn find_note<'a>(notes: &'a [NoteRecord], id: &str) -> Result<&'a NoteRecord, AppError> {
    notes
        .iter()
        .find(|note| note.id == id)
        .ok_or_else(|| AppError::NotFound(format!("Item {}", id)))
}

fn resolve_target<'a>(notes: &'a [NoteRecord], target: &str) -> Option<&'a NoteRecord> {
    let target = normalized_title(target);
    notes
        .iter()
        .find(|note| normalized_title(&note.title) == target)
}

pub fn get_forward_links(db: &DbState, item_id: &str) -> Result<Vec<NoteLinkDto>, AppError> {
    let notes = load_notes(db)?;
    let source = find_note(&notes, item_id)?;
    Ok(extract_targets(&source.content)
        .into_iter()
        .map(|target_title| {
            let target = resolve_target(&notes, &target_title);
            NoteLinkDto {
                source_id: source.id.clone(),
                source_title: source.title.clone(),
                target_title,
                target_id: target.map(|note| note.id.clone()),
            }
        })
        .collect())
}

pub fn get_back_links(db: &DbState, item_id: &str) -> Result<Vec<NoteLinkDto>, AppError> {
    let notes = load_notes(db)?;
    let target = find_note(&notes, item_id)?;
    let target_title = target.title.clone();
    let target_key = normalized_title(&target_title);

    Ok(notes
        .iter()
        .filter(|source| source.id != target.id)
        .filter_map(|source| {
            let links_to_target = extract_targets(&source.content)
                .into_iter()
                .any(|link| normalized_title(&link) == target_key);
            links_to_target.then(|| NoteLinkDto {
                source_id: source.id.clone(),
                source_title: source.title.clone(),
                target_title: target_title.clone(),
                target_id: Some(target.id.clone()),
            })
        })
        .collect())
}

pub fn get_graph(db: &DbState) -> Result<NoteLinkGraphDto, AppError> {
    let notes = load_notes(db)?;
    let nodes = notes
        .iter()
        .map(|note| NoteLinkGraphNodeDto {
            id: note.id.clone(),
            title: note.title.clone(),
        })
        .collect();
    let edges = notes
        .iter()
        .flat_map(|source| {
            extract_targets(&source.content)
                .into_iter()
                .map(|target_title| NoteLinkGraphEdgeDto {
                    source_id: source.id.clone(),
                    target_id: resolve_target(&notes, &target_title).map(|note| note.id.clone()),
                    target_title,
                })
        })
        .collect();

    Ok(NoteLinkGraphDto { nodes, edges })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::item_service;
    use crate::test_support::test_db;

    #[test]
    fn extracts_unique_targets_and_ignores_fenced_code() {
        let content = "[[目标]] [[目标|显示名]]\n\n```md\n[[代码示例]]\n```\n~~~\n[[另一个代码示例]]\n~~~\n[[尾部]]";
        assert_eq!(extract_targets(content), vec!["目标", "尾部"]);
    }

    #[test]
    fn resolves_forward_and_back_links_case_insensitively() {
        let db = test_db();
        let target =
            item_service::create_item(&db, "目标笔记".into(), "note".into(), None).unwrap();
        let source = item_service::create_item(
            &db,
            "来源笔记".into(),
            "note".into(),
            Some("[[目标笔记]] [[不存在]]".into()),
        )
        .unwrap();

        let forward = get_forward_links(&db, &source.id).unwrap();
        assert_eq!(forward.len(), 2);
        assert_eq!(forward[0].target_id.as_deref(), Some(target.id.as_str()));
        assert!(forward[1].target_id.is_none());

        let back = get_back_links(&db, &target.id).unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].source_id, source.id);
    }

    #[test]
    fn excludes_trashed_notes_from_links_and_graph() {
        let db = test_db();
        let target = item_service::create_item(&db, "目标".into(), "note".into(), None).unwrap();
        let source =
            item_service::create_item(&db, "来源".into(), "note".into(), Some("[[目标]]".into()))
                .unwrap();
        item_service::delete_item(&db, target.id.as_str()).unwrap();

        let forward = get_forward_links(&db, &source.id).unwrap();
        assert!(forward[0].target_id.is_none());
        let graph = get_graph(&db).unwrap();
        assert_eq!(graph.nodes.len(), 1);
        assert!(graph.edges[0].target_id.is_none());
    }
}
