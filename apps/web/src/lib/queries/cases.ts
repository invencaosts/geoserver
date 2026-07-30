"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseDTO, CaseStatus } from "@geo/shared";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  casosAtivos: number;
  casosValidados: number;
  casosRejeitados: number;
  validacoesPendentes: number;
  casosPorTipo: { tipo: string; casos: number }[];
  municipiosMaisAfetados: { municipio: string; casos: number }[];
}

export function useCases(filters: { status?: CaseStatus } = {}) {
  const qs = filters.status ? `?status=${filters.status}` : "";
  return useQuery({
    queryKey: ["cases", filters],
    queryFn: () => apiFetch<CaseDTO[]>(`/cases${qs}`),
  });
}

export function useCaseDashboard() {
  return useQuery({
    queryKey: ["cases", "dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/cases/dashboard"),
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CaseDTO>) =>
      apiFetch<CaseDTO>("/cases", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUpdateCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: CaseStatus; note?: string }) =>
      apiFetch<CaseDTO>(`/cases/${id}/status`, { method: "PATCH", body: { status, note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
