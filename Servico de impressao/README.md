# Servico de impressao

Servico local Node.js para receber pedidos de etiqueta, persistir uma fila tecnica local e imprimir na Brother.

Tambem possui modo de auto-impressao: ao iniciar, ele escuta novos `checkins` no Supabase e imprime automaticamente no desktop (inclusive check-ins feitos pelo celular).

Quando o PWA e usado no mesmo computador em que o servico e a Brother estao instalados, o check-in envia a etiqueta para `http://localhost:3001/print`.
Nesse modo direto, o `SUPABASE_SERVICE_ROLE_KEY` nao e necessario para receber a etiqueta do PWA.

Quando o check-in e feito em outro dispositivo, como celular ou outro computador, `localhost` aponta para esse outro dispositivo. Para imprimir na Brother do computador principal nesses casos, o servico precisa rodar nesse computador com `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` configurado em `.codex-secrets.env`.

## Endpoints

- `POST http://localhost:3001/print`
- `POST http://localhost:3001/reprint`
- `GET http://localhost:3001/print/:jobId`
- `GET http://localhost:3001/health`

`POST /print` e `POST /reprint` sao assincronos. Eles validam o payload, criam um `PrintJob`, salvam no SQLite local e respondem `202 Accepted` sem aguardar renderizacao, Sumatra ou spooler:

```json
{
  "success": true,
  "jobId": "8F73A1",
  "status": "QUEUED"
}
```

Consulte `GET /print/:jobId` para acompanhar o status tecnico.

Por seguranca, o servico escuta somente em `127.0.0.1` por padrao. Assim ele atende o navegador do proprio computador da Brother, mas nao fica exposto para outros dispositivos da rede.

### Protecao HTTP opcional

Para endurecer as chamadas diretas do navegador para `/print` e `/reprint`, configure em `.codex-secrets.env`:

```env
PRINT_SERVICE_TOKEN=crie_um_token_local_longo
PRINT_ALLOWED_ORIGINS=https://url-publica-do-app
```

Quando `PRINT_SERVICE_TOKEN` estiver configurado, o PWA/painel de impressao precisa ter o mesmo valor salvo no navegador do PC da Brother:

```js
localStorage.setItem("dnms_print_service_token", "crie_um_token_local_longo")
```

`PRINT_ALLOWED_ORIGINS` e uma lista separada por virgula. Se ficar vazia, o servico roda em modo compatibilidade e nao bloqueia por origem. O token e a lista de origens protegem apenas os endpoints HTTP locais; auto-impressao e reimpressao remota por fila continuam sendo processadas diretamente pelo servico via Supabase.

## Impressora utilizada

O servico foi configurado para usar somente a impressora com nome contendo:

`BROTHER QL-810W`

Se essa impressora nao for encontrada, o servico retorna erro e nao imprime.

O health/status tambem consulta o estado da fila no Windows via `Win32_Printer`/`Get-Printer`. Quando o Windows marcar a Brother como offline ou com erro conhecido, `/health` retorna `ok: false`, `printer_ready: false` e o painel mostra a impressora em vermelho. Essa verificacao nao imprime etiqueta de teste.

No Windows, se o estado da Brother nao puder ser confirmado, o servico mostra a impressora como indisponivel para evitar falso online com a impressora desligada.

## Auto-impressao por listener (check-in de qualquer origem)

Ao iniciar, o servico:

1. busca check-ins pendentes (`printed_at IS NULL`);
2. escuta novos inserts na tabela `checkins`;
3. imprime automaticamente e marca `printed_at`.

Para esse modo funcionar, configure `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` no `.codex-secrets.env` do computador ligado a Brother.
Sem uma dessas credenciais, o painel mostra a auto-impressao do celular como inativa. A versao atual bloqueia a impressao se faltar nome, turma ou responsavel, para evitar etiqueta em branco marcada como impressa.

O servico tambem faz varredura de pendencias a cada 1 segundo para cobrir falhas ou atraso do listener realtime. Se necessario, ajuste com `AUTO_PRINT_POLL_INTERVAL_MS` no `.codex-secrets.env`.
Para reduzir a latencia, o servico pre-aquece e reutiliza o navegador Chromium usado para gerar o PDF da etiqueta.

