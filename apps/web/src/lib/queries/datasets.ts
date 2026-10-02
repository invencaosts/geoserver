"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataVisibility, DatasetDTO } from "@geo/shared";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useDatasets() {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useQuery({
    queryKey: ["datasets", userId],
    queryFn: () => apiFetch<DatasetDTO[]>("/datasets"),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "processing") ? 2000 : false,
  });
}

export function useUploadDataset() {
  const qc = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  return useMutation({
    mutationFn: async ({
      nome,
      file,
      caseId,
      visibility = "restrito",
      codigoCar,
      codigoSigef,
    }: {
      nome: string;
      file: File;
      caseId?: string;
      visibility?: DataVisibility;
      codigoCar?: string;
      codigoSigef?: string;
    }) => {
      const token = useAuthStore.getState().token;
      const form = new FormData();
      form.append("nome", nome);
      form.append("file", file);
      form.append("visibility", visibility);
      if (caseId) form.append("caseId", caseId);
      if (codigoCar) form.append("codigoCar", codigoCar);
      if (codigoSigef) form.append("codigoSigef", codigoSigef);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/datasets`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(data.message ?? "Falha no upload");
      }
      return res.json() as Promise<DatasetDTO>;
    },
    onSuccess: async (_data, variables) => {
      const invalidations = [qc.invalidateQueries({ queryKey: ["datasets"] })];
      if (variables.caseId) {
        invalidations.push(
          qc.invalidateQueries({
            queryKey: ["cases", userId, "detail", variables.caseId],
          }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/datasets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}

export function useReviewDatasetPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      apiFetch<DatasetDTO>(`/datasets/${id}/publication`, {
        method: "PATCH",
        body: { approved },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}

// O export exige login (permissão data:export), então baixa via fetch com o token
// em vez de um link direto, que não levaria o header Authorization.
export function useDownloadDataset() {
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const blob = await apiFetchBlob(`/datasets/${id}/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nome}.geojson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}
