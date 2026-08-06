# Observatório Grilagem de Terras — Plataforma de Monitoramento Geoespacial

Plataforma de gestão colaborativa de casos de grilagem de terras: mapa com camadas geoespaciais, importação de dados espaciais (Shapefile/GeoJSON/KML/CSV), workflow de validação de casos com auditoria, e controle de acesso baseado em papéis (RBAC).

Persistência real, autenticação, processamento assíncrono e banco geoespacial de verdade.

## Status atual (Sprint dias 1–4 de 5)

| Dia | Módulo | Status |
|---|---|---|
| 1 | Fundação (monorepo, Docker, Postgres+PostGIS, Auth+RBAC, shell da UI) | ✅ feito |
| 2 | Mapa & Camadas (CRUD de camadas, MapLibre) | ✅ feito |
| 3 | Dados Espaciais (upload → fila → parser → PostGIS) | ✅ feito |
| 4 | Casos de Grilagem (workflow de validação + auditoria + dashboard) | ✅ feito |
| 5 | Relatórios (✅ feito) + deploy em produção (⏳ pendente) | ⏳ em andamento |

Backlog fora do sprint de 5 dias (não iniciado): integrações externas (INCRA/CPT/IBAMA/PRODES), notificações, 2FA, rate limiting, testes automatizados, mascaramento de dados sensíveis (LGPD), tiles vetoriais reais via Martin/pg_tileserv (infra já provisionada, wiring no front ainda não feito).

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (base-ui) + MapLibre GL + Zustand + TanStack Query
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
    src/storage/        # cliente MinIO
    src/queue/          # config BullMQ
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

## Rodando em desenvolvimento

Pré-requisitos: Node 20+, pnpm, Docker.

```bash
# 1. instalar dependências do monorepo
pnpm install

# 2. subir serviços de infra (postgres+postgis, redis, minio, martin)
docker compose up -d

# 3. buildar o pacote compartilhado (necessário 1x, e de novo se editar packages/shared)
pnpm --filter @geo/shared build

# 4. rodar migrations do Prisma (só na primeira vez / após mudar o schema)
cd apps/api
npx prisma migrate dev

# 5. subir API e Web (2 terminais, a partir da raiz do monorepo)
pnpm dev:api     # http://localhost:3001/api
pnpm dev:web     # http://localhost:3000
```

### Portas usadas (ajustadas pra não colidir com outros projetos na sua máquina)

| Serviço | Porta |
|---|---|
| Web (Next.js) | 3000 |
| API (NestJS) | 3001 |
| Postgres/PostGIS | 5435 |
| Redis | 6381 |
| MinIO API | 9004 |
| MinIO Console | 9005 |
| Martin (tiles) | 3010 |

### Variáveis de ambiente

- `apps/api/.env` (copiar de `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `MINIO_*`, `REDIS_URL`
- `apps/web/.env.local` (copiar de `.env.example`): `NEXT_PUBLIC_API_URL`

## O que testar agora

1. **Criar conta** em `/login` (aba "Criar conta") — vira admin automaticamente se for o primeiro usuário.
2. **Mapa** (`/mapa`): criar uma camada (nome, tipo, fonte), ligar/desligar visibilidade, mexer na opacidade — deve persistir ao recarregar a página.
3. **Dados Espaciais** (`/dados`): importar um `.geojson` (mais simples de testar) ou `.csv` com colunas `lat`/`lng` — acompanhar o status mudar de "Processando" pra "Ativo", e ver os pontos aparecerem no mapa.
4. **Casos de Grilagem** (`/casos`): criar um relato com lat/lng de teste, tentar pular etapa do workflow (deve bloquear), avançar `pendente → em_verificacao → validado`, conferir dashboard atualizando e o ponto aparecendo no mapa colorido por prioridade.
5. **Usuários** (`/usuarios`, precisa ser admin): criar um segundo usuário com papel `leitor` ou `contribuidor`, logar com ele e confirmar que ações restritas (criar camada, validar caso) ficam bloqueadas — isso valida o RBAC de verdade, não só visualmente.
6. **Dark mode**: alternar no ícone do header — confere se as cores/glass panels ficam legíveis nos dois temas.
7. **Relatórios** (`/relatorios`): baixar CSV/PDF de casos (com e sem filtro de status/tipo/município) e CSV/PDF de datasets — conferir que os dados batem com `/casos` e `/dados`.

Se algo quebrar: logs da API em `apps/api` (rodando via `pnpm dev:api`), logs do worker de import estão no mesmo processo da API (BullMQ roda embutido).

## Rodando em produção

**Ainda não implementado** — é o dia 5 do sprint (pendente). O plano é:

- `docker-compose.prod.yml` com todos os serviços containerizados (web, api, postgres+postgis, redis, minio, martin) na mesma rede Docker.
- Dockerfile multi-stage pra `apps/web` e `apps/api` (build + runtime enxuto).
- Variáveis de ambiente de produção (JWT_SECRET forte, credenciais reais do banco/minio, `WEB_ORIGIN` pro CORS).
- Deploy manual via `docker compose -f docker-compose.prod.yml up -d` na VPS (sem CI/CD por decisão sua).

Não faça deploy do estado atual em produção: `JWT_SECRET` e senhas do banco/minio no `.env` são valores de desenvolvimento hardcoded, sem TLS, sem rate limiting.

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
