# Como rodar

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

# 5. seeds iniciais — NÃO rodam sozinhos em nenhum passo acima nem em deploy,
#    é preciso disparar manualmente sempre que for um banco novo/vazio
pnpm --filter api run seed:instituicoes   # base de instituições (INEP)
pnpm --filter api run seed:timeline       # 78 eventos da Linha do Tempo (Brasil + MG) + PDFs no MinIO

# 6. subir API e Web (2 terminais, a partir da raiz do monorepo)
pnpm dev:api     # http://localhost:3001/api
pnpm dev:web     # http://localhost:3000
```

Os dois seeds são idempotentes: se a tabela já tiver dado, eles pulam a carga sem duplicar — pode rodar de novo à toa que não quebra nada.

### Portas usadas (ajustadas pra não colidir com outros projetos na sua máquina)

| Serviço          | Porta |
| ---------------- | ----- |
| Web (Next.js)    | 3000  |
| API (NestJS)     | 3001  |
| Postgres/PostGIS | 5435  |
| Redis            | 6381  |
| MinIO API        | 9004  |
| MinIO Console    | 9005  |
| Martin (tiles)   | 3010  |

### Variáveis de ambiente

- `apps/api/.env` (copiar de `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `MINIO_*`, `REDIS_URL`, `WEB_ORIGIN` (origem liberada no CORS — ajustar se o web não estiver em `localhost:3000`)
- `apps/web/.env.local` (copiar de `.env.example`): `NEXT_PUBLIC_API_URL`

## O que testar agora

1. **Criar conta** em `/login` (aba "Criar conta") — vira admin automaticamente se for o primeiro usuário.
2. **Mapa** (`/mapa`): criar uma camada (nome, tipo, fonte), ligar/desligar visibilidade, mexer na opacidade — deve persistir ao recarregar a página.
3. **Dados Espaciais** (`/dados`): importar um `.geojson` (mais simples de testar) ou `.csv` com colunas `lat`/`lng` — acompanhar o status mudar de "Processando" pra "Ativo", e ver os pontos aparecerem no mapa.
4. **Casos de Grilagem** (`/casos`): criar um relato com lat/lng de teste, tentar pular etapa do workflow (deve bloquear), avançar `pendente → em_verificacao → validado`, conferir dashboard atualizando e o ponto aparecendo no mapa colorido por prioridade.
5. **Usuários** (`/usuarios`, precisa ser admin): criar um segundo usuário com papel `leitor` ou `contribuidor`, logar com ele e confirmar que ações restritas (criar camada, validar caso) ficam bloqueadas — isso valida o RBAC de verdade, não só visualmente.
6. **Dark mode**: alternar no ícone do header — confere se as cores/glass panels ficam legíveis nos dois temas.
7. **Relatórios** (`/relatorios`): baixar CSV/PDF de casos (com e sem filtro de status/tipo/município) e CSV/PDF de datasets — conferir que os dados batem com `/casos` e `/dados`.
8. **Linha do Tempo** (`/timeline`, precisa ter rodado `seed:timeline`): trocar entre Tudo/Nacional/Estadual, filtrar por estado (buscar "minas" ou "MG" no seletor), abrir um evento com PDF (ex: Constituição Portuguesa, 1822) e conferir que abre no viewer próprio, não no do browser. Em `/timeline/gerenciar` (como `admin`): cadastrar um evento novo, editar, excluir, e subir um PDF/imagem de teste.

Se algo quebrar: logs da API em `apps/api` (rodando via `pnpm dev:api`), logs do worker de import estão no mesmo processo da API (BullMQ roda embutido).

## Rodando em produção

**Ainda não implementado** — é o dia 5 do sprint (pendente). O plano é:

- `docker-compose.prod.yml` com todos os serviços containerizados (web, api, postgres+postgis, redis, minio, martin) na mesma rede Docker.
- Dockerfile multi-stage pra `apps/web` e `apps/api` (build + runtime enxuto).
- Variáveis de ambiente de produção (JWT_SECRET forte, credenciais reais do banco/minio, `WEB_ORIGIN` pro CORS).
- Deploy manual via `docker compose -f docker-compose.prod.yml up -d` na VPS (sem CI/CD por decisão sua).
- Rodar as migrations e os seeds (`seed:instituicoes`, `seed:timeline`) manualmente após o primeiro deploy — nenhum dos dois roda sozinho, ver [Rodando em desenvolvimento](#rodando-em-desenvolvimento) acima.

Não faça deploy do estado atual em produção: `JWT_SECRET` e senhas do banco/minio no `.env` são valores de desenvolvimento hardcoded, sem TLS, sem rate limiting.
