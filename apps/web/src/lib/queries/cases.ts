"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CaseDetailDTO,
  CaseMapPointDTO,
  CaseContributionDTO,
  CaseFacetSelectionDTO,
  CaseSourceDTO,
  CaseSpatialReferenceDTO,
  CaseTipo,
  CasePrioridade,
  DataVisibility,
  FormOptionDTO,
  CaseStatus,
  PaginatedCasesDTO,
} from "@geo/shared";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export interface CaseFormPayload {
  revision?: number;
  nome?: string;
  tipo?: CaseTipo;
  municipio?: string;
  estado?: string;
  descricao?: string | null;
  lat?: number | null;
  lng?: number | null;
  fonteDados?: string | null;
  denunciante?: string | null;
  prioridade?: CasePrioridade;
  declarationAccepted?: boolean;
  declarationVersion?: string;
  contribution?: CaseContributionDTO;
  sources?: CaseSourceDTO[];
  facets?: Pick<CaseFacetSelectionDTO, "optionId" | "valorOutro">[];
  spatialReferences?: CaseSpatialReferenceDTO[];
}

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
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));
  if (filters.status) params.set("status", filters.status);

  return useQuery({
    queryKey: ["cases", userId, filters],
    queryFn: () => apiFetch<PaginatedCasesDTO>(`/cases?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}

export function useCase(id: string | null) {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["cases", userId, "detail", id],
    queryFn: () => apiFetch<CaseDetailDTO>(`/cases/${id}`),
    enabled: Boolean(id),
  });
}

export function useCaseMapPoints() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["cases", userId, "map"],
    queryFn: () => apiFetch<CaseMapPointDTO[]>("/cases/map"),
  });
}

export function useCaseDashboard() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["cases", userId, "dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/cases/dashboard"),
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: (data: CaseFormPayload) =>
      apiFetch<CaseDetailDTO>("/cases", { method: "POST", body: data }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CaseFormPayload & { revision: number } }) =>
      apiFetch<CaseDetailDTO>(`/cases/${id}`, { method: "PATCH", body: data }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases", userId] });
    },
  });
}

export function useCaseOptions() {
  return useQuery({
    queryKey: ["cases", "options"],
    queryFn: () => apiFetch<FormOptionDTO[]>("/cases/options"),
    staleTime: 5 * 60_000,
  });
}

export function useSubmitCase() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: (id: string) => apiFetch<CaseDetailDTO>(`/cases/${id}/submit`, { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUploadCaseDocument() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({
      id,
      file,
      sourceId,
      visibility = "restrito",
      possuiDadosPessoais = false,
      motivoRestricao,
    }: {
      id: string;
      file: File;
      sourceId?: string;
      visibility?: DataVisibility;
      possuiDadosPessoais?: boolean;
      motivoRestricao?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (sourceId) formData.append("sourceId", sourceId);
      formData.append("visibility", visibility);
      formData.append("possuiDadosPessoais", String(possuiDadosPessoais));
      if (motivoRestricao) formData.append("motivoRestricao", motivoRestricao);
      return apiFetch<CaseDetailDTO>(`/cases/${id}/documents`, {
        method: "POST",
        formData,
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useDownloadCaseDocument() {
  return useMutation({
    mutationFn: async ({
      caseId,
      documentId,
      nome,
    }: {
      caseId: string;
      documentId: string;
      nome: string;
    }) => {
      const blob = await apiFetchBlob(`/cases/${caseId}/documents/${documentId}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = nome;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useReviewDocumentPublication() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({
      caseId,
      documentId,
      approved,
    }: {
      caseId: string;
      documentId: string;
      approved: boolean;
    }) =>
      apiFetch<CaseDetailDTO>(`/cases/${caseId}/documents/${documentId}/publication`, {
        method: "PATCH",
        body: { approved },
      }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases", userId] });
    },
  });
}

export function useUploadCaseAnexo() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<CaseDetailDTO>(`/cases/${id}/anexo`, { method: "POST", formData });
    },
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUpdateCaseStatus() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: CaseStatus; note?: string }) =>
      apiFetch<CaseDetailDTO>(`/cases/${id}/status`, { method: "PATCH", body: { status, note } }),
    onSuccess: (data) => {
      qc.setQueryData(["cases", userId, "detail", data.id], data);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
