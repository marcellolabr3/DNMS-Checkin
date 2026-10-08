# Extracao de criancas em Excel

Entrega de 2026-10-08.

## Objetivo

Adicionar no painel `Log` uma area de `Extracao` para SADMIN/Admin exportarem dados de criancas em arquivo Excel e compartilharem um resumo pelo WhatsApp.

## Onde fica

- UI: `index.html`, dentro de `#logCard`, abaixo de `#logList`.
- Logica: `app.js`.
- Testes: `tests/checkin.spec.js`, `tests/service-worker.spec.js`, `tests/xlsx-loading.spec.js`.

## Permissoes

- Visivel somente para SADMIN e Admin.
- `equipe`, `responsavel` e usuarios sem sessao nao acessam a area.
- A restricao e aplicada na renderizacao (`renderStudentExtraction`) e nas acoes de exportacao/compartilhamento.

## Filtros

A extracao suporta:

- Todas as criancas.
- Por turma: `Maternal`, `Kids`, `Juniors`, `Teens`, `Fora da faixa`, `Indefinida`.
- Criancas selecionadas manualmente, com busca por nome, turma, responsavel, telefone e endereco.

A turma exportada como `Turma efetiva` usa a regra atual do app: alocacao temporaria do dia, se houver; depois turma oficial; depois classificacao automatica.

## Excel gerado

Botao: `Exportar Excel`.

Arquivo: `criancas_<escopo>_<data>.xlsx`.

Abas:

- `Resumo`: escopo, total de criancas, data/hora de geracao e contagem por turma.
- `Criancas`: tabela principal com filtro no cabecalho e larguras de coluna definidas.

Colunas da aba `Criancas`:

- Nome
- Nascimento
- Turma efetiva
- Classificacao automatica
- Turma oficial
- Responsavel principal
- Telefone
- Endereco
- Observacoes
- Visitante
- Responsaveis vinculados

## WhatsApp

Botao: `Enviar WhatsApp`.

Gera texto curto com escopo, total e linhas no formato:

```text
Nome | Turma | Responsavel | Telefone
```

## Implementacao

- Reaproveita a biblioteca `xlsx` ja usada no app.
- A biblioteca continua carregando sob demanda por `ensureXlsxLoaded`; nao foi adicionada ao HTML inicial.
- A geracao do workbook fica em `buildStudentExtractionWorkbook`.
- O service worker foi versionado para `checkin-cache-v193`.
- `index.html` aponta para `app.js?v=20261008e`.

## Validacao

Executado em 2026-10-08:

```powershell
node --check app.js
npm.cmd test
```

Resultado: `npm.cmd test` passou com 228 testes.