Os check-ins pendentes nao sao impressos diretamente pelo listener. Eles entram na mesma fila local usada por `/print` e `/reprint`.

## Reimpressao remota por fila

Reimpressao feita no proprio computador da Brother continua usando `http://localhost:3001/reprint`.

Quando a reimpressao for solicitada fora do computador da Brother, o app cria um registro em `print_jobs`. O servico de impressao, rodando com `SUPABASE_SERVICE_ROLE_KEY`, reserva um job por vez com `claim_next_reprint_job`, cria um `PrintJob` tecnico local, imprime pelo worker unico e marca o job remoto como `printed` ou `failed`.

Antes de usar esse fluxo, aplique no Supabase:

```sql
supabase/patch_reprint_queue.sql
```

A tabela impede mais de uma reimpressao aberta para o mesmo check-in (`pending` ou `processing`). Se houver duas instancias do servico, apenas uma reserva cada job.

## Payload esperado

```json
{
  "checkin_id": "string",
  "conteudo": "<html>...</html>",
  "tipo": "print"
}
```

`tipo` aceita `print` ou `reprint`.

## Fila tecnica local

O estado tecnico de impressao fica em SQLite local:

`data/print-service.sqlite`

Esse arquivo nao e versionado. Para alterar o local, defina:

```env
PRINT_JOB_DB_PATH=C:\caminho\print-service.sqlite
```

Estados do `PrintJob`:

- `QUEUED`
- `PRINTING`
- `SENT_TO_SPOOLER`
- `SPOOLER_DONE`
- `FAILED`
- `CANCELLED`

O worker processa 1 job por vez. Ao reiniciar o servico, jobs que estavam em `PRINTING` voltam para `QUEUED`. Jobs que chegaram a `SENT_TO_SPOOLER` sao tratados como ambiguos e nao recebem retry automatico, para evitar etiquetas duplicadas.

`SPOOLER_DONE` significa que o Windows removeu/concluiu o job no spooler. Nao e confirmacao fisica de etiqueta impressa/cortada.

## Motor de impressao

Nesta fase o motor foi preservado:

```text
Puppeteer/Chromium persistente
  -> nova Page por job
  -> PDF
  -> SumatraPDF
  -> Windows Spooler
  -> Brother QL-810W
```

O motor fica encapsulado para permitir substituir o adaptador futuramente sem reescrever API/fila.

## Exemplo de integracao no frontend

```js
fetch("http://localhost:3001/print", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-DNMS-Print-Token": "token_local_quando_configurado"
  },
  body: JSON.stringify({
    checkin_id: "123",
    conteudo: htmlDaEtiqueta,
    tipo: "print"
  })
});
```

A resposta indica que o job foi aceito na fila local, nao que a etiqueta ja saiu fisicamente.

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
{"ok":true,"status":"online","target_printer":"Brother QL-810W USB","printer_ready":true,"auto_print_listener":true,"auto_print_polling":true,"supabase_role":"service_role"}
```

## Gerar executavel (.exe)

1. Gere o executavel:

```powershell
cmd /c npm run build:exe
```

2. O motor interno sera criado em:

`dist\Servico-de-impressao.exe`

Obs.: o executavel nao e versionado no Git para nao bloquear o deploy web no Cloudflare Pages.

3. Iniciar com duplo clique no arquivo:

`DNMS Impressao.cmd`

Esse iniciador deixa o servico na area de notificacao do Windows. Pelo icone, use `Abrir status` para ver o painel local ou `Encerrar servico` para parar a impressao local.

Evite iniciar `dist\Servico-de-impressao.exe` diretamente no uso normal, porque ele nao cria o icone da bandeja.

## Gerar pacote portatil para instalar em outro Windows

1. Gere o pacote:

```powershell
cmd /c npm run package:portable
```

2. O pacote sera criado em:

`dist-pacote\DNMS-Servico-de-impressao-portable.zip`

3. Extraia o ZIP no computador que ficara ligado a impressora.
4. Para instalar ou atualizar, execute com duplo clique:

`DNMS Instalar Atualizar.cmd`

Esse comando encerra uma instancia anterior, valida arquivos obrigatorios, cria/atualiza o atalho da area de trabalho e inicia o servico.

5. Se existir `.codex-secrets.env` no computador que gerou o pacote, ele sera incluido no ZIP local para preservar `DATABASE_URL`, token e portas. Esse arquivo continua ignorado pelo Git.
6. Se o PWA sera usado no proprio computador da impressora, nao e obrigatorio configurar `.codex-secrets.env`.
7. Se quiser imprimir check-ins feitos por celular ou outro computador na Brother deste desktop, confirme que `.codex-secrets.env` existe na pasta extraida e contem `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`.
8. Para validar a instalacao a qualquer momento, execute:

`DNMS Validar Instalacao.cmd`

9. Para acompanhar continuamente a saude no computador da Brother, execute:

`DNMS Validacao Continua.cmd`

Esse monitor abre o status e consulta `/health` em ciclos. Ele nao imprime etiqueta de teste por padrao.

10. Para iniciar normalmente depois da instalacao, use o atalho criado ou execute:

`DNMS Impressao.cmd`

11. Valide em:

`http://localhost:3001/status`

