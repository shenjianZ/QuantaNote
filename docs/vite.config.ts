// @ts-nocheck
import path from "path";
import fs from "node:fs/promises";
import { spawn } from "child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { mdxComponentsPlugin } from "./vite-plugin-mdx-components";

const FONT_BASE_URL = "https://file.shenjianl.cn/fonts/";

function earlyDocsRuntimePreloadPlugin() {
    return {
        name: "early-docs-runtime-preload",
        apply: "build",
        async writeBundle(options, bundle) {
            const preloadTargets = Object.values(bundle)
                .filter((entry) => {
                    if (entry.type !== "chunk") {
                        return false;
                    }

                    return (
                        /^assets\/MdxContent\.lazy-.*\.js$/.test(entry.fileName) ||
                        /^assets\/mdx-components-.*\.js$/.test(entry.fileName)
                    );
                })
                .map((entry) => entry.fileName)
                .sort();

            if (preloadTargets.length === 0) {
                return;
            }

            const outputDir = options.dir ?? path.resolve(__dirname, "dist");
            const indexHtmlPath = path.resolve(outputDir, "index.html");

            let html;
            try {
                html = await fs.readFile(indexHtmlPath, "utf8");
            } catch {
                return;
            }

            const preloadTags = preloadTargets
                .map(
                    (fileName) =>
                        `    <link rel="modulepreload" crossorigin href="/${fileName}">`,
                )
                .join("\n");

            if (html.includes('rel="modulepreload" crossorigin href="/assets/MdxContent.lazy-')) {
                return;
            }

            const nextHtml = html.replace("</head>", `${preloadTags}\n    </head>`);
            await fs.writeFile(indexHtmlPath, nextHtml, "utf8");
        },
    };
}

function createManualChunks(id) {
    const normalizedId = id.replace(/\\/g, "/");

    if (
        normalizedId.includes("/react-docs-ui/dist/docs-app.es.js") ||
        normalizedId.includes("/react-docs-ui/dist/DocsApp-")
    ) {
        return "docs-app";
    }

    if (
        normalizedId.includes("/react-docs-ui/dist/GlobalContextMenu-") ||
        normalizedId.includes("/react-docs-ui/dist/SearchRuntime-") ||
        normalizedId.includes("/react-docs-ui/dist/SearchDialog-") ||
        normalizedId.includes("/components/search/") ||
        normalizedId.includes("/lib/search") ||
        normalizedId.includes("/flexsearch/") ||
        normalizedId.includes("/cmdk/")
    ) {
        return "docs-search";
    }

    if (
        normalizedId.includes("/components/ai/") ||
        normalizedId.includes("/lib/ai")
    ) {
        return "docs-ai";
    }

    if (
        normalizedId.includes("/components/MdxContent") ||
        normalizedId.includes("/react-markdown/") ||
        normalizedId.includes("/remark-") ||
        normalizedId.includes("/rehype-") ||
        normalizedId.includes("/unified/") ||
        normalizedId.includes("/micromark/") ||
        normalizedId.includes("/mdast-util-") ||
        normalizedId.includes("/hast-util-") ||
        normalizedId.includes("/katex") ||
        normalizedId.includes("/katex-physics") ||
        normalizedId.includes("/gray-matter/")
    ) {
        return "docs-renderer";
    }

    if (
        normalizedId.includes("/react-router") ||
        normalizedId.includes("/@radix-ui/") ||
        normalizedId.includes("/lucide-react/")
    ) {
        return "docs-ui";
    }

    return undefined;
}

