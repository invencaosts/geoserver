"use client";

import { useQuery } from "@tanstack/react-query";
import type { InstituicaoDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";

export function useSearchInstituicoes(q: string) {
  return useQuery({
    queryKey: ["instituicoes", "search", q],
    queryFn: () => apiFetch<InstituicaoDTO[]>(`/instituicoes?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });
}
