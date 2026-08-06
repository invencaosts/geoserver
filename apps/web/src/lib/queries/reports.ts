"use client";

import { useMutation } from "@tanstack/react-query";
import type { CaseStatus } from "@geo/shared";
import { apiFetchBlob } from "@/lib/api";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildQuery(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useDownloadCasosCsv() {
  return useMutation({
    mutationFn: async (filters: { status?: CaseStatus; municipio?: string; tipo?: string }) => {
      const blob = await apiFetchBlob(`/reports/casos/csv${buildQuery(filters)}`);
      downloadBlob(blob, "casos.csv");
    },
  });
}

export function useDownloadCasosPdf() {
  return useMutation({
    mutationFn: async (filters: { status?: CaseStatus; municipio?: string; tipo?: string }) => {
      const blob = await apiFetchBlob(`/reports/casos/pdf${buildQuery(filters)}`);
      downloadBlob(blob, "casos.pdf");
    },
  });
}

export function useDownloadDatasetsCsv() {
  return useMutation({
    mutationFn: async () => {
      const blob = await apiFetchBlob("/reports/datasets/csv");
      downloadBlob(blob, "datasets.csv");
    },
  });
}

export function useDownloadDatasetsPdf() {
  return useMutation({
    mutationFn: async () => {
      const blob = await apiFetchBlob("/reports/datasets/pdf");
      downloadBlob(blob, "datasets.pdf");
    },
  });
}
