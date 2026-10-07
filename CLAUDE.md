# Belltower Partners website: house rules

This is the public website for Belltower Partners, a technology and AI consulting firm for small and
medium sized law firms. It is a one-page Astro site, built to static files and served by Cloudflare.
The partners are not developers. They ask for changes in plain English, and every Claude session
working here must follow these rules.

## How to handle a request

- Partners describe changes in plain English. Edit the content files listed below, not the layout,
  unless the partner asks for a layout or design change.
- If a request is unclear, make the smallest reasonable change and say in the pull request what you
  assumed, so the partner can correct it on review.
- Every change goes through a pull request with a Cloudflare preview link. Never push to `main`,
  never merge your own pull request, and never force-push.
- Before opening a pull request, run `npm run build` and `npm run check`. Both must pass.
  When you touch layout or scripts, also run `npm run test:links`, and the accessibility check
  (`npm run preview` in one shell, `npm run test:a11y` in another).
- In the pull request description, say in a sentence or two what changed and where to look on the
  preview, written for a partner rather than a developer.

## Writing

- Write in Mickey Muldoon's voice: plain, specific, and written for readers with an attention span.
  Full sentences that say what the firm does and for whom.
- No snappy marketing taglines, no short two-sentence punchlines, nothing cutesy. No exclamation marks.
- Never invent statistics, client names, quotes or testimonials. If a partner asks for something that
  needs a fact you don't have, leave a bracketed placeholder such as `[Name]` and say so in the PR.
- Testimonials need the client's written permission, which the partners track. Only replace a
  placeholder testimonial with a real one when the partner supplies the exact wording and confirms
  permission in the request. Quote the client exactly; don't tidy their wording.

## Design

- Keep the type, colors and spacing as designed. The page is pure black-and-white letterhead
  (Newsreader for headings and tabs, IBM Plex Serif for text, IBM Plex Mono for labels), plus the
  sentence machine's enamel palette (cream enamel, dark knobs, orange #E0592A). Don't add colors,
  fonts, shadows, icons or images.
- The approved desktop design is 1440px wide with a single 760px text column. Below 800px the page
  switches to the phone design and the compact machine. Never cause sideways scrolling; keep at
  least a 16px gutter on each side.
- Use Pretext (`@chenglou/pretext`) for any text measurement or text geometry, as the contact box
  and the machine already do. Don't use canvas `measureText` or DOM measuring for text. After web
  fonts load, call `clearCache()` and measure again.
- Keep the page accessible: the tabs follow the WAI-ARIA tabs pattern, the machine's dials work from
  the keyboard, the printed sentence is announced through a live region, motion respects
  `prefers-reduced-motion`, and every control shows a visible focus ring.

## Where each piece of content lives

| What you see on the page | File |
| --- | --- |
| Firm name at the top, browser title, page description | `src/data/site.json` (`firmName`, `title`, `description`) |
| "Our work" tab and its text | `src/content/memos/our-work.md` |
| "The team" tab and its text | `src/content/memos/the-team.md` |
| Tab labels and their order | the `tab` and `order` lines at the top of each memo file |
| Contact section wording, form messages, "Sent" text | `src/data/site.json` under `contact` |
| Contact email address | `src/data/site.json` (`email`) and the `failed` message under `contact` |
| Where the contact form sends messages (Formspree) | `src/data/site.json` (`formspreeEndpoint`) |
| The 47 sentences the machine prints | `src/data/sentences.json` (in order; No. 1 is the first) |
| The machine's dial labels and which setting prints which sentence | `src/data/machine.json` |
| Testimonials heading | `src/data/site.json` (`testimonialsHeading`) |
| Each testimonial | `src/content/testimonials/*.md` (quote in the body; `name`, `title`, `firm`, `order`, `lead` at the top) |
| Footer line | `src/data/site.json` (`footerLine`; the email in it becomes a link) |
| "Coming soon" screen in front of the site: on/off, password and its words | `src/data/site.json` under `comingSoon` (`enabled: false` turns it off) |

Notes on the machine data: `machine.json`'s `map[role][topic][stage]` holds a sentence's position in
`sentences.json`, counting from 0. There are 45 settings and each prints a different sentence. If
sentences are added or removed, check every number in the map still points at the right one; the
"OF 047" counter on the machine follows the length of `sentences.json`.

The "Coming soon" gate: while `comingSoon.enabled` is true, visitors see only a Coming soon screen
(`src/components/ComingSoon.astro`, `src/scripts/gate.js`, `src/styles/gate.css`), and the page asks
search engines not to index it. Typing "ring" on a keyboard, or swiping up on a phone, opens a password
box; the password is `comingSoon.password`, and a browser that enters it is remembered. The password is
in this public repository on purpose: the gate keeps the unfinished site out of casual view, not out of
reach. When a partner asks to launch the site or take the gate down, set `enabled` to false.

Layout and behavior, for when a partner does ask for a design change:

- `src/pages/index.astro`: the page structure.
- `src/styles/global.css`: type, colors and spacing for the page, desktop and phone.
- `src/styles/machine.css`, `src/components/SentenceMachine*.astro`: the machine's look.
- `src/scripts/tabs.js`, `contact.js`, `machine.js`: tabs, the contact form, the machine.
