import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settingsStore";

const LANGUAGES = [
    { value: "zh-CN" as const, flag: "\u{1F1E8}\u{1F1F3}" },
    { value: "en" as const, flag: "\u{1F1EC}\u{1F1E7}" },
];

interface LanguageSetupPageProps {
    onComplete: () => void;
}

export function LanguageSetupPage({ onComplete }: LanguageSetupPageProps) {
    const { t, i18n } = useTranslation("language-setup");
    const completeLanguageSetup = useSettingsStore((s) => s.completeLanguageSetup);
    const [selected, setSelected] = useState<"zh-CN" | "en">(
        i18n.language === "zh-CN" ? "zh-CN" : "en",
    );
    const [saving, setSaving] = useState(false);

    const handleContinue = async () => {
        setSaving(true);
        await completeLanguageSetup(selected);
        onComplete();
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-[var(--app-bg)]">
            <div className="flex w-full max-w-sm flex-col items-center px-6">
                <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">
                    {t("welcome")}
                </h1>
                <p className="mb-8 text-sm text-[var(--muted)]">
                    {t("subtitle")}
                </p>

                <div className="mb-8 w-full space-y-3">
                    {LANGUAGES.map(({ value, flag }) => {
                        const isActive = selected === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                className={`flex w-full items-center gap-3 rounded-xl border-2 px-5 py-3.5 text-left transition-colors ${
                                    isActive
                                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                                        : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--muted)]"
                                }`}
                                onClick={() => {
                                    setSelected(value);
                                    i18n.changeLanguage(value);
                                }}
                            >
                                <span className="text-xl">{flag}</span>
                                <span className="flex-1 text-sm font-medium text-[var(--text)]">
                                    {t(`languages.${value}`)}
                                </span>
                                {isActive && (
                                    <Check size={18} className="text-[var(--accent)]" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    disabled={saving}
                    className="w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    onClick={handleContinue}
                >
                    {t("continue")}
                </button>
            </div>
        </div>
    );
}
