// The sign-up form (SignupDialog.astro). Any element with data-signup="waitlist" (or, later, another door)
// data-signup="waitlist" opens it in that mode (only the waitlist door is on the page for now). It checks
// the required fields and shows the thank-you. In this mock (data-mock) nothing is sent. Connected, it posts
// the same fields, plus `source`, to the firm's Google Form.
import { track } from './analytics.js';

const dlg = document.getElementById('signup');
if (dlg && typeof dlg.showModal === 'function') {
  const form = dlg.querySelector('[data-signup-form]');
  const err = dlg.querySelector('[data-su-error]');
  const done = dlg.querySelector('[data-su-done]');
  const req = ['name', 'email', 'org', 'title', 'stage'].map((n) => form.elements[n]);

  function openAs(mode) {
    dlg.dataset.mode = mode;
    form.elements.source.value = mode;
    form.hidden = false;
    done.hidden = true;
    dlg.classList.remove('is-done');
    err.hidden = true;
    req.forEach((el) => el.removeAttribute('aria-invalid'));
    dlg.showModal();
    form.elements.name.focus();
    track('signup_open', { source: mode });
  }

  document.querySelectorAll('[data-signup]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    openAs(el.dataset.signup);
  }));
  dlg.querySelector('[data-su-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // a click on the backdrop

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = req.filter((el) => !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim())));
    req.forEach((el) => el.setAttribute('aria-invalid', bad.includes(el) ? 'true' : 'false'));
    if (bad.length) { err.hidden = false; bad[0].focus(); return; }
    err.hidden = true;
    const mode = dlg.dataset.mode;
    // Connected version: post the fields (as the Google Form's entry IDs) with
    // fetch(GOOGLE_FORM_ACTION, { method: 'POST', mode: 'no-cors', body }) before showing the thank-you.
    track('signup_submit', { source: mode });
    form.hidden = true;
    dlg.classList.add('is-done');
    done.hidden = false;
    done.focus();
  });
}
