"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CaseDTO,
  CaseDetailDTO,
  CaseMapPointDTO,
  CaseStatus,
  PaginatedCasesDTO,
} from "@geo/shared";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  casosAtivos: number;
  casosValidados: number;
  casosRejeitados: number;
  validacoesPendentes: number;
  casosPorTipo: { tipo: string; casos: number }[];
  municipiosMaisAfetados: { municipio: string; casos: number }[];
}

export interface CaseFilters {
  page?: number;
  limit?: number;
  status?: CaseStatus;
}

export function useCases(filters: CaseFilters = {}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));
  if (filters.status) params.set("status", filters.status);

  return useQuery({
    queryKey: ["cases", filters],
    queryFn: () => apiFetch<PaginatedCasesDTO>(`/cases?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}

export function useCase(id: string | null) {
  return useQuery({
    queryKey: ["cases", "detail", id],
    queryFn: () => apiFetch<CaseDetailDTO>(`/cases/${id}`),
    enabled: Boolean(id),
  });
}

export function useCaseMapPoints() {
  return useQuery({
    queryKey: ["cases", "map"],
    queryFn: () => apiFetch<CaseMapPointDTO[]>("/cases/map"),
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
      apiFetch<CaseDetailDTO>("/cases", { method: "POST", body: data }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUploadCaseAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<CaseDetailDTO>(`/cases/${id}/anexo`, { method: "POST", formData });
    },
    onSuccess: (data) => {
      qc.setQueryData(["cases", "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUpdateCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: CaseStatus; note?: string }) =>
      apiFetch<CaseDetailDTO>(`/cases/${id}/status`, { method: "PATCH", body: { status, note } }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
