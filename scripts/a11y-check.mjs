import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('assets/css/styles.css', 'utf8');
const tabsJs = readFileSync('assets/js/ui/tabs.js', 'utf8');

function requireIncludes(source, needle, label = needle) {
  if (!source.includes(needle)) throw new Error(`Missing accessibility requirement: ${label}`);
}

function collectIds(source) {
  return new Set([...source.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]));
}

function collectLabeledFor(source) {
  return new Set([...source.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["'][^>]*>/g)].map(match => match[1]));
}

function assertFormControlsAreNamed(source) {
  const labels = collectLabeledFor(source);
  const controls = [...source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
    .map(match => ({ tag: match[1], attrs: match[2] }))
    .filter(item => !/type=["'](?:hidden|submit|button|checkbox|radio)["']/i.test(item.attrs))
    .filter(item => !/class=["'][^"']*visually-hidden/i.test(item.attrs));

  const unnamed = controls.filter(({ attrs }) => {
    const id = attrs.match(/\bid=["']([^"']+)["']/)?.[1];
    return !attrs.includes('aria-label=') && !attrs.includes('aria-labelledby=') && !(id && labels.has(id));
  });

  if (unnamed.length) {
    throw new Error(`Unnamed form control(s): ${unnamed.map(item => item.attrs.trim()).join(' | ')}`);
  }
}

function assertTabSemantics(source) {
  requireIncludes(source, 'role="tablist"', 'pricing tablist role');
  const tabMatches = [...source.matchAll(/<button\b([^>]*\brole=["']tab["'][^>]*)>/g)];
  if (tabMatches.length < 2) throw new Error('Expected at least two role="tab" buttons.');

  const ids = collectIds(source);
  for (const match of tabMatches) {
    const attrs = match[1];
    const id = attrs.match(/\bid=["']([^"']+)["']/)?.[1];
    const controls = attrs.match(/\baria-controls=["']([^"']+)["']/)?.[1];
    if (!id || !controls) throw new Error(`Tab is missing id or aria-controls: ${attrs}`);
    if (!ids.has(controls)) throw new Error(`Tab controls missing panel id: ${controls}`);
    if (!attrs.includes('aria-selected=')) throw new Error(`Tab is missing aria-selected: ${id}`);
  }

  const panelMatches = [...source.matchAll(/<div\b([^>]*\brole=["']tabpanel["'][^>]*)>/g)];
  if (panelMatches.length < 2) throw new Error('Expected at least two role="tabpanel" panels.');
  for (const match of panelMatches) {
    const attrs = match[1];
    const labelledBy = attrs.match(/\baria-labelledby=["']([^"']+)["']/)?.[1];
    if (!labelledBy || !ids.has(labelledBy)) throw new Error(`Tab panel is missing a valid aria-labelledby: ${attrs}`);
    if (!attrs.includes('tabindex="0"')) throw new Error(`Tab panel should be keyboard-focusable: ${attrs}`);
  }
}

requireIncludes(html, 'class="skip-link"', 'skip link');
requireIncludes(html, 'aria-live="polite"', 'polite live regions');
requireIncludes(css, ':focus-visible', 'visible keyboard focus styling');
requireIncludes(css, '.skip-link:focus', 'skip link focus state');
requireIncludes(tabsJs, 'ArrowRight', 'keyboard navigation for tabs');
requireIncludes(tabsJs, 'aria-selected', 'runtime tab aria-selected updates');
assertFormControlsAreNamed(html);
assertTabSemantics(html);

console.log('Accessibility checks passed');
