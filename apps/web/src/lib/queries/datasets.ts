"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DatasetDTO } from "@geo/shared";
import { apiFetch, apiFetchBlob } from "@/lib/api";
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
