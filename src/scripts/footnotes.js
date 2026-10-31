// Footnotes on the three lines at the top. A number opens its note (tap or click; on a desktop, pointing
// at it opens it too); Escape, a click elsewhere or opening another note closes it. "Read the full bio"
// opens "The team" and scrolls to that partner's paragraph, with a brief highlight.
// Analytics: footnote_open (footnote, partner, method) and footnote_bio_click (partner); see analytics.js.
import { track } from './analytics.js';

const chips = [...document.querySelectorAll('[data-fn]')];
const popOf = (chip) => document.getElementById(chip.getAttribute('aria-controls'));
let pinned = null;   // the note opened by a click stays open until closed
let leaveTimer = 0;
let dwellTimer = 0;
const counted = new Set();   // notes already counted while open (so pointing, then clicking, counts once)

const noteOf = (chip) => (chip.getAttribute('aria-controls') || '').replace('fn-', '');
const partnerOf = (chip) => popOf(chip)?.querySelector('[data-bio]')?.dataset.bio || '';
// How a click arrived: a finger, a mouse, or the keyboard (Enter or Space).
const methodOf = (e) => (e.detail === 0 ? 'keyboard' : e.pointerType === 'touch' ? 'tap' : 'click');
function trackOpen(chip, method) {
  if (counted.has(chip)) return;
  counted.add(chip);
  track('footnote_open', { footnote: noteOf(chip), partner: partnerOf(chip), method });
}

function open(chip) {
  chips.forEach((c) => c !== chip && close(c));
  chip.setAttribute('aria-expanded', 'true');
  popOf(chip).hidden = false;
}
function close(chip) {
  chip.setAttribute('aria-expanded', 'false');
  popOf(chip).hidden = true;
  counted.delete(chip);
  if (pinned === chip) pinned = null;
}

const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

chips.forEach((chip) => {
  const pop = popOf(chip);
  chip.addEventListener('click', (e) => {
    if (pinned === chip) { close(chip); return; }
    clearTimeout(dwellTimer);
    open(chip);
    pinned = chip;
    trackOpen(chip, methodOf(e));   // counts once, unless pointing at it already counted it
  });
  if (canHover) {
    // Pointing counts as reading the note only if the pointer stays half a second, so passing over doesn't.
    const enter = () => {
      clearTimeout(leaveTimer);
      if (pinned === chip) return;
      open(chip);
      clearTimeout(dwellTimer);
      dwellTimer = setTimeout(() => { if (chip.getAttribute('aria-expanded') === 'true' && pinned !== chip) trackOpen(chip, 'hover'); }, 500);
    };
    const leave = () => { clearTimeout(dwellTimer); leaveTimer = setTimeout(() => { if (pinned !== chip) close(chip); }, 220); };
    chip.addEventListener('mouseenter', enter);
    chip.addEventListener('mouseleave', leave);
    pop.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
    pop.addEventListener('mouseleave', leave);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openChip = chips.find((c) => c.getAttribute('aria-expanded') === 'true');
  if (openChip) { close(openChip); openChip.focus(); }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.fn')) return;
  chips.forEach(close);
});

function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;               // restart the highlight
  el.classList.add('flash');
}

document.querySelectorAll('[data-bio]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const tab = document.getElementById('tab-the-team');
    if (!tab) return;
    e.preventDefault();
    track('footnote_bio_click', { partner: link.dataset.bio });
    chips.forEach(close);
    tab.click();
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    const name = link.dataset.bio;
    const para = panel && [...panel.querySelectorAll('p')].find((p) => p.querySelector('strong')?.textContent.trim() === name);
    const target = para || panel;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flash(target);
    });
  });
});

// Footnote 4 goes straight to the sentence machine.
document.querySelectorAll('[data-to-machine]').forEach((a) => a.addEventListener('click', (e) => {
  const target = document.getElementById('machine');
  if (!target) return;
  e.preventDefault();
  track('footnote_open', { footnote: '4', partner: '', method: methodOf(e) });
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#machine');
}));
