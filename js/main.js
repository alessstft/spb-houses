import { HOUSES_URL, PAGE_SIZE } from './config.js';
import { HouseTable } from './house-table.js';
import { loadLastFile, parseTable, readFile, saveLastFile } from './file-reader.js';
import { groupByHouse, isPremisesHeader } from './premises-table.js';
import { setLocalPremises } from './premises.js';
import { exportRegistry } from './registry-export.js';
import { escapeHtml, plural } from './utils.js';
import { setStatus, toast } from './ui/notify.js';
import { renderList, renderSummary } from './ui/house-list.js';
import { openHouseCard } from './ui/house-card.js';

const el = {
  empty: document.getElementById('empty'),
  main: document.getElementById('main'),
  form: document.getElementById('searchForm'),
  query: document.getElementById('q'),
  searchBtn: document.getElementById('searchBtn'),
  list: document.getElementById('list'),
  more: document.getElementById('more'),
  source: document.getElementById('source'),
};

const state = {
  table: null,
  found: [],
  limit: PAGE_SIZE,
  appliedQuery: '', // запрос, по которому сейчас показаны результаты
};

// Файл может быть списком домов (spb_houses.csv) или списком помещений
// (выгрузка ГИС ЖКХ, «Фрагмент данных»). Во втором случае дома собираем сами.
function buildTable(rows, fileName) {
  const firstRow = rows.find((row) => row.some((cell) => String(cell).trim())) || [];
  if (!isPremisesHeader(firstRow)) {
    setLocalPremises(null);
    return new HouseTable(rows, fileName);
  }
  const { houseRows, premisesByHouse } = groupByHouse(rows.slice(rows.indexOf(firstRow)));
  setLocalPremises(premisesByHouse);
  return new HouseTable(houseRows, fileName);
}

function showTable(buffer, fileName) {
  const table = buildTable(parseTable(buffer, fileName), fileName);
  state.table = table;

  el.source.textContent = `Источник: ${fileName}`;

  el.empty.classList.add('hidden');
  el.main.classList.remove('hidden');
  setStatus();
  applyFilter();
}

// Кнопка работает как «Найти», пока запрос не выполнен, и как «Сбросить» после.
// Если запрос изменили, она снова становится «Найти».
function updateSearchButton() {
  const showsResults = state.appliedQuery !== '' && el.query.value.trim() === state.appliedQuery;
  el.searchBtn.textContent = showsResults ? 'Сбросить' : 'Найти';
  el.searchBtn.classList.toggle('primary', !showsResults);
}

function applyFilter(query = '') {
  state.appliedQuery = query.trim();
  state.found = state.table.search(state.appliedQuery);
  state.limit = PAGE_SIZE;

  renderSummary(state.found, Boolean(state.appliedQuery));
  renderPage();
  updateSearchButton();
}

function renderPage() {
  renderList(el.list, state.found, { table: state.table, query: state.appliedQuery, limit: state.limit });

  const left = state.found.length - state.limit;
  el.more.parentElement.classList.toggle('hidden', left <= 0);
  el.more.textContent = `Показать ещё ${Math.min(PAGE_SIZE, left)} из ${left.toLocaleString('ru-RU')}`;
}

async function handleExport(house, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Готовлю файл…';
  try {
    const count = await exportRegistry(house, state.table);
    toast(`Готово: ${count} ${plural(count, 'помещение', 'помещения', 'помещений')}`);
  } catch (error) {
    toast(`Не удалось: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function openHouse(house) {
  openHouseCard(house, state.table, {
    onExport: (button) => handleExport(house, button),
    onCopy: () =>
      navigator.clipboard?.writeText(house.address).then(
        () => toast('Адрес скопирован'),
        () => toast('Не удалось скопировать'),
      ),
  });
}

async function handleFile(file) {
  setStatus(`Открываю «${file.name}»…`);
  try {
    const buffer = await readFile(file);
    showTable(buffer, file.name);
    saveLastFile(buffer, file.name);
    toast('Файл загружен');
  } catch (error) {
    setStatus(`Этот файл не подходит: ${error.message}. Нужен CSV или Excel со столбцом адреса.`, true);
  }
}

function bindEvents() {
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const showsResults = el.searchBtn.textContent === 'Сбросить';
    if (showsResults) el.query.value = '';
    applyFilter(el.query.value);
    el.query.blur(); // прячем клавиатуру на телефоне
  });
  el.query.addEventListener('input', updateSearchButton);

  el.list.addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) openHouse(state.found[Number(item.dataset.index)]);
  });

  el.more.addEventListener('click', () => {
    state.limit += PAGE_SIZE;
    renderPage();
  });

  document.querySelectorAll('[data-file]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(input.files[0]);
      input.value = '';
    });
  });

  // Перетаскивание файла на страницу
  for (const type of ['dragenter', 'dragover']) {
    document.addEventListener(type, (e) => {
      e.preventDefault();
      el.empty.classList.add('over');
    });
  }
  document.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) el.empty.classList.remove('over');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    el.empty.classList.remove('over');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });
}

// Основной источник — данные на сайте; сохранённый файл нужен, только если их нет
async function init() {
  bindEvents();

  try {
    setStatus('Загружаю список домов…');
    const response = await fetch(HOUSES_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.statusText);
    showTable(await response.arrayBuffer(), 'spb_houses.csv');
    return;
  } catch {
    setStatus();
  }

  const saved = await loadLastFile();
  if (saved) {
    try {
      showTable(saved.buffer, saved.name);
    } catch {
      // сохранённый файл испорчен — остаётся экран загрузки
    }
  }
}

init();
