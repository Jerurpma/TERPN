import { qs, qsa, escapeHtml, setText } from '../utils/dom.js';
import { onboardingScore, starterPath } from '../services/onboarding.js';
import { computeJournalInsights } from '../services/journalInsights.js';
import { summarizeSyncQueue } from '../services/syncQueue.js';
import { summarizeLocalBackups } from '../services/localBackups.js';
import { APP_SCHEMA_VERSION } from '../config/dataModel.js';

export function renderTerpenes(terpenes = []) {
  const list = qs('#terpeneList');
  if (!list) return;

  const term = qs('#terpeneSearch')?.value.trim().toLowerCase() || '';
  const filter = qs('#terpeneFilter')?.value || 'all';
  const filtered = terpenes.filter(item => {
    const haystack = [item.name, item.category, item.aroma, item.notes, ...(item.tags || [])].join(' ').toLowerCase();
    return (filter === 'all' || item.category === filter) && (!term || haystack.includes(term));
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="card"><p class="small">No terpenes match that search yet.</p></div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'terpene-card';
    const affinity = Math.max(0, Math.min(100, Number(item.affinity) || 0));
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="small"><strong>Aroma:</strong> ${escapeHtml(item.aroma)}</p>
        <p class="small">${escapeHtml(item.notes)}</p>
        <div class="tagrow">${(item.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>
      <div>
        <span class="tiny">Profile match</span>
        <div class="meter" aria-label="${affinity}% match"><span style="width:${affinity}%"></span></div>
      </div>`;
    list.appendChild(card);
  });
}

export function renderOnboarding(profile) {
  const fields = {
    '#onboardName': profile?.name || '',
    '#onboardGoal': profile?.goal || 'learn',
    '#onboardAroma': profile?.aroma || 'citrus',
    '#onboardSensitivity': profile?.sensitivity || 'standard',
    '#onboardNotes': profile?.notes || ''
  };
  Object.entries(fields).forEach(([selector, value]) => {
    const node = qs(selector);
    if (node) node.value = value;
  });

  const score = onboardingScore(profile);
  setText('#onboardStatus', `${score}%`);
  qsa('[data-step-card]').forEach((card, index) => {
    card.classList.toggle('active', score >= (index + 1) * 25 || (index === 0 && score === 0));
  });

  const path = profile ? starterPath(profile) : null;
  setText('#starterSummary', path ? `${path.title}: ${path.steps[0]}` : 'Complete onboarding to generate a starter path.');
  const tagRoot = qs('#starterTags');
  if (tagRoot) tagRoot.innerHTML = path ? path.selected.map(name => `<span class="tag gold">${escapeHtml(name)}</span>`).join('') : '';

  const checklist = qs('#onboardingChecklist');
  if (!checklist) return;
  checklist.innerHTML = '';
  (path?.steps || ['Add a display name.', 'Choose a goal.', 'Select aroma preferences.', 'Review trust boundaries.']).forEach((step, index) => {
    const item = document.createElement('label');
    item.className = 'check-item';
    item.innerHTML = `<input type="checkbox" ${profile && index < Math.ceil(score / 25) ? 'checked' : ''}> <span>${escapeHtml(step)}</span>`;
    checklist.appendChild(item);
  });
}

export function renderJournalForm(entry = null) {
  const values = {
    '#entryTitle': entry?.title || '',
    '#entryDate': entry?.date || new Date().toISOString().slice(0, 10),
    '#entryTerpenes': entry?.terpenes || '',
    '#entrySetting': entry?.setting || 'Home reflection',
    '#entryBefore': entry?.before || 'Curious',
    '#entryAfter': entry?.after || 'Neutral',
    '#entryNotes': entry?.notes || ''
  };
  Object.entries(values).forEach(([selector, value]) => {
    const node = qs(selector);
    if (node) node.value = value;
  });
  setText('#journalFormMode', entry ? `Editing “${entry.title}”` : 'New entry');
  setText('#journalSubmitBtn', entry ? 'Update journal entry' : 'Save journal entry');
  const cancel = qs('#cancelJournalEditBtn');
  if (cancel) cancel.hidden = !entry;
}

export function renderEntries(entries = [], editingId = null) {
  const term = qs('#journalSearch')?.value.trim().toLowerCase() || '';
  const mood = qs('#journalMoodFilter')?.value || 'all';
  const list = qs('#entryList');
  if (!list) return;

  const filtered = entries.filter(entry => {
    const haystack = Object.values(entry || {}).join(' ').toLowerCase();
    return (!term || haystack.includes(term)) && (mood === 'all' || entry.after === mood);
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="entry-card"><p class="small">No journal entries match this view yet.</p></div>';
    return;
  }

  filtered
    .slice()
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')))
    .forEach(entry => {
      const card = document.createElement('article');
      card.className = `entry-card${entry.id === editingId ? ' active-edit' : ''}`;
      const tags = String(entry.terpenes || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join('');

      card.innerHTML = `
        <div class="entry-meta"><span>${escapeHtml(entry.date)} · ${escapeHtml(entry.setting)}</span><span>${escapeHtml(entry.before)} → ${escapeHtml(entry.after)}</span></div>
        <h3>${escapeHtml(entry.title)}</h3>
        <p class="small">${escapeHtml(entry.notes)}</p>
        <div class="tagrow">${tags}</div>
        <div class="entry-actions" aria-label="Entry actions">
          <button class="ghost-btn compact-btn" type="button" data-entry-action="edit" data-entry-id="${escapeHtml(entry.id)}">Edit</button>
          <button class="ghost-btn compact-btn" type="button" data-entry-action="export" data-entry-id="${escapeHtml(entry.id)}">Export</button>
          <button class="secondary-btn compact-btn" type="button" data-entry-action="duplicate" data-entry-id="${escapeHtml(entry.id)}">Duplicate</button>
          <button class="danger-btn compact-btn" type="button" data-entry-action="delete" data-entry-id="${escapeHtml(entry.id)}">Delete</button>
        </div>`;
      list.appendChild(card);
    });
}

function renderInsightTags(selector, items = [], emptyText) {
  const root = qs(selector);
  if (!root) return;
  root.innerHTML = items.length
    ? items.map(item => `<span class="tag gold">${escapeHtml(item.label)} · ${item.count}</span>`).join('')
    : `<span class="tag">${escapeHtml(emptyText)}</span>`;
}

export function renderJournalInsights(entries = []) {
  const insights = computeJournalInsights(entries);
  setText('#insightEntryCount', insights.totalEntries);
  setText('#insightLatestDate', insights.latestDate);
  setText('#insightPatternStatus', insights.hasEnoughForPatterns ? 'Pattern-ready' : 'Needs 3+ entries');
  setText('#insightPatternStatusInline', insights.hasEnoughForPatterns ? 'Pattern-ready' : 'Pending');
  renderInsightTags('#insightTerpenes', insights.topTerpenes, 'No terpene tags yet');
  renderInsightTags('#insightMoods', insights.topMoods, 'No reflections yet');
  renderInsightTags('#insightSettings', insights.topSettings, 'No settings yet');
}

export function renderSignups(signups = []) {
  const list = qs('#signupList');
  if (!list) return;
  list.innerHTML = '';
  if (!signups.length) {
    list.innerHTML = '<div class="entry-card"><p class="small">No local signup interest saved yet.</p></div>';
    return;
  }
  signups.slice().reverse().forEach(item => {
    const card = document.createElement('article');
    card.className = 'entry-card';
    card.innerHTML = `<div class="entry-meta"><span>${escapeHtml(item.plan)} · ${escapeHtml(item.role)}</span><span>${escapeHtml(item.createdAt)}</span></div><h3>${escapeHtml(item.name || 'Interested user')}</h3><p class="small">${escapeHtml(item.email)}</p><p class="small">${escapeHtml(item.note || 'No note added.')}</p>`;
    list.appendChild(card);
  });
}

export function renderAccount(account) {
  setText('#accountStatus', account?.email ? 'Mocked' : 'Local');
  const values = {
    '#accountName': account?.name || '',
    '#accountEmail': account?.email || '',
    '#accountRole': account?.role || 'Member',
    '#accountPlan': account?.plan || 'Starter'
  };
  Object.entries(values).forEach(([selector, value]) => {
    const node = qs(selector);
    if (node) node.value = value;
  });
}

export function renderFeatureFlags(flags) {
  if (!flags) return;
  if (qs('#flagUseBackend')) qs('#flagUseBackend').checked = Boolean(flags.useBackendAdapter);
  if (qs('#flagBackendBaseUrl')) qs('#flagBackendBaseUrl').value = flags.backendBaseUrl || '';
  if (qs('#flagBackendRead')) qs('#flagBackendRead').checked = Boolean(flags.backendReadEnabled);
  if (qs('#flagBackendWrite')) qs('#flagBackendWrite').checked = Boolean(flags.backendWriteEnabled);
  if (qs('#flagMirrorWrites')) qs('#flagMirrorWrites').checked = Boolean(flags.mirrorBackendWritesToLocal);
  if (qs('#flagFallbackLocal')) qs('#flagFallbackLocal').checked = Boolean(flags.fallbackToLocalOnBackendError);
  if (qs('#flagQueueWrites')) qs('#flagQueueWrites').checked = Boolean(flags.queueFailedBackendWrites);
  if (qs('#flagAuthSession')) qs('#flagAuthSession').checked = Boolean(flags.authSessionEnabled);
  if (qs('#flagSeedSample')) qs('#flagSeedSample').checked = Boolean(flags.seedSampleData);
  if (qs('#flagDebugMode')) qs('#flagDebugMode').checked = Boolean(flags.debugMode);
}

export function renderBackendHealth(status = {}) {
  setText('#backendHealthStatus', status.label || 'Not checked');
  setText('#backendHealthDetail', status.detail || 'Use the backend flag panel to test /api/health before enabling remote reads or writes.');
}

export function renderSessionStatus(session = {}, flags = {}) {
  const enabled = Boolean(flags.authSessionEnabled);
  const authenticated = Boolean(session.authenticated);
  setText('#sessionStatusLabel', enabled ? (authenticated ? 'Authenticated' : 'Not signed in') : 'Disabled');
  const email = session.user?.email ? ` · ${session.user.email}` : '';
  const roles = session.roles?.length ? ` · ${session.roles.join(', ')}` : '';
  setText('#sessionStatusDetail', enabled
    ? `Session adapter is enabled${email}${roles}.`
    : 'Enable auth/session only after /api/session is implemented.');
}

export function renderSyncQueueStatus(items = [], flags = {}) {
  const summary = summarizeSyncQueue(items);
  const enabled = Boolean(flags.queueFailedBackendWrites);
  setText('#syncQueueCount', summary.total);
  setText('#syncQueueStatus', enabled ? `${summary.total} queued` : 'Disabled');
  setText('#syncQueueLatest', summary.latestQueuedAt || 'None');
  const parts = Object.entries(summary.byResource).map(([resource, count]) => `${resource}: ${count}`);
  const detail = !enabled
    ? 'Enable queued backend writes to preserve failed remote writes for a later retry.'
    : summary.total
      ? `Pending retry snapshots: ${parts.join(', ')}${summary.latestQueuedAt ? ` · Latest ${summary.latestQueuedAt}` : ''}`
      : 'No pending backend write retries.';
  setText('#syncQueueDetail', detail);
}


export function renderLocalBackups(backups = []) {
  const summary = summarizeLocalBackups(backups);
  setText('#backupStatus', summary.total ? `${summary.total} saved` : 'None yet');
  setText('#backupDetail', summary.total
    ? `Latest: ${summary.latest} · Reason: ${summary.latestReason} · Keeps up to ${summary.maxBackups}.`
    : 'Create a backup before destructive imports, repairs, clears, or backend testing.');
}

export function renderDataDiagnostics(report = {}) {
  setText('#diagnosticStatus', report.status || 'Not checked');
  const counts = report.counts || {};
  setText('#diagnosticDetail', report.checkedAt
    ? `Checked ${report.checkedAt}. Journal: ${counts.journal || 0}; signups: ${counts.signups || 0}; estimated bytes: ${report.dataBytes || 0}.`
    : 'Run diagnostics before importing data, repairing local data, or connecting backend storage.');
  const list = qs('#diagnosticIssues');
  if (!list) return;
  const issues = Array.isArray(report.issues) ? report.issues : [];
  list.innerHTML = issues.length
    ? issues.map(item => `<div class="entry-card"><strong>${escapeHtml(item.severity)} · ${escapeHtml(item.label)}</strong><p class="small">${escapeHtml(item.detail)}</p></div>`).join('')
    : '<div class="entry-card"><p class="small">No local data issues reported yet.</p></div>';
}

export function renderBetaStatus() {
  setText('#schemaVersionLabel', APP_SCHEMA_VERSION);
  setText('#betaVersionLabel', 'v1.8.0-private-beta-handoff');
}

export function renderQaSelfTest(report = {}) {
  setText('#qaSelfTestStatus', report.status || 'Not run');
  setText('#qaSelfTestDetail', report.summary
    ? `${report.summary} · Checked ${report.checkedAt || 'now'}.`
    : 'Run this browser self-test before sharing a beta link.');

  const list = qs('#qaSelfTestIssues');
  if (!list) return;
  const checks = Array.isArray(report.checks) ? report.checks : [];
  list.innerHTML = checks.length
    ? checks.map(item => `<div class="entry-card"><strong>${escapeHtml(item.status)} · ${escapeHtml(item.label)}</strong><p class="small">${escapeHtml(item.detail)}</p></div>`).join('')
    : '<div class="entry-card"><p class="small">No browser self-test results yet.</p></div>';
}

export function renderDashboard({ profile, journalEntries = [], account, adapterMode }) {
  setText('#savedCount', journalEntries.length);
  setText('#onboardStatus', `${onboardingScore(profile)}%`);
  setText('#accountStatus', account?.email ? 'Mocked' : 'Local');
  setText('#adapterModeLabel', adapterMode || 'Local storage');
}
