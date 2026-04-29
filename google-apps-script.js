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

  if (data.recordId && properties.getProperty(recordKey)) {
    return createJsonResponse({ ok: true, duplicate: true, recordId: data.recordId });
  }

  sheet.appendRow([
    data.dataHora,
    data.empresa,
    data.cpf,
    data.nomePaciente,
    data.pressaoSistolica,
    data.pressaoDiastolica,
    data.resumo
  ]);

  if (data.recordId) {
    properties.setProperty(recordKey, new Date().toISOString());
  }

  return createJsonResponse({ ok: true, duplicate: false, recordId: data.recordId });
}
