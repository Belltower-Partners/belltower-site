// The "Coming soon" gate. Only runs when the page includes the gate (comingSoon.enabled).
//
// - Under the heading, one of the machine's sentences types itself out, pauses, and is replaced
//   by another, in a shuffled order with no repeats until all have been shown.
// - Typing "ring" anywhere, or swiping up on a touch screen, opens the password box.
// - The right password reveals the site and is remembered in this browser (localStorage).
//
// The password is in the public repository on purpose: this keeps the unfinished site out of
// casual view, not out of reach.
import SENTENCES from '../data/sentences.json';

const KEY = 'belltower-unlocked';
const gate = document.querySelector('[data-gate]');

if (gate && !document.documentElement.hasAttribute('data-unlocked')) setUp(gate);

function setUp(gate) {
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dialog = gate.querySelector('.gate-dialog');
  const form = gate.querySelector('.gate-form');
  const input = gate.querySelector('.gate-input');
  const msg = gate.querySelector('.gate-msg');
  const password = (gate.dataset.password || '').trim().toLowerCase();

  // ---- the typed line ----
  const typed = gate.querySelector('.gate-typed');
  const order = shuffle(SENTENCES.map((_, i) => i));
  let next = 0;
  const pick = () => {
    if (next >= order.length) { shuffle(order); next = 0; }
    return SENTENCES[order[next++]];
  };
  if (reduced) {
    typed.textContent = pick();
  } else {
    let timer = 0;
    const type = (text, i) => {
      typed.textContent = text.slice(0, i);
      if (i < text.length) {
        const ch = text[i - 1] || '';
        timer = setTimeout(() => type(text, i + 1), 34 + Math.random() * 46 + (ch === ',' ? 160 : 0));
      } else {
        timer = setTimeout(() => erase(text, text.length), 3200);
      }
    };
    const erase = (text, i) => {
      typed.textContent = text.slice(0, i);
      if (i > 0) timer = setTimeout(() => erase(text, i - 1), 14);
      else timer = setTimeout(() => type(pick(), 1), 700);
    };
    timer = setTimeout(() => type(pick(), 1), 900);
    gate.addEventListener('gate:unlocked', () => clearTimeout(timer));
  }

  // ---- opening the password box ----
  const open = () => {
    if (dialog.open) return;
    msg.textContent = '';
    input.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    input.focus();
  };

  let buffer = '';
  document.addEventListener('keydown', (e) => {
    if (dialog.open || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-4);
    // Swallow the final "g", or it would land in the password box that has just taken focus.
    if (buffer === 'ring') { buffer = ''; e.preventDefault(); open(); }
  });

  let start = null;
  document.addEventListener('touchstart', (e) => {
    if (dialog.open || e.touches.length !== 1) { start = null; return; }
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y, dt = Date.now() - start.at;
    start = null;
    if (dy < -90 && Math.abs(dx) < Math.abs(dy) / 2 && dt < 900) open();
  }, { passive: true });

  // Clicking the backdrop closes the box.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // ---- checking the password ----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim().toLowerCase() === password) {
      try { localStorage.setItem(KEY, '1'); } catch (err) { /* private window: unlock for this visit only */ }
      dialog.close();
      document.documentElement.setAttribute('data-unlocked', '');
      gate.dispatchEvent(new Event('gate:unlocked'));
      window.scrollTo(0, 0);
      const h1 = document.querySelector('.head h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      return;
    }
    msg.textContent = msg.dataset.wrong || '';
    input.value = '';
    if (!reduced) {
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    }
    input.focus();
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
