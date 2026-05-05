import { useSettingsStore } from "../stores/settingsStore";

export const VDITOR_CDN = "/vditor";

export function getVditorLang(): "zh_CN" | "en_US" {
  const locale = useSettingsStore.getState().settings.locale;
  return locale === "en" ? "en_US" : "zh_CN";
}
