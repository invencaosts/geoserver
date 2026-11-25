# Estudo de integração entre mapa e linha do tempo

Este documento descreve o estado do código e as possibilidades de integração.
**A integração não foi implementada nesta etapa:** não foram criados eventos,
relações, migrations ou publicações derivados de casos ou bases geográficas.

## Escopo e fontes examinadas

O diagnóstico considera o código e a carga inicial versionados no repositório e a
inspeção dos atributos das quatro bases locais fornecidas. O banco de produção não
foi consultado; as quantidades da carga inicial abaixo não representam uma
contagem dos registros que existem atualmente em produção. Também não houve
conferência externa dos atos oficiais citados nos atributos: as datas dessas
referências ainda precisam de verificação documental.

Fontes locais centrais:

- [Modelo de dados](../apps/api/prisma/schema.prisma): `TimelineEvent`, `Case`,
  `CaseContribution`, `CaseStatusHistory`, `CaseSource`, `CaseDocument`, `Dataset`
  e `Feature`.
- [Controller da linha do tempo](../apps/api/src/timeline/timeline.controller.ts):
  endpoints públicos e exigência de `timeline:manage` na administração.
- [Serviço da linha do tempo](../apps/api/src/timeline/timeline.service.ts):
  `getTimeline`, `createAdmin`, `updateAdmin` e exclusão administrativa.
- [Seed da linha do tempo](../apps/api/prisma/seed-timeline.ts) e planilhas
  `apps/api/prisma/seed-data/timeline-brasil.xlsx` e `timeline-mg.xlsx`.
- [Página pública](<../apps/web/src/app/(app)/timeline/page.tsx>),
  [componente TimelineView](../apps/web/src/components/timeline/timeline-view.tsx)
  e [gestão dos eventos](<../apps/web/src/app/(app)/timeline/gerenciar/page.tsx>).
- [Política de acesso a datasets](../apps/api/src/datasets/dataset-access.policy.ts)
  e [documentação das bases importadas](./datasets-mapa.md).
- Componentes SHP/DBF/PRJ e declarações de codificação das bases em
  `/home/invencaosts/Downloads/Pesquisa Sinthia - CNPQ/`.

## O que a linha do tempo mostra hoje

A implementação exibe marcos históricos, legais e territoriais por meio do
TimelineJS, com filtro de escopo nacional/estadual e unidade federativa. A mídia
pode incluir imagem ou PDF; os PDFs usam o visualizador da própria aplicação.

`TimelineEvent` é um cadastro independente. Guarda escopo, UF opcional, datas
inicial e final com precisão parcial, data de exibição, título, texto, mídia,
crédito, legenda, tipo, fundo e ordenação. **Não há relações com casos, datasets,
feições, fontes de casos ou documentos de casos.** Uma URL de mídia não equivale a
um vínculo normalizado com `CaseDocument` nem a uma fonte documental estruturada.

Os endpoints existentes são:

| Endpoint                                                   | Finalidade                        | Acesso atual              |
| ---------------------------------------------------------- | --------------------------------- | ------------------------- |
| `GET /timeline?modo=todos\|nacional\|estadual&estados=...` | Dados para a apresentação pública | Público                   |
| `GET /timeline/estados`                                    | UFs com eventos disponíveis       | Público                   |
| `GET /timeline/admin`                                      | Listagem administrativa           | Login e `timeline:manage` |
| `POST /timeline/admin`                                     | Criação manual                    | Login e `timeline:manage` |
| `PATCH /timeline/admin/:id`                                | Edição manual                     | Login e `timeline:manage` |
| `DELETE /timeline/admin/:id`                               | Exclusão                          | Login e `timeline:manage` |

A permissão `timeline:manage` pertence atualmente a administradores e
verificadores. O CRUD grava diretamente em `timeline_events`. Não há rascunho,
fila editorial, aprovação ou visibilidade por evento: um registro criado na
administração pode ser retornado pelo endpoint público imediatamente. Portanto,
**o cadastro atual não deve receber propostas ou conteúdo derivado de dados
restritos**.

