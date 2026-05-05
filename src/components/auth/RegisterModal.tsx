import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Loader2, Send } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";
import { useToastStore } from "../../stores/toastStore";
import { sendVerifyCode } from "../../services/tauriCommands";

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
    const { config, register, isLoading, clearError } = useSyncStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [serverUrl, setServerUrl] = useState(config.server_url || "");
    const [verifyCode, setVerifyCode] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sendingCode, setSendingCode] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    async function handleSendCode() {
        if (!email.trim() || countdown > 0) return;
        setSendingCode(true);
        try {
            const url = config.server_url || serverUrl;
            await sendVerifyCode(url, email);
            setCodeSent(true);
            useToastStore.getState().addToast("success", t("register.codeSent"));
            setCountdown(60);
            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (e) {
            useToastStore.getState().addToast("error", String(e));
        } finally {
            setSendingCode(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!email.trim() || !password.trim()) return;
        if (password !== confirmPassword) {
            useToastStore.getState().addToast("error", t("register.passwordMismatch"));
            return;
        }
        if (password.length < 6) {
            useToastStore.getState().addToast("error", t("register.passwordTooShort"));
            return;
        }

        try {
            await register(config.server_url || serverUrl, email, password, verifyCode || undefined);
            useToastStore.getState().addToast("success", t("register.success"));
            onClose();
        } catch (err) {
            useToastStore.getState().addToast("error", String(err));
        }
    }

    function handleClose() {
        clearError();
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setVerifyCode("");
        setCodeSent(false);
        setCountdown(0);
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    }

    return (
        <Modal open={open} onClose={handleClose} title={t("register.title")}>
            <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="register-modal">
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
                            placeholder={t("register.serverUrlPlaceholder")}
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
                        placeholder={t("register.emailPlaceholder")}
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        required
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        {t("register.verifyCode")}
                    </label>
                    <div className="flex gap-2">
                        <input
                            data-testid="register-verify-code-input"
                            type="text"
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value)}
                            placeholder={t("register.verifyCodePlaceholder")}
                            className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            maxLength={6}
                        />
                        <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={!email.trim() || countdown > 0 || sendingCode}
                            className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--hover)] disabled:opacity-50"
                        >
                            {sendingCode ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : countdown > 0 ? (
                                `${countdown}s`
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    {codeSent && countdown === 0 && (
                        <p className="mt-1 text-xs text-green-500">{t("register.codeSent")}</p>
                    )}
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
