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

const ROLE_BY_STATUS = { КВ: 'kv', НЖ: 'nzh', ММ: 'mm', ОИ: 'oi', ЛК: 'lk', ЧКВ: 'chkv', ERR: 'err' };
const STATUS_NAMES = {
  КВ: 'квартиры',
  НЖ: 'нежилые',
  ММ: 'машино-места',
  ОИ: 'общее имущество',
  ЛК: '',
  ERR: 'не подошло ни одно правило',
};
const MAIN_STATUSES = ['КВ', 'НЖ', 'ММ']; // от их площади считается доля

const oneDecimal = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function tile(value, label, note = '', wide = false) {
  return `
    <div class="kpi${wide ? ' wide' : ''}">
      <b>${value}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}
    </div>`;
}

/**
 * Плитки: площади дома и статистика по статусам — количество, площадь и доля.
 * Площадь по статусу берётся из столбца «Площадь КВ» и т.п., если он есть в данных;
 * в выгрузке ГИС ЖКХ площадей помещений нет, поэтому пока там 0.
 */
function kpiTiles(house, table) {
  const tiles = [];
  const area = table.get(house, 'area');
  const livingArea = table.get(house, 'livingArea');
  if (toNumber(area)) tiles.push(tile(`${formatNumber(area, 1)} м²`, 'общая площадь'));
  if (toNumber(livingArea)) tiles.push(tile(`${formatNumber(livingArea, 1)} м²`, 'жилая площадь'));

  if (table.has('kv')) {
    const count = (status) => Number(table.get(house, ROLE_BY_STATUS[status])) || 0;
    const areaOf = (status) => {
      const index = table.columns.indexOf(`Площадь ${status}`);
      return index >= 0 ? toNumber(house.values[index]) || 0 : 0;
    };
    const totalArea = MAIN_STATUSES.reduce((sum, s) => sum + areaOf(s), 0);
    const share = (status) => (totalArea ? (areaOf(status) / totalArea) * 100 : 0);
    const total = MAIN_STATUSES.reduce((sum, s) => sum + count(s), 0);

    tiles.push(tile(total, 'помещений: КВ+НЖ+ММ', `${oneDecimal(totalArea)} м² — 100%`, true));
    for (const s of MAIN_STATUSES) {
      tiles.push(
        tile(count(s), `${s} — ${STATUS_NAMES[s]}`, `${oneDecimal(areaOf(s))} м² — ${oneDecimal(share(s))}%`),
      );
    }
    for (const s of ['ОИ', 'ЛК']) {
      const label = STATUS_NAMES[s] ? `${s} — ${STATUS_NAMES[s]}` : s;
      tiles.push(tile(count(s), label, `${oneDecimal(areaOf(s))} м²`));
    }

    const rooms = count('ЧКВ');
    const flats = Number(table.get(house, 'roomFlats')) || 0;
    if (rooms) {
      const where = flats ? ` в ${flats} ${plural(flats, 'квартире', 'квартирах', 'квартирах')}` : '';
      tiles.push(tile(rooms, `ЧКВ — ${plural(rooms, 'комната', 'комнаты', 'комнат')}${where}`));
    }
    if (count('ERR')) tiles.push(tile(count('ERR'), `ERR — ${STATUS_NAMES.ERR}`));
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

// Комнаты (ЧКВ) не показываем отдельными строками, а прячем под свою квартиру.
// Если квартиры с таким номером в списке нет, заводим для комнат строку-группу.
function groupRooms(premises) {
  const rows = [];
  const flats = new Map(); // номер квартиры -> строка
  for (const premise of premises) {
    if (premise.status === 'МКД') continue;
    if (premise.status !== 'ЧКВ') {
      const row = { ...premise, rooms: [] };
      rows.push(row);
      if (premise.status === 'КВ') flats.set(premise.number, row);
      continue;
    }
    let flat = flats.get(premise.number);
    if (!flat) {
      flat = { status: 'ЧКВ', number: premise.number, cadastral: '', rooms: [] };
      flats.set(premise.number, flat);
      rows.push(flat);
    }
    flat.rooms.push(premise);
  }
  return rows;
}

const areaCell = (value) => (toNumber(value) ? `${formatNumber(value, 1)}` : '<span class="muted">—</span>');
const cadastralCell = (value) => (value ? copyable(value) : '<span class="muted">нет</span>');

function premiseRow(row, index) {
  // кнопка раскрытия комнат стоит рядом с номером квартиры: «11 [3 ›]»
  const toggle = row.rooms.length
    ? ` <button class="expand" type="button" data-expand="${index}" aria-expanded="false"
         title="Комнаты в квартире">${row.rooms.length} <span aria-hidden="true">›</span></button>`
    : '';

  const rooms = row.rooms
    .map(
      (room) => `
      <tr class="room" data-room-of="${index}" hidden>
        <td><span class="badge st-ЧКВ">ЧКВ</span></td>
        <td>ком. ${escapeHtml(room.room)}</td>
        <td class="num">${areaCell(room.area)}</td>
        <td>${cadastralCell(room.cadastral)}</td>
      </tr>`,
    )
    .join('');

  return `
    <tr>
      <td><span class="badge st-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
      <td class="nowrap">${escapeHtml(row.number)}${toggle}</td>
      <td class="num">${areaCell(row.area)}</td>
      <td>${cadastralCell(row.cadastral)}</td>
    </tr>${rooms}`;
}

async function renderPremisesTab(container, house, table) {
  const guid = table.get(house, 'guid');
  container.innerHTML = '<p class="muted">Загружаю помещения…</p>';
  try {
    if (!guid) throw new Error('нет GUID дома');
    const rows = groupRooms(sortPremises(await getPremises(guid)));
    if (!rows.length) {
      container.innerHTML = '<p class="muted">В данных ГИС ЖКХ помещений этого дома нет.</p>';
      return;
    }
    container.innerHTML = `
      <div class="ptable">
        <table>
          <thead>
            <tr><th>Статус</th><th>№</th><th class="num">м²</th><th>Кадастровый номер</th></tr>
          </thead>
          <tbody>${rows.map(premiseRow).join('')}</tbody>
        </table>
      </div>`;

    container.querySelectorAll('[data-expand]').forEach((button) => {
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        container.querySelectorAll(`[data-room-of="${button.dataset.expand}"]`).forEach((tr) => {
          tr.hidden = !open;
        });
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="muted">Не удалось загрузить помещения: ${escapeHtml(error.message)}</p>`;
  }
}

// Число строк во вкладке «Помещения»: комнаты ЧКВ спрятаны под квартиры
function premisesCount(house, table) {
  return ['КВ', 'НЖ', 'ММ', 'ОИ', 'ЛК', 'ERR'].reduce(
    (sum, status) => sum + (Number(table.get(house, ROLE_BY_STATUS[status])) || 0),
    0,
  );
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
      <a class="maplink" href="${mapUrl}" target="_blank" rel="noopener noreferrer">Я.карта ↗</a>
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