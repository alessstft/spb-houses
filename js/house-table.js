import { COLUMN_ROLES } from './config.js';
import { extractStreet, looksLikeStreet, shortAddress } from './address.js';
import { normalize, naturalCompare } from './utils.js';

// Адрес вне города: «п. Петро-Славянка, …», «тер. Сергиево, …», «г. Колпино, …»
const SETTLEMENT = /^(п|пос|тер|г|д|дер|с|снт|кп|х)\.?\s/i;

// Заголовок ищем среди первых строк: это строка с наибольшим числом текстовых ячеек
function findHeaderRow(rows) {
  let best = 0;
  let bestCount = -1;
  rows.slice(0, 15).forEach((row, i) => {
    const count = row.filter((cell) => String(cell).trim() && Number.isNaN(Number(cell))).length;
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  });
  return best;
}

export class HouseTable {
  constructor(rows, sourceName) {
    rows = rows.filter((row) => row.some((cell) => String(cell).trim()));
    if (rows.length < 2) throw new Error('в файле нет строк с данными');

    const headerIndex = findHeaderRow(rows);
    this.sourceName = sourceName;
    this.columns = rows[headerIndex].map((title, i) => String(title).trim() || `Столбец ${i + 1}`);
    this.houses = rows
      .slice(headerIndex + 1)
      .map((row) => ({ values: this.columns.map((_, i) => String(row[i] ?? '').trim()) }));

    this.roles = this.#detectRoles();
    this.#prepareHouses();
    this.streets = [...new Set(this.houses.map((h) => h.street).filter(Boolean))].sort(naturalCompare);
  }

  #detectRoles() {
    const roles = {};
    const taken = new Set();
    for (const [role, patterns] of Object.entries(COLUMN_ROLES)) {
      roles[role] = -1;
      for (const pattern of patterns) {
        const index = this.columns.findIndex((title, i) => pattern.test(title) && !taken.has(i));
        if (index >= 0) {
          roles[role] = index;
          taken.add(index);
          break;
        }
      }
    }
    // Нет столбца с адресом по названию — берём тот, где чаще встречаются улицы
    if (roles.address < 0) {
      let bestCount = -1;
      this.columns.forEach((_, i) => {
        const count = this.houses.slice(0, 300).filter((h) => looksLikeStreet(h.values[i])).length;
        if (count > bestCount) {
          bestCount = count;
          roles.address = i;
        }
      });
    }
    return roles;
  }

  #prepareHouses() {
    for (const house of this.houses) {
      const address = this.get(house, 'address');
      house.address = address;
      house.shortAddress = shortAddress(address);
      house.street = extractStreet(address);
      // индекс в поиск не включаем: иначе «8» находит дом по индексу 198…
      house.searchText = ` ${normalize(house.shortAddress)} ${this.get(house, 'cadastral')} `;
      house.isCity = !SETTLEMENT.test(house.shortAddress);
    }
    this.houses.sort((a, b) => naturalCompare(a.shortAddress, b.shortAddress));
  }

  has(role) {
    return this.roles[role] >= 0;
  }

  get(house, role) {
    return this.has(role) ? house.values[this.roles[role]] : '';
  }

  /**
   * Поиск по словам запроса. Номер дома ищется целиком («8» не находит 18 и 28),
   * остальные слова — по началу слова («марат» находит «Марата»).
   * Дома в черте города показываются раньше посёлков.
   */
  search(query) {
    const words = normalize(query).split(' ').filter(Boolean);
    if (!words.length) return this.houses;

    const matchers = words.map((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // кадастровый номер — просто вхождение
      if (word.includes(':')) return new RegExp(escaped);
      // номер дома, корпуса, литеры — целиком
      if (/^\d/.test(word)) return new RegExp(` ${escaped}(?=[\\sа-я/-])`);
      return new RegExp(` ${escaped}`);
    });
    const found = this.houses.filter((house) => matchers.every((re) => re.test(house.searchText)));
    return found.sort((a, b) => b.isCity - a.isCity);
  }
}
