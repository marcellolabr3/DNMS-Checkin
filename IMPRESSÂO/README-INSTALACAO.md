# DNMS - Servico de Impressao

Esta pasta contem o pacote portable publico do servico local de impressao.

## Instalar em outro computador

1. Baixe `DNMS-Servico-de-impressao-portable.zip`.
2. Extraia o ZIP no computador ligado a Brother QL-810W.
3. Na pasta extraida, copie `.codex-secrets.example.env` para `.codex-secrets.env`.
4. Preencha `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` no `.codex-secrets.env` local.
5. Abra `DNMS Impressao.cmd`.
6. Valide em `http://localhost:3001/status`.

## Observacoes

- O arquivo `.codex-secrets.env` real nunca deve ser enviado ao GitHub.
- Para autoimpressao de check-ins feitos por celular ou outro computador, o `.codex-secrets.env` local precisa ter acesso administrativo ao Supabase.
- A varredura padrao de pendencias esta configurada para 1 segundo (`AUTO_PRINT_POLL_INTERVAL_MS=1000`).
- O servico pre-aquece e reutiliza o navegador Chromium para acelerar a geracao das etiquetas.
