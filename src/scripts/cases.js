// Case studies on the "Our clients" tab: each button opens and closes its own case.
// Without JavaScript every case stays open and the buttons stay hidden; with it, cases start closed.
import { track } from './analytics.js';

for (const btn of document.querySelectorAll('[data-case-toggle]')) {
  const body = document.getElementById(btn.getAttribute('aria-controls'));
  const set = (open) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? btn.dataset.close : btn.dataset.open;
    body.hidden = !open;
  };
  set(false);
  btn.hidden = false;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    set(open);
    const heading = document.getElementById(btn.getAttribute('aria-describedby') || '');
    track('case_study_toggle', { case_study: heading ? heading.textContent.trim() : '', action: open ? 'open' : 'close' });
  });
}
