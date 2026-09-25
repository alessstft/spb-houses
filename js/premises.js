import { premisesUrl } from './config.js';

// Помещения разложены по 16 файлам по первому символу GUID дома (см. scripts/premises.awk).
// Формат файла:
//   #<GUID дома>
//   СТАТУС|№ помещения|№ комнаты|Кадастровый номер
const cache = new Map();

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
  const text = await loadShard(shardOf(houseGuid));
  const result = [];
  let inHouse = false;

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      inHouse = line.slice(1).trim() === houseGuid;
      continue;
    }
    if (!inHouse || !line.trim()) continue;

    const [status, number = '', room = '', cadastral = ''] = line.replace(/\r$/, '').split('|');
    result.push({ status, number, room, cadastral });
  }
  return result;
}
