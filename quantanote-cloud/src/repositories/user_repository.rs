use crate::domain::entities::users;
use anyhow::Result;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    Set,
};

/// 用户数据访问仓库
pub struct UserRepository {
    db: DatabaseConnection,
}

impl UserRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// 根据 email 查询用户
    pub async fn find_by_email(&self, email: &str) -> Result<Option<users::Model>> {
        let user = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("查询失败: {}", e))?;

        Ok(user)
    }

    /// 统计邮箱数量
    pub async fn count_by_email(&self, email: &str) -> Result<i64> {
        let count = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .count(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("查询失败: {}", e))?;

        Ok(count as i64)
    }

    /// 统计用户 ID 数量
    pub async fn count_by_id(&self, id: &str) -> Result<i64> {
        let count = users::Entity::find()
            .filter(users::Column::Id.eq(id))
            .count(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("查询失败: {}", e))?;

        Ok(count as i64)
    }

    /// 获取密码哈希
    pub async fn get_password_hash(&self, email: &str) -> Result<Option<String>> {
        let user = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("查询失败: {}", e))?;

        Ok(user.map(|u| u.password_hash))
    }

    /// 插入用户（created_at 和 updated_at 会自动填充），返回插入后的用户对象
    pub async fn insert(
        &self,
        id: String,
        email: String,
        password_hash: String,
    ) -> Result<users::Model> {
        let user_model = users::ActiveModel {
            id: Set(id),
            email: Set(email),
            password_hash: Set(password_hash),
            // created_at 和 updated_at 由 ActiveModelBehavior 自动填充
            ..Default::default()
        };

        let inserted_user = user_model
            .insert(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("插入失败: {}", e))?;

        Ok(inserted_user)
    }

    /// 更新用户密码
    pub async fn update_password(&self, id: &str, new_password_hash: &str) -> Result<()> {
        let user = users::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("查询失败: {}", e))?
            .ok_or_else(|| anyhow::anyhow!("用户不存在"))?;

        let mut active_model: users::ActiveModel = user.into();
        active_model.password_hash = Set(new_password_hash.to_string());
        active_model
            .update(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("更新失败: {}", e))?;

        Ok(())
    }

    /// 根据 ID 删除用户
    pub async fn delete_by_id(&self, id: &str) -> Result<()> {
        users::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("删除失败: {}", e))?;

        Ok(())
    }
}
