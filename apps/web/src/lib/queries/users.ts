"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserDTO[]>("/users"),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<UserDTO, "role" | "status">> }) =>
      apiFetch<UserDTO>(`/users/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
