"use client";

import { useMutation } from "@tanstack/react-query";
import type { AuthUser } from "@geo/shared";
import { useAuthStore } from "@/lib/auth-store";

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
