const FLAG_STORAGE_KEY = 'terpn.flags.v1';

const DEFAULT_FLAGS = Object.freeze({
  useBackendAdapter: false,
  backendBaseUrl: '',
  backendReadEnabled: false,
  backendWriteEnabled: false,
  mirrorBackendWritesToLocal: true,
  fallbackToLocalOnBackendError: true,
  queueFailedBackendWrites: true,
  authSessionEnabled: false,
  seedSampleData: true,
  debugMode: false
});

const QUERY_ALIASES = Object.freeze({
  useBackendAdapter: 'terpnBackend',
  backendBaseUrl: 'terpnBackendBaseUrl',
  backendReadEnabled: 'terpnBackendRead',
  backendWriteEnabled: 'terpnBackendWrite',
  mirrorBackendWritesToLocal: 'terpnMirrorWrites',
  fallbackToLocalOnBackendError: 'terpnFallbackLocal',
  queueFailedBackendWrites: 'terpnQueueWrites',
  authSessionEnabled: 'terpnAuthSession',
  seedSampleData: 'terpnSeedSample',
  debugMode: 'terpnDebug'
});

function safeWindow() {
  return typeof window === 'undefined' ? null : window;
}

function normalizeBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readStoredFlags() {
  const win = safeWindow();
  if (!win?.localStorage) return {};
  try {
    const parsed = JSON.parse(win.localStorage.getItem(FLAG_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readSearchParams() {
  const win = safeWindow();
  if (!win?.location?.search) return new URLSearchParams();
  return new URLSearchParams(win.location.search);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function rawFlag(name, params, stored, fallback) {
  const queryName = QUERY_ALIASES[name];
  if (queryName && params.has(queryName)) return params.get(queryName);
  if (params.has(name)) return params.get(name);
  return Object.prototype.hasOwnProperty.call(stored, name) ? stored[name] : fallback;
}

function normalizeFlags(input = {}) {
  return {
    useBackendAdapter: parseBoolean(input.useBackendAdapter, DEFAULT_FLAGS.useBackendAdapter),
    backendBaseUrl: normalizeBaseUrl(input.backendBaseUrl),
    backendReadEnabled: parseBoolean(input.backendReadEnabled, DEFAULT_FLAGS.backendReadEnabled),
    backendWriteEnabled: parseBoolean(input.backendWriteEnabled, DEFAULT_FLAGS.backendWriteEnabled),
    mirrorBackendWritesToLocal: parseBoolean(input.mirrorBackendWritesToLocal, DEFAULT_FLAGS.mirrorBackendWritesToLocal),
    fallbackToLocalOnBackendError: parseBoolean(input.fallbackToLocalOnBackendError, DEFAULT_FLAGS.fallbackToLocalOnBackendError),
    queueFailedBackendWrites: parseBoolean(input.queueFailedBackendWrites, DEFAULT_FLAGS.queueFailedBackendWrites),
    authSessionEnabled: parseBoolean(input.authSessionEnabled, DEFAULT_FLAGS.authSessionEnabled),
    seedSampleData: parseBoolean(input.seedSampleData, DEFAULT_FLAGS.seedSampleData),
    debugMode: parseBoolean(input.debugMode, DEFAULT_FLAGS.debugMode)
  };
}

export function getFeatureFlags() {
  const stored = readStoredFlags();
  const params = readSearchParams();
  const merged = {};
  for (const [name, fallback] of Object.entries(DEFAULT_FLAGS)) {
    merged[name] = rawFlag(name, params, stored, fallback);
  }
  return Object.freeze(normalizeFlags(merged));
}

export function saveFeatureFlags(nextFlags = {}) {
  const win = safeWindow();
  const normalized = normalizeFlags({ ...getFeatureFlags(), ...nextFlags });
  if (win?.localStorage) win.localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(normalized, null, 2));
  return Object.freeze(normalized);
}

export function resetFeatureFlags() {
  const win = safeWindow();
  if (win?.localStorage) win.localStorage.removeItem(FLAG_STORAGE_KEY);
  return getFeatureFlags();
}

export const FEATURE_FLAG_STORAGE_KEY = FLAG_STORAGE_KEY;
export const DEFAULT_FEATURE_FLAGS = DEFAULT_FLAGS;
export const normalizeFeatureFlagBaseUrl = normalizeBaseUrl;