O servico esta operacional quando o painel mostrar bolinha verde para servico local, impressora Brother, autoimpressao do celular e fila da Brother.
Para check-ins feitos no celular/outro computador, a linha "Autoimpressao do celular" precisa aparecer como ativa.

Se o painel mostrar etiquetas pendentes na fila da Brother, limpe ou libere a fila pelo Windows antes de continuar. O servico bloqueia novas impressoes enquanto houver jobs pendentes e so marca `printed_at` depois que o Windows confirma que a etiqueta saiu da fila.

## Validacao continua em ambiente real

Rode `DNMS Validacao Continua.cmd` no computador conectado a Brother depois de qualquer mudanca em check-in, reimpressao, cache do PWA, schema Supabase ou pacote portable.

A validacao automatica cobre:

- arquivos obrigatorios do pacote;
- Chrome/Edge e SumatraPDF;
- porta local, token e configuracao admin local;
- resposta de `/health`;
- estado da Brother, fila do Windows, autoimpressao e reimpressao.

A validacao fisica ainda precisa de um check-in/reimpressao real observado no local, porque `SPOOLER_DONE` confirma apenas que o Windows removeu o job da fila.

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

3. Validar instalacao local:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\validate-install.ps1"
```

4. Iniciar servico:

duplo clique em `DNMS Impressao.cmd`

5. Validar:

abra `http://localhost:3001/status` e confirme bolinha verde para a impressora Brother.
Se a Brother aparecer em vermelho, abra a fila/impressora no Windows e verifique se ela esta ligada, sem erro e sem modo offline.

6. Encerrar servico:

clique com o botao direito no icone da area de notificacao e escolha `Encerrar servico`.

## Solucao rapida de problemas

Se o health retornar `default_printer` em vez de `target_printer`, voce ainda esta rodando versao antiga do executavel.

Faca:

1. Fechar qualquer processo `Servico-de-impressao.exe`
2. Rodar novamente `npm run build:exe`
3. Iniciar pelo `DNMS Impressao.cmd` da mesma pasta
4. Confirmar no `netstat`/Gerenciador de Tarefas se o processo ativo aponta para o caminho correto desta pasta (e nao outro clone do projeto)

O painel `http://localhost:3001/status` tambem mostra um bloco `Diagnostico` com codigos objetivos:

- `BROTHER_NOT_FOUND`: a Brother QL-810W nao foi encontrada no Windows.
- `BROTHER_NOT_READY`: a Brother foi encontrada, mas esta offline, pausada ou com erro.
- `BROTHER_QUEUE_BLOCKED`: existe etiqueta presa na fila da Brother.
- `CHROMIUM_MISSING`: Chrome/Edge nao foi encontrado para gerar o PDF.
- `SUMATRA_MISSING`: SumatraPDF nao foi encontrado para enviar o PDF ao spooler.
- `ADMIN_DATA_ACCESS_MISSING`: autoimpressao do celular sem `DATABASE_URL` ou Service Role local.

Erros HTTP tambem retornam `code`: `PRINT_TOKEN_MISSING_OR_INVALID` para token ausente/invalido e `PRINT_ORIGIN_DENIED` para origem fora de `PRINT_ALLOWED_ORIGINS`.

## Logs

O console registra:

- `checkin_id`
- `tipo`
- `data_hora`
- `status` (`sucesso` ou `erro`)
- detalhes de erro quando houver
