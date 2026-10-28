// The "Get in touch" form (SignupDialog.astro). Any element with data-signup="contact" (or, later, another
// door) opens it in that mode. It checks the one required field (the email address), sends the entry to Formspree, and shows the
// thank-you only once Formspree confirms it arrived; if sending fails it says so and offers the email
// address. Without JavaScript the form still posts to Formspree directly.
import { track } from './analytics.js';

const dlg = document.getElementById('signup');
if (dlg && typeof dlg.showModal === 'function') {
  const form = dlg.querySelector('[data-signup-form]');
  const err = dlg.querySelector('[data-su-error]');
  const sendErr = dlg.querySelector('[data-su-send-error]');
  const done = dlg.querySelector('[data-su-done]');
  const submit = form.querySelector('[type=submit]');
  const req = ['email'].map((n) => form.elements[n]);   // everything else is optional

  function openAs(mode) {
    dlg.dataset.mode = mode;
    form.elements.source.value = mode;
    form.hidden = false;
    done.hidden = true;
    dlg.classList.remove('is-done');
    err.hidden = true;
    sendErr.hidden = true;
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

  function sending(on) {
    submit.disabled = on;
    submit.textContent = on ? submit.dataset.sending : submit.dataset.label;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = req.filter((el) => !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim())));
    req.forEach((el) => el.setAttribute('aria-invalid', bad.includes(el) ? 'true' : 'false'));
    if (bad.length) { err.hidden = false; bad[0].focus(); return; }
    err.hidden = true;
    sendErr.hidden = true;
    const mode = dlg.dataset.mode;
    sending(true);
    let ok = false;
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      ok = res.ok;
    } catch (e2) { ok = false; }
    sending(false);
    if (!ok) {
      sendErr.hidden = false;
      track('signup_error', { source: mode });
      return;
    }
    track('signup_submit', { source: mode });
    form.reset();
    form.hidden = true;
    dlg.classList.add('is-done');
    done.hidden = false;
    done.focus();
  });
}
