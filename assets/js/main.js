import { getFeatureFlags, saveFeatureFlags, resetFeatureFlags } from './config/featureFlags.js';
import { APP_SCHEMA_VERSION, buildExportEnvelope } from './config/dataModel.js';
import { createBackendAdapter } from './adapters/backendAdapter.js';
import { createAuthSessionAdapter } from './adapters/authSessionAdapter.js';
import { createLocalStorageAdapter } from './adapters/localStorageAdapter.js';
import { createAppRepository } from './services/appRepository.js';
import { createSyncQueue } from './services/syncQueue.js';
import { analyzeAppData, repairAppData } from './services/dataIntegrity.js';
import { runQaSelfTest } from './services/qaSelfTest.js';
import { clearLocalBackups, createLocalBackup, listLocalBackups, restoreLatestBackup } from './services/localBackups.js';
import { TERPENES } from './data/terpenes.js';
import { qs, qsa } from './utils/dom.js';
import { today } from './utils/dates.js';
import { downloadJson } from './utils/downloadJson.js';
import { makeRecordId } from './utils/ids.js';
import { initTabs } from './ui/tabs.js';
import { toast } from './ui/toast.js';
import {
  renderAccount,
  renderBackendHealth,
  renderBetaStatus,
  renderDashboard,
  renderDataDiagnostics,
  renderEntries,
  renderFeatureFlags,
  renderJournalForm,
  renderJournalInsights,
  renderLocalBackups,
  renderOnboarding,
  renderQaSelfTest,
  renderSessionStatus,
  renderSignups,
  renderSyncQueueStatus,
  renderTerpenes
} from './ui/renderers.js';
import {
  hasImportableAppData,
  isValidEmail,
  mergeById,
  normalizeAccount,
  normalizeAppExport,
  normalizeJournalEntry,
  normalizeJournalEntries,
  normalizeProfile,
  normalizeSignup
} from './services/validation.js';

let flags = getFeatureFlags();
const localAdapter = createLocalStorageAdapter();
const syncQueue = createSyncQueue(localAdapter);
let backendAdapter = null;
let authAdapter = null;
let repository = null;

const state = {
  profile: null,
  journal: [],
  signups: [],
  account: null,
  backendHealth: null,
  session: { authenticated: false, user: null, roles: [] },
  pendingSync: [],
  diagnostics: null,
  qaSelfTest: null,
  backups: [],
  editingEntryId: null
};

function buildAdapters() {
  backendAdapter = flags.useBackendAdapter && flags.backendBaseUrl
    ? createBackendAdapter({ baseUrl: flags.backendBaseUrl })
    : null;
  authAdapter = flags.authSessionEnabled && flags.backendBaseUrl
    ? createAuthSessionAdapter({ baseUrl: flags.backendBaseUrl })
    : null;
  repository = createAppRepository({
    localAdapter,
    backendAdapter,
    syncQueue,
    flags,
    onSyncError(error, context) {
      if (flags.debugMode) console.warn('[TERPN backend adapter]', context, error);
      toast(context?.operation === 'get'
        ? 'Backend read failed; using local data.'
        : 'Backend write failed; saved locally and queued when enabled.');
    }
  });
}

buildAdapters();

async function loadState() {
  const [profile, journal, signups, account, pendingSync, backups] = await Promise.all([
    repository.get('profile', null),
    repository.get('journal', []),
    repository.get('signups', []),
    repository.get('account', null),
    repository.pendingSync(),
    listLocalBackups(localAdapter)
  ]);

  state.profile = normalizeProfile(profile);
  state.journal = normalizeJournalEntries(journal);
  state.signups = Array.isArray(signups) ? signups.map(normalizeSignup).filter(Boolean) : [];
  state.account = normalizeAccount(account);
  state.pendingSync = pendingSync;
  state.backups = backups;
}

function currentData() {
  return {
    profile: state.profile,
    journal: state.journal,
    signups: state.signups,
    account: state.account,
    syncQueue: state.pendingSync,
    backups: state.backups
  };
}

