# Como rodar

## Rodando em desenvolvimento

Pré-requisitos: Node 22.12+ (ou 24+), pnpm (versão fixada em `packageManager` no `package.json`; `corepack enable` resolve), Docker.

Todos os comandos abaixo rodam a partir da raiz do monorepo.

```bash
# 1. instalar dependências do monorepo
pnpm install

# 2. criar os arquivos de ambiente a partir dos exemplos (os valores já batem com o docker-compose)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. subir serviços de infra (postgres+postgis, redis, minio, martin)
docker compose up -d

# 4. buildar o pacote compartilhado (necessário 1x, e de novo se editar packages/shared)
pnpm --filter @geo/shared build

# 5. rodar migrations do Prisma e gerar o client (só na primeira vez / após mudar o schema)
pnpm --filter api exec prisma migrate dev

# 6. seeds iniciais — NÃO rodam sozinhos em nenhum passo acima nem em deploy,
#    é preciso disparar manualmente sempre que for um banco novo/vazio
pnpm --filter api run seed:instituicoes   # base de instituições (INEP)
pnpm --filter api run seed:timeline       # 78 eventos da Linha do Tempo (Brasil + MG) + PDFs no MinIO

# 7. subir API e Web (2 terminais)
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

- `apps/api/.env` (copiar de `apps/api/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `MINIO_*`, `REDIS_URL`, `WEB_ORIGIN` (origem liberada no CORS — ajustar se o web não estiver em `localhost:3000`), `REGISTRATION_ENABLED` (`false` desativa a criação de novas contas pela tela de login; padrão `true`)
- `apps/web/.env.local` (copiar de `apps/web/.env.example`): `NEXT_PUBLIC_API_URL`

### Testes

```bash
pnpm --filter api test   # testes unitários da API (Vitest)
```

### Erros de tipo depois de um `git pull`

Se aparecerem erros de tipos inexistentes vindos de `@geo/shared` ou de modelos do Prisma, o build local está desatualizado. Rode de novo:

```bash
pnpm --filter @geo/shared build
pnpm --filter api exec prisma generate
```

Se algo quebrar: logs da API em `apps/api` (rodando via `pnpm dev:api`), logs do worker de import estão no mesmo processo da API (BullMQ roda embutido).

## Rodando em produção

**Ainda não implementado** — é o dia 5 do sprint (pendente). O plano é:

- `docker-compose.prod.yml` com todos os serviços containerizados (web, api, postgres+postgis, redis, minio, martin) na mesma rede Docker.
- Dockerfile multi-stage pra `apps/web` e `apps/api` (build + runtime enxuto).
- Variáveis de ambiente de produção (JWT_SECRET forte, credenciais reais do banco/minio, `WEB_ORIGIN` pro CORS).
- Deploy manual via `docker compose -f docker-compose.prod.yml up -d` na VPS (sem CI/CD por decisão sua).
- Rodar as migrations e os seeds (`seed:instituicoes`, `seed:timeline`) manualmente após o primeiro deploy — nenhum dos dois roda sozinho, ver [Rodando em desenvolvimento](#rodando-em-desenvolvimento) acima.

Não faça deploy do estado atual em produção: `JWT_SECRET` e senhas do banco/minio no `.env` são valores de desenvolvimento hardcoded, sem TLS, sem rate limiting.
