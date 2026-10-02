import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: env("DATABASE_URL"),
    // Necessária apenas para `prisma migrate diff --from-migrations`; nunca deve
    // apontar para o banco principal, pois o Prisma recria o schema temporário.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
