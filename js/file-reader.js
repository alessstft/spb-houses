// Чтение CSV/Excel и хранение последнего загруженного файла в IndexedDB

import { isPremisesHeader } from './premises-table.js';

const DB_NAME = 'spb-houses';
const STORE = 'files';

function decodeText(buffer) {
  let text = new TextDecoder('utf-8').decode(buffer);
  // Много «битых» символов — значит, файл в windows-1251
  const broken = (text.slice(0, 20000).match(/\uFFFD/g) || []).length;
  if (broken > 5) text = new TextDecoder('windows-1251').decode(buffer);
  return text.replace(/^\uFEFF/, '');
}

/** Возвращает таблицу как массив строк (массив массивов). */
export function parseTable(buffer, fileName) {
  if (/\.(xlsx|xls)$/i.test(fileName)) {
    const book = XLSX.read(buffer, { type: 'array' });
    // raw: числа берём как есть, без форматирования ячейки (иначе «9,510.0»)
    const sheets = book.SheetNames.map((name) =>
      XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: '', raw: true }),
    );
    // В книге с несколькими листами берём лист с помещениями, если он есть
    return sheets.find((rows) => rows.length > 1 && isPremisesHeader(rows[0])) ?? sheets[0];
  }
  return Papa.parse(decodeText(buffer), { skipEmptyLines: true }).data;
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('файл не прочитался'));
    reader.readAsArrayBuffer(file);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLastFile(buffer, name) {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ buffer, name }, 'last');
  } catch {
    // без сохранения страница всё равно работает
  }
}

export async function loadLastFile() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get('last');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
