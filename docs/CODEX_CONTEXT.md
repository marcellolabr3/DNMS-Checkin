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
`c50b463 Require guardian link on child creation`

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
Nao armazenar no repositorio. Se existir, novas sessoes devem ler `docs/CODEX_CONTEXT.local.md` para credenciais locais. Esse arquivo e ignorado pelo git e nunca deve ser commitado. Ao usar credenciais, carregar em variavel temporaria de ambiente e nao imprimir valores.

---

## Fluxos principais

### Cadastro

Cadastro de responsavel usa Supabase Auth e cria/sincroniza `profiles`. Responsavel exige telefone. Admin/SADMIN gerenciam usuarios no painel de familias/gestao.

### Login

Login via Supabase Auth. A sessao carrega perfil em `profiles`; usuario autenticado sem perfil valido e bloqueado/logout para evitar recriacao indevida.

### Cadastro de criancas

Formulario em `studentDialog`, salvo por `saveStudent` em `app.js`. O app normaliza nome, valida data, calcula turma e vincula responsavel em `student_guardians`.

Regra atual de seguranca: crianca nao deve ser duplicada dentro da mesma familia/responsavel. Novo cadastro e bloqueado quando ja existe outra ficha com mesmo nome normalizado + mesma data de nascimento + mesmo responsavel principal. Responsavel comum nao ganha vinculo automatico com crianca existente; ajuste de responsaveis deve ser feito por equipe/admin.

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
- `docs/CODEX_CONTEXT.local.md` - credenciais/notas locais, ignorado pelo git, nao commitado.
- `app.js` - logica principal do PWA, autenticacao, cadastro, check-in, permissoes e UI.
- `index.html` - estrutura dos dialogs/formularios.
- `styles.css` - estilos do app, incluindo overlay de salvamento.
- `print.html` / `print.js` - painel de impressao/reimpressao.
- `Servico de impressao/server.js` - API local de impressao e consumidores Supabase.
- `supabase/setup_dnms_checkin.sql` - schema completo esperado.
- `supabase/patch_prevent_duplicate_students.sql` - trigger contra duplicidade de criancas.
- `supabase/patch_duplicate_students_scope_guardian.sql` - ajusta escopo da duplicidade para mesmo responsavel.
- `supabase/patch_backfill_student_guardian_links.sql` - repara vinculos ausentes entre criancas e responsaveis por nome normalizado.
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
- `patch_duplicate_students_scope_guardian.sql` - ajusta trigger para bloquear duplicidade por nome + nascimento + responsavel principal, evitando falso positivo entre familias diferentes.
- `patch_backfill_student_guardian_links.sql` - insere vinculos ausentes quando `students.primary_guardian_name` bate com um perfil `responsavel`.
- `patch_checkin_active_guard.sql` - garante um check-in ativo por crianca.
- `patch_delete_user_account.sql` - exclusao completa de usuario/perfil/vinculos conforme regras.

Estado do banco:
`patch_prevent_duplicate_students.sql` foi aplicado diretamente no Supabase em 2026-08-24. Depois, `patch_duplicate_students_scope_guardian.sql` foi aplicado em 2026-08-24 para reduzir falso positivo entre familias diferentes. Em 2026-08-24, `patch_backfill_student_guardian_links.sql` inseriu 1 vinculo ausente em `student_guardians`; verificacao posterior encontrou 0 criancas sem vinculo.

---

## O que foi concluido recentemente

- Criada fila de reimpressao remota para imprimir pela Brother quando pedido vier de celular/outro dispositivo.
- Implementado bloqueio de duplicidade de criancas no app e no banco.
- Ajustada regra de duplicidade para permitir outra crianca/familia com mesmo nome+nascimento, mas bloquear duplicidade para o mesmo responsavel.
- Adicionado overlay "Salvando crianca..." para evitar multiplos cliques.
- Corrigido upload de foto de crianca para responsavel/admin: o app guarda o ultimo arquivo escolhido, limpa o input alternativo camera/galeria, valida arquivo vazio e envia Blob normalizado ao Supabase Storage.
- Criados `AGENTS.md` e `docs/CODEX_CONTEXT.md`.
- Commits enviados ao GitHub: `a4962aa` e `5a947e8`.

---

## O que esta sendo desenvolvido agora

Objetivo atual:
Trocar seletor de turmas da criacao de salas por checkboxes de selecao multipla.

Arquivos envolvidos:

