// ----------------------------------------------------------------------------
// PixInsight JavaScript Runtime API - PJSR Version 2.0 (V8 port)
// ----------------------------------------------------------------------------
// VeraLux_HyperMetric_Stretch.js
// ----------------------------------------------------------------------------
//
// V8-runtime port of "VeraLux - HyperMetric Stretch" Python script for Siril.
// Algorithm reference: VeraLux_HyperMetric_Stretch.py v1.5.2
//   https://gitlab.com/free-astro/siril-scripts/-/tree/main/VeraLux
//
// Original Python implementation:
//   Copyright (c) 2025 Riccardo Paterniti
//   SPDX-License-Identifier: GPL-3.0-or-later
//   Contact: info@veralux.space
//
// Earlier SpiderMonkey-runtime PJSR port (PI-integration reference only):
//   Copyright (c) 2025 killerciao
//   Copyright (c) 2026 lucasssvaz
//   https://github.com/lucasssvaz/VeraLuxPorting
//
// This V8 port: Python 1.5.2 math preserved one-to-one. UI is a single modal
// PJSR dialog: controls on the left, embedded scroll-/zoom-/pan-preview on the
// right (rendered from a downsampled proxy of the target view), Process applies
// in place at full resolution.
// ----------------------------------------------------------------------------

#engine v8

#define TITLE   "VeraLux HyperMetric Stretch"
#define VERSION "1.5.2"

#feature-id VeraLuxHyperMetric : salvolm > VeraLux HyperMetric Stretch

#feature-info <b>VeraLux HyperMetric Stretch v1.5.2</b> (V8 port)<br/>\
   <br/>\
   Photometric inverse-hyperbolic stretch with vector color preservation.<br/>\
   Input MUST be LINEAR and color-calibrated (SPCC).<br/>\
   <br/>\
   Algorithm by Riccardo Paterniti (Python/Siril, GPL-3.0-or-later).<br/>\
   PixInsight V8 port preserves the 1.5.2 math (anchor, hyperbolic stretch,\
   vector color, Linear Expansion, Ready-to-Use adaptive scaling + soft clip).

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

// =============================================================================
// SENSOR PROFILES (from Python 1.5.2, database v2.2)
// =============================================================================

var SENSOR_PROFILES = [
   // [ label, [r,g,b weights], info text ]
   [ "Rec.709 (Recommended)",             [0.2126, 0.7152, 0.0722], "ITU-R BT.709 standard for sRGB/HDTV. Default for general use, DSLR and unknown sensors." ],

   [ "Sony IMX571 (ASI2600/QHY268)",      [0.2944, 0.5021, 0.2035], "Sony IMX571 26MP APS-C BSI (STARVIS). Gold standard APS-C." ],
   [ "Sony IMX455 (ASI6200/QHY600)",      [0.2987, 0.5001, 0.2013], "Sony IMX455 61MP Full Frame BSI. Reference full-frame sensor." ],
   [ "Sony IMX410 (ASI2400)",             [0.3015, 0.5050, 0.1935], "Sony IMX410 24MP Full Frame (large pixels)." ],
   [ "Sony IMX269 (Altair/ToupTek)",      [0.3040, 0.5010, 0.1950], "Sony IMX269 20MP 4/3\" BSI." ],
   [ "Sony IMX294 (ASI294)",              [0.3068, 0.5008, 0.1925], "Sony IMX294 11.7MP 4/3\" BSI. High sensitivity, high Red/Green." ],

   [ "Sony IMX533 (ASI533)",              [0.2910, 0.5072, 0.2018], "Sony IMX533 9MP 1\" Square BSI. Very low noise." ],
   [ "Sony IMX676 (ASI676)",              [0.2880, 0.5100, 0.2020], "Sony IMX676 12MP Square BSI (STARVIS 2)." ],

   [ "Sony IMX585 (ASI585) - STARVIS 2",  [0.3431, 0.4822, 0.1747], "Sony IMX585 8.3MP 1/1.2\" BSI (STARVIS 2). High Red/NIR." ],
   [ "Sony IMX662 (ASI662) - STARVIS 2",  [0.3430, 0.4821, 0.1749], "Sony IMX662 2.1MP 1/2.8\" BSI (STARVIS 2). Planetary/guiding." ],
   [ "Sony IMX678 (ASI678) - STARVIS 2",  [0.3426, 0.4825, 0.1750], "Sony IMX678 8MP BSI (STARVIS 2). 4K, small pixels." ],
   [ "Sony IMX462 (ASI462)",              [0.3333, 0.4866, 0.1801], "Sony IMX462 2MP 1/2.8\" (extreme Red/NIR)." ],
   [ "Sony IMX715 (ASI715)",              [0.3410, 0.4840, 0.1750], "Sony IMX715 8MP (STARVIS 2). Ultra-small pixels." ],
   [ "Sony IMX482 (ASI482)",              [0.3150, 0.4950, 0.1900], "Sony IMX482 2MP. Large pixels, high sensitivity." ],
   [ "Sony IMX183 (ASI183)",              [0.2967, 0.4983, 0.2050], "Sony IMX183 20MP 1\" BSI." ],
   [ "Sony IMX178 (ASI178)",              [0.2346, 0.5206, 0.2448], "Sony IMX178 6.4MP 1/1.8\" BSI. Lower Red than STARVIS." ],
   [ "Sony IMX224 (ASI224)",              [0.3402, 0.4765, 0.1833], "Sony IMX224 1.27MP 1/3\" BSI. Classic planetary." ],

   [ "Canon EOS (Modern - 60D/600D/500D)", [0.2600, 0.5200, 0.2200], "Canon CMOS (Digic 4/5 era). 60D, 600D, 550D, 500D." ],
   [ "Canon EOS (Legacy - 300D/40D/20D)",  [0.2450, 0.5350, 0.2200], "Canon CMOS (legacy Digic 2/3). 300D, 40D, 20D, 350D." ],

   [ "Nikon DSLR (Modern - D5100/D7200)", [0.2650, 0.5100, 0.2250], "Nikon DX/FX CMOS (modern). D5100, D7000 series, D500, D850." ],
   [ "Nikon DSLR (Legacy - D3/D300/D90)", [0.2500, 0.5300, 0.2200], "Nikon CMOS (legacy). D3, D300s, D90, D40, D50." ],

   [ "Fujifilm X-Trans 5 HR",             [0.2800, 0.5100, 0.2100], "Fujifilm X-Trans 5 (40MP). Approx for X-T5/X-H2." ],
   [ "Panasonic MN34230 (ASI1600)",       [0.2650, 0.5250, 0.2100], "Panasonic MN34230 4/3\" CMOS. Classic Mono/OSC (ASI1600)." ],

   [ "ZWO Seestar S50",                   [0.3333, 0.4866, 0.1801], "ZWO Seestar S50 (IMX462). High Red/NIR." ],
   [ "ZWO Seestar S30",                   [0.2928, 0.5053, 0.2019], "ZWO Seestar S30." ],

   [ "Narrowband HOO",                    [0.5000, 0.2500, 0.2500], "Bicolor palette: Halpha=Red, OIII=Green+Blue." ],
   [ "Narrowband SHO",                    [0.3333, 0.3400, 0.3267], "Hubble palette: SII=Red, Halpha=Green, OIII=Blue." ]
];

var DEFAULT_PROFILE_INDEX = 0; // "Rec.709 (Recommended)"

function profileWeights( idx ) { return SENSOR_PROFILES[idx][1]; }
function profileInfo( idx )    { return SENSOR_PROFILES[idx][2]; }
function profileLabel( idx )   { return SENSOR_PROFILES[idx][0]; }

// =============================================================================
// PARAMETERS (Single Source of Truth, persisted via Settings)
// =============================================================================

function ParametersPrototype() {
   this.dialog = null;

   this.targetView = null;

   this.MODE_READY      = 0;
   this.MODE_SCIENTIFIC = 1;

   this.defProfileIndex      = DEFAULT_PROFILE_INDEX;
   this.profileIndex         = this.defProfileIndex;

   this.defMode              = this.MODE_READY;
   this.mode                 = this.defMode;

   this.defAdaptiveAnchor    = true;
   this.adaptiveAnchor       = this.defAdaptiveAnchor;

   this.defTargetBg          = 0.20;
   this.targetBg             = this.defTargetBg;

   this.defLogD              = 2.00;
   this.logD                 = this.defLogD;

   this.defProtectB          = 6.00;
   this.protectB             = this.defProtectB;

   this.defConvergence       = 3.50;
   this.convergence          = this.defConvergence;

   this.defStrategy          = 0;
   this.strategy             = this.defStrategy;

   this.defLinearExpansion   = 0.00;
   this.linearExpansion      = this.defLinearExpansion;

   this.defColorGrip         = 1.00;
   this.colorGrip            = this.defColorGrip;

   this.defShadowConvergence = 0.00;
   this.shadowConvergence    = this.defShadowConvergence;

   var KEY = TITLE + "." + VERSION + "_";

   this.storeSettings = function() {
      Settings.write( KEY + "profileIndex",      DataType.Int32,  this.profileIndex );
      Settings.write( KEY + "mode",              DataType.Int32,  this.mode );
      Settings.write( KEY + "adaptiveAnchor",    DataType.Boolean,this.adaptiveAnchor );
      Settings.write( KEY + "targetBg",          DataType.Real32, this.targetBg );
      Settings.write( KEY + "logD",              DataType.Real32, this.logD );
      Settings.write( KEY + "protectB",          DataType.Real32, this.protectB );
      Settings.write( KEY + "convergence",       DataType.Real32, this.convergence );
      Settings.write( KEY + "strategy",          DataType.Int32,  this.strategy );
      Settings.write( KEY + "colorGrip",         DataType.Real32, this.colorGrip );
      Settings.write( KEY + "shadowConvergence", DataType.Real32, this.shadowConvergence );
   };

   function clampDef( v, lo, hi, def ) {
      return ( v != null && !isNaN( v ) && v >= lo && v <= hi ) ? v : def;
   }

   this.loadSettings = function() {
      var v;
      v = Settings.read( KEY + "profileIndex", DataType.Int32 );
      this.profileIndex = clampDef( v, 0, SENSOR_PROFILES.length - 1, this.defProfileIndex );

      v = Settings.read( KEY + "mode", DataType.Int32 );
      this.mode = clampDef( v, 0, 1, this.defMode );

      v = Settings.read( KEY + "adaptiveAnchor", DataType.Boolean );
      this.adaptiveAnchor = ( v != null ) ? !!v : this.defAdaptiveAnchor;

      v = Settings.read( KEY + "targetBg",    DataType.Real32 ); this.targetBg    = clampDef( v, 0.05, 0.50, this.defTargetBg );
      v = Settings.read( KEY + "logD",        DataType.Real32 ); this.logD        = clampDef( v, 0.00, 7.00, this.defLogD );
      v = Settings.read( KEY + "protectB",    DataType.Real32 ); this.protectB    = clampDef( v, 0.10, 15.0, this.defProtectB );
      v = Settings.read( KEY + "convergence", DataType.Real32 ); this.convergence = clampDef( v, 1.00, 10.0, this.defConvergence );
      v = Settings.read( KEY + "strategy",    DataType.Int32  ); this.strategy    = clampDef( v, -100, 100, this.defStrategy );
      v = Settings.read( KEY + "colorGrip",   DataType.Real32 ); this.colorGrip   = clampDef( v, 0.00, 1.00, this.defColorGrip );
      v = Settings.read( KEY + "shadowConvergence", DataType.Real32 ); this.shadowConvergence = clampDef( v, 0.00, 3.00, this.defShadowConvergence );

      this.linearExpansion = this.defLinearExpansion;
   };

   this.effectiveGripAndShadow = function() {
      if ( this.mode === this.MODE_READY ) {
         var s = this.strategy;
         if ( s < 0 ) return { grip: 1.0, shadow: ( Math.abs( s ) / 100.0 ) * 3.0, linexp: 0.0 };
         if ( s > 0 ) return { grip: 1.0 - ( s / 100.0 ) * 0.6, shadow: 0.0, linexp: 0.0 };
         return { grip: 1.0, shadow: 0.0, linexp: 0.0 };
      }
      return { grip: this.colorGrip, shadow: this.shadowConvergence, linexp: this.linearExpansion };
   };
}
var parameters = new ParametersPrototype();

