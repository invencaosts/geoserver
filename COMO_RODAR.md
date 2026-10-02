# Como rodar

Tutorial passo a passo para rodar o Observatório Grilagem de Terras na sua máquina, do zero. Se você
nunca instalou Docker ou Node, comece pela seção [1. Requisitos](#1-requisitos) e siga na ordem.

## O que vai rodar

A plataforma tem duas partes que você roda direto na máquina e quatro serviços de apoio que rodam
dentro do Docker:

| Parte            | O que é                                                                  | Onde roda |
| ---------------- | ------------------------------------------------------------------------ | --------- |
| Web (Next.js)    | O site que você abre no navegador                                        | Node      |
| API (NestJS)     | O servidor que guarda e entrega os dados; também processa as importações | Node      |
| Postgres/PostGIS | Banco de dados com suporte a geometrias (mapas)                          | Docker    |
| Redis            | Fila de tarefas (processamento de arquivos importados)                   | Docker    |
| MinIO            | Armazenamento de arquivos (PDFs, datasets, imagens)                      | Docker    |
| Martin           | Servidor de tiles vetoriais (provisionado, ainda não usado pelo front)   | Docker    |

Você **não precisa** instalar Postgres, Redis nem MinIO: o Docker baixa e sobe tudo sozinho.

## 1. Requisitos

### Máquina

- **Sistema**: Linux, macOS ou Windows 10/11 (no Windows, via WSL2 — explicado abaixo).
- **Memória**: 8 GB de RAM no mínimo (16 GB recomendado; o Docker sozinho consome uns 2 GB).
- **Disco**: ~5 GB livres (imagens Docker + dependências + dados).
- **Internet**: necessária na primeira instalação.

### Programas

| Programa | Versão           | Para quê                               |
| -------- | ---------------- | -------------------------------------- |
| Git      | qualquer recente | Baixar o código                        |
| Node.js  | 22.12+ ou 24+    | Rodar a Web e a API                    |
| pnpm     | 11.1.3           | Instalar as dependências do monorepo   |
| Docker   | 24+ com Compose  | Rodar banco, fila e armazenamento      |
| OpenSSL  | qualquer         | Gerar segredos (opcional, ver seção 4) |

As subseções abaixo explicam onde encontrar e como instalar cada um.

### 1.1 Windows: instale o WSL2 primeiro

No Windows, todos os comandos deste guia rodam dentro do **WSL2** (um Linux embutido no Windows).

1. Abra o **PowerShell como administrador** (menu Iniciar → digite "PowerShell" → botão direito →
   "Executar como administrador").
2. Rode:
   ```powershell
   wsl --install
   ```
3. Reinicie o computador. Na volta, abra o aplicativo **Ubuntu** no menu Iniciar e crie seu usuário
   e senha do Linux.

A partir daqui, use sempre o terminal do Ubuntu e siga as instruções de **Linux (Ubuntu/Debian)**,
exceto para o Docker (veja 1.5).

### 1.2 Git

- **Linux (Ubuntu/Debian/WSL)**: `sudo apt update && sudo apt install -y git`
- **Linux (Arch/Manjaro)**: `sudo pacman -S git`
- **macOS**: rode `git --version`; se não estiver instalado, o sistema oferece instalar as
  "Command Line Tools". Aceite.

### 1.3 Node.js

O jeito mais simples e que evita problemas de permissão é o **nvm** (gerenciador de versões do Node).

1. Pesquise no Google por **"nvm-sh github"** ou acesse <https://github.com/nvm-sh/nvm>. Na seção
   "Installing and Updating" há um comando `curl ... | bash` — copie a versão mais recente de lá.
   Na época deste guia era:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   ```
2. Feche e abra o terminal de novo.
3. Instale e ative o Node 24:
   ```bash
   nvm install 24
   nvm use 24
   ```

Alternativa sem nvm: baixe o instalador "LTS" em <https://nodejs.org/pt-br/download> (no macOS) ou
use o gerenciador de pacotes da sua distro, desde que a versão seja 22.12+ ou 24+.

### 1.4 pnpm

O Node já vem com o **corepack**, que instala o pnpm na versão exata que o projeto pede
(fixada em `packageManager` no `package.json`):

```bash
corepack enable
```

Se aparecer erro de permissão no Linux sem nvm, use `sudo corepack enable`.

### 1.5 Docker

**Windows e macOS — Docker Desktop**

1. Pesquise no Google por **"Docker Desktop download"** ou acesse
   <https://www.docker.com/products/docker-desktop/>.
2. Clique em **Download for Windows** (ou **Download for Mac** — escolha **Apple Silicon** para
   Macs M1/M2/M3/M4 e **Intel chip** para os mais antigos; em dúvida, menu Apple → "Sobre este Mac").
3. Instale com as opções padrão. No Windows, deixe marcado **"Use WSL 2 instead of Hyper-V"**.
4. Abra o Docker Desktop e espere o ícone da baleia ficar estável ("Engine running").
5. **Windows**: em Settings → Resources → WSL Integration, ative a integração com o **Ubuntu**.
   Assim o comando `docker` funciona dentro do terminal do Ubuntu.

O Docker Desktop precisa estar **aberto** sempre que você for rodar o projeto.

**Linux — Docker Engine**

Pesquise **"install docker engine"** ou acesse <https://docs.docker.com/engine/install/> e escolha
sua distribuição. Resumo:

- **Ubuntu/Debian**: siga a seção "Install using the apt repository" da página oficial (são uns 5
  comandos de copiar e colar). Ela já instala o plugin `docker compose`.
- **Arch/Manjaro**:
  ```bash
  sudo pacman -S docker docker-compose
  sudo systemctl enable --now docker
  ```

Depois, para usar o Docker sem `sudo`:

```bash
sudo usermod -aG docker $USER
```

Saia da sessão e entre de novo (ou reinicie) para valer.

### 1.6 Conferir tudo

```bash
git --version            # qualquer versão
node --version           # v22.12.x ou maior, ou v24.x
pnpm --version           # 11.1.3
docker --version         # 24 ou maior
docker compose version   # v2.x
docker run --rm hello-world   # deve imprimir "Hello from Docker!"
```

Se algum desses falhar, volte na subseção correspondente antes de seguir.

## 2. Baixar o código

```bash
git clone git@github.com:invencaosts/geoserver.git
cd geoserver
```

Se você não tem chave SSH configurada no GitHub, use HTTPS:
`git clone https://github.com/invencaosts/geoserver.git`.

**Todos os comandos a partir daqui rodam na raiz do repositório** (a pasta `geoserver`).

## 3. Instalar as dependências

```bash
pnpm install
```

Demora alguns minutos na primeira vez.

## 4. Configurar as variáveis de ambiente

A API e a Web leem configurações de arquivos `.env`. Crie-os a partir dos exemplos:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Os exemplos já vêm com valores que batem com o `docker-compose.yml`, então o projeto **sobe sem
alterar nada**. Mas há três ajustes que você deve fazer em `apps/api/.env`:

### 4.1 Gerar os segredos

Você precisa gerar dois valores aleatórios. Use **um** dos comandos abaixo (os dois funcionam):

```bash
# com OpenSSL (Linux, macOS, WSL)
openssl rand -hex 32

# com Node (funciona em qualquer lugar onde o Node esteja instalado)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cada execução imprime uma sequência de 64 caracteres, por exemplo
`3f9a1c...e47b`. Rode **duas vezes** e use um valor diferente em cada variável:

| Variável                 | O que é                                                                                                                  | O que colocar                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `JWT_SECRET`             | Chave que assina os tokens de login. Quem souber esse valor consegue se passar por qualquer usuário.                     | O primeiro valor gerado                                                       |
| `ADMIN_BOOTSTRAP_SECRET` | Senha de uso único para criar o **primeiro administrador** (seção 8). Vazio desativa a criação. Mínimo de 32 caracteres. | O segundo valor gerado. Depois de criar o admin, apague e deixe vazio de novo |

Exemplo de como fica o trecho no arquivo:

```dotenv
JWT_SECRET="3f9a1c0d...e47b"
ADMIN_BOOTSTRAP_SECRET="a81e77c2...09fd"
```

### 4.2 Desativar o banco shadow

O exemplo traz a linha `SHADOW_DATABASE_URL` apontando para a porta `5436`, que **não existe** no
`docker-compose.yml` (é um banco extra, opcional, usado só por quem cria migrations). Comente-a
colocando `#` no início:

```dotenv
# SHADOW_DATABASE_URL="postgresql://geo:geo_dev_pw@localhost:5436/geo_grilagem_shadow?schema=public"
```

### 4.3 Definir as credenciais de acesso padrão

O sistema **não vem com nenhum usuário pronto**. Para testar cada perfil sem precisar cadastrar e
promover contas manualmente, o final do `apps/api/.env` tem um bloco com uma conta por papel:

```dotenv
SEED_ADMIN_EMAIL="admin@observatorio.local"
SEED_ADMIN_PASSWORD=""
SEED_VERIFICADOR_EMAIL="verificador@observatorio.local"
SEED_VERIFICADOR_PASSWORD=""
SEED_PESQUISADOR_ENVIO_DOWNLOAD_EMAIL="pesquisador.download@observatorio.local"
SEED_PESQUISADOR_ENVIO_DOWNLOAD_PASSWORD=""
SEED_PESQUISADOR_ENVIO_EMAIL="pesquisador@observatorio.local"
SEED_PESQUISADOR_ENVIO_PASSWORD=""
SEED_VISUALIZADOR_EMAIL="visualizador@observatorio.local"
SEED_VISUALIZADOR_PASSWORD=""
```

- Os e-mails já vêm preenchidos; troque se quiser.
- **Preencha as senhas você mesmo** (mínimo 8 caracteres, uma diferente para cada conta). Pode usar
  o mesmo comando da seção 4.1 para gerar, ou escolher senhas fáceis de lembrar se a máquina for só
  sua. Senha vazia = aquele perfil não é criado.
- As contas só são criadas quando você roda `seed:usuarios` (seção 6). O seed não altera contas que
  já existem, então mudar a senha aqui depois não troca a senha de uma conta já criada.
- As contas de pesquisador já saem com o perfil profissional completo (exigido para enviar e baixar
  dados), preenchido com dados fictícios.

> Essas credenciais são para **desenvolvimento e ambiente beta**. O seed se recusa a rodar com
> `NODE_ENV=production`. Se o ambiente beta for acessível pela internet, use senhas fortes e
> compartilhe-as com os testadores por um canal privado, nunca no repositório.

### 4.4 Referência de todas as variáveis

**`apps/api/.env`**

| Variável                 | Valor padrão                                     | Quando mudar                                                                                              |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `postgresql://geo:geo_dev_pw@localhost:5435/...` | Só se mudar usuário, senha ou porta do Postgres no `docker-compose.yml`                                   |
| `SHADOW_DATABASE_URL`    | porta 5436                                       | Deixe comentada (ver 4.2)                                                                                 |
| `JWT_SECRET`             | valor de exemplo                                 | Sempre (ver 4.1)                                                                                          |
| `JWT_EXPIRES_IN`         | `8h`                                             | Tempo até o login expirar (`30m`, `8h`, `7d`...)                                                          |
| `REGISTRATION_ENABLED`   | `true`                                           | `false` impede a criação de novas contas pela tela de login                                               |
| `CASE_DRAFTS_ENABLED`    | `true`                                           | Mantenha `true` localmente. Só importa em deploy de produção (ver README)                                 |
| `ADMIN_BOOTSTRAP_SECRET` | vazio                                            | Preencha só para criar o primeiro admin (ver 4.1 e 8)                                                     |
| `PORT`                   | `3001`                                           | Porta da API. Se mudar, ajuste também `NEXT_PUBLIC_API_URL`                                               |
| `MINIO_ENDPOINT`         | `localhost`                                      | Endereço do MinIO                                                                                         |
| `MINIO_PORT`             | `9004`                                           | Porta do MinIO no `docker-compose.yml`                                                                    |
| `MINIO_ACCESS_KEY`       | `geo_app`                                        | Usuário **restrito** da aplicação criado pelo `minio-init`. Nunca use a conta root (`geo_admin`) aqui     |
| `MINIO_SECRET_KEY`       | `geo_app_dev_pw_123`                             | Senha desse usuário; precisa bater com `MINIO_APP_PASSWORD` do `docker-compose.yml`                       |
| `MINIO_BUCKET`           | `geo-datasets`                                   | Não mude                                                                                                  |
| `MINIO_PUBLIC_URL`       | `http://localhost:9004`                          | Endereço pelo qual o **navegador** acessa os arquivos públicos                                            |
| `REDIS_URL`              | `redis://localhost:6381`                         | Só se mudar a porta do Redis                                                                              |
| `WEB_ORIGIN`             | `http://localhost:3000`                          | Endereço do site, liberado no CORS. Mude se acessar a Web por outro endereço (ex.: IP da máquina na rede) |
| `SEED_<PAPEL>_EMAIL`     | `<papel>@observatorio.local`                     | E-mail da conta padrão daquele papel (ver 4.3)                                                            |
| `SEED_<PAPEL>_PASSWORD`  | vazio                                            | Senha da conta padrão; vazio não cria a conta (ver 4.3)                                                   |

**`apps/web/.env.local`**

| Variável              | Valor padrão                | Quando mudar                                   |
| --------------------- | --------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Se a API rodar em outra porta ou outra máquina |

> **Nunca** faça commit dos arquivos `.env` e `.env.local` (eles já estão no `.gitignore`) e nunca
> reaproveite os valores de exemplo fora da sua máquina.

## 5. Subir os serviços do Docker

```bash
docker compose up -d
```

Na primeira vez o Docker baixa as imagens (alguns minutos). Confira se ficou tudo de pé:

```bash
docker compose ps -a
```

Esperado: `postgres` como `healthy`; `redis`, `minio` e `martin` como `running`; e `minio-init` como
`exited (0)` — ele é um script que roda uma vez, cria os buckets e o usuário restrito da aplicação, e
termina. Se `minio-init` terminou com código diferente de 0, veja os logs com
`docker compose logs minio-init`.

O console web do MinIO fica em <http://localhost:9005> (usuário `geo_admin`, senha `geo_dev_pw_123`),
útil para conferir arquivos enviados.

## 6. Preparar o banco

```bash
# 1. buildar o pacote compartilhado (1x, e de novo se editar packages/shared)
pnpm --filter @geo/shared build

# 2. criar as tabelas no banco e gerar o client do Prisma
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma generate

# 3. carregar os dados iniciais (não rodam sozinhos; necessários em todo banco novo)
pnpm --filter api run seed:instituicoes   # base de instituições (INEP)
pnpm --filter api run seed:timeline       # 78 eventos da Linha do Tempo (Brasil + MG) + PDFs no MinIO
pnpm --filter api run seed:usuarios       # contas padrão de cada perfil (ver 4.3)
```

Os seeds são idempotentes: se os dados já existirem, eles pulam a carga sem duplicar. O
`seed:usuarios` imprime, para cada perfil, se a conta foi criada, já existia ou foi pulada por estar
sem senha.

> Vai **criar ou alterar migrations**? Use `pnpm --filter api exec prisma migrate dev` no lugar do
> `migrate deploy`. O `migrate dev` cria um banco temporário para comparação; se você descomentar
> `SHADOW_DATABASE_URL`, precisa ter um Postgres rodando nessa porta.

## 7. Rodar a API e a Web

Abra **dois terminais** na raiz do repositório:

```bash
# terminal 1
pnpm dev:api     # http://localhost:3001/api
```

```bash
# terminal 2
pnpm dev:web     # http://localhost:3000
```

Abra <http://localhost:3000> no navegador. O site funciona sem login, como visitante.

## 8. Acessar o sistema

Toda conta criada pela tela de cadastro entra como `visualizador`. Para entrar com outros perfis há
dois caminhos:

### 8.1 Contas padrão (desenvolvimento e beta)

Se você preencheu as senhas da seção 4.3 e rodou `seed:usuarios`, basta fazer login em
<http://localhost:3000/login> com o e-mail e a senha de cada perfil:

| Perfil                         | E-mail padrão                             | Senha                                      |
| ------------------------------ | ----------------------------------------- | ------------------------------------------ |
| Administrador                  | `admin@observatorio.local`                | `SEED_ADMIN_PASSWORD`                      |
| Verificador                    | `verificador@observatorio.local`          | `SEED_VERIFICADOR_PASSWORD`                |
| Pesquisador (envio e download) | `pesquisador.download@observatorio.local` | `SEED_PESQUISADOR_ENVIO_DOWNLOAD_PASSWORD` |
| Pesquisador (envio)            | `pesquisador@observatorio.local`          | `SEED_PESQUISADOR_ENVIO_PASSWORD`          |
| Visualizador                   | `visualizador@observatorio.local`         | `SEED_VISUALIZADOR_PASSWORD`               |

Esqueceu uma senha? A plataforma ainda não tem redefinição de senha. Coloque a nova senha no `.env`,
apague a conta pelo banco e rode o seed de novo (só funciona se a conta ainda não criou casos,
datasets ou documentos; senão, use [Começar do zero](#11-problemas-comuns)):

```bash
docker compose exec postgres psql -U geo -d geo_grilagem \
  -c "DELETE FROM users WHERE email = 'verificador@observatorio.local';"
pnpm --filter api run seed:usuarios
```

### 8.2 Primeiro administrador real (bootstrap)

Para uma instalação que não deve ter contas com senha conhecida, crie apenas o administrador inicial
por uma chamada à API, usando o `ADMIN_BOOTSTRAP_SECRET` gerado no passo 4.1. Isso só funciona
enquanto não existir nenhum admin — se você já rodou `seed:usuarios` com `SEED_ADMIN_PASSWORD`, o
admin já existe e a chamada responde `409`.

1. Confirme que `ADMIN_BOOTSTRAP_SECRET` está preenchido em `apps/api/.env` e que a API foi
   (re)iniciada depois disso.
2. Com a API rodando, em um terceiro terminal, rode o comando abaixo trocando o segredo, nome,
   e-mail, CPF (precisa ser um CPF **válido**) e senha:

   ```bash
   curl -X POST http://localhost:3001/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -H "x-bootstrap-secret: COLE_AQUI_O_ADMIN_BOOTSTRAP_SECRET" \
     -d '{
       "nome": "Administrador",
       "email": "admin@exemplo.com",
       "cpf": "52998224725",
       "senha": "troque-esta-senha",
       "municipio": "Belo Horizonte",
       "estado": "MG",
       "escolaridade": "graduacao_completa",
       "perfilUsuario": "pesquisador",
       "possuiVinculo": false,
       "comoConheceu": "pesquisa_academica",
       "finalidadeAcesso": "pesquisa_academica"
     }'
   ```

3. Resposta com os dados do usuário = sucesso. Faça login no site com esse e-mail e senha.
4. **Apague o valor de `ADMIN_BOOTSTRAP_SECRET`** (deixe `""`) e reinicie a API. Os próximos
   verificadores, pesquisadores e admins são promovidos pela tela **Usuários**.

Erros comuns: `403 Bootstrap administrativo indisponível` = segredo vazio, com menos de 32
caracteres ou diferente do enviado (reinicie a API depois de editar o `.env`);
`409 O administrador inicial já foi configurado` = já existe um admin.

## 9. Portas usadas

Ajustadas para não colidir com outros projetos na máquina.

| Serviço          | Porta |
| ---------------- | ----- |
| Web (Next.js)    | 3000  |
| API (NestJS)     | 3001  |
| Postgres/PostGIS | 5435  |
| Redis            | 6381  |
| MinIO API        | 9004  |
| MinIO Console    | 9005  |
| Martin (tiles)   | 3010  |

## 10. Dia a dia

- **Parar tudo**: `Ctrl+C` nos terminais da API e da Web, depois `docker compose stop`.
- **Voltar a rodar**: `docker compose up -d`, `pnpm dev:api` e `pnpm dev:web`. Não é preciso repetir
  os passos 3, 4 e 6.
- **Depois de um `git pull`**: rode `pnpm install`, `pnpm --filter @geo/shared build`,
  `pnpm --filter api exec prisma migrate deploy` e `pnpm --filter api exec prisma generate`.
- **Testes da API**: `pnpm --filter api test` (Vitest).

## 11. Problemas comuns

**`Cannot connect to the Docker daemon` / `permission denied ... docker.sock`**
O Docker não está rodando ou seu usuário não tem acesso. Windows/macOS: abra o Docker Desktop.
Linux: `sudo systemctl start docker` e confira o `usermod -aG docker $USER` da seção 1.5 (precisa sair
e entrar na sessão).

**`port is already allocated` / `EADDRINUSE`**
Outro programa usa a porta. Descubra qual com `sudo lsof -i :5435` (troque pela porta do erro) e pare
esse programa, ou mude a porta do lado esquerdo em `docker-compose.yml` (ex.: `"5437:5432"`) e ajuste
a variável correspondente no `.env`.

**`Can't reach database server at localhost:5436`**
A linha `SHADOW_DATABASE_URL` está ativa. Comente-a (seção 4.2).

**`Can't reach database server at localhost:5435`**
O Postgres não subiu. Rode `docker compose ps` e `docker compose logs postgres`.

**Upload de arquivo falha com `AccessDenied`**
`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` não batem com o usuário criado pelo `minio-init`, ou o
`minio-init` falhou. Rode `docker compose up minio-init` e confira os logs.

**Erros de tipo vindos de `@geo/shared` ou de modelos do Prisma**
Build local desatualizado:

```bash
pnpm --filter @geo/shared build
pnpm --filter api exec prisma generate
```

**Site abre, mas nenhuma requisição funciona (erro de CORS no console do navegador)**
O endereço do site não bate com `WEB_ORIGIN`. Se você abre por `http://127.0.0.1:3000` ou pelo IP da
máquina, coloque esse mesmo endereço em `WEB_ORIGIN` e reinicie a API.

**Logs**: a API e o worker de importação rodam no mesmo processo (`pnpm dev:api`); os erros aparecem
nesse terminal.

**Começar do zero (apaga todos os dados locais)**

> **Atenção:** os comandos abaixo apagam permanentemente o banco, a fila e todos os arquivos
> enviados no ambiente local. Não há como desfazer.

```bash
docker compose down
sudo rm -rf data/
docker compose up -d
```

Depois repita a seção 6 e a seção 8. O `sudo` é necessário no Linux porque os arquivos em `data/` são
criados pelos containers com outro usuário.

## Rodando em produção

**Ainda não implementado** — é o dia 5 do sprint (pendente). O plano é:

- `docker-compose.prod.yml` com todos os serviços containerizados (web, api, postgres+postgis, redis, minio, martin) na mesma rede Docker.
- Dockerfile multi-stage pra `apps/web` e `apps/api` (build + runtime enxuto).
- Variáveis de ambiente de produção (`JWT_SECRET` forte, credenciais reais do banco/minio, `WEB_ORIGIN` pro CORS).
- Deploy manual via `docker compose -f docker-compose.prod.yml up -d` na VPS (sem CI/CD por decisão sua).
- Rodar as migrations e os seeds (`seed:instituicoes`, `seed:timeline`) manualmente após o primeiro deploy — nenhum dos dois roda sozinho, ver [6. Preparar o banco](#6-preparar-o-banco).

Não faça deploy do estado atual em produção: as senhas do banco/minio no `docker-compose.yml` são
valores de desenvolvimento, sem TLS e sem rate limiting.
