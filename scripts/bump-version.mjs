#!/usr/bin/env node

/**
 * 统一修改全项目版本号
 *
 * 用法: node scripts/bump-version.mjs <version>
 * 示例: node scripts/bump-version.mjs 0.2.0
 *
 * 修改范围:
 *   - package.json (root)
 *   - docs/package.json
 *   - slides/package.json
 *   - src-tauri/Cargo.toml
 *   - src-tauri/tauri.conf.json
 *   - quantanote-cloud/Cargo.toml
 *   - quantanote-cloud/src/cli.rs
 *   - quantanote-cloud/src/handlers/health.rs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error("用法: node scripts/bump-version.mjs <version>");
  console.error("示例: node scripts/bump-version.mjs 0.2.0");
  process.exit(1);
}

function filePath(rel) {
  return resolve(root, rel);
}

function replaceInFile(rel, search, replace) {
  const abs = filePath(rel);
  let content = readFileSync(abs, "utf-8");
  const before = content;
  content = content.replace(search, replace);
  if (content === before) {
    console.warn(`  ⚠ 未匹配: ${rel}`);
    return false;
  }
  writeFileSync(abs, content, "utf-8");
  return true;
}

function replaceJsonVersion(rel) {
  const abs = filePath(rel);
  const json = JSON.parse(readFileSync(abs, "utf-8"));
  const old = json.version;
  json.version = newVersion;
  writeFileSync(abs, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`  ✓ ${rel}: ${old} → ${newVersion}`);
}

console.log(`\n🔧 统一修改版本号 → ${newVersion}\n`);

// --- package.json files ---
console.log("📦 package.json:");
replaceJsonVersion("package.json");
replaceJsonVersion("docs/package.json");
replaceJsonVersion("slides/package.json");

// --- Cargo.toml files ---
console.log("\n🦀 Cargo.toml:");
replaceInFile("src-tauri/Cargo.toml", /^version = ".*"$/m, `version = "${newVersion}"`);
console.log(`  ✓ src-tauri/Cargo.toml → ${newVersion}`);
replaceInFile("quantanote-cloud/Cargo.toml", /^version = ".*"$/m, `version = "${newVersion}"`);
console.log(`  ✓ quantanote-cloud/Cargo.toml → ${newVersion}`);

// --- tauri.conf.json ---
console.log("\n⚙️  tauri.conf.json:");
replaceInFile("src-tauri/tauri.conf.json", /"version": ".*"/, `"version": "${newVersion}"`);
console.log(`  ✓ src-tauri/tauri.conf.json → ${newVersion}`);

// --- Rust source files ---
console.log("\n📝 Rust 源文件:");
replaceInFile(
  "quantanote-cloud/src/cli.rs",
  /#\[command\(version = ".*"\)\]/,
  `#[command(version = "${newVersion}")]`
);
console.log(`  ✓ quantanote-cloud/src/cli.rs → ${newVersion}`);
replaceInFile(
  "quantanote-cloud/src/handlers/health.rs",
  /"version": ".*"/,
  `"version": "${newVersion}"`
);
console.log(`  ✓ quantanote-cloud/src/handlers/health.rs → ${newVersion}`);

// --- Frontend source files ---
console.log("\n🌐 前端源文件:");
const settingsPageOk = replaceInFile(
  "src/pages/SettingsPage.tsx",
  /v\d+\.\d+\.\d+(-[\w.]+)?/,
  `v${newVersion}`
);
if (settingsPageOk) {
  console.log(`  ✓ src/pages/SettingsPage.tsx → ${newVersion}`);
}

console.log(`\n✅ 全部版本号已统一为 ${newVersion}\n`);
