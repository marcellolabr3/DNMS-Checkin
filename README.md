# DNMS Check-in

Aplicacao web para check-in educacional com:
- autenticacao e dados no Supabase
- controle de salas/eventos
- check-in por aluno e por responsavel
- painel de impressao de etiquetas
- dashboard e gestao por perfil

## Repositorio
- GitHub: `https://github.com/marcellolabr3/DNMS-Checkin.git`

## Estrutura principal
- `index.html`
- `app.js`
- `print.html`
- `print.js`
- `styles.css`
- `supabase/setup_dnms_checkin.sql`

## Banco de dados (Supabase)
Este projeto depende de schema, RLS, policies, triggers e funcoes do Supabase.

Arquivos de referencia no Git:
- Setup base: `supabase/setup_dnms_checkin.sql`
- Patches incrementais: `supabase/patch_*.sql`
- Snapshot/backup da estrutura atual do banco: `supabase/BD_BACKUP_2026-03-28.md`

## Backup de estrutura do Supabase
Foi registrado um backup estrutural completo do projeto Supabase em:
- `supabase/BD_BACKUP_2026-03-28.md`

Conteudo do backup:
- tabelas
- colunas
- constraints
- indices
- policies RLS
- triggers
- funcoes SQL (definicoes)

Objetivo: preservar o funcionamento e permitir restauracao/analise da estrutura caso haja alteracoes futuras.

## Execucao local
1. Clone o repositorio.
2. Abra `index.html` no navegador (ou use servidor local HTTP).
3. Garanta que URL/anon key do Supabase estejam corretas no frontend.

## Observacao
Para nao perder compatibilidade entre app e banco:
- versionar sempre alteracoes de schema/policy em `supabase/`
- manter patches e backup estrutural atualizados no Git.
