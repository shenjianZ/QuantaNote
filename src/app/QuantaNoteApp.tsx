import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/search/CommandPalette";
import { HomeDashboard } from "../pages/HomeDashboard";
import { WorkspacePage } from "../pages/WorkspacePage";
import { DocumentEditorPage } from "../pages/DocumentEditorPage";
import { SyncSecurityPage } from "../pages/SyncSecurityPage";
import { SettingsPage } from "../pages/SettingsPage";
import { VaultPage } from "../pages/VaultPage";
import { VersionHistoryPage } from "../pages/VersionHistoryPage";
import { mockItems } from "../data/mockData";
import type { AppPage, Item } from "../types";
import "../styles/global.css";

export function QuantaNoteApp() {
  const [page, setPage] = useState<AppPage>("home");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(mockItems[0].id);

  const selectedItem = useMemo<Item>(
    () => mockItems.find((item) => item.id === selectedItemId) ?? mockItems[0],
    [selectedItemId],
  );

  return (
    <AppShell
      currentPage={page}
      onNavigate={setPage}
      onOpenSearch={() => setPaletteOpen(true)}
    >
      {page === "home" && <HomeDashboard onNavigate={setPage} />}
      {(page === "all" || page === "tags" || page === "files") && (
        <WorkspacePage
          items={mockItems}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItemId}
          onOpenDocument={() => setPage("document")}
        />
      )}
      {page === "document" && <DocumentEditorPage />}
      {page === "vault" && <VaultPage />}
      {page === "sync" && <SyncSecurityPage />}
      {page === "versions" && <VersionHistoryPage />}
      {page === "settings" && <SettingsPage />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenDocument={() => {
          setPaletteOpen(false);
          setPage("document");
        }}
      />
    </AppShell>
  );
}
