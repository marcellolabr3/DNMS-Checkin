# Correcao: cache do service worker quebrava o layout mobile (2026-10-08)

## Sintoma

No celular, apos o deploy da repaginada, o layout aparecia totalmente errado:
imagens gigantes (logo de 512x512), botoes de navegacao em blocos enormes,
conteudo espremido na lateral e overflow horizontal.

## Causa raiz

As PRs da repaginada alteraram `index.html`, `app.js` e `styles.css`, mas
nenhuma tocou em `sw.js`. O service worker combina duas estrategias:

- navegacao em **network-first** (o HTML novo chegava ao aparelho);
- assets em **cache-first** com `ignoreSearch` (o CSS/JS antigo era servido do
  cache `checkin-cache-v188` para sempre).

Resultado: HTML novo por cima de CSS antigo. As querystrings `styles.css?v=` e
`app.js?v=` tambem nao mudaram, entao o cache HTTP do navegador reforcava o
mesmo conteudo velho.

## Reproducao

Playwright com viewport 390x844 servindo HTML novo + CSS antigo (cenario A):

- `header` com **2295px** de altura;
- `document.scrollWidth` = **1228px** (overflow horizontal);
- `<img>` de **512x512** renderizado sem restricao.

Cenario de controle (CSS novo + fotos reais de 600x800): sem overflow e imagens
contidas — o CSS da repaginada esta correto, apenas nao estava sendo entregue.

## Correcao (PR #5, merge 4e3dfba)

- `sw.js`: `CACHE_NAME` `checkin-cache-v188` -> `checkin-cache-v189` (posteriormente
  `v190` pela correcao de etiquetas do mesmo dia); lista `ASSETS` atualizada.
- `index.html` e `print.html`: `styles.css?v=20261008a` e `app.js?v=20261008a`.
- `tests/service-worker.spec.js`: expectativa do `CACHE_NAME` atualizada.
- `docs/CODEX_CONTEXT.md`: linha de cache atualizada.

O `activate` do SW apaga todos os caches diferentes do atual, entao todo aparelho
que ja tinha a PWA instalada descarta o CSS antigo no proximo carregamento.

## Validacao

- `npm.cmd test`: 216/216.
- Deploy ao vivo verificado em `https://dnms-checkin.pages.dev`: `sw.js` com o
  `CACHE_NAME` novo, index com as `?v=` novas e `styles.css` com a secao
  `15. LAYOUT TOPBAR`.
- Cenario controle sem overflow horizontal em 390px e 1366px.

## Regra permanente

Toda alteracao em `index.html`, `app.js` ou `styles.css` exige bump das
querystrings `?v=` e do `CACHE_NAME` em `sw.js` — mesmo quando `sw.js` nao fizer
parte do diff da PR. Sem o bump, o cache-first entrega o layout antigo sobre o
HTML novo e o celular fica quebrado ate a proxima invalidacao manual.
