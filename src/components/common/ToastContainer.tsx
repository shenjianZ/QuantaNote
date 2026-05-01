import { CheckCircle, XCircle, Info } from "lucide-react";
import {
    useToastStore,
    type Toast,
    type ToastType,
} from "../../stores/toastStore";

const iconMap: Record<ToastType, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
};

const colorMap: Record<ToastType, { icon: string; border: string }> = {
    success: {
        icon: "text-[var(--accent)]",
        border: "border-[var(--accent)]/30",
    },
    error: {
        icon: "text-[var(--danger)]",
        border: "border-[var(--danger)]/30",
    },
    info: {
        icon: "text-[var(--muted)]",
        border: "border-[var(--line)]",
    },
};

function ToastItem({ toast }: { toast: Toast }) {
    const Icon = iconMap[toast.type];
    const colors = colorMap[toast.type];

    return (
        <div
            className={`flex items-center gap-3 rounded-2xl border ${colors.border} bg-[var(--popover)] px-4 py-3 text-sm text-[var(--text)] shadow-lg backdrop-blur-sm animate-[toast-in_0.25s_ease-out]`}
            role="alert"
            data-testid={`toast-${toast.type}`}
        >
            <Icon className={`h-4 w-4 shrink-0 ${colors.icon}`} />
            <span>{toast.message}</span>
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);

    if (toasts.length === 0) return null;

    return (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} />
                </div>
            ))}
        </div>
    );
}
