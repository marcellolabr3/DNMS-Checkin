# DNMS-Checkin - Contexto Atual

> Este arquivo e a memoria operacional do projeto para novas sessoes do Codex.
> Deve permanecer curto, factual e atualizado.
> Nao registrar secrets, tokens, Service Role Keys ou connection strings em texto claro.

## Estado atual

Ultima atualizacao:
2026-08-24

Branch atual:
`main`

Ultimo commit relevante:
`5a947e8 Add Codex project instructions`

Status geral:
ESTAVEL / EM DESENVOLVIMENTO

---

## Arquitetura atual

Frontend:
PWA estatico em HTML/CSS/JS puro (`index.html`, `app.js`, `styles.css`, `sw.js`).

Backend:
Sem backend web proprio para o app principal; dados via Supabase. Servico local Node.js separado para impressao Brother.

Banco:
Supabase Postgres, schema `public`.

Autenticacao:
Supabase Auth com perfis em `profiles` e regras por `role` (`admin`, `equipe`, `responsavel`, `dnms_kids`). `marvinlabre@gmail.com` tratado como SADMIN em funcoes de gestao.

Hospedagem:
PWA estatico. Confirmar plataforma atual antes de alterar deploy.

Servicos externos:
Supabase Auth/Postgres/Storage, Brother QL-810W via servico local, SumatraPDF, Puppeteer, Google Sheets para escalas quando configurado.

Credenciais:
Nao armazenar no repositorio. Quando precisar aplicar SQL direto, usar credencial fornecida pelo usuario somente em variavel temporaria de ambiente ou input seguro. A connection string foi compartilhada no chat desta sessao; recomenda-se rotacionar a senha depois das alteracoes.

---

## Fluxos principais

### Cadastro

Cadastro de responsavel usa Supabase Auth e cria/sincroniza `profiles`. Responsavel exige telefone. Admin/SADMIN gerenciam usuarios no painel de familias/gestao.

### Login

Login via Supabase Auth. A sessao carrega perfil em `profiles`; usuario autenticado sem perfil valido e bloqueado/logout para evitar recriacao indevida.

### Cadastro de criancas

Formulario em `studentDialog`, salvo por `saveStudent` em `app.js`. O app normaliza nome, valida data, calcula turma e vincula responsavel em `student_guardians`.

Regra atual de seguranca: crianca e ficha unica. Novo cadastro e bloqueado quando ja existe outra ficha com mesmo nome normalizado + mesma data de nascimento, independentemente do responsavel. Responsavel comum nao ganha vinculo automatico com crianca existente; ajuste de responsaveis deve ser feito por equipe/admin.

Ao salvar, a UI exibe overlay "Salvando crianca..." e desabilita campos/botoes para evitar clique duplo.

### Check-in

Check-in grava em `checkins`. Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`). O app registra log de auditoria quando aplicavel.

### Check-out

Checkout atualiza `checked_out_at`. Fechamento de sala faz checkout automatico dos alunos ativos daquela sala.

### Impressao

No PC da Brother, PWA chama `http://localhost:3001/print` ou `/reprint`. Para check-ins feitos em celular/outro dispositivo, o servico local escuta Supabase e imprime pendentes com `printed_at is null`. Reimpressao remota usa fila `print_jobs`.

---

## Arquivos importantes

- `AGENTS.md` - instrucoes persistentes obrigatorias para Codex.
- `docs/CODEX_CONTEXT.md` - memoria operacional curta entre sessoes.
- `app.js` - logica principal do PWA, autenticacao, cadastro, check-in, permissoes e UI.
- `index.html` - estrutura dos dialogs/formularios.
- `styles.css` - estilos do app, incluindo overlay de salvamento.
- `print.html` / `print.js` - painel de impressao/reimpressao.
- `Servico de impressao/server.js` - API local de impressao e consumidores Supabase.
- `supabase/setup_dnms_checkin.sql` - schema completo esperado.
- `supabase/patch_prevent_duplicate_students.sql` - trigger contra duplicidade de criancas.
- `supabase/patch_reprint_queue.sql` - fila de reimpressao remota.
- `tests/checkin.spec.js` - testes principais de cadastro/check-in.

