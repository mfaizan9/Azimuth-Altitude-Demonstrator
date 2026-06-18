# Conversion notes — Azimuth/Altitude Demonstrator

## Behaviour model (one paragraph)

The sim shows a 3-D celestial sphere with a green **horizon plane**, a stick-figure
observer at the centre, the cardinal directions (N/E/S/W), zenith/nadir markers and
pole stubs, the **meridian** great circle, and faint azimuth/altitude guide circles.
A **star** sits on the sphere at a given horizon position (azimuth, altitude). A blue
**azimuth arc** is drawn along the horizon from due north to the star's azimuth, and a
red **altitude arc** rises vertically from the horizon up to the star; coloured degree
readouts label each. The user moves the star with the **az** and **alt** sliders (0–360°
and −90…90°, 0.1° steps) *or* by dragging the star directly; dragging anywhere else on
the sphere **rotates the view** (changing the viewer's azimuth `theta` and altitude
`phi`). The **Labels** panel toggles the Zenith, Horizon Plane, Nadir and Meridian text
labels (with *show all* / *hide all*). **Reset** returns the star to az 140°, alt 45°,
the view to `theta` 190°, `phi` 28°, and hides all labels.

## Goal A — functional parity

The projection/geometry engine is ported **verbatim** from the decompiled ActionScript,
keeping the exact constants, matrices and formulas:

| ActionScript source | HTML5 (`simulation.js`) |
|---|---|
| `CelestialSphere.as`, `2 CS Getter Setter.as` | `CelestialSphere` class — `setThetaAndPhi/setTheta/setLatitude/setSiderealTime`, `doA/doM/doB` rotation matrices |
| `3 CS Geometry.as` | `parsePointInput`, `WtoSz`, `CtoSz`, `CtoW`, `StoMH` (screen→horizon) |
| `8 CS Circles.as` | `Circle` class — `doW`, `setParameters`, `update()` with the exact great/small-circle front↔back arc split (`drawArc`, the `gAsc/gDesc` and 4-angle sort logic) |
| `9 CS Lines.as` | `Line` class — sphere-boundary + horizon-plane segment split (pole stubs `npLine`/`spLine`) |
| `5 CS Horizon Plane.as` | `drawHorizonPlane()` — the squash `_hP._yscale = r·sin(phi)` is applied (in the AS) *after* the inner clip's `_rotation = 180 + theta°`; because the disc art is radially symmetric, the correct projection of the horizontal alt=0 circle is an **axis-aligned** ellipse (semi-axes `r` and `r·sin(phi)`) that opens/closes with phi but never rotates with theta — the theta rotation only repositions the separately-drawn direction labels |
| `Alt Az Demo.as` | `App` — `reset`, `setStarLocation`, `onPositionSliderChanged`, `updateLabels`, `showAllLabels/hideAllLabels`, `onSphereOrientationChanged` |
| `AzAlt Draggable Star.as` | `onPointerDown/onPointerDrag` — front-facing star drags the star (via `StoMH`), otherwise the press rotates the sphere |
| `toFixed.as` / `Slider Logic Class v6.as` | `toFixedAS()` — identical round-half-up fixed-decimal formatting used for every on-screen number |

Constants copied verbatim include the angle factors (`0.017453292519943295`,
`57.29577951308232`, `0.2617993877991494`, `3.819718634205488`), the colours
(`azColor = 5654005`, `altColor = 10893123`, meridian `2188081`, guide circles
`10526880`, pole stubs `5263440`), the sphere `size = 320` (radius 160),
`minViewerAltitude = 1`, and the reset values `{az:140, alt:45}` / `setThetaAndPhi(190,28)`.

`latitude` (41°) and `siderealTime` (0) are set exactly as in the source but never change
in this demo, so the celestial-coordinate path is present but not exercised. Declination
trails and shaded bands are **unused** in this sim (the original `_decTrailList` /
`_shadedBandList` are empty here), so they are not ported.

### Verified behaviours (in-browser, served over HTTP)
- Reset → az 140.0°, alt 45.0°, theta 190°, phi 28°, all labels off.
- az/alt sliders **and** number fields move the star and stay in sync; number format
  matches `toFixed(1)` (e.g. `140.0`, `-30.0`).
