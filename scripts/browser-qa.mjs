import { spawn } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT_URL = process.env.TERPN_QA_URL || 'http://127.0.0.1:4173';
const SHOULD_START_SERVER = !process.env.TERPN_QA_URL;
const DEBUG_PORT = 9223;
const USER_DATA_DIR = '/tmp/terpn-chromium-qa-profile';
const results = [];
const issues = [];
const consoleMessages = [];
let browser = null;
let server = null;

function record(name, ok, details = '') {
  results.push({ name, ok, details });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(`${label} ${name}${details ? ` - ${details}` : ''}`);
  if (!ok) issues.push(`${name}${details ? `: ${details}` : ''}`);
}

async function waitFor(fn, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  if (lastError) throw lastError;
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function startServer() {
  server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => {
    if (process.env.TERPN_QA_VERBOSE) process.stdout.write(chunk);
  });
  server.stderr.on('data', chunk => {
    if (process.env.TERPN_QA_VERBOSE) process.stderr.write(chunk);
  });
}

function startBrowser() {
  try { rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(USER_DATA_DIR, { recursive: true });
  browser = spawn('chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      for (const handler of this.handlers) handler(message);
    });
  }

  onEvent(handler) {
    this.handlers.push(handler);
  }

  async send(method, params = {}, sessionId = undefined) {
    await this.ready;
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

function jsString(value) {
  return JSON.stringify(String(value));
}

async function main() {
  if (SHOULD_START_SERVER) {
    startServer();
    await waitFor(() => fetch(`${ROOT_URL}/index.html`).then(r => r.ok).catch(() => false), 5000);
  }

  startBrowser();
  const version = await waitFor(() => fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`), 7000);
  const cdp = new CDP(version.webSocketDebuggerUrl);
  await cdp.ready;

  cdp.onEvent(async message => {
    if (message.method === 'Runtime.consoleAPICalled') {
      const args = message.params?.args || [];
      const text = args.map(arg => arg.value ?? arg.description ?? '').join(' ');
      consoleMessages.push({ type: message.params?.type, text });
      if (message.params?.type === 'error') issues.push(`Console error: ${text}`);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const text = message.params?.exceptionDetails?.text || 'Runtime exception';
      issues.push(text);
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params?.entry || {};
      consoleMessages.push({ type: entry.level, text: entry.text });
      if (entry.level === 'error') issues.push(`Log error: ${entry.text}`);
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      await cdp.send('Page.handleJavaScriptDialog', { accept: true }, message.sessionId).catch(() => {});
    }
  });

  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const page = (method, params = {}) => cdp.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Evaluation failed');
    }
    return result.result?.value;
  };

  await page('Page.enable');
  await page('Runtime.enable');
  await page('Log.enable');
  const navigation = await page('Page.navigate', { url: ROOT_URL });
  if (navigation.errorText) {
    record('page navigation', false, navigation.errorText);
    throw new Error(`Browser could not open ${ROOT_URL}: ${navigation.errorText}`);
  }
  await waitFor(() => evaluate('document.readyState === "complete"'), 8000);
  await waitFor(() => evaluate('Boolean(document.querySelector("#terpeneList")?.children.length)'), 8000);

  const title = await evaluate('document.title');
  record('page loads', title.includes('TERPN'), title);
  record('no initial runtime issues', issues.length === 0, issues.join('; '));

  await evaluate(`document.querySelector('#onboardName').value=${jsString('QA Tester')};
    document.querySelector('#onboardGoal').value='journal';
    document.querySelector('#onboardAroma').value='forest';
    document.querySelector('#onboardSensitivity').value='standard';
    document.querySelector('#onboardNotes').value=${jsString('Browser QA onboarding note')};
    document.querySelector('#onboardingForm').requestSubmit();`);
  await delay(150);
  record('onboarding saves profile', await evaluate('document.querySelector("#onboardStatus")?.textContent?.includes("100")'));

  await evaluate(`document.querySelector('#entryTitle').value=${jsString('Browser QA Journal')};
    document.querySelector('#entryDate').value='2026-05-15';
    document.querySelector('#entryTerpenes').value=${jsString('Linalool, Pinene')};
    document.querySelector('#entrySetting').value='Quiet evening';
    document.querySelector('#entryBefore').value='Curious';
    document.querySelector('#entryAfter').value='Grounded';
    document.querySelector('#entryNotes').value=${jsString('Browser QA created this reflection.')};
    document.querySelector('#journalForm').requestSubmit();`);
  await delay(150);
  record('journal creates entry', await evaluate('document.querySelector("#savedCount")?.textContent === "1"'));

  await evaluate(`document.querySelector('[data-entry-action="edit"]')?.click();`);
  await delay(100);
  record('journal edit mode opens', await evaluate('document.querySelector("#cancelJournalEditBtn")?.hidden === false'));

  await evaluate(`document.querySelector('#entryNotes').value=${jsString('Browser QA updated this reflection.')};
    document.querySelector('#journalForm').requestSubmit();`);
  await delay(150);
  record('journal edit mode saves update', await evaluate('document.body.textContent.includes("updated this reflection")'));

  await evaluate(`document.querySelector('[data-entry-action="duplicate"]')?.click();`);
  await delay(150);
  record('journal duplicate action works', await evaluate('document.querySelector("#savedCount")?.textContent === "2"'));

  await evaluate(`document.querySelector('#runDiagnosticsBtn')?.click();`);
  await delay(150);
  record('diagnostics runs', await evaluate('document.querySelector("#diagnosticsStatus")?.textContent?.length > 0'));

  await evaluate(`document.querySelector('#createBackupBtn')?.click();`);
  await delay(150);
  record('backup creates snapshot', await evaluate('document.querySelector("#backupStatus")?.textContent?.match(/[1-9]/) !== null'));

  await evaluate(`document.querySelector('#runSelfTestBtn')?.click();`);
  await delay(150);
  const selfTestText = await evaluate('document.querySelector("#qaSelfTestStatus")?.textContent || document.body.textContent');
  record('self-test runs', /pass|ok|ready/i.test(selfTestText), selfTestText.slice(0, 120));

  await evaluate(`document.querySelector('#flagUseBackend').checked=false;
    document.querySelector('#flagBackendRead').checked=false;
    document.querySelector('#flagBackendWrite').checked=false;
    document.querySelector('#backendFlagsForm').requestSubmit();`);
  await delay(150);
  record('backend flags remain local-first/off', await evaluate('localStorage.getItem("terpn.featureFlags.v1")?.includes("useBackendAdapter") && JSON.parse(localStorage.getItem("terpn.featureFlags.v1")).useBackendAdapter === false'));

  await evaluate(`document.querySelector('#signupName').value=${jsString('QA Tester')};
    document.querySelector('#signupEmail').value=${jsString('qa@example.com')};
    document.querySelector('#signupPlan').value='founder';
    document.querySelector('#signupInterest').value=${jsString('Private beta QA')};
    document.querySelector('#signupForm').requestSubmit();`);
  await delay(150);
  record('waitlist signup saves', await evaluate('document.body.textContent.includes("qa@example.com")'));

  await evaluate(`document.querySelector('#accountName').value=${jsString('QA Tester')};
    document.querySelector('#accountEmail').value=${jsString('qa@example.com')};
    document.querySelector('#accountRole').value='tester';
    document.querySelector('#accountForm').requestSubmit();`);
  await delay(150);
  record('account profile saves', await evaluate('document.querySelector("#accountStatus")?.textContent?.length > 0'));

  const finalIssues = issues.filter(Boolean);
  record('no browser console/runtime errors after flows', finalIssues.length === 0, finalIssues.join('; '));

  const report = {
    generatedAt: new Date().toISOString(),
    url: ROOT_URL,
    browser: 'chromium headless',
    summary: {
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      total: results.length
    },
    results,
    issues: finalIssues,
    consoleMessages
  };
  mkdirSync('deploy', { recursive: true });
  writeFileSync('deploy/browser-qa-report.json', JSON.stringify(report, null, 2));

  cdp.close();
  if (browser) browser.kill('SIGTERM');
  if (server) server.kill('SIGTERM');

  if (report.summary.failed > 0) {
    throw new Error(`Browser QA failed: ${report.summary.failed} failure(s)`);
  }
}

main().catch(error => {
  if (browser) browser.kill('SIGTERM');
  if (server) server.kill('SIGTERM');
  console.error(error);
  process.exit(1);
});
