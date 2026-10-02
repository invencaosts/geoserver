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

- **Auth & RBAC**: 5 papéis, do maior ao menor acesso — `admin`, `verificador`, `pesquisador_envio_download` (envia casos/datasets e baixa dados e relatórios), `pesquisador_envio` (só envia) e `visualizador` (só visualiza). O site é aberto sem login: o visitante anônimo tem as permissões do `visualizador`, e toda conta nova também entra como `visualizador`. Admin e verificador definem quem é pesquisador (o verificador só alterna entre `visualizador` e os dois níveis de pesquisador; ativar/desativar contas e dar papéis de admin/verificador é só do admin). Permissões granulares (`dataset:write`, `data:export`, `case:validate`, `user:assign_researcher` etc) checadas no backend, não só na UI. O administrador inicial é criado uma única vez por `POST /api/auth/bootstrap-admin`, enviando no header `x-bootstrap-secret` o segredo aleatório de pelo menos 32 caracteres configurado em `ADMIN_BOOTSTRAP_SECRET`; o cadastro público nunca concede privilégios.
- **Camadas**: registro de camadas (WMS/WFS/WCS/Vector/Raster), categoria (base/overlay/analysis), opacidade e visibilidade persistidas.
- **Dados Espaciais**: upload de arquivo → grava original no MinIO → enfileira job no BullMQ → worker faz parse (shapefile via zip, GeoJSON, KML, CSV com lat/lng) → grava features no PostGIS (`ST_GeomFromGeoJSON`) → dataset fica `active`/`error` conforme resultado. Export em GeoJSON.
- **Casos de Grilagem**: criação de relato, workflow de status com transições restritas (`pendente → em_verificacao → validado/rejeitado`), histórico de auditoria (`case_status_history`), dashboard com KPIs e municípios mais afetados agregados no banco.
- **Mapa**: base OSM + pontos dos casos (coloridos por prioridade) + geometrias dos datasets ativos, tudo renderizado via MapLibre a partir de dados reais da API.
- **Relatórios**: export em CSV (lista de casos filtrável, inventário de datasets) e PDF (resumo com KPIs do dashboard + tabelas) gerados sob demanda no backend a partir de dados reais.
- **Linha do Tempo** (`/timeline`): marcos legais da propriedade da terra e questão ambiental no Brasil, renderizados com TimelineJS3 (self-hosted). Filtro por escopo (nacional/estadual) e por estado (lista as 27 UFs, desabilitando as que ainda não têm evento cadastrado, com busca). PDFs anexados aos eventos abrem num viewer próprio (pdf.js), sem o visualizador nativo do browser. Tela de gestão (`/timeline/gerenciar`, permissão `timeline:manage` — `admin`/`verificador`) com CRUD completo (criar/editar/excluir evento, upload de PDF/imagem pro MinIO).

> Instruções de instalação, variáveis de ambiente e seeds: ver [`COMO_RODAR.md`](./COMO_RODAR.md).

### Segurança do MinIO em rolling deploy

As credenciais da API devem usar a política `geo-app` de
[`infra/minio/app-policy.json`](./infra/minio/app-policy.json), que permite operar objetos, mas
não permite alterar políticas de bucket. `docker compose up` provisiona essa conta e restringe a
leitura anônima de `attachments` a `timeline/*`. Nunca configure `MINIO_ACCESS_KEY` com a conta root.

Em produção, aplique as políticas com uma identidade administrativa separada e rotacione os pods
para a credencial restrita **antes** do rollout desta versão. Assim, uma réplica de código antigo que
tente restaurar `attachments/*` como público recebe `AccessDenied` e não fica pronta. A conta root e
as permissões `s3:PutBucketPolicy`, `s3:DeleteBucketPolicy` e `s3:PutBucketAcl` não devem ser entregues
à aplicação.

### Rolling deploy do formulário de casos

O valor `rascunho` é novo no enum de status e não pode ser lido pelo Prisma Client da versão antiga.
Faça o rollout em duas fases: primeiro publique a migration e a nova versão com
`CASE_DRAFTS_ENABLED=false`; espere todos os pods antigos serem drenados; depois altere a variável
para `true` e reinicie somente os pods novos. Em `NODE_ENV=production`, a ausência da variável também
bloqueia escritas de rascunho com HTTP 503. Isso preserva leitura/validação segura durante a janela de
compatibilidade sem gravar um enum desconhecido para réplicas antigas.

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
