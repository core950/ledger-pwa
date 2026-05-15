const STORAGE_KEY = "ink-ledger-records-v1";
const CLOUD_CONFIG_KEY = "ink-ledger-cloud-config-v1";
const CLOUD_SESSION_KEY = "ink-ledger-cloud-session-v1";
const SYNC_QUEUE_KEY = "ink-ledger-sync-queue-v1";

const state = {
  records: loadRecords(),
  cloud: loadCloudConfig(),
  session: loadCloudSession(),
  syncQueue: loadSyncQueue(),
  preview: [],
  editingId: null,
  deferredPrompt: null,
};

const els = {
  monthBalance: document.querySelector("#monthBalance"),
  monthExpense: document.querySelector("#monthExpense"),
  monthIncome: document.querySelector("#monthIncome"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  entryForm: document.querySelector("#entryForm"),
  typeInput: document.querySelector("#typeInput"),
  amountInput: document.querySelector("#amountInput"),
  categoryInput: document.querySelector("#categoryInput"),
  dateInput: document.querySelector("#dateInput"),
  noteInput: document.querySelector("#noteInput"),
  saveRecordButton: document.querySelector("#saveRecordButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  recordsList: document.querySelector("#recordsList"),
  recordsEmpty: document.querySelector("#recordsEmpty"),
  recordTemplate: document.querySelector("#recordTemplate"),
  searchInput: document.querySelector("#searchInput"),
  monthInput: document.querySelector("#monthInput"),
  dayInput: document.querySelector("#dayInput"),
  dayBalance: document.querySelector("#dayBalance"),
  dayExpense: document.querySelector("#dayExpense"),
  dayIncome: document.querySelector("#dayIncome"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  pasteInput: document.querySelector("#pasteInput"),
  parseButton: document.querySelector("#parseButton"),
  previewList: document.querySelector("#previewList"),
  previewEmpty: document.querySelector("#previewEmpty"),
  importSelectedButton: document.querySelector("#importSelectedButton"),
  categoryChart: document.querySelector("#categoryChart"),
  rankList: document.querySelector("#rankList"),
  statsEmpty: document.querySelector("#statsEmpty"),
  exportButton: document.querySelector("#exportButton"),
  backupInput: document.querySelector("#backupInput"),
  wipeButton: document.querySelector("#wipeButton"),
  installButton: document.querySelector("#installButton"),
  syncStatus: document.querySelector("#syncStatus"),
  syncView: document.querySelector("#syncView"),
  cloudConfigForm: document.querySelector("#cloudConfigForm"),
  supabaseUrlInput: document.querySelector("#supabaseUrlInput"),
  supabaseKeyInput: document.querySelector("#supabaseKeyInput"),
  authForm: document.querySelector("#authForm"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncNowButton: document.querySelector("#syncNowButton"),
  pullCloudButton: document.querySelector("#pullCloudButton"),
};

const categoryRules = [
  ["餐饮", /餐|饭|咖啡|奶茶|麦当劳|肯德基|星巴克|瑞幸|喜茶|奈雪|蜜雪|美团|饿了么|外卖|食|超市|便利店/],
  ["交通", /地铁|公交|滴滴|打车|出租|高铁|铁路|航空|机票|加油|停车|高速/],
  ["购物", /淘宝|天猫|京东|拼多多|抖音|小红书|优衣库|商场|百货|快递/],
  ["住房", /房租|物业|水费|电费|燃气|宽带|话费/],
  ["医疗", /医院|药|门诊|体检|医保/],
  ["娱乐", /电影|游戏|音乐|会员|视频|旅游|酒店/],
  ["工资", /工资|薪资|奖金|劳务|报销/],
  ["理财", /基金|股票|证券|理财|利息|分红/],
  ["转账", /转账|红包|收款|付款|亲属卡/],
];

initialize();

function initialize() {
  const today = new Date();
  els.dateInput.value = formatDate(today);
  els.monthInput.value = formatMonth(today);
  els.supabaseUrlInput.value = state.cloud.url || "";
  els.supabaseKeyInput.value = state.cloud.anonKey || "";
  bindEvents();
  handleQuickLink();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = normalizeAmount(els.amountInput.value);
    if (!amount) return;

    const record = {
      id: state.editingId || crypto.randomUUID(),
      type: els.typeInput.value,
      amount,
      category: els.categoryInput.value.trim() || "未分类",
      date: els.dateInput.value,
      note: els.noteInput.value.trim(),
      source: state.editingId ? getRecordById(state.editingId)?.source || "手动" : "手动",
      createdAt: state.editingId ? getRecordById(state.editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (state.editingId) {
      updateRecord(record, { sync: true });
      stopEditing();
    } else {
      addRecords([record], { sync: true });
    }

    els.amountInput.value = "";
    els.noteInput.value = "";
    els.amountInput.focus();
  });

  [els.searchInput, els.monthInput, els.dayInput].forEach((input) => {
    input.addEventListener("input", renderRecords);
  });
  els.dayInput.addEventListener("input", () => {
    if (els.dayInput.value) els.monthInput.value = els.dayInput.value.slice(0, 7);
    renderRecords();
  });
  els.dateInput.addEventListener("input", renderDailySummary);

  els.clearFiltersButton.addEventListener("click", () => {
    els.searchInput.value = "";
    els.monthInput.value = formatMonth(new Date());
    els.dayInput.value = "";
    renderRecords();
  });
  els.cancelEditButton.addEventListener("click", stopEditing);

  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files[0];
    if (!file) return;
    await loadImportFile(file);
  });

  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("is-dragging"));
  els.dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
    const file = event.dataTransfer.files[0];
    if (!file) return;
    await loadImportFile(file);
  });

  els.parseButton.addEventListener("click", parseImportText);
  els.importSelectedButton.addEventListener("click", importSelectedPreview);
  els.exportButton.addEventListener("click", exportBackup);
  els.backupInput.addEventListener("change", importBackup);
  els.wipeButton.addEventListener("click", wipeData);
  els.cloudConfigForm.addEventListener("submit", saveCloudConfig);
  els.authForm.addEventListener("submit", (event) => event.preventDefault());
  els.syncView.addEventListener("click", handleSyncClick);
  window.addEventListener("online", () => syncNow({ silent: true }));

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installButton.hidden = true;
  });
}

