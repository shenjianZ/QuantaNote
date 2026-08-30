use crate::domain::entities::device_sessions;
use chrono::{NaiveDateTime, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

/// 设备会话数据访问仓库。
///
/// 这里只保存设备会话的生命周期元数据，Refresh Token 仍然只保存在 Redis 中。
pub struct DeviceSessionRepository {
    db: DatabaseConnection,
}

impl DeviceSessionRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn upsert(
        &self,
        user_id: &str,
        device_id: &str,
        expires_at: NaiveDateTime,
    ) -> anyhow::Result<device_sessions::Model> {
        let now = Utc::now().naive_utc();
        let existing = device_sessions::Entity::find()
            .filter(device_sessions::Column::UserId.eq(user_id))
            .filter(device_sessions::Column::DeviceId.eq(device_id))
            .one(&self.db)
            .await?;

        if let Some(model) = existing {
            let mut active: device_sessions::ActiveModel = model.into();
            active.last_seen_at = Set(now);
            active.expires_at = Set(expires_at);
            Ok(active.update(&self.db).await?)
        } else {
            let active = device_sessions::ActiveModel {
                id: Default::default(),
                user_id: Set(user_id.to_string()),
                device_id: Set(device_id.to_string()),
                created_at: Set(now),
                last_seen_at: Set(now),
                expires_at: Set(expires_at),
            };
            Ok(active.insert(&self.db).await?)
        }
    }

    pub async fn list_active(&self, user_id: &str) -> anyhow::Result<Vec<device_sessions::Model>> {
        let now = Utc::now().naive_utc();
        Ok(device_sessions::Entity::find()
            .filter(device_sessions::Column::UserId.eq(user_id))
            .filter(device_sessions::Column::ExpiresAt.gt(now))
            .order_by_desc(device_sessions::Column::LastSeenAt)
            .all(&self.db)
            .await?)
    }

    pub async fn delete(&self, user_id: &str, device_id: &str) -> anyhow::Result<()> {
        device_sessions::Entity::delete_many()
            .filter(device_sessions::Column::UserId.eq(user_id))
            .filter(device_sessions::Column::DeviceId.eq(device_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    pub async fn delete_all(&self, user_id: &str) -> anyhow::Result<()> {
        device_sessions::Entity::delete_many()
            .filter(device_sessions::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }
}
