---
title: Font Settings
description: QuantaNote font settings including UI font selection, monospace font selection, font size adjustment (14-18px), and real-time preview
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Font Settings

Font settings let you customize how text is rendered throughout the QuantaNote interface, including the UI font, monospace font, and base font size. A well-chosen font configuration can significantly improve your reading and editing experience.

## UI Font

The UI font is used for all body text in the application interface, including menus, buttons, labels, and general content display.

### Available Fonts

| Font | Description |
|------|-------------|
| **Noto Sans SC** | Google's open-source CJK font with excellent Chinese/Japanese/Korean character support (default) |
| **System Default** | Uses the operating system's default UI font (system-ui) |

### How to Switch

1. Navigate to the **Font** section in Settings
2. Click the dropdown selector in the "UI Font" row
3. Select your preferred font
4. The change takes effect immediately; all interface text re-renders with the new font

### Technical Details

When `Noto Sans SC` is selected, the CSS font stack is:

```css
'Noto Sans SC', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

When "System Default" is selected:

```css
system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

> **Note**: If `Noto Sans SC` is not installed on your system, the browser automatically falls back to the next available font in the stack.

## Monospace Font

The monospace font is used for code blocks, inline code, editor source mode, and terminal-style content. All characters occupy the same horizontal width, keeping code alignment clear.

### Available Fonts

| Font | Description |
|------|-------------|
| **JetBrains Mono** | A developer-focused monospace font by JetBrains with excellent ligature support (default) |
| **Consolas** | A classic Windows monospace font well-suited for code reading |
| **System Monospace** | Uses the operating system's default monospace font |

### How to Switch

Same as the UI font: use the dropdown selector in the "Monospace Font" row.

### Technical Details

When `JetBrains Mono` is selected, the CSS font stack is:

```css
'JetBrains Mono', 'SFMono-Regular', Consolas, monospace
```

When `Consolas` is selected:

```css
'Consolas', 'SFMono-Regular', Consolas, monospace
```

When "System Monospace" is selected:

```css
'SFMono-Regular', Consolas, monospace
```

## Font Size

Font size controls the base text size across the interface. QuantaNote allows adjustment between **14px and 18px**.

### Available Sizes

| Size | Description |
|------|-------------|
| **14 px** | Compact; ideal for smaller screens or fitting more content on screen |
| **15 px** | Default size; balances readability with information density |
| **16 px** | Comfortable reading; well-suited for larger displays |
| **17 px** | Larger text; for scenarios requiring bigger characters |
| **18 px** | Maximum size; suitable for vision accessibility needs |

### Scaled Sizes

When you adjust the base font size, the following CSS variables scale proportionally:

| CSS Variable | Formula | Description |
|--------------|---------|-------------|
| `--font-size-base` | `fontSize` | Base font size |
| `--font-size-2xs` | `max(11px, fontSize - 3)` | Extra-extra-small |
| `--font-size-xs` | `max(12px, fontSize - 2)` | Extra-small |
| `--font-size-sm` | `fontSize` | Small (same as base) |
| `--font-size-md` | `fontSize` | Medium (same as base) |
| `--font-size-lg` | `fontSize + 2` | Large |
| `--font-size-xl` | `fontSize + 5` | Extra-large |
| `--font-size-2xl` | `fontSize + 9` | 2XL (H2 heading size) |
| `--font-size-3xl` | `fontSize + 13` | 3XL (H1 heading size) |

## Preview

The Settings page includes a **live preview area** located below the font size selector. When you change fonts or font size, the preview area updates immediately so you can see the effect before it's applied throughout the app.

The preview displays sample text rendered with your current font and size selections, making it easy to compare the visual impact of different configurations.

> **Tip**: When selecting a font, consider Chinese character rendering quality. `Noto Sans SC` is specifically optimized for Chinese text and is recommended for Chinese-language users.
