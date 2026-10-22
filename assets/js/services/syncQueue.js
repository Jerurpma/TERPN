import { makeRecordId } from '../utils/ids.js';

const MAX_QUEUE_ITEMS = 50;

function safeTimestamp(value) {
  return value || new Date().toISOString();
}

function normalizeOperation(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const resource = String(input.resource || '').trim();
  const operation = String(input.operation || '').trim();
  if (!resource || !['set', 'remove'].includes(operation)) return null;

  return {
    id: String(input.id || makeRecordId('sync')).trim(),
    resource,
    operation,
    value: operation === 'set' ? input.value : null,
    queuedAt: safeTimestamp(input.queuedAt),
    attempts: Number.isFinite(Number(input.attempts)) ? Number(input.attempts) : 0,
    lastError: input.lastError ? String(input.lastError).slice(0, 240) : ''
  };
}

function normalizeQueue(value = []) {
  return (Array.isArray(value) ? value : []).map(normalizeOperation).filter(Boolean).slice(-MAX_QUEUE_ITEMS);
}

export function createSyncQueue(localAdapter) {
  async function read() {
    return normalizeQueue(await localAdapter.get('syncQueue', []));
  }

  async function write(items) {
    return localAdapter.set('syncQueue', normalizeQueue(items));
  }

  return {
    async list() {
      return read();
    },

    async enqueue(operation) {
      const item = normalizeOperation({ ...operation, queuedAt: new Date().toISOString() });
      if (!item) return null;
      const queue = await read();
      const withoutSameResource = queue.filter(existing => !(existing.resource === item.resource && existing.operation === item.operation));
      await write([...withoutSameResource, item]);
      return item;
    },

    async clear() {
      await write([]);
      return [];
    },

    async replace(items) {
      return write(items);
    },

    async size() {
      return (await read()).length;
    }
  };
}

export function summarizeSyncQueue(items = []) {
  const queue = normalizeQueue(items);
  const counts = queue.reduce((acc, item) => {
    acc[item.resource] = (acc[item.resource] || 0) + 1;
    return acc;
  }, {});

  return {
    total: queue.length,
    byResource: counts,
    latestQueuedAt: queue.length ? queue[queue.length - 1].queuedAt : null,
    hasFailures: queue.some(item => item.lastError)
  };
}
