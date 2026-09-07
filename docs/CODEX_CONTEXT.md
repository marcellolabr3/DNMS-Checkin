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
- Cache atual: `checkin-cache-v177`, `app.js?v=20260907a`, `print.js?v=20260906b`, `styles.css?v=20260906c`.

## Regras criticas

- Nunca expor secrets; nao colocar Service Role Key no frontend; manter `.env` e `.codex-secrets.env` fora do GitHub.
- Respeitar RLS e preservar dados. Migracoes devem ser nao destrutivas quando possivel.
- Check-in: de 30 min antes do inicio da aula ate antes do fim; responsavel somente via QR presencial/RPC `parent_checkin_with_presence`.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Salas/eventos nascem `Programada`; abertura manual por admin/equipe; salas abertas continuam visiveis para gestao.
- Salas podem ser marcadas como teste somente por SADMIN; check-ins dessas salas nao entram em relatorios operacionais e nao disparam autoimpressao.
- Salas aceitam `max_checkins` opcional; `null` significa sem limite. Check-in deve ser bloqueado quando a sala atinge a capacidade.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Banco e operacao

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- `supabase/setup_dnms_checkin.sql` precisa ser auditado/reconstruido como schema canonico para novos ambientes.
- Patch aplicado em producao em 2026-09-06: `supabase/patch_sadmin_test_rooms_clear_checkins.sql` adiciona `rooms.is_test`, trigger SADMIN e RPC `sadmin_clear_today_checkins`.
- Patch aplicado em producao em 2026-09-07: `supabase/patch_room_checkin_limit_and_age.sql` adiciona `rooms.max_checkins`, bloqueio server-side de capacidade e corrige regra de idade para aniversario completo.
- Supabase guarda familias, criancas, check-ins, historico, reimpressoes e auditoria.
- Conexao local do Print Service com Postgres deve usar o pooler Supabase `aws-1-us-east-1.pooler.supabase.com:5432/postgres` com usuario `postgres.<project-ref>`; senha somente em `.codex-secrets.env`.
- SQLite local do Print Service guarda somente estado tecnico: fila, tentativas, timestamps, erros, `windowsJobId`, impressora.
- Backup local do banco criado em 2026-09-01 em `D:\Dev\BCK_CHEK\dnms-supabase-20260901-073529` e `.zip`.

## Print Service

- Fase 1 implementada: `POST /print` e `POST /reprint` validam, persistem `PrintJob` em SQLite e respondem rapido com `202 Accepted` e `{ success, jobId, status }`.
- Endpoints disponiveis: `GET /print/:jobId`, `GET /status`, `GET /health`; token local continua obrigatorio quando configurado.
- Arquivos principais: `Servico de impressao/src/print-job.js`, `job-store.js`, `print-queue.js`, `print-worker.js`, `windows-pdf-print-adapter.js`.
- SQLite padrao: `Servico de impressao/data/print-service.sqlite`; sobrescrevivel por `PRINT_JOB_DB_PATH`; pasta/arquivos SQLite ignorados pelo Git.
- Autoimpressao e reimpressao remota convergem para o mesmo `PrintWorker`; nao devem voltar a imprimir diretamente por caminhos independentes.
- PWA/painel local consultam `GET /print/:jobId` apos enfileirar e exibem status operacional: `QUEUED`, `PRINTING`, `SENT_TO_SPOOLER`, `SPOOLER_DONE`, `FAILED`, `CANCELLED`.
- `PrintWorker` processa 1 job por vez, marca `SENT_TO_SPOOLER` apos aceite do adapter e `SPOOLER_DONE` quando o spooler remove o job.
- Retry automatico somente antes de `SENT_TO_SPOOLER`; depois do aceite pelo Windows, falha vira ambigua sem retry para evitar etiqueta duplicada.
- Recuperacao apos reinicio: jobs `PRINTING` voltam para `QUEUED`; jobs `SENT_TO_SPOOLER` viram `FAILED` com `completedReason = "spooler_status_ambiguous_no_retry"` para nao ficarem abertos nem serem reenfileirados automaticamente.
- Mecanismo preservado: Chromium/Puppeteer persistente com nova Page por job, PDF, Sumatra, Windows Spooler, Brother QL-810W.
- ZIP portable: `Servico de impressao/dist-pacote/DNMS-Servico-de-impressao-portable.zip`. O script inclui `.codex-secrets.env` no pacote quando o arquivo local existe; tratar o ZIP como artefato privado.
- SQLite no `.exe` usa binding nativo externo em `dist/native/sqlite3/node_sqlite3.node`; se faltar, o portable falha com "could not locate the bindings file".

## Ultimo estado validado

- Em 2026-09-07, `npm.cmd test` passou com 190 testes apos ajustar WhatsApp/relatorio, idade Maternal por aniversario completo, botao de zerar check-ins no Log e limite de check-ins por sala.
- Em 2026-09-07, patch `supabase/patch_room_checkin_limit_and_age.sql` aplicado no Supabase de producao e verificado: coluna, constraint, trigger e crianca com 2 anos completos retornando `Maternal`.
- Em 2026-09-05, `npm.cmd run build:exe` passou; houve apenas aviso nao fatal conhecido do `pkg` sobre bytecode de `.d.ts`.
- Em 2026-09-05, `npm.cmd run package:portable` regenerou o ZIP portable apos incluir o binding nativo do SQLite no pacote.
- Smoke test do `.exe`/portable em porta temporaria respondeu `/status`, criou SQLite e confirmou fila local; nenhuma impressao foi enviada.
- Em 2026-09-06, validacao no notebook real com Brother conectada passou: `/status`, `/health`, `/print`, `/reprint`, autoimpressao via celular e recuperacao apos reinicio.
- A conexao do Print Service com o banco passou a funcionar corretamente usando o pooler Supabase no `.codex-secrets.env`.
- Em 2026-09-06, log de alteracoes de cadastro passou a registrar campos alterados de responsaveis e criancas em `details`/`metadata.changes`.

## Pendencias reais

- Validar em producao via PWA com usuario SADMIN: limite de sala, crianca de 2 anos no Maternal, botao de zerar no Log e visibilidade de sala teste apos atualizacao de cache.
- Auditar Supabase/producao e `setup_dnms_checkin.sql`; limpar fotos orfas do Storage.
- Validar cadastro duplicado e recuperacao de senha em ambiente real; documentar ajuste operacional de responsaveis.
- Impressao: proxima fase e robustez operacional, com listagem de jobs recentes, retry manual seguro antes do spooler, retention do SQLite e diagnostico mais claro de impressora/fila externa.
