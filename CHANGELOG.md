# Changelog

All notable changes to this repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
