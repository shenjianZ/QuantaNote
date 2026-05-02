import { VDITOR_CDN, VDITOR_LANG } from "./vditorConfig";

let preloadPromise: Promise<void> | null = null;

const SCRIPT_ASSETS = [
  {
    id: `vditorI18nScript${VDITOR_LANG}`,
    path: `${VDITOR_CDN}/dist/js/i18n/${VDITOR_LANG}.js`,
  },
  {
    id: "vditorLuteScript",
    path: `${VDITOR_CDN}/dist/js/lute/lute.min.js`,
  },
  {
    id: "vditorIconScript",
    path: `${VDITOR_CDN}/dist/js/icons/ant.js`,
  },
];

const HINT_ASSETS = [
  `${VDITOR_CDN}/dist/css/content-theme/dark.css`,
  `${VDITOR_CDN}/dist/css/content-theme/light.css`,
  `${VDITOR_CDN}/dist/js/highlight.js/highlight.min.js`,
  `${VDITOR_CDN}/dist/js/highlight.js/third-languages.js`,
];

function loadScript(path: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = path;
    script.async = true;
    document.head.appendChild(script);

    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to preload ${path}`));
    };
    script.onload = () => {
      if (document.getElementById(id)) {
        script.remove();
      } else {
        script.id = id;
      }
      resolve();
    };
  });
}

function warmCache(path: string) {
  return fetch(path, { cache: "force-cache" }).catch(() => undefined);
}

export function preloadVditorResources() {
  if (preloadPromise) return preloadPromise;
  if (typeof document === "undefined" || import.meta.env.MODE === "test") {
    preloadPromise = Promise.resolve();
    return preloadPromise;
  }

  const warmOptionalAssets = () => {
    HINT_ASSETS.forEach((path) => {
      warmCache(path);
    });
  };

  preloadPromise = Promise.all([
    import("../components/editor/VditorEditor"),
    ...SCRIPT_ASSETS.map((asset) => loadScript(asset.path, asset.id)),
  ])
    .then(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(warmOptionalAssets);
      } else {
        globalThis.setTimeout(warmOptionalAssets, 500);
      }
    })
    .catch(() => undefined);

  return preloadPromise;
}