---

## Banco de dados

Tabelas importantes:

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

RLS:
Habilitado nas tabelas principais. Nao desabilitar RLS para implementar funcionalidade. Respeitar policies por perfil e vinculos em `student_guardians`.

Migracoes recentes:

- `patch_reprint_queue.sql` - cria `print_jobs` e RPC `claim_next_reprint_job` para reimpressao remota.
- `patch_prevent_duplicate_students.sql` - cria normalizacao e trigger para bloquear crianca duplicada por nome + nascimento.
- `patch_checkin_active_guard.sql` - garante um check-in ativo por crianca.
- `patch_delete_user_account.sql` - exclusao completa de usuario/perfil/vinculos conforme regras.

Estado do banco:
`patch_prevent_duplicate_students.sql` foi aplicado diretamente no Supabase em 2026-08-24 e o trigger `prevent_duplicate_student_for_guardian_trigger` foi confirmado em `public.students`.

---

## O que foi concluido recentemente

- Criada fila de reimpressao remota para imprimir pela Brother quando pedido vier de celular/outro dispositivo.
- Implementado bloqueio de duplicidade de criancas no app e no banco.
- Adicionado overlay "Salvando crianca..." para evitar multiplos cliques.
- Criados `AGENTS.md` e `docs/CODEX_CONTEXT.md`.
- Commits enviados ao GitHub: `a4962aa` e `5a947e8`.

---

## O que esta sendo desenvolvido agora

Objetivo atual:
Manter contexto operacional seguro e atualizado para proximas sessoes.

Arquivos envolvidos:

- `AGENTS.md`
- `docs/CODEX_CONTEXT.md`

Estado:
Contexto sendo atualizado. Nao ha mudanca funcional de codigo nesta etapa.

---

## Decisoes importantes

- Nao gravar secrets em arquivos versionados, mesmo quando fornecidos no chat. Motivo: reduzir risco de vazamento e preservar seguranca do projeto.
- Crianca e ficha unica; responsaveis sao vinculos. Motivo: evitar duplicidade e acesso indevido por cadastro repetido.
- Responsavel comum nao pode se vincular automaticamente a crianca existente. Motivo: seguranca familiar e privacidade.
- Regras sensiveis precisam existir no banco e no frontend. Motivo: evitar bypass por concorrencia, clique duplo ou outro cliente.
- Preservar fluxos de check-in/impressao existentes. Motivo: sistema esta operacional em producao.

Nao reverter estas decisoes sem antes analisar impacto.

---

## Problemas conhecidos

### 1. Connection string foi compartilhada no chat

Impacto:
Segredo sensivel ficou no historico da conversa.

Status:
ABERTO. Recomenda-se rotacionar a senha do banco no Supabase.

### 2. Possiveis duplicidades antigas de criancas

Impacto:
Trigger novo bloqueia novos duplicados, mas nao faz merge automatico de registros legados.

Status:
ABERTO. Revisao/merge deve ser manual ou por rotina planejada com backup.

---

## Pendencias

Prioridade alta:

- [ ] Rotacionar a senha do banco compartilhada nesta sessao.

Prioridade media:

- [ ] Validar em producao uma tentativa de cadastro duplicado pelo app.
- [ ] Avaliar relatorio de duplicidades antigas por nome normalizado + nascimento.

Prioridade baixa:

- [ ] Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.

---

## Proximo passo recomendado

Rotacionar a senha do banco no Supabase e validar que o app continua funcionando com as credenciais atualizadas.

---

## Ultima sessao

Foi feito:
Criada e aplicada protecao contra cadastro duplicado de criancas, adicionada UI de salvamento, testes, documentacao e instrucoes persistentes.

Ficou funcionando:
App bloqueia cadastro duplicado por nome + nascimento; banco possui trigger confirmado; GitHub recebeu os commits `a4962aa` e `5a947e8`.

Ficou pendente:
Rotacionar senha do banco compartilhada no chat e validar duplicidade em producao pelo app.

Para continuar em uma nova sessao, comecar por:
Ler `AGENTS.md`, ler este arquivo, rodar `git status --short` e confirmar se a senha do banco ja foi rotacionada.
