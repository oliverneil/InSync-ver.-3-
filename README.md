# InSync Consulting Services — static site

Body-only page blocks are kept in `src/`, wrapped with the shared shell plus the
nav and footer partials at build time, and written to `dist/` for Vercel.

## Layout

```
build.py              assembler — run it to produce dist/
src/
  bodies/             one file per page; the body block only, no nav/footer
    index.html            -> /
    about.html
    apply-now.html
    commercial-staffing.html
    contact-us.html
    continuing-education-links.html
    education-staffing.html
    employee-benefits.html
    employee-documents.html
    employee-hub.html
    employee-hub-login.html
    employee-portal.html
    employer-of-record.html
    healthcare-staffing.html
    joint-commission.html
    joint-commission-policy-statement.html
    meet-your-insync-team.html
    privacy-policy.html
    strike-work-updates.html
    terms-and-conditions.html
    404.html              -> /404.html
  partials/
    nav.html          global nav, injected at the top of every page
    footer.html       global footer, injected at the bottom of every page
  meta.json           per-page <title>, description, and og tags
public/               copied to dist/ untouched
  js/holo-hero.js     homepage only — hero face scan
  js/holo-edges.js    every other page — left/right edge scan
dist/                 build output — committed, see Deploy below
```

## Build

```bash
python3 build.py
```

Each `src/bodies/<slug>.html` becomes `dist/<slug>/index.html`, served at
`/<slug>/`. A file named `index.html` becomes the homepage at `/`.

## Adding a page

Drop the body block in `src/bodies/<slug>.html`, add a `<slug>` entry to
`src/meta.json`, and rebuild. Nothing else to wire — the shell, nav, footer, and
holo script are attached automatically.

## Holo overlay

The homepage gets `holo-hero.js`; every other page gets `holo-edges.js`. The
build picks based on the slug, so there is nothing to set per page.

The edges overlay (v2.0, engine v5) fades out as you scroll, so it reads on the
hero and is gone by the next section — it no longer paints over the footer. Set
`data-fade-viewports="0"` on the edges tag in `build.py` for the old always-on
behaviour.

Two escape hatches:

- Skip it on one page — add `data-holo="off"` to that page's wrapper element.
- Control placement — put `<!--HOLO-->` anywhere in a body block and the script
  tag goes there instead of at the end.

Tuning attributes are documented in the header comment of each `.js` file.

## Deploy

```bash
cd insync-site
git init
git add .
git commit -m "InSync static site"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Then import the repo in Vercel. `vercel.json` handles everything — no dashboard
settings to change.

`dist/` is committed on purpose. Vercel will rebuild it on each push, but if the
build step ever fails for any reason, the committed copy is served instead, so a
deploy can't break the site. The one thing to remember: after editing anything in
`src/`, run `python3 build.py` before you commit, so the committed `dist/`
matches your source.

## Known open items

- **Band videos are `.mov`** on Healthcare, Educational, and Continuing
  Education. Each points its band video at a `.mov` file. Chrome refuses that container, so the band will render
  as a dark panel with no motion in Chrome; Safari plays it. Both need an H.264
  MP4 re-encode. The Educational page already has a comment noting this, and its
  script keeps the layer usable if playback is refused.
- **1 internal link has no destination yet**: `/blog/` (2 references, both in
  the nav). It lands on the 404 page until that page is added.
- **Two links omit the trailing slash** — `/joint-commission-policy-statement`
  and `/continuing-education-links`, both on the Joint Commission page. They
  work, but Vercel issues a 308 redirect first. Adding the slash removes the
  extra hop.
- **Employee Hub is not real authentication.** The login page checks a password
  hash in client-side JavaScript and stores a 30-day flag in `localStorage`.
  Anyone can read the hash, and `/employee-hub/` can be opened directly without
  passing the gate. Treat it as a soft gate, not a security control, and don't
  put anything sensitive behind it until real auth is in place. The auto-forward
  is also scoped to `insynconline.net`, so on a `vercel.app` preview URL the
  redirect between login and hub will not fire.
- **No favicon.** Drop one in `public/` and add the `<link>` to the shell in
  `build.py`.
- **Media lives on the GHL CDN.** Every image and video is a remote URL on
  `assets.cdn.filesafe.space` or Firebase. Fine while GHL is still in the
  picture; if the site moves off it entirely, those assets need to come along.
- **Sandbox QA caveat.** Google Fonts and the media CDN are unreachable from the
  build sandbox, so fonts, the nav logo, and video could not be verified
  locally. Check them on the Vercel preview.

## What the build normalizes

The nav and footer were authored as standalone GHL global blocks, so each one
carries a full preamble. That was fine when they were separate blocks; now that
nav + page + footer share one document, `build.py` adjusts two things and logs
each change as it runs:

- **Duplicate font links** are stripped from the partials and from any body that
  carries its own. The shell loads the family once.
- **`cursor:none`** in the partials is switched to `cursor:auto`. It came from
  the old custom-cursor treatment, but neither partial ships the cursor element
  or its JS. The sector pages force `cursor:auto !important` inside their own
  wrapper, so page content was safe, but the nav and footer sit outside that
  wrapper and would have lost the pointer entirely.

The nav partial also carries a `:where(.ap-topbar, .ap-nav, .ap-mobile-menu) a`
reset. The chrome sits outside every page wrapper, so a page-scoped rule like
`.ap-page a{text-decoration:none}` can never reach it and the browser default
underline wins. `:where()` contributes zero specificity, so the rule computes as
plain `a` — do not rewrite it as `.ap-nav a`, which is (0,1,1) and would outrank
`.ap-nav__cta{color:var(--bg)}`, turning the CTA pill's black label white on a
white pill.

The nav partial also resets `tel:` and `mailto:` anchors, again via `:where()`
so page rules still win. Pages scope their anchor resets to their own wrapper,
so a contact link outside that wrapper falls back to the browser's blue
underline. Related: the shell sets `<meta name="format-detection"
content="telephone=no">`, because iOS Safari otherwise auto-wraps bare phone
numbers in its own `tel:` anchors styled UA-blue — those anchors are not in the
markup, so no CSS can reach them.

The `:root` token block in each partial is left alone on purpose. The sector
pages scope their tokens to their own wrapper and never define `:root`, so the
nav and footer genuinely need to carry their own.

Source files are never modified — normalization happens on the way into `dist/`.

## Known open items

- **Band videos are `.mov`** on Healthcare, Educational, and Continuing
  Education. Each points its band video at a `.mov` file. Chrome refuses that container, so the band will render
  as a dark panel with no motion in Chrome; Safari plays it. Both need an H.264
  MP4 re-encode. The Educational page already has a comment noting this, and its
  script keeps the layer usable if playback is refused.
- **Homepage not yet in the repo.** Add it as `src/bodies/index.html` and it
  will pick up `holo-hero.js` automatically.
- **Sandbox QA caveat.** Google Fonts and the media CDN are unreachable from the
  build sandbox, so fonts, the nav logo, and video could not be verified
  locally. Check them on the Vercel preview.
