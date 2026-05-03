# QuantaNote Release 操作手册

## 发布流程

1. 更新 `CHANGELOG.md`，添加新版本内容
2. 提交代码：`git commit -m "docs: update changelog for v0.2.0"`
3. 推送：`git push origin master`
4. 打 Tag：`git tag -a v0.2.0 -m "Release v0.2.0"`
5. 推送 Tag：`git push origin v0.2.0`（触发 CI）
6. 等待 CI 构建完成（Windows/Linux/macOS x4）
7. 在 GitHub Releases 检查 Draft Release，点击 Publish

## CHANGELOG.md 格式

```markdown
## [0.2.0] - 2026-05-15

### Added
- 新增功能描述

### Fixed
- 修复问题描述

### Changed
- 变更描述
```

**注意**：版本号不带 `v` 前缀，Tag 带 `v` 前缀。

## CI 工作原理

- 触发条件：推送 `v*` Tag
- Job 1：从 CHANGELOG.md 提取对应版本内容，创建 Draft Release
- Job 2：并行构建 4 个平台产物

### CHANGELOG 提取规则

```bash
sed -n "/^## \[${TAG#v}\]/,/^## \[/p" CHANGELOG.md
```

匹配 `## [版本号]` 到下一个 `## [` 之间的内容。

## 构建产物

| 平台 | 产物 |
|------|------|
| Windows | `.msi` + `.exe` |
| Linux | `.deb` + `.AppImage` |
| macOS ARM | `.dmg` + `.app` |
| macOS x64 | `.dmg` + `.app` |

## 常见问题

**Tag 推送后未触发 CI**：检查 Tag 格式是否为 `v*`

**CHANGELOG 未提取**：检查格式是否为 `## [版本号] - 日期`

**重新发布**：删除 Tag → 删除 Draft Release → 重新打 Tag 推送
