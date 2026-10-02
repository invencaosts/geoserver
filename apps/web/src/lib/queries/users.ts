"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserSummaryDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useUsers() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["users", userId, "summary"],
    queryFn: () => apiFetch<UserSummaryDTO[]>("/users"),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<UserSummaryDTO, "role" | "status">>;
    }) => apiFetch<UserSummaryDTO>(`/users/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users", userId, "summary"] }),
  });
}