function renderAll() {
  renderTerpenes(TERPENES);
  renderOnboarding(state.profile);
  renderJournalForm(state.journal.find(entry => entry.id === state.editingEntryId) || null);
  renderEntries(state.journal, state.editingEntryId);
  renderJournalInsights(state.journal);
  renderSignups(state.signups);
  renderAccount(state.account);
  renderFeatureFlags(flags);
  renderBackendHealth(state.backendHealth || undefined);
  renderSessionStatus(state.session, flags);
  renderSyncQueueStatus(state.pendingSync, flags);
  renderLocalBackups(state.backups);
  renderDataDiagnostics(state.diagnostics || undefined);
  renderQaSelfTest(state.qaSelfTest || undefined);
  renderBetaStatus();
  renderDashboard({ profile: state.profile, journalEntries: state.journal, account: state.account, adapterMode: repository.modeLabel });
}

async function refreshPendingSync() {
  state.pendingSync = await repository.pendingSync();
  renderSyncQueueStatus(state.pendingSync, flags);
}

async function refreshBackups() {
  state.backups = await listLocalBackups(localAdapter);
  renderLocalBackups(state.backups);
}

async function createSafetyBackup(reason) {
  const result = await createLocalBackup(localAdapter, currentData(), reason);
  state.backups = result.backups;
  renderLocalBackups(state.backups);
  return result.backup;
}

async function saveResource(resource, value) {
  state[resource] = await repository.set(resource, value);
  await refreshPendingSync();
  renderAll();
}

async function removeResource(resource, emptyValue) {
  await repository.remove(resource);
  state[resource] = emptyValue;
  if (resource === 'journal') state.editingEntryId = null;
  await refreshPendingSync();
  renderAll();
}

async function saveAllResources(nextState) {
  state.profile = nextState.profile;
  state.journal = nextState.journal;
  state.signups = nextState.signups;
  state.account = nextState.account;
  if (!state.journal.some(entry => entry.id === state.editingEntryId)) state.editingEntryId = null;

  await Promise.all([
    repository.set('profile', state.profile),
    repository.set('journal', state.journal),
    repository.set('signups', state.signups),
    repository.set('account', state.account)
  ]);

  await refreshPendingSync();
  renderAll();
}

async function seedIfEmpty() {
  if (!flags.seedSampleData || state.journal.length) return;
  const sample = normalizeJournalEntry({
    id: 'sample-entry-1',
    createdAt: new Date().toISOString(),
    title: 'Soft floral starter note',
    date: today(),
    terpenes: 'Linalool, ocimene',
    setting: 'Quiet evening',
    before: 'Curious',
    after: 'Grounded',
    notes: 'Sample entry showing how TERPN separates aroma notes from personal reflections. This is not a recommendation or outcome claim.'
  });
  state.journal = [sample].filter(Boolean);
  await repository.set('journal', state.journal);
}

function initFormDefaults() {
  renderJournalForm(null);
}

function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'));
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        resolve(JSON.parse(String(reader.result || '{}')));
      } catch (error) {
        reject(new Error(`Invalid JSON file: ${error.message}`));
      }
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('Could not read file.')));
    reader.readAsText(file);
  });
}

function collectFlagsFromForm() {
  return {
    useBackendAdapter: Boolean(qs('#flagUseBackend')?.checked),
    backendBaseUrl: String(qs('#flagBackendBaseUrl')?.value || '').trim().replace(/\/+$/, ''),
    backendReadEnabled: Boolean(qs('#flagBackendRead')?.checked),
    backendWriteEnabled: Boolean(qs('#flagBackendWrite')?.checked),
    mirrorBackendWritesToLocal: Boolean(qs('#flagMirrorWrites')?.checked),
    fallbackToLocalOnBackendError: Boolean(qs('#flagFallbackLocal')?.checked),
    queueFailedBackendWrites: Boolean(qs('#flagQueueWrites')?.checked),
    authSessionEnabled: Boolean(qs('#flagAuthSession')?.checked),
    seedSampleData: Boolean(qs('#flagSeedSample')?.checked),
    debugMode: Boolean(qs('#flagDebugMode')?.checked)
  };
}

function exportAllLocalData() {
  return downloadJson('terpn-local-data-export.json', buildExportEnvelope({
    profile: state.profile,
    journal: state.journal,
    signups: state.signups,
    account: state.account,
    adapterMode: repository.modeLabel
  }));
}

async function applyFeatureFlags(nextFlags) {
  flags = saveFeatureFlags(nextFlags);
  buildAdapters();
  await loadState();
  renderAll();
}

function resetJournalForm() {
  state.editingEntryId = null;
  renderJournalForm(null);
  qs('#entryTitle')?.focus();
}

