# DNMS-Checkin - Contexto Operacional

Memoria curta para iniciar novas sessoes do Codex. Nao registrar secrets, tokens, Service Role Keys ou connection strings.

## Como Iniciar

1. Ler `AGENTS.md`.
2. Ler este arquivo.
3. Se existir, ler `docs/CODEX_CONTEXT.local.md` apenas para uso local de credenciais; nunca imprimir, copiar ou commitar valores.
4. Rodar `git status --short`.
5. Consultar o codigo atual antes de alterar autenticacao, banco, permissoes, check-in, cadastro, impressao ou integracoes.

## Sistema

- App: PWA estatico em HTML/CSS/JS puro (`index.html`, `app.js`, `styles.css`, `sw.js`).
- Backend principal: Supabase Auth/Postgres/Storage; sem backend web proprio.
- Banco: Supabase Postgres, schema `public`.
- Servico local: `Servico de impressao/server.js` para Brother QL-810W em `http://127.0.0.1:3001`.
- Auth: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`).
- SADMIN: `marvinlabre@gmail.com`.

## Banco e SQL

Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.

Arquivos SQL importantes:

- `supabase/setup_dnms_checkin.sql` - schema consolidado para novos ambientes.
- `supabase/patch_checkin_time_window.sql` - aplicado em producao em 2026-08-28; bloqueia check-in fora da janela da aula.
- `supabase/patch_parent_checkin_presence_qr.sql` - QR presencial para responsavel.
- `supabase/patch_checkin_active_guard.sql` - um check-in ativo por crianca.
- `supabase/patch_reprint_queue.sql` - fila de reimpressao remota.
- `supabase/patch_family_network.sql`, `supabase/patch_family_link_requests.sql`, `supabase/patch_admin_family_network_management.sql` - rede familiar.

Credenciais:

- `docs/CODEX_CONTEXT.local.md` pode conter `DATABASE_URL` de producao.
- Usar credenciais somente em variavel temporaria de ambiente.
- Nunca colocar credenciais no frontend, logs, respostas, commits ou diffs.
- Nao desabilitar RLS.

## Regras Criticas

- Regras sensiveis devem existir no frontend e no banco.
- Check-in permitido somente de 30 min antes do inicio da aula ate antes do horario de termino.
- Responsavel faz check-in somente via QR presencial usando RPC `parent_checkin_with_presence`.
- Admin/equipe fazem check-in direto em `checkins`, mas a trigger do banco tambem valida horario.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Cadastro de crianca deve criar vinculo em `student_guardians`; responsavel comum nao pode se vincular automaticamente a crianca fora da familia.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados vindos de usuario/banco devem usar `textContent`, `createElement` ou escape antes de entrar em `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Estado Validado

- Ultimo commit enviado: `95623bf Atualiza contexto apos janela de check-in`.
- Correcao da janela de check-in enviada em `d1f8677 Bloqueia check-in fora do horario da aula`.
- `npm.cmd test` passou com 140 testes em 2026-08-28.
- Supabase confirmou `is_room_checkin_window_open`, trigger `prevent_checkin_outside_room_window_trigger` e RPC `parent_checkin_with_presence`.
- Teste de fronteira no Supabase: antes de 30 min bloqueia, 30 min antes libera, durante a aula libera, horario final bloqueia.
- Em 2026-08-28, `/health` do servico local encontrou Brother QL-810W instalada, mas offline no Windows (`WorkOffline: true`, `printer_ready: false`).

## Pendencias

- Colocar a Brother QL-810W online no Windows antes de depender de impressao local.
- Validar em producao/celular um check-in real de responsavel usando QR presencial e janela de horario.
- Validar em producao uma tentativa de cadastro duplicado pelo app.
- Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.
- Confirmar periodicamente se credenciais administrativas devem permanecer no arquivo local.
