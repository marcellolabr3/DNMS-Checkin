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
- Cache atual: `checkin-cache-v182`, `app.js?v=20260908c`, `print.js?v=20260906b`, `styles.css?v=20260906c`.

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
- `supabase/setup_dnms_checkin.sql` precisa ser mantido como schema canonico para novos ambientes.
- Patches aplicados: `patch_sadmin_test_rooms_clear_checkins.sql` (SADMIN/teste/zerar), `patch_room_checkin_limit_and_age.sql` (limite/idade/check-in), `patch_sync_student_class_names.sql` (sincroniza `students.class_name`).
- Supabase guarda familias, criancas, check-ins, historico, reimpressao e auditoria.
- Conexao local do Print Service com Postgres deve usar pooler Supabase; senha somente em `.codex-secrets.env`.
- SQLite local do Print Service guarda somente estado tecnico: fila, tentativas, timestamps, erros, `windowsJobId`, impressora.
- Backup local do banco criado em 2026-09-01 em `D:\Dev\BCK_CHEK\dnms-supabase-20260901-073529` e `.zip`.

## Print Service

- Fase 1 implementada: `POST /print` e `POST /reprint` enfileiram em SQLite e retornam `202 Accepted`.
- Endpoints: `GET /print/:jobId`, `GET /status`, `GET /health`; token local continua obrigatorio quando configurado.
- `/health` e `/status` exibem diagnosticos operacionais para Brother offline/ausente, fila travada, Chrome/Edge ausente, Sumatra ausente, porta ocupada, token/origem mal configurados e acesso admin ausente.
- Arquivos principais: `Servico de impressao/src/print-job.js`, `job-store.js`, `print-queue.js`, `print-worker.js`, `windows-pdf-print-adapter.js`.
- Autoimpressao e reimpressao remota convergem para o mesmo `PrintWorker`; nao voltar a imprimir por caminhos independentes.
- Impressao normal deduplica por `checkin_id` independentemente da origem (`/print`, listener ou polling) para evitar etiqueta 2x quando frontend desktop e autoimpressao veem o mesmo check-in.
- Retry automatico somente antes de `SENT_TO_SPOOLER`; depois do aceite pelo Windows, falha vira ambigua sem retry para evitar etiqueta duplicada.
- ZIP portable inclui `DNMS Instalar Atualizar.cmd`, `DNMS Validar Instalacao.cmd` e scripts de validacao/atalho; usar o instalador para atualizar, criar atalho e validar pos-start.
- Validacao continua do ambiente real: `DNMS Validacao Continua.cmd` / `scripts/validate-real-environment.ps1` monitoram instalacao, `/health`, Brother, fila, autoimpressao e reimpressao sem imprimir etiqueta por padrao.
- ZIP portable fica em `Servico de impressao/dist-pacote/` como artefato privado. Nao versionar `IMPRESSÂO/DNMS-Servico-de-impressao-portable.zip`; Cloudflare Pages limita arquivo publicado a 25 MiB e o ZIP tem cerca de 38 MiB.

## Ultimo estado validado

- Em 2026-09-08, `npm.cmd test` passou com 198 testes apos consolidar cadastro/exclusao de criancas/usuarios no relatorio `Alteracoes de dados` da aba Log e remover filtros redundantes.
- Em 2026-09-08, `npm.cmd test` passou com 202 testes apos corrigir dedupe de impressao normal por `checkin_id` para evitar duplicidade entre `/print` e autoimpressao.
- Em 2026-09-08, parser PowerShell dos scripts portable, `validate-install.ps1 -Json`, `node --check server.js` e `npm.cmd test` passaram com 198 testes apos polir instalacao/atualizacao Windows.
- Em 2026-09-08, parser PowerShell dos scripts portable, `node --check server.js` e `npm.cmd test` passaram com 198 testes apos criar validacao continua do ambiente real.
- Em 2026-09-08, `node --check server.js` e `npm.cmd test` passaram com 198 testes apos melhorar diagnosticos do servico de impressao.
- Em 2026-09-08, `npm.cmd test` passou com 194 testes apos remover o ZIP versionado que quebrava Cloudflare Pages.
- Em 2026-09-08, `npm.cmd test` passou com 194 testes apos remover o botao "Zerar check-ins de hoje" do Dashboard e manter somente na aba Log.
- Em 2026-09-08, `npm.cmd test` passou com 196 testes; patch de Maternal foi aplicado em producao, 3 criancas de 2024 passaram para `Maternal`, divergencias de `students.class_name` ficaram em 0 e trigger ficou ativo.
- Em 2026-09-08, `npm.cmd test` passou com 198 testes apos cadastro de crianca aceitar `dd/mm/aa` e `dd/mm/aaaa`; ano curto resolve para o seculo atual se nao for futuro, senao para o seculo anterior.
- Em 2026-09-07, patch `patch_room_checkin_limit_and_age.sql` aplicado no Supabase de producao e verificado.
- Em 2026-09-06, validacao no notebook real com Brother conectada passou: `/status`, `/health`, `/print`, `/reprint`, autoimpressao via celular e recuperacao apos reinicio.

## Fila de coisas a fazer

1. Confirmar deploy externo/publicacao apos push para GitHub; este repo nao tem workflow de deploy do app, apenas `.github/workflows/keepalive.yml`.
2. Servico de impressao: painel de jobs recentes mostrando historico local com pendente, imprimindo, enviado ao spooler, falhou e cancelado.
3. Servico de impressao: retry manual seguro somente para jobs que ainda nao chegaram ao spooler; manter `SENT_TO_SPOOLER` sem retry automatico para evitar duplicidade.
4. Servico de impressao: retencao/limpeza do SQLite para remover jobs tecnicos antigos sem apagar dados operacionais do Supabase.
5. Servico de impressao: executar validacao presencial no notebook real com Brother apos gerar novo ZIP/exe, incluindo check-in e reimpressao observados fisicamente.
