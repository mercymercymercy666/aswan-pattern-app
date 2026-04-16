/**
 * Moiré system — vertical lines are always the base.
 * A second set of lines at a different angle creates interference.
 */

export function coordsToSectionParams(lat, lon, globals) {
  const { moireAngle, coordMix, lineSpacing, lineWidth } = globals;

  const latN = Math.max(0, Math.min(1, (lat - 22) / 17));
  const lonN = Math.max(0, Math.min(1, (lon + 15) / 90));

  const angle    = moireAngle + (latN - 0.5) * coordMix;
  const freq     = lineSpacing * (1 - lonN * 0.18);
  const bandWidth = (() => {
    const a = Math.abs(angle) * Math.PI / 180;
    return a > 0.001 ? Math.round(freq / (2 * Math.sin(a / 2))) : 9999;
  })();

  return { angle, freq, lineWidth, latN, lonN, bandWidth };
}

/**
 * Silhouette parameters for one location.
 * Drives the organic spire/mountain top edge — the "tree of life" profile.
 *   latitude  → amplitude and base level (southern = taller peaks)
 *   longitude → number of peaks and sharpness (eastern = more / sharper spires)
 */
function silhouetteParams(lat, lon) {
  const latN = Math.max(0, Math.min(1, (lat - 22) / 17));
  const lonN = Math.max(0, Math.min(1, (lon + 15) / 90));
  return {
    amplitude: 0.42 - latN * 0.18,
    base:      0.62 - latN * 0.08,
    numPeaks:  3 + lonN * 7,
    sharpness: 0.28 + (1 - latN) * 0.9 + lonN * 0.3,
  };
}

/**
 * Build an SVG path of INTERRUPTED vertical line segments for the tree zone.
 *
 * Each line segment goes from the bottom of the band (bandH) upward to a height
 * determined by the organic silhouette — like a bar chart whose profile is a
 * mountain/spire shape driven by lat/lon. This creates the "interrupted lines"
 * look where you see the tops of the lines forming the organic profile.
 *
 * treeX / treeW  — horizontal bounds of the tree zone
 * bandH          — total band height
 * lineSpacing    — horizontal distance between lines (matches base pattern freq)
 * depthMult      — scales silhouette amplitude (treeDepth param)
 */
/**
 * Build tatreez-inspired ornamental paths for the tree zone using VERTICAL LINES ONLY.
 *
 * The tree zone is divided into a pixel grid (cs × cs cells).
 * The organic silhouette is SNAPPED to the grid rows — creating the stepped,
 * pixelated boundary of counted-thread embroidery.
 *
 * Within the filled area, a repeating diamond-shaped pattern of EMPTY cells
 * acts as the ornamental motif — exactly like tatreez / pixel-art cross-stitch
 * where the pattern emerges from which cells are stitched and which are blank.
 *
 * Coordinate data is encoded in:
 *   longitude → diamond tile size (numPeaks drives D)
 *   latitude  → peak height and sharpness of the stepped silhouette
 *
 * @returns { stitchPath, edgePath }
 *   stitchPath — full-height segments for filled body cells
 *   edgePath   — half-height segments for the top-edge row (silhouette accent)
 */
/**
 * Motif void functions — return true if a grid cell should be left EMPTY.
 * Empty cells form the negative space that defines the tatreez motif.
 * Filled cells (not void) become vertical line segments.
 *
 * S = tile half-size in cells (motifScale param)
 */
function isDiamondVoid(ci, ri, S) {
  // Diamond lattice: interior of each diamond tile is empty.
  // Filled cells outline the diamond edges — classic tatreez lozenge.
  const dc = ((ci % (2 * S)) + 2 * S) % (2 * S) - S;
  const dr = ((ri % (2 * S)) + 2 * S) % (2 * S) - S;
  return Math.abs(dc) + Math.abs(dr) < S - 1;
}

function isChevronVoid(ci, ri, S) {
  // Chevron (V-shapes): the interior of alternating upward V-shapes is empty.
  // Filled cells form the V outlines — tatreez arrow / chevron band.
  const row = ((ri % (2 * S)) + 2 * S) % (2 * S);
  const r   = row < S ? row : 2 * S - row; // triangle wave 0→S→0
  const col = ((ci % (2 * S)) + 2 * S) % (2 * S);
  return col > r && col < 2 * S - r;
}

