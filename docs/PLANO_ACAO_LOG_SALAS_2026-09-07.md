# Plano de Acao - Log, Maternal e Limite de Salas

## Roteiro da etapa

1. Conferir mensagem de WhatsApp do Log contra o relatorio exibido.
2. Verificar regra de faixa etaria do Maternal.
3. Confirmar por que "sala teste" e "zerar check-ins" nao apareciam.
4. Implementar limite opcional de check-ins por sala.
5. Validar com testes e registrar estado operacional.

## Diagnostico

- WhatsApp do Log usava o resumo operacional completo, incluindo checkout e impressao pendente. A mensagem foi simplificada para os mesmos dados de presenca do relatorio resumido: total geral, por turma, por sala e frequencia detalhada.
- Maternal falhava para criancas com 2 anos completos porque a regra SQL e o frontend usavam `ano referencia - ano nascimento - 1`. Isso classificava algumas criancas de 2 anos como idade ministerial 1. A regra agora usa idade completa na data de referencia.
- "Sala teste" ja existia, mas apenas para SADMIN (`marvinlabre@gmail.com`). Admin comum nao ve esse campo por regra de seguranca.
- "Zerar check-ins de hoje" ja existia no dashboard do SADMIN. Foi tambem adicionado ao painel Log para ficar no local esperado.

## Implementado

- Campo "Limite de check-ins" no cadastro/edicao de salas. Valor vazio significa sem limite.
- Leitura e exibicao de `max_checkins` na lista e no detalhe da sala.
- Bloqueio local de check-in quando a sala atinge o limite.
- Patch SQL `supabase/patch_room_checkin_limit_and_age.sql` com coluna `rooms.max_checkins`, constraint positiva, trigger server-side e ajuste da RPC de check-in presencial.
- Ajuste de cache do PWA para `checkin-cache-v177` e `app.js?v=20260907a`.

## Validacao

- `npx.cmd playwright test tests/checkin.spec.js tests/supabase-payload.spec.js tests/service-worker.spec.js`: 102 passed.
- `npm.cmd test`: 190 passed.
- Patch `supabase/patch_room_checkin_limit_and_age.sql` aplicado no Supabase de producao em 2026-09-07.
- Verificacao no banco confirmou `rooms.max_checkins`, constraint positiva, trigger de limite e crianca com 2 anos completos classificada como `Maternal`.

## Pendencias

- Revalidar em producao pelo PWA com usuario SADMIN para confirmar visibilidade de "Sala teste", "Zerar check-ins de hoje" no Log e bloqueio visual de limite apos atualizar cache do PWA.
