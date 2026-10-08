// Case studies on the "Our clients" tab: each button opens and closes its own case.
// Without JavaScript every case stays open and the buttons stay hidden; with it, cases start closed.
for (const btn of document.querySelectorAll('[data-case-toggle]')) {
  const body = document.getElementById(btn.getAttribute('aria-controls'));
  const set = (open) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? btn.dataset.close : btn.dataset.open;
    body.hidden = !open;
  };
  set(false);
  btn.hidden = false;
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
}
