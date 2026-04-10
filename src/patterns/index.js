/**
 * Coordinate-seeded pattern generation.
 * Each location's lat/lon produces a unique, deterministic 4-fold symmetric pattern
 * — the geometric "fingerprint" of that place.
 */

// Seeded LCG pseudorandom number generator
function makeLCG(seed) {
  let s = Math.abs(Math.round(seed)) >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

/**
 * Generate an NxN binary grid from lat/lon coordinates.
 * Uses 4-fold symmetry (mirrors both axes) — classic Islamic geometric convention.
 * Latitude influences density; longitude influences the random seed.
 */
export function generatePattern(lat, lon, gridSize = 8) {
  // Normalize coordinates to useful range for seeding
  const seed = Math.round(lat * 137.3) + Math.round(lon * 97.7) * 10000;
  const rand = makeLCG(seed);

  // Latitude: closer to equator = denser pattern (tropical), higher lat = sparser (alpine)
  const latNorm = (lat - 22) / (40 - 22); // 0 (south/dense) to 1 (north/sparse)
  const threshold = 0.38 + latNorm * 0.18; // 0.38 to 0.56

  const half = Math.ceil(gridSize / 2);
  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

  for (let r = 0; r < half; r++) {
    for (let c = 0; c < half; c++) {
      const val = rand() > threshold ? 1 : 0;
      // 4-fold symmetry
      grid[r][c] = val;
      grid[r][gridSize - 1 - c] = val;
      grid[gridSize - 1 - r][c] = val;
      grid[gridSize - 1 - r][gridSize - 1 - c] = val;
    }
  }

  return grid;
}

/**
 * Generate the Tree of Life silhouette for a location section.
 * Returns normalized y values (0=top, 1=bottom) for the silhouette top edge.
 * The pattern fills BELOW this line.
 *
 * Latitude  → silhouette peak height (lower lat = taller, tropical/temple spires)
 * Longitude → silhouette frequency (east = more frequent peaks)
 */
export function generateSilhouettePoints(lat, lon, steps = 300) {
  // Normalized coords
  const latNorm = (lat - 22) / (40 - 22);       // 0 (south) → 1 (north)
  const lonNorm = (lon - (-15)) / (80 - (-15));  // 0 (west) → 1 (east)

  // Peak height: tropical/southern locations have taller peaks (temples, palms)
  const peakHeight = 0.42 - 0.24 * latNorm;  // 0.18 (south) to 0.42 (north)

  // Base silhouette y (how low the pattern sits normally)
  const base = 0.55 - 0.10 * (1 - latNorm);  // 0.45–0.55

  // Frequency: eastern locations get more peaks per section
  const freq = 4 + lonNorm * 5;  // 4–9 peaks

  // Sharpness: southern/eastern = sharper spires (temples, minarets)
  //            northern/western = rounder (domes, arches)
  const sharpness = 0.3 + (1 - latNorm) * 0.6 + lonNorm * 0.2;  // 0.3–1.1

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * freq;

    // Shape the peak: sharpness < 1 = round (dome), sharpness > 1 = pointed (spire)
    const wave = Math.pow(Math.max(0, Math.sin(angle / 2)), sharpness);

    // Occasional secondary rhythm (adds texture / tree branching feel)
    const seed2 = makeLCG(Math.round(lat * 7 + lon * 13));
    const secondary = 0.08 * Math.abs(Math.sin(t * Math.PI * freq * 1.7 + seed2() * Math.PI));

    const y = base - peakHeight * wave - secondary;
    points.push(Math.max(0.05, Math.min(0.9, y)));
  }
  return points;
}

/**
 * Build an SVG path string for a section's clip region.
 * The visible (filled) area is below the tree silhouette line.
 */
export function buildClipPath(silhouettePoints, x0, sectionWidth, wallHeight) {
  const steps = silhouettePoints.length - 1;
  let d = `M ${x0},${wallHeight}`;

  // Up to silhouette start
  d += ` L ${x0},${silhouettePoints[0] * wallHeight}`;

  // Trace silhouette
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (i / steps) * sectionWidth;
    const y = silhouettePoints[i] * wallHeight;
    d += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
  }

  // Down and close
  d += ` L ${x0 + sectionWidth},${wallHeight} Z`;
  return d;
}
