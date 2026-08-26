# DNMS-Checkin - Contexto Atual

> Este arquivo e a memoria operacional do projeto para novas sessoes do Codex.
> Deve permanecer curto, factual e atualizado.
> Nao registrar secrets, tokens, Service Role Keys ou connection strings em texto claro.

## Estado atual

Ultima atualizacao:
2026-08-25

Branch atual:
`main`

Ultimo commit relevante:
Correcao da exportacao CSV do Log.

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
`patch_prevent_duplicate_students.sql` foi aplicado diretamente no Supabase em 2026-08-24. Depois, `patch_duplicate_students_scope_guardian.sql` foi aplicado em 2026-08-24 para reduzir falso positivo entre familias diferentes. Em 2026-08-24, `patch_backfill_student_guardian_links.sql` inseriu 1 vinculo ausente em `student_guardians`; verificacao posterior encontrou 0 criancas sem vinculo. Em 2026-08-24, `patch_audit_logs.sql` foi aplicado no Supabase porque `public.audit_logs` nao existia em producao; em seguida foram inseridos 2 eventos `child_created` de recuperacao para criancas cadastradas no dia antes da tabela existir.

---

## O que foi concluido recentemente

- Criada fila de reimpressao remota para imprimir pela Brother quando pedido vier de celular/outro dispositivo.
- Implementado bloqueio de duplicidade de criancas no app e no banco.
- Ajustada regra de duplicidade para permitir outra crianca/familia com mesmo nome+nascimento, mas bloquear duplicidade para o mesmo responsavel.
- Adicionado overlay "Salvando crianca..." para evitar multiplos cliques.
- Corrigido upload de foto de crianca para responsavel/admin: o app guarda o ultimo arquivo escolhido, limpa o input alternativo camera/galeria, valida arquivo vazio e envia Blob normalizado ao Supabase Storage.
- Sprint 1 de seguranca do DOM: dados de usuarios/criancas/salas/escalas/etiquetas interpolados em HTML passaram a usar escape antes de renderizar; `print.js` tambem passou a escapar dados da etiqueta/reimpressao.
- Sprint 2 de service worker seguro: cache restrito a assets estaticos locais; Supabase, Google Sheets, CDN e servico local de impressao nao devem ser interceptados/cacheados pelo SW.
- Sprint 3 de protecao do servico local de impressao: servico passa a escutar em `127.0.0.1` por padrao, aceita token/origens por configuracao opcional e valida payloads HTTP de `/print` e `/reprint`.
- Sprint 4 de performance: cargas principais do Supabase em `app.js` passaram a usar colunas explicitas em vez de `select("*")`, reduzindo payload sem mudar fluxo de telas.
- Sprint 5 de performance: biblioteca XLSX removida do carregamento inicial e carregada sob demanda apenas para importacao Excel ou sincronizacao Google Sheets.
- Sprint 6 de assets PWA: `logo-loading.png` foi substituido por icones reais 192x192 e 512x512 no HTML, manifest e service worker; cache atualizado para `checkin-cache-v122`.
- Correcao do Log: ao abrir o painel de Log, periodo inicial passa a ser hoje quando `De`/`Ate` estao vazios; `setup_dnms_checkin.sql` agora inclui `audit_logs`, indices e policies do patch de auditoria para novos ambientes.
- Correcao de exportacao CSV: arquivos de Log/Familias agora usam BOM UTF-8, separador `;`, CRLF, limpeza de caracteres de controle/quebras dentro das celulas e ordenacao mais previsivel para planilhas em pt-BR.
- Sprint 2 de Mensagens/Avisos: popup removido e substituido por painel navegavel `#tipsCard`, com badge de nao lidas, envio/leitura/exclusao preservados e testes Playwright adicionados.
- Sprint 3 de Mensagens/Avisos: Dashboard recebeu bloco `#dashboardTips` com ate 5 mensagens recentes e atalho para o painel completo.
- Sprint 4 de Mensagens/Avisos: estados de vazio/carregando/erro, retry, texto longo sem overflow e ajustes mobile/acessibilidade.
- Criados `AGENTS.md` e `docs/CODEX_CONTEXT.md`.
- Commits enviados ao GitHub: `a4962aa` e `5a947e8`.

---

## O que esta sendo desenvolvido agora

Objetivo atual:
Incidente de impressao e duplicidades de criancas.

Arquivos envolvidos:

