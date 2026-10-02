"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@geo/shared";
import { queryClient } from "@/lib/query-client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setSession: (user: AuthUser, token: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession: (user, token) => {
        queryClient.clear();
        set({ user, token });
      },
      updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      clear: () => {
        queryClient.clear();
        set({ user: null, token: null });
      },
    }),
    { name: "geo-auth" },
  ),
);