function switchView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  els.views.forEach((panel) => panel.classList.toggle("is-active", panel.id === `${view}View`));
}

function addRecords(records, options = {}) {
  state.records = dedupeRecords([...records, ...state.records]);
  saveRecords();
  if (options.sync) {
    queueUpserts(records);
    syncNow({ silent: true });
  }
  render();
}

function updateRecord(record, options = {}) {
  state.records = state.records.map((item) => (item.id === record.id ? normalizeRecord(record) : item));
  saveRecords();
  if (options.sync) {
    queueUpserts([record]);
    syncNow({ silent: true });
  }
  render();
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function render() {
  renderSummary();
  renderRecords();
  renderStats();
  renderSyncStatus();
}

function renderSummary() {
  const month = els.monthInput.value || formatMonth(new Date());
  const monthRecords = state.records.filter((record) => record.date.startsWith(month));
  const income = sum(monthRecords.filter((record) => record.type === "income"));
  const expense = sum(monthRecords.filter((record) => record.type === "expense"));

  els.monthIncome.textContent = money(income);
  els.monthExpense.textContent = money(expense);
  els.monthBalance.textContent = money(income - expense);
}

function renderRecords() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const month = els.monthInput.value;
  const day = els.dayInput.value;
  const records = state.records
    .filter((record) => !month || record.date.startsWith(month))
    .filter((record) => !day || record.date === day)
    .filter((record) => {
      const text = `${record.category} ${record.note} ${record.source}`.toLowerCase();
      return !keyword || text.includes(keyword);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  els.recordsList.replaceChildren(...createGroupedRecordNodes(records));
  els.recordsEmpty.classList.toggle("is-visible", records.length === 0);
  renderSummary();
  renderDailySummary();
}

function createGroupedRecordNodes(records) {
  const groups = new Map();
  records.forEach((record) => {
    if (!groups.has(record.date)) groups.set(record.date, []);
    groups.get(record.date).push(record);
  });

  return [...groups.entries()].map(([date, items]) => {
    const group = document.createElement("li");
    group.className = "day-group";

    const income = sum(items.filter((record) => record.type === "income"));
    const expense = sum(items.filter((record) => record.type === "expense"));
    const heading = document.createElement("div");
    heading.className = "day-heading";

    const title = document.createElement("strong");
    title.textContent = formatDayLabel(date);

    const total = document.createElement("span");
    total.textContent = `支 ${money(expense)} · 收 ${money(income)}`;

    const list = document.createElement("ol");
    list.className = "day-records";
    list.replaceChildren(...items.map((record) => createRecordNode(record)));

    heading.replaceChildren(title, total);
    group.replaceChildren(heading, list);
    return group;
  });
}

function createRecordNode(record, options = {}) {
  const node = els.recordTemplate.content.firstElementChild.cloneNode(true);
  const checkboxWrap = node.querySelector(".check-wrap");
  const checkbox = node.querySelector("input[type='checkbox']");
  const title = node.querySelector(".record-main strong");
  const meta = node.querySelector(".record-main span");
  const amount = node.querySelector(".record-side b");
  const date = node.querySelector(".record-side small");
  const editButton = node.querySelector(".edit-button");
  const deleteButton = node.querySelector(".delete-button");

  title.textContent = record.category;
  meta.textContent = [record.note || "无备注", record.source].filter(Boolean).join(" · ");
  amount.textContent = `${record.type === "income" ? "+" : "-"}${money(record.amount)}`;
  amount.className = record.type;
  date.textContent = record.date;

  if (options.preview) {
    checkboxWrap.hidden = false;
    checkbox.dataset.id = record.id;
    editButton.hidden = true;
    deleteButton.hidden = true;
  } else {
    editButton.addEventListener("click", () => startEditing(record.id));
    deleteButton.addEventListener("click", () => {
      state.records = state.records.filter((item) => item.id !== record.id);
      saveRecords();
      queueDelete(record.id);
      syncNow({ silent: true });
      render();
    });
  }

  return node;
}

function renderDailySummary() {
  const day = els.dayInput.value || els.dateInput.value || formatDate(new Date());
  const dayRecords = state.records.filter((record) => record.date === day);
  const income = sum(dayRecords.filter((record) => record.type === "income"));
  const expense = sum(dayRecords.filter((record) => record.type === "expense"));

  els.dayIncome.textContent = money(income);
  els.dayExpense.textContent = money(expense);
  els.dayBalance.textContent = money(income - expense);
}

function startEditing(id) {
  const record = getRecordById(id);
  if (!record) return;
  state.editingId = id;
  els.typeInput.value = record.type;
  els.amountInput.value = record.amount;
  els.categoryInput.value = record.category;
  els.dateInput.value = record.date;
  els.noteInput.value = record.note || "";
  els.saveRecordButton.textContent = "保存修改";
  els.cancelEditButton.hidden = false;
  els.entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditing() {
  state.editingId = null;
  els.saveRecordButton.textContent = "记一笔";
  els.cancelEditButton.hidden = true;
  els.typeInput.value = "expense";
  els.categoryInput.value = "";
  els.dateInput.value = formatDate(new Date());
  els.amountInput.value = "";
  els.noteInput.value = "";
}

function getRecordById(id) {
  return state.records.find((record) => record.id === id);
}

function handleQuickLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("quick")) return;

  const amount = normalizeAmount(params.get("amount") || "");
  const record = {
    id: crypto.randomUUID(),
    type: params.get("type") === "income" ? "income" : "expense",
    amount,
    category: params.get("category") || "快捷记账",
    date: params.get("date") || formatDate(new Date()),
    note: params.get("note") || "背面轻点",
    source: "快捷指令",
    createdAt: new Date().toISOString(),
  };

  switchView("records");

  if (params.get("auto") === "1" && amount) {
    addRecords([record], { sync: true });
    history.replaceState(null, "", window.location.pathname);
    return;
  }

  els.typeInput.value = record.type;
  els.amountInput.value = amount || "";
  els.categoryInput.value = record.category;
  els.dateInput.value = record.date;
  els.noteInput.value = record.note;
  history.replaceState(null, "", window.location.pathname);
}

function parseImportText() {
  const text = els.pasteInput.value.trim();
  state.preview = text ? parseBillText(text) : [];
  renderPreview();
}

async function loadImportFile(file) {
  try {
    els.pasteInput.value = await readBillFile(file);
    parseImportText();
    if (!state.preview.length) {
      alert("没有识别到账单记录。请确认文件是微信支付导出的账单明细，或把文件另存为 CSV/TXT 后再试。");
    }
  } catch (error) {
    alert(error.message || "账单文件读取失败。");
  }
}

async function readBillFile(file) {
  const buffer = await file.arrayBuffer();
  if (isXlsxFile(file, buffer)) {
    return xlsxRowsToText(await readXlsxRows(buffer));
  }

  const decoders = ["utf-8", "gb18030", "gbk", "big5"];
  const candidates = decoders
    .map((encoding) => decodeBuffer(buffer, encoding))
    .filter(Boolean)
    .map((text) => ({ text, score: scoreBillText(text) }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.text || await file.text();
}

function isXlsxFile(file, buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return isZip || /\.xlsx$/i.test(file.name);
}

async function readXlsxRows(buffer) {
  const entries = parseZipDirectory(buffer);
  const sharedStringsXml = await readZipText(buffer, entries.get("xl/sharedStrings.xml"));
  const workbookRelsXml = await readZipText(buffer, entries.get("xl/_rels/workbook.xml.rels"));
  const sheetPath = findFirstSheetPath(workbookRelsXml, entries);
  const sheetXml = await readZipText(buffer, entries.get(sheetPath));
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseSheetRows(sheetXml, sharedStrings);
  return normalizeXlsxRows(rows);
}

function parseZipDirectory(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;

  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }

  if (eocd < 0) throw new Error("无法读取 Excel 文件结构。");

  const entries = new Map();
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipText(buffer, entry) {
  if (!entry) throw new Error("Excel 文件缺少必要工作表。");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;

  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Excel 文件内容损坏。");

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const data = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return new TextDecoder("utf-8").decode(data);
  if (entry.method !== 8) throw new Error("暂不支持这个 Excel 压缩格式。");
  if (!("DecompressionStream" in window)) {
    throw new Error("当前浏览器不支持直接读取 XLSX。请把微信账单另存为 CSV/TXT 后导入，或在电脑网页端导入并同步到手机。");
  }

  const inflated = await inflateRaw(data);
  return new TextDecoder("utf-8").decode(inflated);
}

async function inflateRaw(data) {
  const formats = ["deflate-raw", "deflate"];
  let lastError;

  for (const format of formats) {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
      return await new Response(stream).arrayBuffer();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Excel 解压失败。");
}

function findFirstSheetPath(workbookRelsXml, entries) {
  const fallback = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!workbookRelsXml) return fallback;

  const doc = new DOMParser().parseFromString(workbookRelsXml, "application/xml");
  const rel = [...doc.querySelectorAll("Relationship")].find((item) =>
    /worksheet/.test(item.getAttribute("Type") || ""),
  );
  const target = rel?.getAttribute("Target")?.replace(/^\/+/, "");
  if (!target) return fallback;
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.querySelectorAll("si")].map((item) =>
    [...item.querySelectorAll("t")].map((textNode) => textNode.textContent || "").join(""),
  );
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.querySelectorAll("sheetData row")].map((row) => {
    const cells = [];
    row.querySelectorAll("c").forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const column = columnNameToIndex(ref.replace(/\d/g, ""));
      cells[column] = readCellValue(cell, sharedStrings);
    });
    return cells.map((value) => value ?? "");
  });
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "s") {
    const index = Number(cell.querySelector("v")?.textContent || 0);
    return sharedStrings[index] || "";
  }
  if (type === "inlineStr") {
    return [...cell.querySelectorAll("t")].map((node) => node.textContent || "").join("");
  }
  return cell.querySelector("v")?.textContent || "";
}

