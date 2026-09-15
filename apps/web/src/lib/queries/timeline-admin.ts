"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimelineEventDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";

export function useTimelineAdminList() {
  return useQuery({
    queryKey: ["timeline", "admin"],
    queryFn: () => apiFetch<TimelineEventDTO[]>("/timeline/admin"),
  });
}

export function useCreateTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch<TimelineEventDTO>("/timeline/admin", { method: "POST", formData }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useUpdateTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      apiFetch<TimelineEventDTO>(`/timeline/admin/${id}`, { method: "PATCH", formData }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useDeleteTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/timeline/admin/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}
