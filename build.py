#!/usr/bin/env python3
"""
InSync static site assembler.

Reads body-only page blocks from src/bodies/, wraps each with the shared shell
plus the nav and footer partials, and writes clean directory-URL pages into
dist/ ready for Vercel.

    python3 build.py

  src/bodies/<slug>.html   ->  dist/<slug>/index.html   ->  /<slug>/
  src/bodies/index.html    ->  dist/index.html          ->  /

Per-page <title> and meta come from src/meta.json.
public/ is copied to dist/ as-is (so /js/holo-*.js resolve).
"""

import json
import re
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).parent
BODIES = ROOT / "src" / "bodies"
PARTIALS = ROOT / "src" / "partials"
PUBLIC = ROOT / "public"
DIST = ROOT / "dist"
META = ROOT / "src" / "meta.json"

SITE_URL = "https://insynconline.net"
DEFAULT_TITLE = "InSync Consulting Services"

# The homepage gets the hero holo; every other page gets the edges holo.
# z 98 keeps the edges overlay above all page content (which tops out at 40)
# but below the fixed nav (99-101), so it can't wash over the logo or the CTAs.
HOLO_HERO = '<script src="/js/holo-hero.js" defer></script>'
HOLO_EDGES = '<script src="/js/holo-edges.js" data-z="98" defer></script>'
HOLO_TOKEN = "<!--HOLO-->"

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900'
    "&family=JetBrains+Mono:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">"
)

SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <!-- iOS Safari auto-detects bare phone numbers in text and wraps them in its
       own tel: anchors, styled with the UA default blue + underline. Those
       anchors are not in the markup, so no CSS in the page can pre-empt them.
       Turning detection off means only the tel: links we author are links. -->
  <meta name="format-detection" content="telephone=no">
  <meta name="format-detection" content="date=no, address=no, email=no">
  <title>{title}</title>
{meta_tags}
  {fonts}
  <style>html,body{{margin:0;padding:0;background:#000;}}</style>
</head>
<body>
{nav}
{body}
{footer}
{holo}
{closebot}
</body>
</html>
"""


def esc(s):
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def meta_tags_for(slug, m):
    url = SITE_URL + ("/" if slug == "index" else f"/{slug}/")
    tags = []
    if m.get("description"):
        tags.append(f'  <meta name="description" content="{esc(m["description"])}">')
    tags.append(f'  <link rel="canonical" href="{url}">')
    tags.append('  <meta property="og:type" content="website">')
    tags.append(f'  <meta property="og:url" content="{url}">')
    og_t = m.get("og_title") or m.get("title") or DEFAULT_TITLE
    tags.append(f'  <meta property="og:title" content="{esc(og_t)}">')
    og_d = m.get("og_description") or m.get("description")
    if og_d:
        tags.append(f'  <meta property="og:description" content="{esc(og_d)}">')
    return "\n".join(tags)


def normalize_partial(name, text):
    """
    The nav and footer were authored as standalone GHL global blocks, so each
    one carries a full preamble. Harmless when they were separate blocks;
    now that nav + page + footer share one document, two things need fixing.

    1. Font <link> tags — the shell already loads the same family, so leaving
       these in means three identical requests per page.
    2. `body{cursor:none}` and `button{cursor:none}` — these came from the old
       custom-cursor treatment, but neither partial ships the cursor element or
       its JS. The sector pages force `cursor:auto !important` inside their own
       wrapper, so page content is safe, but the nav and footer sit outside that
       wrapper and would lose the pointer entirely.

    The `:root` token block is deliberately left alone: the sector pages scope
    their tokens to their own wrapper and never define `:root`, so the nav and
    footer genuinely need to carry their own.
    """
    notes = []

    n_fonts = text.count("fonts.googleapis.com/css2")
    if n_fonts:
        text = re.sub(
            r'^[ \t]*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>[ \t]*\r?\n?',
            "",
            text,
            flags=re.M,
        )
        notes.append(f"removed {n_fonts} duplicate font link(s)")

    n_cursor = text.count("cursor:none")
    if n_cursor:
        text = text.replace("cursor:none", "cursor:auto")
        notes.append(f"neutralized {n_cursor} cursor:none rule(s)")

    if notes:
        print(f"  normalized {name}: " + "; ".join(notes))
    return text


def read_partial(name):
    p = PARTIALS / name
    if not p.exists():
        print(f"  ! partial missing: src/partials/{name} — page will build without it")
        return f"<!-- {name} partial not yet supplied -->"
    text = p.read_text(encoding="utf-8").strip()
    if not text:
        return f"<!-- {name} partial is empty -->"
    return normalize_partial(name, text)


# Pages that should NOT get the chat widget. Add a slug to opt one out.
CLOSEBOT_EXCLUDE = {"employee-hub", "employee-hub-login"}


def read_closebot():
    """
    Site-wide chat widget. Returns '' until the real embed snippet has been
    pasted into src/partials/closebot.html, so an unconfigured widget can
    never reach the live site — an empty container renders as a dead box and
    a half-pasted script is worse than no script.
    """
    p = PARTIALS / "closebot.html"
    if not p.exists():
        return ""
    text = p.read_text(encoding="utf-8").strip()
    if "CLOSEBOT_SNIPPET_PLACEHOLDER" in text:
        print("  ! CloseBot: snippet not yet pasted into src/partials/closebot.html "
              "— widget SKIPPED on every page")
        return ""
    return text


def main():
    if not BODIES.exists():
        sys.exit("src/bodies/ not found")

    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    nav = read_partial("nav.html")
    footer = read_partial("footer.html")
    closebot = read_closebot()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    if PUBLIC.exists():
        for item in PUBLIC.iterdir():
            dest = DIST / item.name
            if item.is_dir():
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)

    pages = sorted(BODIES.glob("*.html"))
    if not pages:
        sys.exit("no page bodies found in src/bodies/")

    for src in pages:
        slug = src.stem
        body = src.read_text(encoding="utf-8").strip()
        # Some bodies were authored with their own font preamble; the shell
        # already loads the same family, so drop the duplicates.
        if "fonts.googleapis.com/css2" in body:
            n = body.count("fonts.googleapis.com/css2")
            body = re.sub(
                r'^[ \t]*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>[ \t]*\r?\n?',
                "",
                body,
                flags=re.M,
            )
            print(f"  normalized {slug}: removed {n} duplicate font link(s)")
        m = meta.get(slug, {})
        title = m.get("title") or DEFAULT_TITLE

        # The homepage is the only page with the hero holo.
        holo = HOLO_HERO if slug == "index" else HOLO_EDGES

        # If a body already carries the token, honour its placement instead.
        if HOLO_TOKEN in body:
            body = body.replace(HOLO_TOKEN, holo)
            holo = ""

        cb = "" if slug in CLOSEBOT_EXCLUDE or slug == "404" else closebot

        html = SHELL.format(
            title=esc(title),
            meta_tags=meta_tags_for(slug, m),
            fonts=FONTS,
            nav=nav,
            body=body,
            footer=footer,
            holo=holo,
            closebot=cb,
        )

        if slug == "index":
            out = DIST / "index.html"
        elif slug == "404":
            out = DIST / "404.html"
        else:
            out = DIST / slug / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")

        if slug == "404":
            url = "404.html"
        elif slug == "index":
            url = "/"
        else:
            url = f"/{slug}/"
        kind = "hero" if slug == "index" else "edges"
        chat = "chat" if cb else "----"
        print(f"  built {url:26} {len(html):>8,} bytes   holo:{kind:<5} {chat}")

    # sitemap + robots, generated from whatever pages exist
    slugs = [p.stem for p in pages if p.stem != "404"]
    urls = [SITE_URL + ("/" if s == "index" else f"/{s}/") for s in slugs]
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in sorted(urls))
        + "</urlset>\n"
    )
    (DIST / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    (DIST / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8"
    )
    print(f"  built /sitemap.xml + /robots.txt   ({len(urls)} url(s))")

    print(f"\n{len(pages)} page(s) -> dist/")


if __name__ == "__main__":
    main()
