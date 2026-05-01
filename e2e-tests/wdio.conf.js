import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appBinary = process.platform === "win32"
  ? path.join(rootDir, "src-tauri", "target", "debug", "quanta-note.exe")
  : path.join(rootDir, "src-tauri", "target", "debug", "quanta-note");
const dataDir = path.join(os.tmpdir(), `quantanote-e2e-${process.pid}`);
const isHeaded = process.env.E2E_HEADED === "1" || process.env.E2E_HEADED === "true";

let tauriDriver;
let expectedExit = false;

function killExistingDriver() {
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/F", "/IM", "tauri-driver.exe"], { stdio: "ignore", shell: true });
    } else {
      spawnSync("pkill", ["-f", "tauri-driver"], { stdio: "ignore", shell: true });
    }
  } catch {
    // ignore — no existing process
  }
}

function closeTauriDriver() {
  expectedExit = true;
  tauriDriver?.kill();
}

function onShutdown() {
  closeTauriDriver();
  try {
    fs.rmSync(dataDir, { force: true, recursive: true });
  } catch {
    // best-effort cleanup only
  }
}

process.on("exit", onShutdown);
process.on("SIGINT", () => {
  onShutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  onShutdown();
  process.exit(143);
});
process.on("SIGBREAK", () => {
  onShutdown();
  process.exit(130);
});

export const config = {
  runner: "local",
  hostname: "127.0.0.1",
  port: 4444,
  specs: [path.join(__dirname, "specs", "**", "*.e2e.js")],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: appBinary,
      },
    },
  ],
  logLevel: "warn",
  framework: "mocha",
  before() {
    console.log(`\n🎬 E2E 模式: ${isHeaded ? "有头 (headed)" : "无头 (headless)"}\n`);
  },
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  onPrepare() {
    const result = spawnSync(
      "pnpm",
      ["tauri", "build", "--debug", "--no-bundle"],
      {
        cwd: rootDir,
        env: { ...process.env, QUANTANOTE_DATA_DIR: dataDir },
        stdio: "inherit",
        shell: true,
      },
    );

    if (result.status !== 0) {
      throw new Error("Tauri debug build failed before E2E run");
    }
  },
  beforeSession() {
    killExistingDriver();
    tauriDriver = spawn("tauri-driver", [], {
      env: { ...process.env, QUANTANOTE_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    tauriDriver.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    tauriDriver.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    tauriDriver.on("error", (error) => {
      console.error("tauri-driver failed to start. Install it with: cargo install tauri-driver --locked");
      console.error(error);
      process.exit(1);
    });
    tauriDriver.on("exit", (code) => {
      if (!expectedExit) {
        console.error(`tauri-driver exited unexpectedly with code ${code}`);
        process.exit(1);
      }
    });
  },
  afterSession() {
    closeTauriDriver();
  },
};
