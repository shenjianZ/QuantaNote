---
title: 字体设置
description: QuantaNote 字体设置详细说明，包括 UI 字体选择、等宽字体选择、字号调整（14-18px）和实时预览功能
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 字体设置

字体设置让你自定义 QuantaNote 界面中的文字呈现方式，包括 UI 字体、等宽字体和字号。合理的字体配置可以显著提升阅读和编辑体验。

## UI 字体

UI 字体用于应用界面中的所有正文文本，包括菜单、按钮、标签和一般内容展示。

### 可选字体

| 字体 | 说明 |
|------|------|
| **Noto Sans SC** | Google 开源的思源黑体，支持中日韩文字，显示效果优秀（默认） |
| **系统默认** | 使用操作系统默认的 UI 字体（system-ui） |

### 切换方式

1. 进入设置页面的 **字体** 版块
2. 在「UI 字体」行点击下拉选择器
3. 选择你偏好的字体
4. 切换立即生效，所有界面文本会使用新字体渲染

### 技术说明

选择 `Noto Sans SC` 时，CSS 字体栈为：

```css
'Noto Sans SC', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

选择「系统默认」时，CSS 字体栈为：

```css
system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

> **注意**：如果系统中未安装 `Noto Sans SC` 字体，浏览器会自动回退到字体栈中的下一个可用字体。

## 等宽字体

等宽字体用于代码块、行内代码、编辑器源码模式和终端等场景。所有字符在等宽字体中占据相同的水平宽度，使代码对齐更加清晰。

### 可选字体

| 字体 | 说明 |
|------|------|
| **JetBrains Mono** | JetBrains 专为开发者设计的等宽字体，连字支持优秀（默认） |
| **Consolas** | Windows 系统经典的等宽字体，适合代码阅读 |
| **系统等宽** | 使用操作系统默认的等宽字体（monospace） |

### 切换方式

与 UI 字体相同，在「等宽字体」行的下拉选择器中选择偏好字体即可。

### 技术说明

选择 `JetBrains Mono` 时，CSS 字体栈为：

```css
'JetBrains Mono', 'SFMono-Regular', Consolas, monospace
```

选择 `Consolas` 时，CSS 字体栈为：

```css
'Consolas', 'SFMono-Regular', Consolas, monospace
```

选择「系统等宽」时，CSS 字体栈为：

```css
'SFMono-Regular', Consolas, monospace
```

## 字号

字号控制界面中基础文本的大小。QuantaNote 允许在 **14px 到 18px** 之间调整基础字号。

### 可选字号

| 字号 | 说明 |
|------|------|
| **14 px** | 紧凑型，适合小屏幕或希望在一屏内显示更多内容 |
| **15 px** | 默认字号，兼顾可读性和信息密度 |
| **16 px** | 舒适阅读，适合较大屏幕 |
| **17 px** | 较大字号，适合需要更大文字的场景 |
| **18 px** | 最大字号，适合视力辅助需求 |

### 字号联动

调整基础字号后，以下 CSS 变量会自动按比例缩放：

| CSS 变量 | 计算公式 | 说明 |
|----------|----------|------|
| `--font-size-base` | `fontSize` | 基础字号 |
| `--font-size-2xs` | `max(11px, fontSize - 3)` | 极小字号 |
| `--font-size-xs` | `max(12px, fontSize - 2)` | 小字号 |
| `--font-size-sm` | `fontSize` | 小字号（同基础） |
| `--font-size-md` | `fontSize` | 中字号（同基础） |
| `--font-size-lg` | `fontSize + 2` | 大字号 |
| `--font-size-xl` | `fontSize + 5` | 超大字号 |
| `--font-size-2xl` | `fontSize + 9` | 二级标题字号 |
| `--font-size-3xl` | `fontSize + 13` | 一级标题字号 |

## 预览

设置页面提供了一个 **实时预览区域**，位于字号设置下方。当你更改字体或字号时，预览区域会立即更新，让你在实际应用前就能看到效果。

预览区域展示一段示例文本，使用当前选中的字体和字号渲染，方便你快速比较不同配置的视觉效果。

> **提示**：选择字体时建议考虑中文显示效果。`Noto Sans SC` 对中文有专门优化，推荐中文用户优先使用。
