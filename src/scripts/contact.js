// Contact form. The box grows with what's typed (4 to 12 lines on desktop, 4 to 10 on a phone),
// with the line count measured by Pretext. Messages go to Formspree; the "Sent" view only
// appears once Formspree has accepted the message.
import { prepare, layout, clearCache } from '@chenglou/pretext';

const form = document.getElementById('contact-form');
const ta = document.getElementById('e-problem');
const em = document.getElementById('e-email');
const err = document.getElementById('e-err');
const send = form.querySelector('.send');
const sentView = document.getElementById('sent-view');
const words = JSON.parse(form.dataset.words);

function lineCount(text) {
  if (!text) return 0;
  const cs = getComputedStyle(ta);
  const font = cs.fontWeight + ' ' + cs.fontSize + " 'IBM Plex Serif'";
  const lh = parseFloat(cs.lineHeight);
  const w = ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let n = 0;
  try { n = layout(prepare(text, font, { whiteSpace: 'pre-wrap' }), Math.max(40, w), lh).lineCount; } catch (x) { n = 0; }
  if (!n) n = Math.ceil(text.length / 70) + (text.match(/\n/g) || []).length;
  if (/\n$/.test(text)) n += 1;
  return n;
}

function sizeBox() {
  const cs = getComputedStyle(ta);
  const lh = parseFloat(cs.lineHeight);
  const max = parseInt(cs.getPropertyValue('--ta-max'), 10) || 12;
  const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const n = lineCount(ta.value), shown = Math.min(Math.max(n, 4), max);
  ta.style.height = shown * lh + extra + 'px';
  ta.style.overflowY = n > max ? 'auto' : 'hidden';
}

// Messages are plain text, except that the email address becomes a link.
function say(msg) {
  err.replaceChildren();
  if (!msg) return;
  const at = msg.indexOf(words.email);
  if (at < 0) { err.textContent = msg; return; }
  const a = document.createElement('a');
  a.href = 'mailto:' + words.email; a.textContent = words.email;
  err.append(msg.slice(0, at), a, msg.slice(at + words.email.length));
}

ta.addEventListener('input', () => { say(''); sizeBox(); });
em.addEventListener('input', () => say(''));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (send.disabled) return;
  const text = ta.value, email = em.value.trim();
  if (!text.trim()) { say(words.needText); ta.focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(words.needEmail); em.focus(); return; }

  say('');
  send.disabled = true; send.textContent = words.sending;
  let ok = false;
  try {
    const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    ok = res.ok;
  } catch (x) { ok = false; }
  send.disabled = false; send.textContent = words.send;
  if (!ok) { say(words.failed); return; }

  const stamp = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const label = document.getElementById('sent-stamp');
  label.textContent = words.sent + ' ' + stamp;
  const box = document.getElementById('sent-text');
  box.textContent = text;
  box.style.height = ta.style.height;
  document.getElementById('sent-reply').textContent = words.reply.replace('{email}', email);
  form.hidden = true; sentView.hidden = false;
  label.focus();
});

document.getElementById('send-another').addEventListener('click', () => {
  form.reset(); say(''); sentView.hidden = true; form.hidden = false; sizeBox(); ta.focus();
});

// Re-measure when the column changes width and when a web font finishes loading.
if (window.ResizeObserver) {
  let lastW = 0;
  new ResizeObserver(() => { if (ta.clientWidth !== lastW) { lastW = ta.clientWidth; sizeBox(); } }).observe(ta);
}
if (document.fonts) {
  const refresh = () => { clearCache(); sizeBox(); };
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refresh);
  document.fonts.ready.then(refresh, () => {});
}
sizeBox();