- `supabase/patch_reprint_queue.sql`
- `Servico de impressao/server.js`
- `Servico de impressao/README.md`
- `docs/CODEX_CONTEXT.md`

Estado:
Em 2026-08-25, o app reportou: `Falha ao solicitar reimpressao remota: Could not find the table 'public.print_jobs' in the schema cache`. Verificacao direta no banco mostrou que `public.print_jobs` e `public.claim_next_reprint_job(text)` nao existiam em producao. O patch idempotente `supabase/patch_reprint_queue.sql` foi aplicado diretamente no Supabase e o schema cache foi recarregado com `notify pgrst, 'reload schema'`. Validacao via PostgREST confirmou que `print_jobs` ja e reconhecida pela API.

Diagnostico local da impressao: ha processo `Servico-de-impressao.exe` rodando em `127.0.0.1:3001`, mas `/health` retorna 503 porque o Windows nao lista nenhuma impressora com nome contendo `BROTHER QL-810W`. Impressoras visiveis no momento eram HP/OneNote/XPS/PDF/Fax. O executavel em `Servico de impressao/dist/Servico-de-impressao.exe` e de 2026-08-21, anterior ao `server.js` atual de 2026-08-24; para usar fila de reimpressao remota pelo servico, recriar/reiniciar pacote atualizado. Nao foi encontrado `.codex-secrets.env` do servico com `SUPABASE_SERVICE_ROLE_KEY`; sem Service Role o auto-print de check-ins feitos em celular/outro computador nao opera corretamente.

Atualizacao posterior em 2026-08-25: usuario reportou que check-in pelo celular imprimiu etiqueta com dados em branco. O banco mostrou que os check-ins recentes tinham dados preenchidos e estavam marcados como impressos. Foi reforcado `Servico de impressao/server.js` para nao imprimir auto-print/reprint se faltarem dados minimos da etiqueta (`nome`, `turma`, `responsavel`) e para usar fallback de turma/observacao do cadastro da crianca quando snapshots do check-in estiverem vazios. `Servico de impressao/README.md` documenta que Service Role e necessaria para auto-impressao confiavel de outro dispositivo.

Atualizacao em 2026-08-25: usuario reportou que check-in pelo celular nao imprimia. Diagnostico mostrou o `.exe` rodando versao antiga com `/health` em `supabase_role: anon`, sem `database_direct`. O executavel foi recriado com `npm.cmd run build:exe`, o servico foi reiniciado, e `/health` passou a retornar `supabase_role: postgres_direct`, `database_direct: true`, `auto_print_polling: true` e `reprint_queue_polling: true`. Verificacao posterior encontrou 0 check-ins pendentes das ultimas 24h com `printed_at is null`.

Atualizacao em 2026-08-25: iniciador `Iniciar Servico de impressao.cmd`/`scripts/start-service-ui.ps1` foi ajustado para sempre exibir icone na area de notificacao do Windows, mesmo quando o servico ja estiver rodando na porta 3001. O menu do icone permite abrir `/health` e encerrar o servico. Para uso normal no PC da Brother, iniciar pelo `.cmd`, nao pelo `.exe` direto.

O executavel local foi recriado com `npm.cmd run build:exe` e o servico foi reiniciado. `/health` passou a retornar `ok: true`, `target_printer: Brother QL-810W`, `auto_print_listener: true`, `auto_print_polling: true`, `supabase_role: anon`, `reprint_queue_listener: false`. Pendentes das ultimas 24h ficaram zerados (`printed_at is null` = 0). Ainda falta configurar Service Role local para processar `print_jobs` de reimpressao remota.

Validacao:
Banco: `print_jobs` existe, RLS esta ativo, 3 policies existem, indices existem e `claim_next_reprint_job(text)` existe. API Supabase ja reconhece a tabela. Apos reiniciar servico atualizado, existem 0 check-ins das ultimas 24h com `printed_at is null`. `npm.cmd test` passou com 120 testes.

Duplicidades: usuario reportou criancas duplicadas na lista de alunos. Leitura agregada em producao encontrou 2 grupos por nome normalizado + nascimento, envolvendo 4 registros, e 0 vinculos duplicados em `student_guardians`. Isso sugere registros duplicados reais, nao duplicacao simples por vinculo repetido, mas nao fazer merge/exclusao sem revisar IDs, responsaveis, check-ins e confirmar com o usuario.

