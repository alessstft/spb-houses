// Разбор адресов из выгрузки ГИС ЖКХ.
// Пример: «190000, Санкт-Петербург г, наб. Реки Фонтанки, д. 32/1, литер А»

const STREET_TYPES =
  /(^|\s)(улица|ул\.?|проспект|пр-кт|пр\.|переулок|пер\.?|набережная|наб\.?|шоссе|ш\.|бульвар|б-р|площадь|пл\.?|линия|дорога|дор\.?|аллея|проезд|пр-д|тупик|канал|кв-л|квартал|мост|спуск|остров)(\s|$)/i;

export function looksLikeStreet(text) {
  return STREET_TYPES.test(text);
}

// Адрес без индекса и названия города
export function shortAddress(address) {
  return String(address)
    .replace(/^\s*\d{6},\s*/, '')
    .replace(/^(г\.?\s*)?Санкт-Петербург(\s*г\.?)?,\s*/i, '');
}

// Адрес для реестра: без индекса, «Санкт-Петербург г» -> «Санкт-Петербург»
export function registryAddress(address) {
  return String(address)
    .replace(/^\s*\d{6},\s*/, '')
    .replace(/Санкт-Петербург\s+г(?=,|$)/, 'Санкт-Петербург');
}

export function extractStreet(address) {
  const parts = String(address)
    .split(',')
    .map((part) => part.trim());
  const street = parts.find((part) => looksLikeStreet(part) && !/^(д\.|дом|корп|стр|лит)/i.test(part));
  return street ? street.replace(/\s+/g, ' ') : '';
}

const ORG_FORMS = [
  [/ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ/gi, 'ООО'],
  [/ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО/gi, 'ПАО'],
  [/АКЦИОНЕРНОЕ ОБЩЕСТВО/gi, 'АО'],
  [/ТОВАРИЩЕСТВО СОБСТВЕННИКОВ ЖИЛЬЯ/gi, 'ТСЖ'],
  [/ТОВАРИЩЕСТВО СОБСТВЕННИКОВ НЕДВИЖИМОСТИ/gi, 'ТСН'],
  [/ЖИЛИЩНО-СТРОИТЕЛЬНЫЙ КООПЕРАТИВ/gi, 'ЖСК'],
];

// «ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ЖКС № 1"» -> «ООО «ЖКС № 1»»
export function shortCompanyName(name) {
  if (!name) return '';
  let result = String(name);
  for (const [pattern, short] of ORG_FORMS) result = result.replace(pattern, short);
  return result.replace(/"([^"]+)"/g, '«$1»').replace(/"/g, '');
}
