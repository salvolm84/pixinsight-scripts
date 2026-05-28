# pixinsight-scripts

A small collection of PJSR scripts for **PixInsight 1.9.4 Lockhart** and later
(the new V8 JavaScript runtime). Three are V8 ports of existing tools, one is
original.

> All scripts target the V8 runtime introduced in PI 1.9.4. They do **not**
> work on the legacy SpiderMonkey engine. Each script begins with
> `#engine v8` and calls `CoreApplication.ensureMinimumVersion(1, 9, 4)`.

## Installation

Requires **PixInsight 1.9.4 "Lockhart"** or later — the scripts use the V8
JavaScript runtime introduced in 1.9.4 and will not load on the legacy
SpiderMonkey engine.

### Step 1 — Get the scripts onto your machine

Pick whichever fits you:

**Option A — Download the latest release (no git needed)**

1. Open the [Releases page](https://github.com/salvolm84/pixinsight-scripts/releases).
2. Under the latest release, click **Source code (zip)**.
3. Unzip the archive. You'll get a folder named like
   `pixinsight-scripts-1.0.0/` containing the three `.js` files plus
   `README.md`, `LICENSE`, etc.

**Option B — Clone with git (recommended if you want one-line updates)**

```bash
git clone https://github.com/salvolm84/pixinsight-scripts.git
```

**Where to put the folder.** Anywhere PixInsight can read — but pick a
stable location so the file paths you'll register with PI in Step 3 keep
working. Recommended:

- macOS / Linux: `~/Documents/PixInsight/scripts/pixinsight-scripts/`
- Windows: `C:\Users\<you>\Documents\PixInsight\scripts\pixinsight-scripts\`

Avoid placing it inside the PixInsight application directory itself
(`/Applications/PixInsight/` on macOS, `C:\Program Files\PixInsight\` on
Windows) — those paths can be modified by the PI installer on upgrades.

### Step 2 — Quick one-off run (no menu entry needed)

The fastest way to try a script:

1. In PixInsight: **Script ▸ Execute Script File…**
   - macOS: **⌘ + ⌥ + E** (Cmd + Option + E)
   - Windows / Linux: **Ctrl + Alt + E**
2. In the file picker, browse to the folder from Step 1 and select the
   `.js` you want to run.
3. The script dialog opens immediately. Close it when you're done — no
   trace is left in any menu.

Use this when you just want to test a script once.

### Step 3 — Install as permanent menu entries

To make all three scripts appear together under their own submenu:

1. In PixInsight: **Script ▸ Feature Scripts…**
2. Click **Add**.
3. In the folder picker, navigate to the folder from Step 1 (the one
   containing the `.js` files — **not** an individual file) and confirm.
4. PixInsight scans the folder, finds the four `#feature-id`-tagged
   scripts, and lists them in the dialog. Make sure all four are
   checked.
5. Click **Done**.

The Script menu now contains:

- **Script ▸ salvolm ▸ FITS Reviewer**
- **Script ▸ salvolm ▸ FWHMEccentricity**
- **Script ▸ salvolm ▸ GAME**
- **Script ▸ salvolm ▸ VeraLux HyperMetric Stretch**

No restart needed. The registration persists across PixInsight sessions.

### Step 4 — First-run "unsigned script" warning

The first time you launch each script, PixInsight may show a security
warning along the lines of *"This script is not signed by a trusted
certificate."* That's expected for any third-party PJSR script that isn't
published through PI's signed update-repository system (these aren't).

- Tick **Don't ask again for this script**.
- Click **Yes** / **Continue** to proceed.

PI remembers your choice per script.

### Troubleshooting

- **Scripts don't appear in Feature Scripts after Add.** Make sure you
  selected the *folder* containing the `.js` files, not an individual
  file. PI scans directories for `#feature-id` directives.
- **Menu entry is in the old submenu.** If you registered an earlier
  version of these scripts, remove the old folder via **Feature
  Scripts… ▸ Remove**, then **Add** the current folder again. PI only
  reads `#feature-id` at registration time, so renames don't propagate
  until you re-register.
- **Read-only / permission errors on macOS.** Place the folder somewhere
  unrestricted such as `~/Documents/` rather than the Desktop or a
  system-managed folder.

## Updating

The repo is plain GitHub, so updates are a one-liner.

If you cloned with git:

```bash
cd /path/to/pixinsight-scripts
git pull
```

PI's Feature Scripts registration stores absolute paths and reads each
script from disk on every invocation, so a `git pull` is enough — no need
to re-register in PI, no restart required. The next time you pick the menu
entry you'll get the updated script.

