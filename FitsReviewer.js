/*
 * FitsReviewer.js
 *
 * Fast FITS triage tool for PixInsight 1.9.4+ (V8 JS engine).
 *
 * Workflow:
 *   1. Pick a source folder of FITS/XISF frames.
 *   2. Navigate the list with the Up/Down arrow keys.
 *   3. The selected frame is rendered (auto-stretched) inside the dialog.
 *      Use Fit / 1:1 / +  / -  buttons or the mouse wheel for zoom; drag
 *      with the middle/left button to pan (ScrollBox).
 *   4. Press X to mark/unmark the current frame for deletion
 *      (selection auto-advances to the next frame).
 *   5. Copy the unmarked ("good") frames to a destination folder,
 *      or optionally delete the marked frames from the source.
 *
 * Install: drop this file in any folder and use
 *   Script > Execute Script File...   (Ctrl/Cmd+Alt+E)
 * Or register via Script > Feature Scripts... pointing at this folder.
 */

#engine v8

#feature-id    FitsReviewer : Utilities > FITS Reviewer
#feature-info  Fast review and triage of FITS/XISF files - mark bad frames and copy good ones.

#define VERSION "1.1"
#define TITLE   "FITS Reviewer"

#define AUTOSTRETCH_SCLIP   -2.80
#define AUTOSTRETCH_TBGND    0.25
#define AUTOSTRETCH_RGBLINK  true

// PJSR constants we use - inline-defined to avoid the legacy pjsr .jsh
// headers (which redeclare V8 built-in classes like HorizontalSizer).
#define TextAlign_Left         0x01
#define TextAlign_VertCenter   0x80
#define FrameStyle_Sunken      3
#define StdButton_Ok           1
#define StdButton_Yes          3
#define StdButton_No           4
#define StdIcon_Question       1
#define StdIcon_Information    2
#define StdIcon_Warning        3
#define StdIcon_Error          4
#define Key_X                  0x00000058

