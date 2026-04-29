const APP_CONFIG = {
  googleSheets: {
    appScriptUrl:
      "https://script.google.com/macros/s/AKfycby-9jPRR1xEInbGEHWrYusSKn2fuMG9JB1HxVcT0muxezPoO77dbtIyK6gqcG0KAbg3DQ/exec"
  },
  access: {
    // Barreira leve para curiosos. Como roda no cliente, nao deve ser tratada como seguranca forte.
    password: "m@rsaude"
  }
};

const STORAGE_KEY = "pressao-arterial-state-v2";
const SEND_TIMEOUT_MS = 8000;
const MAX_PENDING_PREVIEW = 4;
const AUTH_STORAGE_KEY = "pressao-arterial-authenticated";

let deferredInstallPrompt = null;
let appInitialized = false;

const steps = [
  {
    key: "company",
    label: "Configuração inicial",
    title: "Qual é o nome da empresa?",
    fieldLabel: "Empresa",
    hint: "Esse nome será reaproveitado para todos os pacientes até você trocar.",
    buttonLabel: "Salvar empresa",
    placeholder: "Ex.: Mar Saúde",
    autocomplete: "organization",
    inputMode: "text",
    autocapitalize: "words",
    maxLength: 80
  },
  {
    key: "cpf",
    label: "Paciente",
    title: "Digite o CPF do paciente.",
    fieldLabel: "CPF",
    hint: "Usamos máscara automática e validação completa do CPF.",
    buttonLabel: "Continuar",
    placeholder: "000.000.000-00",
    autocomplete: "off",
    inputMode: "numeric",
    autocapitalize: "off",
    maxLength: 14
  },
  {
    key: "patientName",
    label: "Paciente",
    title: "Agora informe o nome do paciente.",
    fieldLabel: "Nome do paciente",
    hint: "Use o nome completo para facilitar a identificação.",
    buttonLabel: "Continuar",
    placeholder: "Ex.: Maria da Silva",
    autocomplete: "name",
    inputMode: "text",
    autocapitalize: "words",
    maxLength: 120
  },
  {
    key: "systolic",
    label: "Pressão arterial",
    title: "Qual foi a pressão sistólica?",
    fieldLabel: "Sistólica",
    hint: "É o número de cima da pressão. Digite somente números.",
    buttonLabel: "Continuar",
    placeholder: "Ex.: 120",
    autocomplete: "off",
    inputMode: "numeric",
    autocapitalize: "off",
    maxLength: 3
  },
  {
    key: "diastolic",
    label: "Pressão arterial",
    title: "Qual foi a pressão diastólica?",
    fieldLabel: "Diastólica",
    hint: "É o número de baixo da pressão. Digite somente números.",
    buttonLabel: "Enviar",
    placeholder: "Ex.: 80",
    autocomplete: "off",
    inputMode: "numeric",
    autocapitalize: "off",
    maxLength: 3
  }
];

const state = {
  company: "",
  currentStepIndex: 0,
  currentPatient: {
    cpf: "",
    patientName: "",
    systolic: "",
    diastolic: ""
  },
  deviceRecords: [],
  pendingQueue: [],
  isFlushingQueue: false,
  submittedCount: 0,
  lastSubmission: null
};

