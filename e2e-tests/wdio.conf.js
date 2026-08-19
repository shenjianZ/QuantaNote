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
const maxInstances = Number(process.env.WDIO_MAX_INSTANCES || "1");
const specFileRetries = Number(process.env.WDIO_SPEC_RETRIES || "0");

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

function killExistingApp() {
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/F", "/T", "/IM", "quanta-note.exe"], { stdio: "ignore", shell: true });
    } else {
      spawnSync("pkill", ["-f", "quanta-note"], { stdio: "ignore", shell: true });
    }
  } catch {
    // ignore — no existing process
  }
}

function maximizeNativeAppWindow() {
  if (process.platform !== "win32") return false;
  const script = `
    Add-Type @'
    using System;
    using System.Runtime.InteropServices;
    public static class QuantaNoteWindow {
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
    }
    '@
    $found = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
      $process = Get-Process -Name "quanta-note" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } |
        Select-Object -First 1
      if ($process) {
        [QuantaNoteWindow]::ShowWindow($process.MainWindowHandle, 3) | Out-Null
        [QuantaNoteWindow]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        $found = $true
        break
      }
      Start-Sleep -Milliseconds 100
    }
    if (-not $found) { exit 1 }
  `;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
}

function closeTauriDriver() {
  expectedExit = true;
  tauriDriver?.kill();
}

function onShutdown() {
  closeTauriDriver();
  killExistingApp();
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
  maxInstances,
  capabilities: [
    {
      maxInstances,
      "tauri:options": {
        application: appBinary,
      },
    },
  ],
  logLevel: "warn",
  framework: "mocha",
  async before() {
    // 桌面端布局测试使用最大化窗口，避免小窗口下侧栏高度被压缩。
    const nativeWindowMaximized = maximizeNativeAppWindow();
    let webdriverWindowMaximized = false;
    try {
      await browser.maximizeWindow();
      webdriverWindowMaximized = true;
    } catch {
      // WebView2 某些环境不支持 maximize，下面使用显式的大窗口尺寸兜底。
    }
    if (!nativeWindowMaximized && !webdriverWindowMaximized) {
      await browser.setWindowSize(1920, 1080);
    }
    console.log(`\n🎬 E2E 模式: ${isHeaded ? "有头 (headed)" : "无头 (headless)"}\n`);
  },
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  specFileRetries,
  onPrepare() {
    killExistingDriver();
    killExistingApp();
    if (process.env.E2E_SKIP_BUILD === "1" || process.env.E2E_SKIP_BUILD === "true") {
      return;
    }

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
    killExistingApp();
    expectedExit = false;
    tauriDriver = spawn("tauri-driver", [], {
      env: {
        ...process.env,
        QUANTANOTE_DATA_DIR: dataDir,
        QUANTANOTE_E2E_FULLSCREEN: "1",
      },
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
    killExistingApp();
  },
};
