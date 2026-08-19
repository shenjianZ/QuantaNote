import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { MarkdownPreviewWithOutline } from "./MarkdownPreviewWithOutline";
import { ContentWidthControl } from "./ContentWidthControl";
import { DocumentOutlineToggle } from "../editor/DocumentOutline";
import { getVditorLang } from "../../utils/vditorConfig";
import { useSettingsStore } from "../../stores/settingsStore";
import { useViewportContentWidth } from "../../hooks/useResponsiveContentWidth";
import { CONTENT_WIDTH_OUTLINE_LAYOUT, CONTENT_WIDTH_PREVIEW_BASE } from "../../utils/contentWidth";
import type { VersionDto } from "../../types";

interface VersionPreviewModalProps {
  open: boolean;
  version: VersionDto | null;
  onClose: () => void;
  onRestore: (version: VersionDto) => void;
  theme: "light" | "dark";
}

export function VersionPreviewModal({ open, version, onClose, onRestore, theme }: VersionPreviewModalProps) {
  const { t } = useTranslation(["editor"]);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const contentWidthProgress = useSettingsStore((s) => s.settings.contentWidthProgress);
  const showDocumentOutline = useSettingsStore((s) => s.settings.showDocumentOutline);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const previewWidth = useViewportContentWidth(
    CONTENT_WIDTH_PREVIEW_BASE + (showDocumentOutline ? CONTENT_WIDTH_OUTLINE_LAYOUT : 0),
    contentWidthProgress,
    32,
  );

  if (!version) return null;

  function handleRestore() {
    if (!confirmingRef.current) {
      confirmingRef.current = true;
      setConfirming(true);
      return;
    }
    onRestore(version!);
    confirmingRef.current = false;
    setConfirming(false);
  }

  function handleClose() {
    confirmingRef.current = false;
    setConfirming(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("editor:versionPreview.title", { name: version.name || `v${version.version_number}` })}
      maxWidth="max-w-2xl"
      dialogStyle={previewWidth.style}
      headerExtra={(
        <>
          <ContentWidthControl compact testId="version-preview-content-width-control" />
          <DocumentOutlineToggle
            visible={showDocumentOutline}
            onToggle={() => updateSetting("showDocumentOutline", !showDocumentOutline)}
            testId="version-preview-outline-toggle"
          />
        </>
      )}
    >
      {version.description && (
        <p className="mb-3 text-sm text-[var(--muted)]">{version.description}</p>
      )}
      <div className="min-w-0">
        <MarkdownPreviewWithOutline
          content={version.content}
          theme={theme}
          lang={getVditorLang()}
          testId="version-preview-layout"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-full bg-[var(--field)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleClose}
        >
          {t("editor:versionPreview.close")}
        </button>
        <button
          className={`rounded-full px-4 py-2 text-sm text-white ${confirming ? "bg-red-500 hover:bg-red-600" : "bg-[var(--accent)] hover:opacity-90"}`}
          type="button"
          data-testid="version-restore-btn"
          onClick={handleRestore}
        >
          {confirming ? t("editor:versionPreview.confirmRestore") : t("editor:versionPreview.restore")}
        </button>
      </div>
    </Modal>
  );
}
