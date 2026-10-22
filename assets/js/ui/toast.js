let toastTimer = null;

export function toast(message) {
  const node = typeof document === 'undefined' ? null : document.querySelector('#toast');
  if (!node) {
    if (message) console.log(`[TERPN] ${message}`);
    return;
  }
  node.textContent = String(message || '');
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
}
