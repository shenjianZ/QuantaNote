import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";

interface RegisterModalProps {
    open: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void;
}

export function RegisterModal({
    open,
    onClose,
    onSwitchToLogin,
}: RegisterModalProps) {
    const { t } = useTranslation(["auth"]);
    const { config, register, isLoading, error, clearError } = useSyncStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [serverUrl, setServerUrl] = useState(config.server_url || "");
    const [localError, setLocalError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLocalError("");

        if (!email.trim() || !password.trim()) return;
        if (password !== confirmPassword) {
            setLocalError(t("register.passwordMismatch"));
            return;
        }
        if (password.length < 6) {
            setLocalError(t("register.passwordTooShort"));
            return;
        }

        try {
            await register(config.server_url || serverUrl, email, password);
            onClose();
        } catch {
            // error is set in store
        }
    }

    function handleClose() {
        clearError();
        setLocalError("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        onClose();
    }

    const displayError = localError || error;

    return (
        <Modal open={open} onClose={handleClose} title={t("register.title")}>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-modal">
                {!config.server_url && (
                    <div>
                        <label className="mb-1 block text-xs text-[var(--muted)]">
                            {t("register.serverUrl")}
                        </label>
                        <input
                            data-testid="register-server-url-input"
                            type="url"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://your-server.com"
                            className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            required
                        />
                    </div>
                )}
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        {t("register.email")}
                    </label>
                    <input
                        data-testid="register-email-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        required
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        {t("register.password")}
                    </label>
                    <input
                        data-testid="register-password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("register.passwordPlaceholder")}
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        required
                        minLength={6}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        {t("register.confirmPassword")}
                    </label>
                    <input
                        data-testid="register-confirm-password-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t("register.confirmPlaceholder")}
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        required
                    />
                </div>

                {displayError && (
                    <div data-testid="register-error" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                        {displayError}
                    </div>
                )}

                <button
                    data-testid="register-submit-btn"
                    type="submit"
                    disabled={
                        isLoading ||
                        !email.trim() ||
                        !password.trim() ||
                        !confirmPassword.trim()
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <UserPlus className="h-4 w-4" />
                    )}
                    {isLoading ? t("register.submitting") : t("register.submitBtn")}
                </button>

                <div className="text-center text-xs">
                    <button
                        data-testid="register-switch-to-login"
                        type="button"
                        onClick={onSwitchToLogin}
                        className="text-[var(--accent)] hover:underline"
                    >
                        {t("register.hasAccount")}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
