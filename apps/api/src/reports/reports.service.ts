import { Injectable } from "@nestjs/common";
import type { AuthUser, CaseStatus, CaseTipo } from "@geo/shared";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";
import { CasesService } from "../cases/cases.service";
import { DatasetsService } from "../datasets/datasets.service";

/** Neutraliza células que planilhas interpretariam como fórmulas ao abrir o CSV. */
export function safeCsvCell(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

@Injectable()
export class ReportsService {
  constructor(
    private casesService: CasesService,
    private datasetsService: DatasetsService,
  ) {}

  async casosCsv(
    filters: { status?: CaseStatus; municipio?: string; tipo?: CaseTipo },
    user: AuthUser,
  ) {
    const casos = await this.casesService.findDetailedForExport(filters, user);
    return stringify(
      casos.map((c) => ({
        nome: safeCsvCell(c.nome),
        tipo: safeCsvCell(c.tipo),
        municipio: safeCsvCell(c.municipio ?? ""),
        estado: safeCsvCell(c.estado),
        prioridade: safeCsvCell(c.prioridade),
        status: safeCsvCell(c.status),
        criadoPor: safeCsvCell(c.createdBy.nome),
        questionario: safeCsvCell(JSON.stringify(c.contribution ?? {})),
        fontes: safeCsvCell(
          c.sources
            .map((source) => `${source.titulo} [${source.grauPublicidade ?? "restrito"}]`)
            .join("; "),
        ),
        facetas: safeCsvCell(
          c.facets
            .map(
              (facet) =>
                `${facet.categoria}: ${facet.label}${facet.valorOutro ? ` (${facet.valorOutro})` : ""}`,
            )
            .join("; "),
        ),
        referenciasEspaciais: safeCsvCell(
          c.spatialReferences
            .map((reference) => `${reference.tipo}: ${reference.valor}`)
            .join("; "),
        ),
        documentos: c.documents.length,
        datasets: c.datasets.length,
        declaracaoVersao: safeCsvCell(c.declarationVersion ?? ""),
        declaracaoAceitaEm:
          c.declarationAcceptedAt?.toISOString?.() ?? c.declarationAcceptedAt ?? "",
        criadoEm: c.createdAt.toISOString(),
      })),
      {
        header: true,
        columns: [
          { key: "nome", header: "Nome" },
          { key: "tipo", header: "Tipo" },
          { key: "municipio", header: "Município" },
          { key: "estado", header: "Estado" },
          { key: "prioridade", header: "Prioridade" },
          { key: "status", header: "Status" },
          { key: "criadoPor", header: "Criado por" },
          { key: "questionario", header: "Questionário" },
          { key: "fontes", header: "Fontes visíveis" },
          { key: "facetas", header: "Categorias" },
          { key: "referenciasEspaciais", header: "Referências espaciais" },
          { key: "documentos", header: "Documentos visíveis" },
          { key: "datasets", header: "Datasets visíveis" },
          { key: "declaracaoVersao", header: "Versão da declaração" },
          { key: "declaracaoAceitaEm", header: "Declaração aceita em" },
          { key: "criadoEm", header: "Criado em" },
        ],
      },
    );
  }

  async casosPdf(
    filters: { status?: CaseStatus; municipio?: string; tipo?: CaseTipo },
    user: AuthUser,
  ) {
    const [dashboard, casos] = await Promise.all([
      this.casesService.getDashboard(user),
      this.casesService.findDetailedForExport(filters, user),
    ]);

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.fontSize(18).text("Relatório de Casos de Grilagem", { align: "left" });
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`)
      .fillColor("#000");
    doc.moveDown(1.5);

    doc.fontSize(13).text("Resumo");
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Casos ativos: ${dashboard.casosAtivos}`);
    doc.text(`Casos validados: ${dashboard.casosValidados}`);
    doc.text(`Casos rejeitados: ${dashboard.casosRejeitados}`);
    doc.text(`Validações pendentes: ${dashboard.validacoesPendentes}`);
    doc.moveDown(1);

    doc.fontSize(13).text("Casos ativos por tipo");
    doc.moveDown(0.5);
    doc.fontSize(10);
    if (dashboard.casosPorTipo.length === 0) doc.text("Nenhum caso ativo.");
    for (const t of dashboard.casosPorTipo) {
      doc.text(`${t.tipo}: ${t.casos}`);
    }
    doc.moveDown(1);

    doc.fontSize(13).text("Municípios mais afetados");
    doc.moveDown(0.5);
    doc.fontSize(10);
    if (dashboard.municipiosMaisAfetados.length === 0) doc.text("Sem dados.");
    for (const m of dashboard.municipiosMaisAfetados) {
      doc.text(`${m.municipio}: ${m.casos}`);
    }
    doc.moveDown(1);

    doc.fontSize(13).text(`Casos listados (${casos.length})`);
    doc.moveDown(0.5);
    doc.fontSize(9);
    for (const c of casos) {
      doc.text(
        `${c.nome} — ${c.municipio ?? "localização restrita"}/${c.estado} — ${c.tipo} — ${c.status} — prioridade ${c.prioridade}`,
      );
      doc.text(
        `Fontes visíveis: ${c.sources.length}; categorias: ${c.facets.length}; referências espaciais: ${c.spatialReferences.length}; documentos: ${c.documents.length}; datasets: ${c.datasets.length}`,
      );
    }

    doc.end();
    return doc;
  }

  async datasetsCsv(user: AuthUser) {
    const datasets = await this.datasetsService.findAll(user);
    return stringify(
      datasets.map((d) => ({
        nome: safeCsvCell(d.nome),
        formato: safeCsvCell(d.formato),
        tipoGeometria: safeCsvCell(d.tipoGeometria),
        status: safeCsvCell(d.status),
        registros: d.registros,
        caso: safeCsvCell(d.caseId ?? ""),
        visibilidade: safeCsvCell(d.visibility),
        publicacaoSolicitada: d.requestedPublic ? "sim" : "não",
        codigoCar: safeCsvCell(d.codigoCar ?? ""),
        codigoSigef: safeCsvCell(d.codigoSigef ?? ""),
        criadoEm: d.createdAt.toISOString(),
      })),
      {
        header: true,
        columns: [
          { key: "nome", header: "Nome" },
          { key: "formato", header: "Formato" },
          { key: "tipoGeometria", header: "Tipo de geometria" },
          { key: "status", header: "Status" },
          { key: "registros", header: "Registros" },
          { key: "caso", header: "Caso vinculado" },
          { key: "visibilidade", header: "Visibilidade" },
          { key: "publicacaoSolicitada", header: "Publicação solicitada" },
          { key: "codigoCar", header: "Código CAR" },
          { key: "codigoSigef", header: "Código SIGEF" },
          { key: "criadoEm", header: "Criado em" },
        ],
      },
    );
  }

  async datasetsPdf(user: AuthUser) {
    const datasets = await this.datasetsService.findAll(user);
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.fontSize(18).text("Inventário de Datasets");
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`)
      .fillColor("#000");
    doc.moveDown(1.5);

    doc.fontSize(10);
    if (datasets.length === 0) doc.text("Nenhum dataset cadastrado.");
    for (const d of datasets) {
      doc.text(
        `${d.nome} — ${d.formato} (${d.tipoGeometria}) — ${d.status} — ${d.registros} registros — ${d.visibility}${d.codigoCar ? ` — CAR ${d.codigoCar}` : ""}${d.codigoSigef ? ` — SIGEF ${d.codigoSigef}` : ""}`,
      );
    }

    doc.end();
    return doc;
  }
}
