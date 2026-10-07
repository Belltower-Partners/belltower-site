// Memo tabs: the WAI-ARIA tabs pattern. Click or Enter picks a tab;
// Left/Right arrows, Home and End move between tabs and select as they go.
const tabs = [...document.querySelectorAll('[role="tab"]')];

function pick(i, focus) {
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
