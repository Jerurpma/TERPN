const RESOURCE_KEYS = Object.freeze({
  profile: 'terpn.profile.v1',
  journal: 'terpn.journal.v1',
  signups: 'terpn.signups.v1',
  account: 'terpn.account.v1',
  syncQueue: 'terpn.syncQueue.v1',
  backups: 'terpn.backups.v1'
});

function storageKey(resource) {
  return RESOURCE_KEYS[resource] || `terpn.${resource}.v1`;
}

function safeStorage(storage = globalThis.localStorage) {
  if (!storage) throw new Error('TERPN local storage is unavailable in this environment.');
  return storage;
}

export function createLocalStorageAdapter({ storage } = {}) {
  return {
    name: 'local-storage',
    keys: RESOURCE_KEYS,

    async get(resource, fallback = null) {
      const store = safeStorage(storage);
      const raw = store.getItem(storageKey(resource));
      if (raw === null || raw === undefined || raw === '') return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    async set(resource, value) {
      const store = safeStorage(storage);
      store.setItem(storageKey(resource), JSON.stringify(value));
      return value;
    },

    async remove(resource) {
      const store = safeStorage(storage);
      store.removeItem(storageKey(resource));
    }
  };
}

export const LOCAL_STORAGE_KEYS = RESOURCE_KEYS;
