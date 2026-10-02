"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useNotifications() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => apiFetch<NotificationDTO[]>("/notifications"),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["notifications", userId, "nao-lidas", "count"],
    queryFn: () => apiFetch<number>("/notifications/nao-lidas/count"),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/lida`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: () => apiFetch("/notifications/lidas", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}