function normalizeXlsxRows(rows) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return rows;

  const header = rows[headerIndex].map(normalizeHeader);
  const indexes = inferIndexes(header);
  return rows.map((row, index) => {
    if (index <= headerIndex || indexes.date == null) return row;
    const next = [...row];
    next[indexes.date] = normalizeExcelDate(next[indexes.date]);
    return next;
  });
}

function xlsxRowsToText(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value = "") {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function columnNameToIndex(name) {
  return name
    .toUpperCase()
    .split("")
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function normalizeExcelDate(value) {
  const text = cleanCell(value);
  if (extractDate(text)) return text;
  if (!/^\d+(?:\.\d+)?$/.test(text)) return text;

  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return text;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return formatDate(date);
}

function decodeBuffer(buffer, encoding) {
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return "";
  }
}

function scoreBillText(text) {
  const replacementPenalty = (text.match(/\uFFFD/g) || []).length * 10;
  const keywordScore = [
    /微信支付账单/,
    /交易时间/,
    /交易类型/,
    /交易对方/,
    /商品/,
    /收\/支|收支|收入\/支出/,
    /金额(?:\(元\))?/,
    /支付方式/,
    /当前状态/,
    /交易单号/,
  ].reduce((score, pattern) => score + (pattern.test(text) ? 20 : 0), 0);

  return keywordScore - replacementPenalty;
}

function renderPreview() {
  els.previewList.replaceChildren(...state.preview.map((record) => createRecordNode(record, { preview: true })));
  els.previewEmpty.classList.toggle("is-visible", state.preview.length === 0);
  els.importSelectedButton.disabled = state.preview.length === 0;
}

function importSelectedPreview() {
  const selectedIds = new Set(
    [...els.previewList.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.dataset.id),
  );
  const selected = state.preview.filter((record) => selectedIds.has(record.id));
  if (!selected.length) return;
  addRecords(selected, { sync: true });
  state.preview = [];
  els.pasteInput.value = "";
  els.fileInput.value = "";
  renderPreview();
  switchView("records");
}

function parseBillText(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\t+|\t+$/g, "").trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((line) => splitRow(line, delimiter)).filter((row) => row.some(Boolean));
  const headerIndex = findHeaderRow(rows);
  const hasHeader = headerIndex >= 0;
  const header = hasHeader ? rows[headerIndex].map(normalizeHeader) : [];
  const body = hasHeader ? rows.slice(headerIndex + 1) : rows;
  const indexes = hasHeader ? inferIndexes(header) : {};

  return body
    .map((row) => parseRow(row, indexes))
    .filter(Boolean)
    .map((record) => ({
      ...record,
      id: crypto.randomUUID(),
      source: "账单导入",
      createdAt: new Date().toISOString(),
    }));
}

