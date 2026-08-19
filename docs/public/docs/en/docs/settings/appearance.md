---
title: Appearance Settings
description: QuantaNote appearance settings including theme mode switching, 12 preset accent colors with custom color picker, and language selection
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Appearance Settings

Appearance settings let you customize the visual style of QuantaNote, including theme mode, accent color, and interface language. All appearance changes take effect immediately without restarting the application.

## Theme

QuantaNote provides three theme modes, switchable via the theme button group at the top of the Settings page:

| Mode | Description | Use Case |
|------|-------------|----------|
| **System** | Automatically follows the operating system's dark/light mode setting | Recommended for most users; adapts to ambient lighting changes |
| **Light** | Always uses a light background theme | Suitable for well-lit environments or personal preference |
| **Dark** | Always uses a dark background theme | Ideal for nighttime use or low-light environments to reduce eye strain |

### Switching Themes

In the **Appearance** section of the Settings page, click the corresponding theme button:

- Click **System** (laptop icon) to automatically match the system theme
- Click **Light** (sun icon) to force the light theme
- Click **Dark** (moon icon) to force the dark theme

### Technical Details

Themes are implemented via the `data-theme` HTML attribute. CSS variables are defined in `styles/themes.css`:

- `--app-bg`: Application background color
- `--paper`: Content area background color
- `--text`: Primary text color
- `--muted`: Secondary text color
- `--line`: Border color
- `--field`: Input field background color
- `--hover`: Hover background color
- `--accent`: Accent color
- `--accent-soft`: Soft accent color variant

## Accent Color

The accent color is used for buttons, selected states, links, and interactive element highlights. QuantaNote provides **12 preset colors** plus **custom color** support.

### Preset Colors

| Color | Hex Value | Name |
|-------|-----------|------|
| ![#386c5f](https://via.placeholder.com/15/386c5f/386c5f) | `#386c5f` | Deep Green (default) |
| ![#2563eb](https://via.placeholder.com/15/2563eb/2563eb) | `#2563eb` | Blue |
| ![#7c3aed](https://via.placeholder.com/15/7c3aed/7c3aed) | `#7c3aed` | Purple |
| ![#c47b12](https://via.placeholder.com/15/c47b12/c47b12) | `#c47b12` | Amber |
| ![#b64242](https://via.placeholder.com/15/b64242/b64242) | `#b64242` | Red |
| ![#0891b2](https://via.placeholder.com/15/0891b2/0891b2) | `#0891b2` | Cyan |
| ![#059669](https://via.placeholder.com/15/059669/059669) | `#059669` | Emerald |
| ![#d97706](https://via.placeholder.com/15/d97706/d97706) | `#d97706` | Orange |
| ![#e11d48](https://via.placeholder.com/15/e11d48/e11d48) | `#e11d48` | Rose |
| ![#6366f1](https://via.placeholder.com/15/6366f1/6366f1) | `#6366f1` | Indigo |
| ![#8b5cf6](https://via.placeholder.com/15/8b5cf6/8b5cf6) | `#8b5cf6` | Violet |
| ![#64748b](https://via.placeholder.com/15/64748b/64748b) | `#64748b` | Slate |

Click any preset color swatch to set it as the current accent color. The selected color displays a highlight ring.

### Custom Colors

If the preset colors don't meet your needs, you can add custom accent colors via the color picker:

1. Click the **+** button below the preset colors section
2. Pick your desired color in the color picker modal
3. Enter a name for the color
4. Click confirm; the custom color is immediately added to the color list

Custom colors appear in the "Custom" section. Hover over a custom color to reveal a delete button.

## Content Width and Document Outline

Use the content-width control when reading long documents or wide tables:

| Option | Best for |
|--------|----------|
| Comfortable | Regular notes and long-form reading |
| Wide | Tables, code, and technical documents |
| Custom | Choosing an exact width with the slider |

Document previews also provide an outline panel generated from headings. Click a heading to jump to that section. Width and outline preferences persist and do not recreate the content when you scroll.

## Language

QuantaNote supports Chinese and English interface languages.

| Language | Code | Description |
|----------|------|-------------|
| Chinese | `zh-CN` | Simplified Chinese interface (default) |
| English | `en` | English interface |

### Switching Language

In the Appearance section at the bottom of the Settings page, find the "Language" option and use the dropdown selector to switch languages. The switch takes effect immediately; all UI text updates automatically.

> **Tip**: The language setting also affects date formats, time display, and other localized content.
