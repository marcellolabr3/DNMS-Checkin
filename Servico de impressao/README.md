# Servico de impressao

Servico local Node.js para executar impressao da etiqueta recebendo HTML pronto do sistema de check-in.

Tambem possui modo de auto-impressao: ao iniciar, ele escuta novos `checkins` no Supabase e imprime automaticamente no desktop (inclusive check-ins feitos pelo celular).

Quando o PWA e usado no mesmo computador em que o servico e a Brother estao instalados, o check-in envia a etiqueta diretamente para `http://localhost:3001/print`.
Nesse modo direto, o `SUPABASE_SERVICE_ROLE_KEY` nao e necessario para receber a etiqueta do PWA.

Quando o check-in e feito em outro dispositivo, como celular ou outro computador, `localhost` aponta para esse outro dispositivo. Para imprimir na Brother do computador principal nesses casos, use o modo de auto-impressao por listener com `SUPABASE_SERVICE_ROLE_KEY`.

## Endpoints

- `POST http://localhost:3001/print`
- `POST http://localhost:3001/reprint`
- `GET http://localhost:3001/health`

## Impressora utilizada

O servico foi configurado para usar somente a impressora com nome contendo:

`BROTHER QL-810W`

Se essa impressora nao for encontrada, o servico retorna erro e nao imprime.

## Auto-impressao por listener (check-in de qualquer origem)

Ao iniciar, o servico:

1. busca check-ins pendentes (`printed_at IS NULL`);
2. escuta novos inserts na tabela `checkins`;
3. imprime automaticamente e marca `printed_at`.

Para esse modo funcionar com permissao completa, use `SUPABASE_SERVICE_ROLE_KEY` (pode estar no `.codex-secrets.env`).

## Payload esperado

```json
{
  "checkin_id": "string",
  "conteudo": "<html>...</html>",
  "tipo": "print"
}
```

`tipo` aceita `print` ou `reprint`.

## Exemplo de integracao no frontend

```js
fetch("http://localhost:3001/print", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    checkin_id: "123",
    conteudo: htmlDaEtiqueta,
    tipo: "print"
  })
});
```

## Como rodar no Windows

1. Abra terminal na pasta `Servico de impressao`.
2. Instale dependencias:

```powershell
npm install
```

3. Inicie em primeiro plano:

```powershell
npm start
```

4. Verifique saude:

```powershell
curl http://localhost:3001/health
```

Resposta esperada do health:

```json
{"ok":true,"status":"online","target_printer":"Brother QL-810W USB","auto_print_listener":true,"auto_print_polling":true,"supabase_role":"service_role"}
```

## Gerar executavel (.exe)

1. Gere o executavel:

```powershell
cmd /c npm run build:exe
```

2. O arquivo sera criado em:

`dist\Servico-de-impressao.exe`

Obs.: o executavel nao e versionado no Git para nao bloquear o deploy web no Cloudflare Pages.

3. Executar o `.exe` diretamente:

```powershell
.\dist\Servico-de-impressao.exe
```

Ou com duplo clique no arquivo:

`Iniciar Servico de impressao.cmd`

## Gerar pacote portatil para instalar em outro Windows

1. Gere o pacote:

```powershell
cmd /c npm run package:portable
```

2. O pacote sera criado em:

`dist-pacote\DNMS-Servico-de-impressao-portable.zip`

3. Extraia o ZIP no computador que ficara ligado a impressora.
4. Se o PWA sera usado no proprio computador da impressora, nao e obrigatorio configurar `.codex-secrets.env`.
5. Se quiser imprimir check-ins feitos por celular ou outro computador na Brother deste desktop, copie `.codex-secrets.example.env` para `.codex-secrets.env` e preencha `SUPABASE_SERVICE_ROLE_KEY`.
6. Inicie com duplo clique em:

`Iniciar Servico de impressao.cmd`

7. Valide em:

`http://localhost:3001/health`

O servico esta operacional quando o health retornar `ok: true` e `target_printer` com uma impressora contendo `BROTHER QL-810W`.

## Requisito para o executavel

O executavel usa Chrome/Edge instalado no Windows para renderizar o HTML em modo invisivel.
Se necessario, defina a variavel de ambiente `CHROME_PATH`.

## Rodar em segundo plano (Windows)

Iniciar:

```powershell
npm run start:bg
```

Parar:

```powershell
npm run stop:bg
```

## Fluxo recomendado (producao local)

1. Instalar dependencias:

```powershell
cmd /c npm install
```

2. Gerar executavel:

```powershell
cmd /c npm run build:exe
```

3. Iniciar servico:

duplo clique em `Iniciar Servico de impressao.cmd`

4. Validar:

abra `http://localhost:3001/health` e confirme `target_printer` com `Brother QL-810W USB`.

5. Encerrar servico:

duplo clique em `Parar Servico de impressao.cmd`

## Solucao rapida de problemas

Se o health retornar `default_printer` em vez de `target_printer`, voce ainda esta rodando versao antiga do executavel.

Faca:

1. Fechar qualquer processo `Servico-de-impressao.exe`
2. Rodar novamente `npm run build:exe`
3. Iniciar pelo `Iniciar Servico de impressao.cmd` da mesma pasta
4. Confirmar no `netstat`/Gerenciador de Tarefas se o processo ativo aponta para o caminho correto desta pasta (e nao outro clone do projeto)

## Logs

O console registra:

- `checkin_id`
- `tipo`
- `data_hora`
- `status` (`sucesso` ou `erro`)
- detalhes de erro quando houver