const dom = {
  authShell: document.querySelector("#authShell"),
  appShell: document.querySelector("#appShell"),
  authForm: document.querySelector("#authForm"),
  passwordInput: document.querySelector("#passwordInput"),
  authError: document.querySelector("#authError"),
  wizardForm: document.querySelector("#wizardForm"),
  installButton: document.querySelector("#installButton"),
  heroCard: document.querySelector("#heroCard"),
  stepLabel: document.querySelector("#stepLabel"),
  stepTitle: document.querySelector("#stepTitle"),
  stepCounter: document.querySelector("#stepCounter"),
  progressBar: document.querySelector("#progressBar"),
  fieldLabel: document.querySelector("#fieldLabel"),
  fieldHint: document.querySelector("#fieldHint"),
  fieldError: document.querySelector("#fieldError"),
  stepInput: document.querySelector("#stepInput"),
  backButton: document.querySelector("#backButton"),
  nextButton: document.querySelector("#nextButton"),
  companyValue: document.querySelector("#companyValue"),
  submittedCount: document.querySelector("#submittedCount"),
  queueCount: document.querySelector("#queueCount"),
  deviceCount: document.querySelector("#deviceCount"),
  queueStatus: document.querySelector("#queueStatus"),
  queueHint: document.querySelector("#queueHint"),
  retryQueueButton: document.querySelector("#retryQueueButton"),
  sharePendingCsvButton: document.querySelector("#sharePendingCsvButton"),
  downloadPendingCsvButton: document.querySelector("#downloadPendingCsvButton"),
  pendingPreviewTitle: document.querySelector("#pendingPreviewTitle"),
  pendingList: document.querySelector("#pendingList"),
  exportStatus: document.querySelector("#exportStatus"),
  exportHint: document.querySelector("#exportHint"),
  shareCsvButton: document.querySelector("#shareCsvButton"),
  copyCsvButton: document.querySelector("#copyCsvButton"),
  downloadCsvButton: document.querySelector("#downloadCsvButton"),
  clearLocalDataButton: document.querySelector("#clearLocalDataButton"),
  confirmOverlay: document.querySelector("#confirmOverlay"),
  confirmCancelButton: document.querySelector("#confirmCancelButton"),
  confirmAcceptButton: document.querySelector("#confirmAcceptButton"),
  lastPatient: document.querySelector("#lastPatient"),
  lastResult: document.querySelector("#lastResult"),
  statusCard: document.querySelector("#statusCard"),
  resetCompanyButton: document.querySelector("#resetCompanyButton"),
  completionTemplate: document.querySelector("#completionTemplate")
};

let pendingConfirmAction = null;