// =============================================================================
// MATH HELPERS
// =============================================================================

function clamp01( v ) { return v < 0 ? 0 : ( v > 1 ? 1 : v ); }
function sortAscending( a, b ) { return a < b ? -1 : a > b ? 1 : 0; }

function percentile( sorted, p ) {
   var n = sorted.length;
   if ( n === 0 ) return 0;
   if ( n === 1 ) return sorted[0];
   var idx = ( p / 100.0 ) * ( n - 1 );
   var lo  = Math.floor( idx );
   var hi  = Math.ceil( idx );
   if ( hi >= n ) return sorted[n - 1];
   var w = idx - lo;
   return sorted[lo] * ( 1 - w ) + sorted[hi] * w;
}

function hyperbolicStretch( x, D, b, SP ) {
   if ( D < 0.1 ) D = 0.1;
   if ( b < 0.1 ) b = 0.1;
   if ( SP === undefined ) SP = 0.0;
   var t2   = Math.asinh( b );
   var norm = Math.asinh( D * ( 1.0 - SP ) + b ) - t2;
   if ( Math.abs( norm ) < 1e-12 ) norm = 1e-6;
   return ( Math.asinh( D * ( x - SP ) + b ) - t2 ) / norm;
}

function applyMTF( x, m ) {
   if ( x <= 0 ) return 0;
   if ( x >= 1 ) return 1;
   var num = ( m - 1.0 ) * x;
   var den = ( 2.0 * m - 1.0 ) * x - m;
   if ( Math.abs( den ) < 1e-12 ) return x;
   return clamp01( num / den );
}

function solveLogD( medianIn, target, b ) {
   if ( medianIn < 1e-9 ) return 2.0;
   var lo = 0.0, hi = 7.0, best = 2.0;
   for ( let i = 0; i < 40; ++i ) {
      var mid = 0.5 * ( lo + hi );
      var D   = Math.pow( 10.0, mid );
      var t   = hyperbolicStretch( medianIn, D, b, 0.0 );
      if ( Math.abs( t - target ) < 1e-4 ) { best = mid; break; }
      if ( t < target ) lo = mid; else hi = mid;
      best = mid;
   }
   return best;
}

// =============================================================================
// SAMPLERS — use ImageIterator (V8 native-speed pixel access).
// All callers pass a float-32 real image.
// =============================================================================

function sampleLuminance( image, weights, maxSamples ) {
   var w = image.width, h = image.height, n = w * h;
   var stride = Math.max( 1, Math.floor( n / maxSamples ) );
   var isRGB = ( image.numberOfChannels >= 3 );
   var arr = [];
   if ( isRGB ) {
      var Ir = new ImageIterator( image, 0 );
      var Ig = new ImageIterator( image, 1 );
      var Ib = new ImageIterator( image, 2 );
      var wr = weights[0], wg = weights[1], wb = weights[2];
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         arr.push( wr * Ir[y][x] + wg * Ig[y][x] + wb * Ib[y][x] );
      }
   } else {
      var Im = new ImageIterator( image, 0 );
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         arr.push( Im[y][x] );
      }
   }
   arr.sort( sortAscending );
   return arr;
}

function sampleChannel( image, channel, maxSamples ) {
   var w = image.width, h = image.height, n = w * h;
   var stride = Math.max( 1, Math.floor( n / maxSamples ) );
   var arr = [];
   var I = new ImageIterator( image, channel );
   for ( let i = 0; i < n; i += stride ) {
      var x = i % w, y = ( i / w ) | 0;
      arr.push( I[y][x] );
   }
   arr.sort( sortAscending );
   return arr;
}

// =============================================================================
// ANCHOR
// =============================================================================

function calculateAnchorStatistical( image ) {
   var nc = image.numberOfChannels;
   if ( nc >= 3 ) {
      var floors = [];
      for ( let c = 0; c < 3; ++c ) {
         var s = sampleChannel( image, c, 500000 );
         floors.push( percentile( s, 0.5 ) );
      }
      return Math.max( 0.0, Math.min( floors[0], floors[1], floors[2] ) - 0.00025 );
   } else {
      var s = sampleChannel( image, 0, 200000 );
      return Math.max( 0.0, percentile( s, 0.5 ) - 0.00025 );
   }
}

function calculateAnchorAdaptive( image, weights ) {
   var w = image.width, h = image.height, n = w * h;
   var isRGB = ( image.numberOfChannels >= 3 );
   var stride = Math.max( 1, Math.floor( n / 2000000 ) );
   var nBins = 65536;
   var hist = new Float64Array( nBins );

   if ( isRGB ) {
      var Ir = new ImageIterator( image, 0 );
      var Ig = new ImageIterator( image, 1 );
      var Ib = new ImageIterator( image, 2 );
      var wr = weights[0], wg = weights[1], wb = weights[2];
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         var v = wr * Ir[y][x] + wg * Ig[y][x] + wb * Ib[y][x];
         var bin = ( v * ( nBins - 1 ) ) | 0;
         if ( bin >= 0 && bin < nBins ) hist[bin]++;
      }
   } else {
      var Im = new ImageIterator( image, 0 );
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         var v = Im[y][x];
         var bin = ( v * ( nBins - 1 ) ) | 0;
         if ( bin >= 0 && bin < nBins ) hist[bin]++;
      }
   }

   // Boxcar smoothing, radius 50 (running-sum trick).
   var smoothed = new Float64Array( nBins );
   var win = 50;
   var sum = 0;
   for ( let k = 0; k < win && k < nBins; ++k ) sum += hist[k];
   for ( let k = 0; k < nBins; ++k ) {
      if ( k + win < nBins ) sum += hist[k + win];
      if ( k - win - 1 >= 0 ) sum -= hist[k - win - 1];
      var count = Math.min( k + win, nBins - 1 ) - Math.max( k - win, 0 ) + 1;
      smoothed[k] = sum / count;
   }

   // Peak search (start at 100 unless head bins already dominate).
   var searchStart = 100;
   var headMax = 0;
   for ( let k = 0; k < Math.min( searchStart, nBins ); ++k )
      if ( smoothed[k] > headMax ) headMax = smoothed[k];
   if ( headMax > 0 ) searchStart = 0;
   if ( searchStart >= nBins ) searchStart = 0;

   var peakIdx = searchStart, peakVal = 0;
   for ( let k = searchStart; k < nBins; ++k )
      if ( smoothed[k] > peakVal ) { peakVal = smoothed[k]; peakIdx = k; }

   var target = peakVal * 0.06;
   var anchorIdx = -1;
   for ( let k = peakIdx - 1; k >= 0; --k )
      if ( smoothed[k] < target ) { anchorIdx = k; break; }

   if ( anchorIdx < 0 ) {
      var sList = isRGB ? sampleLuminance( image, weights, 500000 )
                        : sampleChannel( image, 0, 500000 );
      return Math.max( 0.0, percentile( sList, 0.5 ) );
   }

   var anchor = anchorIdx / ( nBins - 1 );
   if ( !isFinite( anchor ) || anchor <= 0 ) {
      var sList = isRGB ? sampleLuminance( image, weights, 500000 )
                        : sampleChannel( image, 0, 500000 );
      return Math.max( 0.0, percentile( sList, 0.5 ) );
   }
   return Math.max( 0.0, anchor );
}

// =============================================================================
// PASS 1: STRETCHED LUMINANCE
// =============================================================================

function buildStretchedLuminance( srcImage, lumStr, anchor, D, b, weights, isRGB ) {
   var t2 = Math.asinh( b );
   var norm = Math.asinh( D + b ) - t2;
   if ( Math.abs( norm ) < 1e-12 ) norm = 1e-6;

   var IL = new ImageIterator( lumStr, 0 );
   var H  = IL.height, W = IL.width;

   if ( isRGB ) {
      var Ir = new ImageIterator( srcImage, 0 );
      var Ig = new ImageIterator( srcImage, 1 );
      var Ib = new ImageIterator( srcImage, 2 );
      var wr = weights[0], wg = weights[1], wb = weights[2];
      for ( let y = 0; y < H; ++y ) {
         var ir = Ir[y], ig = Ig[y], ib = Ib[y], il = IL[y];
         for ( let x = 0; x < W; ++x ) {
            var r = ir[x] - anchor; if ( r < 0 ) r = 0;
            var g = ig[x] - anchor; if ( g < 0 ) g = 0;
            var bv = ib[x] - anchor; if ( bv < 0 ) bv = 0;
            var L = wr * r + wg * g + wb * bv;
            var s = ( Math.asinh( D * L + b ) - t2 ) / norm;
            il[x] = s < 0 ? 0 : ( s > 1 ? 1 : s );
         }
      }
   } else {
      var Im = new ImageIterator( srcImage, 0 );
      for ( let y = 0; y < H; ++y ) {
         var im = Im[y], il = IL[y];
         for ( let x = 0; x < W; ++x ) {
            var v = im[x] - anchor; if ( v < 0 ) v = 0;
            var s = ( Math.asinh( D * v + b ) - t2 ) / norm;
            il[x] = s < 0 ? 0 : ( s > 1 ? 1 : s );
         }
      }
   }
}

// =============================================================================
// LINEAR EXPANSION (Scientific only) — Smart Max neighbor-check.
// =============================================================================