Plano sugerido:

1. Impressao: configurar Service Role local no servico para fila de reimpressao remota, reiniciar, testar `/health`, novo check-in pelo celular e reimpressao.
2. Duplicidades: gerar relatorio seguro dos grupos duplicados, revisar responsaveis/check-ins, propor plano de merge preservando historico.
3. Depois de qualquer correcao: atualizar contexto, testar e commitar/pushar alteracoes versionadas quando houver.

Proxima sprint:
Resolver reimpressao remota: preencher `.codex-secrets.env` local do servico com `SUPABASE_SERVICE_ROLE_KEY`, reiniciar, confirmar `/health` com `supabase_role: service_role` e `reprint_queue_listener: true`, e testar fila `print_jobs`.

---

## Decisoes importantes

- Nao gravar secrets em arquivos versionados, mesmo quando fornecidos no chat. Motivo: reduzir risco de vazamento e preservar seguranca do projeto.
- Ao concluir alteracao validada, documentar em `docs/CODEX_CONTEXT.md`, fazer commit local e enviar para o GitHub com `git push origin main`. Motivo: permitir teste da aplicacao publicada e rollback por commit se houver erro.
- Nao acumular commits locais sem push. Antes de iniciar nova alteracao, confirmar que `main` esta alinhada com `origin/main` ou avisar o usuario. Motivo: evitar que varias mudancas sejam publicadas juntas e dificultem rollback/teste.
- Todo commit de alteracao deve incluir a documentacao operacional correspondente no mesmo commit, preferencialmente em `docs/CODEX_CONTEXT.md`. Motivo: manter codigo, decisao, pendencias e rollback sincronizados.
- Duplicidade automatica deve ser bloqueada por crianca + mesmo responsavel. Motivo: evitar falso positivo entre familias diferentes sem vincular automaticamente uma pessoa a crianca existente.
- Responsavel comum nao pode se vincular automaticamente a crianca existente. Motivo: seguranca familiar e privacidade.
- Lista do responsavel deve unir criancas vinculadas em `student_guardians` e criancas cujo `primary_guardian_name` seja o nome da sessao. Motivo: preservar visibilidade de registros legados com vinculo ausente.
- Criancas podem ter mais de um responsavel em `student_guardians`; a UI deve considerar todos os IDs vinculados para Familias, permissoes e duplicidade. `students.primary_guardian_name` representa apenas o responsavel principal/legado.
- Cadastro novo deve criar o vinculo em `student_guardians` imediatamente apos inserir a crianca e antes de upload de foto/auditoria. Motivo: evitar crianca sem responsavel quando etapas posteriores falham.
- Criacao de eventos usa checkboxes de turma para selecionar uma ou varias turmas; recorrencia usa opcoes de 1 a 6 meses, calculadas como 4 semanas por mes. Edicao individual de sala continua exigindo apenas uma turma.
- Lista de salas mostra somente eventos nao fechados de hoje em diante e agrupa por mes em blocos recolhiveis. Salas abertas com data passada sao fechadas ao carregar eventos.
- Logo da tela "Carregando sessao" deve manter rotacao ativa tambem quando o navegador sinaliza movimento reduzido; nesse caso a animacao fica mais lenta, nao desligada.
- Ao alterar HTML/CSS/JS do PWA, atualizar querystrings de assets em `index.html` e o `CACHE_NAME`/assets em `sw.js`. Motivo: evitar service worker servindo JS/CSS antigo com tela nova.
- Dados vindos de usuario/banco nao devem ser interpolados diretamente em `innerHTML`; usar `textContent`, `createElement` ou helpers de escape antes de montar markup. Motivo: evitar XSS/injecao visual sem depender apenas de validacao de entrada.
- Service worker deve interceptar/cachear apenas assets estaticos locais explicitamente listados; chamadas Supabase/Google Sheets/CDN/localhost e rotas dinamicas devem seguir direto pela rede. Motivo: evitar dados obsoletos, cache entre sessoes e comportamento inconsistente em producao.
- Servico local de impressao deve escutar apenas em localhost por padrao e pode exigir `PRINT_SERVICE_TOKEN` + `PRINT_ALLOWED_ORIGINS`; o token local do navegador fica em `localStorage["dnms_print_service_token"]`, nunca em arquivo versionado. Motivo: reduzir abuso de `localhost:3001` por paginas externas sem quebrar modo legado.
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
Trigger novo bloqueia novos duplicados para o mesmo responsavel, mas nao faz merge automatico de registros legados. Em 2026-08-25, leitura agregada encontrou 2 grupos por nome normalizado + nascimento, envolvendo 4 registros, e 0 vinculos duplicados em `student_guardians`.

