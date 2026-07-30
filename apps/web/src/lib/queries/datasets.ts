"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DatasetDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: () => apiFetch<DatasetDTO[]>("/datasets"),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "processing") ? 2000 : false,
  });
}

export function useUploadDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, file }: { nome: string; file: File }) => {
      const token = useAuthStore.getState().token;
      const form = new FormData();
      form.append("nome", nome);
      form.append("file", file);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/datasets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}

export function datasetExportUrl(id: string) {
  return `${process.env.NEXT_PUBLIC_API_URL}/datasets/${id}/export`;
}