function applyLinearExpansion( lumStr, factor ) {
   if ( factor <= 0.001 ) return;

   var IL = new ImageIterator( lumStr, 0 );
   var H = IL.height, W = IL.width;

   // 1. Absolute maximum + position.
   var absMax = -Infinity, xMax = 0, yMax = 0;
   for ( let y = 0; y < H; ++y ) {
      var row = IL[y];
      for ( let x = 0; x < W; ++x ) {
         if ( row[x] > absMax ) { absMax = row[x]; xMax = x; yMax = y; }
      }
   }

   // 2. Smart-Max neighbor check on a 3x3 window around argmax.
   var useAbsoluteMax = false;
   if ( absMax > 0.001 ) {
      var maxNeighbor = -Infinity, anyNeighbor = false;
      var y0 = Math.max( 0, yMax - 1 ), y1 = Math.min( H, yMax + 2 );
      var x0 = Math.max( 0, xMax - 1 ), x1 = Math.min( W, xMax + 2 );
      for ( let y = y0; y < y1; ++y ) {
         var row = IL[y];
         for ( let x = x0; x < x1; ++x ) {
            var v = row[x];
            if ( v < absMax ) { anyNeighbor = true; if ( v > maxNeighbor ) maxNeighbor = v; }
         }
      }
      if ( anyNeighbor && maxNeighbor >= ( absMax * 0.20 ) )
         useAbsoluteMax = true;
   }

   // 3. Bounds: low = p(0.001), high = absMax (Smart Max) or p(99.999).
   var sorted = [];
   var sStride = Math.max( 1, Math.floor( ( W * H ) / 500000 ) );
   for ( let y = 0; y < H; ++y ) {
      var row = IL[y];
      for ( let x = 0; x < W; x += sStride ) sorted.push( row[x] );
   }
   sorted.sort( sortAscending );

   var low  = percentile( sorted, 0.001 );
   var high = useAbsoluteMax ? absMax : percentile( sorted, 99.999 );
   if ( high <= low ) return;

   // 4. Per-pixel lerp.
   var denom = high - low;
   var oneMinusF = 1.0 - factor;
   for ( let y = 0; y < H; ++y ) {
      var row = IL[y];
      for ( let x = 0; x < W; ++x ) {
         var v = row[x];
         var n = ( v - low ) / denom;
         if ( n < 0 ) n = 0; else if ( n > 1 ) n = 1;
         var u = v * oneMinusF + n * factor;
         row[x] = u < 0 ? 0 : ( u > 1 ? 1 : u );
      }
   }
}

// =============================================================================
// PASS 2: COLOR RECONSTRUCTION (vector + hybrid grip + shadow).
// =============================================================================

function reconstructColor( srcImage, lumStr, result, anchor, D, b, weights,
                           convergencePow, grip0, shadow, isRGB ) {
   var pedestal = 0.005;
   var oneMP = 1.0 - pedestal;
   var eps = 1e-9;
   var IL = new ImageIterator( lumStr, 0 );
   var H = IL.height, W = IL.width;

   if ( isRGB ) {
      var Ir = new ImageIterator( srcImage, 0 );
      var Ig = new ImageIterator( srcImage, 1 );
      var Ib = new ImageIterator( srcImage, 2 );
      var Or = new ImageIterator( result, 0 );
      var Og = new ImageIterator( result, 1 );
      var Ob = new ImageIterator( result, 2 );

      var wr = weights[0], wg = weights[1], wb = weights[2];
      var needsHybrid = ( grip0 < 1.0 ) || ( shadow > 0.01 );
      var t2 = Math.asinh( b );
      var hyperNorm = Math.asinh( D + b ) - t2;
      if ( Math.abs( hyperNorm ) < 1e-12 ) hyperNorm = 1e-6;

      for ( let y = 0; y < H; ++y ) {
         var ir = Ir[y], ig = Ig[y], ib = Ib[y], il = IL[y];
         var or_ = Or[y], og = Og[y], ob = Ob[y];
         for ( let x = 0; x < W; ++x ) {
            var r = ir[x] - anchor; if ( r < 0 ) r = 0;
            var g = ig[x] - anchor; if ( g < 0 ) g = 0;
            var bv = ib[x] - anchor; if ( bv < 0 ) bv = 0;
            var L = wr * r + wg * g + wb * bv;
            var Lsafe = L + eps;
            var Lstr = il[x];

            var k = Math.pow( Lstr, convergencePow );
            var omk = 1.0 - k;

            var rF = Lstr * ( ( r  / Lsafe ) * omk + k );
            var gF = Lstr * ( ( g  / Lsafe ) * omk + k );
            var bF = Lstr * ( ( bv / Lsafe ) * omk + k );

            if ( needsHybrid ) {
               var rS = ( Math.asinh( D * r  + b ) - t2 ) / hyperNorm; if ( rS < 0 ) rS = 0; else if ( rS > 1 ) rS = 1;
               var gS = ( Math.asinh( D * g  + b ) - t2 ) / hyperNorm; if ( gS < 0 ) gS = 0; else if ( gS > 1 ) gS = 1;
               var bS = ( Math.asinh( D * bv + b ) - t2 ) / hyperNorm; if ( bS < 0 ) bS = 0; else if ( bS > 1 ) bS = 1;

               var grip = grip0;
               if ( shadow > 0.01 ) grip = grip0 * Math.pow( Lstr, shadow );
               var omg = 1.0 - grip;

               rF = rF * grip + rS * omg;
               gF = gF * grip + gS * omg;
               bF = bF * grip + bS * omg;
            }

            rF = rF * oneMP + pedestal; if ( rF < 0 ) rF = 0; else if ( rF > 1 ) rF = 1;
            gF = gF * oneMP + pedestal; if ( gF < 0 ) gF = 0; else if ( gF > 1 ) gF = 1;
            bF = bF * oneMP + pedestal; if ( bF < 0 ) bF = 0; else if ( bF > 1 ) bF = 1;

            or_[x] = rF;
            og[x]  = gF;
            ob[x]  = bF;
         }
      }
   } else {
      var Or = new ImageIterator( result, 0 );
      for ( let y = 0; y < H; ++y ) {
         var il = IL[y], or_ = Or[y];
         for ( let x = 0; x < W; ++x ) {
            var v = il[x] * oneMP + pedestal;
            or_[x] = v < 0 ? 0 : ( v > 1 ? 1 : v );
         }
      }
   }
}

// =============================================================================
// READY-TO-USE: adaptive output scaling + soft clip.
// =============================================================================

function adaptiveOutputScaling( image, weights, targetBg, overrides ) {
   var w = image.width, h = image.height;
   var nc = image.numberOfChannels;
   var isRGB = ( nc >= 3 );

   var lumas = sampleLuminance( image, weights, 500000 );
   var n = lumas.length;
   if ( n === 0 ) return;

   var median = percentile( lumas, 50 );
   var minL   = lumas[0];

   var mean = 0;
   for ( let i = 0; i < n; ++i ) mean += lumas[i];
   mean /= n;
   var std = 0;
   for ( let i = 0; i < n; ++i ) { var d = lumas[i] - mean; std += d * d; }
   std = Math.sqrt( std / n );

   var globalFloor = Math.max( minL, median - 2.7 * std );
   var PEDESTAL = 0.001;

   // Smart-Max physical-limit check on full luminance.
   // Overrides skip the scan entirely so the preview (proxy) inherits the
   // Smart-Max decision computed on the full source — matching Process output.
   var absMax, validPhysical;
   if ( overrides && overrides.validPhysical !== undefined && overrides.absMax !== undefined ) {
      validPhysical = overrides.validPhysical;
      absMax        = overrides.absMax;
   } else {
      absMax = -Infinity;
      var xMax = 0, yMax = 0;
      if ( isRGB ) {
         var Ir = new ImageIterator( image, 0 );
         var Ig = new ImageIterator( image, 1 );
         var Ib = new ImageIterator( image, 2 );
         var wr = weights[0], wg = weights[1], wb = weights[2];
         for ( let y = 0; y < h; ++y ) {
            var ir = Ir[y], ig = Ig[y], ib = Ib[y];
            for ( let x = 0; x < w; ++x ) {
               var L = wr * ir[x] + wg * ig[x] + wb * ib[x];
               if ( L > absMax ) { absMax = L; xMax = x; yMax = y; }
            }
         }
      } else {
         var Im = new ImageIterator( image, 0 );
         for ( let y = 0; y < h; ++y ) {
            var im = Im[y];
            for ( let x = 0; x < w; ++x )
               if ( im[x] > absMax ) { absMax = im[x]; xMax = x; yMax = y; }
         }
      }

      validPhysical = true;
      if ( absMax > 0.001 ) {
         var y0 = Math.max( 0, yMax - 1 ), y1 = Math.min( h, yMax + 2 );
         var x0 = Math.max( 0, xMax - 1 ), x1 = Math.min( w, xMax + 2 );
         var maxNeighbor = -Infinity, anyNeighbor = false;
         if ( isRGB ) {
            var Ir = new ImageIterator( image, 0 );
            var Ig = new ImageIterator( image, 1 );
            var Ib = new ImageIterator( image, 2 );
            var wr = weights[0], wg = weights[1], wb = weights[2];
            for ( let y = y0; y < y1; ++y ) {
               var ir = Ir[y], ig = Ig[y], ib = Ib[y];
               for ( let x = x0; x < x1; ++x ) {
                  var L = wr * ir[x] + wg * ig[x] + wb * ib[x];
                  if ( L < absMax ) { anyNeighbor = true; if ( L > maxNeighbor ) maxNeighbor = L; }
               }
            }
         } else {
            var Im = new ImageIterator( image, 0 );
            for ( let y = y0; y < y1; ++y ) {
               var im = Im[y];
               for ( let x = x0; x < x1; ++x ) {
                  var L = im[x];
                  if ( L < absMax ) { anyNeighbor = true; if ( L > maxNeighbor ) maxNeighbor = L; }
               }
            }
         }
         if ( anyNeighbor && maxNeighbor < ( absMax * 0.20 ) )
            validPhysical = false;
      }
   }

   var softCeil;
   if ( isRGB ) {
      var cs0 = sampleChannel( image, 0, 500000 );
      var cs1 = sampleChannel( image, 1, 500000 );
      var cs2 = sampleChannel( image, 2, 500000 );
      softCeil = Math.max( percentile( cs0, 99 ),
                           percentile( cs1, 99 ),
                           percentile( cs2, 99 ) );
   } else {
      softCeil = percentile( sampleChannel( image, 0, 200000 ), 99 );
   }
   if ( softCeil <= globalFloor ) softCeil = globalFloor + 1e-6;
   if ( absMax  <= softCeil )     absMax  = softCeil  + 1e-6;

   var scaleContrast = ( 0.98 - PEDESTAL ) / ( softCeil - globalFloor + 1e-9 );
   var finalScale;
   if ( validPhysical ) {
      var scalePhys = ( 1.0 - PEDESTAL ) / ( absMax - globalFloor + 1e-9 );
      finalScale = Math.min( scaleContrast, scalePhys );
   } else {
      finalScale = scaleContrast;
   }

   for ( let c = 0; c < nc; ++c ) {
      var I = new ImageIterator( image, c );
      for ( let y = 0; y < h; ++y ) {
         var row = I[y];
         for ( let x = 0; x < w; ++x ) {
            var v = ( row[x] - globalFloor ) * finalScale + PEDESTAL;
            row[x] = v < 0 ? 0 : ( v > 1 ? 1 : v );
         }
      }
   }

   var lumas2 = sampleLuminance( image, weights, 500000 );
   var currentBg = percentile( lumas2, 50 );
   if ( currentBg > 0 && currentBg < 1 && Math.abs( currentBg - targetBg ) > 1e-3 ) {
      var m = ( currentBg * ( targetBg - 1.0 ) ) /
              ( currentBg * ( 2.0 * targetBg - 1.0 ) - targetBg );
      for ( let c = 0; c < nc; ++c ) {
         var I = new ImageIterator( image, c );
         for ( let y = 0; y < h; ++y ) {
            var row = I[y];
            for ( let x = 0; x < w; ++x ) row[x] = applyMTF( row[x], m );
         }
      }
   }
}