Status:
ABERTO. Revisao/merge deve ser manual ou por rotina planejada com backup e confirmacao do usuario.

### 3. Impressao local indisponivel

Impacto:
Check-ins/reimpressoes nao imprimem enquanto a Brother nao estiver visivel no Windows ou enquanto o servico estiver sem configuracao adequada.

Status:
PARCIAL. `print_jobs` foi criado em producao em 2026-08-25 e o erro de schema cache foi resolvido. Executavel local foi recriado e `/health` retorna `ok: true` com Brother QL-810W. Pendencia local: nao ha `.codex-secrets.env` com Service Role, entao `reprint_queue_listener` segue `false`.

---

## Pendencias

Prioridade alta:

- [ ] Confirmar periodicamente se credenciais administrativas ainda devem permanecer no arquivo local.

Prioridade media:

- [ ] Quando a Brother/PC de impressao estiver disponivel, testar Sprint 3 fisicamente: health em `http://localhost:3001/health`, check-in no proprio PC, reimpressao local, reimpressao via celular/fila, e opcionalmente fluxo com `PRINT_SERVICE_TOKEN` configurado.
- [ ] Quando a Brother/PC de impressao estiver disponivel, testar reimpressao real pelo celular apos Sprint 2: solicitar reimpressao, confirmar job em `print_jobs` e confirmar impressao pelo servico local. Observacao: testes automatizados validaram que o service worker nao intercepta/cacheia Supabase/localhost, mas nao houve teste fisico por impressora indisponivel.
- [x] Reinstalar/reconectar Brother QL-810W no Windows ate aparecer em `Get-Printer` e `/health` retornar `ok: true`.
- [x] Recriar/reiniciar `Servico-de-impressao.exe` a partir do `server.js` atual.
- [ ] Configurar `.codex-secrets.env` local com Service Role para usar reimpressao remota por `print_jobs`.
- [ ] Validar em producao uma tentativa de cadastro duplicado pelo app.
- [ ] Avaliar relatorio de duplicidades antigas por nome normalizado + nascimento.
- [ ] Documentar fluxo futuro para equipe/admin tratar possiveis homonimos e vinculos de responsaveis.
- [ ] Avaliar se os filtros do Log devem ser renomeados/expandidos: "Exclusoes de usuarios" hoje nao inclui `child_deleted`, e "Alteracoes de dados" inclui abertura/fechamento de sala alem de alteracoes cadastrais.
- [ ] Confirmar com o usuario os nomes corretos das criancas ja gravadas como `De An ...` antes de qualquer ajuste manual no banco.

Prioridade baixa:

- [ ] Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.

---

## Proximo passo recomendado

Primeiro configurar Service Role local do servico e validar `/health` com `supabase_role: service_role` e `reprint_queue_listener: true`; depois testar reimpressao remota. Em seguida investigar duplicidades com relatorio detalhado antes de qualquer merge.

---

## Ultima sessao

Foi feito:
Incidente de impressao investigado. `print_jobs`/`claim_next_reprint_job` estavam ausentes em producao; `supabase/patch_reprint_queue.sql` foi aplicado e a API ja reconhece a tabela. Etiqueta em branco reportada apos check-in pelo celular; `server.js` agora bloqueia auto-print quando faltam dados minimos e usa fallbacks do cadastro. Executavel local foi recriado e servico reiniciado com Brother QL-810W visivel.

Ficou funcionando:
Erro de schema cache de `print_jobs` resolvido no banco/API. `/health` retorna `ok: true` com Brother QL-810W. Pendentes recentes de impressao foram zerados. `npm.cmd test` passou com 120 testes.

Ficou pendente:
Configurar Service Role local para fila remota; testar novo check-in pelo celular e reimpressao remota. Duplicidades: ha 2 grupos agregados suspeitos envolvendo 4 registros; revisar detalhes e confirmar com usuario antes de merge/exclusao.

Para continuar em uma nova sessao, comecar por:
Ler `AGENTS.md`, ler este arquivo, ler `docs/CODEX_CONTEXT.local.md` se existir, e rodar `git status --short`.