Os eventos podem ser criados manualmente ou pelo seed. O seed só executa a carga
quando a tabela está vazia. As planilhas versionadas contêm 25 registros nacionais,
incluindo o título, com marcos de 1530 a 2020, e 53 de Minas Gerais, incluindo o
título, com marcos de 1501 a 2018. Esses são números da carga inicial inspecionada;
não se verificou se ela corresponde ao conteúdo atual do banco. O serviço trata
registros de tipo `title` separadamente dos eventos apresentados.

O modelo registra mídia, crédito e legenda, mas não possui entidade própria de
fonte verificável, autoria editorial, responsável pela revisão ou histórico de
correções.

## Datas disponíveis e seus significados

Datas de auditoria e datas históricas devem continuar distintas:

| Campo ou origem                                                         | Significado                                                        | Uso adequado em uma integração futura                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `TimelineEvent.startYear/startMonth/startDay` e equivalentes de término | Data ou período atribuído ao marco histórico, com precisão parcial | Data do evento, depois de conferir a fonte e sua precisão                    |
| `TimelineEvent.displayDate`                                             | Rótulo textual de apresentação                                     | Explicar a data; não substituir uma data estruturada verificável             |
| `CaseContribution.periodoInicio/periodoFim`                             | Anos informados como período de ocorrência/análise                 | Candidato a período histórico, após esclarecer se representa fato ou análise |
| `CaseStatusHistory.createdAt`                                           | Momento de mudança no fluxo da plataforma                          | Trilha interna de submissão, verificação, validação ou rejeição              |
| `Case.submittedAt`                                                      | Submissão do caso à verificação                                    | Auditoria da plataforma                                                      |
| `Case.declarationAcceptedAt`                                            | Aceite da declaração do formulário                                 | Auditoria e comprovação do aceite                                            |
| `Case.createdAt/updatedAt`                                              | Criação e edição do cadastro                                       | Auditoria; não data de grilagem ou decisão                                   |
| `CaseDocument.createdAt`                                                | Upload de documento                                                | Auditoria; não data de emissão ou do fato narrado no documento               |
| `publicationApprovedAt` de documentos ou datasets                       | Autorização de divulgação na plataforma                            | Auditoria da publicidade                                                     |
| `Dataset.createdAt/updatedAt` e `Feature.createdAt`                     | Cadastro, importação ou processamento                              | Operação da plataforma; não ocorrência territorial                           |
| Data no nome do arquivo ou em metadados de atualização                  | Versão, referência ou extração do arquivo, a confirmar             | Proveniência do conjunto, sem inferir um evento histórico                    |

Um caso pode oferecer descrição, tipo, município/UF, período, instrumento central,
cancelamento, órgão, retorno ao patrimônio, destinação, conflitos, fontes,
documentos e referências espaciais. Esses campos podem sustentar eventos
documentados, mas o estado atual do cadastro não garante uma data específica para
cada decisão ou mudança de situação.

Uma futura divulgação deve conferir o caso validado, a publicidade das informações,
a ausência de restrição de divulgação e a autorização das fontes e documentos
usados. A validação de um caso na plataforma não transforma automaticamente seus
anexos ou atributos em material público.

## O que as quatro bases permitem concluir

### AREA_IMOVEL_1

As 54.651 feições inspecionadas representam polígonos ou multipolígonos de imóveis.
Os campos incluem `cod_imovel`, `municipio`, `num_area`, `mod_fiscal`, `ind_status`,
`ind_tipo` e `des_condic`. Não há coluna de data de ocorrência.

Condições que mencionam cancelamento por decisão administrativa ou judicial podem
indicar um fato a investigar, mas o snapshot não informa quando ele ocorreu nem
identifica necessariamente a decisão que o fundamenta. Um ano em uma referência à
Lei 12.651 é referência ao instrumento legal, não a data de um fato daquele imóvel.
A geometria pode localizar um evento já documentado; a existência do imóvel não é
evidência de grilagem.

### RESERVAS_GARIMPEIRAS

As 17 feições contêm os campos `NOME` e `DOCUMENTO`. `DOCUMENTO` contém referências a
atos e datas/anos em formatos diversos. As datas não foram verificadas
automaticamente nem confrontadas com os documentos oficiais.

É a base mais promissora para uma curadoria inicial pequena: podem existir marcos
de criação ou alteração de reservas por portaria ou lei. Entretanto, anos com dois
dígitos, formatos abreviados e menções a alterações exigem conferir a fonte,
identificar qual ato ocorreu e distinguir data do ato de data de publicação ou
vigência. Não se deve resolver o século ou escolher a data por inferência.