function applySoftClip( image, threshold, rolloff ) {
   var nc = image.numberOfChannels;
   var range = 1.0 - threshold;
   for ( let c = 0; c < nc; ++c ) {
      var I = new ImageIterator( image, c );
      var H = I.height, W = I.width;
      for ( let y = 0; y < H; ++y ) {
         var row = I[y];
         for ( let x = 0; x < W; ++x ) {
            var v = row[x];
            if ( v > threshold ) {
               var t = ( v - threshold ) / ( range + 1e-9 );
               if ( t < 0 ) t = 0; else if ( t > 1 ) t = 1;
               v = threshold + range * ( 1.0 - Math.pow( 1.0 - t, rolloff ) );
            }
            row[x] = v < 0 ? 0 : ( v > 1 ? 1 : v );
         }
      }
   }
}

// =============================================================================
// PROXY BUILDER (downsamples a source image for fast preview).
// =============================================================================

function buildProxyImage( srcImage, maxDim ) {
   var nc = srcImage.numberOfChannels;
   var isRGB = ( nc >= 3 );
   var proxy = new Image( srcImage.width, srcImage.height, nc,
      isRGB ? ColorSpace.RGB : ColorSpace.Gray,
      32, PixelSampleType.Float );
   proxy.assign( srcImage );

   var mx = proxy.maximum();
   if ( mx > 1.1 ) {
      var divisor = ( mx < 100000.0 ) ? 65535.0 : 4294967295.0;
      proxy.apply( 1.0 / divisor, ImageOp.Mul );
   }
   proxy.truncate( 0.0, proxy.maximum() );

   var longest = Math.max( proxy.width, proxy.height );
   if ( longest > maxDim ) {
      proxy.resample( maxDim / longest );
   }
   return proxy;
}

// =============================================================================
// SOURCE PRE-ANALYSIS — full-resolution statistics for proxy preview parity.
// Returns { anchor, rtu: { validPhysical, absMax } | null }
// =============================================================================

function preAnalyzeSource( srcImage, weights, useAdaptive, isReadyMode, logD, protectB ) {
   var nc = srcImage.numberOfChannels;
   var isRGB = ( nc >= 3 );

   // Need a float-32 normalized image for ImageIterator + analysis helpers.
   var work, ownWork = false;
   if ( srcImage.isReal && srcImage.bitsPerSample === 32 && srcImage.maximum() <= 1.1 ) {
      work = srcImage;
   } else {
      work = new Image( srcImage.width, srcImage.height, nc,
         isRGB ? ColorSpace.RGB : ColorSpace.Gray, 32, PixelSampleType.Float );
      work.assign( srcImage );
      var mx = work.maximum();
      if ( mx > 1.1 ) {
         var divisor = ( mx < 100000.0 ) ? 65535.0 : 4294967295.0;
         work.apply( 1.0 / divisor, ImageOp.Mul );
      }
      work.truncate( 0.0, work.maximum() );
      ownWork = true;
   }

   var anchor = useAdaptive
      ? calculateAnchorAdaptive( work, weights )
      : calculateAnchorStatistical( work );

   var rtu = null;
   if ( isReadyMode ) {
      // Hyperbolic constants shared with the actual stretch.
      var D = Math.pow( 10.0, logD );
      var b = protectB;
      if ( D < 0.1 ) D = 0.1;
      if ( b < 0.1 ) b = 0.1;
      var t2 = Math.asinh( b );
      var norm = Math.asinh( D + b ) - t2;
      if ( Math.abs( norm ) < 1e-12 ) norm = 1e-6;

      // Pedestal applied at the end of color reconstruction.
      function srcLumaToResultLuma( srcL ) {
         var v = srcL - anchor; if ( v < 0 ) v = 0;
         var s = ( Math.asinh( D * v + b ) - t2 ) / norm;
         if ( s < 0 ) s = 0; else if ( s > 1 ) s = 1;
         return s * 0.995 + 0.005;
      }

      var w = work.width, h = work.height;
      var absMaxSrc = -Infinity, xMax = 0, yMax = 0;

      if ( isRGB ) {
         var Ir = new ImageIterator( work, 0 );
         var Ig = new ImageIterator( work, 1 );
         var Ib = new ImageIterator( work, 2 );
         var wr = weights[0], wg = weights[1], wb = weights[2];
         for ( let y = 0; y < h; ++y ) {
            var ir = Ir[y], ig = Ig[y], ib = Ib[y];
            for ( let x = 0; x < w; ++x ) {
               var L = wr * ir[x] + wg * ig[x] + wb * ib[x];
               if ( L > absMaxSrc ) { absMaxSrc = L; xMax = x; yMax = y; }
            }
         }
      } else {
         var Im = new ImageIterator( work, 0 );
         for ( let y = 0; y < h; ++y ) {
            var im = Im[y];
            for ( let x = 0; x < w; ++x )
               if ( im[x] > absMaxSrc ) { absMaxSrc = im[x]; xMax = x; yMax = y; }
         }
      }

      var absMaxResult = srcLumaToResultLuma( absMaxSrc );
      var validPhysical = true;

      if ( absMaxResult > 0.001 ) {
         var y0 = Math.max( 0, yMax - 1 ), y1 = Math.min( h, yMax + 2 );
         var x0 = Math.max( 0, xMax - 1 ), x1 = Math.min( w, xMax + 2 );
         var maxNeighborResult = -Infinity, anyNeighbor = false;

         if ( isRGB ) {
            var Ir2 = new ImageIterator( work, 0 );
            var Ig2 = new ImageIterator( work, 1 );
            var Ib2 = new ImageIterator( work, 2 );
            var wr2 = weights[0], wg2 = weights[1], wb2 = weights[2];
            for ( let y = y0; y < y1; ++y ) {
               var ir = Ir2[y], ig = Ig2[y], ib = Ib2[y];
               for ( let x = x0; x < x1; ++x ) {
                  var Lsrc = wr2 * ir[x] + wg2 * ig[x] + wb2 * ib[x];
                  if ( Lsrc < absMaxSrc ) {
                     anyNeighbor = true;
                     var Lres = srcLumaToResultLuma( Lsrc );
                     if ( Lres > maxNeighborResult ) maxNeighborResult = Lres;
                  }
               }
            }
         } else {
            var Im2 = new ImageIterator( work, 0 );
            for ( let y = y0; y < y1; ++y ) {
               var im = Im2[y];
               for ( let x = x0; x < x1; ++x ) {
                  var Lsrc = im[x];
                  if ( Lsrc < absMaxSrc ) {
                     anyNeighbor = true;
                     var Lres = srcLumaToResultLuma( Lsrc );
                     if ( Lres > maxNeighborResult ) maxNeighborResult = Lres;
                  }
               }
            }
         }

         if ( anyNeighbor && maxNeighborResult < ( absMaxResult * 0.20 ) )
            validPhysical = false;
      }

      rtu = { validPhysical: validPhysical, absMax: absMaxResult };
   }

   if ( ownWork ) work.free();

   return { anchor: anchor, rtu: rtu };
}

// =============================================================================
// MAIN PIPELINE — operates on an Image, returns a new Image.
// =============================================================================

function processVeraLux( srcImage, opts ) {
   opts = opts || {};
   var silent = opts.silent === true;
   var assumeNormalized = opts.assumeNormalized === true;
   var anchorOverride = opts.anchor;          // optional: number
   var rtuOverrides   = opts.rtuOverrides;    // optional: {validPhysical, absMax}
   var log = silent ? function() {} : function() {
      console.writeln.apply( console, arguments );
      console.flush();
   };

   var w  = srcImage.width;
   var h  = srcImage.height;
   var nc = srcImage.numberOfChannels;
   var isRGB = ( nc >= 3 );

   var work;
   if ( assumeNormalized && srcImage.isReal && srcImage.bitsPerSample === 32 ) {
      work = new Image( srcImage );      // direct clone, already normalized [0,1]
   } else {
      work = new Image( w, h, nc,
         isRGB ? ColorSpace.RGB : ColorSpace.Gray,
         32, PixelSampleType.Float );
      work.assign( srcImage );
      var maxV = work.maximum();
      if ( maxV > 1.1 ) {
         var divisor = ( maxV < 100000.0 ) ? 65535.0 : 4294967295.0;
         work.apply( 1.0 / divisor, ImageOp.Mul );
      }
      work.truncate( 0.0, work.maximum() );
   }

   var weights = profileWeights( parameters.profileIndex );

   var anchor;
   if ( anchorOverride !== undefined ) {
      anchor = anchorOverride;
      log( "VeraLux: anchor (from source) = ", anchor.toFixed( 6 ) );
   } else {
      log( "<b>VeraLux:</b> Computing ", parameters.adaptiveAnchor ? "adaptive" : "statistical", " anchor..." );
      anchor = parameters.adaptiveAnchor
         ? calculateAnchorAdaptive( work, weights )
         : calculateAnchorStatistical( work );
      log( "VeraLux: anchor = ", anchor.toFixed( 6 ) );
   }

   var D = Math.pow( 10.0, parameters.logD );
   var b = parameters.protectB;

   var lumStr = new Image( w, h, 1, ColorSpace.Gray, 32, PixelSampleType.Float );

   log( "VeraLux: hyperbolic stretch (LogD=", parameters.logD.toFixed( 2 ),
        ", b=", b.toFixed( 2 ), ")..." );
   buildStretchedLuminance( work, lumStr, anchor, D, b, weights, isRGB );

   var eff = parameters.effectiveGripAndShadow();
   if ( parameters.mode === parameters.MODE_SCIENTIFIC && eff.linexp > 0.001 ) {
      log( "VeraLux: linear expansion (factor=", eff.linexp.toFixed( 2 ), ")..." );
      applyLinearExpansion( lumStr, eff.linexp );
   }

   var result = new Image( w, h, nc,
      isRGB ? ColorSpace.RGB : ColorSpace.Gray,
      32, PixelSampleType.Float );

   log( "VeraLux: color reconstruction (conv=", parameters.convergence.toFixed( 2 ),
        ", grip=", eff.grip.toFixed( 2 ), ", shadow=", eff.shadow.toFixed( 2 ), ")..." );
   reconstructColor( work, lumStr, result, anchor, D, b, weights,
                     parameters.convergence, eff.grip, eff.shadow, isRGB );

   work.free();
   lumStr.free();

   if ( parameters.mode === parameters.MODE_READY ) {
      log( "VeraLux: adaptive output scaling (targetBg=",
           parameters.targetBg.toFixed( 3 ), ")..." );
      adaptiveOutputScaling( result, weights, parameters.targetBg, rtuOverrides );

      log( "VeraLux: soft-clip polish (threshold=0.98, rolloff=2.0)..." );
      applySoftClip( result, 0.98, 2.0 );
   }

   log( "<b>VeraLux: stretch complete.</b>" );

   return result;
}

