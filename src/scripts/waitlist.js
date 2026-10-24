// The waitlist form. In this mock (data-mock) it checks the required fields and shows its thank-you
// without sending anything; connected, it posts the same fields to the firm's Google Form.
import { track } from './analytics.js';

for (const form of document.querySelectorAll('[data-waitlist]')) {
  const section = form.closest('.waitlist');
  const err = section.querySelector('[data-wl-error]');
  const thanks = section.querySelector('[data-wl-thanks]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const req = ['name', 'email', 'firm'].map((n) => form.elements[n]);
    const bad = req.filter((el) => !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim())));
    req.forEach((el) => el.setAttribute('aria-invalid', bad.includes(el) ? 'true' : 'false'));
    if (bad.length) { err.hidden = false; bad[0].focus(); return; }
    err.hidden = true;
    // Connected version: fetch(GOOGLE_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: new FormData(...) }).
    track('waitlist_submit', { mock: form.hasAttribute('data-mock') });
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus?.();
  });
}

// The hero's button scrolls to the form and puts the cursor in the first field.
document.querySelectorAll('[data-waitlist-link]').forEach((a) => a.addEventListener('click', (e) => {
  const target = document.getElementById('waitlist');
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => target.querySelector('input')?.focus({ preventScroll: true }), 600);
}));
