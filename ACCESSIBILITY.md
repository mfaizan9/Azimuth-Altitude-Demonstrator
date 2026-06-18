# Accessibility notes — Azimuth/Altitude Demonstrator

Target: WCAG 2.1 AA. This documents the affordances added during conversion.
**Human screen-reader QA (VoiceOver / NVDA / JAWS) is still required** — automated and
manual-inspection checks do not replace testing with real assistive technology.

## Semantics & structure
- One `<h1>` — the simulation title, rendered by `<kl-unl-masthead>`. The three panels use
  `<h2>` (`The Horizon Diagram`, `Star Position`, `Labels`); no skipped levels.
- `<main>` landmark wraps the app; each panel is a `<section>` labelled by its `<h2>`
  (`aria-labelledby`). The masthead supplies the header/nav.
- `<html lang="en">` is set.

## The canvas (informative graphic)
- The `<canvas>` has `role="img"` and a **dynamic `aria-label`** that always states the
  star's current azimuth and altitude and which labels are visible, e.g.
  *"Horizon diagram. Star at azimuth 140.0 degrees, altitude 45.0 degrees. Visible labels:
  none."*
- A visually-hidden `aria-live="polite"` region (`#diagramDesc`) announces meaningful
  changes (star position; "View reset") on commit, not on every drag tick.
- All on-sphere text (N/E/S/W, Zenith/Nadir/Horizon Plane/Meridian, the az/alt readouts)
  is **real HTML** positioned over the canvas, so it scales with browser zoom and is
  selectable. The overlay is `aria-hidden` to avoid double-announcing what the live region
  and `aria-label` already convey; nothing meaningful is canvas-only text.

## Text alternatives
- Reused bitmaps are drawn into the canvas (which carries the text equivalent above), so no
  orphan `<img>` needs alt text. The decorative sphere shading is part of the canvas image.

## Color & contrast (no color-only signaling)
- Palette uses the KL-UNL CSS custom properties. State is never conveyed by color alone:
  every arc/point is also labelled in text (the azimuth and altitude are printed as degree
  values; the cardinal/named labels are words).
- The original Flash arc/label colors were **darkened** for contrast over the canvas while
  keeping their hue identity:
  - azimuth readout `azColor 0x564C75` → `#4a4080` (blue-grey) for ≥4.5:1 on the light halo.
  - altitude readout `altColor 0xA63743` → `#9a2230` (red) for ≥4.5:1.
  - White cardinal letters get a dark text halo so they stay ≥3:1 over both the green plane
    and the grey sphere; named labels get a light halo over the same backgrounds.
  (The arcs drawn on the canvas keep the original hues; they are graphical objects ≥3:1 and
  are each backed by a text readout.)

## Keyboard (2.1.1 / 2.4.7)
- Everything is operable by keyboard in a logical tab order, with the foundation's visible
  `:focus-visible` ring.
- **Sliders are native `<input type="range">`**, so they are fully keyboard-operable for
  free: Left/Down decrement, Right/Up increment, PageUp/PageDown larger steps, Home/End to
  min/max — and Tab always moves away (no trap). Each has a real `<label>` (`az:` / `alt:`)
  and an `aria-valuetext` that announces the formatted value with units (e.g. "140.0
  degrees"). A paired `<input type="number">` gives a second, type-able path; both mutate
  the same state and stay in sync, matching the original's editable field + slider.
- **View rotation is fully keyboard-operable.** The canvas is focusable (`tabindex="0"`,
  with `aria-keyshortcuts` and an `aria-describedby` instruction announced on focus). When
  focused: Left/Right arrows rotate the view horizontally, Up/Down change the viewing
  altitude (1° with Shift, 5° otherwise), and PageUp/PageDown change the viewing altitude in
  15° steps. Directions match the pointer drag; each change is announced via the live region
  ("View rotated. Viewing azimuth … altitude …"). The pointer drag remains as an enhancement.
  Moving the star itself is done with the Star Position controls.
- Buttons (`show all`, `hide all`) and the four checkboxes are native controls; the masthead
  manages its own dialog focus/Escape (not fought).

## Pointer / touch (works without hover)
- Pointer Events drive one code path for mouse and touch; `touch-action: none` on the canvas
  stops the page scrolling/zooming while dragging. Pointer coordinates are mapped back
  through the canvas's current display scale, so hit-testing and the drag/snapping math run
  in the original stage coordinates at any size. No hover-only affordances (the star
  hover-enlarge is purely cosmetic).
- Touch targets: buttons/checkboxes/sliders meet the ≥44px (2.75rem) minimum from the
  KL-UNL controls and the sim CSS.

## Zoom & reflow (1.4.4 / 1.4.10)
- Body text is ≥1.125rem and everything is sized in rem/%/fr; the layout reflows without
  clipping at 200% zoom and collapses to a single stacked column at narrow/phone-portrait
  widths (the foundation's 56rem breakpoint is preserved and re-asserted for the sim grid).
- The canvas keeps its original internal coordinate system and is scaled by CSS (preserved
  square aspect ratio); the HTML overlay labels are positioned in **percent**, so they track
  the canvas and remain crisp/zoomable at any display size.

## Timing / motion (2.2.2 / 2.3.3)
- The sim has **no autonomous animation** — it only redraws in response to user input — so
  there is nothing that moves > 5 s, nothing that flashes, and no Pause control is needed.
  `prefers-reduced-motion` is honored (transitions disabled); there is no continuous motion
  to replace.

## Known deviation — MathJax
- Rule 8 calls for MathJax-typeset math, but the provided `foundation/` bundles no MathJax
  build and rule 5 forbids a CDN (self-contained, offline). This sim contains **no
  equations** — only the `az:` / `alt:` field labels and degree readouts such as `140.0°`.
  These are rendered as plain, zoomable, screen-reader-readable HTML text (degrees are also
  spelled out via `aria-valuetext` / the live region). Consequently, right-clicking a number
  does **not** open a MathJax menu. If a bundled MathJax build is added to the foundation
  later, these readouts could be re-rendered as inline LaTeX with no behavioural change.
