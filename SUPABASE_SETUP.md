# Supabase Setup (DNMS Check-in)

Este documento descreve o estado atual do Supabase para este projeto e como manter o ambiente funcionando sem regressão.

## Projeto
- URL: `https://ziuezwtmmnspkycixqtf.supabase.co`
- Schema principal: `public`

## Estrutura esperada (atual)

### Tabelas usadas pelo app
- `profiles`
- `students`
- `rooms`
- `checkins`
- `student_guardians`
- `invites`
- `dashboard_settings`
- `schedules`
- `tips`
- `tip_reads`

### Campos importantes adicionais já aplicados
- `schedules.target_user` (fallback de vinculação por e-mail/nome)

### Segurança e regras
- RLS habilitado nas tabelas principais do app.
- Policies de acesso por perfil (`admin`, `equipe`, `responsavel`, `dnms_kids`).
- `marvinlabre@gmail.com` tratado como SADMIN em funções de gestão.
- Constraint para exigir telefone de `responsavel` no perfil.
- Trigger de criação/sincronização de `profiles` em novo usuário Auth.

## Arquivos SQL versionados no Git

### Base completa
- `supabase/setup_dnms_checkin.sql`

### Patches históricos aplicados
- `supabase/patch_require_responsavel_phone.sql`
- `supabase/patch_schedule_target_user.sql`
- `supabase/patch_is_staff_include_dnms_kids.sql`
- `supabase/patch_phone_normalization.sql`
- `supabase/patch_checkin_active_guard.sql`

### Proteção de check-in ativo (atual)
- Regra: cada criança pode ter no máximo 1 check-in ativo (`checked_out_at IS NULL`).
- O patch `patch_checkin_active_guard.sql`:
  - fecha check-ins legados ativos em salas fechadas ou inexistentes;
  - fecha duplicidades antigas, preservando o check-in ativo mais recente por criança;
  - cria índice único parcial `checkins_one_active_per_student`.

### Padronização de telefone (atual)
- Formato único no banco: `+55 (DD) 9XXXX-XXXX`
- Escopo: `profiles.phone` e `students.phone`
- Garantias:
  - normalização automática em `INSERT/UPDATE` via trigger
  - validação por `CHECK CONSTRAINT` para bloquear formato inválido
  - saneamento dos dados legados já executado
- Observação:
  - `students.phone` permite `NULL` para evitar quebra em registros antigos sem telefone válido

### Backup estrutural do banco (snapshot)
- `supabase/BD_BACKUP_2026-03-28.md`

## Como provisionar do zero

1. Abra o **SQL Editor** do projeto Supabase.
2. Execute:
   - `supabase/setup_dnms_checkin.sql`
3. Se ambiente já existente/legado, execute também os patches acima (idempotentes).
4. Valide se as tabelas listadas estão acessíveis via API.

## Auth e SMTP

1. Em **Auth > URL Configuration**:
   - Defina `Site URL` com sua URL de produção (Cloudflare).
   - Adicione `Redirect URLs` necessárias.
2. Em **Auth > Providers > Email**:
   - Cadastro por e-mail habilitado.
3. Em **Auth > SMTP Settings**:
   - Configure SMTP (ex.: Brevo) para confirmação de e-mail.

## Storage

- Bucket esperado: `dnms-photos` (público).
- Usado para fotos de perfil e alunos.
- Policies de storage devem permitir upload/leitura conforme regras do app.

## Checklist de verificação rápida

- Cadastro de responsável exige telefone.
- Perfil é criado corretamente após signup.
- Responsável só vê e opera as próprias crianças.
- Gestão visível apenas para `SADMIN` e `Admin`.
- Escalas aparecem no dashboard do usuário.
- Painel de impressão lista apenas crianças com check-in do dia.
- Log por período funciona com filtro por turma/criança e exportação.

## Boas práticas para não perder funcionamento

- Toda mudança de banco deve gerar SQL versionado em `supabase/`.
- Sempre atualizar este arquivo quando houver mudança estrutural.
- Manter snapshot estrutural (`BD_BACKUP_*.md`) atualizado em marcos importantes.
