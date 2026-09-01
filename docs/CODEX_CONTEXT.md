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
- Auth: Supabase Auth + `profiles.role` (`admin`, `equipe`, `responsavel`, `dnms_kids`). SADMIN: `marvinlabre@gmail.com`.

## Banco e Operacao

- Tabelas principais: `profiles`, `students`, `student_guardians`, `rooms`, `checkins`, `audit_logs`, `print_jobs`, `schedules`, `tips`, `tip_reads`, `family_link_requests`, `app_settings`.
- `supabase/setup_dnms_checkin.sql` precisa ser auditado/reconstruido como schema canonico para novos ambientes.
- Credencial administrativa pode existir em `docs/CODEX_CONTEXT.local.md`; usar somente em variavel temporaria e nunca expor.
- Patches esperados no banco/app: janela de check-in, QR presencial de responsavel, um check-in ativo por crianca, idade anual por virada de ano, fila de reimpressao, rede familiar, exclusao segura de usuario e checkout antes de deletar sala.

## Regras Criticas

- Nao desabilitar RLS nem mover Service Role Key para frontend.
- Check-in permitido somente de 30 min antes do inicio da aula ate antes do horario de termino.
- Crianca permanece na mesma turma durante o ano vigente; troca apenas em 1 de janeiro.
- Responsavel faz check-in somente via QR presencial usando RPC `parent_checkin_with_presence`.
- Admin/equipe fazem check-in direto em `checkins`, mas banco tambem valida horario.
- Cada crianca pode ter no maximo um check-in ativo (`checked_out_at is null`).
- Cadastro de crianca deve criar vinculo em `student_guardians`; responsavel comum nao pode se vincular automaticamente a crianca fora da familia.
- Salas/eventos sempre nascem `Programada`; abertura e manual por admin/equipe. Se ninguem abrir, a sala continua sem check-ins e vai para historico.
- Salas abertas devem permanecer visiveis na aba Salas para gerenciamento. Salas passadas ficam em secao ocultavel separada por mes, limitada aos ultimos 16 dias.
- Ao alterar HTML/CSS/JS, atualizar querystrings em `index.html` e `CACHE_NAME`/assets em `sw.js`.
- Dados de usuario/banco devem usar `textContent`, `createElement` ou escape antes de entrar em `innerHTML`.
- Service worker deve cachear apenas assets estaticos locais explicitamente listados.

## Estado Atual Validado

- Fluxo de salas corrigido em 2026-09-01: revertida criacao automatica aberta; adicionado historico ocultavel "Salas passadas"; testes protegem criacao `Programada`, abertura manual, sala aberta visivel e check-in habilitado.
- QR de responsavel usa `BarcodeDetector` quando disponivel e fallback local `vendor/jsQR.js` para iPhone/Safari; campo manual aparece apenas quando camera/leitor indisponivel.
- Dashboard/log atuais incluem alerta para check-ins ativos antigos, resumo do dia/evento, exportacao CSV e compartilhamento WhatsApp com resumo.
- Familias permite SADMIN/Admin cadastrar responsavel, reenviar acesso e gerenciar rede familiar/vinculos.
- Impressao local diferencia Brother ligada/desligada, usa fila local e autoimprime somente check-ins ativos nao impressos.
- Ultima validacao local: `npm.cmd test -- tests/checkin.spec.js tests/service-worker.spec.js` passou com 86 testes em 2026-09-01.
- Cache atual: `checkin-cache-v171`, `app.js?v=20260901b`, `styles.css?v=20260901a`.

## Pendencias

- Auditar Supabase de producao e reconstruir/validar `supabase/setup_dnms_checkin.sql` como arquivo canonico detalhado.
- Definir rotina segura de exportacao/restauracao de dados reais, incluindo usuarios/perfis/vinculos, sem expor senhas/tokens/secrets.
- Validar em producao tentativa de cadastro duplicado pelo app e recuperacao de senha com link novo em janela anonima.
- Documentar procedimento operacional para equipe/admin ajustar responsaveis de crianca existente.
- Validar no notebook real o pacote `Servico de impressao/dist-pacote/DNMS-Servico-de-impressao-portable.zip`.
