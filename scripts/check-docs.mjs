#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(root, "docs", "public", "docs");
const languages = ["zh-cn", "en"];
const errors = [];

function markdownFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      result.push(...markdownFiles(absolute));
    } else if (entry.endsWith(".md")) {
      result.push(absolute);
    }
  }
  return result;
}

function pageKey(file, language) {
  return relative(join(docsRoot, language), file).split(sep).join("/");
}

function readFrontmatter(file) {
  const content = readFileSync(file, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match?.[1] ?? null;
}

const filesByLanguage = new Map();
for (const language of languages) {
  const directory = join(docsRoot, language);
  const files = markdownFiles(directory);
  filesByLanguage.set(language, new Map(files.map((file) => [pageKey(file, language), file])));
}

const zhFiles = filesByLanguage.get("zh-cn");
const enFiles = filesByLanguage.get("en");
for (const key of new Set([...zhFiles.keys(), ...enFiles.keys()])) {
  if (!zhFiles.has(key)) errors.push(`missing zh-cn page: ${key}`);
  if (!enFiles.has(key)) errors.push(`missing en page: ${key}`);
}

for (const [language, files] of filesByLanguage) {
  for (const [key, file] of files) {
    const frontmatter = readFrontmatter(file);
    if (!frontmatter) {
      errors.push(`${language}/${key}: missing frontmatter`);
      continue;
    }
    for (const field of ["title", "description", "lastUpdated"]) {
      if (!new RegExp(`^${field}:\\s*.+$`, "m").test(frontmatter)) {
        errors.push(`${language}/${key}: missing frontmatter field ${field}`);
      }
    }
  }
}

for (const [language, configName] of [["zh-cn", "site.yaml"], ["en", "site.en.yaml"]]) {
  const config = readFileSync(join(root, "docs", "public", "config", configName), "utf8");
  const routes = [...config.matchAll(/^\s+path: "(\/docs(?:\/[^\"]*)?)"$/gm)].map((match) => match[1]);
  for (const route of new Set(routes)) {
    const relativePath = route.slice("/".length);
    const file = join(docsRoot, language, `${relativePath}.md`);
    if (!existsSync(file)) errors.push(`${configName}: sidebar route has no page: ${route}`);
  }
}

if (errors.length > 0) {
  console.error("Documentation checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Documentation checks passed: ${zhFiles.size} zh-cn pages and ${enFiles.size} en pages.`);
