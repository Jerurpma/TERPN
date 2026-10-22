export function makeRecordId(prefix = 'record') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${String(random).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48)}`;
}
