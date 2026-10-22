export const APP_SCHEMA_VERSION = 'terpn.local.v2';

export const TERPN_RESOURCES = Object.freeze({
  profile: Object.freeze({
    key: 'profile',
    storageKey: 'terpn.profile.v1',
    endpoint: '/api/profile',
    type: 'object|null',
    requiredFields: [],
    privateFields: ['notes']
  }),
  journal: Object.freeze({
    key: 'journal',
    storageKey: 'terpn.journal.v1',
    endpoint: '/api/journal',
    type: 'array',
    requiredFields: ['id', 'createdAt', 'updatedAt', 'title', 'date'],
    privateFields: ['notes', 'before', 'after', 'setting']
  }),
  signups: Object.freeze({
    key: 'signups',
    storageKey: 'terpn.signups.v1',
    endpoint: '/api/signups',
    type: 'array',
    requiredFields: ['id', 'email', 'createdAt'],
    privateFields: ['email', 'note']
  }),
  account: Object.freeze({
    key: 'account',
    storageKey: 'terpn.account.v1',
    endpoint: '/api/account',
    type: 'object|null',
    requiredFields: [],
    privateFields: ['email']
  }),
  syncQueue: Object.freeze({
    key: 'syncQueue',
    storageKey: 'terpn.syncQueue.v1',
    endpoint: null,
    type: 'array',
    requiredFields: ['id', 'resource', 'operation', 'queuedAt'],
    privateFields: ['value']
  }),
  featureFlags: Object.freeze({
    key: 'featureFlags',
    storageKey: 'terpn.flags.v1',
    endpoint: null,
    type: 'object',
    requiredFields: [],
    privateFields: ['backendBaseUrl']
  }),
  backups: Object.freeze({
    key: 'backups',
    storageKey: 'terpn.backups.v1',
    endpoint: null,
    type: 'array',
    requiredFields: ['id', 'schemaVersion', 'createdAt', 'reason', 'data'],
    privateFields: ['data']
  })
});

export const DATA_MODEL_CHECKLIST = Object.freeze([
  'Normalize all imported data before merge.',
  'Keep local-first storage as the default runtime path.',
  'Gate backend reads, writes, queueing, and auth with feature flags.',
  'Treat notes, reflections, email addresses, and sync payloads as private data.',
  'Include schemaVersion and exportedAt in full data exports.',
  'Create local safety backups before destructive imports, repairs, and clears.'
]);

export function resourceKeys() {
  return Object.keys(TERPN_RESOURCES);
}

export function buildExportEnvelope({ profile = null, journal = [], signups = [], account = null, adapterMode = 'Local storage' } = {}) {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    adapterMode,
    disclaimer: 'TERPN prototype export. Educational/local-first data only.',
    data: {
      profile,
      journal,
      signups,
      account
    }
  };
}
