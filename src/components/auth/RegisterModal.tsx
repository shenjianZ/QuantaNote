import { useState } from "react";
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
            setLocalError("两次输入的密码不一致");
            return;
        }
        if (password.length < 6) {
            setLocalError("密码长度至少 6 位");
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
        <Modal open={open} onClose={handleClose} title="注册同步账号">
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
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        密码
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="至少 6 位"
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        required
                        minLength={6}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                        确认密码
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="再次输入密码"
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
                    {isLoading ? "注册中..." : "注册"}
                </button>

                <div className="text-center text-xs">
                    <button
                        type="button"
                        onClick={onSwitchToLogin}
                        className="text-[var(--accent)] hover:underline"
                    >
                        已有账号？登录
                    </button>
                </div>
            </form>
        </Modal>
    );
}
