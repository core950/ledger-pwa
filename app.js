const STORAGE_KEY = "ink-ledger-records-v1";

const state = {
  records: loadRecords(),
  preview: [],
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
  recordsList: document.querySelector("#recordsList"),
  recordsEmpty: document.querySelector("#recordsEmpty"),
  recordTemplate: document.querySelector("#recordTemplate"),
  searchInput: document.querySelector("#searchInput"),
  monthInput: document.querySelector("#monthInput"),
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
};

const categoryRules = [
  ["餐饮", /餐|饭|咖啡|奶茶|麦当劳|肯德基|美团|饿了么|外卖|食|超市|便利店/],
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
  bindEvents();
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

    addRecords([
      {
        id: crypto.randomUUID(),
        type: els.typeInput.value,
        amount,
        category: els.categoryInput.value.trim() || "未分类",
        date: els.dateInput.value,
        note: els.noteInput.value.trim(),
        source: "手动",
        createdAt: new Date().toISOString(),
      },
    ]);

    els.amountInput.value = "";
    els.noteInput.value = "";
    els.amountInput.focus();
  });

  [els.searchInput, els.monthInput].forEach((input) => {
    input.addEventListener("input", renderRecords);
  });

  els.clearFiltersButton.addEventListener("click", () => {
    els.searchInput.value = "";
    els.monthInput.value = formatMonth(new Date());
    renderRecords();
  });

  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files[0];
    if (!file) return;
    els.pasteInput.value = await file.text();
    parseImportText();
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
    els.pasteInput.value = await file.text();
    parseImportText();
  });

  els.parseButton.addEventListener("click", parseImportText);
  els.importSelectedButton.addEventListener("click", importSelectedPreview);
  els.exportButton.addEventListener("click", exportBackup);
  els.backupInput.addEventListener("change", importBackup);
  els.wipeButton.addEventListener("click", wipeData);

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

function addRecords(records) {
  state.records = dedupeRecords([...records, ...state.records]);
  saveRecords();
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
  const records = state.records
    .filter((record) => !month || record.date.startsWith(month))
    .filter((record) => {
      const text = `${record.category} ${record.note} ${record.source}`.toLowerCase();
      return !keyword || text.includes(keyword);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  els.recordsList.replaceChildren(...records.map((record) => createRecordNode(record)));
  els.recordsEmpty.classList.toggle("is-visible", records.length === 0);
  renderSummary();
}

function createRecordNode(record, options = {}) {
  const node = els.recordTemplate.content.firstElementChild.cloneNode(true);
  const checkboxWrap = node.querySelector(".check-wrap");
  const checkbox = node.querySelector("input[type='checkbox']");
  const title = node.querySelector(".record-main strong");
  const meta = node.querySelector(".record-main span");
  const amount = node.querySelector(".record-side b");
  const date = node.querySelector(".record-side small");
  const deleteButton = node.querySelector(".delete-button");

  title.textContent = record.category;
  meta.textContent = [record.note || "无备注", record.source].filter(Boolean).join(" · ");
  amount.textContent = `${record.type === "income" ? "+" : "-"}${money(record.amount)}`;
  amount.className = record.type;
  date.textContent = record.date;

  if (options.preview) {
    checkboxWrap.hidden = false;
    checkbox.dataset.id = record.id;
    deleteButton.hidden = true;
  } else {
    deleteButton.addEventListener("click", () => {
      state.records = state.records.filter((item) => item.id !== record.id);
      saveRecords();
      render();
    });
  }

  return node;
}

function parseImportText() {
  const text = els.pasteInput.value.trim();
  state.preview = text ? parseBillText(text) : [];
  renderPreview();
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
  addRecords(selected);
  state.preview = [];
  els.pasteInput.value = "";
  els.fileInput.value = "";
  renderPreview();
  switchView("records");
}

function parseBillText(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
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
  const amountValue = indexes.amount != null && row[indexes.amount] ? row[indexes.amount] : findAmountCell(row);
  const amount = normalizeAmount(amountValue);

  if (!date || !amount) return null;

  const typeText = [row[indexes.type], row[indexes.direction], joined].filter(Boolean).join(" ");
  const type = inferType(typeText, amountValue);
  const note = inferNote(row, indexes);
  const category = inferCategory(`${note} ${typeText}`);

  return { type, amount, category, date, note };
}

function inferIndexes(header) {
  const expenseIndex = findIndex(header, /支出|消费|debit/);
  const incomeIndex = findIndex(header, /收入|入账|credit/);
  return {
    date: findIndex(header, /交易时间|创建时间|付款时间|日期|时间|date|time/),
    amount: findIndex(header, /金额|人民币|amount|money/) ?? expenseIndex ?? incomeIndex,
    type: findIndex(header, /收支|类型|交易类型|方向|type|direction/),
    direction: findIndex(header, /借贷|收\/支|收入\/支出|方向/),
    merchant: findIndex(header, /交易对方|商户|对方|收款方|付款方|merchant|payee/),
    note: findIndex(header, /商品|说明|备注|摘要|用途|note|memo|description/),
  };
}

function findHeaderRow(rows) {
  return rows.findIndex((row, index) => {
    if (index > 20) return false;
    const headerText = row.map(normalizeHeader).join("|");
    const hasDate = /date|time|日期|时间/.test(headerText);
    const hasMoney = /amount|money|金额|人民币|支出|收入/.test(headerText);
    const hasContext = /type|note|memo|merchant|交易|商品|商户|对方|收\/支|收支/.test(headerText);
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

function inferNote(row, indexes) {
  const candidates = [row[indexes.merchant], row[indexes.note]]
    .concat(row.filter((cell) => cell && !extractDate(cell) && !normalizeAmount(cell)));
  return cleanCell(candidates.find(Boolean) || "导入账单");
}

function inferCategory(text) {
  const match = categoryRules.find(([, pattern]) => pattern.test(text));
  if (!match) return "未分类";
  return match[0];
}

function extractDate(text = "") {
  const normalized = cleanCell(text);
  const match = normalized.match(/(20\d{2}|19\d{2})[/-年.](\d{1,2})[/-月.](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function findAmountCell(row) {
  return (
    row.find((cell) => {
      const text = cleanCell(cell);
      return !extractDate(text) && /[¥￥元+-]?\s*\d+(?:,\d{3})*(?:\.\d+)?/.test(text) && normalizeAmount(text);
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
  const sample = lines.slice(0, 4).join("\n");
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
  return String(value).replace(/^"+|"+$/g, "").trim();
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
  render();
}

function wipeData() {
  if (!confirm("确定清空本地所有记账数据？")) return;
  state.records = [];
  saveRecords();
  render();
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
