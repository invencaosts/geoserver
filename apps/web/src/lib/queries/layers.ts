"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LayerDTO } from "@geo/shared";
import { apiFetch } from "@/lib/api";

export function useLayers() {
  return useQuery({
    queryKey: ["layers"],
    queryFn: () => apiFetch<LayerDTO[]>("/layers"),
  });
}

export function useCreateLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<LayerDTO>) =>
      apiFetch<LayerDTO>("/layers", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layers"] }),
  });
}

export function useUpdateLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LayerDTO> }) =>
      apiFetch<LayerDTO>(`/layers/${id}`, { method: "PATCH", body: data }),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["layers"] });
      const prev = qc.getQueryData<LayerDTO[]>(["layers"]);
      qc.setQueryData<LayerDTO[]>(["layers"], (old) =>
        old?.map((l) => (l.id === id ? { ...l, ...data } : l)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["layers"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["layers"] }),
  });
}

export function useDeleteLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/layers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layers"] }),
  });
}
