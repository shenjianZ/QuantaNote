import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const specsDir = path.join(__dirname, "specs");
const wdioConfig = path.join(__dirname, "wdio.conf.js");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=2048",
      ...options.env,
    },
    stdio: options.stdio || "inherit",
    shell: true,
  });
}

function cleanupProcesses() {
  if (process.platform === "win32") {
    run("taskkill", ["/F", "/T", "/IM", "quanta-note.exe"], { env: {}, stdio: "ignore" });
    run("taskkill", ["/F", "/T", "/IM", "tauri-driver.exe"], { env: {}, stdio: "ignore" });
    return;
  }
  run("pkill", ["-f", "quanta-note"], { env: {}, stdio: "ignore" });
  run("pkill", ["-f", "tauri-driver"], { env: {}, stdio: "ignore" });
}

function listSpecs() {
  return fs
    .readdirSync(specsDir)
    .filter((name) => name.endsWith(".e2e.js"))
    .sort()
    .map((name) => path.join(specsDir, name));
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results, totalStartedAt) {
  const passed = results.filter((result) => result.status === 0).length;
  const failed = results.length - passed;

  console.log("\n=== E2E serial summary ===\n");
  for (const result of results) {
    const marker = result.status === 0 ? "PASS" : "FAIL";
    console.log(`${marker} ${result.name} (${formatDuration(result.durationMs)})`);
  }
  console.log(`\nSpec files: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`Total time: ${formatDuration(Date.now() - totalStartedAt)}\n`);
}

const results = [];
const totalStartedAt = Date.now();

cleanupProcesses();

const build = run("pnpm", ["tauri", "build", "--debug", "--no-bundle"]);
if (build.status !== 0) {
  cleanupProcesses();
  process.exit(build.status ?? 1);
}

for (const spec of listSpecs()) {
  cleanupProcesses();
  const specStartedAt = Date.now();
  const dataDir = path.join(os.tmpdir(), `quantanote-e2e-serial-${process.pid}-${path.basename(spec, ".e2e.js")}`);
  fs.rmSync(dataDir, { force: true, recursive: true });

  const specName = path.basename(spec);
  console.log(`\n=== E2E ${specName} ===\n`);
  const result = run("pnpm", ["exec", "wdio", "run", wdioConfig, "--spec", spec], {
    env: {
      E2E_SKIP_BUILD: "1",
      QUANTANOTE_DATA_DIR: dataDir,
      WDIO_MAX_INSTANCES: "1",
      WDIO_SPEC_RETRIES: "0",
    },
  });
  results.push({
    name: specName,
    status: result.status ?? 1,
    durationMs: Date.now() - specStartedAt,
  });

  cleanupProcesses();
  fs.rmSync(dataDir, { force: true, recursive: true });

  if (result.status !== 0) {
    printSummary(results, totalStartedAt);
    process.exit(result.status ?? 1);
  }
}

cleanupProcesses();
printSummary(results, totalStartedAt);
