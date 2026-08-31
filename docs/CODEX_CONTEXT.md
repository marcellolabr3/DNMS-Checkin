# DNMS-Checkin - Contexto Operacional

Memoria curta para novas sessoes do Codex. Nao registrar secrets, tokens, Service Role Keys ou connection strings.

## Como Iniciar

1. Ler `AGENTS.md`.
2. Ler este arquivo.
3. Se existir, ler `docs/CODEX_CONTEXT.local.md` apenas para uso local; nunca imprimir, copiar ou commitar valores.
4. Rodar `git status --short`.
5. Consultar o codigo atual antes de alterar autenticacao, banco, permissoes, check-in, cadastro, impressao ou integracoes.

## Sistema

- PWA estatico em HTML/CSS/JS puro: `index.html`, `app.js`, `styles.css`, `sw.js`.
- Backend principal: Supabase Auth/Postgres/Storage; sem backend web proprio.
- Servico local de impressao: `Servico de impressao/server.js` para Brother QL-810W em `http://127.0.0.1:3001`.
- Auth: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`).
- SADMIN: `marvinlabre@gmail.com`.

## Banco e SQL

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- `supabase/setup_dnms_checkin.sql` deve ser reconstruido/validado como schema canonico para novos ambientes.
- Patches importantes aplicados/esperados: janela de check-in, QR presencial de responsavel, um check-in ativo por crianca, idade anual por virada de ano, fila de reimpressao, rede familiar, exclusao segura de usuario e checkout antes de deletar sala.
- Credencial administrativa pode existir em `docs/CODEX_CONTEXT.local.md`; usar somente em variavel temporaria e nunca expor.

## Regras Criticas

- Regras sensiveis devem existir no frontend e no banco; nao desabilitar RLS.
- Check-in permitido somente de 30 min antes do inicio da aula ate antes do horario de termino.
- Crianca permanece na mesma turma durante todo o ano vigente mesmo que faca aniversario; troca apenas em 1 de janeiro do ano seguinte.
- Responsavel faz check-in somente via QR presencial usando RPC `parent_checkin_with_presence`.
- Admin/equipe fazem check-in direto em `checkins`, mas a trigger do banco tambem valida horario.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Cadastro de crianca deve criar vinculo em `student_guardians`; responsavel comum nao pode se vincular automaticamente a crianca fora da familia.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de entrar em `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Estado Validado

- `npm.cmd test` passou com 152 testes em 2026-08-30 antes da estabilizacao operacional.
- Janela de check-in e regra de idade anual foram aplicadas no app e no Supabase; fronteiras de horario foram validadas em producao.
- Check-in real de responsavel com QR presencial funcionou em producao.
- Impressao local: servico diferencia Brother ligada/desligada, usa fila local para evitar marcar `printed_at` antes de sair do spooler e autoimprime somente check-ins ativos nao impressos.
- Pacote portatil da impressao inclui `.codex-secrets.env` local no ZIP quando existir, sem versionar segredo.
- Etapa 2 do plano operacional implementada em 2026-08-31: SADMIN/Admin podem cadastrar responsavel na aba Familias, o app envia email de primeiro acesso via recuperacao de senha, SADMIN/Admin podem reenviar acesso para responsavel cadastrado e a acao gera `audit_logs` (`user_access_resent`). Testes focados de cadastro/reenvio/autenticacao passaram.
- Confirmacao real de recebimento de email e login em producao ainda depende de teste manual com conta real; o frontend nao le `auth.users.email_confirmed_at` por anon/RLS.
- Etapa 3 do plano operacional implementada em 2026-08-31: dashboard alerta check-ins ativos de dias anteriores, lista os principais casos e permite Admin/SADMIN encerrar em lote com auditoria `stale_checkins_closed`; equipe visualiza alerta sem acao destrutiva.
- Etapa 4 do plano operacional implementada em 2026-08-31: dashboard mostra resumo do dia e Log ganhou relatorio "Resumo do evento" com total geral, criancas unicas, ativos, check-outs, pendentes de impressao, agrupamento por turma/sala e exportacao CSV compativel com Excel. Planilha e WhatsApp incluem resumo detalhado antes da lista nominal.
- Ajuste de Log em 2026-08-31: Assiduidade mostra resumo curto do periodo/dia filtrado, remove "criancas filtradas" quando nao ha selecao manual e oculta nomes em grupos recolhiveis por turma.
- Ultima validacao local: `npm.cmd test` passou com 160 testes em 2026-08-31.
- Cache atual: `checkin-cache-v165`, `app.js?v=20260831g`, `styles.css?v=20260831b`.

## Pendencias

- Auditar Supabase de producao e reconstruir/validar `supabase/setup_dnms_checkin.sql` como arquivo canonico detalhado.
- Definir rotina segura de exportacao/restauracao de dados reais, incluindo usuarios/perfis/vinculos, sem expor senhas/tokens/secrets.
- Validar em producao tentativa de cadastro duplicado pelo app.
- Validar recuperacao de senha em producao com link novo e janela anonima.
- Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.
- Validar no notebook real o pacote `Servico de impressao/dist-pacote/DNMS-Servico-de-impressao-portable.zip`.
