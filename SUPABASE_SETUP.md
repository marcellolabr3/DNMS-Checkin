# Supabase Setup (DNMS Check-in)

Este app espera estas tabelas no schema `public`:

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

No seu projeto atual, o schema publicado está diferente (`criancas`, `salas`, `evento_salas`, etc), por isso partes do fluxo falham.

## Como corrigir

1. Abra o Supabase SQL Editor no projeto `ziuezwtmmnspkycixqtf`.
2. Execute o script [`supabase/setup_dnms_checkin.sql`](./supabase/setup_dnms_checkin.sql).
3. Em `Auth > URL Configuration`, adicione sua URL do Cloudflare em `Site URL` e `Redirect URLs`.
4. Em `Auth > Providers > Email`, mantenha signup por email habilitado.
5. Configure SMTP em `Auth > SMTP Settings` para garantir entrega do email de confirmação.

## Verificação rápida

Depois do script, o endpoint OpenAPI deve listar os caminhos:

- `/profiles`
- `/students`
- `/rooms`
- `/checkins`
- `/student_guardians`
- `/invites`
- `/dashboard_settings`
- `/schedules`
- `/tips`
- `/tip_reads`