Uma reserva garimpeira é um marco territorial/administrativo. Sua existência, por si
só, não caracteriza grilagem.

### cete_BR_LQs_22_ptPoint

As 8.441 feições são pontos de localidades quilombolas. Há nomes de comunidade,
município, UF, aglomerado e território, além de campos como `P_FCP`, `OCORRENCIA`,
`Lat_d` e `Long_d`. Não há uma coluna de data de evento.

`P_FCP` é uma referência de processo e pode conter um ano dentro do identificador.
Isso não informa a data nem o significado de um ato de certificação ou
reconhecimento. `OCORRENCIA` não é uma data. Vários pontos podem compartilhar
processo ou território: gerar um evento por ponto produziria duplicações.

### cete_BR_LIs_CD2022_191224Point

As 10.967 feições são pontos de localidades indígenas. Os campos incluem `NM_LI`,
`NM_MUNIC`, `NM_TI`, identificadores da terra indígena, `SITUACAO` e `FASE`. A fase
pode indicar estados como regularização, declaração, homologação ou encaminhamento
ao registro, mas não fornece a data em que cada marco ocorreu.

Várias localidades podem se referir à mesma terra indígena. A referência temporal
no nome do arquivo não deve ser usada como data de declaração, homologação,
ocupação ou conflito. A existência de localidade ou terra indígena não é indício
de grilagem.

## Informação disponível e eventos possíveis

| Informação disponível                                            | Evento possível                                                    | Fonte/data necessária                                                            | Viabilidade                                                           | Revisão necessária                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Evento cadastrado em `TimelineEvent`                             | Marco legal ou territorial já apresentado                          | Data e contexto do cadastro; documento ou fonte que os fundamentem               | Já funciona, com governança editorial limitada                        | Conferir fonte, categoria e publicidade; o cadastro atual publica diretamente  |
| `periodoInicio/periodoFim` de caso validado                      | Período documentado de ocorrência ou análise do caso               | Fonte pública que fundamente o período e esclareça seu significado               | Média                                                                 | Obrigatória; distinguir ocorrência de análise                                  |
| Cancelamento, órgão, retorno ao patrimônio ou destinação em caso | Decisão administrativa/judicial ou mudança de situação documentada | Data da decisão, órgão, número do ato e documento autorizado para divulgação     | Alta quando a documentação existir                                    | Obrigatória, com redação fiel ao documento e conferência das permissões        |
| `CaseStatusHistory.createdAt`                                    | Atividade interna de submissão, validação ou rejeição              | Histórico e ator da própria plataforma                                           | Alta para auditoria interna; inadequada como data do fato territorial | Não publicar como ocorrência histórica de grilagem                             |
| Criação, atualização, upload, importação ou aprovação            | Evento operacional da plataforma                                   | Metadado do sistema                                                              | Alta para auditoria; inviável como fato histórico territorial         | Não transformar automaticamente em marco territorial                           |
| Status ou condição de `AREA_IMOVEL_1`                            | Cancelamento ou mudança de condição do imóvel                      | Histórico longitudinal, data efetiva, decisão e fonte oficial                    | Baixa com o snapshot atual                                            | Obrigatória; o estado atual não informa quando ocorreu a mudança               |
| Geometria e identificação de `AREA_IMOVEL_1`                     | Associação espacial de evento previamente documentado              | Evento sustentado por caso, decisão ou outra fonte verificável                   | Média                                                                 | Obrigatória; a existência do imóvel não indica grilagem                        |
| `DOCUMENTO` de `RESERVAS_GARIMPEIRAS`                            | Criação ou alteração de reserva por ato legal                      | Portaria/lei oficial, data completa, órgão e confirmação do território abrangido | Média/alta para curadoria dos 17 registros                            | Obrigatória; resolver abreviações, século, alterações e significado da data    |
| `P_FCP` de localidade quilombola                                 | Marco documentado de processo de certificação ou reconhecimento    | Processo e ato oficial com tipo, data e sujeito identificados                    | Baixa apenas com a base; média após enriquecimento oficial            | Obrigatória; não usar o ano do número de processo como data do marco           |
| Localidade ou território quilombola sem ato datado               | Associação espacial de marco previamente documentado               | Fonte pública com data e significado do marco                                    | Baixa                                                                 | Obrigatória; existência territorial não é evento nem indício de grilagem       |
| `FASE` de localidade indígena                                    | Declaração, homologação, registro ou regularização documentados    | Ato oficial da Funai/DOU com data e identificador estável da terra indígena      | Baixa apenas com a base; média após enriquecimento                    | Obrigatória; várias localidades podem representar o mesmo ato territorial      |
| Terra ou localidade indígena sem data                            | Associação espacial de marco previamente documentado               | Ato oficial, data, fase e identificador estável da terra indígena                | Baixa                                                                 | Obrigatória; não inferir data pelo arquivo nem tratar existência como grilagem |
| Dataset, feição, caso ou documento restrito                      | Nenhum evento público automático                                   | Autorização explícita e compatível para todas as fontes e informações derivadas  | Inviável para publicação automática                                   | Obrigatória; herdar a restrição mais forte e verificar acesso em cada consulta |