// ---------------------------------------------------------------------------
// Canonical PJSR auto-stretch (ScreenTransferFunction) - same logic as
// PixInsight's own AutoSTF script.
// ---------------------------------------------------------------------------
function ApplyAutoSTF(view, shadowsClipping, targetBackground, rgbLinked) {
   const stf = new ScreenTransferFunction;
   const n = view.image.isColor ? 3 : 1;
   const median = view.computeOrFetchProperty("Median");
   const mad    = view.computeOrFetchProperty("MAD");
   mad.mul(1.4826);

   if (rgbLinked) {
      let invertedChannels = 0;
      for (let c = 0; c < n; ++c)
         if (median.at(c) > 0.5) ++invertedChannels;

      if (invertedChannels < n) {
         let c0 = 0, m = 0;
         for (let c = 0; c < n; ++c) {
            if (1 + mad.at(c) != 1)
               c0 += median.at(c) + shadowsClipping * mad.at(c);
            m  += median.at(c);
         }
         c0 = Math.range(c0/n, 0.0, 1.0);
         m  = Math.mtf(targetBackground, m/n - c0);
         stf.STF = [ [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      } else {
         let c1 = 0, m = 0;
         for (let c = 0; c < n; ++c) {
            m += median.at(c);
            if (1 + mad.at(c) != 1)
               c1 += median.at(c) - shadowsClipping * mad.at(c);
            else
               c1 += 1;
         }
         c1 = Math.range(c1/n, 0.0, 1.0);
         m  = Math.mtf(c1 - m/n, targetBackground);
         stf.STF = [ [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
   } else {
      const A = [ [0, 1, 0.5, 0, 1],
                  [0, 1, 0.5, 0, 1],
                  [0, 1, 0.5, 0, 1],
                  [0, 1, 0.5, 0, 1] ];
      for (let c = 0; c < n; ++c) {
         if (median.at(c) < 0.5) {
            const c0 = (1 + mad.at(c) != 1)
               ? Math.range(median.at(c) + shadowsClipping * mad.at(c), 0.0, 1.0)
               : 0.0;
            const m = Math.mtf(targetBackground, median.at(c) - c0);
            A[c] = [c0, 1, m, 0, 1];
         } else {
            const c1 = (1 + mad.at(c) != 1)
               ? Math.range(median.at(c) - shadowsClipping * mad.at(c), 0.0, 1.0)
               : 1.0;
            const m = Math.mtf(c1 - median.at(c), targetBackground);
            A[c] = [0, c1, m, 0, 1];
         }
      }
      stf.STF = A;
   }
   stf.executeOn(view);
}

// ---------------------------------------------------------------------------
// Read FITS / XISF header keywords without decoding the image - fast enough
// to run on every file in a directory at load time.
// Returns { filter, exp, hfr, fwhm, stars, ecc, dateObs, object } strings.
// ---------------------------------------------------------------------------
function ReadFitsMetadata(path) {
   const meta = { filter: "", exp: "", hfr: "", fwhm: "",
                  stars: "", ecc: "", dateObs: "", object: "" };
   const ext = File.extractExtension(path);
   let ffi = null;
   try {
      const ff = new FileFormat(ext, true /*read*/, false /*write*/);
      if (!ff || ff.isNull) return meta;
      ffi = new FileFormatInstance(ff);
      if (!ffi.open(path, "verbosity 0")) return meta;
      const kws = ffi.keywords || [];
      for (let i = 0; i < kws.length; ++i) {
         const k = kws[i];
         const name = (k.name || "").toUpperCase().trim();
         let val = (k.strippedValue !== undefined ? k.strippedValue : k.value) || "";
         val = ("" + val).trim();
         switch (name) {
            case "FILTER":       meta.filter  = val; break;
            case "EXPTIME":
            case "EXPOSURE":     meta.exp     = val; break;
            case "HFR":          meta.hfr     = val; break;
            case "FWHM":         meta.fwhm    = val; break;
            case "STARS":
            case "NSTARS":
            case "STARCNT":      meta.stars   = val; break;
            case "ECCENTRICITY":
            case "ECC":          meta.ecc     = val; break;
            case "DATE-OBS":
            case "DATE_OBS":     meta.dateObs = val; break;
            case "OBJECT":       meta.object  = val; break;
         }
      }
   } catch (e) {
      // header read failures are non-fatal - leave blanks
   } finally {
      try { if (ffi) ffi.close(); } catch (e) {}
   }
   return meta;
}

// Format helpers for the TreeBox columns
function fmtNum(s, decimals) {
   const n = parseFloat(s);
   if (!isFinite(n)) return "";
   return n.toFixed(decimals);
}
function fmtInt(s) {
   const n = parseInt(s);
   if (!isFinite(n)) return "";
   return n.toString();
}

// SubframeSelector P.measurements column indices (PI 1.8.8+).
// [ idx, enabled, locked, path, weight, fwhm, ecc, psfSig, psfPow, snr,
//   median, medianMD, noise, noiseRatio, stars, ... ]
#define SF_PATH      3
#define SF_WEIGHT    4
#define SF_FWHM      5
#define SF_ECC       6
#define SF_PSF_SIG   7
#define SF_SNR       9
#define SF_STARS    14

// ---------------------------------------------------------------------------
// Bake the view's STF into the image pixels using HistogramTransformation,
// so that Image.render() returns the visibly-stretched bitmap.
// Mapping is the canonical PJSR recipe used by WCSmetadata.jsh / AnnotateImage.
// ---------------------------------------------------------------------------
function ApplySTFAsHT(view) {
   const stf = view.stf;
   const HT  = new HistogramTransformation;
   if (view.image.isColor) {
      HT.H = [ [stf[0][1], stf[0][0], stf[0][2], 0, 1],
               [stf[1][1], stf[1][0], stf[1][2], 0, 1],
               [stf[2][1], stf[2][0], stf[2][2], 0, 1],
               [0,         0.5,       1,         0, 1],
               [0,         0.5,       1,         0, 1] ];
   } else {
      HT.H = [ [0,         0.5,       1,         0, 1],
               [0,         0.5,       1,         0, 1],
               [0,         0.5,       1,         0, 1],
               [stf[0][1], stf[0][0], stf[0][2], 0, 1],
               [0,         0.5,       1,         0, 1] ];
   }
   HT.executeOn(view, false /*swapFile*/);
}

// ---------------------------------------------------------------------------
// Load a file into a hidden ImageWindow, apply autostretch as HT, render the
// stretched image to a Bitmap, and close the temporary window.
// ---------------------------------------------------------------------------
function LoadStretchedBitmap(path) {
   let win = null;
   try {
      const windows = ImageWindow.open(path);
      if (!windows || windows.length == 0) return null;
      win = windows[0];
      // Do NOT call win.show() - keep it off-screen.
      ApplyAutoSTF(win.mainView,
                   AUTOSTRETCH_SCLIP,
                   AUTOSTRETCH_TBGND,
                   AUTOSTRETCH_RGBLINK);
      // Bake the auto-STF into the pixel data so render() shows the stretch.
      ApplySTFAsHT(win.mainView);
      return win.mainView.image.render();
   } catch (e) {
      console.warningln("LoadStretchedBitmap failed: " + path + " - " + e.message);
      return null;
   } finally {
      try {
         if (win && !win.isNull) win.forceClose();
      } catch (e) {}
   }
}

// ---------------------------------------------------------------------------
// ProgressBar: simple painted Frame, since PJSR has no native progress widget.
// ---------------------------------------------------------------------------
class ProgressBar extends Frame {
   constructor(parent) {
      super(parent);
      this.value = 0;
      this.max   = 1;
      this.setScaledFixedHeight(10);

      const that = this;
      this.onPaint = function(x0, y0, x1, y1) {
         const g = new Graphics(this);
         try {
            g.fillRect(x0, y0, x1, y1, new Brush(0xFF1B1E22));
            const ratio = Math.max(0, Math.min(1, that.value / Math.max(0.0001, that.max)));
            const fillW = Math.round(this.width * ratio);
            if (fillW > 0)
               g.fillRect(0, 0, fillW, this.height, new Brush(0xFF4FC3F7));
         } finally {
            g.end();
         }
      };
   }
   setProgress(value, max) {
      this.value = value;
      this.max   = max;
      this.update();
   }
}

// ---------------------------------------------------------------------------
// PreviewControl: scrollable, zoomable bitmap viewer embedded in the dialog.
// ---------------------------------------------------------------------------
class PreviewControl extends Frame {

   constructor(parent) {
      super(parent);

      this.bitmap     = null;   // current source bitmap (auto-stretched)
      this.zoomFactor = 0;      // 0 = "fit to viewport"; >0 = scale (1 = 1:1)
      this.dragging   = false;
      this.dragX0     = 0;
      this.dragY0     = 0;
      this.dragH0     = 0;
      this.dragV0     = 0;

      this.scrollbox = new ScrollBox(this);
      this.scrollbox.autoScroll  = false;
      this.scrollbox.tracking    = true;
      this.scrollbox.setScaledMinSize(400, 400);

      const that = this;

      this.scrollbox.viewport.onResize = function() {
         that.updateScrollRanges();
         this.update();
      };

      this.scrollbox.viewport.onPaint = function(x0, y0, x1, y1) {
         const g = new Graphics(this);
         try {
            g.fillRect(x0, y0, x1, y1, new Brush(0xFF101418));
            if (that.bitmap != null && !that.bitmap.isNull) {
               const s   = that.effectiveScale();
               const scaled = (s == 1) ? that.bitmap : that.bitmap.scaled(s);
               const vpW = that.scrollbox.viewport.width;
               const vpH = that.scrollbox.viewport.height;
               // Centre when smaller than viewport; otherwise honour scroll.
               const dx  = (scaled.width  < vpW)
                  ? Math.floor((vpW - scaled.width)  / 2)
                  : -that.scrollbox.horizontalScrollPosition;
               const dy  = (scaled.height < vpH)
                  ? Math.floor((vpH - scaled.height) / 2)
                  : -that.scrollbox.verticalScrollPosition;
               g.drawBitmap(dx, dy, scaled);
            }
         } finally {
            g.end();
         }
      };

      // Drag-to-pan (left button)
      this.scrollbox.viewport.onMousePress = function(x, y, button, buttons, modifiers) {
         that.dragging = true;
         that.dragX0   = x;
         that.dragY0   = y;
         that.dragH0   = that.scrollbox.horizontalScrollPosition;
         that.dragV0   = that.scrollbox.verticalScrollPosition;
         this.cursor   = new Cursor(11);   // closed-hand-ish (StdCursor enum)
      };
      this.scrollbox.viewport.onMouseMove = function(x, y, buttons, modifiers) {
         if (!that.dragging) return;
         that.scrollbox.horizontalScrollPosition = that.dragH0 + (that.dragX0 - x);
         that.scrollbox.verticalScrollPosition   = that.dragV0 + (that.dragY0 - y);
      };
      this.scrollbox.viewport.onMouseRelease = function(x, y, button, buttons, modifiers) {
         that.dragging = false;
         this.cursor   = new Cursor(0);
      };

      // Wheel zoom around cursor
      this.scrollbox.viewport.onMouseWheel = function(x, y, delta, buttons, modifiers) {
         const factor = (delta > 0) ? 1.25 : 0.8;
         that.zoomBy(factor, x, y);
      };

      this.sizer = new HorizontalSizer;
      this.sizer.add(this.scrollbox);
   }

   setBitmap(bmp) {
      this.bitmap = bmp;
      this.updateScrollRanges();
      this.scrollbox.viewport.update();
   }

   effectiveScale() {
      if (this.bitmap == null || this.bitmap.isNull) return 1;
      if (this.zoomFactor > 0) return this.zoomFactor;
      const vpW = this.scrollbox.viewport.width;
      const vpH = this.scrollbox.viewport.height;
      const sx  = vpW / this.bitmap.width;
      const sy  = vpH / this.bitmap.height;
      return Math.min(sx, sy);
   }

   updateScrollRanges() {
      if (this.bitmap == null || this.bitmap.isNull) {
         this.scrollbox.setHorizontalScrollRange(0, 0);
         this.scrollbox.setVerticalScrollRange(0, 0);
         return;
      }
      const s   = this.effectiveScale();
      const cw  = Math.round(this.bitmap.width  * s);
      const ch  = Math.round(this.bitmap.height * s);
      const vpW = this.scrollbox.viewport.width;
      const vpH = this.scrollbox.viewport.height;
      this.scrollbox.setHorizontalScrollRange(0, Math.max(0, cw - vpW));
      this.scrollbox.setVerticalScrollRange  (0, Math.max(0, ch - vpH));
      this.scrollbox.pageSize = new Point(vpW, vpH);
   }

   zoomFit() {
      this.zoomFactor = 0;
      this.updateScrollRanges();
      this.scrollbox.viewport.update();
   }

   zoom1to1() {
      this.zoomFactor = 1;
      this.updateScrollRanges();
      this.scrollbox.viewport.update();
   }

   zoomBy(factor, anchorX, anchorY) {
      if (this.bitmap == null || this.bitmap.isNull) return;
      const oldScale = this.effectiveScale();
      let newScale   = oldScale * factor;
      newScale = Math.max(0.05, Math.min(16, newScale));

      // Convert anchor (in viewport) to image coords at the old scale, so we
      // can keep that image point under the cursor after rescaling.
      const oldHx = this.scrollbox.horizontalScrollPosition;
      const oldHy = this.scrollbox.verticalScrollPosition;
      const imgX  = (oldHx + anchorX) / oldScale;
      const imgY  = (oldHy + anchorY) / oldScale;

      this.zoomFactor = newScale;
      this.updateScrollRanges();
      this.scrollbox.horizontalScrollPosition = Math.round(imgX * newScale - anchorX);
      this.scrollbox.verticalScrollPosition   = Math.round(imgY * newScale - anchorY);
      this.scrollbox.viewport.update();
   }
}

// ---------------------------------------------------------------------------
// Main dialog (V8 PJSR style: ES6 class extends Dialog)
// ---------------------------------------------------------------------------
class FitsReviewerDialog extends Dialog {

   constructor() {
      super();

      const dialog = this;

      this.files          = [];
      this.metadata       = [];          // parallel to files
      this.marked         = new Set();   // set of PATHS (survives sorting)
      this.sourceDir      = "";
      this.sortColumn     = -1;
      this.sortAscending  = true;

      this.windowTitle = TITLE + " v" + VERSION;
      this.scaledMinWidth  = 1280;
      this.scaledMinHeight = 720;
      this.userResizable   = true;

      // -- Top row: select folder + path --------------------------------------
      this.selectDirButton = new PushButton(this);
      this.selectDirButton.text = "Select Source Folder...";
      this.selectDirButton.icon = this.scaledResource(":/icons/folder.png");
      this.selectDirButton.onClick = function() {
         const gdd = new GetDirectoryDialog;
         gdd.caption = "Select FITS Source Folder";
         if (gdd.execute())
            dialog.loadDirectory(gdd.directoryPath);
      };

      this.sourceLabel = new Label(this);
      this.sourceLabel.text = "Source: (none)";
      this.sourceLabel.textAlignment = TextAlign_VertCenter | TextAlign_Left;
      this.sourceLabel.styleSheet = "QLabel { padding: 4px; }";

      this.topSizer = new HorizontalSizer;
      this.topSizer.spacing = 6;
      this.topSizer.add(this.selectDirButton);
      this.topSizer.add(this.sourceLabel, 100);

      // -- Left: file list ----------------------------------------------------
      this.fileTree = new TreeBox(this);
      this.fileTree.alternateRowColor = true;
      this.fileTree.multipleSelection = false;
      this.fileTree.headerVisible     = true;
      this.fileTree.rootDecoration    = false;
      this.fileTree.numberOfColumns   = 8;
      this.fileTree.setHeaderText(0, "Status");
      this.fileTree.setHeaderText(1, "File");
      this.fileTree.setHeaderText(2, "Filter");
      this.fileTree.setHeaderText(3, "Exp");
      this.fileTree.setHeaderText(4, "FWHM");
      this.fileTree.setHeaderText(5, "Ecc");
      this.fileTree.setHeaderText(6, "Stars");
      this.fileTree.setHeaderText(7, "SNR");
      const px = (n) => this.logicalPixelsToPhysical(n);
      this.fileTree.setColumnWidth(0, px(55));
      this.fileTree.setColumnWidth(1, px(220));
      this.fileTree.setColumnWidth(2, px(55));
      this.fileTree.setColumnWidth(3, px(55));
      this.fileTree.setColumnWidth(4, px(55));
      this.fileTree.setColumnWidth(5, px(55));
      this.fileTree.setColumnWidth(6, px(55));
      this.fileTree.setColumnWidth(7, px(55));
      this.fileTree.setScaledMinWidth(560);

      this.fileTree.onCurrentNodeUpdated = function(currentNode, oldNode) {
         if (currentNode != null)
            dialog.previewFile(currentNode.fileIndex);
      };

      this.fileTree.onKeyPress = function(key, modifiers) {
         if (key == Key_X) {
            const node = this.currentNode;
            if (node != null) {
               dialog.toggleMark(node.fileIndex);
               const row = this.childIndex(node);
               if (row + 1 < this.numberOfChildren)
                  this.currentNode = this.child(row + 1);
            }
            return true;
         }
         return false;
      };

      // PJSR's TreeBox does NOT fire header-click events, so we use an
      // explicit Sort-by combobox + direction toggle below the tree header.
      // (See sortCombo / sortDirButton wiring further down.)

      // -- Right: embedded preview + zoom toolbar ----------------------------
      this.preview = new PreviewControl(this);

      this.zoomFitButton = new PushButton(this);
      this.zoomFitButton.text = "Fit";
      this.zoomFitButton.toolTip = "Fit the image to the preview area.";
      this.zoomFitButton.onClick = function() { dialog.preview.zoomFit(); };

      this.zoom1Button = new PushButton(this);
      this.zoom1Button.text = "1:1";
      this.zoom1Button.toolTip = "Show the image at 100% (native) scale.";
      this.zoom1Button.onClick = function() { dialog.preview.zoom1to1(); };

      this.zoomInButton = new PushButton(this);
      this.zoomInButton.text = "+";
      this.zoomInButton.toolTip = "Zoom in.";
      this.zoomInButton.onClick = function() {
         const vp = dialog.preview.scrollbox.viewport;
         dialog.preview.zoomBy(1.25, vp.width / 2, vp.height / 2);
      };

      this.zoomOutButton = new PushButton(this);
      this.zoomOutButton.text = "-";
      this.zoomOutButton.toolTip = "Zoom out.";
      this.zoomOutButton.onClick = function() {
         const vp = dialog.preview.scrollbox.viewport;
         dialog.preview.zoomBy(0.8, vp.width / 2, vp.height / 2);
      };

      this.previewName = new Label(this);
      this.previewName.text = "(no file)";
      this.previewName.textAlignment = TextAlign_VertCenter | TextAlign_Left;
      this.previewName.styleSheet = "QLabel { padding: 0 8px; }";

      this.previewToolbar = new HorizontalSizer;
      this.previewToolbar.spacing = 4;
      this.previewToolbar.add(this.zoomFitButton);
      this.previewToolbar.add(this.zoom1Button);
      this.previewToolbar.add(this.zoomInButton);
      this.previewToolbar.add(this.zoomOutButton);
      this.previewToolbar.add(this.previewName, 100);

      this.previewSizer = new VerticalSizer;
      this.previewSizer.spacing = 4;
      this.previewSizer.add(this.previewToolbar);
      this.previewSizer.add(this.preview, 100);

      // -- Centre split: list + preview --------------------------------------
      // Sort controls (workaround for missing onHeaderClick in PJSR TreeBox).
      this.sortColumns = [
         { col: 1, label: "File"   },
         { col: 2, label: "Filter" },
         { col: 3, label: "Exp"    },
         { col: 4, label: "FWHM"   },
         { col: 5, label: "Ecc"    },
         { col: 6, label: "Stars"  },
         { col: 7, label: "SNR"    },
         { col: 0, label: "Status" }
      ];
      this.sortLabel = new Label(this);
      this.sortLabel.text = "Sort by:";
      this.sortLabel.textAlignment = TextAlign_VertCenter | TextAlign_Left;

      this.sortCombo = new ComboBox(this);
      for (let i = 0; i < this.sortColumns.length; ++i)
         this.sortCombo.addItem(this.sortColumns[i].label);
      this.sortCombo.onItemSelected = function(idx) {
         dialog.sortColumn    = dialog.sortColumns[idx].col;
         dialog.sortAscending = true;
         dialog.sortDirButton.text = "Asc";
         dialog.sortByColumn();
      };

      this.sortDirButton = new PushButton(this);
      this.sortDirButton.text = "Asc";
      this.sortDirButton.setScaledFixedWidth(56);
      this.sortDirButton.toolTip = "Toggle ascending/descending.";
      this.sortDirButton.onClick = function() {
         dialog.sortAscending = !dialog.sortAscending;
         this.text = dialog.sortAscending ? "Asc" : "Desc";
         dialog.sortByColumn();
      };

      this.sortSizer = new HorizontalSizer;
      this.sortSizer.spacing = 4;
      this.sortSizer.add(this.sortLabel);
      this.sortSizer.add(this.sortCombo, 100);
      this.sortSizer.add(this.sortDirButton);

      this.listSizer = new VerticalSizer;
      this.listSizer.spacing = 4;
      this.listSizer.add(this.sortSizer);
      this.listSizer.add(this.fileTree, 100);

      this.centerSizer = new HorizontalSizer;
      this.centerSizer.spacing = 6;
      this.centerSizer.add(this.listSizer, 45);
      this.centerSizer.add(this.previewSizer, 55);

      // -- Action buttons row ------------------------------------------------
      this.markButton = new PushButton(this);
      this.markButton.text = "Toggle Mark (X)";
      this.markButton.onClick = function() {
         const node = dialog.fileTree.currentNode;
         if (node != null) {
            dialog.toggleMark(node.fileIndex);
            const row = dialog.fileTree.childIndex(node);
            if (row + 1 < dialog.fileTree.numberOfChildren)
               dialog.fileTree.currentNode = dialog.fileTree.child(row + 1);
         }
      };

      this.clearMarksButton = new PushButton(this);
      this.clearMarksButton.text = "Clear All Marks";
      this.clearMarksButton.onClick = function() {
         dialog.marked.clear();
         dialog.refreshTreeRows();
         dialog.updateStatus();
      };

      this.measureButton = new PushButton(this);
      this.measureButton.text = "Re-measure (SubframeSelector)";
      this.measureButton.toolTip =
         "Run SubframeSelector on the loaded files to fill FWHM, "
         + "Eccentricity, Stars and SNR columns.";
      this.measureButton.onClick = function() { dialog.runSubframeSelector(); };

      this.copyGoodButton = new PushButton(this);
      this.copyGoodButton.text = "Copy Good Frames To...";
      this.copyGoodButton.onClick = function() { dialog.copyGoodFrames(); };

      this.deleteBadButton = new PushButton(this);
      this.deleteBadButton.text = "Delete Marked From Source";
      this.deleteBadButton.onClick = function() { dialog.deleteMarkedFrames(); };

      this.closeButton = new PushButton(this);
      this.closeButton.text = "Close";
      this.closeButton.onClick = function() { dialog.ok(); };

      this.actionsSizer = new HorizontalSizer;
      this.actionsSizer.spacing = 6;
      this.actionsSizer.add(this.markButton);
      this.actionsSizer.add(this.clearMarksButton);
      this.actionsSizer.add(this.measureButton);
      this.actionsSizer.addStretch();
      this.actionsSizer.add(this.deleteBadButton);
      this.actionsSizer.add(this.copyGoodButton);
      this.actionsSizer.add(this.closeButton);

      // -- Help & status -----------------------------------------------------
      this.helpLabel = new Label(this);
      this.helpLabel.useRichText = true;
      this.helpLabel.wordWrapping = true;
      this.helpLabel.text =
         "<b>Shortcuts:</b> &uarr; &darr; navigate &nbsp;|&nbsp; "
         + "<b>X</b> mark/unmark (auto-advance) &nbsp;|&nbsp; "
         + "Mouse wheel = zoom &nbsp;|&nbsp; drag = pan";

      this.statusLabel = new Label(this);
      this.statusLabel.text = "No files loaded.";
      this.statusLabel.frameStyle = FrameStyle_Sunken;
      this.statusLabel.styleSheet = "QLabel { padding: 4px; }";

      this.progressBar = new ProgressBar(this);
      this.progressBar.visible = false;

      // -- Main sizer --------------------------------------------------------
      this.sizer = new VerticalSizer;
      this.sizer.margin  = 8;
      this.sizer.spacing = 6;
      this.sizer.add(this.topSizer);
      this.sizer.add(this.centerSizer, 100);
      this.sizer.add(this.actionsSizer);
      this.sizer.add(this.helpLabel);
      this.sizer.add(this.progressBar);
      this.sizer.add(this.statusLabel);
   }

   // ------------------------------------------------------------------------
   // File-list / triage methods
   // ------------------------------------------------------------------------
   loadDirectory(dir) {
      this.sourceDir = dir;
      this.sourceLabel.text = "Source: " + dir;
      this.files    = [];
      this.metadata = [];
      this.marked   = new Set();

      const exts = [".fit", ".fits", ".fts", ".xisf"];
      const ff   = new FileFind;
      const found = [];
      if (ff.begin(dir + "/" + "*")) {
         do {
            if (ff.isFile) {
               const lower = ff.name.toLowerCase();
               for (let i = 0; i < exts.length; ++i) {
                  if (lower.endsWith(exts[i])) {
                     found.push(dir + "/" + ff.name);
                     break;
                  }
               }
            }
         } while (ff.next());
      }
      found.sort();
      this.files = found;

      if (this.files.length == 0) {
         this.refreshTree();
         this.updateStatus();
         (new MessageBox("No FITS/XISF files found in:\n" + dir,
                         TITLE, StdIcon_Information, StdButton_Ok)).execute();
         return;
      }

      // Build empty rows first so the user sees the list immediately, then
      // read headers and back-fill the metadata columns.
      this.metadata = new Array(this.files.length);
      this.refreshTree();
      this.updateStatus();

      for (let i = 0; i < this.files.length; ++i) {
         this.statusLabel.text =
            format("Reading headers: %d / %d", i + 1, this.files.length);
         this.statusLabel.update();
         processEvents();
         this.metadata[i] = ReadFitsMetadata(this.files[i]);
         const node = this.fileTree.child(i);
         if (node != null) this.applyNodeStyle(node, i);
      }
      this.updateStatus();
      this.fileTree.currentNode = this.fileTree.child(0);
      // SubframeSelector is NOT run automatically - click "Re-measure" when wanted.
   }

   sortByColumn() {
      if (this.sortColumn < 0 || this.files.length == 0) return;
      const col  = this.sortColumn;
      const asc  = this.sortAscending;
      const that = this;

      const keyFn = function(i) {
         const md = that.metadata[i] || {};
         switch (col) {
            case 0: return that.marked.has(that.files[i]) ? 1 : 0;
            case 1: return (File.extractName(that.files[i]) || "").toLowerCase();
            case 2: return (md.filter || "").toLowerCase();
            case 3: return parseFloat(md.exp);
            case 4: return parseFloat(md.fwhm);
            case 5: return parseFloat(md.ecc);
            case 6: return parseInt(md.stars);
            case 7: return parseFloat(md.snr);
            default: return i;
         }
      };

      // Preserve the current selection by path.
      const selNode = this.fileTree.currentNode;
      const selPath = (selNode != null) ? this.files[selNode.fileIndex] : null;

      const order = this.files.map(function(_, i) { return i; });
      order.sort(function(a, b) {
         const va = keyFn(a), vb = keyFn(b);
         const aBad = (typeof va == "number" && !isFinite(va));
         const bBad = (typeof vb == "number" && !isFinite(vb));
         // Push unknown numeric values (NaN) to the bottom regardless of dir.
         if (aBad && !bBad) return 1;
         if (bBad && !aBad) return -1;
         if (va < vb) return asc ? -1 : 1;
         if (va > vb) return asc ?  1 : -1;
         return 0;
      });

      this.files    = order.map(function(i) { return that.files[i];    });
      this.metadata = order.map(function(i) { return that.metadata[i]; });

      this.refreshTree();

      if (selPath != null) {
         const newIdx = this.files.indexOf(selPath);
         if (newIdx >= 0)
            this.fileTree.currentNode = this.fileTree.child(newIdx);
      }
   }

   runSubframeSelector() {
      const total = this.files.length;
      if (total == 0) return;

      this.progressBar.visible = true;
      this.progressBar.setProgress(0, total);
      this.measureButton.enabled = false;

      const chunkSize = 8;   // chunk size = compromise between SS overhead and UI feedback
      let totalMatched = 0;
      let lastError = null;

      try {
         for (let start = 0; start < total; start += chunkSize) {
            const end   = Math.min(start + chunkSize, total);
            const chunk = this.files.slice(start, end);

            this.statusLabel.text =
               format("Measuring with SubframeSelector: %d / %d", start, total);
            this.statusLabel.update();
            processEvents();

            try {
               const P = new SubframeSelector;
               P.nonInteractive = true;
               // 4-column row: [ enabled, path, drizzlePath, localNormalizationPath ]
               P.subframes      = chunk.map(function(p) { return [true, p, "", ""]; });
               P.maxPSFFits     = 8000;
               P.routine        = 0;   // 0 = MeasureSubframes
               P.executeGlobal();

               const ms = P.measurements || [];
               const byPath = new Map();
               for (let j = 0; j < ms.length; ++j)
                  byPath.set(ms[j][SF_PATH], ms[j]);

               for (let i = start; i < end; ++i) {
                  const m = byPath.get(this.files[i]);
                  if (!m) continue;
                  ++totalMatched;
                  if (!this.metadata[i]) this.metadata[i] = {};
                  this.metadata[i].fwhm   = "" + m[SF_FWHM];
                  this.metadata[i].ecc    = "" + m[SF_ECC];
                  this.metadata[i].stars  = "" + m[SF_STARS];
                  this.metadata[i].snr    = "" + m[SF_SNR];
                  this.metadata[i].weight = "" + m[SF_WEIGHT];
                  const node = this.fileTree.child(i);
                  if (node != null) this.applyNodeStyle(node, i);
               }
            } catch (e) {
               lastError = e;
               console.warningln(format(
                  "* SubframeSelector chunk %d-%d failed: %s",
                  start, end - 1, (e && e.message) || e));
            }

            this.progressBar.setProgress(end, total);
         }

         console.writeln(format(
            "* SubframeSelector matched %d / %d frame(s).",
            totalMatched, total));
      } finally {
         this.progressBar.visible = false;
         this.measureButton.enabled = true;
         this.updateStatus();
      }

      if (totalMatched == 0 && lastError) {
         (new MessageBox(
            "SubframeSelector failed: "
            + ((lastError && lastError.message) || lastError)
            + "\n\nFWHM / Ecc / Stars / SNR columns are blank. "
            + "Try the 'Re-measure' button again.",
            TITLE, StdIcon_Warning, StdButton_Ok)).execute();
      }
   }

   refreshTree() {
      this.fileTree.clear();
      for (let i = 0; i < this.files.length; ++i) {
         const node = new TreeBoxNode(this.fileTree);
         node.fileIndex = i;
         this.applyNodeStyle(node, i);
      }
   }

   refreshTreeRows() {
      for (let i = 0; i < this.fileTree.numberOfChildren; ++i)
         this.applyNodeStyle(this.fileTree.child(i), i);
   }

   applyNodeStyle(node, i) {
      const path     = this.files[i];
      const isMarked = this.marked.has(path);
      const md       = this.metadata[i] || {};
      node.setText(0, isMarked ? "DELETE" : "keep");
      node.setText(1, File.extractName(path) + File.extractExtension(path));
      node.setText(2, md.filter || "");
      node.setText(3, fmtNum(md.exp, 1));
      node.setText(4, fmtNum(md.fwhm, 2));
      node.setText(5, fmtNum(md.ecc, 3));
      node.setText(6, fmtInt(md.stars));
      node.setText(7, fmtNum(md.snr, 2));
      const color = isMarked ? 0xFFE53935 : 0xFF7CB342;   // red / green (ARGB)
      node.setTextColor(0, color);
   }

   toggleMark(idx) {
      if (idx < 0 || idx >= this.files.length) return;
      const path = this.files[idx];
      if (this.marked.has(path)) this.marked.delete(path);
      else                       this.marked.add(path);
      const node = this.fileTree.child(idx);
      if (node != null) this.applyNodeStyle(node, idx);
      this.updateStatus();
   }

   previewFile(idx) {
      if (idx < 0 || idx >= this.files.length) return;
      const path = this.files[idx];
      this.previewName.text = File.extractName(path) + File.extractExtension(path);
      // Show a spinner-like cue while the FITS is loading.
      this.statusLabel.text = "Loading: " + this.previewName.text + " ...";
      this.statusLabel.update();
      processEvents();

      const bmp = LoadStretchedBitmap(path);
      this.preview.setBitmap(bmp);
      this.preview.zoomFit();
      this.updateStatus();
   }

   updateStatus() {
      const total  = this.files.length;
      const marked = this.marked.size;
      const keep   = total - marked;
      this.statusLabel.text =
         format("Total: %d  |  Keep: %d  |  Marked: %d", total, keep, marked);
   }

   copyGoodFrames() {
      if (this.files.length == 0) {
         (new MessageBox("No files loaded.",
                         TITLE, StdIcon_Warning, StdButton_Ok)).execute();
         return;
      }
      const keepCount = this.files.length - this.marked.size;
      if (keepCount == 0) {
         (new MessageBox("All files are marked for deletion - nothing to copy.",
                         TITLE, StdIcon_Warning, StdButton_Ok)).execute();
         return;
      }

      const gdd = new GetDirectoryDialog;
      gdd.caption = "Select Destination Folder for Good Frames";
      if (!gdd.execute()) return;

      const dest = gdd.directoryPath;
      if (dest == this.sourceDir) {
         (new MessageBox("Destination must differ from source.",
                         TITLE, StdIcon_Error, StdButton_Ok)).execute();
         return;
      }

      const confirm = new MessageBox(
         format("Copy %d good frame(s) to:\n%s\n\nProceed?", keepCount, dest),
         TITLE, StdIcon_Question, StdButton_Yes, StdButton_No);
      if (confirm.execute() != StdButton_Yes) return;

      let copied = 0, failed = 0, skipped = 0;
      console.show();
      console.writeln("<end><cbr><br>* Copying ", keepCount, " good frame(s) to ", dest);
      for (let i = 0; i < this.files.length; ++i) {
         const src  = this.files[i];
         if (this.marked.has(src)) continue;
         const name = File.extractName(src) + File.extractExtension(src);
         const dst  = dest + "/" + name;
         if (File.exists(dst)) {
            console.warningln("  skip (already exists): " + name);
            ++skipped;
            continue;
         }
         try {
            File.copyFile(dst, src);
            ++copied;
         } catch (e) {
            ++failed;
            console.criticalln("  FAILED: " + name + " - " + e.message);
         }
      }
      console.writeln(format("* Done. Copied: %d, Skipped: %d, Failed: %d",
                             copied, skipped, failed));

      (new MessageBox(
         format("Copied: %d\nSkipped (already existed): %d\nFailed: %d",
                copied, skipped, failed),
         TITLE, StdIcon_Information, StdButton_Ok)).execute();
   }

   deleteMarkedFrames() {
      if (this.marked.size == 0) {
         (new MessageBox("No frames are marked for deletion.",
                         TITLE, StdIcon_Information, StdButton_Ok)).execute();
         return;
      }

      const confirm = new MessageBox(
         format("Permanently DELETE %d marked file(s) from:\n%s\n\n"
                + "This cannot be undone. Proceed?",
                this.marked.size, this.sourceDir),
         TITLE, StdIcon_Warning, StdButton_Yes, StdButton_No);
      if (confirm.execute() != StdButton_Yes) return;

      // Map marked paths to indices in the current (possibly sorted) array.
      const toDelete = [];
      for (let i = 0; i < this.files.length; ++i)
         if (this.marked.has(this.files[i])) toDelete.push(i);
      toDelete.sort(function(a, b) { return b - a; });

      let deleted = 0, failed = 0;
      const survivors = this.files.slice();
      console.show();
      console.writeln("<end><cbr><br>* Deleting ", toDelete.length, " marked file(s)");
      for (let k = 0; k < toDelete.length; ++k) {
         const i = toDelete[k];
         const path = survivors[i];
         try {
            File.remove(path);
            survivors.splice(i, 1);
            ++deleted;
         } catch (e) {
            ++failed;
            console.criticalln("  FAILED: " + path + " - " + e.message);
         }
      }
      console.writeln(format("* Done. Deleted: %d, Failed: %d", deleted, failed));

      // Keep metadata in sync with the survivors list (same indices removed).
      const survivorMeta = this.metadata.slice();
      for (let k = 0; k < toDelete.length; ++k)
         survivorMeta.splice(toDelete[k], 1);
      this.files    = survivors;
      this.metadata = survivorMeta;
      this.marked   = new Set();
      this.refreshTree();
      this.updateStatus();
      if (this.files.length > 0)
         this.fileTree.currentNode = this.fileTree.child(0);

      (new MessageBox(
         format("Deleted: %d\nFailed: %d", deleted, failed),
         TITLE, StdIcon_Information, StdButton_Ok)).execute();
   }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
   const dlg = new FitsReviewerDialog();
   dlg.execute();
}

main();
