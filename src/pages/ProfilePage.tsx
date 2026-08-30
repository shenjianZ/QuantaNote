import { useEffect, useState } from "react";
import { ArrowLeft, Camera, KeyRound, Loader2, LogOut, Save, Trash2, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useUserStore } from "../stores/userStore";
import { useSyncStore } from "../stores/syncStore";
import { useToastStore } from "../stores/toastStore";
import { LoginModal } from "../components/auth/LoginModal";
import { RegisterModal } from "../components/auth/RegisterModal";
import { ForgotPasswordModal } from "../components/auth/ForgotPasswordModal";
import { ResetPasswordModal } from "../components/auth/ResetPasswordModal";
import { Modal } from "../components/common/Modal";
import type { AppPage } from "../types";

type AuthModal = "login" | "register" | "forgot" | "reset" | null;

export function ProfilePage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { t } = useTranslation(["profile", "common"]);
  const { profile, loading, fetchProfile, updateProfile, changePassword, uploadAvatar, deleteAccount } = useUserStore();
  const config = useSyncStore((s) => s.config);
  const logout = useSyncStore((s) => s.logout);
  const isLoggedIn = Boolean(config.authenticated && config.user_id);
  const [uploading, setUploading] = useState(false);

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [authModal, setAuthModal] = useState<AuthModal>(null);
  const [resetEmail, setResetEmail] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isLoggedIn) fetchProfile();
  }, [isLoggedIn]);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setPhone(profile.phone ?? "");
      setAddress(profile.address ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    await updateProfile({ nickname, phone, address, bio });
    setSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      useToastStore.getState().addToast("error", t("password.mismatch"));
      return;
    }
    try {
      await changePassword(oldPassword, newPassword);
      useToastStore.getState().addToast("success", t("password.success"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordModalOpen(false);
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    }
  }

  async function handleLogout() {
    try {
      await logout();
      useToastStore.getState().addToast("success", t("account.logoutSuccess"));
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    }
  }

  async function handleDeleteAccount() {
    if (deleteEmail !== profile?.email) {
      useToastStore.getState().addToast("error", t("danger.emailMismatch"));
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      useToastStore.getState().addToast("success", t("danger.deleteSuccess"));
      setDeleteModalOpen(false);
      setDeleteEmail("");
      onNavigate("settings");
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    } finally {
      setDeleting(false);
    }
  }

  // 未登录 + 未配置服务器地址
  if (!isLoggedIn && !config.server_url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--muted)]">
        <User className="h-12 w-12" />
        <p className="text-sm">{t("account.serverUrlRequired")}</p>
        <button
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
          onClick={() => onNavigate("settings")}
        >
          {t("account.goToSettings")}
        </button>
      </div>
    );
  }

  // 未登录 + 已配置服务器地址
  if (!isLoggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-[var(--muted)]">
        <User className="h-12 w-12" />
        <p className="text-sm">{t("account.pleaseLogin")}</p>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            onClick={() => setAuthModal("login")}
          >
            {t("account.login")}
          </button>
          <button
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            onClick={() => setAuthModal("register")}
          >
            {t("account.register")}
          </button>
        </div>

        <LoginModal
          open={authModal === "login"}
          onClose={() => setAuthModal(null)}
          onSwitchToRegister={() => setAuthModal("register")}
          onSwitchToForgotPassword={() => setAuthModal("forgot")}
        />
        <RegisterModal
          open={authModal === "register"}
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal("login")}
        />
        <ForgotPasswordModal
          open={authModal === "forgot"}
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal("login")}
          onSwitchToResetPassword={(email) => {
            setResetEmail(email);
            setAuthModal("reset");
          }}
        />
        <ResetPasswordModal
          open={authModal === "reset"}
          onClose={() => setAuthModal(null)}
          email={resetEmail}
          onSwitchToLogin={() => setAuthModal("login")}
        />
      </div>
    );
  }

  // 已登录
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-6">
        {/* Header: 返回 + 标题 | 退出登录 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              onClick={() => onNavigate("settings")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-semibold text-[var(--text)]">{t("title")}</h1>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-red-400"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("account.logout")}
          </button>
        </div>

        {loading && !profile ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">{t("common:status.loading")}</div>
        ) : (
          <div className="space-y-5">
            {/* Avatar + Email */}
            <div className="flex items-center gap-4">
              <button
                className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-80 disabled:opacity-50"
                onClick={async () => {
                  const path = await open({
                    multiple: false,
                    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
                  });
                  if (path) {
                    setUploading(true);
                    await uploadAvatar(path);
                    setUploading(false);
                  }
                }}
                disabled={uploading}
              >
                {profile?.avatar_url && config.server_url ? (
                  <img
                    src={`${config.server_url}/user/avatar/${profile.id}`}
                    alt={profile?.nickname || profile?.email || "User avatar"}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8" />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/30">
                  <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
              <div>
                <div className="text-sm font-medium text-[var(--text)]">
                  {profile?.nickname || profile?.email}
                </div>
                <div className="text-xs text-[var(--muted)]">{profile?.email}</div>
              </div>
            </div>

            {/* Profile Form - compact grid */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{t("fields.nickname")}</label>
                  <input
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={t("placeholder.nickname")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{t("fields.phone")}</label>
                  <input
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("placeholder.phone")}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{t("fields.address")}</label>
                  <input
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("placeholder.address")}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{t("fields.bio")}</label>
                  <textarea
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t("placeholder.bio")}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  onClick={() => setPasswordModalOpen(true)}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {t("password.title")}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? t("saving") : t("save")}
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="space-y-3 rounded-xl border border-red-500/30 bg-[var(--paper)] p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-red-400">
                <Trash2 className="h-4 w-4" />
                {t("danger.title")}
              </h2>
              <p className="text-xs text-[var(--muted)]">{t("danger.deleteConfirm")}</p>
              <button
                className="rounded-lg bg-red-500/12 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
                onClick={() => setDeleteModalOpen(true)}
              >
                {t("danger.deleteAccount")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      <Modal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title={t("password.title")}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
        >
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">
              {t("password.oldPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder={t("password.placeholder.old")}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">
              {t("password.newPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("password.placeholder.new")}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">
              {t("password.confirmPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("password.placeholder.confirm")}
              required
            />
          </div>
          <button
            type="submit"
            disabled={!oldPassword || !newPassword || !confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {t("password.submitBtn")}
          </button>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal open={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeleteEmail(""); }} title={t("danger.confirmTitle")}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleDeleteAccount();
          }}
        >
          <p className="text-sm text-[var(--muted)]">
            {t("danger.confirmDesc")}{" "}
            <span className="font-medium text-[var(--text)]">{profile?.email}</span>
          </p>
          <div>
            <input
              type="email"
              className="w-full rounded-xl border border-red-500/40 bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-red-500"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder={t("danger.confirmPlaceholder")}
              required
            />
          </div>
          <button
            type="submit"
            disabled={deleting || !deleteEmail.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? t("danger.deleting") : t("danger.confirmBtn")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
