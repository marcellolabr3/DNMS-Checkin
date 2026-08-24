# DNMS-Checkin - Contexto Operacional

## Estado Atual

- Projeto PWA de check-in com Supabase, controle de perfis, criancas, salas, check-ins, logs e impressao Brother.
- Branch principal usada nesta sessao: `main`.
- Remote GitHub: `origin`.
- Arquivo local `.idea/vcs.xml` esta nao versionado e deve continuar fora dos commits, salvo pedido explicito.

## Implementado Recentemente

- Fila de reimpressao remota via `print_jobs`, com consumidor no `Servico de impressao/server.js`.
- Protecao contra cadastro duplicado de crianca:
  - app verifica duplicidade antes de salvar por nome normalizado + data de nascimento;
  - responsavel comum nao ganha vinculo automatico com crianca existente;
  - banco deve bloquear duplicidade via trigger em `supabase/patch_prevent_duplicate_students.sql`;
  - tela de cadastro exibe overlay "Salvando crianca..." e bloqueia novo clique durante o salvamento.

## Decisoes

- Uma crianca deve ser uma ficha unica.
- Responsaveis sao vinculos em `student_guardians`.
- Se uma crianca ja existe, outro responsavel nao pode criar nova ficha nem se vincular automaticamente.
- Ajuste de responsaveis de crianca existente deve ser feito por equipe/admin.
- Regras sensiveis devem existir tambem no banco, nao apenas no frontend.
- Secrets e connection strings nao devem ser gravados em arquivos versionados nem exibidos em respostas.

## Arquivos Importantes

- `AGENTS.md`: instrucoes persistentes para o Codex.
- `docs/CODEX_CONTEXT.md`: contexto operacional entre sessoes.
- `app.js`: fluxo principal de cadastro, check-in, permissoes e UI.
- `index.html`: estrutura dos dialogs e formularios.
- `styles.css`: estilos, incluindo overlay de salvamento.
- `supabase/setup_dnms_checkin.sql`: schema completo esperado.
- `supabase/patch_prevent_duplicate_students.sql`: patch incremental contra duplicidade de criancas.
- `supabase/patch_reprint_queue.sql`: patch incremental da fila de reimpressao.
- `Servico de impressao/server.js`: servico local da Brother e consumidores de filas.

## Problemas Conhecidos

- O banco de producao precisa receber patches SQL quando houver mudanca em `supabase/patch_*.sql`.
- Se ja existirem criancas duplicadas legadas, o trigger novo bloqueia novas duplicidades, mas nao faz merge automatico de dados antigos.
- A connection string do banco foi compartilhada no chat desta sessao; recomenda-se rotacionar a senha do banco e nao registrar esse segredo em arquivos versionados.

## Pendencias

- Avaliar depois uma rotina segura/manual para revisar duplicidades antigas, se existirem.

## Proximo Passo Recomendado

- Validar pelo app em producao uma tentativa de cadastro duplicado e rotacionar a senha do banco compartilhada nesta sessao.
