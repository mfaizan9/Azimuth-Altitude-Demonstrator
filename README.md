# Azimuth/Altitude Demonstrator — HTML5

An accessible HTML5 conversion of the Flash `altAzDemo005` simulation, built on
the shared KL-UNL foundation.

## This must be served over HTTP — it will NOT run from a double-clicked file

Opening `index.html` directly (a `file://` path) shows a broken/empty title bar.

**Why:** the KL-UNL masthead component (`foundation/kl-unl-masthead.js`) loads its
title / Help / About text with `fetch('foundation/contents.json')`. Browsers block
`fetch()` of local files under the `file://` protocol (same-origin policy), so the
masthead can't load its data and the page appears broken. Served over HTTP the
fetch succeeds and the sim loads normally.

## How to run it locally

Run one of these **from inside this `html5/` folder**, then open the printed URL:

```sh
# Python 3
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve
#   (or)  npx http-server
```

Or, in VS Code, use the **Live Server** extension.

Because you serve from inside `html5/`, the sim is at the server root — the URL is
`http://localhost:8123/`, **not** `.../html5/index.html`.

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works. The
`file://` limitation only affects local double-clicking.

## What's here

```
index.html        KL-UNL scaffold: .app-shell + <kl-unl-masthead> + panels
foundation/       KL-UNL foundation (kl-unl-masthead.js, kl-unl.css, kl-unl.js
                  copied UNCHANGED; contents.json is a per-sim copy — see
                  CONVERSION_NOTES.md)
styles/styles.css sim-specific styles only
simulation.js     all sim logic (projection engine + controller + renderer)
assets/           reused exported bitmaps: star.png, star-hover.png, stickfigure.png
README.md         this file
CONVERSION_NOTES.md   behaviour model, AS→HTML5 mapping, deviations
ACCESSIBILITY.md      WCAG affordances and notes
```

No build step, no bundler, no framework, no CDN, no analytics. Everything is local.
