import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, Loader2, CheckCircle } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";

interface ResetPasswordModalProps {
    open: boolean;
    onClose: () => void;
    email: string;
    resetToken: string;
    onSwitchToLogin: () => void;
}

export function ResetPasswordModal({
    open,
    onClose,
    email,
    resetToken: initialToken,
    onSwitchToLogin,
}: ResetPasswordModalProps) {
    const { t } = useTranslation(["auth"]);
    const { config, resetPassword, isLoading, error, clearError } = useSyncStore();
    const [resetToken, setResetToken] = useState(initialToken);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState("");
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLocalError("");

        if (!resetToken.trim() || !newPassword.trim()) return;
        if (newPassword !== confirmPassword) {
            setLocalError(t("resetPassword.passwordMismatch"));
            return;
        }
        if (newPassword.length < 6) {
            setLocalError(t("resetPassword.passwordTooShort"));
            return;
        }

        try {
            await resetPassword(
                config.server_url,
                email,
                resetToken,
                newPassword,
            );
            setSuccess(true);
            setTimeout(() => {
                onSwitchToLogin();
            }, 1500);
        } catch {
            // error is set in store
        }
    }

    function handleClose() {
        clearError();
        setLocalError("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess(false);
        onClose();
    }

    const displayError = localError || error;

    return (
        <Modal open={open} onClose={handleClose} title={t("resetPassword.title")}>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-modal">
                {success ? (
                    <div data-testid="reset-success" className="rounded-lg bg-green-500/10 px-4 py-6 text-center">
                        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-400" />
                        <p className="text-sm text-[var(--text)]">
                            {t("resetPassword.success")}
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-[var(--muted)]">
                            {t("resetPassword.desc")}{" "}
                            <span className="font-medium text-[var(--text)]">
                                {email}
                            </span>
                        </p>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                {t("resetPassword.token")}
                            </label>
                            <input
                                data-testid="reset-token-input"
                                type="text"
                                value={resetToken}
                                onChange={(e) => setResetToken(e.target.value)}
                                placeholder={t("resetPassword.tokenPlaceholder")}
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                {t("resetPassword.newPassword")}
                            </label>
                            <input
                                data-testid="reset-new-password-input"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder={t("resetPassword.newPasswordPlaceholder")}
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                {t("resetPassword.confirmPassword")}
                            </label>
                            <input
                                data-testid="reset-confirm-password-input"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t("resetPassword.confirmPlaceholder")}
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                            />
                        </div>

                        {displayError && (
                            <div data-testid="reset-error" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                {displayError}
                            </div>
                        )}

                        <button
                            data-testid="reset-submit-btn"
                            type="submit"
                            disabled={
                                isLoading ||
                                !resetToken.trim() ||
                                !newPassword.trim() ||
                                !confirmPassword.trim()
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <KeyRound className="h-4 w-4" />
                            )}
                            {isLoading ? t("resetPassword.submitting") : t("resetPassword.submitBtn")}
                        </button>
                    </>
                )}

                <div className="text-center text-xs">
                    <button
                        data-testid="reset-switch-to-login"
                        type="button"
                        onClick={onSwitchToLogin}
                        className="text-[var(--accent)] hover:underline"
                    >
                        {t("resetPassword.backToLogin")}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
