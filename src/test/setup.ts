import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import { randomFillSync } from "node:crypto";
import i18n from "../i18n";

beforeAll(() => {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: (buffer: ArrayBufferView | null) => {
        if (!buffer) return buffer;
        return randomFillSync(buffer);
      },
    },
    configurable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
  });
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});
