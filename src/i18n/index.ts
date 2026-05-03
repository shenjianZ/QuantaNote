import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCommon from "./locales/zh-CN/common.json";
import zhWorkspace from "./locales/zh-CN/workspace.json";
import zhLibrary from "./locales/zh-CN/library.json";
import zhDocument from "./locales/zh-CN/document.json";
import zhSettings from "./locales/zh-CN/settings.json";
import zhTopbar from "./locales/zh-CN/topbar.json";
import zhStatusbar from "./locales/zh-CN/statusbar.json";
import zhCommandPalette from "./locales/zh-CN/command-palette.json";
import zhModals from "./locales/zh-CN/modals.json";
import zhSync from "./locales/zh-CN/sync.json";
import zhAuth from "./locales/zh-CN/auth.json";
import zhEditor from "./locales/zh-CN/editor.json";

import enCommon from "./locales/en/common.json";
import enWorkspace from "./locales/en/workspace.json";
import enLibrary from "./locales/en/library.json";
import enDocument from "./locales/en/document.json";
import enSettings from "./locales/en/settings.json";
import enTopbar from "./locales/en/topbar.json";
import enStatusbar from "./locales/en/statusbar.json";
import enCommandPalette from "./locales/en/command-palette.json";
import enModals from "./locales/en/modals.json";
import enSync from "./locales/en/sync.json";
import enAuth from "./locales/en/auth.json";
import enEditor from "./locales/en/editor.json";

const resources = {
  "zh-CN": {
    common: zhCommon,
    workspace: zhWorkspace,
    library: zhLibrary,
    document: zhDocument,
    settings: zhSettings,
    topbar: zhTopbar,
    statusbar: zhStatusbar,
    "command-palette": zhCommandPalette,
    modals: zhModals,
    sync: zhSync,
    auth: zhAuth,
    editor: zhEditor,
  },
  en: {
    common: enCommon,
    workspace: enWorkspace,
    library: enLibrary,
    document: enDocument,
    settings: enSettings,
    topbar: enTopbar,
    statusbar: enStatusbar,
    "command-palette": enCommandPalette,
    modals: enModals,
    sync: enSync,
    auth: enAuth,
    editor: enEditor,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "zh-CN",
  fallbackLng: "zh-CN",
  ns: [
    "common",
    "workspace",
    "library",
    "document",
    "settings",
    "topbar",
    "statusbar",
    "command-palette",
    "modals",
    "sync",
    "auth",
    "editor",
  ],
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
