// The sign-up form (SignupDialog.astro): one form, two doors. Any element with data-signup="guide" or
// data-signup="waitlist" opens it in that mode. In this mock (data-mock) it checks the required fields and
// shows the thank-you (and, for the guide, the download) without sending anything. Connected, it posts the
// same fields, plus `source`, to the firm's Google Form.
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
    const getsGuide = mode === 'guide' || form.elements.alsoGuide.checked;
    // Connected version: fetch(GOOGLE_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: <the fields as entry IDs> }).
    track('signup_submit', { source: mode, also: mode === 'guide' ? form.elements.alsoWaitlist.checked : form.elements.alsoGuide.checked });
    done.dataset.mode = mode;
    done.querySelector('[data-dl]').hidden = !getsGuide;
    form.hidden = true;
    dlg.classList.add('is-done');
    done.hidden = false;
    done.focus();
  });
}