function fontDownloadPlugin() {
    let checkedInServe = false;

    const log = (message) => {
        console.log(`[font-download] ${message}`);
    };

    const formatBytes = (bytes) => {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const extractDownloadFonts = (content) => {
        const lines = content.split(/\r?\n/);
        const fonts = [];
        let inDownloadFonts = false;
        for (const line of lines) {
            if (/^\s*downloadFonts:\s*$/.test(line)) {
                inDownloadFonts = true;
                continue;
            }
            if (inDownloadFonts && /^\s*-\s+/.test(line)) {
                fonts.push(line.replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
                continue;
            }
            if (inDownloadFonts && /^\S/.test(line)) break;
        }
        return fonts;
    };

    const downloadFont = async (task) => {
        const response = await fetch(task.source);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
            throw new Error("response body is empty");
        }

        const totalBytes = Number(response.headers.get("content-length") || 0);
        const reader = response.body.getReader();
        const chunks = [];
        const startedAt = Date.now();
        let downloadedBytes = 0;
        let lastLogAt = 0;

        log(`start: ${task.filename} <- ${task.source}`);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = Buffer.from(value);
            chunks.push(chunk);
            downloadedBytes += chunk.byteLength;

            const now = Date.now();
            if (
                lastLogAt === 0 ||
                now - lastLogAt >= 500 ||
                (totalBytes > 0 && downloadedBytes >= totalBytes)
            ) {
                const elapsedSeconds = Math.max(
                    (now - startedAt) / 1000,
                    0.001,
                );
                const speed = downloadedBytes / elapsedSeconds;
                const progress =
                    totalBytes > 0
                        ? `${((downloadedBytes / totalBytes) * 100).toFixed(1)}%`
                        : "unknown";
                const totalText =
                    totalBytes > 0 ? formatBytes(totalBytes) : "unknown";

                log(
                    `progress: ${task.filename} ${formatBytes(downloadedBytes)}/${totalText} (${progress}) @ ${formatBytes(speed)}/s`,
                );
                lastLogAt = now;
            }
        }

        return Buffer.concat(chunks);
    };

    const ensureFonts = async () => {
        const root = path.resolve(__dirname);
        const configDir = path.resolve(root, "public", "config");
        const fontsDir = path.resolve(root, "public", "fonts");

        await fs.mkdir(fontsDir, { recursive: true });

        const tasks = new Map();
        for (const fileName of ["site.yaml", "site.en.yaml"]) {
            const filePath = path.resolve(configDir, fileName);
            try {
                const content = await fs.readFile(filePath, "utf8");
                const entries = extractDownloadFonts(content);

                for (const entry of entries) {
                    const normalized = String(entry || "").trim();
                    if (!normalized) continue;

                    const url = /^https?:\/\//i.test(normalized)
                        ? new URL(normalized)
                        : new URL(
                              normalized.replace(/^\/+/, ""),
                              FONT_BASE_URL,
                          );

                    const filename = path.posix.basename(url.pathname);
                    if (filename) {
                        tasks.set(filename, {
                            filename,
                            source: url.toString(),
                        });
                    }
                }
            } catch (error) {
                if (error?.code !== "ENOENT") {
                    log(`failed to read ${fileName}: ${error.message}`);
                }
            }
        }

        if (tasks.size === 0) {
            log(
                "no fonts.downloadFonts entries found in public/config/site*.yaml",
            );
            return;
        }

        for (const task of tasks.values()) {
            const targetPath = path.resolve(fontsDir, task.filename);

            try {
                await fs.access(targetPath);
                log(`exists: public/fonts/${task.filename}`);
                continue;
            } catch {
                // Continue to download.
            }

            try {
                const fileBuffer = await downloadFont(task);
                await fs.writeFile(targetPath, fileBuffer);
                log(
                    `downloaded: ${task.source} -> public/fonts/${task.filename}`,
                );
            } catch (error) {
                log(
                    `failed: ${task.source} -> public/fonts/${task.filename} (${error.message})`,
                );
            }
        }
    };

    return {
        name: "font-download-plugin",
        async configureServer() {
            if (checkedInServe) return;
            checkedInServe = true;
            await ensureFonts();
        },
        async buildStart() {
            await ensureFonts();
        },
    };
}

function searchIndexPlugin() {
    return {
        name: "search-index-plugin",
        configureServer(server) {
            const publicDir = path.resolve(__dirname, "public");
            const docsDir = path.resolve(publicDir, "docs");

            server.watcher.add(docsDir);

            let generating = false;
            let pending = false;

            const generateIndex = () => {
                if (generating) {
                    pending = true;
                    return;
                }
                generating = true;

                const child = spawn(
                    "react-docs-ui",
                    ["generate-search-index"],
                    {
                        cwd: path.resolve(__dirname),
                        stdio: "inherit",
                        shell: process.platform === "win32",
                    },
                );

                child.on("close", () => {
                    generating = false;
                    if (pending) {
                        pending = false;
                        generateIndex();
                    }
                });
            };

            const isDocFile = (file) => {
                return (
                    file.includes(path.sep + "docs" + path.sep) &&
                    (file.endsWith(".md") || file.endsWith(".mdx"))
                );
            };

            const debounce = (fn, delay) => {
                let timer = null;
                return (...args) => {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => fn(...args), delay);
                };
            };

            const debouncedGenerate = debounce(generateIndex, 500);

            server.watcher.on("change", (file) => {
                if (isDocFile(file)) debouncedGenerate();
            });

            server.watcher.on("add", (file) => {
                if (isDocFile(file)) debouncedGenerate();
            });

            server.watcher.on("unlink", (file) => {
                if (isDocFile(file)) debouncedGenerate();
            });
        },
    };
}

function publicHmrPlugin() {
    return {
        name: "public-hmr",
        configureServer(server) {
            const publicDir = path.resolve(__dirname, "public");
            const configDir = path.resolve(publicDir, "config");
            const docsDir = path.resolve(publicDir, "docs");

            server.watcher.add([configDir, docsDir]);

            const isTargetFile = (file) => {
                const relativePath = path.relative(publicDir, file);
                return (
                    (relativePath.startsWith("config" + path.sep) &&
                        file.endsWith(".yaml")) ||
                    (relativePath.startsWith("docs" + path.sep) &&
                        (file.endsWith(".md") || file.endsWith(".mdx")))
                );
            };

            const triggerReload = (file) => {
                if (isTargetFile(file)) {
                    server.ws.send({ type: "full-reload", path: "*" });
                }
            };

            server.watcher.on("change", triggerReload);
            server.watcher.on("add", triggerReload);
        },
    };
}

export default defineConfig({
    plugins: [
        react(),
        mdxComponentsPlugin({
            componentsPath: "./src/components",
            outputPath: "./src/generated/mdx-components.ts",
        }),
        earlyDocsRuntimePreloadPlugin(),
        fontDownloadPlugin(),
        searchIndexPlugin(),
        publicHmrPlugin(),
    ],
    resolve: {
        dedupe: ["react", "react-dom", "react-router-dom"],
        alias: {
            "@": "src",
            buffer: "buffer",
        },
    },
    define: {
        global: "globalThis",
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
        fs: {
            allow: [
                path.resolve(__dirname),
                path.resolve(__dirname, "../../react-docs-ui/dist"),
            ],
        },
    },
    build: {
        chunkSizeWarningLimit: 2000,
        assetsInlineLimit: 0,
        modulePreload: false,
        rollupOptions: {
            output: {
                manualChunks: createManualChunks,
            },
        },
    },
});
