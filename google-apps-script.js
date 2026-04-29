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
