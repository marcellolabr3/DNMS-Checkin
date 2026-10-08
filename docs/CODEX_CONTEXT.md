# DNMS-Checkin - Contexto Operacional

Memoria curta para novas sessoes do Codex. Nao registrar secrets, tokens, Service Role Keys ou connection strings.

## Como iniciar

1. Ler `AGENTS.md`.
2. Ler este arquivo.
3. Se existir, ler `docs/CODEX_CONTEXT.local.md` apenas para uso local; nunca imprimir, copiar ou commitar valores.
4. Rodar `git status --short`.
5. Consultar o codigo atual antes de alterar autenticacao, banco, permissoes, check-in, cadastro, impressao ou integracoes.

## Sistema

- PWA estatico em HTML/CSS/JS puro: `index.html`, `app.js`, `styles.css`, `sw.js`.
- Backend principal: Supabase Auth/Postgres/Storage; sem backend web proprio.
- Servico local de impressao: `Servico de impressao/server.js` em `http://127.0.0.1:3001`, usando Brother QL-810W.
- Auth: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`). SADMIN: `marvinlabre@gmail.com`.
- Cache atual: `checkin-cache-v191`, `app.js?v=20261008c`, `print.js?v=20261008a`, `styles.css?v=20261008b`.
- App nativo (APK/iOS): projeto separado em `D:\Dev\APKCheckin` (Capacitor 8, `com.dnms.checkin`), nao modifica este repositorio. Sincronizar com `sync-web.ps1`, buildar com `build-apk.ps1`; APK versionado em `D:\Dev\APKCheckin\dist` (QR com `qr-apk.ps1`). Estado: build+assinatura ok, CSV corrigido, deep link `dnmscheckin://auth` ativo (Redirect URLs no Supabase) para confirmacao de e-mail/recuperacao dentro do app; falta validar em aparelho (ver `D:\Dev\APKCheckin\CHECKLIST_PRONTO.md`). PWA continua oficial.

## Regras criticas