function parseRow(row, indexes) {
  const joined = row.join(" ");
  const date = extractDate(indexes.date != null ? row[indexes.date] : joined);
  const amountValue = findAmountValue(row, indexes);
  const amount = normalizeAmount(amountValue);

  if (!date || !amount) return null;

  const typeText = [row[indexes.type], row[indexes.direction], joined].filter(Boolean).join(" ");
  const type = inferRowType(row, indexes, typeText, amountValue);
  const note = inferNote(row, indexes);
  const category = inferCategory(`${note} ${typeText}`);

  return { type, amount, category, date, note };
}

function inferIndexes(header) {
  const expenseIndex = findIndex(header, /支出|消费|debit/);
  const incomeIndex = findIndex(header, /收入|入账|credit/);
  return {
    date: findIndex(header, /交易时间|创建时间|付款时间|日期|时间|date|time/),
    amount: findIndex(header, /^金额|金额\(元\)|交易金额|人民币|amount|money/) ?? expenseIndex ?? incomeIndex,
    expense: expenseIndex,
    income: incomeIndex,
    type: findIndex(header, /^收\/支$|^收支$|类型|交易类型|方向|type|direction/),
    direction: findIndex(header, /借贷|收\/支|收入\/支出|方向/),
    merchant: findIndex(header, /交易对方|商户|对方|收款方|付款方|merchant|payee/),
    note: findIndex(header, /商品|商品名称|说明|备注|摘要|用途|note|memo|description/),
    status: findIndex(header, /状态|当前状态|status/),
  };
}

