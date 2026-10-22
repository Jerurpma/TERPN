import assert from 'node:assert/strict';
import { createLocalStorageAdapter } from '../assets/js/adapters/localStorageAdapter.js';
import { createBackendAdapter } from '../assets/js/adapters/backendAdapter.js';
import { createAppRepository } from '../assets/js/services/appRepository.js';
import { createSyncQueue } from '../assets/js/services/syncQueue.js';
import { computeJournalInsights } from '../assets/js/services/journalInsights.js';
import { runQaSelfTest } from '../assets/js/services/qaSelfTest.js';
import { clearLocalBackups, createLocalBackup, listLocalBackups, restoreLatestBackup } from '../assets/js/services/localBackups.js';
import { renderLocalBackups } from '../assets/js/ui/renderers.js';
import { mergeById, normalizeAccount, normalizeJournalEntry, normalizeSignup } from '../assets/js/services/validation.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); }
  };
}

async function testValidation() {
  assert.equal(normalizeSignup({ email: 'bad' }), null);
  assert.equal(normalizeAccount({ email: 'bad@example', name: 'R', role: 'Member', plan: 'Starter' }), null);
  const entry = normalizeJournalEntry({ title: 'A', terpenes: 'Linalool', notes: 'Note' });
  assert.equal(entry.title, 'A');
  assert.ok(entry.id.startsWith('entry-'));
}

async function testMergeAndInsights() {
  const merged = mergeById([{ id: 'a', title: 'Old' }], [{ id: 'a', title: 'New' }, { id: 'b', title: 'B' }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(item => item.id === 'a').title, 'New');
  const insights = computeJournalInsights([
    { terpenes: 'Linalool, Pinene', after: 'Clear', setting: 'Home', date: '2026-05-01' },
    { terpenes: 'Linalool', after: 'Grounded', setting: 'Home', date: '2026-05-02' },
    { terpenes: 'Limonene', after: 'Clear', setting: 'Walk', date: '2026-05-03' }
  ]);
  assert.equal(insights.hasEnoughForPatterns, true);
  assert.equal(insights.topTerpenes[0].label, 'Linalool');
}

async function testBackendFetchInjection() {
  const calls = [];
  const adapter = createBackendAdapter({
    baseUrl: 'http://example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ data: { ok: true, url } }), { status: 200 });
    }
  });
  const result = await adapter.get('profile');
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, 'http://example.test/api/profile');
}

async function testQaSelfTest() {
  const storage = createMemoryStorage();
  const report = runQaSelfTest({
    flags: { useBackendAdapter: false, backendReadEnabled: false, backendWriteEnabled: false, authSessionEnabled: false, queueFailedBackendWrites: true },
    data: { journal: [{ id: 'entry-1' }], signups: [], backups: [{ id: 'backup-1' }] },
    diagnostics: { status: 'Healthy', issues: [] },
    repositoryMode: 'Local storage',
    storage
  });
  assert.equal(report.status, 'Pass');
  assert.ok(report.checks.some(item => item.label === 'Local storage available'));
}


async function testLocalBackups() {
  const adapter = createLocalStorageAdapter({ storage: createMemoryStorage() });
  const created = await createLocalBackup(adapter, {
    profile: { name: 'R', goal: 'learn', aroma: 'citrus', sensitivity: 'standard' },
    journal: [{ id: 'entry-1', title: 'A' }],
    signups: [],
    account: null
  }, 'test-backup');
  assert.equal(created.backups.length, 1);
  const listed = await listLocalBackups(adapter);
  assert.equal(listed[0].reason, 'test-backup');
  const latest = await restoreLatestBackup(adapter);
  assert.equal(latest.data.journal[0].id, 'entry-1');
  const cleared = await clearLocalBackups(adapter);
  assert.deepEqual(cleared, []);
  assert.deepEqual(await listLocalBackups(adapter), []);
}


async function testRenderLocalBackupsSmoke() {
  const nodes = new Map();
  globalThis.document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { textContent: '', value: '', innerHTML: '' });
      return nodes.get(selector);
    },
    querySelectorAll() { return []; }
  };

  renderLocalBackups([{ id: 'backup-1', createdAt: '2026-05-15T00:00:00.000Z', reason: 'smoke', data: { journal: [], signups: [] } }]);
  assert.equal(nodes.get('#backupStatus').textContent, '1 saved');
  assert.match(nodes.get('#backupDetail').textContent, /smoke/);
  delete globalThis.document;
}

async function testRepositoryFallbackQueue() {
  const localAdapter = createLocalStorageAdapter({ storage: createMemoryStorage() });
  const syncQueue = createSyncQueue(localAdapter);
  const failingBackend = createBackendAdapter({
    baseUrl: 'http://example.test',
    fetchImpl: async () => new Response('nope', { status: 500, statusText: 'Server Error' })
  });
  const repository = createAppRepository({
    localAdapter,
    backendAdapter: failingBackend,
    syncQueue,
    flags: {
      useBackendAdapter: true,
      backendBaseUrl: 'http://example.test',
      backendReadEnabled: false,
      backendWriteEnabled: true,
      mirrorBackendWritesToLocal: true,
      fallbackToLocalOnBackendError: true,
      queueFailedBackendWrites: true
    },
    onSyncError() {}
  });
  await repository.set('journal', [{ id: 'entry-1' }]);
  assert.deepEqual(await localAdapter.get('journal', []), [{ id: 'entry-1' }]);
  const pending = await repository.pendingSync();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].resource, 'journal');
}

await testValidation();
await testMergeAndInsights();
await testBackendFetchInjection();
await testQaSelfTest();
await testLocalBackups();
await testRenderLocalBackupsSmoke();
await testRepositoryFallbackQueue();
console.log('Regression checks passed');