function isStarVoid(ci, ri, S) {
  // 8-pointed star: cells void in BOTH diamond AND chevron patterns.
  // Filled cells show both outlines overlapping — creates star intersections.
  return isDiamondVoid(ci, ri, S) && isChevronVoid(ci, ri, S);
}

function isAllVoid(ci, ri, S) {
  // Dense overlay: void in EITHER diamond OR chevron.
  // Most cells empty — only the outline intersections remain filled.
  return isDiamondVoid(ci, ri, S) || isChevronVoid(ci, ri, S);
}

const MOTIF_FNS = {
  none:    () => false,
  diamond: isDiamondVoid,
  chevron: isChevronVoid,
  star:    isStarVoid,
  all:     isAllVoid,
};

export function buildTatreezPaths(loc, treeX, treeW, bandH, cs, depthMult = 1, motifType = 'diamond', motifScale = 3, treeStyle = 'data') {
  const p = silhouetteParams(loc.lat, loc.lon);

  const silRatio = (t) => {
    const θ    = t * Math.PI * 2 * p.numPeaks;
    const peak = Math.pow(Math.max(0, Math.sin(θ / 2)), p.sharpness);
    const micro = 0.02 * Math.abs(Math.sin(t * Math.PI * p.numPeaks * 4.1));
    const yr   = p.base - p.amplitude * depthMult * peak - micro;
    return Math.max(0.02, Math.min(0.97, yr));
  };

  const cols = Math.ceil(treeW / cs);
  const rows = Math.ceil(bandH / cs);

  const firstRow = Array.from({ length: cols }, (_, ci) =>
    Math.floor(silRatio((ci + 0.5) / cols) * bandH / cs)
  );

  // ── Coordinate data encoding ─────────────────────────────
  // LONGITUDE (numPeaks 3–10) → column skip: western = sparse, eastern = dense
  const skipPeriod = Math.max(2, Math.round(6 - p.numPeaks * 0.4));
  // LATITUDE (amplitude 0.24–0.42) → taper depth: south = deep taper, north = shallow
  const taperRows  = Math.max(1, Math.round(p.amplitude * rows * 1.8));
  // ──────────────────────────────────────────────────────────

  // ── Branch bottom boundary — same data as top silhouette ────────────────
  // frRatio = how far down the top silhouette sits for each column (0=peak, 1=valley).
  // Peak columns (trunk/main branches) → large lastRow (go deep).
  // Valley columns (branch tips) → small lastRow (stop early).
  // The same lat/lon wave that shapes the canopy top also shapes the branch bottoms,
  // so the branching pattern is a direct data representation of each location.
  //
  // The center column is always the TRUNK — it always reaches the very bottom,
  // making it unambiguous which line is the trunk of the tree.
  const trunkCol = Math.round((cols - 1) / 2);
  const lastRow = Array.from({ length: cols }, (_, ci) => {
    if (ci === trunkCol) return rows; // trunk always reaches the bottom

    if (treeStyle === 'tree') {
      // ── Tree silhouette style ────────────────────────────────────────────
      // Branches taper outward from the trunk — center goes deepest, edges
      // shortest — always producing a recognisable tree profile.
      // Lat/lon data still modulates the shape:
      //   latitude  (amplitude) → how sharply branches taper (south = wider crown)
      //   longitude (numPeaks)  → wave undulations along the gradient = side-branch groupings
      const distFrac  = Math.abs(ci - trunkCol) / Math.max(1, cols / 2); // 0=trunk, 1=edge
      const undulation = 0.12 * Math.sin(distFrac * Math.PI * p.numPeaks * 0.45);
      const taper      = Math.pow(distFrac, 0.75 + p.amplitude * 1.2);
      const botRatio   = (1 - taper * (0.68 + depthMult * 0.18)) + undulation;
      return Math.max(firstRow[ci] + 1, Math.floor(rows * Math.max(0.12, botRatio)));
    }

    // ── Data style (default) ─────────────────────────────────────────────
    const frRatio  = firstRow[ci] / rows;
    const botRatio = 1 - frRatio * frRatio * depthMult * p.amplitude * 4.5;
    return Math.max(firstRow[ci] + 1, Math.floor(rows * Math.max(0.15, botRatio)));
  });
  // ──────────────────────────────────────────────────────────────────────────

  const voidFn = MOTIF_FNS[motifType] ?? MOTIF_FNS.diamond;
  const S      = Math.max(1, motifScale);
  const gap    = cs * 0.08;

  let stitchThin     = '';
  let stitchMid      = '';
  let stitchThick    = '';
  let trunkPath      = ''; // center trunk — rendered thicker in PatternWall
  let edgePath       = '';
  let tipPath        = ''; // round-cap bud dots at the bottom tip of each branch
  let voidClearPath  = ''; // full-height white segments that erase background in void cells

  for (let ci = 0; ci < cols; ci++) {
    if (ci !== trunkCol && ci % skipPeriod === skipPeriod - 1) continue;

    const cx = treeX + ci * cs + cs / 2;
    const fr = firstRow[ci];
    const lr = lastRow[ci];
    if (lr <= fr) continue;
    const filledRows = lr - fr;

    for (let ri = fr; ri < lr; ri++) {
      const depthInFill = ri - fr;

      if (ri === fr) {
        const mid = ri * cs + cs / 2;
        edgePath += `M${cx.toFixed(1)},${mid.toFixed(1)}L${cx.toFixed(1)},${(ri * cs + cs - gap).toFixed(1)}`;
        continue;
      }

      if (voidFn(ci, ri, S)) continue;

      const taperFrac = filledRows > 1 ? Math.min(1, depthInFill / taperRows) : 1;
      const fullY1 = ri * cs + gap;
      const fullY2 = (ri + 1) * cs - gap;
      const cellMid = (fullY1 + fullY2) / 2;
      const y1 = cellMid - (cellMid - fullY1) * taperFrac;
      const y2 = fullY2;

      if (y2 - y1 < 0.5) continue;

      const seg = `M${cx.toFixed(1)},${y1.toFixed(1)}L${cx.toFixed(1)},${y2.toFixed(1)}`;
      if (ci === trunkCol)             trunkPath  += seg;
      else if (taperFrac <= 0.33)      stitchThin  += seg;
      else if (taperFrac <= 0.66)      stitchMid   += seg;
      else                             stitchThick += seg;
    }
  }

  // ── Branch tip dots — bud at the bottom end of each terminating branch ──
  // Only for columns that stop before the bottom (lastRow < rows). The trunk
  // and any column that reaches the floor don't get a tip.
  for (let ci = 0; ci < cols; ci++) {
    if (ci !== trunkCol && ci % skipPeriod === skipPeriod - 1) continue;
    if (ci === trunkCol) continue;
    const fr = firstRow[ci];
    const lr = lastRow[ci];
    if (lr >= rows || lr <= fr) continue;
    const cx   = treeX + ci * cs + cs / 2;
    const tipY = lr * cs;
    // Short downward stub — round caps turn the endpoints into dots
    tipPath += `M${cx.toFixed(1)},${tipY.toFixed(1)}L${cx.toFixed(1)},${(tipY + cs * 0.28).toFixed(1)}`;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Void erase — all columns including skipped ones ──────────────────────
  // skipPeriod drops some columns from rendering, but we still need to erase
  // the background moiré in their void cells so the motif reads as solid white.
  for (let ci = 0; ci < cols; ci++) {
    const fr = firstRow[ci];
    const lr = lastRow[ci];
    if (lr <= fr) continue;
    const cx = treeX + ci * cs + cs / 2;
    for (let ri = fr + 1; ri < lr; ri++) {
      if (voidFn(ci, ri, S)) {
        voidClearPath += `M${cx.toFixed(1)},${(ri * cs).toFixed(1)}L${cx.toFixed(1)},${((ri + 1) * cs).toFixed(1)}`;
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return { stitchThin, stitchMid, stitchThick, trunkPath, edgePath, tipPath, voidClearPath };
}

export function buildSectionTreeClip(loc, treeX, treeW, bandH, lineSpacing, depthMult = 1) {
  const p = silhouetteParams(loc.lat, loc.lon);
  let d = '';

  // Draw one vertical segment per line position across the tree zone
  for (let x = treeX; x <= treeX + treeW; x += lineSpacing) {
    const t     = (x - treeX) / treeW;
    const θ     = t * Math.PI * 2 * p.numPeaks;
    const peak  = Math.pow(Math.max(0, Math.sin(θ / 2)), p.sharpness);
    const micro = 0.02 * Math.abs(Math.sin(t * Math.PI * p.numPeaks * 4.1));
    const yRatio = p.base - p.amplitude * depthMult * peak - micro;
    const y = Math.max(0.02, Math.min(0.97, yRatio)) * bandH;
    d += `M${x.toFixed(1)},${y.toFixed(1)}L${x.toFixed(1)},${bandH}`;
  }

  return d;
}
