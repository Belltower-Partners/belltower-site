// Footnotes on the three lines at the top. A chip jumps to its note (and, on a desktop, previews it on
// hover or focus); "Read the full bio" opens "The team" and scrolls to that partner's paragraph.
const notes = document.querySelector('.footnotes');

function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;               // restart the highlight
  el.classList.add('flash');
}

document.querySelectorAll('.fn-chip').forEach((chip) => {
  chip.addEventListener('click', (e) => {
    const note = document.getElementById('fn-' + chip.dataset.fn);
    if (!note) return;
    e.preventDefault();
    note.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(note);
  });
});

document.querySelectorAll('[data-bio]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const tab = document.getElementById('tab-the-team');
    if (!tab) return;
    e.preventDefault();
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

// Hover and focus previews, built from the notes themselves (desktop: a pointer that can hover).
if (notes && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.fn-chip').forEach((chip) => {
    const src = document.getElementById('fn-' + chip.dataset.fn + '-text');
    if (!src) return;
    const tip = document.createElement('span');
    tip.className = 'fn-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = src.textContent;
    chip.append(tip);
  });
}
