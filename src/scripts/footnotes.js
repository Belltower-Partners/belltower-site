// Footnotes on the three lines at the top. A number opens its note (tap or click; on a desktop, pointing
// at it opens it too); Escape, a click elsewhere or opening another note closes it. "Read the full bio"
// opens "The team" and scrolls to that partner's paragraph, with a brief highlight.
const chips = [...document.querySelectorAll('[data-fn]')];
const popOf = (chip) => document.getElementById(chip.getAttribute('aria-controls'));
let pinned = null;   // the note opened by a click stays open until closed
let leaveTimer = 0;

function open(chip) {
  chips.forEach((c) => c !== chip && close(c));
  chip.setAttribute('aria-expanded', 'true');
  popOf(chip).hidden = false;
}
function close(chip) {
  chip.setAttribute('aria-expanded', 'false');
  popOf(chip).hidden = true;
  if (pinned === chip) pinned = null;
}

const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

chips.forEach((chip) => {
  const pop = popOf(chip);
  chip.addEventListener('click', () => {
    if (pinned === chip) { close(chip); return; }
    open(chip);
    pinned = chip;
  });
  if (canHover) {
    const enter = () => { clearTimeout(leaveTimer); if (pinned !== chip) open(chip); };
    const leave = () => { leaveTimer = setTimeout(() => { if (pinned !== chip) close(chip); }, 220); };
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
