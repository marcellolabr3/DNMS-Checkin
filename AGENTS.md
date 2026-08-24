# DNMS-Checkin - Instrucoes para o Codex

## Objetivo

Este arquivo contem informacoes persistentes e obrigatorias para qualquer sessao do Codex neste projeto.

Antes de iniciar uma tarefa:

1. Leia este arquivo completamente.
2. Leia `docs/CODEX_CONTEXT.md`.
3. Se existir, leia `docs/CODEX_CONTEXT.local.md` para credenciais e notas locais. Esse arquivo e local/ignorado pelo git e nunca deve ser commitado.
4. Consulte o codigo atual antes de assumir como alguma funcionalidade funciona.
5. Nao substitua funcionalidades existentes sem verificar impacto.
6. Preserve compatibilidade com producao sempre que possivel.

## Projeto

DNMS-Checkin e um PWA de check-in.

Antes de modificar autenticacao, banco de dados, permissoes, check-in, cadastro, impressao ou integracoes, analise a implementacao existente.

## Seguranca

- Nunca exponha secrets, tokens ou chaves.
- Nao coloque Service Role Keys no frontend.
- Respeite politicas RLS existentes.
- Nao desabilite mecanismos de seguranca apenas para fazer uma funcionalidade funcionar.
- Valide entradas do usuario.
- Evite mudancas destrutivas no banco.
- Migracoes devem preservar dados existentes sempre que possivel.

## Forma de trabalho

Nao implemente grandes mudancas sem primeiro identificar:

- arquivos envolvidos;
- fluxo atual;
- dependencias;
- risco de regressao.

Depois da implementacao:

- execute os testes relevantes;
- execute lint/build quando aplicavel;
- informe exatamente quais arquivos foram modificados;
- informe qualquer risco ou pendencia encontrada.

## Contexto entre sessoes

O arquivo `docs/CODEX_CONTEXT.md` contem o estado operacional do projeto.

Leia esse arquivo no inicio de cada nova sessao.

Se existir, leia tambem `docs/CODEX_CONTEXT.local.md`. Ele pode conter credenciais locais fornecidas pelo usuario para operacoes administrativas. Nunca exponha seu conteudo em respostas, logs, commits ou diffs.

Ao concluir uma etapa importante, atualize `docs/CODEX_CONTEXT.md` com:

- o que foi implementado;
- decisoes tomadas;
- arquivos importantes;
- problemas conhecidos;
- pendencias;
- proximo passo recomendado.

Nao transforme o arquivo em um historico completo da conversa.

Mantenha apenas informacoes uteis para que uma nova sessao consiga continuar o trabalho.

## Controle de contexto

Durante sessoes longas, monitore a quantidade de contexto acumulada.

Se perceber que:

- muitas alteracoes diferentes ja foram discutidas;
- informacoes antigas comecam a competir com informacoes novas;
- estiver precisando reler repetidamente partes antigas da conversa;
- houver risco de confundir uma implementacao anterior com a atual;
- estiver proximo de uma compactacao automatica da conversa;

avise o usuario antes de iniciar uma nova tarefa grande.

Use a mensagem:

"⚠️ CONTEXTO DA SESSAO FICANDO EXTENSO. Recomendo registrar o estado atual no CODEX_CONTEXT.md e iniciar uma nova sessao antes de continuar."

Antes de sugerir uma nova sessao:

1. Atualize `docs/CODEX_CONTEXT.md`.
2. Registre o estado atual.
3. Registre pendencias.
4. Registre o proximo passo exato.

O objetivo e permitir que uma nova conversa continue de onde esta terminou sem depender do historico do chat.
