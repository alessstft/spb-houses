import { MANAGEMENT_NAMES } from '../config.js';
import { shortCompanyName } from '../address.js';
import { escapeHtml, formatNumber, plural, toNumber } from '../utils.js';

const dialog = document.getElementById('dlg');
const titleEl = document.getElementById('dTitle');
const bodyEl = document.getElementById('dBody');

document.getElementById('dClose').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // клик по затемнению
});

function kpiTiles(house, table) {
  const count = (role) => Number(table.get(house, role)) || 0;
  const tile = (value, label, extra = '') =>
    `<div class="kpi ${extra}"><b>${value}</b><span>${label}</span></div>`;
  const tiles = [];

  const area = table.get(house, 'area');
  const livingArea = table.get(house, 'livingArea');
  if (toNumber(area)) tiles.push(tile(`${formatNumber(area, 1)} м²`, 'общая площадь'));
  if (toNumber(livingArea)) tiles.push(tile(`${formatNumber(livingArea, 1)} м²`, 'жилая площадь'));

  if (table.has('kv')) {
    tiles.push(tile(count('kv'), 'КВ — квартиры'));
    tiles.push(tile(count('nzh'), 'НЖ — нежилые'));
    tiles.push(tile(count('oi'), 'ОИ — общее имущество'));
    const rooms = count('chkv');
    const flats = count('roomFlats');
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

function field(label, value) {
  if (!value || value === '-') return '';
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function detailGroups(house, table) {
  const management = table.get(house, 'management');
  const groups = [
    [
      'О доме',
      field('Статус', table.get(house, 'status')) +
        field('Кадастровый номер', table.get(house, 'cadastral')) +
        field('Тип дома', table.get(house, 'type')) +
        field('Состояние', table.get(house, 'state')) +
        field('Дата сноса', table.get(house, 'demolished')),
    ],
    [
      'Управление',
      field('Способ управления', MANAGEMENT_NAMES[management] || management) +
        field('Организация', shortCompanyName(table.get(house, 'company'))),
    ],
  ];

  let html = groups
    .filter(([, content]) => content)
    .map(([title, content]) => `<section class="grp"><h3>${title}</h3><dl>${content}</dl></section>`)
    .join('');

  // В раскрывающемся блоке — все поля строки как есть
  const all = table.columns.map((title, i) => field(title, house.values[i])).join('');
  html += `<details class="grp"><summary>Все поля</summary><dl>${all}</dl></details>`;
  return html;
}

/**
 * Открывает карточку дома.
 * onExport(button) вызывается по кнопке «Скачать реестр», onCopy — по «Скопировать адрес».
 */
export function openHouseCard(house, table, { onExport, onCopy }) {
  titleEl.innerHTML = `${escapeHtml(house.shortAddress)}<span class="sub">${escapeHtml(house.address)}</span>`;

  const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(house.address)}`;
  bodyEl.innerHTML = `
    <div class="actions">
      <button class="btn primary wide" type="button" data-action="export">Скачать реестр помещений (Excel)</button>
      <a class="btn" href="${mapUrl}" target="_blank" rel="noopener">Показать на карте</a>
      <button class="btn" type="button" data-action="copy">Скопировать адрес</button>
    </div>
    ${kpiTiles(house, table)}
    ${detailGroups(house, table)}`;

  bodyEl.querySelector('[data-action="export"]').addEventListener('click', (e) => onExport(e.currentTarget));
  bodyEl.querySelector('[data-action="copy"]').addEventListener('click', onCopy);

  if (!dialog.open) dialog.showModal();
  bodyEl.scrollTop = 0;
}