function initFormHandlers() {
  qs('#onboardingForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = normalizeProfile({ ...Object.fromEntries(new FormData(event.currentTarget)), updatedAt: new Date().toISOString() });
    if (!data) return toast('Add at least one onboarding detail before saving.');
    await saveResource('profile', data);
    toast('Onboarding profile saved.');
  });

  qs('#generateStarterBtn')?.addEventListener('click', async () => {
    const data = normalizeProfile({ ...Object.fromEntries(new FormData(qs('#onboardingForm'))), updatedAt: new Date().toISOString() });
    if (!data) return toast('Add onboarding details before generating a starter path.');
    await saveResource('profile', data);
    toast('Starter path generated from your preferences.');
  });

  qs('#resetOnboardingBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset onboarding profile?')) return;
    await createSafetyBackup('before-onboarding-reset');
    await removeResource('profile', null);
    toast('Onboarding reset.');
  });

  qs('#journalForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const existing = state.journal.find(entry => entry.id === state.editingEntryId);
    const entry = normalizeJournalEntry({
      id: existing?.id || makeRecordId('entry'),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...Object.fromEntries(new FormData(event.currentTarget))
    });
    if (!entry) return toast('Add a title, terpene note, or reflection before saving.');

    const nextJournal = existing
      ? state.journal.map(item => (item.id === existing.id ? entry : item))
      : [...state.journal, entry];

    state.editingEntryId = null;
    await saveResource('journal', nextJournal);
    renderJournalForm(null);
    toast(existing ? 'Journal entry updated.' : 'Journal entry saved.');
  });

  qs('#cancelJournalEditBtn')?.addEventListener('click', resetJournalForm);

  qs('#loadSampleEntryBtn')?.addEventListener('click', () => {
    state.editingEntryId = null;
    renderJournalForm({
      title: 'Citrus and forest aroma reflection',
      date: today(),
      terpenes: 'Limonene, alpha-pinene, linalool',
      setting: 'Outdoor walk',
      before: 'Scattered',
      after: 'Clear',
      notes: 'I noticed citrus first, then a pine/forest note. The reflection felt clearer because I wrote down context before judging the experience.'
    });
  });

  qs('#entryList')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-entry-action]');
    if (!button) return;
    const entry = state.journal.find(item => item.id === button.dataset.entryId);
    if (!entry) return toast('Entry could not be found.');

    if (button.dataset.entryAction === 'edit') {
      state.editingEntryId = entry.id;
      renderJournalForm(entry);
      renderEntries(state.journal, state.editingEntryId);
      qs('#journalForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (button.dataset.entryAction === 'export') {
      downloadJson(`terpn-entry-${entry.date || 'export'}.json`, entry);
      return;
    }

    if (button.dataset.entryAction === 'duplicate') {
      const copy = normalizeJournalEntry({ ...entry, id: makeRecordId('entry'), title: `${entry.title} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await saveResource('journal', [...state.journal, copy]);
      toast('Journal entry duplicated.');
      return;
    }

    if (button.dataset.entryAction === 'delete') {
      if (!confirm(`Delete “${entry.title}”?`)) return;
      await saveResource('journal', state.journal.filter(item => item.id !== entry.id));
      toast('Journal entry deleted.');
    }
  });

  qs('#exportJournalBtn')?.addEventListener('click', () => downloadJson('terpn-journal-export.json', state.journal));
  qs('#importJournalBtn')?.addEventListener('click', () => qs('#journalImportInput')?.click());
  qs('#journalImportInput')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const json = await readFileAsJson(file);
      await createSafetyBackup('before-journal-import');
      const imported = normalizeJournalEntries(Array.isArray(json) ? json : json.journal || json.data?.journal);
      if (!imported.length) throw new Error('No valid journal entries found.');
      await saveResource('journal', mergeById(state.journal, imported));
      toast(`Imported ${imported.length} journal entr${imported.length === 1 ? 'y' : 'ies'}.`);
    } catch (error) {
      console.warn('[TERPN import journal]', error);
      toast(error.message || 'Could not import journal JSON.');
    } finally {
      event.currentTarget.value = '';
    }
  });

  qs('#clearJournalBtn')?.addEventListener('click', async () => {
    if (!confirm('Clear all local journal entries?')) return;
    await createSafetyBackup('before-journal-clear');
    await removeResource('journal', []);
    toast('Journal cleared.');
  });

  qs('#signupForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    if (!isValidEmail(raw.email)) return toast('Add a valid email before saving signup interest.');
    const data = normalizeSignup({ id: makeRecordId('signup'), createdAt: today(), ...raw });
    await saveResource('signups', mergeById(state.signups, [data]));
    event.currentTarget.reset();
    toast('Signup interest saved.');
  });

  qs('#accountForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = normalizeAccount({ ...Object.fromEntries(new FormData(event.currentTarget)), updatedAt: new Date().toISOString() });
    if (!data) return toast('Add a valid account name, role, plan, or email before saving.');
    await saveResource('account', data);
    toast('Local account mock saved.');
  });

  qs('#clearAccountBtn')?.addEventListener('click', async () => {
    if (!confirm('Clear local account mock?')) return;
    await createSafetyBackup('before-account-clear');
    await removeResource('account', null);
    toast('Local account mock cleared.');
  });

  qs('#exportAllBtn')?.addEventListener('click', exportAllLocalData);
  qs('#exportAllBackendBtn')?.addEventListener('click', exportAllLocalData);
  qs('#importAllBtn')?.addEventListener('click', () => qs('#allImportInput')?.click());
  qs('#allImportInput')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const json = await readFileAsJson(file);
      if (!hasImportableAppData(json)) throw new Error('No valid TERPN data found in import file.');
      await createSafetyBackup('before-full-import');
      const imported = normalizeAppExport(json);
      await saveAllResources({
        profile: imported.profile ?? state.profile,
        journal: mergeById(state.journal, imported.journal),
        signups: mergeById(state.signups, imported.signups),
        account: imported.account ?? state.account
      });
      toast('TERPN data imported and merged.');
    } catch (error) {
      console.warn('[TERPN import all]', error);
      toast(error.message || 'Could not import TERPN data JSON.');
    } finally {
      event.currentTarget.value = '';
    }
  });


  qs('#createBackupBtn')?.addEventListener('click', async () => {
    await createSafetyBackup('manual');
    toast('Local backup created.');
  });

  qs('#restoreBackupBtn')?.addEventListener('click', async () => {
    if (!confirm('Restore the latest local backup? Current data will be backed up first.')) return;
    await createSafetyBackup('before-backup-restore');
    const latest = await restoreLatestBackup(localAdapter);
    await saveAllResources({
      profile: latest.data.profile,
      journal: latest.data.journal,
      signups: latest.data.signups,
      account: latest.data.account
    });
    await refreshBackups();
    toast(`Restored backup from ${latest.createdAt}.`);
  });

  qs('#clearBackupsBtn')?.addEventListener('click', async () => {
    if (!confirm('Clear all local backups? This cannot be undone.')) return;
    state.backups = await clearLocalBackups(localAdapter);
    renderLocalBackups(state.backups);
    toast('Local backups cleared.');
  });

  qs('#exportBackupsBtn')?.addEventListener('click', () => {
    downloadJson('terpn-local-backups.json', state.backups);
  });

  qs('#backendFlagsForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    await applyFeatureFlags(collectFlagsFromForm());
    toast('Backend feature flags saved and applied.');
  });

  qs('#resetFlagsBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset feature flags to safe local-first defaults?')) return;
    flags = resetFeatureFlags();
    buildAdapters();
    await loadState();
    renderAll();
    toast('Feature flags reset.');
  });

  qs('#checkBackendBtn')?.addEventListener('click', async () => {
    const nextFlags = collectFlagsFromForm();
    if (!nextFlags.backendBaseUrl) return toast('Add a backend base URL before checking health.');
    try {
      const tester = createBackendAdapter({ baseUrl: nextFlags.backendBaseUrl });
      const result = await tester.health();
      state.backendHealth = { label: 'Reachable', detail: JSON.stringify(result ?? { ok: true }).slice(0, 220) };
      renderBackendHealth(state.backendHealth);
      toast('Backend health check passed.');
    } catch (error) {
      state.backendHealth = { label: 'Unavailable', detail: error.message || 'Health check failed.' };
      renderBackendHealth(state.backendHealth);
      toast('Backend health check failed.');
    }
  });

  qs('#authSessionForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!flags.authSessionEnabled || !authAdapter) return toast('Enable auth/session and save flags first.');
    try {
      state.session = await authAdapter.getSession();
      renderSessionStatus(state.session, flags);
      toast('Session check completed.');
    } catch (error) {
      state.session = { authenticated: false, user: null, roles: [] };
      renderSessionStatus(state.session, flags);
      toast(error.message || 'Session check failed.');
    }
  });

  qs('#requestMagicLinkBtn')?.addEventListener('click', async () => {
    const email = qs('#magicLinkEmail')?.value || state.account?.email || '';
    if (!isValidEmail(email)) return toast('Add a valid email for magic-link testing.');
    if (!flags.authSessionEnabled || !authAdapter) return toast('Enable auth/session and save flags first.');
    try {
      await authAdapter.requestMagicLink({ email, redirectTo: location.href.split('?')[0] });
      toast('Magic-link request sent to backend stub.');
    } catch (error) {
      toast(error.message || 'Magic-link request failed.');
    }
  });

  qs('#signOutSessionBtn')?.addEventListener('click', async () => {
    if (!flags.authSessionEnabled || !authAdapter) return toast('Auth/session is disabled.');
    state.session = await authAdapter.signOut();
    renderSessionStatus(state.session, flags);
    toast('Session signed out.');
  });

  qs('#flushSyncQueueBtn')?.addEventListener('click', async () => {
    const result = await repository.flushPendingSync();
    await refreshPendingSync();
    if (result.skipped) return toast(result.skipped);
    toast(`Retried ${result.flushed} queued backend write${result.flushed === 1 ? '' : 's'}.`);
  });

  qs('#clearSyncQueueBtn')?.addEventListener('click', async () => {
    if (!confirm('Clear all queued backend retries?')) return;
    state.pendingSync = await repository.clearPendingSync();
    renderSyncQueueStatus(state.pendingSync, flags);
    toast('Queued backend retries cleared.');
  });

  qs('#runDiagnosticsBtn')?.addEventListener('click', () => {
    state.diagnostics = analyzeAppData(currentData());
    renderDataDiagnostics(state.diagnostics);
    toast('Local data diagnostics complete.');
  });

  qs('#repairLocalDataBtn')?.addEventListener('click', async () => {
    if (!confirm('Repair local data by normalizing rows and removing invalid records?')) return;
    await createSafetyBackup('before-local-data-repair');
    const repaired = repairAppData(currentData());
    await saveAllResources(repaired);
    state.diagnostics = analyzeAppData(currentData());
    renderDataDiagnostics(state.diagnostics);
    toast('Local data repair complete.');
  });

  qs('#exportDiagnosticsBtn')?.addEventListener('click', () => {
    const report = state.diagnostics || analyzeAppData(currentData());
    downloadJson('terpn-diagnostics.json', report);
  });


  qs('#runSelfTestBtn')?.addEventListener('click', () => {
    state.qaSelfTest = runQaSelfTest({
      flags,
      data: currentData(),
      diagnostics: state.diagnostics,
      repositoryMode: repository.modeLabel
    });
    renderQaSelfTest(state.qaSelfTest);
    toast(`Beta self-test: ${state.qaSelfTest.status}.`);
  });

  qs('#exportSelfTestBtn')?.addEventListener('click', () => {
    const report = state.qaSelfTest || runQaSelfTest({
      flags,
      data: currentData(),
      diagnostics: state.diagnostics,
      repositoryMode: repository.modeLabel
    });
    downloadJson('terpn-beta-self-test.json', report);
  });

  qsa('[data-plan]').forEach(button => button.addEventListener('click', () => {
    qs('[data-tab="signup"]')?.click();
    if (qs('#signupPlan')) qs('#signupPlan').value = button.dataset.plan;
    qs('#signupName')?.focus();
  }));
}

function initFilters() {
  qs('#terpeneSearch')?.addEventListener('input', () => renderTerpenes(TERPENES));
  qs('#terpeneFilter')?.addEventListener('change', () => renderTerpenes(TERPENES));
  qs('#journalSearch')?.addEventListener('input', () => renderEntries(state.journal, state.editingEntryId));
  qs('#journalMoodFilter')?.addEventListener('change', () => renderEntries(state.journal, state.editingEntryId));
}

export async function initApp() {
  initTabs();
  initFormDefaults();
  initFormHandlers();
  initFilters();
  await loadState();
  await seedIfEmpty();
  state.diagnostics = analyzeAppData(currentData());
  state.qaSelfTest = runQaSelfTest({ flags, data: currentData(), diagnostics: state.diagnostics, repositoryMode: repository.modeLabel });
  renderAll();
  console.info(`TERPN ${APP_SCHEMA_VERSION} initialized in ${repository.modeLabel} mode.`);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(error => {
      console.error('[TERPN init]', error);
      toast('TERPN could not initialize. Check the console for details.');
    });
  });
}
