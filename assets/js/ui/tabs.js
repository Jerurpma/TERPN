import { qsa, qs } from '../utils/dom.js';

function getTabs() {
  return qsa('[data-tab]');
}

function getPanels() {
  return qsa('[data-panel]');
}

function activateTab(tabName, { focus = false } = {}) {
  const tabs = getTabs();
  const panels = getPanels();

  tabs.forEach(button => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    if (focus && isActive) button.focus();
  });

  panels.forEach(panel => {
    const isActive = panel.dataset.panel === tabName;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

function moveTabFocus(currentButton, direction) {
  const tabs = getTabs();
  const currentIndex = tabs.indexOf(currentButton);
  if (currentIndex === -1) return;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  activateTab(tabs[nextIndex].dataset.tab, { focus: true });
}

function handleTabKeydown(event) {
  const button = event.currentTarget;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    moveTabFocus(button, 1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveTabFocus(button, -1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    const first = getTabs()[0];
    if (first) activateTab(first.dataset.tab, { focus: true });
  }
  if (event.key === 'End') {
    event.preventDefault();
    const tabs = getTabs();
    const last = tabs[tabs.length - 1];
    if (last) activateTab(last.dataset.tab, { focus: true });
  }
}

export function initTabs() {
  getTabs().forEach(button => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
    button.addEventListener('keydown', handleTabKeydown);
  });

  qsa('[data-tab-target]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tabTarget;
      qs('#pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      activateTab(tab, { focus: true });
    });
  });

  const activeTab = getTabs().find(button => button.classList.contains('active')) || getTabs()[0];
  if (activeTab) activateTab(activeTab.dataset.tab);
}
