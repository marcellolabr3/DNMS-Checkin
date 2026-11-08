# DNMS-Checkin - Contexto Operacional

Bootstrap curto para novas sessoes. Nunca registrar secrets, tokens, Service Role Keys ou connection strings.

## Inicio obrigatorio

1. Ler `AGENTS.md`.
2. Ler este arquivo.
3. Se existir, ler `docs/CODEX_CONTEXT.local.md` somente para uso local; nunca imprimir nem commitar.
4. Rodar `git status --short`.
5. Antes de alterar auth, banco, permissoes, check-in, cadastro, impressao ou integracoes, consultar o codigo atual.

## Arquitetura

- PWA estatico: `index.html`, `app.js`, `styles.css`, `sw.js`.
- Backend: Supabase Auth/Postgres/Storage; nao ha backend web proprio.
- Print Service local: `Servico de impressao/server.js` em `http://127.0.0.1:3001`, Brother QL-810W.
- Auth/roles: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`). SADMIN: `marvinlabre@gmail.com`.
- Cache atual: `checkin-cache-v201`, `app.js?v=20261108d`, `log-center.js?v=20261108c`, `styles.css?v=20261108d`, `print.js?v=20261008a`.
- App nativo separado: `D:\Dev\APKCheckin`; nao modificar este repo para tarefas do APK.

## Regras criticas

- Nunca expor secrets; nao usar Service Role Key no frontend; manter `.env` e `.codex-secrets.env` fora do Git.
- Preservar RLS e dados; migracoes devem ser nao destrutivas quando possivel.
- Check-in: 30 min antes do inicio ate antes do fim; responsavel somente via QR presencial/RPC `parent_checkin_with_presence`.
- Maximo um check-in ativo por crianca (`checked_out_at is null`).
- Salas nascem `Programada`, abertura manual por admin/equipe; salas teste somente por SADMIN e fora dos relatorios/autoimpressao.
- Turma por progressao anual: Maternal 2-4, Kids 5-7, Juniors 8-11, Teens 12-15; aniversario nao troca turma no meio do ano, exceto entrada inicial no Maternal aos 2.
- Presenca atual: ultimo estado valido por crianca/aula; check-in aberto = presente, checkout = ausente.
- `max_checkins = null` significa sem limite.
- Ao alterar HTML/CSS/JS, atualizar querystring em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Banco e operacao

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `temporary_room_assignments`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- Schema canonico: `supabase/setup_dnms_checkin.sql`.
- Patches importantes: `patch_sadmin_test_rooms_clear_checkins.sql`, `patch_room_checkin_limit_and_age.sql`, `patch_sync_student_class_names.sql`, `patch_official_class_and_temporary_room_assignments.sql`, `patch_annual_class_progression.sql`.
- Print Service usa Postgres via pooler Supabase e SQLite local so para estado tecnico da fila.

## Estado validado

- Log: seletor unico para relatorios, responsaveis e filhos, cadastros, troca de classe, consultas e backups JSON (global/especifico, SADMIN). Familias apenas encaminha a busca ao Log; CSV/Excel/JSON mantem vinculos e permissoes de equipe/admin. RPCs: `supabase/patch_log_data_center.sql`; frontend: `log-center.js`; restauracao: `scripts/restore-log-backup.cjs` e `docs/LOG_DATA_CENTER.md`. Snapshots completos, RLS preservada; backups incluem contas/MFA e arquivos com SHA-256, nao infraestrutura. Respostas atrasadas e Excel de criancas agora recusam sessao alterada. `PLAYWRIGHT_BASE_URL` permite testar o frontend publicado com fixtures, sem alterar producao.
- Validacao: 276 testes locais passaram em desktop/mobile, com fixtures Supabase, incluindo os novos cards e regressao geral. Log publicado v200 ja validado com 264 testes, Excel real e checksums; quatro RPCs recusam anonimo (401). Sem credenciais locais para repetir testes autenticados reais. Validacao anterior (v199): login e exportacoes reais, 145 arquivos e restauracao com rollback; conta temporaria removida.

- Dashboard: quatro cards clicaveis: Presentes agora (ultimo estado por crianca/sala hoje, sem checkout), Visitantes do dia (flag `is_visitor` + check-in hoje, incluindo quem saiu, sem duplicar), Criancas com observacao (presentes com `notes` preenchido) e Salas abertas (abre Salas com filtro Somente abertas). Tres listas usam dialog compacto e cadastro existente; texto escapado, atualizacao com dados da tela e limpeza ao trocar sessao. Acesso somente admin/equipe; salas teste preservam regras anteriores. Filtro de salas permite voltar a abertas/programadas e limita selecao em lote aos itens visiveis. Mobile 2x2; temas claro/escuro. Sem alteracao de banco.
- Print Service: Chromium continua persistente/pre-aquecido; impressao usa modo rapido apos aceite no spooler (`PRINT_FAST_SPOOLER_MODE=true`) e cache curto do status da Brother (`PRINTER_STATUS_CACHE_TTL_MS=3000`); instalador portable cria atalho de inicializacao do Windows.
- Arquivos principais recentes: `app.js`, `index.html`, `sw.js`, `tests/checkin.spec.js`, `Servico de impressao/server.js`, `Servico de impressao/src/windows-pdf-print-adapter.js`, `Servico de impressao/scripts/install-portable.ps1`.
- Validacao: `node --check app.js`, `node --check "Servico de impressao/server.js"`, `node --check "Servico de impressao/src/windows-pdf-print-adapter.js"` passaram; `npm.cmd test -- tests/print-service.spec.js tests/print-worker.spec.js` passou com 16 testes.

## Pendencias reais

1. Print Service: retencao/limpeza do SQLite.
2. Print Service: gerar novo ZIP/exe e validar no notebook real com Brother, incluindo check-in, reimpressao, tempo ate inicio fisico e inicializacao com Windows.
