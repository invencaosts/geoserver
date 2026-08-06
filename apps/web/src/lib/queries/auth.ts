"use client";

import { useMutation } from "@tanstack/react-query";
import type { AuthUser, PerfilContribuidor, RoleName } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface RegisterPayload {
  nome: string;
  nomeSocial?: string;
  email: string;
  cpf: string;
  senha: string;
  role?: RoleName;
  perfilContribuidor?: PerfilContribuidor;
  quemRepresenta?: string;
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
    mutationFn: (data: RegisterPayload) =>
      apiFetch<AuthResponse>("/auth/register", { method: "POST", body: data }),
    onSuccess: (res) => setSession(res.user, res.token),
  });
}
