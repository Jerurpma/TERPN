const DEFAULT_ENDPOINTS = Object.freeze({
  health: '/api/health',
  profile: '/api/profile',
  journal: '/api/journal',
  signups: '/api/signups',
  account: '/api/account'
});

function normalizeBaseUrl(baseUrl = '') {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function endpointFor(resource, endpoints = DEFAULT_ENDPOINTS) {
  const endpoint = endpoints[resource];
  if (!endpoint) throw new Error(`Unknown TERPN backend resource: ${resource}`);
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

async function parseResponse(response, fallback) {
  if (response.status === 204 || response.status === 404) return fallback;
  const text = await response.text();
  if (!text) return fallback;
  const body = JSON.parse(text);
  return Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

async function requestJson(fetchImpl, url, options = {}, fallback = null) {
  const { headers = {}, ...rest } = options;
  const response = await fetchImpl(url, {
    credentials: 'include',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  }

  return parseResponse(response, fallback);
}

export function createBackendAdapter({ baseUrl = '', endpoints = DEFAULT_ENDPOINTS, fetchImpl = globalThis.fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!fetchImpl) throw new Error('TERPN backend adapter requires fetch.');

  return {
    name: 'backend',
    baseUrl: normalizedBaseUrl,
    endpoints,

    async health() {
      const url = `${normalizedBaseUrl}${endpointFor('health', endpoints)}`;
      return requestJson(fetchImpl, url, { method: 'GET' }, { ok: true });
    },

    async get(resource, fallback = null) {
      const url = `${normalizedBaseUrl}${endpointFor(resource, endpoints)}`;
      return requestJson(fetchImpl, url, { method: 'GET' }, fallback);
    },

    async set(resource, value) {
      const url = `${normalizedBaseUrl}${endpointFor(resource, endpoints)}`;
      return requestJson(fetchImpl, url, { method: 'PUT', body: JSON.stringify(value) }, value);
    },

    async remove(resource) {
      const url = `${normalizedBaseUrl}${endpointFor(resource, endpoints)}`;
      await requestJson(fetchImpl, url, { method: 'DELETE' }, null);
    }
  };
}

export const BACKEND_ENDPOINTS = DEFAULT_ENDPOINTS;
export const normalizeBackendBaseUrl = normalizeBaseUrl;
