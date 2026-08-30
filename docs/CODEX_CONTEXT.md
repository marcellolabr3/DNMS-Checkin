# DNMS-Checkin - Contexto Operacional

Memoria curta para iniciar novas sessoes do Codex. Nao registrar secrets, tokens, Service Role Keys ou connection strings.

## Como Iniciar

1. Ler `AGENTS.md`.
2. Ler este arquivo.
3. Se existir, ler `docs/CODEX_CONTEXT.local.md` apenas para uso local de credenciais; nunca imprimir, copiar ou commitar valores.
4. Rodar `git status --short`.
5. Consultar o codigo atual antes de alterar autenticacao, banco, permissoes, check-in, cadastro, impressao ou integracoes.

Regra deste arquivo: manter como bootstrap operacional curto, ate 80 linhas/700 palavras quando possivel. Atualizar por substituicao, removendo estado antigo em vez de acumular historico.

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
- `supabase/patch_student_age_eligibility.sql` - regra de turma/faixa por virada anual; aniversarios do ano vigente so mudam turma no ano seguinte.
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
- Crianca permanece na mesma turma durante todo o ano vigente mesmo que faca aniversario; a troca de turma ocorre apenas no ano seguinte ao aniversario. Ex.: quem faz 7 anos em 27/12/2026 continua Kids em 2026 e vira Juniors em 2027; quem faz 15 anos em 2026 continua Teens ate 31/12/2026 e sai da faixa em 2027.
- Responsavel faz check-in somente via QR presencial usando RPC `parent_checkin_with_presence`.
- Admin/equipe fazem check-in direto em `checkins`, mas a trigger do banco tambem valida horario.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Cadastro de crianca deve criar vinculo em `student_guardians`; responsavel comum nao pode se vincular automaticamente a crianca fora da familia.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados vindos de usuario/banco devem usar `textContent`, `createElement` ou escape antes de entrar em `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Estado Validado

- Janela de check-in por horario aplicada no app e no Supabase em 2026-08-28.
- `npm.cmd test` passou com 144 testes em 2026-08-30.
- Supabase confirmou `is_room_checkin_window_open`, trigger `prevent_checkin_outside_room_window_trigger` e RPC `parent_checkin_with_presence`.
- Teste de fronteira no Supabase: antes de 30 min bloqueia, 30 min antes libera, durante a aula libera, horario final bloqueia.
- Regra anterior de idade anual foi substituida em 2026-08-30: turma/faixa agora usa a idade completada ate 31/12 do ano anterior; aniversarios no ano vigente so afetam a turma em 1º de janeiro do ano seguinte.
- Impressao local validada: o app mostra Brother offline quando a impressora esta desligada e online quando ligada.
- Check-in real de responsavel com QR presencial funcionou em producao.
- Em 2026-08-29, corrigida inconsistencia visual: crianca com check-in ativo nao deve manter botao "Check-in" clicavel quando a janela da sala ainda nao abriu.
- Em 2026-08-29, saneados 11 check-ins antigos sem checkout de salas fechadas de 2026-08-27; `fetchRooms` agora faz checkout automatico antes de fechar salas vencidas.
- Em 2026-08-30, revisada recuperacao de senha: emails usam redirect com `password_recovery=1`; o app captura recovery antes do `createClient`/`detectSessionInUrl`, escuta `PASSWORD_RECOVERY` e checa recovery antes/depois de `getSession`, evitando abrir o app quando o Supabase consome a URL; forms respondem a submit/Enter e, apos `updateUser({ password })`, o app faz logout, limpa URL de recovery e volta para login.
- Em 2026-08-30, adicionada tolerancia para login logo apos redefinir senha: `hydrateFromSupabase` usa retry na leitura de `profiles` por cerca de 3s antes de acusar perfil ausente, evitando falso "Usuario nao encontrado" enquanto Auth/RLS estabiliza.
- README revisado em 2026-08-30: Melhorias Futuras agora separa keepalive do Supabase como resolvido, CI de testes como pendente, portabilidade/migracao do banco como pendente parcial e auditoria operacional em `audit_logs` como resolvida. Removida observabilidade generica que nao condiz com a arquitetura atual.
- Auditoria para repositorio publico em 2026-08-30: arquivos rastreados e historico sensivel nao indicaram `DATABASE_URL` real, Service Role Key real, chaves privadas ou tokens pessoais. Chaves anon do Supabase e URL do projeto estao no frontend/servico e sao esperadas; manter RLS como barreira. Arquivos `.idea` foram removidos do Git e seguem ignorados.
- Em 2026-08-30, corrigida regra de turma por aniversario e aplicado `supabase/patch_student_age_eligibility.sql` em producao: Arthur Labre/faz 7 em 27/12/2026 permanece Kids em 2026 e vira Juniors em 2027; quem faz 15 em 2026 permanece Teens e fica fora da faixa em 2027. Cache atual: `checkin-cache-v154`, `app.js?v=20260830f`.
- Em 2026-08-30, diagnosticado problema de autoimpressao: servico no notebook recebeu check-ins do celular e marcou `printed_at`, mas o Windows manteve etiquetas presas na fila da Brother. `Servico de impressao/server.js` agora consulta a fila (`printer_queue_length` no `/health`), bloqueia novas impressoes se houver jobs pendentes e so marca `printed_at` depois que a etiqueta sai da fila. Executavel local recompilado; se a fila tiver itens presos, limpar/liberar a fila no Windows antes de novo check-in.
- Em 2026-08-30, corrigida UI de salas: depois de abrir salas em massa, checkboxes/selecionar todas continuam disponiveis para salas visiveis; "Abrir selecionadas" ainda abre apenas salas aptas. Ao fechar sala pelo dialog, a janela fecha automaticamente. Cache atual: `checkin-cache-v155`, `app.js?v=20260830g`.
- Em 2026-08-30, regra de nome de evento/sala: o nome sempre inclui a data curta da propria ocorrencia (`dd/mm`). Se o nome for vazio, usa apenas `dd/mm`; em recorrencia, cada sala recebe sua respectiva data no nome.
- Em 2026-08-30, painel de impressao/reimpressao lista somente check-ins ativos do dia (`checked_out_at is null`); ao fechar sala e fazer checkout automatico, a lista fica limpa. Cache atual: `checkin-cache-v157`, `app.js?v=20260830h`, `print.js?v=20260830a`.
- Em 2026-08-30, diagnostico do notebook: check-in pelo celular depende do listener/polling do `DNMS Impressao` no notebook, nao de `localhost` no celular. `Servico de impressao/server.js` combina WMI + spooler; se WMI marcar offline mas spooler estiver Normal, tenta imprimir e confirma pela fila antes de marcar `printed_at`. Autoimpressao agora busca somente check-ins ativos nao impressos (`printed_at is null` e `checked_out_at is null`), prioriza os recentes e expõe no `/health`/`/status` status do Realtime, ultima varredura, pendentes ativos e fila local.
- `npm.cmd test` passou com 150 testes em 2026-08-30.

## Pendencias

- Prioridade da proxima tarefa: auditar o Supabase de producao e reconstruir/validar `supabase/setup_dnms_checkin.sql` como arquivo canônico detalhado para recriar o banco em outro servico, incluindo tabelas, constraints, indices, RLS, policies, triggers, funcoes/RPCs e dependencias.
- Definir rotina de exportacao/restauracao dos dados reais, incluindo usuarios/perfis/vinculos. Nao expor senhas, tokens ou secrets; para Auth, documentar estrategia segura de migracao compatível com as limitacoes do provedor.
- Validar em producao uma tentativa de cadastro duplicado pelo app.
- Validar recuperacao de senha em producao com link novo e janela anonima; links antigos podem continuar abrindo sessao direto.
- Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.
- Confirmar periodicamente se credenciais administrativas devem permanecer no arquivo local.
