# Correcao: menu mobile desorganizado e campo da Gestao ilegivel no tema escuro (2026-10-08)

## Sintomas

1. No celular, o menu do topo (9 botoes para SADMIN) quebrava em **4 linhas
   irregulares** (3+2+3+1), com o nav ocupando **158px** e o header **271px** —
   quase um terco da tela so de navegacao.
2. No tema escuro, o primeiro campo da aba Gestao ("QR de check-in
   presencial") ficava com o texto **quase invisivel** (contraste medido de
   **1.15:1**, exigencia WCAG AA = 4.5:1).
3. Os chips do menu pintavam de **verde** no tema escuro (`body.theme-dark .ghost`)
   e imprimicao/sair ja nasciam coloridos (ambar/vermelho) em repouso.
4. Gestao e Log nunca ganhavam o estado ativo (`primary`) — o usuario nao via
   qual painel estava aberto.

## Causa raiz

- **Menu**: `.main-nav` usava `flex-wrap: wrap` sem limite de linhas; em 390px
  os 9 chips nao cabiam e quebravam em 4 linhas. O `.brand .subtitle` tambem
  consumia uma linha extra no celular.
- **Campo Gestao**: `.presence-qr-panel` tinha `background: #fff` fixo por cima
  do `--card` do tema, e tres regras usavam variaveis CSS **inexistentes**:
  - `styles.css` 1403/1410/1431: `var(--border)` (o projeto define `--stroke`);
  - `styles.css` 1433/1453 e `print.html` 165/239: `var(--text)` (o projeto
    define `--ink`).
  Sem definicao, `var()` resolve para a initial value (transparente/preto
  incomportavel), gerando texto claro sobre branco no dark theme.
- **Chips coloridos**: `body.theme-dark .ghost` (spec 0,2,1) pintava todos os
  botoes do nav de verde; nao havia escopo `.main-nav` neutro.
- **Estado ativo**: `updateHeaderPanelButtons()` so acompanhava 5 botoes;
  `#btnInvitePanel` ("invite") e `#btnLogPanel` ("log") ficavam sempre `ghost`.

## Correcao

- `styles.css` (camada **15.10**, no fim do arquivo, claramente marcada):
  - chips neutros nos dois temas (`color: var(--muted)`, fundo/borda
    transparentes, peso 600), com `body.theme-dark .main-nav ...` vencendo a
    especificidade de `body.theme-dark .ghost`;
  - hover semantico preservado: ambar na impressao, vermelho no sair (regras
    escuras explicitas, pois base escura vence hover claro);
  - `@media (max-width: 720px)`: `.main-nav` com `flex-wrap: nowrap`,
    `overflow-x: auto` (barra fina), `width: 100%` (o header e coluna) e
    botoes `flex: 0 0 auto` — menu em **linha unica rolavel**;
  - `.brand .subtitle` oculto no celular (igual ao preview aprovado).
- `styles.css` (regras da 15.2/QR): `.presence-qr-panel` passa a usar
  `background: var(--card)`; bordas `var(--border)` -> `var(--stroke)`; a area
  de impressao do QR mantem papel branco com tintas fixas escuras
  (`#16241d`/`#5b6b64`), pois e sempre impressa em claro.
- `print.html`: `var(--text)` -> `var(--ink)` (2 ocorrencias; print.html nunca
  recebe `theme-dark`, entao `--ink` fica escuro sempre).
- `app.js`: `updateHeaderPanelButtons()` agora acompanha `btnLogPanel`
  (`active === "log"`) e `btnInvitePanel` (`active === "invite"`), e chama
  `revealActiveNavButton()` (scroll horizontal do nav para o chip ativo, so
  quando o painel ativo muda e so se o nav realmente rola).

## Bumps de versao (obrigatorio — regra do cache)

- `styles.css?v=20261008a` -> `20261008b` (index.html e print.html, e no
  `ASSETS` do sw.js).
- `app.js?v=20261008b` -> `20261008c` (index.html e sw.js).
- `CACHE_NAME` `checkin-cache-v190` -> `checkin-cache-v191`.
- `tests/service-worker.spec.js` e `docs/CODEX_CONTEXT.md` atualizados.

## Testes de regressao novos (`tests/menu-mobile-tema.spec.js`)

1. **Variavel CSS indefinida**: varredura estatica de `styles.css`,
   `index.html` e `print.html` comparando definicoes (`--x:`) com usos
   (`var(--x)` sem fallback) — impede qualquer nova `var(--border)`/`var(--text)`.
2. **Menu em linha unica**: viewport 390x844 como SADMIN — nav com exatamente
   1 linha de botoes, `scrollWidth > clientWidth` (rolavel), altura <= 60px e
   sem overflow horizontal na pagina.
3. **Chip ativo**: Gestao e Log ganham `primary` (e o nav rolavel revela o
   chip ativo); os demais voltam a `ghost`.
4. **Contraste do QR**: painel `#presenceQrCard` com razao >= 4.5:1 entre texto
   e fundo nos temas claro e escuro (resumo e area de impressao).

## Validacao

- `node --check` em `app.js` e `sw.js`: OK.
- `npm.cmd test`: **224/224** (216 anteriores + 8 novos).
- Diagnostico Playwright em 390px (SADMIN): menu **1 linha** (antes 4),
  nav **41px** (antes 158px), header **154px** (antes 271px); sem overflow
  horizontal. Chips neutros nos dois temas (`--muted`), ativo com accent.
- Contraste do campo QR no dark: texto `rgb(233,241,237)` sobre painel
  `rgb(20,29,26)` (antes 1.15:1 sobre branco).

## Observacao

Testes no aparelho real (celular/tablet) continuam sendo do responsavel do
usuario — a validacao aqui e no Playwright com viewport movel.