function findHeaderRow(rows) {
  return rows.findIndex((row, index) => {
    if (index > 20) return false;
    const headerText = row.map(normalizeHeader).join("|");
    const hasDate = /date|time|日期|时间/.test(headerText);
    const hasMoney = /amount|money|金额|人民币|支出|收入/.test(headerText);
    const hasContext = /type|note|memo|merchant|交易|商品|商户|对方|收\/支|收支|支付方式|当前状态/.test(headerText);
    return hasDate && hasMoney && hasContext;
  });
}

function findIndex(items, pattern) {
  const index = items.findIndex((item) => pattern.test(item));
  return index >= 0 ? index : undefined;
}

function inferType(text, amountText = "") {
  const value = `${text} ${amountText}`;
  if (/收入|收款|入账|贷|refund|退款|\+/.test(value)) return "income";
  if (/支出|付款|消费|借|debit|转出|-/.test(value)) return "expense";
  return normalizeAmount(amountText) < 0 ? "expense" : "expense";
}

function inferRowType(row, indexes, typeText, amountValue) {
  if (indexes.income != null && normalizeAmount(row[indexes.income])) return "income";
  if (indexes.expense != null && normalizeAmount(row[indexes.expense])) return "expense";
  return inferType(typeText, amountValue);
}

function inferNote(row, indexes) {
  const candidates = [row[indexes.merchant], row[indexes.note]].concat(
    row.filter((cell, index) => {
      if (!cell || index === indexes.status || index === indexes.type || index === indexes.direction) return false;
      return !extractDate(cell) && !normalizeAmount(cell) && !/支付成功|已全额退款|交易关闭|对方已收钱/.test(cell);
    }),
  );
  return cleanCell(candidates.find(Boolean) || "导入账单");
}

