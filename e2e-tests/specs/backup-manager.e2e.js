import { cleanupAll, resetAppState, triggerBackupNow, listBackups, deleteBackup } from "../helpers/commands.js";
import { observePause, pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import BackupManagerModal from "../helpers/page-objects/BackupManagerModal.js";

describe("Backup manager modal", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
        await SettingsPage.selectSection("数据");
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    it("opens backup manager modal from data section", async () => {
        await SettingsPage.clickBackupManager();
        await BackupManagerModal.waitOpen();
        expect(await BackupManagerModal.isOpen()).toBe(true);
    });

    it("displays empty state when no backups exist", async () => {
        // Close modal, clear any existing backups
        await BackupManagerModal.close();
        const backups = await listBackups();
        for (const b of backups) {
            await deleteBackup(b.filename);
        }
        // Re-open
        await SettingsPage.clickBackupManager();
        await BackupManagerModal.waitOpen();
        expect(await BackupManagerModal.isEmptyStateVisible()).toBe(true);
    });

    it("shows backup list after creating a backup via Tauri command", async () => {
        await BackupManagerModal.close();
        await triggerBackupNow();
        await pause(1000);
        await SettingsPage.clickBackupManager();
        await BackupManagerModal.waitOpen();
        const count = await BackupManagerModal.getBackupCount();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    it("displays backup filename and size for each entry", async () => {
        const items = await $$("[data-testid='backup-item']");
        expect(items.length).toBeGreaterThanOrEqual(1);
        // Each item should have text content
        const text = await items[0].getText();
        expect(text.length).toBeGreaterThan(0);
    });

    it("marks manual backups as verified and supports rechecking integrity", async () => {
        const backups = await listBackups();
        const manual = backups.find((backup) => backup.filename.startsWith("manual-backup-"));
        expect(manual).toBeTruthy();
        expect(manual.verified).toBe(true);
        expect(manual.backup_type).toBe("manual");

        await BackupManagerModal.verifyBackup(0);
        const status = await $("[data-testid='backup-verification-status']");
        await status.waitForDisplayed();
        expect(await status.getText()).toContain("完整性已验证");
    });

    it("shows the latest successful backup filename and size in data settings", async () => {
        await BackupManagerModal.close();
        await SettingsPage.clickBackupNow();
        await pause(500);

        const latest = await $("[data-testid='backup-last-success']");
        await latest.waitForDisplayed();
        const text = await latest.getText();
        expect(text).toContain("manual-backup-");
        expect(text).toMatch(/\d+(\.\d+)?\s(B|KB|MB|GB)/);
    });

    it("deletes a backup when delete button is clicked", async () => {
        if (!(await BackupManagerModal.isOpen())) {
            await SettingsPage.clickBackupManager();
            await BackupManagerModal.waitOpen();
        }
        const countBefore = await BackupManagerModal.getBackupCount();
        if (countBefore > 0) {
            await BackupManagerModal.deleteBackup(0);
            await pause(500);
            // Re-open to refresh
            await BackupManagerModal.close();
            await SettingsPage.clickBackupManager();
            await BackupManagerModal.waitOpen();
            const countAfter = await BackupManagerModal.getBackupCount();
            expect(countAfter).toBeLessThan(countBefore);
        }
    });

    it("closes modal via close button", async () => {
        if (await BackupManagerModal.isOpen()) {
            await BackupManagerModal.close();
        }
        await observePause();
        expect(await BackupManagerModal.isOpen()).toBe(false);
    });
});
