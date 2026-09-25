// Общие настройки приложения

export const PAGE_SIZE = 40;

export const HOUSES_URL = 'data/spb_houses.csv';
export const premisesUrl = (shard) => `data/premises/p_${shard}.csv`;

export const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

// По каким заголовкам ищем нужные столбцы в загруженном файле.
// Берётся первое совпадение, поэтому более точные шаблоны идут первыми.
export const COLUMN_ROLES = {
  address: [/полный адрес/i, /^адрес/i, /адрес/i],
  guid: [/^guid дома$/i, /^глобальный уникальный идентификатор дома$/i],
  type: [/^тип дома/i],
  state: [/^состояние/i],
  area: [/общая площадь/i],
  livingArea: [/жилая площадь/i],
  premises: [/помещений всего/i],
  living: [/^жилых помещ/i],
  nonLiving: [/нежилых помещ/i],
  rooms: [/^комнат/i],
  company: [/управляющая организация/i, /наименование организации/i],
  management: [/способ управления/i],
  year: [/год.*(постр|ввод)/i],
  floors: [/этаж/i],
  demolished: [/дата сноса/i],
};

export const MANAGEMENT_NAMES = {
  УО: 'Управляющая организация',
  НУ: 'Непосредственное управление',
};

// Порядок статусов в реестре: дом, жилые, нежилые
export const STATUS_GROUP = { МКД: 0, КВ: 1, ЧКВ: 1, НЖ: 2, ОИ: 2 };

// Лист «Помещения» повторяет шаблон реестра заказчика
export const REGISTRY_SHEETS = ['Дом', 'Помещения', 'Собственники', 'Реестр', 'Повестка'];
export const REGISTRY_COLUMNS = [
  { title: 'Статус помещения / объекта', width: 7.88 },
  { title: 'Адрес (местоположение объекта)', width: 45.88 },
  { title: '№ помещения', width: 5.13 },
  { title: 'Площадь объекта из online справки РР', width: 11.75 },
  { title: 'Кадастровый номер помещения / объекта', width: 13.25 },
  { title: 'Доля ОИ, %', width: 4.88 },
  { title: null, width: 15, hidden: true },
  { title: 'Площадь объекта из выписки Росреестра', width: 8.13 },
  { title: 'Особые отметки о зарегистрированном праве на объект из он-лайн справки Росреестра', width: 35 },
  { title: 'Подъезд', width: 6.13 },
  { title: 'Тип помещения', width: 10.75 },
  { title: 'Этаж', width: 5.25 },
];
