import { MANAGEMENT_NAMES } from '../config.js';
import { shortCompanyName } from '../address.js';
import { getPremises, sortPremises } from '../premises.js';
import { escapeHtml, formatNumber, plural, toNumber } from '../utils.js';

const dialog = document.getElementById('dlg');
const titleEl = document.getElementById('dTitle');
const bodyEl = document.getElementById('dBody');

// Роли, которые уже показаны в карточке; в «Остальные поля» они не попадают
const SHOWN_ROLES = [
  'address',
  'status',
  'cadastral',
  'type',
  'state',
  'demolished',
  'management',
  'company',
  'ogrn',
  'area',
  'livingArea',
  'premises',
  'kv',
  'nzh',
  'oi',
  'chkv',
  'roomFlats',
];

let copyHandler = () => {};

document.getElementById('dClose').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // клик по затемнению
});

// Любой элемент с data-copy копирует своё значение по нажатию
dialog.addEventListener('click', (e) => {
  const target = e.target.closest('[data-copy]');
  if (target) copyHandler(target.dataset.copy);
});

const copyable = (value, text = value) =>
  `<button class="copy" type="button" data-copy="${escapeHtml(value)}" title="Нажмите, чтобы скопировать">${escapeHtml(text)}</button>`;

function row(label, valueHtml) {
  return valueHtml ? `<dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd>` : '';
}

function textRow(label, value) {
  return value && value !== '-' ? row(label, escapeHtml(value)) : '';
}

function kpiTiles(house, table) {
  const count = (role) => Number(table.get(house, role)) || 0;
  const tile = (value, label) => `<div class="kpi"><b>${value}</b><span>${label}</span></div>`;
  const tiles = [];

  const area = table.get(house, 'area');
  const livingArea = table.get(house, 'livingArea');
  if (toNumber(area)) tiles.push(tile(`${formatNumber(area, 1)} м²`, 'общая площадь'));
  if (toNumber(livingArea)) tiles.push(tile(`${formatNumber(livingArea, 1)} м²`, 'жилая площадь'));

  if (table.has('kv')) {
    const rooms = count('chkv');
    const flats = count('roomFlats');
    tiles.push(tile(count('kv'), 'КВ — квартиры'));
    tiles.push(tile(count('nzh'), 'НЖ — нежилые'));
    tiles.push(tile(count('oi'), 'ОИ — общее имущество'));
    tiles.push(
      tile(
        rooms,
        `ЧКВ — ${plural(rooms, 'комната', 'комнаты', 'комнат')}` +
          (flats ? ` в ${flats} ${plural(flats, 'квартире', 'квартирах', 'квартирах')}` : ''),
      ),
    );
  }
  return tiles.length ? `<div class="kpis">${tiles.join('')}</div>` : '';
}

// «ТСЖ «МАРАТА 8» (ОГРН 1227800079430)», ОГРН копируется по нажатию
function companyHtml(house, table) {
  const company = shortCompanyName(table.get(house, 'company'));
  const ogrn = table.get(house, 'ogrn');
  if (!company && !ogrn) return '';
  const parts = [];
  if (company) parts.push(escapeHtml(company));
  if (ogrn) parts.push(`(ОГРН ${copyable(ogrn)})`);
  return parts.join(' ');
}

function aboutTab(house, table) {
  const cadastral = table.get(house, 'cadastral');
  const management = table.get(house, 'management');

  const about =
    textRow('Статус', table.get(house, 'status')) +
    row('Кадастровый номер', cadastral ? copyable(cadastral) : '') +
    textRow('Тип дома', table.get(house, 'type')) +
    textRow('Состояние', table.get(house, 'state')) +
    textRow('Дата сноса', table.get(house, 'demolished'));

  const managementRows =
    textRow('Способ управления', MANAGEMENT_NAMES[management] || management) +
    row('УО', companyHtml(house, table));

  const shown = new Set(SHOWN_ROLES.map((role) => table.roles[role]).filter((i) => i >= 0));
  const rest = table.columns
    .map((title, i) => (shown.has(i) ? '' : textRow(title, house.values[i])))
    .join('');

  return `
    ${kpiTiles(house, table)}
    ${about ? `<section class="grp"><h3>О доме</h3><dl>${about}</dl></section>` : ''}
    ${managementRows ? `<section class="grp"><h3>Управление</h3><dl>${managementRows}</dl></section>` : ''}
    ${rest ? `<details class="grp"><summary>Остальные поля</summary><dl>${rest}</dl></details>` : ''}`;
}

