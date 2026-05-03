import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";

interface ForgotPasswordModalProps {
    open: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void;
    onSwitchToResetPassword: (email: string, resetToken: string) => void;
}

export function ForgotPasswordModal({
    open,
    onClose,
    onSwitchToLogin,
    onSwitchToResetPassword,
}: ForgotPasswordModalProps) {
    const { config, forgotPassword, isLoading, error, clearError } = useSyncStore();
    const [email, setEmail] = useState("");
    const [serverUrl, setServerUrl] = useState(config.server_url || "");
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;

        try {
            const resetToken = await forgotPassword(config.server_url || serverUrl, email);
            setSent(true);
            // 自动跳转到重置密码页面
            setTimeout(() => {
                onSwitchToResetPassword(email, resetToken);
            }, 1500);
        } catch {
            // error is set in store
        }
    }

    function handleClose() {
        clearError();
        setEmail("");
        setSent(false);
        onClose();
    }

    return (
        <Modal open={open} onClose={handleClose} title="忘记密码">
            <form onSubmit={handleSubmit} className="space-y-4">
                {!config.server_url && (
                    <div>
                        <label className="mb-1 block text-xs text-[var(--muted)]">
                            服务器地址
                        </label>
                        <input
                            type="url"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://your-server.com"
                            className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            required
                        />
                    </div>
                )}

                {sent ? (
                    <div className="rounded-lg bg-green-500/10 px-4 py-6 text-center">
                        <Mail className="mx-auto mb-2 h-8 w-8 text-green-400" />
                        <p className="text-sm text-[var(--text)]">
                            重置令牌已生成，正在跳转...
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-[var(--muted)]">
                            输入注册时使用的邮箱，将生成密码重置令牌。
                        </p>
                        <div>
                            <label className="mb-1 block text-xs text-[var(--muted)]">
                                邮箱
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                required
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !email.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Mail className="h-4 w-4" />
                            )}
                            {isLoading ? "发送中..." : "发送重置令牌"}
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
