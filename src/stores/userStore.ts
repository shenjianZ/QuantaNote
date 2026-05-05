import { create } from "zustand";
import {
    getUserProfile,
    updateUserProfile,
    changePassword as changePasswordCmd,
    uploadAvatar as uploadAvatarCmd,
    deleteAccount as deleteAccountCmd,
    type UserProfile,
} from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

interface UserState {
    profile: UserProfile | null;
    loading: boolean;
    fetchProfile: () => Promise<void>;
    updateProfile: (updates: { nickname?: string; bio?: string; phone?: string; address?: string }) => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
    uploadAvatar: (filePath: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
    profile: null,
    loading: false,

    fetchProfile: async () => {
        set({ loading: true });
        try {
            const profile = await getUserProfile();
            set({ profile });
        } catch {
            useToastStore.getState().addToast("error", i18n.t("profile:saveFailed"));
        } finally {
            set({ loading: false });
        }
    },

    updateProfile: async (updates) => {
        try {
            const profile = await updateUserProfile(updates);
            set({ profile });
            useToastStore.getState().addToast("success", i18n.t("profile:saveSuccess"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("profile:saveFailed"));
        }
    },

    changePassword: async (oldPassword, newPassword) => {
        try {
            await changePasswordCmd(oldPassword, newPassword);
            useToastStore.getState().addToast("success", i18n.t("profile:password.success"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("profile:password.failed"));
        }
    },

    uploadAvatar: async (filePath) => {
        try {
            const profile = await uploadAvatarCmd(filePath);
            set({ profile });
            useToastStore.getState().addToast("success", i18n.t("profile:avatar.success"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("profile:avatar.failed"));
        }
    },

    deleteAccount: async () => {
        await deleteAccountCmd();
        set({ profile: null });
    },
}));
