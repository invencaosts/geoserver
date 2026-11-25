# Datasets importados no mapa

O mapa carrega tiles vetoriais por área e zoom, pela API autenticada. Não baixa o
GeoJSON completo nem corta a camada nas primeiras 1.000 feições. Os atributos são
carregados quando uma feição é selecionada. As camadas de casos continuam separadas.

O Martin provisionado no Compose não é usado para servir a tabela `features`
diretamente: esse acesso não aplica as regras de datasets restritos da aplicação.
O serviço Martin passa a ser opcional no profile `public-tiles`, com publicação
automática desabilitada e porta vinculada apenas ao localhost. Seu catálogo começa
vazio; cadastre ali somente fontes públicas explicitamente revisadas, nunca as
tabelas `features`/`datasets` diretamente.

## Importação

Em **Dados**, envie um ZIP por camada contendo `.shp`, `.shx`, `.dbf` e `.prj` com o
mesmo nome-base. Inclua `.cpg` ou `.cst` se existir. Componentes podem estar numa
subpasta. O parser associa o registro DBF à geometria na mesma posição do SHP,
inclusive quando há registros excluídos ou formas nulas; contagens divergentes são
rejeitadas.

- Upload de dataset: até **100 MB**; ZIP Shapefile: até **256 MB descompactados**.
- Permanecem os limites de 256 entradas e razão máxima de compressão 200:1.
- Os limites de anexos de casos permanecem 25 MB por upload e 100 MB descompactados.
- `.cpg` tem precedência sobre `.cst`. Sem declaração, detecta-se UTF-8 válido e,
  caso contrário, usa-se Windows-1252, compatível com os caracteres Latin-1 das bases
  verificadas. Codificações declaradas inválidas são rejeitadas.
- `.prj` é validado e utilizado para reprojetar para longitude/latitude WGS84.
  Coordenadas fora de longitude `[-180,180]` e latitude `[-90,90]` são rejeitadas.
  Sem `.prj`, apenas coordenadas geográficas plausíveis são aceitas, com a origem
  registrada como assumida EPSG:4326; prefira sempre fornecer a projeção correta.
- GeoJSON deve estar em WGS84 (RFC 7946). Uma declaração explícita de outro CRS é
  rejeitada: reprojete o arquivo antes do upload.
- Valores DBF numéricos permanecem números JSON, lógicos permanecem booleanos, datas
  tornam-se `AAAA-MM-DD`; valores numéricos ausentes/inválidos tornam-se `null`.
  Códigos em colunas de caracteres preservam zeros à esquerda.
  Tipos DBF binários não suportados (por exemplo I/B/O/T) são rejeitados com nome do
  campo, em vez de gerar texto corrompido. Converta essas colunas antes do upload.
- O banco conserva os vértices, o tipo e a dimensão Z. Tiles são uma representação
  2D recortada/simplificada para a escala, sem substituir polígonos por centroides.

O worker processa uma importação por vez e grava lotes de até 250 feições numa
transação com timeout de 180 segundos. Uma falha reverte esse lote de importação,
sem apagar a versão anterior fora da transação. Jobs repetidos de datasets já ativos
não reimportam nem alteram os IDs das feições.

Datasets continuam entrando como **restritos**. Pedir publicação no upload não os
torna públicos; a aprovação pelo fluxo existente continua necessária.

## Configurar a apresentação

Na página **Mapa**, abra **Camadas de dados geográficos**, na legenda inferior esquerda.
Cada camada tem cor, nome, controle de visibilidade e a ação **Enquadrar**.
O botão de engrenagem **Configurar** abre **Apresentação no mapa** para quem pode
configurar o dataset.

Selecione o campo de título, os campos visíveis, seus rótulos e, se desejado, uma cor.
Sem seleção específica, a apresentação é genérica e usa os campos permitidos,
sem depender de nomes de colunas. Os pop-ups ocultam vazios e formatam números/datas.
Valores são inseridos como texto, inclusive quando contêm tags HTML.

Autor autorizado e revisores podem configurar a apresentação; somente revisores
podem aprovar os campos da coluna **Público**. Campos internos/sensíveis continuam
bloqueados mesmo quando pedidos na configuração. Para outros usuários, somente os
campos aprovados nessa lista são apresentados. A lista pública inicia vazia, também
em datasets antigos: até a revisão, o mapa informa que não há atributos publicados.
**Salvar apresentação não publica o dataset.**

Pontos próximos são agrupados por escala. Clique no agrupamento para acessar os
membros com paginação e seus detalhes individuais, inclusive pontos coincidentes.
Linhas, áreas e pontos individuais abrem os atributos da feição selecionada. Há
estados de carregamento/erro; conteúdo longo tem rolagem.

## API e permissões

A renderização usa `GET /datasets/:id/tiles/:z/:x/:y.mvt`; o clique usa
`GET /datasets/:id/map-features/:featureId`, que entrega somente os atributos
permitidos, sem a geometria original. Metadados e membros de agrupamentos também
exigem `dataset:read` e repetem a autorização de leitura do dataset.