function premiseNumber(premise) {
  if (premise.status === 'МКД') return '—';
  return premise.room ? `${premise.number}, ком. ${premise.room}` : premise.number;
}

async function renderPremisesTab(container, house, table) {
  const guid = table.get(house, 'guid');
  container.innerHTML = '<p class="muted">Загружаю помещения…</p>';
  try {
    if (!guid) throw new Error('нет GUID дома');
    const premises = sortPremises(await getPremises(guid)).filter((p) => p.status !== 'МКД');
    if (!premises.length) {
      container.innerHTML = '<p class="muted">В данных ГИС ЖКХ помещений этого дома нет.</p>';
      return;
    }
    const rows = premises
      .map(
        (p) => `
        <tr>
          <td><span class="badge st-${escapeHtml(p.status)}">${escapeHtml(p.status)}</span></td>
          <td>${escapeHtml(premiseNumber(p))}</td>
          <td>${p.cadastral ? copyable(p.cadastral) : '<span class="muted">нет</span>'}</td>
        </tr>`,
      )
      .join('');
    container.innerHTML = `
      <div class="ptable">
        <table>
          <thead><tr><th>Статус</th><th>№</th><th>Кадастровый номер</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (error) {
    container.innerHTML = `<p class="muted">Не удалось загрузить помещения: ${escapeHtml(error.message)}</p>`;
  }
}

function premisesCount(house, table) {
  const count = (role) => Number(table.get(house, role)) || 0;
  return count('kv') + count('nzh') + count('oi') + count('chkv');
}

/**
 * Открывает карточку дома.
 * onExport(button) — по кнопке «Скачать реестр», onCopy(text) — по нажатию на копируемое значение.
 */
export function openHouseCard(house, table, { onExport, onCopy }) {
  copyHandler = onCopy;

  const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(house.address)}`;
  titleEl.innerHTML = `
    ${escapeHtml(house.shortAddress)}
    <span class="sub">
      ${copyable(house.address)}
      <a class="maplink" href="${mapUrl}" target="_blank" rel="noopener">Я.карта</a>
    </span>`;

  const count = premisesCount(house, table);
  bodyEl.innerHTML = `
    <div class="actions">
      <button class="btn primary wide" type="button" data-action="export">Скачать реестр помещений (Excel)</button>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab on" type="button" role="tab" data-tab="about" aria-selected="true">О доме</button>
      <button class="tab" type="button" role="tab" data-tab="premises" aria-selected="false">
        Помещения${count ? ` (${count})` : ''}
      </button>
    </div>
    <div data-panel="about">${aboutTab(house, table)}</div>
    <div data-panel="premises" hidden></div>`;

  bodyEl.querySelector('[data-action="export"]').addEventListener('click', (e) => onExport(e.currentTarget));

  const premisesPanel = bodyEl.querySelector('[data-panel="premises"]');
  let premisesLoaded = false;
  bodyEl.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      bodyEl.querySelectorAll('[data-tab]').forEach((t) => {
        t.classList.toggle('on', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      bodyEl.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== name;
      });
      // помещения грузим только при первом открытии вкладки
      if (name === 'premises' && !premisesLoaded) {
        premisesLoaded = true;
        renderPremisesTab(premisesPanel, house, table);
      }
    });
  });

  if (!dialog.open) dialog.showModal();
  bodyEl.scrollTop = 0;
}