function getCurrentStep() {
  return steps[state.currentStepIndex];
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function setAuthenticated(value) {
  if (value) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
  } else {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function showApp() {
  dom.authShell.hidden = true;
  dom.appShell.hidden = false;
}

function showAuth() {
  dom.appShell.hidden = true;
  dom.authShell.hidden = false;
  window.setTimeout(() => {
    dom.passwordInput.focus();
  }, 40);
}

function openConfirmDialog(action) {
  pendingConfirmAction = action;
  dom.confirmOverlay.hidden = false;
  window.setTimeout(() => {
    dom.confirmCancelButton.focus();
  }, 40);
}

function closeConfirmDialog() {
  pendingConfirmAction = null;
  dom.confirmOverlay.hidden = true;
}

function confirmPendingAction() {
  if (!pendingConfirmAction) {
    closeConfirmDialog();
    return;
  }

  const action = pendingConfirmAction;
  closeConfirmDialog();
  action();
}

function initializeApp() {
  if (appInitialized) {
    return;
  }

  appInitialized = true;

  const restoredState = loadState();
  renderStep();

  if (
    restoredState &&
    (
      state.company ||
      state.currentPatient.cpf ||
      state.currentPatient.patientName ||
      state.currentPatient.systolic ||
      state.currentPatient.diastolic ||
      state.pendingQueue.length > 0 ||
      state.deviceRecords.length > 0
    )
  ) {
    showStatus("success", "Dados restaurados com sucesso neste aparelho após recarregar a página.");
  }

  registerServiceWorker();
  flushQueue({ showErrors: false });
}

function handleAuthSubmit(event) {
  event.preventDefault();

  if (dom.passwordInput.value === APP_CONFIG.access.password) {
    dom.authError.textContent = "";
    setAuthenticated(true);
    dom.passwordInput.value = "";
    showApp();
    initializeApp();
    return;
  }

  dom.authError.textContent = "Senha incorreta.";
  dom.passwordInput.focus();
  dom.passwordInput.select();
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== Number(cpf[9])) {
    return false;
  }

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === Number(cpf[10]);
}

function validateStep(stepKey, rawValue) {
  const value = rawValue.trim();

  if (!value) {
    return "Preencha esse campo para continuar.";
  }

  if (stepKey === "company" && value.length < 2) {
    return "Digite um nome de empresa válido.";
  }

  if (stepKey === "cpf") {
    if (!isValidCpf(value)) {
      return "CPF inválido. Revise os números informados.";
    }
  }

  if (stepKey === "patientName" && value.length < 3) {
    return "Digite o nome completo ou ao menos nome e sobrenome.";
  }

  if (stepKey === "systolic" || stepKey === "diastolic") {
    const numericValue = Number(onlyDigits(value));
    if (!numericValue || numericValue < 50 || numericValue > 280) {
      return "Informe uma pressão em números, dentro de uma faixa válida.";
    }
  }

  if (stepKey === "diastolic") {
    const systolic = Number(state.currentPatient.systolic);
    const diastolic = Number(onlyDigits(value));
    if (diastolic >= systolic) {
      return "A diastólica deve ser menor que a sistólica.";
    }
  }

  return "";
}

function getStepValue(stepKey) {
  if (stepKey === "company") {
    return state.company;
  }

  return state.currentPatient[stepKey];
}

function setStepValue(stepKey, value) {
  if (stepKey === "company") {
    state.company = value.trim();
    return;
  }

  state.currentPatient[stepKey] = value.trim();
}

function mapStepKey(stepKey) {
  const keyMap = {
    cpf: "cpf",
    patientName: "patientName",
    systolic: "systolic",
    diastolic: "diastolic"
  };

  return keyMap[stepKey] || stepKey;
}

function buildSummary() {
  return `${state.currentPatient.systolic}/${state.currentPatient.diastolic}`;
}

function saveState() {
  const persistedState = {
    company: state.company,
    currentStepIndex: state.currentStepIndex,
    currentPatient: state.currentPatient,
    deviceRecords: state.deviceRecords,
    pendingQueue: state.pendingQueue,
    submittedCount: state.submittedCount,
    lastSubmission: state.lastSubmission
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
}

function loadState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (!savedState) {
      return;
    }

    state.company = savedState.company || "";
    state.currentStepIndex = Math.min(
      Math.max(Number(savedState.currentStepIndex) || 0, 0),
      steps.length - 1
    );
    state.currentPatient = {
      cpf: savedState.currentPatient?.cpf || "",
      patientName: savedState.currentPatient?.patientName || "",
      systolic: savedState.currentPatient?.systolic || "",
      diastolic: savedState.currentPatient?.diastolic || ""
    };
    state.deviceRecords = Array.isArray(savedState.deviceRecords) ? savedState.deviceRecords : [];
    state.pendingQueue = Array.isArray(savedState.pendingQueue) ? savedState.pendingQueue : [];
    state.submittedCount = Number(savedState.submittedCount) || 0;
    state.lastSubmission = savedState.lastSubmission || null;
    return true;
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function persistCurrentStepDraft() {
  const step = getCurrentStep();
  if (!step || !dom.stepInput) {
    return;
  }

  const normalizedValue = normalizeInput(step.key, dom.stepInput.value || "");
  const targetKey = mapStepKey(step.key);
  setStepValue(targetKey, normalizedValue);
}

function persistSession() {
  persistCurrentStepDraft();
  saveState();
}

function formatPendingTime(timestamp) {
  if (!timestamp) {
    return "agora";
  }

  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderPendingList() {
  dom.pendingList.innerHTML = "";

  if (state.pendingQueue.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.innerHTML = `
      <div class="pending-name">Fila limpa</div>
      <div class="pending-meta">Os próximos cadastros entram aqui se faltar internet ou confirmação do servidor.</div>
    `;
    dom.pendingList.appendChild(emptyItem);
    dom.pendingPreviewTitle.textContent = "Nenhum cadastro aguardando envio";
    return;
  }

  dom.pendingPreviewTitle.textContent = `${state.pendingQueue.length} aguardando confirmação`;

  state.pendingQueue.slice(0, MAX_PENDING_PREVIEW).forEach((record) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="pending-name">${record.nomePaciente}</div>
      <div class="pending-meta">CPF ${record.cpf} • ${record.resumo} • salvo ${formatPendingTime(record.queuedAt)}</div>
    `;
    dom.pendingList.appendChild(item);
  });

  if (state.pendingQueue.length > MAX_PENDING_PREVIEW) {
    const extraItem = document.createElement("li");
    extraItem.innerHTML = `
      <div class="pending-name">Mais ${state.pendingQueue.length - MAX_PENDING_PREVIEW} cadastro(s)</div>
      <div class="pending-meta">Use o reenviar ou exporte apenas os pendentes para encaminhamento manual.</div>
    `;
    dom.pendingList.appendChild(extraItem);
  }
}

function updateSessionCards() {
  dom.companyValue.textContent = state.company || "Não definida";
  dom.submittedCount.textContent = String(state.submittedCount);
  dom.queueCount.textContent = String(state.pendingQueue.length);
  dom.deviceCount.textContent = String(state.deviceRecords.length);

  if (state.isFlushingQueue) {
    dom.queueStatus.textContent = `Enviando ${state.pendingQueue.length} pendente(s)...`;
    dom.queueHint.textContent = "Você pode continuar cadastrando enquanto a fila é reenviada.";
    dom.retryQueueButton.disabled = true;
    dom.sharePendingCsvButton.disabled = true;
    dom.downloadPendingCsvButton.disabled = true;
  } else if (state.pendingQueue.length > 0) {
    dom.queueStatus.textContent = `${state.pendingQueue.length} cadastro(s) aguardando envio`;
    dom.queueHint.textContent =
      "Os registros ficam salvos neste aparelho até o reenvio completar com sucesso.";
    dom.retryQueueButton.disabled = false;
    dom.sharePendingCsvButton.disabled = false;
    dom.downloadPendingCsvButton.disabled = false;
  } else {
    dom.queueStatus.textContent = "Sem registros pendentes";
    dom.queueHint.textContent =
      "Se a internet cair ou o envio demorar, o cadastro fica salvo no aparelho para reenviar depois.";
    dom.retryQueueButton.disabled = false;
    dom.sharePendingCsvButton.disabled = true;
    dom.downloadPendingCsvButton.disabled = true;
  }

  if (state.deviceRecords.length > 0) {
    const lastSavedRecord = state.deviceRecords[state.deviceRecords.length - 1];
    dom.exportStatus.textContent = `${state.deviceRecords.length} registro(s) prontos para exportar`;
    dom.exportHint.textContent = `Último salvo no celular: ${lastSavedRecord.nomePaciente} • ${lastSavedRecord.resumo}`;
    dom.shareCsvButton.disabled = false;
    dom.copyCsvButton.disabled = false;
    dom.downloadCsvButton.disabled = false;
  } else {
    dom.exportStatus.textContent = "Nenhum CSV gerado ainda";
    dom.exportHint.textContent =
      "Compartilhe um CSV com todos os registros salvos no celular por WhatsApp, Slack, Mensagens ou outro aplicativo.";
    dom.shareCsvButton.disabled = true;
    dom.copyCsvButton.disabled = true;
    dom.downloadCsvButton.disabled = true;
  }

  if (!state.lastSubmission) {
    dom.lastPatient.textContent = "Nenhum paciente ainda";
    dom.lastResult.textContent =
      "Depois do envio, o aplicativo volta automaticamente para o CPF do próximo paciente.";
  } else {
    dom.lastPatient.textContent = state.lastSubmission.patientName;
    dom.lastResult.textContent = `${state.lastSubmission.cpf} • ${state.lastSubmission.summary}`;
  }
  renderPendingList();
}

function showStatus(kind, message) {
  dom.statusCard.className = `status-card is-visible is-${kind}`;
  dom.statusCard.textContent = message;
}

function clearStatus() {
  dom.statusCard.className = "status-card";
  dom.statusCard.textContent = "";
  dom.statusCard.innerHTML = "";
}

function focusInput() {
  window.setTimeout(() => {
    dom.stepInput.focus();
    dom.stepInput.setSelectionRange(dom.stepInput.value.length, dom.stepInput.value.length);
  }, 40);
}

function renderStep() {
  const step = getCurrentStep();
  const isCompanyStep = step.key === "company";
  const currentValue = isCompanyStep
    ? state.company
    : state.currentPatient[mapStepKey(step.key)] || "";

  dom.heroCard.classList.toggle("is-hidden", Boolean(state.company));

  dom.stepLabel.textContent = step.label;
  dom.stepTitle.textContent = step.title;
  dom.stepCounter.textContent = `${state.currentStepIndex + 1}/${steps.length}`;
  dom.fieldLabel.textContent = step.fieldLabel;
  dom.fieldHint.textContent = step.hint;
  dom.nextButton.textContent = step.buttonLabel;
  dom.backButton.disabled = state.currentStepIndex === 0;
  dom.stepInput.value = step.key === "cpf" ? formatCpf(currentValue) : currentValue;
  dom.stepInput.maxLength = step.maxLength;
  dom.stepInput.autocomplete = step.autocomplete;
  dom.stepInput.inputMode = step.inputMode;
  dom.stepInput.autocapitalize = step.autocapitalize;
  dom.stepInput.placeholder = step.placeholder || step.fieldLabel;
  dom.progressBar.style.width = `${((state.currentStepIndex + 1) / steps.length) * 100}%`;
  dom.fieldError.textContent = "";

  focusInput();
  updateSessionCards();
  saveState();
}

function normalizeInput(stepKey, rawValue) {
  if (stepKey === "cpf") {
    return formatCpf(rawValue);
  }

  if (stepKey === "systolic" || stepKey === "diastolic") {
    return onlyDigits(rawValue).slice(0, 3);
  }

  return rawValue;
}

function updateInputValue() {
  const step = getCurrentStep();
  const normalizedValue = normalizeInput(step.key, dom.stepInput.value);
  dom.stepInput.value = normalizedValue;

  const targetKey = mapStepKey(step.key);
  setStepValue(targetKey, normalizedValue);
  persistSession();
}

function getIsoDateTime() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo"
  }).replace(" ", " ");
}

function hasSheetsConfig() {
  return Boolean(APP_CONFIG.googleSheets.appScriptUrl);
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("O envio demorou demais. O cadastro foi salvo na fila para reenviar."));
      }, timeoutMs);
    })
  ]);
}

async function submitRecord(record) {
  if (!hasSheetsConfig()) {
    throw new Error(
      "Configure o APP_CONFIG.googleSheets em app.js com a URL publicada do Google Apps Script."
    );
  }

  const response = await withTimeout(
    fetch(APP_CONFIG.googleSheets.appScriptUrl, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify(record)
    }),
    SEND_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error("O servidor não confirmou o recebimento. O cadastro ficou salvo na fila.");
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error("O Google Sheets respondeu sem confirmar o envio. O cadastro ficou salvo na fila.");
  }

  return payload;
}

function buildRecord() {
  const normalizedCpf = onlyDigits(state.currentPatient.cpf);

  return {
    recordId: crypto.randomUUID(),
    dataHora: getIsoDateTime(),
    empresa: state.company,
    cpf: normalizedCpf,
    nomePaciente: state.currentPatient.patientName,
    pressaoSistolica: state.currentPatient.systolic,
    pressaoDiastolica: state.currentPatient.diastolic,
    resumo: buildSummary()
  };
}

function archiveRecord(record) {
  state.deviceRecords.push(record);
  saveState();
  updateSessionCards();
}

function addToQueue(record) {
  state.pendingQueue.push({
    ...record,
    queuedAt: Date.now()
  });
  saveState();
  updateSessionCards();
}

function markRecordAsSent(record) {
  state.pendingQueue = state.pendingQueue.filter((item) => item.recordId !== record.recordId);
  state.submittedCount += 1;
  state.lastSubmission = {
    patientName: record.nomePaciente,
    cpf: record.cpf,
    summary: record.resumo
  };
  saveState();
  updateSessionCards();
}

async function flushQueue(options = {}) {
  if (state.isFlushingQueue || state.pendingQueue.length === 0) {
    return;
  }

  state.isFlushingQueue = true;
  updateSessionCards();

  let sentNow = 0;

  try {
    while (state.pendingQueue.length > 0) {
      const nextRecord = state.pendingQueue[0];
      await submitRecord(nextRecord);
      markRecordAsSent(nextRecord);
      sentNow += 1;
    }

    if (sentNow > 0) {
      showCompletion(state.lastSubmission
        ? {
            nomePaciente: state.lastSubmission.patientName,
            resumo: state.lastSubmission.summary
          }
        : { nomePaciente: "Registros", resumo: "enviados" });
      showStatus("success", `${sentNow} cadastro(s) enviados com sucesso.`);
    }
  } catch (error) {
    if (options.showErrors !== false) {
      showStatus("error", error.message);
    }
  } finally {
    state.isFlushingQueue = false;
    updateSessionCards();
  }
}

function resetPatientFlow() {
  state.currentPatient = {
    cpf: "",
    patientName: "",
    systolic: "",
    diastolic: ""
  };
  state.currentStepIndex = state.company ? 1 : 0;
  renderStep();
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(records = state.deviceRecords) {
  const headers = [
    "Data e Hora",
    "Empresa",
    "CPF",
    "NomePaciente",
    "Pressão Sistólica",
    "Pressão Diastólica",
    "Resumo Sisto/Diast"
  ];

  const rows = records.map((record) => [
    record.dataHora,
    record.empresa,
    record.cpf,
    record.nomePaciente,
    record.pressaoSistolica,
    record.pressaoDiastolica,
    record.resumo
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

function buildCsvFile(records = state.deviceRecords, filenamePrefix = "pressao-arterial") {
  const csvContent = buildCsvContent(records);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const dateLabel = new Date().toISOString().slice(0, 10);
  return new File([blob], `${filenamePrefix}-${dateLabel}.csv`, {
    type: "text/csv;charset=utf-8"
  });
}

async function copyCsv(records = state.deviceRecords, successMessage = "CSV copiado.") {
  if (records.length === 0) {
    showStatus("error", "Ainda não há registros salvos para copiar.");
    return;
  }

  try {
    await navigator.clipboard.writeText(buildCsvContent(records));
    showStatus("success", successMessage);
  } catch (error) {
    showStatus("error", "Não foi possível copiar o CSV neste aparelho.");
  }
}

async function shareCsv(records = state.deviceRecords, options = {}) {
  if (records.length === 0) {
    showStatus("error", "Ainda não há registros salvos para compartilhar.");
    return;
  }

  const csvFile = buildCsvFile(records, options.filenamePrefix || "pressao-arterial");

  try {
    if (navigator.canShare && navigator.canShare({ files: [csvFile] })) {
      await navigator.share({
        title: options.title || "Pressão arterial",
        text: options.text || "CSV com os registros salvos no celular.",
        files: [csvFile]
      });
      showStatus(
        "success",
        options.successMessage ||
          "Compartilhamento aberto. Escolha WhatsApp, Slack, Mensagens ou outro aplicativo."
      );
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: options.title || "Pressão arterial",
        text: buildCsvContent(records)
      });
      showStatus(
        "success",
        options.textSuccessMessage || "Compartilhamento aberto com o conteudo CSV em texto."
      );
      return;
    }

    await copyCsv(records, options.copySuccessMessage || "CSV copiado para compartilhamento manual.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      showStatus("error", "Não foi possível compartilhar agora. O CSV continua salvo para tentar de novo.");
    }
  }
}

function downloadCsv(records = state.deviceRecords, filenamePrefix = "pressao-arterial") {
  if (records.length === 0) {
    showStatus("error", "Ainda não há registros salvos para exportar.");
    return;
  }

  const csvFile = buildCsvFile(records, filenamePrefix);
  const url = URL.createObjectURL(csvFile);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFile.name;
  link.click();
  URL.revokeObjectURL(url);
  showStatus("success", "CSV baixado no aparelho.");
}

function shareAllRecords() {
  return shareCsv(state.deviceRecords, {
    filenamePrefix: "pressao-arterial",
    title: "Pressão arterial",
    text: "CSV com todos os registros salvos no celular.",
    successMessage: "Compartilhamento do CSV completo aberto."
  });
}

function sharePendingRecords() {
  return shareCsv(state.pendingQueue, {
    filenamePrefix: "pressao-arterial-pendentes",
    title: "Pressão arterial pendentes",
    text: "CSV com os registros pendentes de confirmação.",
    successMessage: "Compartilhamento dos pendentes aberto.",
    copySuccessMessage: "Pendentes copiados para compartilhamento manual."
  });
}

function downloadAllRecords() {
  return downloadCsv(state.deviceRecords, "pressao-arterial");
}

function downloadPendingRecords() {
  return downloadCsv(state.pendingQueue, "pressao-arterial-pendentes");
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showStatus("error", "A instalação não está disponível agora neste navegador.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.installButton.hidden = true;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.error("Falha ao registrar service worker", error);
  }
}

function showCompletion(record) {
  const fragment = dom.completionTemplate.content.cloneNode(true);
  fragment.querySelector("#completionMessage").textContent = `${record.nomePaciente} • ${record.resumo}`;
  dom.statusCard.innerHTML = "";
  dom.statusCard.appendChild(fragment);
  dom.statusCard.className = "status-card is-visible is-success";
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  const step = getCurrentStep();
  const normalizedValue = normalizeInput(step.key, dom.stepInput.value);
  const nextValue = step.key === "cpf" ? formatCpf(normalizedValue) : normalizedValue.trim();
  const error = validateStep(step.key, nextValue);

  if (error) {
    dom.fieldError.textContent = error;
    focusInput();
    return;
  }

  const targetKey = mapStepKey(step.key);
  setStepValue(targetKey, nextValue);

  if (step.key !== "diastolic") {
    state.currentStepIndex += 1;
    renderStep();
    return;
  }

  const record = buildRecord();
  archiveRecord(record);
  addToQueue(record);
  resetPatientFlow();
  dom.nextButton.disabled = true;
  dom.nextButton.textContent = "Enviando...";

  try {
    await flushQueue({ showErrors: true });
    if (state.lastSubmission?.cpf === record.cpf && state.lastSubmission?.patientName === record.nomePaciente) {
      showCompletion(record);
    }
  } catch (error) {
    showStatus("error", error.message);
  } finally {
    dom.nextButton.disabled = false;
    dom.nextButton.textContent = getCurrentStep().buttonLabel;
    updateSessionCards();
  }
}

function goBack() {
  if (state.currentStepIndex === 0) {
    return;
  }

  state.currentStepIndex -= 1;
  clearStatus();
  renderStep();
}

function resetCompany() {
  state.company = "";
  clearStatus();
  showStatus("success", "Empresa limpa. Defina a nova empresa para continuar.");
  resetPatientFlow();
}

function clearLocalData() {
  const hasDataToClear =
    Boolean(state.company) ||
    Boolean(state.currentPatient.cpf) ||
    Boolean(state.currentPatient.patientName) ||
    Boolean(state.currentPatient.systolic) ||
    Boolean(state.currentPatient.diastolic) ||
    state.pendingQueue.length > 0 ||
    state.deviceRecords.length > 0 ||
    state.submittedCount > 0 ||
    Boolean(state.lastSubmission);

  if (!hasDataToClear) {
    showStatus("success", "Não há cache local para limpar.");
    return;
  }

  openConfirmDialog(() => {
    state.company = "";
    state.currentStepIndex = 0;
    state.currentPatient = {
      cpf: "",
      patientName: "",
      systolic: "",
      diastolic: ""
    };
    state.deviceRecords = [];
    state.pendingQueue = [];
    state.isFlushingQueue = false;
    state.submittedCount = 0;
    state.lastSubmission = null;

    localStorage.removeItem(STORAGE_KEY);
    clearStatus();
    renderStep();
    showStatus("success", "Cache local limpo com sucesso neste aparelho.");
  });
}

function retryQueue() {
  clearStatus();
  flushQueue({ showErrors: true });
}

dom.authForm.addEventListener("submit", handleAuthSubmit);
dom.stepInput.addEventListener("input", updateInputValue);
dom.wizardForm.addEventListener("submit", handleSubmit);
dom.backButton.addEventListener("click", goBack);
dom.resetCompanyButton.addEventListener("click", resetCompany);
dom.retryQueueButton.addEventListener("click", retryQueue);
dom.confirmCancelButton.addEventListener("click", closeConfirmDialog);
dom.confirmAcceptButton.addEventListener("click", confirmPendingAction);
dom.copyCsvButton.addEventListener("click", () =>
  copyCsv(
    state.deviceRecords,
    "CSV completo copiado. Agora você pode colar no WhatsApp, Slack, e-mail ou Mensagens."
  )
);
dom.shareCsvButton.addEventListener("click", shareAllRecords);
dom.downloadCsvButton.addEventListener("click", downloadAllRecords);
dom.clearLocalDataButton.addEventListener("click", clearLocalData);
dom.sharePendingCsvButton.addEventListener("click", sharePendingRecords);
dom.downloadPendingCsvButton.addEventListener("click", downloadPendingRecords);
dom.installButton.addEventListener("click", installApp);
window.addEventListener("online", () => flushQueue({ showErrors: false }));
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dom.installButton.hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  dom.installButton.hidden = true;
  showStatus("success", "Aplicativo instalado com sucesso neste aparelho.");
});
window.addEventListener("beforeunload", persistSession);
window.addEventListener("pagehide", persistSession);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    persistSession();
  }
});

document.addEventListener("keydown", (event) => {
  if (dom.confirmOverlay.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeConfirmDialog();
  }
});

if (isAuthenticated()) {
  showApp();
  initializeApp();
} else {
  showAuth();
}
