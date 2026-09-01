# Auditoria e limpeza do banco - 2026-09-01

Analise feita em producao via conexao Postgres direta. Nenhum secret foi registrado neste arquivo.

## Resultado sobre criancas orfas

- `public.students` sem vinculo em `public.student_guardians`: 0.
- `public.student_guardians` com estudante inexistente: 0.
- `public.student_guardians` com responsavel inexistente em `public.profiles`: 0.

Conclusao: nao ha cadastro ativo de crianca orfa. Os orfaos encontrados sao check-ins historicos:

- `public.checkins` com `student_id` sem registro correspondente em `public.students`: 54.
- `public.checkins` com `room_id` sem registro correspondente em `public.rooms`: 50.

Esses registros parecem ser historico deixado por exclusoes antigas ou pela ausencia de FK em `checkins`, nao criancas atuais cadastradas sem responsavel.

## Limpeza aplicada

- Removidos 5 registros expirados de `public.invites`.
- Todos estavam `status = 'pending'` e `expires_at < now()`.
- Backup sanitizado dos registros removidos, sem tokens, salvo fora do repositorio em:
  `D:\Dev\BCK_CHEK\db-cleanup-20260901\expired_invites_deleted_20260901-091257.csv`

## Fotos orfas

Foram identificados 32 objetos no bucket `dnms-photos` sem referencia em `public.students.photo_url` nem em `public.profiles.photo_url`.

- `students`: 25 objetos, cerca de 26.5 MB.
- `profiles`: 7 objetos, cerca de 4.7 MB.
- Total estimado: cerca de 31 MB.

Arquivos baixados como copia local antes de qualquer remocao:

- Lista: `D:\Dev\BCK_CHEK\db-cleanup-20260901\orphan_storage_photos_20260901.csv`
- Arquivos: `D:\Dev\BCK_CHEK\db-cleanup-20260901\orphan_storage_photos_files`
- ZIP: `D:\Dev\BCK_CHEK\db-cleanup-20260901\orphan_storage_photos_files.zip`

A remocao fisica das fotos nao foi aplicada porque a credencial local disponivel e apenas `DATABASE_URL`. O Supabase bloqueia delete direto nas tabelas `storage.*` com a funcao `storage.protect_delete()` e orienta usar a Storage API. Para limpar corretamente o espaco do Storage, usar uma Service Role Key ou uma sessao autenticada com permissao de delete no bucket `dnms-photos`.

## Candidatos a limpeza futura

- Funcoes antigas sem uso no app atual e que referenciam tabelas inexistentes (`familias`, `responsaveis`):
  - `entrar_na_familia`
  - `get_familia_id`
  - `get_responsavel_id`
  - `gerar_codigo_convite`
- Colunas legadas em `public.checkins` nao usadas pelo app atual:
  - `crianca_id`
  - `evento_sala_id`
  - `horario_checkin`
  - `horario_checkout`
  - `presente`
- Indice legado `unique_checkin_ativo`, baseado em `crianca_id`, `evento_sala_id` e `horario_checkout`.
- Politicas RLS antigas permissivas `authenticated_rw_*`, que devem ser auditadas com cuidado porque podem ampliar acesso efetivo.

