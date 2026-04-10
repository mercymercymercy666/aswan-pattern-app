import { useMemo, useRef } from 'react';
import { LOCATIONS } from '../data/locations';
import { coordsToSectionParams, buildTatreezPaths } from '../patterns/moire';
import { assembleTatreezGrid, hasZoneImages } from '../patterns/tatreez';

const LABEL_H = 80;

/* ── Vertical line pattern ───────────────────────────────── */
function VertPat({ id, freq, lw }) {
  return (
    <pattern id={id} width={freq} height={freq} patternUnits="userSpaceOnUse">
      <line x1={0} y1={0} x2={0} y2={freq} stroke="black" strokeWidth={lw} />
    </pattern>
  );
}

/* ── Angled line pattern ─────────────────────────────────── */
function AnglePat({ id, angle, freq, lw }) {
  return (
    <pattern id={id} width={freq} height={freq}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line x1={0} y1={0} x2={0} y2={freq} stroke="black" strokeWidth={lw} />
    </pattern>
  );
}

/**
 * Build 4 path strings from a grayscale grid (0=dark, 1=light), bucketed by pixel darkness.
 * Darker pixels → thicker line bucket. Returns [bucket0..bucket3] path strings.
 *
 * drawX0 / drawW   — x range to draw columns across (may be wider than section for rotation padding)
 * imgX0  / imgW    — x range that maps to the full image width (clamped at edges)
 */
/**
 * threshold — pixels lighter than this are skipped entirely (0–1, default 0.82)
 * contrast  — power curve applied to darkness before bucketing:
 *             >1 = push mid-tones toward thicker; <1 = spread more into thin buckets
 */
function grayLinePaths(grayGrid, drawX0, drawW, bandH, lineSpacing, imgX0, imgW, threshold = 0.82, contrast = 1.0) {
  const ROWS    = grayGrid.length;
  const COLS    = grayGrid[0]?.length || ROWS;
  const numCols = Math.ceil(drawW / lineSpacing);
  const cellH   = bandH / ROWS;
  const paths   = ['', '', '', ''];

  for (let col = 0; col < numCols; col++) {
    const sx     = drawX0 + col * lineSpacing;
    const t      = Math.max(0, Math.min(1, (sx - imgX0) / imgW));
    const imgCol = Math.min(COLS - 1, Math.floor(t * COLS));

    for (let row = 0; row < ROWS; row++) {
      const gray = grayGrid[row][imgCol]; // 0=dark, 1=light
      if (gray > threshold) continue;
      // Apply contrast curve to darkness value, then bucket
      const darkness = Math.pow((threshold - gray) / threshold, 1 / Math.max(0.1, contrast));
      const bucket   = Math.min(3, Math.floor(darkness * 4));
      const sy = row * cellH;
      paths[bucket] += `M${sx.toFixed(1)},${sy.toFixed(1)}L${sx.toFixed(1)},${(sy + cellH).toFixed(1)}`;
    }
  }
  return paths;
}

/* ── Render multi-width paths from a grayscale grid ─────── */
function GrayLineLayer({ grayGrid, drawX0, drawW, bandH, lineSpacing, baseWidth, imgX0, imgW, clipId, threshold, contrast }) {
  const paths  = grayLinePaths(grayGrid, drawX0, drawW, bandH, lineSpacing, imgX0, imgW, threshold, contrast);
  const widths = [baseWidth * 0.35, baseWidth * 0.75, baseWidth * 1.3, baseWidth * 2.0];
  const content = paths.map((d, i) =>
    d ? <path key={i} d={d} stroke="black" strokeWidth={widths[i]}
              strokeLinecap="butt" fill="none" /> : null
  );
  if (clipId) return <g clipPath={`url(#${clipId})`}>{content}</g>;
  return <>{content}</>;
}


/* ── Assembled tatreez zone grid → vertical line segments ── */
function GridLineLayer({ grid, treeX, cs, lineWidth }) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (!rows || !cols) return null;
  const gap = cs * 0.09;
  let d = '';
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      if (!grid[ri][ci]) continue;
      const cx = treeX + ci * cs + cs / 2;
      const y1 = ri * cs + gap;
      const y2 = (ri + 1) * cs - gap;
      d += `M${cx.toFixed(1)},${y1.toFixed(1)}L${cx.toFixed(1)},${y2.toFixed(1)}`;
    }
  }
  if (!d) return null;
  return <path d={d} stroke="black" strokeWidth={lineWidth} strokeLinecap="butt" fill="none" />;
}

