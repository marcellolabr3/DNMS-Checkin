# DNMS-Checkin - Contexto Atual

Memoria operacional curta para novas sessoes do Codex.
Nao registrar secrets, tokens, Service Role Keys ou connection strings em texto claro.

## Estado

- Ultima atualizacao: 2026-08-28
- Branch: `main`
- App: PWA estatico em HTML/CSS/JS puro (`index.html`, `app.js`, `styles.css`, `sw.js`)
- Backend principal: Supabase Auth/Postgres/Storage; sem backend web proprio
- Servico auxiliar: `Servico de impressao/server.js` para Brother QL-810W local
- Banco: Supabase Postgres, schema `public`
- Autenticacao: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`)
- SADMIN: `marvinlabre@gmail.com` em funcoes administrativas

## Credenciais e Supabase

- Credenciais administrativas locais podem existir em `docs/CODEX_CONTEXT.local.md`.
- Esse arquivo local e ignorado pelo git, nunca deve ser commitado e nunca deve ter valores copiados para respostas, logs ou diffs.
- Para aplicar SQL direto no Supabase, carregar a credencial local em variavel temporaria de ambiente sem imprimir o valor.
- Nunca colocar Service Role Key ou `DATABASE_URL` no frontend.
- Respeitar RLS; nao desabilitar seguranca para fazer uma funcionalidade funcionar.

## Banco de dados

Tabelas principais:

- `profiles`
- `students`
- `student_guardians`
- `rooms`
- `checkins`
- `audit_logs`
- `print_jobs`
- `schedules`
- `tips`
- `tip_reads`
- `family_link_requests`
- `app_settings`

Arquivos SQL importantes:

- `supabase/setup_dnms_checkin.sql` - schema consolidado esperado para novos ambientes
- `supabase/patch_reprint_queue.sql` - fila de reimpressao remota
- `supabase/patch_family_network.sql` - rede familiar de responsaveis
- `supabase/patch_family_link_requests.sql` - convite interno para vinculo familiar
- `supabase/patch_admin_family_network_management.sql` - gestao admin da rede familiar
- `supabase/patch_parent_checkin_presence_qr.sql` - QR presencial para responsavel
- `supabase/patch_checkin_active_guard.sql` - um check-in ativo por crianca
- `supabase/patch_checkin_time_window.sql` - limita check-in ao horario da aula; aplicado em producao em 2026-08-28

Estado conhecido do banco:

- `print_jobs` e RPC `claim_next_reprint_job(text)` existem em producao.
- RLS esta ativo nas tabelas principais.
- QR fixo presencial usa `app_settings.parent_checkin_presence_sha256` e RPC `parent_checkin_with_presence`.
- Rede familiar usa `profiles.family_id`, `student_guardians`, `family_link_requests` e RPCs de vinculo/aceite.
- Duplicidades antigas conhecidas Paula/Diego foram consolidadas em 2026-08-27; verificacao posterior encontrou 0 grupos duplicados.

## Fluxos sensiveis

- Check-in grava em `checkins`.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Responsavel faz check-in somente via QR presencial: frontend chama `parent_checkin_with_presence(student_id, presence_token)`.
- Admin/equipe fazem check-in direto em `checkins`.
- Check-out atualiza `checked_out_at`.
- Fechamento de sala faz checkout automatico dos alunos ativos daquela sala.
- Cadastro de crianca cria/sincroniza vinculo em `student_guardians`; responsavel comum nao deve ganhar vinculo automatico com crianca existente fora da familia.
- Impressao local usa `http://localhost:3001/print` ou `/reprint`; check-ins remotos podem ser impressos pelo servico local via Supabase/polling.

## Decisoes importantes

- Regras sensiveis precisam existir no frontend e no banco.
- Ao alterar HTML/CSS/JS do PWA, atualizar querystrings de assets em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados vindos de usuario/banco nao devem ser interpolados diretamente em `innerHTML` sem escape.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.
- Preservar fluxos de check-in/impressao existentes; sistema esta operacional em producao.
- Ao concluir alteracao validada, atualizar este contexto, commitar e enviar para `origin/main`.

## Tarefa atual

Problema:
O app ainda permite check-in depois do horario de termino da aula quando a sala permanece aberta.

Regra desejada:
Check-in so pode acontecer de 30 minutos antes do inicio da aula ate antes do horario de termino da aula. Quando chegar o horario final, nao pode mais fazer check-in, mesmo que a sala ainda esteja aberta.

Arquivos ja alterados na worktree:

- `app.js`
- `index.html`
- `sw.js`
- `supabase/setup_dnms_checkin.sql`
- `supabase/patch_checkin_time_window.sql`
- `tests/checkin.spec.js`
- `tests/fixtures/mockSupabase.js`

Estado:

- Implementacao concluida no frontend com `CHECKIN_EARLY_WINDOW_MINUTES`, `getCheckinWindowValidation`, `getRoomCheckinWindow` e escolha de sala aberta somente se estiver dentro da janela.
- `handleManualCheckin` bloqueia antes/depois da janela no cliente.
- `supabase/patch_checkin_time_window.sql` cria `is_room_checkin_window_open`, trigger `prevent_checkin_outside_room_window_trigger` em `checkins` e atualiza `parent_checkin_with_presence`.
- `supabase/setup_dnms_checkin.sql` foi alinhado ao patch.
- `index.html` usa `app.js?v=20260828c`/`styles.css?v=20260828c`; `sw.js` usa `checkin-cache-v145`.
- Patch SQL aplicado em producao em 2026-08-28.
- Verificacao direta no Supabase confirmou funcao, trigger, RPC e fronteiras: antes de 30 min bloqueia, 30 min antes libera, durante a aula libera, horario final bloqueia.
- Testes direcionados passaram: `npm.cmd test -- tests/checkin.spec.js tests/service-worker.spec.js` com 62 testes.
- Suite completa passou: `npm.cmd test` com 140 testes.
- Commit/push feitos em `d1f8677` (`Bloqueia check-in fora do horario da aula`).

## Validacoes recentes

- Mensagens/Avisos: botao de retorno para responsavel/admin foi implementado e testado antes desta tarefa.
- Impressao local: em 2026-08-27 `/health` retornou operacional com Brother QL-810W, `postgres_direct`, `database_direct` e fila por polling.
- QR presencial: patch aplicado em producao em 2026-08-27 e testes direcionados passaram.

## Pendencias

- Validar com check-in real no celular do responsavel usando QR presencial.
- Validar em producao uma tentativa de cadastro duplicado pelo app.
- Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.
- Confirmar periodicamente se credenciais administrativas ainda devem permanecer no arquivo local.

## Proximo passo recomendado

Validar em producao/celular um check-in real de responsavel usando QR presencial e a nova janela de horario.
