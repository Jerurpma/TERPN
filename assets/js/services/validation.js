const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asText(value, fallback = '', maxLength = 500) {
  const text = String(value ?? fallback).trim();
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function asDate(value) {
  const text = asText(value, '', 20);
  return DATE_PATTERN.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function asRecordId(value, prefix) {
  const text = asText(value, '', 90);
  return text || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function hasMeaningfulText(...values) {
  return values.some(value => asText(value).length > 0);
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(asText(value, '', 254));
}

export function normalizeProfile(input = {}) {
  if (!input || typeof input !== 'object') return null;
  if (!hasMeaningfulText(input.name, input.notes, input.goal, input.aroma, input.sensitivity)) return null;
  return {
    name: asText(input.name, '', 80),
    goal: asText(input.goal, 'learn', 40),
    aroma: asText(input.aroma, 'citrus', 40),
    sensitivity: asText(input.sensitivity, 'standard', 50),
    notes: asText(input.notes, '', 900),
    updatedAt: asText(input.updatedAt, new Date().toISOString(), 40)
  };
}

export function normalizeJournalEntry(input = {}) {
  if (!input || typeof input !== 'object') return null;
  if (!hasMeaningfulText(input.title, input.notes, input.terpenes)) return null;
  return {
    id: asRecordId(input.id, 'entry'),
    createdAt: asText(input.createdAt, new Date().toISOString(), 40),
    updatedAt: asText(input.updatedAt, input.createdAt || new Date().toISOString(), 40),
    title: asText(input.title, 'Untitled reflection', 120),
    date: asDate(input.date),
    terpenes: asText(input.terpenes, '', 180),
    setting: asText(input.setting, 'Home reflection', 80),
    before: asText(input.before, 'Curious', 60),
    after: asText(input.after, 'Neutral', 60),
    notes: asText(input.notes, '', 1800)
  };
}

export function normalizeJournalEntries(value = []) {
  return (Array.isArray(value) ? value : []).map(normalizeJournalEntry).filter(Boolean);
}

export function normalizeSignup(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const email = asText(input.email, '', 254).toLowerCase();
  if (!isValidEmail(email)) return null;
  return {
    id: asRecordId(input.id, 'signup'),
    createdAt: asText(input.createdAt, new Date().toISOString().slice(0, 10), 40),
    name: asText(input.name, '', 80),
    email,
    plan: asText(input.plan, 'Starter', 40),
    role: asText(input.role, 'Personal journal', 80),
    note: asText(input.note, '', 1000)
  };
}

export function normalizeSignups(value = []) {
  return (Array.isArray(value) ? value : []).map(normalizeSignup).filter(Boolean);
}

export function normalizeAccount(input = {}) {
  if (!input || typeof input !== 'object') return null;
  if (!hasMeaningfulText(input.name, input.email, input.role, input.plan)) return null;
  const email = asText(input.email, '', 254).toLowerCase();
  if (email && !isValidEmail(email)) return null;
  return {
    name: asText(input.name, '', 80),
    email,
    role: asText(input.role, 'Member', 40),
    plan: asText(input.plan, 'Starter', 40),
    updatedAt: asText(input.updatedAt, new Date().toISOString(), 40)
  };
}

export function normalizeAppExport(input = {}) {
  const data = input?.data && typeof input.data === 'object' ? input.data : input;
  if (!data || typeof data !== 'object') {
    return { profile: null, journal: [], signups: [], account: null };
  }
  return {
    profile: normalizeProfile(data.profile),
    journal: normalizeJournalEntries(data.journal),
    signups: normalizeSignups(data.signups),
    account: normalizeAccount(data.account)
  };
}

export function hasImportableAppData(value = {}) {
  const normalized = normalizeAppExport(value);
  return Boolean(normalized.profile || normalized.account || normalized.journal.length || normalized.signups.length);
}

export function mergeById(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].filter(Boolean).forEach(item => {
    if (!item.id) return;
    map.set(item.id, { ...map.get(item.id), ...item });
  });
  return Array.from(map.values());
}