function inferCategory(text) {
  const match = categoryRules.find(([, pattern]) => pattern.test(text));
  if (!match) return "未分类";
  return match[0];
}

function extractDate(text = "") {
  const normalized = cleanCell(text);
  const match = normalized.match(/(20\d{2}|19\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function findAmountValue(row, indexes) {
  const income = indexes.income != null ? normalizeAmount(row[indexes.income]) : 0;
  const expense = indexes.expense != null ? normalizeAmount(row[indexes.expense]) : 0;
  if (income) return row[indexes.income];
  if (expense) return row[indexes.expense];
  if (indexes.amount != null && row[indexes.amount]) return row[indexes.amount];
  return findAmountCell(row);
}

function findAmountCell(row) {
  return (
    row.find((cell) => {
      const text = cleanCell(cell);
      return (
        !extractDate(text) &&
        !/^\d{12,}$/.test(text.replace(/\D/g, "")) &&
        /[¥￥元+-]?\s*\d+(?:,\d{3})*(?:\.\d+)?/.test(text) &&
        normalizeAmount(text)
      );
    }) || ""
  );
}

function normalizeAmount(value = "") {
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[¥￥元\s]/g, "")
    .replace(/[()]/g, "-")
    .match(/[+-]?\d+(?:\.\d+)?/);
  return cleaned ? Math.abs(Number(cleaned[0])) : 0;
}

function detectDelimiter(lines) {
  const sample = lines.slice(0, 30).join("\n");
  const candidates = [",", "\t", ";", "|"];
  return candidates.sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
}

function splitRow(line, delimiter) {
  if (delimiter !== ",") return line.split(delimiter).map(cleanCell);

  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cleanCell(current));
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(cleanCell(current));
  return cells;
}

function cleanCell(value = "") {
  return String(value)
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

function normalizeHeader(value = "") {
  return cleanCell(value).toLowerCase().replace(/\s/g, "");
}

function renderStats() {
  const month = els.monthInput.value || formatMonth(new Date());
  const expenses = state.records.filter((record) => record.type === "expense" && record.date.startsWith(month));
  const groups = expenses.reduce((result, record) => {
    result[record.category] = (result[record.category] || 0) + record.amount;
    return result;
  }, {});
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 0;

  els.categoryChart.replaceChildren(
    ...entries.map(([category, amount]) => {
      const item = document.createElement("div");
      item.className = "bar";
      item.innerHTML = `<span></span><div class="bar-track"><div class="bar-fill"></div></div><b></b>`;
      item.querySelector("span").textContent = category;
      item.querySelector(".bar-fill").style.width = `${Math.max(6, (amount / max) * 100)}%`;
      item.querySelector("b").textContent = money(amount);
      return item;
    }),
  );

  els.rankList.replaceChildren(
    ...entries.map(([category, amount]) => {
      const item = document.createElement("li");
      item.innerHTML = `<span></span><strong></strong>`;
      item.querySelector("span").textContent = category;
      item.querySelector("strong").textContent = money(amount);
      return item;
    }),
  );

  els.statsEmpty.classList.toggle("is-visible", entries.length === 0);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ records: state.records }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ink-ledger-${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importBackup() {
  const file = els.backupInput.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.records)) return;
  state.records = dedupeRecords([...data.records, ...state.records]);
  saveRecords();
  queueUpserts(state.records);
  syncNow({ silent: true });
  render();
}

function wipeData() {
  if (!confirm("确定清空本地所有记账数据？云端数据不会自动清空。")) return;
  state.records = [];
  saveRecords();
  render();
}

function loadCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCloudConfig(event) {
  event.preventDefault();
  state.cloud = {
    url: normalizeSupabaseUrl(els.supabaseUrlInput.value),
    anonKey: els.supabaseKeyInput.value.trim(),
  };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(state.cloud));
  setSyncStatus("云配置已保存。登录后即可同步。", "ok");
}

