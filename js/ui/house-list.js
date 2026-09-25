import { shortCompanyName } from '../address.js';
import { escapeHtml, formatNumber, plural } from '../utils.js';

const CHEVRON =
  '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

const LIST_HEADER = `
  <div class="lhead cols">
    <div>Адрес</div><div>Тип дома</div><div>Состояние</div>
    <div class="num">Площадь, м²</div><div class="num">Помещений</div><div></div>
  </div>`;

export function stateClass(state) {
  const s = String(state).toLowerCase();
  if (/аварий/.test(s)) return 'bad';
  if (/ветх|снес/.test(s)) return 'warn';
  if (/исправ/.test(s)) return 'ok';
  return '';
}

// Подсвечиваем слова из поиска; е и ё считаем одной буквой
function highlight(text, query) {
  const html = escapeHtml(text);
  const words = query
    .trim()
    .split(/[\s,.]+/)
    .filter(Boolean);
  if (!words.length) return html;

  const pattern = words
    .map((w) =>
      escapeHtml(w)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[её]/gi, '[её]'),
    )
    .join('|');
  return html.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

function renderItem(house, index, table, query) {
  const company = shortCompanyName(table.get(house, 'company'));
  const type = table.get(house, 'type');
  const state = table.get(house, 'state');
  const area = table.get(house, 'area');
  const premises = table.get(house, 'premises');

  return `
    <button class="item cols" type="button" data-index="${index}">
      <div>
        <div class="a1">${highlight(house.shortAddress, query)}</div>
        ${company ? `<div class="a2">${escapeHtml(company)}</div>` : ''}
      </div>
      <div class="facts">
        <div class="cell">${type ? `<span class="lbl">Тип:</span>${escapeHtml(type)}` : ''}</div>
        <div class="cell">${state ? `<span class="badge ${stateClass(state)}">${escapeHtml(state)}</span>` : ''}</div>
        <div class="cell num">${area ? `<span class="lbl">Площадь:</span>${formatNumber(area)} м²` : ''}</div>
        <div class="cell num">${premises ? `<span class="lbl">Помещений:</span>${formatNumber(premises)}` : ''}</div>
      </div>
      ${CHEVRON}
    </button>`;
}

export function renderSummary(houses, isFiltered) {
  const title = document.getElementById('foundTitle');
  const subtitle = document.getElementById('foundSub');
  const count = houses.length;

  if (!count) {
    title.textContent = 'Ничего не найдено';
    subtitle.textContent = '';
    return;
  }
  const streets = new Set(houses.map((h) => h.street).filter(Boolean)).size;
  title.textContent = `${isFiltered ? 'Найдено' : 'Всего'}: ${count.toLocaleString('ru-RU')} ${plural(count, 'дом', 'дома', 'домов')}`;
  subtitle.textContent = `на ${streets.toLocaleString('ru-RU')} ${plural(streets, 'улице', 'улицах', 'улицах')}`;
}

export function renderList(container, houses, { table, query, limit }) {
  if (!houses.length) {
    container.innerHTML = `
      <div class="nores">
        <strong>По этому запросу домов нет</strong>
        Проверьте написание, уберите номер дома или нажмите «Сбросить».
      </div>`;
    return;
  }
  const items = houses.slice(0, limit).map((house, i) => renderItem(house, i, table, query));
  container.innerHTML = LIST_HEADER + items.join('');
}
