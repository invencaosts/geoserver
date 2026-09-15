import { Injectable } from "@nestjs/common";
import type { CaseStatus } from "@geo/shared";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";
import { CasesService } from "../cases/cases.service";
import { DatasetsService } from "../datasets/datasets.service";

@Injectable()
export class ReportsService {
  constructor(
    private casesService: CasesService,
    private datasetsService: DatasetsService,
  ) {}

  async casosCsv(filters: { status?: CaseStatus; municipio?: string; tipo?: string }) {
    const casos = await this.casesService.findAll(filters);
    return stringify(
      casos.map((c) => ({
        nome: c.nome,
        tipo: c.tipo,
        municipio: c.municipio,
        estado: c.estado,
        prioridade: c.prioridade,
        status: c.status,
        criadoPor: c.createdBy.nome,
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
          { key: "criadoEm", header: "Criado em" },
        ],
      },
    );
  }

  async casosPdf(filters: { status?: CaseStatus; municipio?: string; tipo?: string }) {
    const [dashboard, casos] = await Promise.all([
      this.casesService.getDashboard(),
      this.casesService.findAll(filters),
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
        `${c.nome} — ${c.municipio}/${c.estado} — ${c.tipo} — ${c.status} — prioridade ${c.prioridade}`,
      );
    }

    doc.end();
    return doc;
  }

  async datasetsCsv() {
    const datasets = await this.datasetsService.findAll();
    return stringify(
      datasets.map((d) => ({
        nome: d.nome,
        formato: d.formato,
        tipoGeometria: d.tipoGeometria,
        status: d.status,
        registros: d.registros,
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
          { key: "criadoEm", header: "Criado em" },
        ],
      },
    );
  }

  async datasetsPdf() {
    const datasets = await this.datasetsService.findAll();
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
        `${d.nome} — ${d.formato} (${d.tipoGeometria}) — ${d.status} — ${d.registros} registros`,
      );
    }

    doc.end();
    return doc;
  }
}
