const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
let toastTimer;

export function setStatus(text = '', isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('err', isError);
}

export function toast(text) {
  // открытое модальное окно перекрывает всё остальное, поэтому показываем сообщение внутри него
  (document.querySelector('dialog[open]') || document.body).append(toastEl);
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
}