/* ── Main wall ───────────────────────────────────────────── */
export default function PatternWall({
  activeLocations, params, locationData, sectionWidths, treeWidths, showPortions, exportRef,
}) {
  const svgRef  = useRef(null);
  const BAND_H  = params.wallHeight;
  const TOTAL_H = BAND_H + LABEL_H;

  const sections = useMemo(() => {
    let cursor = 0;
    return activeLocations.map((id) => {
      const loc  = LOCATIONS[id];
      const secW = sectionWidths[id] ?? params.sectionWidth;
      const sp   = coordsToSectionParams(loc.lat, loc.lon, params);
      const x0   = cursor;
      const treeW = Math.min(secW - 50, Math.max(50, treeWidths?.[id] ?? params.treeWidth));
      const treeX = x0 + Math.round((secW - treeW) / 2);
      cursor += secW;
      return { id, loc, sp, x0, secW, treeX, treeW };
    });
  }, [activeLocations, params, sectionWidths]);

  const totalW = sections.reduce((s, sec) => s + sec.secW, 0);

  const handleExport = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    clone.querySelectorAll('[data-noexport]').forEach(el => el.remove());
    const str  = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `aswan-wall-${sections.length}stops.svg`;
    a.click();
  };
  if (exportRef) exportRef.current = handleExport;

  return (
    <div className="wall-wrap">
      <div className="wall-scroll">
        <svg
          ref={svgRef}
          width={totalW} height={TOTAL_H}
          viewBox={`0 0 ${totalW} ${TOTAL_H}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {sections.map(({ id, sp }, idx) => (
              <g key={`defs-${id}-${idx}`}>
                {/* Base vertical pattern (used when no image A) */}
                <VertPat id={`v-${idx}`} freq={sp.freq} lw={sp.lineWidth} />
                {/* Angled overlay (used when no image B) */}
                <AnglePat id={`a-${idx}`} angle={sp.angle} freq={sp.freq} lw={sp.lineWidth} />
              </g>
            ))}
            {/* Section-bounds clip (for image-driven angled layer) */}
            {sections.map(({ id, x0, secW }, idx) => (
              <clipPath key={`sclip-${id}-${idx}`} id={`secClip-${idx}`}>
                <rect x={x0} y={0} width={secW} height={BAND_H} />
              </clipPath>
            ))}
            {/* Tree zone clip (for tree image overlay) */}
            {sections.map(({ id, treeX, treeW }, idx) => (
              <clipPath key={`tclip-${id}-${idx}`} id={`treeClip-${idx}`}>
                <rect x={treeX} y={0} width={treeW} height={BAND_H} />
              </clipPath>
            ))}
          </defs>

          {/* ── White background ── */}
          <rect x={0} y={0} width={totalW} height={BAND_H} fill="white" />

          {/* ── Layer 1: vertical lines — full section ── */}
          {/* Uniform pattern, or image A with darkness → stroke width */}
          {sections.map(({ id, x0, secW, sp }, idx) => {
            const d     = locationData[id];
            const grayA = d?.grayA;
            if (grayA) {
              return (
                <GrayLineLayer key={`vert-${id}-${idx}`}
                  grayGrid={grayA} drawX0={x0} drawW={secW} bandH={BAND_H}
                  lineSpacing={sp.freq} baseWidth={sp.lineWidth}
                  imgX0={x0} imgW={secW}
                  threshold={d?.thresholdA ?? 0.82}
                  contrast={d?.contrastA   ?? 1.0} />
              );
            }
            return (
              <rect key={`vert-${id}-${idx}`}
                    x={x0} y={0} width={secW} height={BAND_H}
                    fill={`url(#v-${idx})`} />
            );
          })}

          {/* ── Layer 2: angled overlay — full section ── */}
          {sections.map(({ id, x0, secW, sp }, idx) => {
            const d     = locationData[id];
            const grayB = d?.grayB;
            if (grayB) {
              const angleRad = Math.abs(sp.angle * Math.PI / 180);
              const pad = Math.ceil((BAND_H / 2) * Math.sin(angleRad) + (secW / 2) * Math.abs(1 - Math.cos(angleRad)));
              const cx  = x0 + secW / 2;
              const cy  = BAND_H / 2;
              return (
                <g key={`moire-${id}-${idx}`} clipPath={`url(#secClip-${idx})`}>
                  <g transform={`rotate(${sp.angle} ${cx} ${cy})`}>
                    <GrayLineLayer
                      grayGrid={grayB} drawX0={x0 - pad} drawW={secW + 2 * pad} bandH={BAND_H}
                      lineSpacing={sp.freq} baseWidth={sp.lineWidth}
                      imgX0={x0} imgW={secW}
                      threshold={d?.thresholdB ?? 0.82}
                      contrast={d?.contrastB   ?? 1.0} />
                  </g>
                </g>
              );
            }
            return (
              <rect key={`moire-${id}-${idx}`}
                    x={x0} y={0} width={secW} height={BAND_H}
                    fill={`url(#a-${idx})`} />
            );
          })}

          {/* ── Layer 3: white rect clears the tree zone ── */}
          {/* The tree zone gets its own treatment: interrupted segments only */}
          {sections.map(({ id, treeX, treeW }, idx) => (
            <rect key={`treebg-${id}-${idx}`}
                  x={treeX} y={0} width={treeW} height={BAND_H}
                  fill="white" />
          ))}

          {/* ── Layer 4: Tree of Life ── */}
          {/* Coordinate-driven tatreez form always renders.                              */}
          {/* When zone images are uploaded they overlay on top, adding image detail.     */}
          {/* The stepped silhouette (lat/lon data) remains visible in both cases.        */}
          {sections.map(({ id, loc, sp, treeX, treeW }, idx) => {
            const cs      = Math.max(4, Math.round(sp.freq * params.stitchSize));
            const imgData = locationData[id];
            const useZones = hasZoneImages(imgData);

            // Always compute the coordinate-driven tatreez form
            const { stitchPath, edgePath } = buildTatreezPaths(
              loc, treeX, treeW, BAND_H, cs, params.treeDepth,
              params.motifType, params.motifScale
            );

            // Assemble zone image grid only when images are uploaded
            let assembled = null;
            if (useZones) {
              const cols = Math.ceil(treeW / cs);
              const rows = Math.ceil(BAND_H / cs);
              assembled = assembleTatreezGrid(
                {
                  crown:  imgData?.crownGrid  ?? null,
                  branch: imgData?.branchGrid ?? null,
                  root:   imgData?.rootGrid   ?? null,
                },
                rows, cols,
                imgData?.crownFrac  ?? 0.30,
                imgData?.branchFrac ?? 0.40,
                imgData?.zoneSymmetry ?? false,
              );
            }

            return (
              <g key={`tree-${id}-${idx}`} clipPath={`url(#treeClip-${idx})`}>
                {/* Layer A: coordinate-driven stepped silhouette — always present */}
                <path d={stitchPath} stroke="black" strokeWidth={sp.lineWidth}
                      strokeLinecap="butt" fill="none" />
                <path d={edgePath}   stroke="black" strokeWidth={sp.lineWidth * 1.4}
                      strokeLinecap="round" fill="none" />

                {/* Layer B: zone image overlay — adds image detail on top of the form */}
                {assembled && (
                  <GridLineLayer
                    grid={assembled} treeX={treeX}
                    cs={cs} lineWidth={sp.lineWidth} />
                )}
              </g>
            );
          })}

          {/* ── Portion outlines — design view only ── */}
          {showPortions && sections.map(({ id, treeX, treeW }, idx) => (
            <rect key={`outline-${id}-${idx}`} data-noexport="1"
                  x={treeX} y={0} width={treeW} height={BAND_H}
                  fill="none" stroke="#111" strokeWidth={1}
                  strokeDasharray="4,4" opacity={0.35} />
          ))}

          {/* ── Section dividers ── */}
          {sections.map(({ x0 }, idx) =>
            idx > 0 ? (
              <line key={`div-${idx}`}
                    x1={x0} y1={0} x2={x0} y2={BAND_H}
                    stroke="black" strokeWidth={1} />
            ) : null
          )}

          {/* ── Coord badges ── */}
          {sections.map(({ sp, x0 }, idx) => (
            <text key={`badge-${idx}`} x={x0 + 6} y={13}
                  fontSize={7} fontFamily="monospace" fill="rgba(0,0,0,0.25)">
              {sp.angle > 0 ? '+' : ''}{sp.angle.toFixed(1)}°  f={sp.freq.toFixed(0)}px
            </text>
          ))}

          {/* ── Bottom edge ── */}
          <line x1={0} y1={BAND_H} x2={totalW} y2={BAND_H}
                stroke="black" strokeWidth={1.5} />

          {/* ── Labels ── */}
          {sections.map(({ id, loc, x0, secW }) => {
            const cx  = x0 + secW / 2;
            const top = BAND_H;
            return (
              <g key={`lbl-${id}`}>
                <line x1={cx} y1={top} x2={cx} y2={top + 8} stroke="black" strokeWidth={1} />
                <text x={cx} y={top + 22} textAnchor="middle" fontSize={11} fontWeight="700"
                      fontFamily="'Courier New',monospace" letterSpacing="0.12em" fill="black">
                  {loc.name.toUpperCase()}
                </text>
                <text x={cx} y={top + 36} textAnchor="middle" fontSize={9}
                      fontFamily="'Courier New',monospace" letterSpacing="0.05em" fill="#555">
                  {loc.subtitle}
                </text>
                <text x={cx} y={top + 50} textAnchor="middle" fontSize={8}
                      fontFamily="'Courier New',monospace" fill="#999">
                  {loc.lat.toFixed(2)}°N · {Math.abs(loc.lon).toFixed(2)}°{loc.lon >= 0 ? 'E' : 'W'}
                </text>
                {loc.people && (
                  <text x={cx} y={top + 63} textAnchor="middle" fontSize={7}
                        fontFamily="'Courier New',monospace" fill="#bbb" fontStyle="italic">
                    {loc.people}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Outer frame ── */}
          <rect x={0} y={0} width={totalW} height={BAND_H}
                fill="none" stroke="#111" strokeWidth={1} />
        </svg>
      </div>

      <div className="wall-footer">
        <button className="export-btn" onClick={handleExport}>Export SVG</button>
        <span className="wall-note">
          {sections.length} stops · moiré across side bands · tree of life per section
        </span>
      </div>
    </div>
  );
}