If you don't use git, grab the latest **Source code (zip)** from the
[Releases page](https://github.com/salvolm84/pixinsight-scripts/releases)
and unzip it on top of your existing folder (overwriting). Same result.

Pinned versions are available at the same Releases page if you ever need to
roll back.

## Scripts

### FitsReviewer.js

Fast triage tool for FITS / XISF frames before integration.

* Pick a source folder of FITS/XISF frames.
* Navigate the list with the Up/Down arrow keys; the selected frame is
  auto-stretched and rendered inside the dialog.
* Zoom (Fit / 1:1 / +/-) and pan (drag) inside the embedded preview.
* Press **X** to mark / unmark the current frame for deletion (selection
  auto-advances).
* Copy the unmarked ("good") frames to a destination folder, or optionally
  delete the marked frames from the source.

PI menu entry: **Script ▸ salvolm ▸ FITS Reviewer**.

License: GPL-3.0-or-later.

---

### FWHMEccentricity.js

V8-runtime port of **Mike Schuster's** classic *FWHMEccentricity* script
(version 1.5.2). Estimates the median full width at half maximum (FWHM) and
eccentricity of the stars in a view, with the same UI, defaults, settings
keys, and algorithm as the original.

The only changes from the legacy script are the V8-required ones:

* `#engine v8` directive
* No `#include <pjsr/*.jsh>` (constants accessed via the new V8 classes:
  `DataType.*`, `StdIcon.*`, `UndoFlag.*`, `ColorSpace.*`, `TextAlignment.*`,
  `PixelSampleType.Float`, etc.)
* `parametersDialogPrototype` is now an ES6 `class extends Dialog`
* `View.viewById` null-check in `uniqueViewIdNoLeadingZero`
* `SaveFileDialog.filePath` (the old `.fileName` is deprecated)
* `.prototype.*` enum access on process classes (`DynamicPSF`, `Resample`,
  `Crop`, `StarAlignment`) replaced with `Class.Member`

PI menu entry: **Script ▸ salvolm ▸ FWHMEccentricity**.

License: PixInsight Class Library License 2.0
([PCL License 2.0](https://pixinsight.com/license/PCL-License-2.0.html)) —
inherited from the original script. Original Copyright © 2012–2022 Mike
Schuster and © 2003–2022 Pleiades Astrophoto S.L. All Rights Reserved.

---

### VeraLux_HyperMetric_Stretch.js

V8-runtime port of the **VeraLux HyperMetric Stretch** algorithm by Riccardo
Paterniti — a photometric inverse-hyperbolic stretch engine that preserves
chromatic vectors during extreme stretching ("True Color"). The Python
original ships with Siril; this port brings the **same math** to PixInsight
as a native PJSR script.

The algorithm pipeline is one-to-one with the Python source
(`process_veralux_v6`):

* Adaptive or statistical anchor (histogram-shape black-point detection)
* Hyperbolic stretch on photometric luminance
* Smart-Max linear-expansion (Scientific mode, opt-in)
* Vector color reconstruction with hybrid Color Grip + Shadow Convergence
* Ready-to-Use adaptive output scaling (Smart-Max physical-limit detection)
  + soft-clip

UI additions specific to the PI port:

* Embedded scroll-/zoom-/pan-preview, downsampled to ≤1024 px long edge for
  speed (Process always works on the full-resolution source)
* Auto-update preview, 250 ms debounce, toggleable
* Red/green LED indicator: stale while parameters have changed since the
  last refresh, green when the preview matches the current parameter set
* Full-resolution pre-analysis that injects the source-side anchor and the
  source-side Smart-Max decision into the proxy stretch, so the preview
  matches Process output even when hot pixels would skew downsampled
  statistics
* All 28 sensor luminance profiles from Python v1.5.2

PI menu entry: **Script ▸ salvolm ▸ VeraLux HyperMetric Stretch**.

License: GPL-3.0-or-later, inherited from the original Python implementation.

* Algorithm and original Python implementation:
  Copyright © 2025 Riccardo Paterniti — <info@veralux.space>
* PixInsight V8 port: GPL-3.0-or-later

Reference: <https://gitlab.com/free-astro/siril-scripts/-/tree/main/VeraLux>

An earlier SpiderMonkey-era PI port by *killerciao* (maintained by
*lucasssvaz* at <https://github.com/lucasssvaz/VeraLuxPorting>) was used as a
PJSR-integration reference during this V8 port; no code was copied verbatim,
and the math here is re-derived from the canonical Python source.

---

### GAME.js

V8-runtime port of **Hartmut V. Bornemann's** *GAME — Interactive Galaxy
Mask Editor* (version 1.8.1). GAME is a graphical editor that lets you
draw an unlimited number of elliptical or freeform multipoint shapes
directly on the active view and bake them into a soft, gradient-filled
galaxy mask. Each ellipse is defined by five anchor points (centre +
four peripheral points for rotation and scaling); freeform areas accept
arbitrarily many points and can be dragged by their centroid.

The math, UI, defaults, settings keys, and persisted view properties
are identical to Hartmut's original. Only V8-required plumbing changed:

* `#engine v8` directive; `CoreApplication.ensureMinimumVersion(1, 9, 4)`.
* All 19 `#include <pjsr/*.jsh>` directives removed — constants are now
  accessed via their V8 host classes (`StdButton.Yes`, `MouseButton.Left`,
  `TextAlign.Center`, `UndoFlag.NoSwapFile`, `PenStyle.Solid`, `StdIcon.*`,
  `KeyModifier.Control`, `Compression.ZLib`, `FontFamily.SansSerif`, etc.).
  39 underscore-style constants (`MouseButton_Left`, `StdIcon_Warning`, …)
  rewritten to dotted form.
* All 5 prototype-style `this.__base__ = Dialog/Frame; this.__base__();`
  constructors (`showDialog`, `PreviewControl`, `showOptions`,
  `showSelectiveRejection`, `showSelectMainviews`) now ES6 `class extends`
  shells that call `super()` then trampoline to a non-strict `*_init`
  function. This keeps the script's 88 `with (this.foo) { … }` blocks
  legal — class bodies are implicit strict mode where `with` is a syntax
  error.
* 23 `Class.prototype.Member` enum accesses on process classes
  (`PixelMath`, `Convolution`, `MultiscaleLinearTransform`,
  `CurvesTransformation`, `MorphologicalTransformation`) rewritten to
  `Class.Member`.
* `View.viewById` / `ImageWindow.windowById` null-checks: V8 returns
  `null` where SpiderMonkey returned an invalid object with
  `.isNull === true`. Three call sites (`createMask` finish loop,
  `getNewName`, `applyToViews`) now handle both cases.
* The 5 `XXX.prototype = new Dialog;` assignments at the bottom of the
  file deleted (they silently no-op under V8 and trigger errors if
  reached before the class declaration).

PI menu entry: **Script ▸ salvolm ▸ GAME** (the original registered
under `Utilities`; moved to match this repo's submenu convention).

> **Note:** GAME has not yet been smoke-tested in PixInsight under V8.
> The port is mechanical and syntax-validates cleanly with Node, but a
> handful of constants (`MouseButton.*`, `KeyModifier.Control`) follow
> the standard `Class.Member` convention without explicit documentation
> in the official V8 porting guide. Please report any runtime issues
> via the Issues tab — they are likely to be one-line fixes.

License: original GAME script is Copyright © 2017 Hartmut V. Bornemann
(<hvb356@hotmail.de>). The V8 porting changes are released alongside
this repository under GPL-3.0-or-later; the underlying algorithm and
the substantive code remain Hartmut's. See the file's header comment
for the original copyright notice and acknowledgements.

---

## Per-file licensing

The repository's top-level [LICENSE](LICENSE) is GPL-3.0. Three of the four
scripts inherit licenses from upstream:

| File                              | License                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `FitsReviewer.js`                 | GPL-3.0-or-later                                          |
| `FWHMEccentricity.js`             | PixInsight Class Library License 2.0                      |
| `VeraLux_HyperMetric_Stretch.js`  | GPL-3.0-or-later                                          |
| `GAME.js`                         | © 2017 Hartmut V. Bornemann; V8 porting changes GPL-3.0-or-later |

The PCL Class Library License 2.0 is a permissive BSD-style license and is
GPL-3.0-compatible, so the mixed-license collection redistributes cleanly.
GAME.js carries its original copyright; the V8 porting work here is
released under GPL-3.0-or-later in line with this repository's top-level
LICENSE. See each file's header for the full notice.

## Credits

* **VeraLux HyperMetric Stretch** — algorithm and Python implementation by
  Riccardo Paterniti (<https://veralux.space/>).
* **FWHMEccentricity** — original PJSR implementation by Mike Schuster,
  released through Pleiades Astrophoto.
* **GAME** — original PJSR implementation by Hartmut V. Bornemann
  (<hvb356@hotmail.de>), released 2017. Acknowledgements from the
  original script: Ken Meyfroodt (mask smoothing code), Adam Block
  (PixelMath expression and selective rejection concept from the
  PixInsight forum), Andres del Pozo (PreviewControl.js), and the
  PixInsight-Austria user group.
* **PixInsight V8 PJSR runtime** — Juan Conejero / Pleiades Astrophoto. The
  porting work here follows the official
  [V8 Script Porting Guide](https://pixinsight.com/developer/pjsr/) (2026).

## Bugs / contributions

Issues and PRs welcome at
<https://github.com/salvolm84/pixinsight-scripts/issues>.
