// Общие настройки приложения

export const PAGE_SIZE = 40;

export const HOUSES_URL = 'data/spb_houses.csv';
export const premisesUrl = (shard) => `data/premises/p_${shard}.csv`;

export const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

// По каким заголовкам ищем нужные столбцы в загруженном файле.
// Берётся первое совпадение, поэтому более точные шаблоны идут первыми.
export const COLUMN_ROLES = {
  address: [/полный адрес/i, /^адрес/i, /адрес/i],
  status: [/^статус$/i],
  cadastral: [/^кадастровый номер$/i],
  guid: [/^guid дома$/i, /^глобальный уникальный идентификатор дома$/i],
  type: [/^тип дома/i],
  state: [/^состояние/i],
  area: [/общая площадь/i],
  livingArea: [/жилая площадь/i],
  premises: [/помещений всего/i],
  kv: [/^кв$/i],
  nzh: [/^нж$/i],
  mm: [/^мм$/i],
  oi: [/^ои$/i],
  lk: [/^лк$/i],
  chkv: [/^чкв$/i],
  err: [/^err$/i],
  roomFlats: [/квартир с комнатами/i],
  company: [/управляющая организация/i, /наименование организации/i],
  ogrn: [/^огрн/i],
  management: [/способ управления/i],
  demolished: [/дата сноса/i],
};

export const MANAGEMENT_NAMES = {
  УО: 'Управляющая организация',
  НУ: 'Непосредственное управление',
};

// Порядок статусов в реестре и в списке помещений
export const STATUS_ORDER = ['МКД', 'КВ', 'НЖ', 'ММ', 'ОИ', 'ЛК', 'ЧКВ', 'ERR'];

// Лист «Помещения» повторяет шаблон реестра заказчика,
// последние два столбца добавлены сверх шаблона.
// key — какое поле помещения выводится в столбец (без key столбец остаётся пустым).
export const REGISTRY_SHEETS = ['Дом', 'Помещения', 'Собственники', 'Реестр', 'Повестка'];
export const REGISTRY_COLUMNS = [
  { key: 'status', title: 'Статус помещения / объекта', width: 7.88 },
  { key: 'address', title: 'Адрес (местоположение объекта)', width: 45.88 },
  { key: 'number', title: '№ помещения', width: 5.13 },
  { key: 'area', title: 'Площадь объекта из online справки РР', width: 11.75 },
  { key: 'cadastral', title: 'Кадастровый номер помещения / объекта', width: 13.25 },
  { key: 'share', title: 'Доля ОИ, %', width: 4.88 },
  { title: null, width: 15, hidden: true },
  { title: 'Площадь объекта из выписки Росреестра', width: 8.13 },
  { title: 'Особые отметки о зарегистрированном праве на объект из он-лайн справки Росреестра', width: 35 },
  { title: 'Подъезд', width: 6.13 },
  { key: 'type', title: 'Тип помещения', width: 10.75 },
  { title: 'Этаж', width: 5.25 },
  { key: 'fiasId', title: 'ID-FIAS', width: 30 },
  { key: 'houseCadastral', title: 'КадНомЗдания', width: 13.25 },
];

// Столбцы «Подъезд», «Тип помещения», «Этаж» в шаблоне обведены рамкой
export const REGISTRY_FRAME = { from: 10, to: 12 };

// Блок расчёта справа от реестра: считается формулами по столбцу площади,
// поэтому после ввода площадей в Excel всё пересчитывается само.
export const REGISTRY_STATS = {
  firstColumn: 16, // P
  main: ['КВ', 'НЖ', 'ММ'], // от их суммарной площади считаются проценты и доля ОИ
  other: ['ОИ', 'ЛК', 'ЧКВ', 'ERR'],
};