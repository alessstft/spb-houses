import { COLUMN_ROLES } from './config.js';
import { extractStreet, looksLikeStreet, shortAddress } from './address.js';
import { normalize, naturalCompare } from './utils.js';

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
      house.searchText = ` ${normalize(address)} `;
      house.searchStreet = normalize(house.street);
    }
    this.houses.sort((a, b) => naturalCompare(a.shortAddress, b.shortAddress));
  }

  has(role) {
    return this.roles[role] >= 0;
  }

  get(house, role) {
    return this.has(role) ? house.values[this.roles[role]] : '';
  }

  filter({ query = '', street = '' }) {
    const words = normalize(query).split(' ').filter(Boolean);
    const streetPart = normalize(street).trim();
    return this.houses.filter(
      (house) =>
        (!streetPart || house.searchStreet.includes(streetPart)) &&
        words.every((word) => house.searchText.includes(word)),
    );
  }
}
