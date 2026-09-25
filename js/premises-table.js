// Таблица, где строка — помещение (выгрузка ГИС ЖКХ или файл «Фрагмент данных»).
// Сворачиваем её в список домов прямо в браузере, как это делает scripts/houses.awk,
// а помещения держим в памяти для выгрузки реестра.

import { cleanCadastral, fiasIdFor, premiseStatus } from './statuses.js';

const COLUMNS = {
  address: /^адрес ожф$/,
  status: /^статус$/,
  fias: /^глобальный уникальный идентификатор дома по фиас$/,
  oktmo: /^код октмо$/,
  method: /^способ управления$/,
  ogrn: /^огрн организации/,
  company: /^наименование организации/,
  houseType: /^тип дома$/,
  state: /^состояние$/,
  area: /^общая площадь дома$/,
  livingArea: /^жилая площадь в доме$/,
  kind: /^тип помещения/,
  demolished: /^дата сноса/,
  number: /^номер помещения/,
  room: /^номер комнаты$/,
  cadastral: /^кадастровый номер$/,
  houseGuid: /^глобальный уникальный идентификатор дома$/,
  premiseGuid: /^глобальный уникальный идентификатор помещения$/,
  roomGuid: /^глобальный уникальный идентификатор комнаты$/,
};

// Те же столбцы, что выдаёт scripts/houses.awk
const HOUSE_HEADER = [
  'Адрес',
  'Статус',
  'Кадастровый номер',
  'GUID дома',
  'GUID ФИАС',
  'ОКТМО',
  'Способ управления',
  'ОГРН УО',
  'Управляющая организация',
  'Тип дома',
  'Состояние',
  'Общая площадь',
  'Жилая площадь',
  'Дата сноса',
  'Помещений всего',
  'КВ',
  'НЖ',
  'ОИ',
  'ЧКВ',
  'Квартир с комнатами',
];

function findColumns(header) {
  const titles = header.map((title) => String(title).trim().toLowerCase());
  const index = {};
  for (const [name, pattern] of Object.entries(COLUMNS)) {
    index[name] = titles.findIndex((title) => pattern.test(title));
  }
  return index;
}

/** Похоже ли, что строка заголовков — от таблицы помещений. */
export function isPremisesHeader(header) {
  const index = findColumns(header);
  return index.address >= 0 && index.kind >= 0 && index.number >= 0;
}

/**
 * Возвращает { houseRows, premisesByHouse }:
 * houseRows — таблица домов с заголовком (для HouseTable),
 * premisesByHouse — Map: GUID дома -> список помещений.
 */
export function groupByHouse(rows) {
  const index = findColumns(rows[0]);
  const cell = (row, name) => (index[name] >= 0 ? String(row[index[name]] ?? '').trim() : '');

  const houses = new Map();
  const premisesByHouse = new Map();

  for (const row of rows.slice(1)) {
    const address = cell(row, 'address');
    if (!address || address === 'Адрес ОЖФ') continue;

    const houseGuid = cell(row, 'houseGuid') || address;
    if (!houses.has(houseGuid)) {
      houses.set(houseGuid, {
        address,
        info: [
          cell(row, 'fias'),
          cell(row, 'oktmo'),
          cell(row, 'method'),
          cell(row, 'ogrn'),
          cell(row, 'company'),
          cell(row, 'houseType'),
          cell(row, 'state'),
          cell(row, 'area'),
          cell(row, 'livingArea'),
          cell(row, 'demolished'),
        ],
        status: '',
        cadastral: '',
        premiseIds: new Set(),
        roomFlats: new Set(),
        counts: { КВ: 0, НЖ: 0, ОИ: 0, ЧКВ: 0 },
      });
      premisesByHouse.set(houseGuid, []);
    }
    const house = houses.get(houseGuid);

    const kind = cell(row, 'kind');
    const number = cell(row, 'number');
    const room = cell(row, 'room');
    const cadastral = cleanCadastral(cell(row, 'cadastral'));
    const premiseGuid = cell(row, 'premiseGuid');
    const roomGuid = cell(row, 'roomGuid');
    // если в файле уже есть колонка СТАТУС — доверяем ей
    const status = cell(row, 'status') || premiseStatus(kind, cadastral, room);

    if (status === 'МКД') {
      house.status = 'МКД';
      house.cadastral = cadastral;
    } else if (status in house.counts) {
      house.counts[status]++;
    }
    if (premiseGuid) house.premiseIds.add(premiseGuid);
    if (status === 'ЧКВ') house.roomFlats.add(number);

    premisesByHouse.get(houseGuid).push({
      status,
      number,
      room,
      cadastral,
      fiasId: fiasIdFor(status, { houseGuid: cell(row, 'houseGuid'), premiseGuid, roomGuid }),
    });
  }

  const houseRows = [HOUSE_HEADER];
  for (const [guid, house] of houses) {
    const { counts } = house;
    houseRows.push([
      house.address,
      house.status,
      house.cadastral,
      guid,
      ...house.info,
      house.premiseIds.size,
      counts['КВ'],
      counts['НЖ'],
      counts['ОИ'],
      counts['ЧКВ'],
      house.roomFlats.size,
    ]);
  }
  return { houseRows, premisesByHouse };
}
