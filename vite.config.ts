/// <reference types="vitest/config" />

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createReadStream } from "node:fs";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

const VDITOR_ASSET_PREFIX = "/vditor/dist";
const VDITOR_DIST_DIR = path.resolve("node_modules", "vditor", "dist");
const VDITOR_BUILD_ASSETS = [
  "css/content-theme/dark.css",
  "css/content-theme/light.css",
  "images",
  "js/highlight.js/highlight.min.js",
  "js/highlight.js/third-languages.js",
  "js/highlight.js/styles/dark.min.css",
  "js/highlight.js/styles/github.min.css",
  "js/i18n/zh_CN.js",
  "js/icons/ant.js",
  "js/katex",
  "js/lute/lute.min.js",
  // ```flowchart 代码块按需加载 flowchart.min.js,缺失时打包版流程图永远无法渲染
  "js/flowchart.js",
  "js/mermaid",
  "js/i18n/en_US.js",
];

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

async function copyVditorAsset(relativePath: string, targetDir: string) {
  const sourcePath = path.resolve(VDITOR_DIST_DIR, relativePath);
  const targetPath = path.resolve(targetDir, relativePath);

  if (!sourcePath.startsWith(`${VDITOR_DIST_DIR}${path.sep}`)) {
    throw new Error(`Invalid Vditor asset path: ${relativePath}`);
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}

function vditorAssetsPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "quantanote-vditor-assets",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use(VDITOR_ASSET_PREFIX, async (req, res, next) => {
        const requestPath = decodeURIComponent(req.url?.split("?")[0] ?? "");
        const filePath = path.resolve(VDITOR_DIST_DIR, requestPath.replace(/^\/+/, ""));

        if (!filePath.startsWith(`${VDITOR_DIST_DIR}${path.sep}`)) {
          res.statusCode = 403;
          res.end();
          return;
        }

        try {
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) {
            next();
            return;
          }

          res.setHeader("Content-Type", getContentType(filePath));
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const targetDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, "vditor", "dist");
      await rm(targetDir, { recursive: true, force: true });
      await Promise.all(VDITOR_BUILD_ASSETS.map((asset) => copyVditorAsset(asset, targetDir)));
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), vditorAssetsPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host ? "0.0.0.0" : false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
}));
