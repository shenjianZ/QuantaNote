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
  {
    as: "style",
    path: `${VDITOR_CDN}/dist/css/content-theme/dark.css`,
  },
  {
    as: "style",
    path: `${VDITOR_CDN}/dist/css/content-theme/light.css`,
  },
  {
    as: "script",
    path: `${VDITOR_CDN}/dist/js/highlight.js/highlight.min.js`,
  },
  {
    as: "script",
    path: `${VDITOR_CDN}/dist/js/highlight.js/third-languages.js`,
  },
];

function addPreloadHint(path: string, as: string) {
  if (document.querySelector(`link[rel="preload"][href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.href = path;
  link.as = as;
  document.head.appendChild(link);
}

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

export function preloadVditorResources() {
  if (preloadPromise) return preloadPromise;
  if (typeof document === "undefined" || import.meta.env.MODE === "test") {
    preloadPromise = Promise.resolve();
    return preloadPromise;
  }

  [...SCRIPT_ASSETS.map((asset) => ({ as: "script", path: asset.path })), ...HINT_ASSETS]
    .forEach((asset) => addPreloadHint(asset.path, asset.as));

  preloadPromise = Promise.all([
    import("../components/editor/VditorEditor"),
    ...SCRIPT_ASSETS.map((asset) => loadScript(asset.path, asset.id)),
  ])
    .then(() => undefined)
    .catch(() => undefined);

  return preloadPromise;
}
