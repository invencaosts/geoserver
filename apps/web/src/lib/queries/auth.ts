"use client";

import { useMutation } from "@tanstack/react-query";
import type { AuthUser } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (data: { email: string; senha: string }) =>
      apiFetch<AuthResponse>("/auth/login", { method: "POST", body: data }),
    onSuccess: (res) => setSession(res.user, res.token),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (data: { nome: string; email: string; senha: string }) =>
      apiFetch<AuthResponse>("/auth/register", { method: "POST", body: data }),
    onSuccess: (res) => setSession(res.user, res.token),
  });
}
