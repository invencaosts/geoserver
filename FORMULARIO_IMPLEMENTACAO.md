# Formulário de pesquisadores e casos

## Decisões para itens não definidos na planilha

- Documentos e datasets nascem como `restrito`; a publicação precisa ser escolhida explicitamente.
- Documento marcado com dados pessoais permanece restrito, mesmo que o cliente envie outra opção.
- O upload é opcional para submeter um caso, mas o questionário completo, uma fonte, uma referência espacial e o aceite da declaração são obrigatórios.
- O CPF permanece obrigatório no cadastro, preservando a regra já vigente no sistema.
- A declaração provisória exibida no formulário afirma legitimidade da obtenção, veracidade segundo o conhecimento do pesquisador e respeito às restrições informadas. O texto pode ser substituído sem migração de dados.
- O limite e os formatos de documentos continuam centralizados em `upload-validation.ts` (PDF e KMZ, 25 MiB).
- Relação com o caso, participação, instrumentos, fontes, publicidade, períodos, mecanismos, objetos, cancelamento, retorno, destinação, situação, sujeitos, escala e localização são catálogos em `form_options`; novas alternativas não exigem alteração do schema. As opções da planilha foram versionadas na migration `20261001220000_auditoria_formulario`.
- Dados de casos não validados só podem ser consultados pelo autor, por verificadores e por administradores. Mapa e acesso anônimo mostram apenas casos validados.
- Evidências usam o bucket privado `case-evidence`. O bucket público `attachments` permanece reservado às mídias da linha do tempo.
- Datasets anteriores à mudança mantêm a visibilidade pública histórica; novos datasets nascem restritos e têm proprietário identificado.
- E-mails, CPF e CNPJ são normalizados antes de persistir. A listagem de gestão de usuários não retorna e-mail, CPF nem dados institucionais.
- Informações, coordenadas, fontes e datasets de um caso marcado como restrito não entram na projeção pública nem no endpoint do mapa.
- O aceite da declaração é vinculado ao texto, hash e versão vistos; rascunhos de uma versão anterior exigem novo aceite antes da submissão.
- O aceite registra `declarationAcceptedById` e só pode ser feito pelo autor. Verificadores e administradores não podem editar nem submeter rascunhos alheios.
- Fontes nascem restritas. Documentos e datasets solicitados como públicos continuam restritos até aprovação explícita da verificação.
- PDF comprobatório pertence a `CaseDocument`; o pipeline de Dataset aceita somente formatos de dados espaciais/tabulares.
- A migração de evidências legadas mantém estado (`pending`, `processing`, `completed` ou `error`), atualiza os metadados copiados e impede readiness quando há falha, permitindo retomada segura.

## Fluxo

1. O pesquisador preenche as oito etapas; cada avanço salva a etapa atual no rascunho.
2. A interface redireciona para `/importar-exportar?caseId=<id>`.
3. Documentos e datasets enviados nessa página são vinculados ao caso.
4. Ao submeter, o caso passa de `rascunho` para `pendente` e entra na fila de verificação.
5. O autor pode reabrir o rascunho pela lista de casos; a etapa final apresenta um resumo completo antes de salvar novamente.
6. Um caso rejeitado pode ser corrigido pelo autor; a primeira edição o move de `rejeitado` para `rascunho` com registro no histórico.
7. Casos restritos não geram notificações detalhadas por área de interesse. O autor continua recebendo o retorno da validação.

## Cadastro do visualizador

Município, UF, escolaridade, perfil, vínculo institucional (sim/não), origem do acesso e finalidade são obrigatórios. Os catálogos seguem integralmente a aba `Visualizador`; `Outro` exige os campos específicos `perfilUsuarioOutro`, `tipoVinculoOutro`, `comoConheceuOutro` ou `finalidadeAcessoOutro`. Dados institucionais só são persistidos quando o usuário declara possuir vínculo.
