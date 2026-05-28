import { invoke } from "@tauri-apps/api/core";

type NativeLogLevel = "info" | "warn" | "error";

const LEVELS: Record<NativeLogLevel, number> = {
  info: 3,
  warn: 4,
  error: 5,
};

function stringifyDetails(details: unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export function nativeLog(level: NativeLogLevel, message: string, details?: unknown) {
  const detailText = stringifyDetails(details);
  const fullMessage = detailText ? `${message} ${detailText}` : message;

  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod(fullMessage);

  invoke("plugin:log|log", {
    level: LEVELS[level],
    message: fullMessage,
    location: "mobile-back",
    file: "webview",
    line: 0,
    keyValues: null,
  }).catch((error) => {
    console.warn("[QuantaNote][native-log] failed to write Tauri log", error);
  });
}
