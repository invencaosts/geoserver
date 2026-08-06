// Carrega apps/api/prisma/seed-data/instituicoes.csv.gz na tabela `instituicoes`.
// Fonte: INEP — Censo Escolar (educação básica) + Censo da Educação Superior (IES).
// Rodar: pnpm --filter api run seed:instituicoes
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { join } from "path";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";

const CSV_PATH = join(__dirname, "seed-data/instituicoes.csv.gz");
const BATCH_SIZE = 5000;

async function main() {
  const prisma = new PrismaClient();
  const existing = await prisma.instituicao.count();
  if (existing > 0) {
    console.log(`instituicoes já tem ${existing} registros, pulando seed.`);
    await prisma.$disconnect();
    return;
  }

  const parser = createReadStream(CSV_PATH)
    .pipe(createGunzip())
    .pipe(parse({ columns: true }));

  let batch: { nome: string; municipio: string; uf: string; tipo: "educacao_basica" | "educacao_superior"; dependencia: string | null }[] = [];
  let total = 0;

  for await (const row of parser) {
    batch.push({
      nome: row.nome,
      municipio: row.municipio,
      uf: row.uf,
      tipo: row.tipo,
      dependencia: row.dependencia || null,
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.instituicao.createMany({ data: batch });
      total += batch.length;
      console.log(`${total} instituições carregadas...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.instituicao.createMany({ data: batch });
    total += batch.length;
  }

  console.log(`Concluído: ${total} instituições carregadas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
