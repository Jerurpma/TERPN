const DEFAULT_AUTH_ENDPOINTS = Object.freeze({
  session: '/api/session',
  magicLink: '/api/auth/magic-link'
});

function normalizeBaseUrl(baseUrl = '') {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function endpointFor(resource, endpoints = DEFAULT_AUTH_ENDPOINTS) {
  const endpoint = endpoints[resource];
  if (!endpoint) throw new Error(`Unknown TERPN auth resource: ${resource}`);
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

async function parseResponse(response, fallback) {
  if (response.status === 204 || response.status === 404) return fallback;
  const text = await response.text();
  if (!text) return fallback;
  const body = JSON.parse(text);
  return Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

function normalizeSession(value = {}) {
  if (!value || typeof value !== 'object') return { authenticated: false, user: null, roles: [] };
  const user = value.user && typeof value.user === 'object' ? value.user : null;
  const roles = Array.isArray(value.roles) ? value.roles.map(role => String(role).trim()).filter(Boolean) : [];
  return {
    authenticated: Boolean(value.authenticated || user?.id || user?.email),
    user,
    roles,
    expiresAt: value.expiresAt || null
  };
}

async function requestJson(fetchImpl, url, options = {}, fallback = null) {
  const { headers = {}, ...rest } = options;
  const response = await fetchImpl(url, {
    credentials: 'include',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Auth request failed: ${response.status} ${response.statusText}`);
  }

  return parseResponse(response, fallback);
}

export function createAuthSessionAdapter({ baseUrl = '', endpoints = DEFAULT_AUTH_ENDPOINTS, fetchImpl = globalThis.fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!fetchImpl) throw new Error('TERPN auth session adapter requires fetch.');

  return {
    name: 'auth-session',
    baseUrl: normalizedBaseUrl,
    endpoints,

    async getSession() {
      const url = `${normalizedBaseUrl}${endpointFor('session', endpoints)}`;
      const session = await requestJson(fetchImpl, url, { method: 'GET' }, { authenticated: false, user: null, roles: [] });
      return normalizeSession(session);
    },

    async requestMagicLink({ email, redirectTo } = {}) {
      const url = `${normalizedBaseUrl}${endpointFor('magicLink', endpoints)}`;
      return requestJson(fetchImpl, url, { method: 'POST', body: JSON.stringify({ email, redirectTo }) }, { ok: true });
    },

    async signOut() {
      const url = `${normalizedBaseUrl}${endpointFor('session', endpoints)}`;
      await requestJson(fetchImpl, url, { method: 'DELETE' }, null);
      return { authenticated: false, user: null, roles: [] };
    }
  };
}

export const AUTH_ENDPOINTS = DEFAULT_AUTH_ENDPOINTS;
export const normalizeAuthBaseUrl = normalizeBaseUrl;