function loadCloudSession() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function saveCloudSession(session) {
  state.session = session;
  if (session) {
    localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(CLOUD_SESSION_KEY);
  }
}

async function handleSyncClick(event) {
  const button = event.target.closest("[data-sync-action]");
  if (!button) return;

  event.preventDefault();
  const action = button.dataset.syncAction;
  button.disabled = true;

  try {
    if (action === "signin") await signInOrUp("signin");
    if (action === "signup") await signInOrUp("signup");
    if (action === "signout") signOut();
    if (action === "sync") await syncNow({ pullFirst: false });
    if (action === "pull") await syncNow({ pullFirst: true });
  } finally {
    button.disabled = false;
  }
}

function loadSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || { upserts: [], deletes: [] };
  } catch {
    return { upserts: [], deletes: [] };
  }
}

function saveSyncQueue() {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(state.syncQueue));
}

function queueUpserts(records) {
  const byId = new Map(state.syncQueue.upserts.map((record) => [record.id, record]));
  records.forEach((record) => byId.set(record.id, normalizeRecord(record)));
  state.syncQueue.upserts = [...byId.values()];
  state.syncQueue.deletes = state.syncQueue.deletes.filter((id) => !byId.has(id));
  saveSyncQueue();
}

function queueDelete(id) {
  state.syncQueue.upserts = state.syncQueue.upserts.filter((record) => record.id !== id);
  if (!state.syncQueue.deletes.includes(id)) state.syncQueue.deletes.push(id);
  saveSyncQueue();
}

async function signInOrUp(mode) {
  try {
    ensureCloudConfig();
    const email = els.emailInput.value.trim();
    const password = els.passwordInput.value;
    if (!email || !password) throw new Error("请输入邮箱和密码。");

    const path = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    const session = await supabaseFetch(path, {
      method: "POST",
      auth: false,
      body: { email, password },
    });

    if (!session.access_token && mode === "signup") {
      setSyncStatus("注册成功。若 Supabase 开启了邮箱验证，请先去邮箱确认，再回来登录。", "ok");
      return;
    }

    saveCloudSession(session);
    setSyncStatus("已登录，正在同步。", "ok");
    await syncNow({ pullFirst: true });
  } catch (error) {
    setSyncStatus(error.message, "error");
  }
}

function signOut() {
  saveCloudSession(null);
  setSyncStatus("已退出登录。本地数据仍保留。", "");
  renderSyncStatus();
}

