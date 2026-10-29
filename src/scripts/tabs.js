// Memo tabs: the WAI-ARIA tabs pattern. Click or Enter picks a tab;
// Left/Right arrows, Home and End move between tabs and select as they go.
import { track } from './analytics.js';

const tabs = [...document.querySelectorAll('[role="tab"]')];

function pick(i, focus) {
  if (tabs[i].getAttribute('aria-selected') !== 'true') {
    track('tab_view', { tab: tabs[i].querySelector('.lbl')?.textContent?.trim() || String(i + 1) });
  }
  tabs.forEach((t, k) => {
    const on = k === i;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    if (panel) panel.hidden = !on;
  });
  if (focus) tabs[i].focus();
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => pick(i, false));
  t.addEventListener('keydown', (e) => {
    const n = tabs.length;
    let k = null;
    if (e.key === 'ArrowRight') k = (i + 1) % n;
    else if (e.key === 'ArrowLeft') k = (i + n - 1) % n;
    else if (e.key === 'Home') k = 0;
    else if (e.key === 'End') k = n - 1;
    if (k !== null) { e.preventDefault(); pick(k, true); }
  });
});

// A link can open a tab directly: gobelltower.com/#pro-bono opens "Pro bono" (the part after # is the
// memo's file name, such as our-work, the-team, our-clients or pro-bono) and scrolls to the tabs.
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1)).replace(/^(tab|memo)-/, '');
  if (!id) return;
  const i = tabs.findIndex((t) => t.id === `tab-${id}`);
  if (i < 0) return;
  pick(i, false);
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => tabs[i].closest('[role="tablist"]')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }));
}
openFromHash();
window.addEventListener('hashchange', openFromHash);