- Nunca expor secrets; nao colocar Service Role Key no frontend; manter `.env` e `.codex-secrets.env` fora do GitHub.
- Respeitar RLS e preservar dados. Migracoes devem ser nao destrutivas quando possivel.
- Check-in: de 30 min antes do inicio da aula ate antes do fim; responsavel somente via QR presencial/RPC `parent_checkin_with_presence`.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Salas/eventos nascem `Programada`; abertura manual por admin/equipe; salas abertas continuam visiveis para gestao.
- Salas podem ser marcadas como teste somente por SADMIN; check-ins dessas salas nao entram em relatorios operacionais e nao disparam autoimpressao.
- Turma/faixa etaria usa progressao anual: Maternal no ano em que completa 2, 3 e 4 anos; Kids 5, 6 e 7; Juniors 8, 9, 10 e 11; Teens 12, 13, 14 e 15. Aniversario nao troca turma no meio do ano, exceto entrada inicial no Maternal a partir do aniversario de 2 anos. Mudancas de ciclo ocorrem no ano seguinte.
- Presenca atual nao e cumulativa: considerar o ultimo estado valido por crianca/aula; check-in aberto (`checked_out_at is null`) = presente, checkout = ausente. Historico de check-in/checkout permanece preservado.
- Salas aceitam `max_checkins` opcional; `null` significa sem limite. Check-in deve ser bloqueado quando a sala atinge a capacidade.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`, mesmo quando `sw.js` nao mudar no diff (ver `docs/CORRECAO_CACHE_LAYOUT_MOBILE_2026-10-08.md`).
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Banco e operacao

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `temporary_room_assignments`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- `supabase/setup_dnms_checkin.sql` precisa ser mantido como schema canonico para novos ambientes.
- Patches aplicados: `patch_sadmin_test_rooms_clear_checkins.sql` (SADMIN/teste/zerar), `patch_room_checkin_limit_and_age.sql` (limite/idade/check-in), `patch_sync_student_class_names.sql` (sincroniza `students.class_name`), `patch_ministry_year_class_age.sql` (regra anterior), `patch_class_cutoff_presence_state.sql` (regra anterior e presenca ativa), `patch_official_class_and_temporary_room_assignments.sql` (turma oficial e alocacao temporaria), `patch_annual_class_progression.sql` (progressao anual vigente).
- Supabase guarda familias, criancas, check-ins, historico, reimpressao e auditoria.
- Conexao local do Print Service com Postgres deve usar pooler Supabase; senha somente em `.codex-secrets.env`.
- SQLite local do Print Service guarda somente estado tecnico: fila, tentativas, timestamps, erros, `windowsJobId`, impressora.
- Backup local do banco criado em 2026-09-01 em `D:\Dev\BCK_CHEK\dnms-supabase-20260901-073529` e `.zip`.

## Print Service

- Fonte unica do servico de impressao: `Servico de impressao/`; a pasta antiga `IMPRESSAO`/`IMPRESSAO` foi removida.
- Fase 1 implementada: `POST /print` e `POST /reprint` enfileiram em SQLite e retornam `202 Accepted`.
- Endpoints: `GET /print/:jobId`, `POST /print/:jobId/retry`, `GET /status`, `GET /health`; token local obrigatorio quando configurado.
- Arquivos principais: `Servico de impressao/src/print-job.js`, `job-store.js`, `print-queue.js`, `print-worker.js`, `windows-pdf-print-adapter.js`.
- Autoimpressao e reimpressao remota convergem para `PrintWorker`; dedupe por `checkin_id`; retry automatico/manual somente antes de `SENT_TO_SPOOLER`.
- Portable: `scripts/package-portable.ps1` gera `Servico de impressao/dist-pacote/DNMS-Servico-de-impressao-portable.zip`; validar com `DNMS Validacao Continua.cmd` / `scripts/validate-real-environment.ps1`.
- ZIP/exe/binarios sao artefatos privados e ignorados; nao versionar porque Cloudflare Pages limita arquivo publicado a 25 MiB.

## Ultimo estado validado

- Em 2026-10-08, menu mobile e tema escuro corrigidos: o nav do topo passou a
  linha unica rolavel em 390px (4 linhas -> 1; nav 158px -> 41px), chips neutros
  com destaque so no ativo (Gestao/Log agora marcam `primary`), campo "QR de
  check-in presencial" com `var(--card)` e tintas fixas (contraste 1.15:1 ->
  >= 4.5:1) e `var(--text)`/`var(--border)` (inexistentes) eliminados de
  `styles.css`/`print.html`. Novo teste de regressao em
  `tests/menu-mobile-tema.spec.js`; cache `checkin-cache-v191`,
  `styles.css?v=20261008b`, `app.js?v=20261008c`. `npm.cmd test` passou com
  224 testes. Diagnostico completo em
  `docs/CORRECAO_MENU_MOBILE_TEMA_GESTAO_2026-10-08.md`.
- Em 2026-10-08, layout mobile corrigido: o service worker nao tinha sido alterado na repaginada e seguia servindo o CSS antigo (cache-first v188) com o HTML novo por cima, causando imagens gigantes e overflow horizontal no celular. Bump de `CACHE_NAME` e `?v=` (PR #5), validado com 216 testes e deploy conferido; diagnostico completo em `docs/CORRECAO_CACHE_LAYOUT_MOBILE_2026-10-08.md`.
- Em 2026-10-08, etiquetas/reimpressao passaram a resolver turma efetiva na impressao: alocacao temporaria da sala tem prioridade, depois turma oficial atual do aluno, e por fim snapshot antigo do check-in. Arquivos principais: `app.js`, `print.js`, `Servico de impressao/server.js`; cache atualizado para `checkin-cache-v190`. `node --check` em `app.js`, `print.js` e `Servico de impressao/server.js` passou; `npm.cmd test` passou com 216 testes.
- Em 2026-09-29, regra de classificacao substituida por progressao anual. Patch `patch_annual_class_progression.sql` aplicado em producao apos backup `D:\Dev\BCK_CHEK\dnms-annual-class-backup-20260929-120128.json`; validacao SQL confirmou: antes dos 2 anos fica fora, no aniversario de 2 entra em Maternal, anos de 4/7/11/15 permanecem na turma, e a mudanca ocorre em 01/01 do ano seguinte. Frontend atualizado para `checkin-cache-v188`/`app.js?v=20260929a`. `npm.cmd test` passou com 216 testes.
- Em 2026-09-08, `node --check server.js` e `npm.cmd test -- tests/print-service.spec.js` passaram apos adicionar painel de jobs recentes e retry manual seguro antes do spooler.
- Em 2026-09-06, validacao no notebook real com Brother conectada passou: `/status`, `/health`, `/print`, `/reprint`, autoimpressao via celular e recuperacao apos reinicio.

## Fila de coisas a fazer

1. Servico de impressao: retencao/limpeza do SQLite e melhoria nao critica; impacta crescimento do arquivo local e performance futura do historico, mas nao bloqueia operacao atual.
2. Servico de impressao: executar validacao presencial no notebook real com Brother apos gerar novo ZIP/exe, incluindo check-in e reimpressao observados fisicamente.
