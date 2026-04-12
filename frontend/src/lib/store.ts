import { create } from "zustand";
import { authApi } from "./api";

interface User {
  id: string;
  email: string;
  displayName: string | null;
  plan: string;
  creditBalance: number;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    const { data: user } = await authApi.me();
    set({ user });
  },

  register: async (email, password, displayName) => {
    const { data } = await authApi.register(email, password, displayName);
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    const { data: user } = await authApi.me();
    set({ user });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        set({ user: null, loading: false });
        return;
      }
      const { data } = await authApi.me();
      set({ user: data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