- Star-drag screen→horizon mapping round-trips exactly (screen position of the az 140/
  alt 45 star recovers az 140.0, alt 45.0).
- Dragging empty sphere rotates the view (theta/phi change with the AS drag signs).
- A below-horizon star (alt < 0) is correctly occluded by the green plane.
- Label checkboxes + show all / hide all toggle the four 3-D labels.

## Goal B — KL-UNL + accessibility
- Uses `<kl-unl-masthead sim-id="altazimuth" json-url="foundation/contents.json">` for the
  title and Reset/Help/About; the sim listens for the bubbling `sim-reset` event. No
  self-built masthead/dialog/reset.
- Page skeleton uses the KL-UNL classes (`.app-shell`, `.app-layout`, `.panel`,
  `.control-fieldset`, `.control-row`, `.control-choice`, `.button`, `.button-row`,
  `.sr-only`). Sim-only styling lives in `styles/styles.css`; the foundation `.js`/`.css`
  are byte-for-byte unchanged.
- One `<h1>` (rendered by the masthead); panels are `<h2>`. See `ACCESSIBILITY.md`.

## Goal C — visual layout replication
The KL-UNL panel structure mirrors the original: **The Horizon Diagram** on the left,
**Star Position** and **Labels** stacked on the right, same controls and reading order.
The canvas reproduces the original look (translucent grey sphere, green horizon plane,
stick figure, cardinal/zenith/nadir labels, meridian, blue az arc, red alt arc, coloured
degree readouts). The exact on-sphere orientation in the supplied screenshot is just one
view; this build resets to the source's exact reset values (theta 190°, phi 28°), so the
star/arc placement reflects the true reset state rather than the screenshot's incidental
orientation.

### Assets reused vs. code-drawn
- **Reused exported bitmaps** (copied to `assets/`, drawn with `drawImage`, never redrawn):
  the **star** (`star.png`, and `star-hover.png` for the roll-over/frame-2 highlight) and
  the **stick figure** (`stickfigure.png`).
- **Code-drawn** (geometry the ActionScript builds at runtime — no exported file exists):
  the sphere shading, green horizon-plane ellipse, all circles/arcs, pole-stub lines, and
  the zenith/nadir ring markers. The horizon plane's radial-gradient green is recreated in
  canvas (a trivial gradient disk) so it stays crisp and scales as an ellipse, matching the
  Flash `_xscale/_yscale/_rotation` behaviour.

## Deviations
1. **MathJax not used (documented).** Rule 8 asks for MathJax-typeset math, but the
   provided `foundation/` bundles **no** MathJax and rule 5 forbids a CDN. This sim has no
   equations — only the `az:`/`alt:` labels and degree readouts (`140.0°`). As agreed, these
   are rendered as accessible HTML text. See `ACCESSIBILITY.md`.
2. **`contents.json` is a per-sim copy.** The shared KL-UNL `contents.json` shipped in
   `foundation/` is **invalid JSON** as provided — it contains raw control characters and
   unescaped double quotes inside HTML `content` strings across several sibling entries
   (first failure at line ~200; later an unescaped `<a href="...">` quote). `JSON.parse`
   is all-or-nothing, so those sibling defects break the masthead for *every* sim, including
   this one, even though the `altazimuth` entry itself is well-formed. Per the prompt's
   **default per-sim-copy model**, `foundation/contents.json` here was replaced with a clean
   per-sim file containing only the `altazimuth` entry, copied **verbatim** from the shared
   file (same `meta`, `help`, `about` text). The foundation `.js`/`.css` are untouched.
   **Action for the maintainers:** fix the shared `contents.json` upstream (escape `"` as
   `\"` and remove/escape raw newlines inside `content` strings) so it parses.
3. **az/alt degree readouts stay visible when the star is below the horizon.** In Flash the
   `azLabel`/`altLabel` are depth-sorted objects and the altitude readout can be occluded by
   the plane when the star is underground. Here they remain visible as overlay readouts (the
   star itself *is* correctly occluded). This is a deliberate, minor usability choice — the
   numeric coordinate stays readable.