// =============================================================================
// AUTO-SOLVER (Smart Iterative "Floating Sky" solver from Python 1.5.2)
// =============================================================================

function runAutoSolver() {
   if ( parameters.targetView == null || !parameters.targetView.isMainView ) {
      ( new MessageBox(
         "<p>Please select a target view first.</p>",
         TITLE, StdIcon.Warning, StdButton.Ok
      ) ).execute();
      return;
   }

   console.show();
   console.writeln( "<b>VeraLux:</b> Auto-Solver started." );
   console.flush();

   var weights = profileWeights( parameters.profileIndex );
   var srcImage = parameters.targetView.image;
   var nc  = srcImage.numberOfChannels;
   var isRGB = ( nc >= 3 );

   var work = new Image( srcImage.width, srcImage.height, nc,
      isRGB ? ColorSpace.RGB : ColorSpace.Gray, 32, PixelSampleType.Float );
   work.assign( srcImage );
   var mx = work.maximum();
   if ( mx > 1.1 ) {
      var divisor = ( mx < 100000.0 ) ? 65535.0 : 4294967295.0;
      work.apply( 1.0 / divisor, ImageOp.Mul );
   }
   work.truncate( 0.0, work.maximum() );

   var anchor = parameters.adaptiveAnchor
      ? calculateAnchorAdaptive( work, weights )
      : calculateAnchorStatistical( work );

   var w = work.width, h = work.height, n = w * h;
   var stride = Math.max( 1, Math.floor( n / 100000 ) );
   var lumas = [];
   if ( isRGB ) {
      var Ir = new ImageIterator( work, 0 );
      var Ig = new ImageIterator( work, 1 );
      var Ib = new ImageIterator( work, 2 );
      var wr = weights[0], wg = weights[1], wb = weights[2];
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         var r = Ir[y][x] - anchor; if ( r < 0 ) r = 0;
         var g = Ig[y][x] - anchor; if ( g < 0 ) g = 0;
         var bv = Ib[y][x] - anchor; if ( bv < 0 ) bv = 0;
         var L = wr * r + wg * g + wb * bv;
         if ( L > 1e-7 ) lumas.push( L );
      }
   } else {
      var Im = new ImageIterator( work, 0 );
      for ( let i = 0; i < n; i += stride ) {
         var x = i % w, y = ( i / w ) | 0;
         var v = Im[y][x] - anchor;
         if ( v > 1e-7 ) lumas.push( v );
      }
   }
   work.free();

   if ( lumas.length === 0 ) {
      console.writeln( "VeraLux: no valid signal — defaulting LogD to 2.0." );
      console.flush();
      parameters.logD = 2.0;
      parameters.dialog.refreshControlsFromParameters();
      return;
   }

   lumas.sort( sortAscending );
   var medianIn = percentile( lumas, 50 );

   var target = parameters.targetBg;
   var bestLogD = 2.0;
   var bVal = parameters.protectB;

   for ( let iter = 0; iter < 15; ++iter ) {
      bestLogD = solveLogD( medianIn, target, bVal );

      if ( parameters.mode !== parameters.MODE_READY ) break;

      var D = Math.pow( 10.0, bestLogD );
      var mean = 0, minV = 1.0;
      var nL = lumas.length;
      var strSamples = new Float64Array( nL );
      for ( let k = 0; k < nL; ++k ) {
         var s = hyperbolicStretch( lumas[k], D, bVal, 0.0 );
         strSamples[k] = s;
         mean += s;
         if ( s < minV ) minV = s;
      }
      mean /= nL;
      var std = 0;
      for ( let k = 0; k < nL; ++k ) { var d = strSamples[k] - mean; std += d * d; }
      std = Math.sqrt( std / nL );
      var copy = Array.from( strSamples ).sort( sortAscending );
      var med  = percentile( copy, 50 );

      var globalFloor = Math.max( minV, med - 2.7 * std );
      if ( globalFloor <= 0.001 ) break;

      target -= 0.015;
      if ( target < 0.05 ) break;
   }

   parameters.logD = Math.max( 0.0, Math.min( 7.0, bestLogD ) );
   parameters.dialog.refreshControlsFromParameters();

   console.writeln( "<b>VeraLux:</b> Auto-Solver result: LogD = ",
                    parameters.logD.toFixed( 2 ) );
   console.flush();

   parameters.dialog._schedulePreview();
}

// =============================================================================
// PROCESS (apply stretch to the target view, in place)
// =============================================================================

function runProcess() {
   if ( parameters.targetView == null || !parameters.targetView.isMainView ) {
      ( new MessageBox(
         "<p>Please select a target view first.</p>",
         TITLE, StdIcon.Warning, StdButton.Ok
      ) ).execute();
      return;
   }
   if ( !parameters.targetView.image.isReal &&
        parameters.targetView.image.bitsPerSample < 16 ) {
      var mb = new MessageBox(
         "<p>The target view is 8-bit. The stretch will be computed in 32-bit\n" +
         "float and then assigned back, but quantization will reduce quality.</p>" +
         "<p>Continue?</p>",
         TITLE, StdIcon.Warning, StdButton.Yes, StdButton.Cancel );
      if ( mb.execute() !== StdButton.Yes ) return;
   }

   console.show();
   var t0 = new Date();

   var result;
   try {
      result = processVeraLux( parameters.targetView.image );
   } catch ( e ) {
      console.criticalln( "VeraLux processing error: ", e.toString() );
      ( new MessageBox(
         "<p>Processing error: " + e.toString() + "</p>",
         TITLE, StdIcon.Error, StdButton.Ok
      ) ).execute();
      return;
   }

   try {
      parameters.targetView.beginProcess( UndoFlag.NoSwapFile );
      parameters.targetView.image.assign( result );
      parameters.targetView.endProcess();
   } finally {
      result.free();
   }

   var dt = ( new Date().getTime() - t0.getTime() ) * 0.001;
   console.writeln( format( "VeraLux: total time %.2f s", dt ) );
   console.flush();

   // Invalidate proxy and refresh preview to show the result.
   if ( parameters.dialog ) parameters.dialog.invalidateProxy();
   if ( parameters.dialog ) parameters.dialog.refreshPreview();
}

// =============================================================================
// EMBEDDED PREVIEW (ScrollBox with zoom / pan / fit / 1:1)
// =============================================================================

// Cursor codes from PJSR StdCursor enum (stable PCL integer values).
const CURSOR_CROSS       = 13;
const CURSOR_CLOSED_HAND = 28;

var PreviewScrollBox = class extends ScrollBox {
   constructor( parent ) {
      super( parent );

      this.bitmap          = null;
      this.zoomFactor      = 1.0;
      this.minZoom         = 0.05;
      this.maxZoom         = 16.0;
      this.dragging        = false;
      this.dragOrigin      = new Point( 0, 0 );
      this.dragScrollStart = new Point( 0, 0 );
      this.onPixelMove     = null;   // optional callback(ix, iy, bitmap)

      this.autoScroll = true;
      this.tracking   = true;
      this.cursor     = new Cursor( CURSOR_CROSS );

      let self = this;

      this.onHorizontalScrollPosUpdated = function() { this.viewport.update(); };
      this.onVerticalScrollPosUpdated   = function() { this.viewport.update(); };

      this.viewport.onResize = function() { self._updateScrollRange(); };

      this.viewport.onMousePress = function( x, y, button ) {
         // button is a MouseButton enum: 1 = Left.
         if ( ( button & 1 ) === 0 ) return;
         self.dragging = true;
         self.dragOrigin = new Point( x, y );
         self.dragScrollStart = new Point(
            self.horizontalScrollPosition,
            self.verticalScrollPosition );
         this.cursor = new Cursor( CURSOR_CLOSED_HAND );
      };

      this.viewport.onMouseRelease = function() {
         self.dragging = false;
         this.cursor = new Cursor( CURSOR_CROSS );
      };

      this.viewport.onMouseMove = function( x, y ) {
         if ( self.dragging ) {
            self.horizontalScrollPosition =
               self.dragScrollStart.x + ( self.dragOrigin.x - x );
            self.verticalScrollPosition =
               self.dragScrollStart.y + ( self.dragOrigin.y - y );
         } else if ( self.bitmap && self.onPixelMove ) {
            var ix = Math.floor( ( x + self.horizontalScrollPosition ) / self.zoomFactor );
            var iy = Math.floor( ( y + self.verticalScrollPosition   ) / self.zoomFactor );
            self.onPixelMove( ix, iy, self.bitmap );
         }
      };

      this.viewport.onMouseWheel = function( x, y, delta ) {
         var oldZ = self.zoomFactor;
         var newZ = ( delta > 0 )
            ? Math.min( oldZ * 1.25, self.maxZoom )
            : Math.max( oldZ * 0.8,  self.minZoom );
         if ( newZ === oldZ ) return;
         self._zoomAt( newZ, x, y );
      };

      this.viewport.onPaint = function( x0, y0, x1, y1 ) {
         var g = new Graphics( this );
         g.fillRect( x0, y0, x1, y1, new Brush( 0xff181818 ) );
         if ( self.bitmap ) {
            var bw = Math.round( self.bitmap.width  * self.zoomFactor );
            var bh = Math.round( self.bitmap.height * self.zoomFactor );
            var dx = ( self.maxHorizontalScrollPosition > 0 )
               ? -self.horizontalScrollPosition
               : Math.floor( ( this.width  - bw ) / 2 );
            var dy = ( self.maxVerticalScrollPosition > 0 )
               ? -self.verticalScrollPosition
               : Math.floor( ( this.height - bh ) / 2 );
            g.drawScaledBitmap( new Rect( dx, dy, dx + bw, dy + bh ), self.bitmap );
            g.pen = new Pen( 0xff444444, 0 );
            g.drawRect( dx - 1, dy - 1, dx + bw, dy + bh );
         }
         g.end();
      };
   }

   _updateScrollRange() {
      if ( !this.bitmap ) {
         this.setHorizontalScrollRange( 0, 0 );
         this.setVerticalScrollRange( 0, 0 );
      } else {
         var bw = Math.round( this.bitmap.width  * this.zoomFactor );
         var bh = Math.round( this.bitmap.height * this.zoomFactor );
         this.setHorizontalScrollRange( 0, Math.max( 0, bw - this.viewport.width ) );
         this.setVerticalScrollRange  ( 0, Math.max( 0, bh - this.viewport.height ) );
      }
      this.viewport.update();
   }

   _zoomAt( newZ, vx, vy ) {
      // Keep the (vx,vy) viewport point anchored to the same image pixel.
      var ratio = newZ / this.zoomFactor;
      this.zoomFactor = newZ;
      this._updateScrollRange();
      this.horizontalScrollPosition = Math.max( 0,
         ( this.horizontalScrollPosition + vx ) * ratio - vx );
      this.verticalScrollPosition = Math.max( 0,
         ( this.verticalScrollPosition + vy ) * ratio - vy );
   }

   setBitmap( bmp ) {
      if ( this.bitmap ) this.bitmap.clear();
      this.bitmap = bmp;
      this._updateScrollRange();
   }

   clearBitmap() {
      if ( this.bitmap ) { this.bitmap.clear(); this.bitmap = null; }
      this._updateScrollRange();
   }

   zoomIn() {
      var n = Math.min( this.zoomFactor * 1.25, this.maxZoom );
      this._zoomAt( n, Math.floor( this.viewport.width / 2 ),
                       Math.floor( this.viewport.height / 2 ) );
   }

   zoomOut() {
      var n = Math.max( this.zoomFactor * 0.8, this.minZoom );
      this._zoomAt( n, Math.floor( this.viewport.width / 2 ),
                       Math.floor( this.viewport.height / 2 ) );
   }

   zoom1to1() {
      this.zoomFactor = 1.0;
      this.horizontalScrollPosition = 0;
      this.verticalScrollPosition   = 0;
      this._updateScrollRange();
   }

   zoomFit() {
      if ( !this.bitmap ) return;
      var sx = this.viewport.width  / this.bitmap.width;
      var sy = this.viewport.height / this.bitmap.height;
      var z = Math.min( sx, sy );
      z = Math.max( this.minZoom, Math.min( this.maxZoom, z ) );
      this.zoomFactor = z;
      this.horizontalScrollPosition = 0;
      this.verticalScrollPosition   = 0;
      this._updateScrollRange();
   }
};

