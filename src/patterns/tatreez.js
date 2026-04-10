/**
 * Tatreez zone assembly — inspired by PatternGenerator's Crown/Branch/Root system.
 *
 * Stacks three binary image grids (crown = top, branch = middle, root = bottom)
 * proportionally to fill a (rows × cols) cell grid. Optional horizontal symmetry
 * mirrors the left half onto the right — the core tatreez constraint.
 *
 * @param {object}  zones      { crown, branch, root } — binary grids or null
 * @param {number}  rows       Target row count
 * @param {number}  cols       Target column count
 * @param {number}  crownFrac  Fraction of rows for crown zone  (default 0.30)
 * @param {number}  branchFrac Fraction of rows for branch zone (default 0.40)
 * @param {boolean} symmetric  Mirror left half → right (default false)
 * @returns {number[][]}       Assembled binary grid (rows × cols)
 */
export function assembleTatreezGrid(
  { crown = null, branch = null, root = null },
  rows, cols,
  crownFrac  = 0.30,
  branchFrac = 0.40,
  symmetric  = false,
) {
  const crownRows  = Math.round(rows * crownFrac);
  const branchRows = Math.round(rows * branchFrac);
  const rootRows   = rows - crownRows - branchRows;

  const zones = [
    { grid: crown,  zRows: crownRows,  offset: 0 },
    { grid: branch, zRows: branchRows, offset: crownRows },
    { grid: root,   zRows: rootRows,   offset: crownRows + branchRows },
  ];

  const midCol = Math.floor(cols / 2);

  const out = [];
  for (let r = 0; r < rows; r++) {
    // Identify which zone row r belongs to
    let zone = zones[2];
    for (const z of zones) {
      if (r >= z.offset && r < z.offset + z.zRows) { zone = z; break; }
    }

    const row = [];
    for (let c = 0; c < cols; c++) {
      // Apply symmetry — mirror left half onto right half
      const srcC = symmetric && c >= midCol ? cols - 1 - c : c;

      const { grid, zRows, offset } = zone;
      if (!grid || !zRows) { row.push(0); continue; }

      const SROWS = grid.length;
      const SCOLS = grid[0]?.length || SROWS;
      const sr = Math.min(SROWS - 1, Math.floor(((r - offset) / zRows) * SROWS));
      const sc = Math.min(SCOLS - 1, Math.floor((srcC / cols) * SCOLS));
      row.push(grid[sr]?.[sc] ?? 0);
    }
    out.push(row);
  }

  return out;
}

/** Returns true if any zone grid exists in locationData for this id */
export function hasZoneImages(data) {
  return !!(data?.crownGrid || data?.branchGrid || data?.rootGrid);
}
