import { HOUSES_URL, PAGE_SIZE } from './config.js';
import { HouseTable } from './house-table.js';
import { loadLastFile, parseTable, readFile, saveLastFile } from './file-reader.js';
import { exportRegistry } from './registry-export.js';
import { debounce, escapeHtml, plural } from './utils.js';
import { setStatus, toast } from './ui/notify.js';
import { renderList, renderSummary } from './ui/house-list.js';
import { openHouseCard } from './ui/house-card.js';

const el = {
  empty: document.getElementById('empty'),
  main: document.getElementById('main'),
  query: document.getElementById('q'),
  street: document.getElementById('st'),
  streets: document.getElementById('streets'),
  streetHint: document.getElementById('stHint'),
  reset: document.getElementById('reset'),
  list: document.getElementById('list'),
  more: document.getElementById('more'),
  source: document.getElementById('source'),
};

const state = {
  table: null,
  found: [],
  limit: PAGE_SIZE,
};

function showTable(buffer, fileName) {
  const table = new HouseTable(parseTable(buffer, fileName), fileName);
  state.table = table;

  el.streets.innerHTML = table.streets.map((s) => `<option value="${escapeHtml(s)}">`).join('');
  const streetCount = table.streets.length;
  el.streetHint.textContent = `Начните вводить и выберите из списка (${streetCount.toLocaleString('ru-RU')} ${plural(streetCount, 'улица', 'улицы', 'улиц')})`;
  el.source.textContent = `Источник: ${fileName}, ${table.houses.length.toLocaleString('ru-RU')} строк.`;

  el.empty.classList.add('hidden');
  el.main.classList.remove('hidden');
  setStatus();
  applyFilter();
}

function applyFilter() {
  const query = el.query.value;
  const street = el.street.value;

  state.found = state.table.filter({ query, street });
  state.limit = PAGE_SIZE;

  document.getElementById('qWrap').classList.toggle('has', Boolean(query));
  document.getElementById('stWrap').classList.toggle('has', Boolean(street));
  el.reset.classList.toggle('off', !query && !street);

  renderSummary(state.found, Boolean(query.trim() || street.trim()));
  renderPage();
}

function renderPage() {
  renderList(el.list, state.found, { table: state.table, query: el.query.value, limit: state.limit });

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
  const onInput = debounce(applyFilter, 140);
  el.query.addEventListener('input', onInput);
  el.street.addEventListener('input', onInput);
  el.query.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.query.blur(); // прячем клавиатуру на телефоне
  });

  document.querySelectorAll('[data-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.clear);
      input.value = '';
      applyFilter();
      input.focus();
    });
  });

  el.reset.addEventListener('click', () => {
    el.query.value = '';
    el.street.value = '';
    applyFilter();
  });

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

// Сначала показываем файл, который пользователь загружал сам, иначе — данные с сайта
async function init() {
  bindEvents();

  const saved = await loadLastFile();
  if (saved) {
    try {
      showTable(saved.buffer, saved.name);
      return;
    } catch {
      // сохранённый файл испорчен — грузим данные с сайта
    }
  }

  try {
    setStatus('Загружаю список домов…');
    const response = await fetch(HOUSES_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.statusText);
    showTable(await response.arrayBuffer(), 'spb_houses.csv');
  } catch {
    setStatus();
  }
}

init();
