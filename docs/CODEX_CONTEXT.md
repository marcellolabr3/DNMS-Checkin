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
- Cache atual no trabalho em aberto: `checkin-cache-v193`, `app.js?v=20261008e`, `styles.css?v=20261008b`, `print.js?v=20261008a`.
- App nativo (APK/iOS): projeto separado em `D:\Dev\APKCheckin`; nao modificar este repositorio para tarefas do APK.

## Regras criticas

- Nunca expor secrets; nao colocar Service Role Key no frontend; manter `.env` e `.codex-secrets.env` fora do GitHub.
- Respeitar RLS e preservar dados. Migracoes devem ser nao destrutivas quando possivel.
- Check-in: de 30 min antes do inicio da aula ate antes do fim; responsavel somente via QR presencial/RPC `parent_checkin_with_presence`.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Salas/eventos nascem `Programada`; abertura manual por admin/equipe; salas abertas continuam visiveis para gestao.
- Salas teste somente por SADMIN; check-ins dessas salas nao entram em relatorios operacionais e nao disparam autoimpressao.
- Turma/faixa etaria usa progressao anual: Maternal 2-4, Kids 5-7, Juniors 8-11, Teens 12-15. Aniversario nao troca turma no meio do ano, exceto entrada inicial no Maternal a partir dos 2 anos.
- Presenca atual nao e cumulativa: ultimo estado valido por crianca/aula; check-in aberto = presente, checkout = ausente.
- Salas aceitam `max_checkins` opcional; `null` significa sem limite.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Banco e operacao

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `temporary_room_assignments`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- `supabase/setup_dnms_checkin.sql` e o schema canonico para novos ambientes.
- Patches importantes: `patch_sadmin_test_rooms_clear_checkins.sql`, `patch_room_checkin_limit_and_age.sql`, `patch_sync_student_class_names.sql`, `patch_official_class_and_temporary_room_assignments.sql`, `patch_annual_class_progression.sql`.
- Print Service usa Postgres via pooler Supabase e SQLite local apenas para estado tecnico da fila. Senhas somente em `.codex-secrets.env`.

## Ultimo estado validado

- Em 2026-10-08, foi implementada a area `Extracao` abaixo do conteudo do Log para SADMIN/Admin. Permite extrair todas as criancas, por turma (`Maternal`, `Kids`, `Juniors`, `Teens`, `Fora da faixa`, `Indefinida`) ou por selecao manual, incluindo criancas fora da faixa. Saidas: Excel (`Exportar Excel`, abas `Resumo` e `Criancas`) e compartilhamento por WhatsApp (`Enviar WhatsApp`). Campos exportados: nome, nascimento, turma efetiva, classificacao automatica, turma oficial, responsavel principal, telefone, endereco, observacoes, visitante e responsaveis vinculados.
- Arquivos alterados nesta entrega: `app.js`, `index.html`, `sw.js`, `tests/checkin.spec.js`, `tests/service-worker.spec.js`. Nao houve migracao de banco.
- Validacao executada: `node --check app.js` passou; `npm.cmd test` passou com 228 testes.

## Fila de coisas a fazer

1. Servico de impressao: retencao/limpeza do SQLite e melhoria nao critica.
2. Servico de impressao: validar presencialmente novo ZIP/exe no notebook real com Brother, incluindo check-in e reimpressao fisicos.
