use crate::models::search::SearchResultDto;

pub fn search(query: &str) -> Vec<SearchResultDto> {
    vec![
        SearchResultDto {
            id: "project-start".to_string(),
            title: format!("{}启动资料", query),
            item_type: "note".to_string(),
            summary: "项目概述、需求、技术栈与附件".to_string(),
        },
        SearchResultDto {
            id: "deploy-command".to_string(),
            title: "服务器部署命令".to_string(),
            item_type: "command".to_string(),
            summary: "docker compose up -d".to_string(),
        },
    ]
}
