# Pressao Arterial

# blood-pressure-collector

App mobile-first em fluxo guiado para cadastro de pacientes e envio direto para Google Sheets, com fila offline, reenvio automatico e modo instalavel no celular.

## Como rodar

```bash
npm start
```

Depois abra `http://localhost:4173`.

## Protecao de acesso

- O app tem uma senha fixa de entrada para evitar acesso casual por curiosos.
- Senha atual: `m@rsaude`
- Essa protecao e propositalmente simples e roda no cliente.
- Ela nao deve ser tratada como seguranca forte ou controle real de autenticacao.
- A inicializacao dos dados locais e o reenvio da fila so acontecem depois do desbloqueio.
- Para trocar a senha, edite `APP_CONFIG.access.password` em [app.js](/Users/felipelima/work/pressao-arterial/app.js).

## Build para publicacao

```bash
npm run build
```

Os arquivos prontos para publicar ficam em `dist/`.

Para revisar exatamente a versao publicada:

```bash
npm run preview
```

Depois abra `http://localhost:4174`.

## Como configurar o envio para Google Sheets

Edite o objeto `APP_CONFIG.googleSheets` em [app.js](/Users/felipelima/work/pressao-arterial/app.js).

Voce precisa preencher:

- `appScriptUrl`: URL publicada do seu Google Apps Script Web App

## Google Apps Script

Crie um Apps Script vinculado a planilha e publique como `Web app` com acesso liberado para quem tiver o link. Use este codigo:

```javascript
function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return createJsonResponse({ ok: true, status: "online" });
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Página1");
  var data = JSON.parse(e.postData.contents);
  var properties = PropertiesService.getDocumentProperties();
  var recordKey = "record:" + data.recordId;
  var cpfValue = String(data.cpf || "").replace(/\D/g, "");

  if (data.recordId && properties.getProperty(recordKey)) {
    return createJsonResponse({ ok: true, duplicate: true, recordId: data.recordId });
  }

  var targetRow = sheet.getLastRow() + 1;
  var beforeCpfValues = [[
    data.dataHora,
    data.empresa
  ]];
  var afterCpfValues = [[
    data.nomePaciente,
    data.pressaoSistolica,
    data.pressaoDiastolica,
    data.resumo
  ]];

  sheet.getRange(targetRow, 1, 1, beforeCpfValues[0].length).setValues(beforeCpfValues);
  sheet.getRange(targetRow, 3).setNumberFormat("@");
  sheet.getRange(targetRow, 3).setValue(cpfValue);
  sheet.getRange(targetRow, 4, 1, afterCpfValues[0].length).setValues(afterCpfValues);

  if (data.recordId) {
    properties.setProperty(recordKey, new Date().toISOString());
  }

  return createJsonResponse({ ok: true, duplicate: false, recordId: data.recordId });
}
```

Depois de atualizar o codigo, atualize a implantacao do Web App e mantenha a URL publicada em `APP_CONFIG.googleSheets.appScriptUrl`.

## Fila e reenvio

- Cada cadastro finalizado entra primeiro numa fila local salva no aparelho.
- O app tenta enviar imediatamente.
- Se a internet falhar ou o envio passar do tempo limite, o registro continua salvo na fila.
- O usuario pode tocar em `Enviar pendentes` depois, ou o app reenviara automaticamente quando a conexao voltar.
- O `recordId` impede duplicidade na planilha caso o mesmo cadastro seja reenviado.
- O CPF e exibido com mascara na tela, mas e salvo e enviado apenas com numeros.
- O CPF e gravado no Google Sheets em uma escrita dedicada como texto, preservando zeros a esquerda com mais confiabilidade.
- Se a pagina for recarregada, o rascunho atual, a fila pendente e os registros locais sao restaurados automaticamente no mesmo aparelho.
- O app agora espera uma resposta JSON de confirmacao do servidor antes de tirar um cadastro da fila.

## Alternativa manual em CSV

- Todo cadastro tambem fica salvo localmente no celular.
- O usuario pode gerar um CSV a qualquer momento com todos os registros salvos.
- O CSV pode ser compartilhado pelo menu nativo do aparelho para WhatsApp, Slack, Mensagens e apps compativeis.
- Se o compartilhamento por arquivo nao estiver disponivel, o app ainda permite copiar o CSV como texto ou baixar o arquivo.
- O CPF no CSV tambem sai sem mascara.
- Existe exportacao separada apenas dos cadastros pendentes de confirmacao.

## Instalar no celular

- O projeto inclui `manifest.webmanifest`, icones e `service-worker.js`.
- Em navegadores compativeis, o botao `Instalar app` aparece automaticamente.
- Depois de instalado, o app abre em tela cheia e mantem os arquivos basicos em cache para uso mais confiavel no celular.
- O app nao depende de fontes externas, entao a interface continua abrindo offline.

## Uso offline

- O app abre e funciona offline para coleta de dados.
- Empresa, rascunho atual, fila pendente e historico local continuam disponiveis sem internet.
- Quando a conexao voltar, o usuario pode reenviar os pendentes para o Google Sheets.
- Sem internet, o unico ponto que fica adiado e a confirmacao do envio ao Sheets.

## Colunas esperadas

- Data Hora
- Empresa
- CPF
- NomePaciente
- Pressao Sistolica
- Pressao Diastolica
- Resumo Sisto/Diast
