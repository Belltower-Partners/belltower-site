# Belltower Partners website

This is the code and the words for the Belltower Partners homepage: the letterhead, the two memo
tabs ("Our work" and "The team"), the contact form, the sentence machine and the
footer. It is a single page. Cloudflare hosts it.

You don't need to read code to change it. Changes are made by asking Claude in plain English, and
nothing goes live until a partner has looked at a preview and approved it.

## How to ask for a change

1. Go to [claude.ai/code](https://claude.ai/code) and open this repository (`belltower-site`).
2. Describe the change the way you'd describe it to a colleague. For example: "In The team tab,
   add a sentence to Uday's paragraph saying [what to add]," or "In Our work, split the long second
   paragraph into two."
3. Claude edits the content, checks that the site still builds, and opens a pull request. The pull
   request description says what changed.
4. Cloudflare builds a preview of the site with the change and posts a preview link on the pull
   request. Open it on your computer and on your phone and read the change where it appears.
5. If it's right, approve and merge the pull request on GitHub. The live site updates a minute or
   two later. If it's not right, say what to fix in the same Claude session, and the preview
   updates.

Some things Claude will not do on its own: invent client names, statistics or quotes, or publish
a testimonial without the client's written permission. When something needs a fact Claude doesn't
have, it leaves a bracketed placeholder such as `[Name]` and says so.

## Where the words live

| What you see | File |
| --- | --- |
| Firm name at the top, browser tab title | `src/data/site.json` |
| "Our work" tab | `src/content/memos/our-work.md` |
| "The team" tab | `src/content/memos/the-team.md` |
| Contact section wording and form messages | `src/data/site.json`, under `contact` |
| Contact email address | `src/data/site.json` |
| The sentences the machine prints | `src/data/sentences.json` |
| The machine's dials, and which setting prints which sentence | `src/data/machine.json` |
| Footer line | `src/data/site.json`, `footerLine` |

`CLAUDE.md` has the full map and the house rules every Claude session follows.

## The "Coming soon" screen

Until launch, visitors to the site see only a "Coming soon" screen. To see the real site, type
`ring` on your keyboard (or swipe up on your phone) and enter the password, which is
`comingSoon.password` in `src/data/site.json`. Your browser remembers it after that. To launch, ask
Claude to turn off the Coming soon screen.

## Still to fill in

- **Formspree form ID.** The contact form sends messages through [Formspree](https://formspree.io).
  Create a form there for go@gobelltower.com, copy its endpoint (it looks like
  `https://formspree.io/f/abcdwxyz`), and put it in `src/data/site.json` as `formspreeEndpoint`,
  replacing `https://formspree.io/f/REPLACE_ME`. Until then, sending the form shows a message asking
  people to email go@gobelltower.com. The form includes a hidden `_gotcha` field, which Formspree
  uses to discard spam from bots that fill in every field.
- **City** in the footer line (`[City]` in `src/data/site.json`).
- **Testimonials.** The three quotes are bracketed placeholders, as in the design. Replace them
  only with real quotes the client has approved in writing.

---

## For developers

Astro (static output, no client framework) with plain scripts for the tabs, the form and the
machine. Text measurement uses [Pretext](https://github.com/chenglou/pretext) throughout. Fonts
come from Google Fonts: Newsreader, IBM Plex Serif and IBM Plex Mono.

Requires Node 22.12 or later (`.nvmrc` says 22).

```sh
npm install
npm run dev        # local dev server at http://localhost:4321
npm run build      # static site into ./dist
npm run preview    # serve ./dist at http://localhost:4321
npm run check      # astro check (types and templates)
npm run test:links # check every internal link in ./dist (run after build)
npm run test:a11y  # axe accessibility check against a running preview
npm run deploy     # wrangler deploy (normally done by Cloudflare, not by hand)
```

`test:a11y` uses Playwright's Chromium (`npx playwright install chromium` once), or set
`CHROMIUM_PATH` to an existing Chromium binary.

### Layout

- `src/pages/index.astro`: the page. All words come from `src/content/` and `src/data/`.
- `src/components/SentenceMachine.astro` (760 x 700, desktop) and `SentenceMachinePhone.astro`
  (358 x 470, below 800px wide). Both are in the page; CSS shows one.
- `src/scripts/machine.js`: the machine (dials, paper feed, typing, drums, lamp).
- `src/scripts/contact.js`: the growing text box, validation, and the Formspree request.
- `src/scripts/tabs.js`: the memo tabs.
- `src/styles/global.css` and `src/styles/machine.css`.

### Deployment: Cloudflare Workers with static assets

`wrangler.jsonc` describes a Worker named `belltower-site` with no script of its own: Cloudflare
serves the files in `./dist`. To connect it:

1. Push this repository to GitHub.
2. In the Cloudflare dashboard, go to Workers & Pages, create a Worker, and choose to import this
   GitHub repository (Workers Builds).
3. Set the build command to `npm run build` and the deploy command to `npx wrangler deploy`.
   Workers Builds runs `npm ci`, then `npm run build`, then wrangler, which uploads `./dist`.
4. Turn on builds for non-production branches so every pull request gets a preview URL, posted on
   the pull request.
5. Point gobelltower.com at the Worker under its Domains & Routes settings.

Merging to `main` deploys to production.

### Continuous integration

`.github/workflows/checks.yml` runs on every pull request and every push to `main`: `npm ci`,
`npm run check`, `npm run build`, the internal link check, and the axe accessibility check against
`astro preview` at 1440px and 390px wide, on each tab. Protect `main` in GitHub so pull requests
need this check to pass and a partner's approval before merging.
