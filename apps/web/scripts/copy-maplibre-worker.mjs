// O MapLibre 6 carrega o Web Worker como arquivo ao lado do bundle, e o Next não copia esse
// arquivo. Publicamos o worker (e o módulo compartilhado que ele importa) em public/ a partir
// da versão instalada, para não ficarem dessincronizados após uma atualização.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const distDir = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/vendor/maplibre");

mkdirSync(outDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(distDir, file), join(outDir, file));
}
