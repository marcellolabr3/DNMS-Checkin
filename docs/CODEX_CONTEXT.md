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
- Cache atual: `checkin-cache-v195`, `app.js?v=20261009b`, `styles.css?v=20261008b`, `print.js?v=20261008a`.
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

- Dashboard PWA: KPI "Check-ins hoje" conta registros do dia incluindo salas teste; KPI "Criancas presentes" conta apenas check-ins ativos sem checkout; resumo do evento/log continuam excluindo salas teste conforme regra operacional.
- Arquivos principais recentes: `app.js`, `index.html`, `sw.js`, `tests/checkin.spec.js`.
- Validacao: `node --check app.js` passou; `npm.cmd test -- tests/dashboard.spec.js tests/checkin.spec.js` passou com 130 testes.

## Pendencias reais

1. Print Service: retencao/limpeza do SQLite.
2. Print Service: validar novo ZIP/exe no notebook real com Brother, incluindo check-in e reimpressao fisicos.
