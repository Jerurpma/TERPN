import http from 'node:http';

const store = {
  profile: null,
  journal: [],
  signups: [],
  account: null,
  session: { authenticated: false, user: null, roles: [] }
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:4173',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : null;
}

const resourceMap = new Map([
  ['/api/profile', 'profile'],
  ['/api/journal', 'journal'],
  ['/api/signups', 'signups'],
  ['/api/account', 'account']
]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost:3000');

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null);
    return;
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, version: '0.4.0', environment: 'local-memory' });
    return;
  }

  if (url.pathname === '/api/session') {
    if (request.method === 'GET') return sendJson(response, 200, { data: store.session });
    if (request.method === 'DELETE') {
      store.session = { authenticated: false, user: null, roles: [] };
      sendJson(response, 204, null);
      return;
    }
  }

  if (url.pathname === '/api/auth/magic-link' && request.method === 'POST') {
    const body = await readBody(request);
    store.session = {
      authenticated: true,
      user: { id: 'demo-user', email: body?.email || 'demo@example.com', name: 'Demo User', role: 'member', plan: 'starter' },
      roles: ['member'],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()
    };
    sendJson(response, 200, { ok: true, demoOnly: true });
    return;
  }

  const resource = resourceMap.get(url.pathname);
  if (resource) {
    if (request.method === 'GET') return sendJson(response, 200, { data: store[resource] });
    if (request.method === 'PUT') {
      store[resource] = await readBody(request);
      sendJson(response, 200, { data: store[resource] });
      return;
    }
    if (request.method === 'DELETE') {
      store[resource] = Array.isArray(store[resource]) ? [] : null;
      sendJson(response, 204, null);
      return;
    }
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(3000, () => {
  console.log('TERPN example backend running at http://localhost:3000');
});
