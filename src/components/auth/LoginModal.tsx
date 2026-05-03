import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";

interface LoginModalProps {
    open: boolean;
    onClose: () => void;
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
}

export function LoginModal({
    open,
    onClose,
    onSwitchToRegister,
    onSwitchToForgotPassword,
}: LoginModalProps) {
    const { config, login, isLoading, error, clearError } = useSyncStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        try {
            await login(config.server_url || serverUrl, email, password);
            onClose();
        } catch {
            // error is set in store
        }
    }

    const [serverUrl, setServerUrl] = useState(config.server_url || "");

    function handleClose() {
        clearError();
        setEmail("");
        setPassword("");
        onClose();
    }

    return (
        <Modal open={open} onClose={handleClose} title="登录同步账号">
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
                        placeholder="输入密码"
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
                    disabled={isLoading || !email.trim() || !password.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <LogIn className="h-4 w-4" />
                    )}
                    {isLoading ? "登录中..." : "登录"}
                </button>

                <div className="flex items-center justify-between text-xs">
                    <button
                        type="button"
                        onClick={onSwitchToRegister}
                        className="text-[var(--accent)] hover:underline"
                    >
                        没有账号？注册
                    </button>
                    <button
                        type="button"
                        onClick={onSwitchToForgotPassword}
                        className="text-[var(--muted)] hover:text-[var(--text)]"
                    >
                        忘记密码？
                    </button>
                </div>
            </form>
        </Modal>
    );
}
