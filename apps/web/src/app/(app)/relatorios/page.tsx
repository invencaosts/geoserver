"use client";

import { useState } from "react";
import { Database, Download, FileText, ShieldAlert } from "lucide-react";
import type { CaseStatus } from "@geo/shared";
import { CASE_TIPO_LABEL as TIPO_LABEL, hasPermission } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useAuthStore } from "@/lib/auth-store";
import {
  useDownloadCasosCsv,
  useDownloadCasosPdf,
  useDownloadDatasetsCsv,
  useDownloadDatasetsPdf,
} from "@/lib/queries/reports";

const STATUS_LABEL: Record<CaseStatus, string> = {
  pendente: "Pendente",
  em_verificacao: "Em verificação",
  validado: "Validado",
  rejeitado: "Rejeitado",
};

export default function RelatoriosPage() {
  const user = useAuthStore((s) => s.user);
  const canReadCasos = user && hasPermission(user.role, "case:read");
  const canReadDatasets = user && hasPermission(user.role, "dataset:read");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Exportação dos dados de casos e datasets em CSV ou PDF.
        </p>
      </div>

      {canReadCasos && <CasosReportCard />}
      {canReadDatasets && <DatasetsReportCard />}
    </div>
  );
}

function CasosReportCard() {
  const [status, setStatus] = useState<string>("all");
  const [tipo, setTipo] = useState<string>("all");
  const [municipio, setMunicipio] = useState("");

  const downloadCsv = useDownloadCasosCsv();
  const downloadPdf = useDownloadCasosPdf();

  const filters = {
    status: status === "all" ? undefined : (status as CaseStatus),
    tipo: tipo === "all" ? undefined : tipo,
    municipio: municipio || undefined,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" />
          Relatório de Casos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <SelectField
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "Todos" },
                ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <SelectField
              value={tipo}
              onValueChange={setTipo}
              options={[
                { value: "all", label: "Todos" },
                ...Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-municipio">Município</Label>
            <Input
              id="rel-municipio"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              placeholder="Todos"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={downloadCsv.isPending}
            onClick={() => downloadCsv.mutate(filters)}
          >
            <Download className="h-4 w-4" />
            {downloadCsv.isPending ? "Gerando..." : "Baixar CSV"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={downloadPdf.isPending}
            onClick={() => downloadPdf.mutate(filters)}
          >
            <FileText className="h-4 w-4" />
            {downloadPdf.isPending ? "Gerando..." : "Baixar PDF (resumo)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DatasetsReportCard() {
  const downloadCsv = useDownloadDatasetsCsv();
  const downloadPdf = useDownloadDatasetsPdf();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          Relatório de Datasets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Inventário completo dos datasets importados.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={downloadCsv.isPending}
            onClick={() => downloadCsv.mutate()}
          >
            <Download className="h-4 w-4" />
            {downloadCsv.isPending ? "Gerando..." : "Baixar CSV"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={downloadPdf.isPending}
            onClick={() => downloadPdf.mutate()}
          >
            <FileText className="h-4 w-4" />
            {downloadPdf.isPending ? "Gerando..." : "Baixar PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