- `app.js`
- `index.html`
- `styles.css`
- `tests/checkin.spec.js`
- `docs/CODEX_CONTEXT.md`

Estado:
Implementado no app, validado com testes locais e commitado.

---

## Decisoes importantes

- Nao gravar secrets em arquivos versionados, mesmo quando fornecidos no chat. Motivo: reduzir risco de vazamento e preservar seguranca do projeto.
- Ao concluir alteracao validada, documentar em `docs/CODEX_CONTEXT.md`, fazer commit local e enviar para o GitHub com `git push origin main`. Motivo: permitir teste da aplicacao publicada e rollback por commit se houver erro.
- Nao acumular commits locais sem push. Antes de iniciar nova alteracao, confirmar que `main` esta alinhada com `origin/main` ou avisar o usuario. Motivo: evitar que varias mudancas sejam publicadas juntas e dificultem rollback/teste.
- Todo commit de alteracao deve incluir a documentacao operacional correspondente no mesmo commit, preferencialmente em `docs/CODEX_CONTEXT.md`. Motivo: manter codigo, decisao, pendencias e rollback sincronizados.
- Duplicidade automatica deve ser bloqueada por crianca + mesmo responsavel. Motivo: evitar falso positivo entre familias diferentes sem vincular automaticamente uma pessoa a crianca existente.
- Responsavel comum nao pode se vincular automaticamente a crianca existente. Motivo: seguranca familiar e privacidade.
- Lista do responsavel deve unir criancas vinculadas em `student_guardians` e criancas cujo `primary_guardian_name` seja o nome da sessao. Motivo: preservar visibilidade de registros legados com vinculo ausente.
- Cadastro novo deve criar o vinculo em `student_guardians` imediatamente apos inserir a crianca e antes de upload de foto/auditoria. Motivo: evitar crianca sem responsavel quando etapas posteriores falham.
- Criacao de eventos usa checkboxes de turma para selecionar uma ou varias turmas; recorrencia usa opcoes de 1 a 6 meses, calculadas como 4 semanas por mes. Edicao individual de sala continua exigindo apenas uma turma.
- Logo da tela "Carregando sessao" deve manter rotacao ativa tambem quando o navegador sinaliza movimento reduzido; nesse caso a animacao fica mais lenta, nao desligada.
- Regras sensiveis precisam existir no banco e no frontend. Motivo: evitar bypass por concorrencia, clique duplo ou outro cliente.
- Preservar fluxos de check-in/impressao existentes. Motivo: sistema esta operacional em producao.

Nao reverter estas decisoes sem antes analisar impacto.

---

## Problemas conhecidos

### 1. Credenciais administrativas locais

Impacto:
Credenciais permitem alteracoes diretas no banco quando usadas corretamente.

Status:
CONTORNADO. Manter em `docs/CODEX_CONTEXT.local.md`, ignorado pelo git, sem expor valores em respostas.

### 2. Possiveis duplicidades antigas de criancas

Impacto:
Trigger novo bloqueia novos duplicados para o mesmo responsavel, mas nao faz merge automatico de registros legados.

Status:
ABERTO. Revisao/merge deve ser manual ou por rotina planejada com backup.

---

## Pendencias

Prioridade alta:

- [ ] Confirmar periodicamente se credenciais administrativas ainda devem permanecer no arquivo local.

Prioridade media:

- [ ] Validar em producao uma tentativa de cadastro duplicado pelo app.
- [ ] Avaliar relatorio de duplicidades antigas por nome normalizado + nascimento.
- [ ] Documentar fluxo futuro para equipe/admin tratar possiveis homonimos e vinculos de responsaveis.

Prioridade baixa:

- [ ] Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.

---

## Proximo passo recomendado

Publicar e validar no app a criacao de salas com duas ou mais turmas marcadas.

---

## Ultima sessao

Foi feito:
Substituido o `select multiple` de turmas por checkboxes explicitos para Maternal, Kids, Juniors e Teens.

Ficou funcionando:
Criacao de eventos em lote continua criando combinacoes de turmas marcadas e recorrencia mensal; spec de check-in passou em desktop e mobile.

Ficou pendente:
Push/publicacao da correcao de checkboxes de turmas, se aprovado.

Para continuar em uma nova sessao, comecar por:
Ler `AGENTS.md`, ler este arquivo, ler `docs/CODEX_CONTEXT.local.md` se existir, e rodar `git status --short`.
