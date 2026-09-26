// Правила статусов помещений (те же, что в scripts/status.awk и scripts/premises.awk)

export const STATUS_RULES = {
  МКД: 'тип помещения пустой (строка самого дома)',
  КВ: 'жилое, есть кадастровый номер',
  НЖ: 'нежилое, есть кадастровый номер',
  ММ: 'машино-место',
  ОИ: 'нежилое, нет кадастрового номера',
  ЛК: 'правило уточняется',
  ЧКВ: 'жилое, нет кадастрового номера, есть номер комнаты',
  ERR: 'не подошло ни одно правило',
};

// В выгрузке отсутствие кадастрового номера пишут по-разному
export function cleanCadastral(value) {
  const cad = String(value ?? '').trim();
  return cad === 'нет' || cad === '-' ? '' : cad;
}

export function premiseStatus(kind, cadastral, room) {
  const hasCadastral = cleanCadastral(cadastral) !== '';
  if (!kind) return 'МКД';
  if (/машино/i.test(kind)) return 'ММ';
  if (kind === 'Жилое' && hasCadastral) return 'КВ';
  if (kind === 'Нежилое' && hasCadastral) return 'НЖ';
  if (kind === 'Нежилое') return 'ОИ';
  if (kind === 'Жилое' && room) return 'ЧКВ';
  return 'ERR';
}

// ФИАС ID зависит от статуса: дом, комната или помещение
export function fiasIdFor(status, { houseGuid, premiseGuid, roomGuid }) {
  if (status === 'МКД') return houseGuid;
  if (status === 'ЧКВ') return roomGuid || premiseGuid;
  return premiseGuid;
}
