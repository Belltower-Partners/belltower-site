// Case studies on the "Our clients" tab: each button opens and closes its own case.
// Every case starts open, with its quote showing; the button closes it and opens it again.
// Without JavaScript every case stays open and the buttons stay hidden.
import { track } from './analytics.js';

for (const btn of document.querySelectorAll('[data-case-toggle]')) {
  const body = document.getElementById(btn.getAttribute('aria-controls'));
  const set = (open) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? btn.dataset.close : btn.dataset.open;
    body.hidden = !open;
  };
  set(true);
  btn.hidden = false;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    set(open);
    const heading = document.getElementById(btn.getAttribute('aria-describedby') || '');
    track('case_study_toggle', { case_study: heading ? heading.textContent.trim() : '', action: open ? 'open' : 'close' });
  });
}

// Opening a one-page case study (PDF).
for (const a of document.querySelectorAll('[data-case-pdf]')) {
  a.addEventListener('click', () => {
    const heading = document.getElementById(a.getAttribute('aria-describedby') || '');
    track('case_study_pdf', { case_study: a.dataset.caseName || (heading ? heading.textContent.trim() : '') });
  });
}
