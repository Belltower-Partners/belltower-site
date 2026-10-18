// Google Analytics events. The tag itself loads in src/layouts/Base.astro, and only on gobelltower.com,
// so previews and local builds send nothing. Add ?ga_debug to a preview's address to see the events
// it would send in the browser console instead.
// Nothing here identifies a visitor: events carry only what was clicked or chosen.
const debug = /[?&]ga_debug\b/.test(location.search);

export function track(name, params = {}) {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    else if (debug) console.log('[analytics]', name, params);
  } catch (e) { /* analytics must never break the page */ }
}

// Clicks on the email address: "Get in touch" under the machine, or the footer.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href^="mailto:"]') : null;
  if (!a) return;
  track('email_click', { link_location: a.closest('.cta') ? 'get_in_touch' : a.closest('.foot') ? 'footer' : 'page' });
});
