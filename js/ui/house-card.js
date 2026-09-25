import { MANAGEMENT_NAMES } from '../config.js';
import { shortCompanyName } from '../address.js';
import { escapeHtml, formatNumber, toNumber } from '../utils.js';

const dialog = document.getElementById('dlg');
const titleEl = document.getElementById('dTitle');
const bodyEl = document.getElementById('dBody');

// Технические поля прячем в свёрнутый блок
const TECH_COLUMN = /guid|идентиф|октмо|огрн|кпп|кадастр/i;
// Эти поля уже показаны в плитках сверху
const KPI_ROLES = ['address', 'area', 'livingArea', 'premises', 'living', 'nonLiving', 'rooms'];

document.getElementById('dClose').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // клик по затемнению
});

function kpiTiles(house, table) {
  const tiles = [];
  const add = (role, label, digits = 0, unit = '') => {
    const value = table.get(house, role);
    if (value && toNumber(value)) tiles.push([`${formatNumber(value, digits)}${unit}`, label]);
  };
  add('area', 'общая площадь', 1, ' м²');
  add('livingArea', 'жилая площадь', 1, ' м²');
  add('premises', 'помещений');
  add('living', 'жилых');
  add('nonLiving', 'нежилых');
  add('rooms', 'комнат в коммуналках');

  if (!tiles.length) return '';
  const html = tiles.map(([value, label]) => `<div class="kpi"><b>${value}</b><span>${label}</span></div>`);
  return `<div class="kpis">${html.join('')}</div>`;
}

function detailGroups(house, table) {
  const used = new Set(KPI_ROLES.map((role) => table.roles[role]).filter((i) => i >= 0));

  const field = (index, label, value = house.values[index]) => {
    used.add(index);
    if (!value || value === '-') return '';
    return `<dt>${escapeHtml(label || table.columns[index])}</dt><dd>${escapeHtml(value)}</dd>`;
  };
  const byRole = (role, label, value) => (table.has(role) ? field(table.roles[role], label, value) : '');

  const management = table.get(house, 'management');
  const groups = [
    [
      'О доме',
      byRole('type', 'Тип дома') +
        byRole('state', 'Состояние') +
        byRole('year') +
        byRole('floors') +
        byRole('demolished'),
    ],
    [
      'Управление',
      byRole('management', 'Способ управления', MANAGEMENT_NAMES[management] || management) +
        byRole('company', 'Организация', shortCompanyName(table.get(house, 'company'))),
    ],
  ];

  let other = '';
  let tech = '';
  table.columns.forEach((title, i) => {
    if (used.has(i)) return;
    if (TECH_COLUMN.test(title)) tech += field(i);
    else other += field(i);
  });
  if (other) groups.push(['Прочие сведения', other]);

  let html = groups
    .filter(([, content]) => content)
    .map(([title, content]) => `<section class="grp"><h3>${title}</h3><dl>${content}</dl></section>`)
    .join('');
  if (tech) html += `<details class="grp"><summary>Коды и идентификаторы</summary><dl>${tech}</dl></details>`;
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
