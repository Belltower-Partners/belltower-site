// Footnotes on the three lines at the top: each number opens "The team" and scrolls to that partner's
// paragraph, with a brief highlight. Without JavaScript the link still lands on the team tab.
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
