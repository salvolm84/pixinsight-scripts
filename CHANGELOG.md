# Changelog

All notable changes to this repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-05-28

### Added

- **GAME.js** (v1.8.1-v8) — V8 port of Hartmut V. Bornemann's *GAME —
  Interactive Galaxy Mask Editor* (originally 2017, latest legacy
  release 1.8.1 from 09/03/2024). Same math, UI, defaults, settings
  keys and persisted view properties as the original. V8-required
  changes only:
  - `#engine v8`, `CoreApplication.ensureMinimumVersion(1, 9, 4)`;
    feature-id moved from `Utilities > GAME` to `salvolm > GAME` to
    match the rest of this repo.
  - All 19 `#include <pjsr/*.jsh>` removed; 39 underscore-style
    constants (`MouseButton_Left`, `StdIcon_Warning`, `PenStyle_Solid`,
    `KeyModifier_Control`, etc.) rewritten to the V8 dotted form
    (`MouseButton.Left`, …).
  - 23 `Class.prototype.Member` enum accesses on `PixelMath`,
    `Convolution`, `MultiscaleLinearTransform`, `CurvesTransformation`,
    `MorphologicalTransformation` rewritten to `Class.Member`.
  - All 5 prototype-style `this.__base__ = Dialog/Frame;
    this.__base__();` constructors (`showDialog`, `PreviewControl`,
    `showOptions`, `showSelectiveRejection`, `showSelectMainviews`)
    replaced with tiny ES6 `class extends` shells that `super()` then
    trampoline to a non-strict `*_init` function. This preserves the
    script's 88 `with (this.foo) { … }` blocks, which would be
    SyntaxErrors inside an implicit-strict class body.
  - `View.viewById` / `ImageWindow.windowById` now return `null` (not
    an invalid object) under V8. Three call sites (`createMask` finish
    loop, `getNewName`, `applyToViews`) audited and guarded.
  - The 5 trailing `XXX.prototype = new Dialog;` assignments deleted
    (silent no-op under V8).
- README, CHANGELOG, per-file-licensing table updated for the fourth
  script. Attribution preserves Hartmut V. Bornemann's 2017 copyright
  and the original script's acknowledgements to Ken Meyfroodt, Adam
  Block, Andres del Pozo, and the PixInsight-Austria user group.

### Notes

- GAME.js has been syntax-validated with Node but not yet smoke-tested
  inside PixInsight 1.9.4 under V8. A couple of constants
  (`MouseButton.*`, `KeyModifier.Control`) follow the standard
  `Class.Member` convention without explicit guidance in the V8
  porting guide; please report any runtime issues via the Issues tab.

## [1.0.2] — 2026-05-28

### Fixed

- **FWHMEccentricity.js** — clicking the **Support** button raised
  `TypeError: resampleImage.setPixels is not a function` and aborted
  contour-map generation. The legacy `Image.setPixels(flatArray)` method
  is not available in the V8 PJSR runtime; replaced with a
  `setSample(value, x, y)` loop over the (small) partition grid in
  `createResampleImageWindow`.

## [1.0.1] — 2026-05-26

### Changed

- Expanded the README's **Installation** section into a step-by-step
  walkthrough: download options (Releases ZIP vs `git clone`),
  recommended folder locations per OS, quick one-off `Execute Script
  File…` run with platform keyboard shortcuts, permanent registration
  via `Feature Scripts…`, the first-run unsigned-script warning, and
  a short troubleshooting list.

No script logic changed in this release; the published `.js` files are
identical to v1.0.0.

## [1.0.0] — 2026-05-26

### Added

- **FitsReviewer.js** (v1.1) — fast triage tool for FITS/XISF frames with
  embedded zoom/pan preview, keyboard-driven mark-for-deletion workflow,
  and copy-good-frames / delete-bad-frames actions.
- **FWHMEccentricity.js** (v1.5.2) — V8 port of Mike Schuster's
  FWHMEccentricity 1.5.2. Math, UI, defaults, settings keys and tooltips
  are identical to the original; only V8-required plumbing changed
  (ES6 `class extends Dialog`, dot-notation enums, `View.viewById` null
  handling, `SaveFileDialog.filePath`, removed `pjsr/*.jsh` includes).
- **VeraLux_HyperMetric_Stretch.js** (v1.5.2) — V8 port of Riccardo
  Paterniti's VeraLux HyperMetric Stretch (Python/Siril). Algorithm
  one-to-one with `process_veralux_v6`. PI-specific additions: embedded
  scroll/zoom/pan preview, 250 ms-debounced auto-refresh, red/green
  stale/fresh status LED, and full-resolution pre-analysis so the proxy
  preview's Smart-Max decision matches the full-res Process result (no
  more "preview brighter than final" mismatch caused by hot pixels being
  averaged away during proxy downsampling).
- All three scripts register under **Script ▸ salvolm ▸ …** when added
  via Feature Scripts.