`GET /datasets/:id/map-features?pageSize=200&cursor=...&bbox=oeste,sul,leste,norte`
é a consulta paginada de geometrias originais, com atributos filtrados e IDs
estáveis. Por permitir recuperar as coordenadas exatas de toda a camada, exige
**`data:export`**, assim como `/features` e `/export`. O mapa interativo usa tiles e
não depende dessa permissão. A resposta traz `nextCursor`; `null` indica o fim.
O bbox aceita longitude/latitude e travessia do antimeridiano.

`PATCH /datasets/:id/map-config` aplica somente as chaves enviadas, de forma
atômica. O autor deve omitir `publicFields`; somente a verificação pode alterá-la.
Assim, mudar uma cor ou um rótulo a partir de uma tela antiga não restaura campos
públicos que tenham sido revogados por um revisor.

## Bases reais verificadas

As sugestões abaixo usam os campos efetivamente inspecionados. Não são regras
fixas do código nem autorização para publicação das informações.

| Base                           | Feições | Geometrias verificadas       | Sugestão de título | Sugestões de rótulos                                                                            |
| ------------------------------ | ------: | ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| AREA_IMOVEL_1                  |  54.651 | Polygon e MultiPolygon       | `cod_imovel`       | `municipio`: Município; `num_area`: Área; `mod_fiscal`: Módulos fiscais; `des_condic`: Condição |
| RESERVAS_GARIMPEIRAS           |      17 | Polygon e MultiPolygon com Z | `NOME`             | `DOCUMENTO`: Documento                                                                          |
| cete_BR_LQs_22_ptPoint         |   8.441 | Point                        | `NM_CQ`            | `NM_MUNIC`: Município; `NM_UF`: Estado; `NM_AGLOM`: Aglomerado                                  |
| cete_BR_LIs_CD2022_191224Point |  10.967 | Point                        | `NM_LI`            | `NM_MUNIC`: Município; `NM_TI`: Terra indígena; `SITUACAO`: Situação; `FASE`: Fase              |

As quatro origens declaram SIRGAS 2000 (EPSG:4674), com longitude antes de latitude.
O primeiro ponto quilombola confere com os atributos `Long_d` e `Lat_d`:
`[-37.7860389957, -10.9412705554]`. Foram conferidos acentos como “Carnaíba” e
“Aldeia Indígena Fortaleza do Castanho”. O DBF das duas camadas de pontos declara
`ISO-8859-1` em `.cst`.

## Verificação reproduzível

Sem acessar banco, validar todos os registros dos quatro arquivos locais:

```sh
pnpm --filter api validate:real-datasets '/caminho/Pesquisa Sinthia - CNPQ/'
```

O script encontra as subpastas, monta cada ZIP em memória, valida o upload e executa
o parser real, imprimindo uma linha JSON por base com contagem, tipos, bounds,
campos/tipos, tempo e memória. Os arquivos reais não são copiados para o repositório.

Para também testar o worker, armazenamento e associação de **todos** os registros,
use exclusivamente um banco PostGIS local separado, já migrado, cujo nome contenha
`map_validation` ou `test`:

```sh
REAL_DATASET_DATABASE_URL='postgres://usuario:senha@127.0.0.1:porta/map_validation' \
  pnpm --filter api validate:real-datasets '/caminho/Pesquisa Sinthia - CNPQ/' --import
```

Essa opção cria datasets novos com prefixo `map-validation`, todos restritos, e
compara atributos sem perda de tipos e coordenadas com tolerância de `1e-10` grau
após a serialização GeoJSON do PostGIS. Não limpa tabelas e deixa os datasets de
teste nesse banco separado para inspecionar a interface. Descarte somente o banco
de validação após o uso, nunca o banco da aplicação.

## Migrations e operação

As migrations são aditivas para configuração da apresentação e índice espacial.
A coluna geométrica passa a aceitar 2D/3D com restrição de SRID 4326, preservando
as geometrias existentes. Não é preciso recriar o banco nem reimportar datasets
cujos atributos/coordenadas já foram armazenados corretamente.

Antes de executar a versão nova num ambiente escolhido, aplique as migrations pelo
procedimento normal do projeto (`pnpm --filter api exec prisma migrate deploy`).
Essa instrução não executa deploy. A criação do índice e a alteração da coluna
exigem uma janela adequada se a tabela de produção for muito grande.

Na validação local, o parser das quatro bases usou menos de 900 MB de RSS, em série;
o script completo com importação e comparação de todos os registros chegou a
aproximadamente 1,2 GB, mantendo duas leituras para comparação;
o limite de arquivos e a concorrência unitária evitam multiplicar esse consumo num
servidor de 4 GB. Isso é uma medição de validação, não um teste de carga concorrente
de produção. Os tiles não contêm os atributos do DBF, só os identificadores
controlados e metadados de agrupamento; cada tile/detalhe repete a autorização.
