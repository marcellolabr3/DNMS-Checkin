# Servico de impressao

Servico local Node.js para executar impressao da etiqueta recebendo HTML pronto do sistema de check-in.

## Endpoints

- `POST http://localhost:3001/print`
- `POST http://localhost:3001/reprint`
- `GET http://localhost:3001/health`

## Impressora utilizada

O servico foi configurado para usar somente a impressora com nome contendo:

`BROTHER QL-810W`

Se essa impressora nao for encontrada, o servico retorna erro e nao imprime.

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

## Logs

O console registra:

- `checkin_id`
- `tipo`
- `data_hora`
- `status` (`sucesso` ou `erro`)
- detalhes de erro quando houver