## Criação manual, sugestão e integração automática

| Abordagem futura                      | Vantagens                                                                 | Riscos e condições                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criação manual vinculada              | Permite selecionar fatos relevantes e conferir data, fonte e contexto     | Exige trabalho de curadoria; deve registrar autoria, revisão e vínculos para evitar decisões sem rastreabilidade                                                  |
| Sugestão automática sujeita à revisão | Reduz digitação e identifica candidatos a partir de dados estruturados    | Pode confundir snapshot com evento, repetir territórios ou interpretar datas ambíguas; sugestões precisam ficar fora do endpoint público                          |
| Integração automática com publicação  | Pode acompanhar um provedor estruturado e confiável com menor intervenção | Inadequada no estado atual: faltam datas verificadas, governança, deduplicação e herança de permissões; somente avaliar após etapas anteriores e qualidade medida |

Não há justificativa para gerar milhares de eventos a partir da simples existência
das feições. A recomendação é começar pela criação manual vinculada e evoluir para
sugestões revisáveis, sem publicação automática.

## Recomendação por etapas

### 1. Definir governança e permitir criação manual vinculada

Antes de integrar as bases, projetar um fluxo editorial que registre:

- categoria: marco legal, caso documentado de grilagem ou marco territorial;
- estado editorial: rascunho, em revisão, publicado, rejeitado ou retirado;
- visibilidade e restrição herdadas das fontes;
- autor, revisor, data da revisão e justificativa;
- precisão e significado da data: fato, período, documento, decisão ou estimativa;
- vínculos normalizados com casos, fontes, documentos, datasets e feições quando
  necessários;
- histórico de revisões e correções.

Um evento pode ter várias fontes, documentos ou áreas associadas. Por isso, uma
relação normalizada é mais adequada do que concentrar referências em texto livre
ou assumir um único vínculo opcional.

Os eventos legados precisam de curadoria para distinguir marcos legais de outros
marcos territoriais. Uma futura transição deve preservar o comportamento público
existente, identificar proveniência de seed/cadastro manual legado e tornar
explícita a ausência de revisão histórica quando ela não for conhecida. Não se
recomenda reclassificar todos os registros automaticamente como marcos legais.
Nenhuma dessas mudanças foi executada nesta etapa.

### 2. Sugerir eventos manualmente a partir de casos

Uma ação futura “Sugerir evento para a linha do tempo” pode preencher uma proposta
a partir de um caso validado, usando período, título, contexto, fontes permitidas e
geometria vinculada. O revisor deve confirmar data, redação, categoria e publicidade
antes da publicação.

O histórico de status deve permanecer numa trilha de auditoria própria. “Caso
validado em 2026” descreve uma ação da plataforma, não a ocorrência de grilagem.
Uma decisão judicial ou administrativa só deve virar um evento histórico quando
existirem data e documento que a sustentem.

### 3. Gerar candidatos revisáveis, com deduplicação

Uma eventual entidade separada de candidato deve permanecer invisível ao endpoint
público. Só gerar sugestões quando houver:

- data ou período com significado explícito;
- fonte documental identificável;
- sujeito estável, como caso, instrumento ou território;
- autorização compatível com o uso proposto;
- evidência armazenada e rastreável.

