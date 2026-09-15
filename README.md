# Observatório Grilagem de Terras — Plataforma de Monitoramento Geoespacial

Plataforma de gestão colaborativa de casos de grilagem de terras: mapa com camadas geoespaciais, importação de dados espaciais (Shapefile/GeoJSON/KML/CSV), workflow de validação de casos com auditoria, e controle de acesso baseado em papéis (RBAC).

Persistência real, autenticação, processamento assíncrono e banco geoespacial de verdade.

## Status atual (Sprint dias 1–4 de 5)

| Dia | Módulo                                                                | Status          |
| --- | --------------------------------------------------------------------- | --------------- |
| 1   | Fundação (monorepo, Docker, Postgres+PostGIS, Auth+RBAC, shell da UI) | ✅ feito        |
| 2   | Mapa & Camadas (CRUD de camadas, MapLibre)                            | ✅ feito        |
| 3   | Dados Espaciais (upload → fila → parser → PostGIS)                    | ✅ feito        |
| 4   | Casos de Grilagem (workflow de validação + auditoria + dashboard)     | ✅ feito        |
| 5   | Relatórios (✅ feito) + deploy em produção (⏳ pendente)              | ⏳ em andamento |

Backlog fora do sprint de 5 dias (não iniciado): integrações externas (INCRA/CPT/IBAMA/PRODES), notificações, 2FA, rate limiting, testes automatizados, mascaramento de dados sensíveis (LGPD), tiles vetoriais reais via Martin/pg_tileserv (infra já provisionada, wiring no front ainda não feito).

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (base-ui) + MapLibre GL + Zustand + TanStack Query + TimelineJS3 (self-hosted) + pdf.js
- **Backend**: NestJS 11 + Prisma + PostgreSQL/PostGIS + BullMQ (filas) + MinIO (arquivos) + Passport/JWT
- **Infra local**: Docker Compose (postgres+postgis, redis, minio, martin)
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`)

## Estrutura do repositório

```
apps/
  web/                  # Next.js — frontend
    src/app/(app)/      # rotas protegidas: mapa, casos, dados, usuarios
    src/app/login/      # login/registro
    src/components/     # ui (shadcn), app-shell (sidebar/header), map/
    src/lib/            # api client, auth store (zustand), react-query hooks
  api/                  # NestJS — backend
    prisma/schema.prisma
    src/auth/           # JWT, login/registro
    src/common/         # RBAC (guards/decorators de permissão)
    src/layers/         # CRUD de camadas
    src/datasets/       # upload, parsers (shp/geojson/kml/csv), fila de import
    src/cases/          # casos de grilagem, workflow, dashboard
    src/reports/        # exportação de relatórios (CSV/PDF) de casos e datasets
    src/users/          # gestão de usuários/papéis
    src/timeline/       # linha do tempo de marcos legais (público + CRUD admin)
    src/storage/        # cliente MinIO
    src/queue/          # config BullMQ
    prisma/seed-timeline.ts       # seed inicial da linha do tempo (rodar manualmente, ver COMO_RODAR.md)
    prisma/seed-instituicoes.ts   # seed inicial de instituições INEP (rodar manualmente, ver COMO_RODAR.md)
packages/
  shared/               # tipos e permissões compartilhados entre web e api
docker-compose.yml      # postgres+postgis, redis, minio, martin (dev)
```

## Domínio implementado

- **Auth & RBAC**: 4 papéis — `admin`, `verificador`, `contribuidor`, `leitor`. Permissões granulares (`layer:write`, `case:validate`, `user:manage` etc) checadas no backend, não só na UI. O primeiro usuário cadastrado no sistema vira `admin` automaticamente.
- **Camadas**: registro de camadas (WMS/WFS/WCS/Vector/Raster), categoria (base/overlay/analysis), opacidade e visibilidade persistidas.
- **Dados Espaciais**: upload de arquivo → grava original no MinIO → enfileira job no BullMQ → worker faz parse (shapefile via zip, GeoJSON, KML, CSV com lat/lng) → grava features no PostGIS (`ST_GeomFromGeoJSON`) → dataset fica `active`/`error` conforme resultado. Export em GeoJSON.
- **Casos de Grilagem**: criação de relato, workflow de status com transições restritas (`pendente → em_verificacao → validado/rejeitado`), histórico de auditoria (`case_status_history`), dashboard com KPIs e municípios mais afetados agregados no banco.
- **Mapa**: base OSM + pontos dos casos (coloridos por prioridade) + geometrias dos datasets ativos, tudo renderizado via MapLibre a partir de dados reais da API.
- **Relatórios**: export em CSV (lista de casos filtrável, inventário de datasets) e PDF (resumo com KPIs do dashboard + tabelas) gerados sob demanda no backend a partir de dados reais.
- **Linha do Tempo** (`/timeline`): marcos legais da propriedade da terra e questão ambiental no Brasil, renderizados com TimelineJS3 (self-hosted). Filtro por escopo (nacional/estadual) e por estado (lista as 27 UFs, desabilitando as que ainda não têm evento cadastrado, com busca). PDFs anexados aos eventos abrem num viewer próprio (pdf.js), sem o visualizador nativo do browser. Tela de gestão (`/timeline/gerenciar`, permissão `timeline:manage` — `admin`/`verificador`) com CRUD completo (criar/editar/excluir evento, upload de PDF/imagem pro MinIO).

> Instruções de instalação, variáveis de ambiente, seeds e roteiro de teste manual: ver [`COMO_RODAR.md`](./COMO_RODAR.md).

## O que falta / próximos passos

**Fechando o sprint (dia 5):**

- Dockerfiles de produção + `docker-compose.prod.yml`.
- Smoke test ponta a ponta em ambiente de produção.

**Backlog pós-sprint:**

- Wiring do Martin/pg_tileserv no painel de camadas (hoje as camadas são só metadados, não renderizam tiles externos reais no mapa).
- Integrações externas (INCRA, CPT, IBAMA, PRODES) com sync agendado.
- Notificações (e-mail/in-app) nas mudanças de status de caso.
- 2FA, rate limiting, hardening de segurança geral.
- Mascaramento/controle de acesso ao campo "denunciante" (dado sensível, LGPD).
- Testes automatizados (hoje não existem — só smoke test manual).
- Paginação e filtros avançados nas listagens de casos/datasets.

## Decisão de escopo

O domínio ficou fixo em monitoramento de grilagem de terras (não generalizado pra outros usos, ex. saúde ambiental) — decisão já validada com você.
