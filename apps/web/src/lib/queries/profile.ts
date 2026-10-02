"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthUser,
  ResearcherProfileDTO,
  UserDTO,
  UserOnboardingProfileDTO,
} from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useMyProfile() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["users", userId, "me"],
    queryFn: () => apiFetch<UserDTO>("/users/me"),
  });
}

export interface UpdateProfilePayload {
  nomeSocial?: string | null;
  telefone?: string | null;
  instituicao?: string | null;
  endereco?: string | null;
  localidade?: string | null;
  quemRepresenta?: string | null;
  idiomas?: string[];
  areasInteresse?: UserDTO["areasInteresse"];
  onboardingProfile?: UserOnboardingProfileDTO;
  researcherProfile?: ResearcherProfileDTO;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: (data: UpdateProfilePayload) =>
      apiFetch<UserDTO>("/users/me", { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users", userId, "me"] }),
  });
}

export function useUploadAvatar() {
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: async (file: File) => {
      const token = useAuthStore.getState().token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(data.message ?? "Falha ao enviar foto");
      }
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (user) => updateUser({ avatarUrl: user.avatarUrl }),
  });
}