A curadoria dos 17 registros de `RESERVAS_GARIMPEIRAS` é um piloto de escala
adequada, depois de confirmar os atos oficiais. O texto de `DOCUMENTO` pode ajudar
a localizar fontes, mas não deve ser interpretado como uma data verificada nem
produzir publicação automática.

A deduplicação deve combinar categoria, sujeito, órgão, tipo/número/ano do ato e
data normalizada. Pontos diferentes associados à mesma terra ou processo devem
agregar evidências ao mesmo candidato quando representarem o mesmo fato.
Reimportação de arquivo ou atualização de geometria não deve gerar um evento novo
por si só.

### 4. Avaliar enriquecimento externo controlado

Para imóveis, localidades quilombolas e indígenas, é necessário obter histórico
oficial com datas e identificadores estáveis antes de sugerir marcos. Exemplos a
estudar são mudanças de condição do CAR em snapshots comparáveis, atos de processos
FCP e atos de declaração, homologação, registro ou regularização de terras
indígenas. A disponibilidade e a adequação desses históricos não foram confirmadas
por consulta externa neste estudo.

Mesmo com fonte estruturada, só avaliar publicação automática depois de medir
qualidade, duplicação, correções retroativas e estabilidade do provedor. Ela não é
recomendada para a etapa atual.

## Permissões, rastreabilidade e correções

- O futuro endpoint público deve devolver apenas eventos publicados e públicos.
  Os endpoints de revisão precisam aplicar permissões próprias.
- Um candidato ligado a qualquer dado restrito deve herdar a restrição mais forte.
  A aprovação de um evento não substitui a autorização de suas fontes.
- Documento com dados pessoais, fonte restrita ou dataset restrito não pode ser
  transformado em texto público por uma rotina de derivação.
- O acesso aos vínculos e geometrias deve repetir a autorização atual. Evitar copiar
  coordenadas ou atributos sensíveis para um texto que depois se torne público.
- Deve haver uma política para revogação de acesso na origem, incluindo retirada ou
  reavaliação do evento derivado. Não basta checar permissões apenas na criação.
- Correções precisam registrar autor, motivo, versão anterior e substituta. Eventos
  retirados ou revogados devem continuar auditáveis conforme a permissão aplicável.
- A evidência deve identificar documento/ato, órgão, localização ou referência,
  data consultada, dado original utilizado e transformação que gerou a proposta.
- A interface deve distinguir “Marco legal”, “Caso documentado de grilagem” e
  “Marco territorial”. Um imóvel, reserva, terra indígena ou localidade quilombola
  não deve ser apresentado como prova ou suspeita de grilagem apenas por existir.

## Limitações e decisões pendentes

- O banco atual não foi acessado; o diagnóstico do conteúdo usa o código e as
  planilhas versionadas, não uma auditoria dos registros em produção.
- Os atos mencionados nas bases ainda precisam ser consultados nas fontes oficiais.
  Nenhuma data foi validada por essa consulta nesta etapa.
- Definir se haverá somente uma linha do tempo pública ou também visões restritas
  para revisão e pesquisa.
- Esclarecer a semântica de `periodoInicio/periodoFim`, hoje descrita como
  ocorrência/análise, antes de utilizá-la como data de um fato.
- Escolher se a geometria histórica será apenas um vínculo com o registro atual ou
  também um snapshot versionado, preservando a autorização correspondente.
- Definir as fontes aceitas para atos de reservas, FCP, Funai e histórico do CAR.
- Decidir quem poderá sugerir eventos; inicialmente, manter revisão e publicação
  com `timeline:manage` reduz o risco de divulgação indevida.
- Definir política para precisão anual, intervalos, datas incertas e divergências
  entre data do ato, publicação, vigência e ocorrência.
- Projetar autoria, revisão, correções, deduplicação e herança de restrições antes
  de qualquer geração automática.

Critérios para uma futura implementação: nenhuma importação cria eventos por si
só; informação restrita não aparece no endpoint público; toda data tem significado
e fonte registrados; sugestões duplicadas convergem; correções preservam histórico;
e marcos territoriais não são rotulados como grilagem sem evidência específica,
contexto e revisão. **Este documento não implementa essa integração.**
