import { useState } from "react";
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
            setLocalError("两次输入的密码不一致");
            return;
        }
        if (newPassword.length < 6) {
            setLocalError("密码长度至少 6 位");
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
        <Modal open={open} onClose={handleClose} title="重置密码">
            <form onSubmit={handleSubmit} className="space-y-4">
                {success ? (
                    <div className="rounded-lg bg-green-500/10 px-4 py-6 text-center">
                        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-400" />
                        <p className="text-sm text-[var(--text)]">
                            密码重置成功，正在跳转到登录页面...
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-[var(--muted)]">
                            输入重置令牌和新密码。令牌已发送到{" "}
                            <span className="font-medium text-[var(--text)]">
                                {email}
                            </span>
                        </p>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                重置令牌
                            </label>
                            <input
                                type="text"
                                value={resetToken}
                                onChange={(e) => setResetToken(e.target.value)}
                                placeholder="输入重置令牌"
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                新密码
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="至少 6 位"
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                确认新密码
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="再次输入新密码"
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                            />
                        </div>

                        {displayError && (
                            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                {displayError}
                            </div>
                        )}

                        <button
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
                            {isLoading ? "重置中..." : "重置密码"}
                        </button>
                    </>
                )}

                <div className="text-center text-xs">
                    <button
                        type="button"
                        onClick={onSwitchToLogin}
                        className="text-[var(--accent)] hover:underline"
                    >
                        返回登录
                    </button>
                </div>
            </form>
        </Modal>
    );
}
