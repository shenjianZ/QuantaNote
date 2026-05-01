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
    stdio: "inherit",
    shell: true,
  });
}

function cleanupProcesses() {
  if (process.platform === "win32") {
    run("taskkill", ["/F", "/T", "/IM", "quanta-note.exe"], { env: {} });
    run("taskkill", ["/F", "/T", "/IM", "tauri-driver.exe"], { env: {} });
    return;
  }
  run("pkill", ["-f", "quanta-note"], { env: {} });
  run("pkill", ["-f", "tauri-driver"], { env: {} });
}

function listSpecs() {
  return fs
    .readdirSync(specsDir)
    .filter((name) => name.endsWith(".e2e.js"))
    .sort()
    .map((name) => path.join(specsDir, name));
}

cleanupProcesses();

const build = run("pnpm", ["tauri", "build", "--debug", "--no-bundle"]);
if (build.status !== 0) {
  cleanupProcesses();
  process.exit(build.status ?? 1);
}

for (const spec of listSpecs()) {
  cleanupProcesses();
  const dataDir = path.join(os.tmpdir(), `quantanote-e2e-serial-${process.pid}-${path.basename(spec, ".e2e.js")}`);
  fs.rmSync(dataDir, { force: true, recursive: true });

  console.log(`\n=== E2E ${path.basename(spec)} ===\n`);
  const result = run("pnpm", ["exec", "wdio", "run", wdioConfig, "--spec", spec], {
    env: {
      E2E_SKIP_BUILD: "1",
      QUANTANOTE_DATA_DIR: dataDir,
      WDIO_MAX_INSTANCES: "1",
      WDIO_SPEC_RETRIES: "0",
    },
  });

  cleanupProcesses();
  fs.rmSync(dataDir, { force: true, recursive: true });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

cleanupProcesses();
