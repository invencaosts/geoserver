"use client";

import { useQuery } from "@tanstack/react-query";
import type { TimelineJsonDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";

export type TimelineModo = "todos" | "nacional" | "estadual";

export function useTimelineEstados() {
  return useQuery({
    queryKey: ["timeline", "estados"],
    queryFn: () => apiFetch<string[]>("/timeline/estados"),
    staleTime: 5 * 60_000,
  });
}

export function useTimeline(modo: TimelineModo, estados: string[]) {
  const params = new URLSearchParams({ modo });
  if (estados.length > 0) params.set("estados", estados.join(","));

  return useQuery({
    queryKey: ["timeline", modo, estados],
    queryFn: () => apiFetch<TimelineJsonDTO>(`/timeline?${params.toString()}`),
    staleTime: 60_000,
  });
}
