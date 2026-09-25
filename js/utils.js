export function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

// Приводим строку к виду для поиска: регистр, ё/е, знаки препинания
export function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,«»"]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function toNumber(value) {
  const n = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

export function formatNumber(value, digits = 0) {
  const n = toNumber(value);
  if (n === null) return String(value ?? '');
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

// plural(5, 'дом', 'дома', 'домов') -> 'домов'
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'ru', { numeric: true });
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('не загрузилась библиотека, проверьте интернет'));
    document.head.append(script);
  });
}
