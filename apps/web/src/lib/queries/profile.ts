"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, UserDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useMyProfile() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiFetch<UserDTO>("/users/me"),
  });
}

export interface UpdateProfilePayload {
  nomeSocial?: string;
  telefone?: string;
  instituicao?: string;
  endereco?: string;
  localidade?: string;
  quemRepresenta?: string;
  idiomas?: string[];
  areasInteresse?: UserDTO["areasInteresse"];
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfilePayload) =>
      apiFetch<UserDTO>("/users/me", { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users", "me"] }),
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