async function syncNow(options = {}) {
  if (!isCloudReady()) {
    if (!options.silent) setSyncStatus("请先保存 Supabase 配置并登录。", "error");
    return;
  }

  try {
    if (options.pullFirst) await pullCloudRecords();
    await flushDeletes();
    await flushUpserts();
    await pullCloudRecords();
    setSyncStatus(`同步完成：${new Date().toLocaleString("zh-CN")}`, "ok", false);
  } catch (error) {
    if (!options.silent) setSyncStatus(error.message, "error", false);
  }
}

async function flushUpserts() {
  if (!state.syncQueue.upserts.length) return;
  const rows = state.syncQueue.upserts.map(recordToRemote);
  await supabaseFetch("/rest/v1/ledger_records?on_conflict=id", {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates",
  });
  state.syncQueue.upserts = [];
  saveSyncQueue();
}

async function flushDeletes() {
  if (!state.syncQueue.deletes.length) return;
  const ids = [...state.syncQueue.deletes];
  await Promise.all(
    ids.map((id) =>
      supabaseFetch(`/rest/v1/ledger_records?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    ),
  );
  state.syncQueue.deletes = [];
  saveSyncQueue();
}

async function pullCloudRecords() {
  const rows = await supabaseFetch("/rest/v1/ledger_records?select=*&order=date.desc,created_at.desc", {
    method: "GET",
  });
  const remoteRecords = rows.map(remoteToRecord);
  state.records = dedupeRecords([...remoteRecords, ...state.records]);
  saveRecords();
  render();
}

async function supabaseFetch(path, options = {}) {
  ensureCloudConfig();
  const headers = {
    apikey: state.cloud.anonKey,
    "Content-Type": "application/json",
  };

  if (options.auth !== false) {
    if (!state.session?.access_token) throw new Error("请先登录云同步账号。");
    headers.Authorization = `Bearer ${state.session.access_token}`;
  }

  if (options.prefer) headers.Prefer = options.prefer;
  if (options.method === "POST" && path.startsWith("/rest/")) {
    headers.Prefer = [headers.Prefer, "return=minimal"].filter(Boolean).join(",");
  }

  const response = await fetch(`${state.cloud.url}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `云同步请求失败：${response.status}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function ensureCloudConfig() {
  if (!state.cloud.url || !state.cloud.anonKey) throw new Error("请先填写并保存 Supabase URL 和 anon key。");
}

function isCloudReady() {
  return Boolean(state.cloud.url && state.cloud.anonKey && state.session?.access_token);
}

function renderSyncStatus() {
  const queued = state.syncQueue.upserts.length + state.syncQueue.deletes.length;
  if (isCloudReady()) {
    setSyncStatus(`已连接云同步。待同步 ${queued} 条。`, queued ? "" : "ok", false);
  } else if (state.cloud.url && state.cloud.anonKey) {
    setSyncStatus("云配置已保存，尚未登录。", "", false);
  } else {
    setSyncStatus("未连接云同步。", "", false);
  }
}

function setSyncStatus(message, tone = "", update = true) {
  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("is-ok", tone === "ok");
  els.syncStatus.classList.toggle("is-error", tone === "error");
  if (update) renderSyncStatus();
}

function normalizeSupabaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeRecord(record) {
  return {
    id: record.id,
    type: record.type,
    amount: Number(record.amount),
    category: record.category || "未分类",
    date: record.date,
    note: record.note || "",
    source: record.source || "手动",
    createdAt: record.createdAt || new Date().toISOString(),
  };
}

function recordToRemote(record) {
  const item = normalizeRecord(record);
  return {
    id: item.id,
    type: item.type,
    amount: item.amount,
    category: item.category,
    record_date: item.date,
    note: item.note,
    source: item.source,
    created_at: item.createdAt,
  };
}

function remoteToRecord(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    date: row.record_date,
    note: row.note || "",
    source: row.source || "云端",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function dedupeRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = [record.date, record.type, record.amount, record.category, record.note].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sum(records) {
  return records.reduce((total, record) => total + Number(record.amount || 0), 0);
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonth(date) {
  return formatDate(date).slice(0, 7);
}

function formatDayLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  const today = formatDate(new Date());
  if (value === today) return "今天";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === formatDate(yesterday)) return "昨天";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