// =============================================================================
// DIALOG
// =============================================================================

var VeraLuxDialog = class extends Dialog {
   constructor() {
      super();

      var self = this;
      this.windowTitle = TITLE + " v" + VERSION;

      // Preview proxy cache (downsampled, float-32). Lazily built.
      this._proxyImage   = null;
      this._proxyViewKey = null;   // tracks which view the proxy was built from

      // Debounce timer for auto-preview. interval is in seconds.
      this._previewTimer = new Timer;
      this._previewTimer.periodic = false;
      this._previewTimer.interval = 0.25;
      this._previewTimer.onTimeout = function() {
         try { self.refreshPreview(); }
         catch ( e ) { console.criticalln( "Auto-preview: ", e.toString() ); }
      };

      // ----- Title --------------------------------------------------------
      this.titleLabel = new Label( this );
      this.titleLabel.text = TITLE + "  v" + VERSION;
      this.titleLabel.styleSheet = "QLabel { font-size: 11pt; font-weight: bold; color: #88aaff; }";
      this.titleLabel.textAlignment = TextAlignment.Center;

      this.reqLabel = new Label( this );
      this.reqLabel.text = "Requirement: LINEAR data, color-calibrated (SPCC).";
      this.reqLabel.styleSheet = "QLabel { color: #999999; font-style: italic; }";
      this.reqLabel.textAlignment = TextAlignment.Center;

      // ----- Target view list ---------------------------------------------
      this.viewList = new ViewList( this );
      this.viewListNullCurrentView = this.viewList.currentView;
      this.viewList.getMainViews();
      if ( ImageWindow.activeWindow != null &&
           !ImageWindow.activeWindow.isNull &&
           ImageWindow.activeWindow.currentView.isMainView ) {
         parameters.targetView = ImageWindow.activeWindow.currentView;
         this.viewList.currentView = parameters.targetView;
      }
      this.viewList.onViewSelected = function( view ) {
         parameters.targetView = view;
         self.invalidateProxy();
         self.previewBox.clearBitmap();
         self.pixelLabel.text = "Pixel: —";
         self._schedulePreview();
      };
      this.viewListGroup = new GroupBox( this );
      this.viewListGroup.title = "Target view";
      this.viewListGroup.sizer = new VerticalSizer;
      this.viewListGroup.sizer.margin = 6;
      this.viewListGroup.sizer.add( this.viewList );

      // ----- Mode group ----------------------------------------------------
      this.modeGroup = new GroupBox( this );
      this.modeGroup.title = "1. Processing mode";
      this.modeGroup.sizer = new VerticalSizer;
      this.modeGroup.sizer.margin = 6;
      this.modeGroup.sizer.spacing = 4;

      this.radioReady = new RadioButton( this );
      this.radioReady.text = "Ready-to-Use (aesthetic)";
      this.radioReady.toolTip =
         "<p><b>Ready-to-Use Mode</b><br>Aesthetic, export-ready output. " +
         "Adds Smart-Max adaptive scaling, linked MTF to Target Bg, and " +
         "soft-clips highlights.</p>";

      this.radioScientific = new RadioButton( this );
      this.radioScientific.text = "Scientific (preserve)";
      this.radioScientific.toolTip =
         "<p><b>Scientific Mode</b><br>Mathematically pure output. Clips " +
         "only at physical saturation. Exposes Linear Expansion, Color " +
         "Grip and Shadow Convergence.</p>";

      this.modeGroup.sizer.add( this.radioReady );
      this.modeGroup.sizer.add( this.radioScientific );

      this.modeInfo = new Label( this );
      this.modeInfo.styleSheet = "QLabel { color: #888888; font-size: 9pt; }";
      this.modeGroup.sizer.add( this.modeInfo );

      this.radioReady.onClick      = function() { parameters.mode = parameters.MODE_READY;      self.applyModeUI(); self._schedulePreview(); };
      this.radioScientific.onClick = function() { parameters.mode = parameters.MODE_SCIENTIFIC; self.applyModeUI(); self._schedulePreview(); };

      // ----- Sensor group --------------------------------------------------
      this.sensorGroup = new GroupBox( this );
      this.sensorGroup.title = "2. Sensor calibration";
      this.sensorGroup.sizer = new VerticalSizer;
      this.sensorGroup.sizer.margin = 6;
      this.sensorGroup.sizer.spacing = 4;

      this.sensorCombo = new ComboBox( this );
      for ( let i = 0; i < SENSOR_PROFILES.length; ++i )
         this.sensorCombo.addItem( profileLabel( i ) );
      this.sensorCombo.toolTip =
         "<p><b>Sensor Profile</b><br>Defines the luminance weights " +
         "used for the stretch. Rec.709 for general use.</p>";
      this.sensorCombo.onItemSelected = function( idx ) {
         parameters.profileIndex = idx;
         self.refreshSensorInfo();
         self._schedulePreview();
      };

      this.sensorInfo = new Label( this );
      this.sensorInfo.styleSheet = "QLabel { color: #888888; font-size: 9pt; }";
      this.sensorInfo.wordWrapping = true;

      this.sensorGroup.sizer.add( this.sensorCombo );
      this.sensorGroup.sizer.add( this.sensorInfo );

      // ----- Stretch engine ------------------------------------------------
      this.engineGroup = new GroupBox( this );
      this.engineGroup.title = "3. Stretch engine & calibration";
      this.engineGroup.sizer = new VerticalSizer;
      this.engineGroup.sizer.margin = 6;
      this.engineGroup.sizer.spacing = 4;

      this.calibRow = new HorizontalSizer;
      this.calibRow.spacing = 6;

      this.targetBgNC = new NumericControl( this );
      this.targetBgNC.label.text = "Target Bg:";
      this.targetBgNC.label.minWidth = 90;
      this.targetBgNC.setRange( 0.05, 0.50 );
      this.targetBgNC.setPrecision( 2 );
      // NumericControl rounds the slider-derived value to trunc(log10(sliderDelta))
      // decimals; sliderDelta=450 → 2-decimal rounding, giving clean 0.01 steps.
      this.targetBgNC.slider.setRange( 0, 450 );
      this.targetBgNC.setValue( parameters.targetBg );
      this.targetBgNC.toolTip =
         "<p><b>Target Background (median)</b><br>Desired median for the " +
         "sky background after stretch. 0.20 is standard; 0.12 for " +
         "high-contrast dark skies.</p>";
      this.targetBgNC.onValueUpdated = function( v ) { parameters.targetBg = v; self._schedulePreview(); };

      this.adaptiveCheck = new CheckBox( this );
      this.adaptiveCheck.text = "Adaptive Anchor";
      this.adaptiveCheck.checked = parameters.adaptiveAnchor;
      this.adaptiveCheck.toolTip =
         "<p><b>Adaptive Anchor</b><br>Histogram-shape analysis (vs. fixed " +
         "percentile). Default ON.</p>";
      this.adaptiveCheck.onCheck = function( c ) { parameters.adaptiveAnchor = c; self._schedulePreview(); };

      this.autoCalcButton = new PushButton( this );
      this.autoCalcButton.text = "Auto-Calc Log D";
      this.autoCalcButton.toolTip =
         "<p><b>Auto-Solver</b><br>Finds the stretch factor (Log D) that " +
         "places the current background median at Target Bg. In Ready-to-Use " +
         "mode, the solver iteratively re-targets to avoid black clipping.</p>";
      this.autoCalcButton.onClick = function() {
         try { runAutoSolver(); }
         catch ( e ) { console.criticalln( "Auto-Solver: ", e.toString() ); }
      };

      // Target Bg gets its own row so its slider runs the full width of the
      // group, matching Log D and Protect b below.
      this.engineGroup.sizer.add( this.targetBgNC );

      // Adaptive Anchor + Auto-Calc share a secondary row.
      this.calibRow.add( this.adaptiveCheck );
      this.calibRow.addStretch();
      this.calibRow.add( this.autoCalcButton );

      this.engineGroup.sizer.add( this.calibRow );

      this.logDNC = new NumericControl( this );
      this.logDNC.label.text = "Log D:";
      this.logDNC.label.minWidth = 90;
      this.logDNC.setRange( 0.0, 7.0 );
      this.logDNC.setPrecision( 2 );
      this.logDNC.setValue( parameters.logD );
      this.logDNC.toolTip =
         "<p><b>Hyperbolic intensity (Log D)</b><br>Stretch strength. " +
         "Higher = brighter.</p>";
      this.logDNC.onValueUpdated = function( v ) { parameters.logD = v; self._schedulePreview(); };
      this.engineGroup.sizer.add( this.logDNC );

      this.protectBNC = new NumericControl( this );
      this.protectBNC.label.text = "Protect b:";
      this.protectBNC.label.minWidth = 90;
      this.protectBNC.setRange( 0.1, 15.0 );
      this.protectBNC.setPrecision( 2 );
      this.protectBNC.setValue( parameters.protectB );
      this.protectBNC.toolTip =
         "<p><b>Highlight protection (b)</b><br>Knee of the hyperbolic " +
         "curve. Higher = preserves star cores and highlights.</p>";
      this.protectBNC.onValueUpdated = function( v ) { parameters.protectB = v; self._schedulePreview(); };
      this.engineGroup.sizer.add( this.protectBNC );

      // ----- Physics & color engine ---------------------------------------
      this.physicsGroup = new GroupBox( this );
      this.physicsGroup.title = "4. Physics & color engine";
      this.physicsGroup.sizer = new VerticalSizer;
      this.physicsGroup.sizer.margin = 6;
      this.physicsGroup.sizer.spacing = 4;

      this.convergenceNC = new NumericControl( this );
      this.convergenceNC.label.text = "Star Core Recovery:";
      this.convergenceNC.label.minWidth = 140;
      this.convergenceNC.setRange( 1.0, 10.0 );
      this.convergenceNC.setPrecision( 2 );
      this.convergenceNC.setValue( parameters.convergence );
      this.convergenceNC.toolTip =
         "<p><b>Color Convergence</b><br>How quickly saturated colors " +
         "transition to white. Higher = faster (avoids color artifacts).</p>";
      this.convergenceNC.onValueUpdated = function( v ) { parameters.convergence = v; self._schedulePreview(); };
      this.physicsGroup.sizer.add( this.convergenceNC );

      this.readyContainer = new Control( this );
      this.readyContainer.sizer = new VerticalSizer;
      this.readyContainer.sizer.margin = 0;
      this.readyContainer.sizer.spacing = 4;

      this.strategyNC = new NumericControl( this );
      this.strategyNC.label.text = "Color Strategy:";
      this.strategyNC.label.minWidth = 140;
      this.strategyNC.setRange( -100, 100 );
      this.strategyNC.setReal( false );
      this.strategyNC.setValue( parameters.strategy );
      this.strategyNC.toolTip =
         "<p><b>Unified Color Strategy</b> (Ready-to-Use)<br>" +
         "• <b>Center (0):</b> Balanced (pure vector).<br>" +
         "• <b>Left (&lt;0):</b> Clean noise — increases Shadow Convergence.<br>" +
         "• <b>Right (&gt;0):</b> Soften highlights — decreases Color Grip.</p>";
      this.strategyNC.onValueUpdated = function( v ) {
         parameters.strategy = v | 0;
         self.refreshStrategyFeedback();
         self._schedulePreview();
      };
      this.readyContainer.sizer.add( this.strategyNC );

      this.strategyFeedback = new Label( this );
      this.strategyFeedback.styleSheet = "QLabel { color: #888888; font-size: 9pt; font-style: italic; }";
      this.readyContainer.sizer.add( this.strategyFeedback );

      this.scientificContainer = new Control( this );
      this.scientificContainer.sizer = new VerticalSizer;
      this.scientificContainer.sizer.margin = 0;
      this.scientificContainer.sizer.spacing = 4;

      this.linearExpansionNC = new NumericControl( this );
      this.linearExpansionNC.label.text = "Linear Expansion:";
      this.linearExpansionNC.label.minWidth = 140;
      this.linearExpansionNC.setRange( 0.0, 1.0 );
      this.linearExpansionNC.setPrecision( 2 );
      this.linearExpansionNC.setValue( parameters.linearExpansion );
      this.linearExpansionNC.toolTip =
         "<p><b>Linear Expansion</b> (Scientific only)<br>" +
         "Normalizes data to fill the dynamic range [0,1] via Smart-Max " +
         "high-limit detection (preserves star cores, rejects hot pixels).</p>";
      this.linearExpansionNC.onValueUpdated = function( v ) { parameters.linearExpansion = v; self._schedulePreview(); };
      this.scientificContainer.sizer.add( this.linearExpansionNC );

      this.gripNC = new NumericControl( this );
      this.gripNC.label.text = "Color Grip:";
      this.gripNC.label.minWidth = 140;
      this.gripNC.setRange( 0.0, 1.0 );
      this.gripNC.setPrecision( 2 );
      this.gripNC.setValue( parameters.colorGrip );
      this.gripNC.toolTip =
         "<p><b>Color Grip</b><br>" +
         "• <b>1.00:</b> Pure VeraLux. 100% vector lock.<br>" +
         "• <b>&lt;1.00:</b> Blends with scalar stretch — softens cores.</p>";
      this.gripNC.onValueUpdated = function( v ) { parameters.colorGrip = v; self._schedulePreview(); };
      this.scientificContainer.sizer.add( this.gripNC );

      this.shadowNC = new NumericControl( this );
      this.shadowNC.label.text = "Shadow Convergence:";
      this.shadowNC.label.minWidth = 140;
      this.shadowNC.setRange( 0.0, 3.0 );
      this.shadowNC.setPrecision( 2 );
      this.shadowNC.setValue( parameters.shadowConvergence );
      this.shadowNC.toolTip =
         "<p><b>Shadow Convergence</b><br>Damps vector preservation in " +
         "shadows to prevent chromatic noise bloom.</p>";
      this.shadowNC.onValueUpdated = function( v ) { parameters.shadowConvergence = v; self._schedulePreview(); };
      this.scientificContainer.sizer.add( this.shadowNC );

      this.physicsGroup.sizer.add( this.readyContainer );
      this.physicsGroup.sizer.add( this.scientificContainer );

      // ----- LEFT COLUMN (controls) ---------------------------------------
      this.leftColumn = new Control( this );
      this.leftColumn.sizer = new VerticalSizer;
      this.leftColumn.sizer.spacing = 6;
      this.leftColumn.sizer.add( this.viewListGroup );
      this.leftColumn.sizer.add( this.modeGroup );
      this.leftColumn.sizer.add( this.sensorGroup );
      this.leftColumn.sizer.add( this.engineGroup );
      this.leftColumn.sizer.add( this.physicsGroup );
      this.leftColumn.sizer.addStretch();
      this.leftColumn.setMinWidth( this.logicalPixelsToPhysical( 430 ) );
      this.leftColumn.setMaxWidth( this.logicalPixelsToPhysical( 520 ) );

      // ----- PREVIEW PANE -------------------------------------------------
      this.previewToolbar = new HorizontalSizer;
      this.previewToolbar.spacing = 4;

      this.zoomOutButton = new ToolButton( this );
      this.zoomOutButton.icon = this.scaledResource( ":/icons/zoom-out.png" );
      this.zoomOutButton.setScaledFixedSize( 20, 20 );
      this.zoomOutButton.toolTip = "Zoom out";
      this.zoomOutButton.onClick = function() { self.previewBox.zoomOut(); };

      this.zoomFitButton = new ToolButton( this );
      this.zoomFitButton.icon = this.scaledResource( ":/toolbar/view-zoom-fit.png" );
      this.zoomFitButton.setScaledFixedSize( 20, 20 );
      this.zoomFitButton.toolTip = "Zoom to fit";
      this.zoomFitButton.onClick = function() { self.previewBox.zoomFit(); };

      this.zoom11Button = new ToolButton( this );
      this.zoom11Button.icon = this.scaledResource( ":/icons/zoom-1-1.png" );
      this.zoom11Button.setScaledFixedSize( 20, 20 );
      this.zoom11Button.toolTip = "Zoom 1:1";
      this.zoom11Button.onClick = function() { self.previewBox.zoom1to1(); };

      this.zoomInButton = new ToolButton( this );
      this.zoomInButton.icon = this.scaledResource( ":/icons/zoom-in.png" );
      this.zoomInButton.setScaledFixedSize( 20, 20 );
      this.zoomInButton.toolTip = "Zoom in";
      this.zoomInButton.onClick = function() { self.previewBox.zoomIn(); };

      this.previewLabel = new Label( this );
      this.previewLabel.text = "Preview";
      this.previewLabel.styleSheet = "QLabel { font-weight: bold; color: #cccccc; }";
      this.previewLabel.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;

      // Status LED — red while preview is stale (parameters changed but the
      // bitmap on screen hasn't been re-rendered yet), green when the preview
      // reflects the current parameter set.
      this.statusLed = new Frame( this );
      this.statusLed.setFixedSize( 14, 14 );

      this.autoPreviewCheck = new CheckBox( this );
      this.autoPreviewCheck.text = "Auto";
      this.autoPreviewCheck.checked = true;
      this.autoPreviewCheck.toolTip =
         "<p>Refresh the preview automatically (250 ms after the last " +
         "parameter change). Disable for fully manual control via the " +
         "Refresh Preview button.</p>";

      this.refreshButton = new PushButton( this );
      this.refreshButton.text = "Refresh Preview";
      this.refreshButton.toolTip =
         "<p>Rebuild the preview using current parameters. The preview " +
         "operates on a downsampled proxy (~1024px long edge) for speed; " +
         "Process always uses the full-resolution source.</p>";
      this.refreshButton.onClick = function() {
         try { self.refreshPreview(); }
         catch ( e ) { console.criticalln( "Refresh: ", e.toString() ); }
      };

      this.previewToolbar.add( this.previewLabel );
      this.previewToolbar.addStretch();
      this.previewToolbar.add( this.statusLed );
      this.previewToolbar.addSpacing( 6 );
      this.previewToolbar.add( this.zoomOutButton );
      this.previewToolbar.add( this.zoomFitButton );
      this.previewToolbar.add( this.zoom11Button );
      this.previewToolbar.add( this.zoomInButton );
      this.previewToolbar.addSpacing( 8 );
      this.previewToolbar.add( this.autoPreviewCheck );
      this.previewToolbar.add( this.refreshButton );

      this.previewBox = new PreviewScrollBox( this );
      this.previewBox.setMinSize(
         this.logicalPixelsToPhysical( 480 ),
         this.logicalPixelsToPhysical( 360 ) );

      this.pixelLabel = new Label( this );
      this.pixelLabel.text = "Pixel: —";
      this.pixelLabel.styleSheet = "QLabel { color: #888888; font-family: monospace; font-size: 9pt; padding: 2px 4px; }";
      this.pixelLabel.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;

      this.previewBox.onPixelMove = function( ix, iy, bmp ) {
         if ( ix < 0 || iy < 0 || ix >= bmp.width || iy >= bmp.height ) {
            self.pixelLabel.text = "Pixel: —";
            return;
         }
         var px = bmp.pixel( ix, iy );
         var r = ( px >> 16 ) & 0xff;
         var g = ( px >>  8 ) & 0xff;
         var b =   px         & 0xff;
         self.pixelLabel.text = format( "Pixel (%d, %d):  R=%.3f  G=%.3f  B=%.3f",
            ix, iy, r / 255.0, g / 255.0, b / 255.0 );
      };

      this.rightColumn = new Control( this );
      this.rightColumn.sizer = new VerticalSizer;
      this.rightColumn.sizer.spacing = 4;
      this.rightColumn.sizer.add( this.previewToolbar );
      this.rightColumn.sizer.add( this.previewBox, 100 );
      this.rightColumn.sizer.add( this.pixelLabel );

      // ----- MAIN SPLIT (horizontal) --------------------------------------
      this.mainSplit = new HorizontalSizer;
      this.mainSplit.spacing = 8;
      this.mainSplit.add( this.leftColumn );
      this.mainSplit.add( this.rightColumn, 100 );

      // ----- Bottom button row --------------------------------------------
      this.buttonRow = new HorizontalSizer;
      this.buttonRow.spacing = 6;

      this.resetButton = new ToolButton( this );
      this.resetButton.icon = this.scaledResource( ":/process-interface/reset.png" );
      this.resetButton.setScaledFixedSize( 20, 20 );
      this.resetButton.toolTip = "<p>Reset all parameters to defaults.</p>";
      this.resetButton.onClick = function() { self.resetParameters(); };

      this.versionLabel = new Label( this );
      this.versionLabel.text = "v" + VERSION + "  (V8 port)";
      this.versionLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.versionLabel.toolTip =
         "<p><b>" + TITLE + " v" + VERSION + "</b><br>" +
         "V8 PJSR port of the VeraLux HyperMetric Stretch Python script.<br>" +
         "Algorithm: Riccardo Paterniti, GPL-3.0-or-later.<br>" +
         "Input must be linear and color-calibrated (SPCC).</p>";

      this.processButton = new PushButton( this );
      this.processButton.text = "Process";
      this.processButton.toolTip =
         "<p>Apply the HyperMetric Stretch to the full-resolution target " +
         "view (in place — use Edit ▸ Undo to revert).</p>";
      this.processButton.onClick = function() {
         try { runProcess(); }
         catch ( e ) { console.criticalln( "Process: ", e.toString() ); }
      };

      this.closeButton = new PushButton( this );
      this.closeButton.text = "Close";
      this.closeButton.defaultButton = true;
      this.closeButton.onClick = function() { self.ok(); };

      this.buttonRow.add( this.resetButton );
      this.buttonRow.add( this.versionLabel );
      this.buttonRow.addStretch();
      this.buttonRow.add( this.processButton );
      this.buttonRow.add( this.closeButton );

      // ----- Root sizer ---------------------------------------------------
      this.sizer = new VerticalSizer;
      this.sizer.margin = 8;
      this.sizer.spacing = 6;
      this.sizer.add( this.titleLabel );
      this.sizer.add( this.reqLabel );
      this.sizer.add( this.mainSplit, 100 );
      this.sizer.add( this.buttonRow );

      // ---------- Helper methods ------------------------------------------

      this.refreshSensorInfo = function() {
         var idx = parameters.profileIndex;
         var w = profileWeights( idx );
         this.sensorInfo.text = profileInfo( idx ) +
            "  (R=" + w[0].toFixed( 3 ) +
            "  G=" + w[1].toFixed( 3 ) +
            "  B=" + w[2].toFixed( 3 ) + ")";
      };

      this.refreshStrategyFeedback = function() {
         var s = parameters.strategy;
         if ( s < 0 ) {
            var sh = ( Math.abs( s ) / 100.0 ) * 3.0;
            this.strategyFeedback.text = "Action: Noise cleaning (Shadow Conv. " + sh.toFixed( 2 ) + ")";
         } else if ( s > 0 ) {
            var gr = 1.0 - ( s / 100.0 ) * 0.6;
            this.strategyFeedback.text = "Action: Soften highlights (Color Grip " + gr.toFixed( 2 ) + ")";
         } else {
            this.strategyFeedback.text = "Balanced (pure vector)";
         }
      };

      this.applyModeUI = function() {
         var ready = ( parameters.mode === parameters.MODE_READY );
         this.readyContainer.visible      = ready;
         this.scientificContainer.visible = !ready;
         this.modeInfo.text = ready
            ? "Ready-to-Use: Unified strategy enabled (aesthetic focus)."
            : "Scientific: Full manual parameter control.";
      };

      this.refreshControlsFromParameters = function() {
         this.sensorCombo.currentItem = parameters.profileIndex;
         this.radioReady.checked       = ( parameters.mode === parameters.MODE_READY );
         this.radioScientific.checked  = ( parameters.mode === parameters.MODE_SCIENTIFIC );
         this.adaptiveCheck.checked    = parameters.adaptiveAnchor;
         this.targetBgNC.setValue( parameters.targetBg );
         this.logDNC.setValue( parameters.logD );
         this.protectBNC.setValue( parameters.protectB );
         this.convergenceNC.setValue( parameters.convergence );
         this.strategyNC.setValue( parameters.strategy );
         this.linearExpansionNC.setValue( parameters.linearExpansion );
         this.gripNC.setValue( parameters.colorGrip );
         this.shadowNC.setValue( parameters.shadowConvergence );
         this.refreshSensorInfo();
         this.refreshStrategyFeedback();
         this.applyModeUI();
      };

      this.resetParameters = function() {
         parameters.profileIndex      = parameters.defProfileIndex;
         parameters.mode              = parameters.defMode;
         parameters.adaptiveAnchor    = parameters.defAdaptiveAnchor;
         parameters.targetBg          = parameters.defTargetBg;
         parameters.logD              = parameters.defLogD;
         parameters.protectB          = parameters.defProtectB;
         parameters.convergence       = parameters.defConvergence;
         parameters.strategy          = parameters.defStrategy;
         parameters.linearExpansion   = parameters.defLinearExpansion;
         parameters.colorGrip         = parameters.defColorGrip;
         parameters.shadowConvergence = parameters.defShadowConvergence;
         this.refreshControlsFromParameters();
         self._schedulePreview();
      };

      // ---------- Preview management --------------------------------------

      this.invalidateProxy = function() {
         if ( self._proxyImage ) {
            self._proxyImage.free();
            self._proxyImage = null;
         }
         self._proxyViewKey = null;
      };

      // LED state setters. The LED is a 14×14 Frame styled via CSS to look
      // like a circular indicator (border-radius = half the side length).
      this._setLedStale = function() {
         self.statusLed.styleSheet =
            "QFrame { background-color: #e03030; border: 1px solid #802020; border-radius: 7px; }";
         self.statusLed.toolTip =
            "<p>Preview status: <b style='color:#e03030'>STALE</b><br>" +
            "Parameters have changed since the last refresh.</p>";
      };

      this._setLedFresh = function() {
         self.statusLed.styleSheet =
            "QFrame { background-color: #28c828; border: 1px solid #186818; border-radius: 7px; }";
         self.statusLed.toolTip =
            "<p>Preview status: <b style='color:#28c828'>FRESH</b><br>" +
            "Preview reflects the current parameter set.</p>";
      };

      // Initialize as stale — first refreshPreview() will flip it green.
      this._setLedStale();

      // Debounced preview refresh. Each call resets the timer; the actual
      // refresh fires 250 ms after the *last* parameter change. LED always
      // marks stale on any parameter change, even if auto-preview is off.
      this._schedulePreview = function() {
         self._setLedStale();
         if ( !self.autoPreviewCheck.checked ) return;
         self._previewTimer.stop();
         self._previewTimer.start();
      };

      this._ensureProxy = function() {
         if ( parameters.targetView == null || !parameters.targetView.isMainView )
            return false;
         var key = parameters.targetView.fullId + ":" +
                   parameters.targetView.image.width + "x" +
                   parameters.targetView.image.height;
         if ( self._proxyImage != null && self._proxyViewKey === key )
            return true;
         self.invalidateProxy();
         self._proxyImage = buildProxyImage( parameters.targetView.image, 1024 );
         self._proxyViewKey = key;
         return true;
      };

      this.refreshPreview = function() {
         if ( !self._ensureProxy() ) {
            self.previewBox.clearBitmap();
            self.pixelLabel.text = "Pixel: —  (no target view)";
            return;
         }
         var t0 = new Date();

         // Pre-analyze the FULL-resolution source so the proxy preview inherits
         // the same anchor and Smart-Max physical-limit decision that the
         // full-res Process pass will use. Without this, hot pixels that are
         // averaged away by downsampling cause the preview to use a more
         // aggressive scaling than Process — visibly brighter and more
         // saturated than the final image.
         var weights = profileWeights( parameters.profileIndex );
         var pre;
         try {
            pre = preAnalyzeSource(
               parameters.targetView.image, weights,
               parameters.adaptiveAnchor,
               parameters.mode === parameters.MODE_READY,
               parameters.logD, parameters.protectB );
         } catch ( e ) {
            console.criticalln( "Preview pre-analysis error: ", e.toString() );
            return;
         }

         var result;
         try {
            result = processVeraLux( self._proxyImage, {
               silent: true,
               assumeNormalized: true,
               anchor: pre.anchor,
               rtuOverrides: pre.rtu
            } );
         } catch ( e ) {
            console.criticalln( "Preview error: ", e.toString() );
            return;
         }

         var bmp = result.render();
         result.free();

         var firstBitmap = ( self.previewBox.bitmap == null );
         self.previewBox.setBitmap( bmp );
         if ( firstBitmap ) self.previewBox.zoomFit();

         var dt = ( new Date().getTime() - t0.getTime() ) * 0.001;
         self.previewLabel.text = format( "Preview  (%dx%d, %.2f s)",
            bmp.width, bmp.height, dt );

         self._setLedFresh();
      };

      // Init UI state from parameters.
      parameters.dialog = this;
      this.refreshControlsFromParameters();

      this.adjustToContents();
      this.setMinWidth( this.logicalPixelsToPhysical( 1050 ) );
      this.setMinHeight( this.logicalPixelsToPhysical( 700 ) );
   }
};

// =============================================================================
// ENTRY POINT
// =============================================================================

function main() {
   parameters.loadSettings();

   var dialog = new VeraLuxDialog();

   // Auto-render an initial preview if a view is already active.
   if ( parameters.targetView != null && parameters.targetView.isMainView ) {
      try { dialog.refreshPreview(); }
      catch ( e ) { console.criticalln( "Initial preview: ", e.toString() ); }
   }

   dialog.execute();

   // Stop the auto-preview debounce timer before tearing down.
   if ( dialog._previewTimer ) dialog._previewTimer.stop();

   // Free preview proxy on close.
   dialog.invalidateProxy();
   if ( dialog.previewBox ) dialog.previewBox.clearBitmap();

   // FWHMEccentricity-style workaround: detach captured current view.
   dialog.viewList.currentView = dialog.viewListNullCurrentView;

   parameters.storeSettings();
}

main();

// ----------------------------------------------------------------------------
// EOF VeraLux_HyperMetric_Stretch.js
