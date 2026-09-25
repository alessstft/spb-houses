import { STATUS_GROUP, premisesUrl } from './config.js';
import { naturalCompare } from './utils.js';

// Помещения разложены по 16 файлам по первому символу GUID дома (см. scripts/premises.awk).
// Формат файла:
//   #<GUID дома>
//   СТАТУС|№ помещения|№ комнаты|Кадастровый номер|ФИАС ID
const cache = new Map();

// Помещения из загруженного пользователем файла (если он на уровне помещений)
let localPremises = null;

export function setLocalPremises(premisesByHouse) {
  localPremises = premisesByHouse;
}

function shardOf(guid) {
  return /^[0-9a-f]/.test(guid) ? guid[0] : 'x';
}

async function loadShard(shard) {
  if (!cache.has(shard)) {
    const response = await fetch(premisesUrl(shard), { cache: 'no-cache' });
    if (!response.ok) throw new Error('на сайте нет данных о помещениях (папка data/premises)');
    cache.set(shard, await response.text());
  }
  return cache.get(shard);
}

export async function getPremises(houseGuid) {
  if (localPremises) return [...(localPremises.get(houseGuid) || [])];

  const text = await loadShard(shardOf(houseGuid));
  const result = [];
  let inHouse = false;

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      inHouse = line.slice(1).trim() === houseGuid;
      continue;
    }
    if (!inHouse || !line.trim()) continue;

    const [status, number = '', room = '', cadastral = '', fiasId = ''] = line.replace(/\r$/, '').split('|');
    result.push({ status, number, room, cadastral, fiasId });
  }
  return result;
}

// Порядок как в реестре: дом, квартиры (комнаты сразу под своей квартирой), нежилые
export function sortPremises(list) {
  return list.sort(
    (a, b) =>
      (STATUS_GROUP[a.status] ?? 3) - (STATUS_GROUP[b.status] ?? 3) ||
      naturalCompare(a.number, b.number) ||
      // комнаты идут сразу под своей квартирой
      (a.status === 'ЧКВ') - (b.status === 'ЧКВ') ||
      naturalCompare(a.room, b.room),
  );
}
