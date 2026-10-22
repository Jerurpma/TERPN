export function qs(selector, root = document) {
  return root?.querySelector?.(selector) || null;
}

export function qsa(selector, root = document) {
  return Array.from(root?.querySelectorAll?.(selector) || []);
}

export function setText(selector, value) {
  const node = qs(selector);
  if (node) node.textContent = String(value ?? '');
}

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
