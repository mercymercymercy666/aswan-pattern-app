import { useMemo, useRef } from 'react';
import { LOCATIONS } from '../data/locations';
import { coordsToSectionParams, buildTatreezPaths } from '../patterns/moire';
import { assembleTatreezGrid, hasZoneImages } from '../patterns/tatreez';

const LABEL_H  = 80;
const INFO_IMG  = 90; // thumbnail size (px)
const INFO_GAP  = 8;  // gap between thumbnails
const INFO_H    = INFO_IMG + 24; // thumbnail + label text + padding

/* ── Vertical line pattern ───────────────────────────────── */
function VertPat({ id, freq, lw }) {
  return (
    <pattern id={id} width={freq} height={freq} patternUnits="userSpaceOnUse">
      <line x1={0} y1={0} x2={0} y2={freq} stroke="black" strokeWidth={lw} />
    </pattern>
  );
}

/* ── Horizontal line pattern ─────────────────────────────── */
function HorizPat({ id, freq, lw }) {
  return (
    <pattern id={id} width={freq} height={freq} patternUnits="userSpaceOnUse">
      <line x1={0} y1={0} x2={freq} y2={0} stroke="black" strokeWidth={lw} />
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


/* ── Embroidery erase layer ─────────────────────────────── */
// Dark pixels in grayC → white vertical lines at full lineSpacing width → completely
// erases the underlying pattern in those cells, leaving clean white negative space.
function EraseLineLayer({ grayGrid, x0, secW, bandH, lineSpacing, threshold }) {
  const ROWS    = grayGrid.length;
  const COLS    = grayGrid[0]?.length || ROWS;
  const numCols = Math.ceil(secW / lineSpacing);
  const cellH   = bandH / ROWS;
  let d = '';
  for (let col = 0; col < numCols; col++) {
    const sx     = x0 + col * lineSpacing;
    const t      = Math.max(0, Math.min(1, (sx - x0) / secW));
    const imgCol = Math.min(COLS - 1, Math.floor(t * COLS));
    for (let row = 0; row < ROWS; row++) {
      if (grayGrid[row][imgCol] > threshold) continue;
      const sy = row * cellH;
      d += `M${sx.toFixed(1)},${sy.toFixed(1)}L${sx.toFixed(1)},${(sy + cellH).toFixed(1)}`;
    }
  }
  if (!d) return null;
  return (
    <path d={d} stroke="white"
          strokeWidth={lineSpacing * 1.15}
          strokeLinecap="butt" fill="none" />
  );
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

/* ── Export helpers ─────────────────────────────────────── */
async function blobToDataUrl(blobUrl) {
  const res  = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function svgToCanvas(svgEl, x0, w, h, scale = 2) {
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('[data-noexport]').forEach(el => el.remove());
  clone.setAttribute('viewBox', `${x0} 0 ${w} ${h}`);
  clone.setAttribute('width',  w);
  clone.setAttribute('height', h);
  // Inline blob: hrefs as base64 so they survive SVG→canvas serialisation
  await Promise.all(Array.from(clone.querySelectorAll('image[href]')).map(async img => {
    const href = img.getAttribute('href') ?? '';
    if (href.startsWith('blob:')) {
      try { img.setAttribute('href', await blobToDataUrl(href)); } catch {}
    }
  }));
  const str  = new XMLSerializer().serializeToString(clone);
  const url  = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function triggerDownload(blob, filename) {
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Main wall ───────────────────────────────────────────── */
export default function PatternWall({
  activeLocations, params, locationData, sectionWidths, treeWidths, exportRef,
}) {
  const svgRef  = useRef(null);
  const BAND_H  = params.wallHeight;

  const hasAnyImages = activeLocations.some((id) => {
    const d = locationData[id];
    return d?.previewA || d?.previewB || d?.previewC || d?.previewCrown || d?.previewBranch || d?.previewRoot;
  });
  const TOTAL_H = BAND_H + LABEL_H + (hasAnyImages ? INFO_H : 0);

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

  // ── All SVG ───────────────────────────────────────────────
  const handleExportAllSvg = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    clone.querySelectorAll('[data-noexport]').forEach(el => el.remove());
    triggerDownload(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
      `aswan-wall-${sections.length}stops.svg`,
    );
  };

  // ── All JPG ───────────────────────────────────────────────
  const handleExportAllJpeg = async () => {
    if (!svgRef.current) return;
    const canvas = await svgToCanvas(svgRef.current, 0, totalW, TOTAL_H);
    canvas.toBlob(b => triggerDownload(b, `aswan-wall-${sections.length}stops.jpg`), 'image/jpeg', 0.95);
  };

  // ── Per-section SVG ───────────────────────────────────────
  const handleExportSectionSvg = (id) => {
    const sec = sections.find(s => s.id === id);
    if (!sec || !svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    clone.querySelectorAll('[data-noexport]').forEach(el => el.remove());
    clone.setAttribute('viewBox', `${sec.x0} 0 ${sec.secW} ${TOTAL_H}`);
    clone.setAttribute('width',  sec.secW);
    clone.setAttribute('height', TOTAL_H);
    triggerDownload(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
      `aswan-${id}.svg`,
    );
  };

  // ── Per-section JPG ───────────────────────────────────────
  const handleExportSectionJpeg = async (id) => {
    const sec = sections.find(s => s.id === id);
    if (!sec || !svgRef.current) return;
    const canvas = await svgToCanvas(svgRef.current, sec.x0, sec.secW, TOTAL_H);
    canvas.toBlob(b => triggerDownload(b, `aswan-${id}.jpg`), 'image/jpeg', 0.95);
  };

  if (exportRef) exportRef.current = {
    exportAllSvg:      handleExportAllSvg,
    exportAllJpeg:     handleExportAllJpeg,
    exportSectionSvg:  handleExportSectionSvg,
    exportSectionJpeg: handleExportSectionJpeg,
  };

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
                <VertPat  id={`v-${idx}`}  freq={sp.freq} lw={sp.lineWidth} />
                <AnglePat id={`a-${idx}`}  angle={sp.angle} freq={sp.freq} lw={sp.lineWidth} />
                {/* Thin variants for inside the tree zone */}
                <VertPat  id={`vt-${idx}`} freq={sp.freq} lw={sp.lineWidth * 0.6} />
                <AnglePat id={`at-${idx}`} angle={sp.angle} freq={sp.freq} lw={sp.lineWidth * 0.6} />
                {/* Horizontal grid — same freq as vertical (longitude-driven) */}
                <HorizPat id={`hh-${idx}`} freq={sp.freq} lw={sp.lineWidth * params.horizWeight} />
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
          {/* Side bands: full weight. Tree zone: same pattern, thinner lines. */}
          {sections.map(({ id, x0, secW, treeX, treeW, sp }, idx) => {
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
            const lx = treeX, rw = x0 + secW - treeX - treeW;
            return (
              <g key={`vert-${id}-${idx}`}>
                <rect x={x0}          y={0} width={Math.max(0, lx - x0)} height={BAND_H} fill={`url(#v-${idx})`} />
                <rect x={lx}          y={0} width={treeW}                 height={BAND_H} fill={`url(#vt-${idx})`} />
                <rect x={lx + treeW}  y={0} width={Math.max(0, rw)}       height={BAND_H} fill={`url(#v-${idx})`} />
              </g>
            );
          })}

          {/* ── Layer 2: angled overlay — full section ── */}
          {/* Same side-band / tree-zone split as Layer 1 */}
          {sections.map(({ id, x0, secW, treeX, treeW, sp }, idx) => {
            const d     = locationData[id];
            const grayB = d?.grayB;
            if (grayB) {
              const angleRad = Math.abs(sp.angle * Math.PI / 180);
              // xPad: how far lines must extend left/right so rotated corners are covered
              const xPad = Math.ceil((BAND_H / 2) * Math.sin(angleRad)) + 20;
              // yPad: rotated corners also need lines beyond top/bottom of the band
              const yPad = Math.ceil((secW  / 2) * Math.sin(angleRad)) + 20;
              const cx   = x0 + secW / 2;
              const cy   = BAND_H / 2;
              return (
                <g key={`moire-${id}-${idx}`} clipPath={`url(#secClip-${idx})`}>
                  <g transform={`rotate(${sp.angle} ${cx} ${cy})`}>
                    {/* translate up by yPad so drawing covers [−yPad … BAND_H+yPad] */}
                    <g transform={`translate(0, ${-yPad})`}>
                      <GrayLineLayer
                        grayGrid={grayB} drawX0={x0 - xPad} drawW={secW + 2 * xPad}
                        bandH={BAND_H + 2 * yPad}
                        lineSpacing={sp.freq} baseWidth={sp.lineWidth}
                        imgX0={x0} imgW={secW}
                        threshold={d?.thresholdB ?? 0.82}
                        contrast={d?.contrastB   ?? 1.0} />
                    </g>
                  </g>
                </g>
              );
            }
            const lx = treeX, rw = x0 + secW - treeX - treeW;
            return (
              <g key={`moire-${id}-${idx}`}>
                <rect x={x0}         y={0} width={Math.max(0, lx - x0)} height={BAND_H} fill={`url(#a-${idx})`} />
                <rect x={lx}         y={0} width={treeW}                 height={BAND_H} fill={`url(#at-${idx})`} />
                <rect x={lx + treeW} y={0} width={Math.max(0, rw)}       height={BAND_H} fill={`url(#a-${idx})`} />
              </g>
            );
          })}


          {/* ── Layer 3: embroidery erase overlay ── */}
          {/* Dark pixels in image C become solid white, erasing the moiré beneath.   */}
          {/* The image shape appears as clean white cutouts through the line pattern. */}
          {sections.map(({ id, x0, secW, sp }, idx) => {
            const d = locationData[id];
            if (!d?.grayC) return null;
            return (
              <g key={`erase-${id}-${idx}`} clipPath={`url(#secClip-${idx})`}>
                <EraseLineLayer
                  grayGrid={d.grayC} x0={x0} secW={secW} bandH={BAND_H}
                  lineSpacing={sp.freq}
                  threshold={d.thresholdC ?? 0.5} />
              </g>
            );
          })}

          {/* ── Layer 4: Tree of Life ── */}
          {sections.map(({ id, loc, sp, treeX, treeW }, idx) => {
            const cs      = Math.max(4, Math.round(sp.freq * params.stitchSize));
            const imgData = locationData[id];
            const useZones = hasZoneImages(imgData);

            const { stitchThin, stitchMid, stitchThick, trunkPath, edgePath, tipPath, voidClearPath } = buildTatreezPaths(
              loc, treeX, treeW, BAND_H, cs, params.treeDepth,
              params.motifType, params.motifScale, params.treeStyle
            );

            let assembled = null;
            let imgCs = cs;
            if (useZones) {
              imgCs = Math.max(4, Math.round(sp.freq * params.imageLineWeight));
              const cols = Math.ceil(treeW / imgCs);
              const rows = Math.ceil(BAND_H / imgCs);
              assembled = assembleTatreezGrid(
                { crown: imgData?.crownGrid ?? null, branch: imgData?.branchGrid ?? null, root: imgData?.rootGrid ?? null },
                rows, cols,
                imgData?.crownFrac ?? 0.30, imgData?.branchFrac ?? 0.40, imgData?.zoneSymmetry ?? false,
              );
            }

            return (
              <g key={`tree-${id}-${idx}`} clipPath={`url(#treeClip-${idx})`}>
                {voidClearPath && <path d={voidClearPath} stroke="white" strokeWidth={cs * 1.05}
                      strokeLinecap="butt" fill="none" />}
                {stitchThin  && <path d={stitchThin}  stroke="black" strokeWidth={sp.lineWidth * 0.9}  strokeLinecap="butt" fill="none" />}
                {stitchMid   && <path d={stitchMid}   stroke="black" strokeWidth={sp.lineWidth * 1.6}  strokeLinecap="butt" fill="none" />}
                {stitchThick && <path d={stitchThick} stroke="black" strokeWidth={sp.lineWidth * 2.4}  strokeLinecap="butt" fill="none" />}
                {trunkPath   && <path d={trunkPath}   stroke="black" strokeWidth={sp.lineWidth * 4.0}  strokeLinecap="butt" fill="none" />}
                <path d={edgePath} stroke="black" strokeWidth={sp.lineWidth * 1.4}
                      strokeLinecap="round" fill="none" />
                {tipPath && <path d={tipPath} stroke="black" strokeWidth={sp.lineWidth * 1.1}
                      strokeLinecap="round" fill="none" />}
                {assembled && <GridLineLayer grid={assembled} treeX={treeX} cs={imgCs} lineWidth={imgCs * 0.65} />}
              </g>
            );
          })}



          {/* ── Layer 5: horizontal grid (bottom) ── */}
          {/* Renders on top of everything so it cuts through moiré + tree zone.     */}
          {/* Frequency is longitude-driven (same as vertical). horizWeight=0 = off. */}
          {params.horizWeight > 0 && sections.map(({ id, x0, secW }, idx) => {
            const hh = Math.round(BAND_H * Math.min(1, Math.max(0, params.horizHeight)));
            return (
              <rect key={`horiz-${id}-${idx}`}
                    x={x0} y={BAND_H - hh} width={secW} height={hh}
                    fill={`url(#hh-${idx})`} />
            );
          })}

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

          {/* ── Infographic image strip ── */}
          {hasAnyImages && (
            <>
              <line x1={0} y1={BAND_H + LABEL_H} x2={totalW} y2={BAND_H + LABEL_H}
                    stroke="#ddd" strokeWidth={0.5} />
              {sections.map(({ id, x0, secW }) => {
                const d = locationData[id];
                if (!d) return null;
                const imgs = [
                  { key: 'A',      src: d.previewA,      label: 'VERT'   },
                  { key: 'B',      src: d.previewB,      label: 'ANGLE'  },
                  { key: 'C',      src: d.previewC,      label: 'ERASE'  },
                  { key: 'crown',  src: d.previewCrown,  label: 'CROWN'  },
                  { key: 'branch', src: d.previewBranch, label: 'BRANCH' },
                  { key: 'root',   src: d.previewRoot,   label: 'ROOT'   },
                ].filter(i => i.src);
                if (!imgs.length) return null;
                const blockW  = imgs.length * INFO_IMG + (imgs.length - 1) * INFO_GAP;
                const startX  = x0 + (secW - blockW) / 2;
                const imgY    = BAND_H + LABEL_H + 10;
                return (
                  <g key={`info-${id}`}>
                    {imgs.map((img, i) => {
                      const ix = startX + i * (INFO_IMG + INFO_GAP);
                      return (
                        <g key={img.key}>
                          <image href={img.src} x={ix} y={imgY}
                                 width={INFO_IMG} height={INFO_IMG}
                                 preserveAspectRatio="xMidYMid slice" />
                          <rect x={ix} y={imgY} width={INFO_IMG} height={INFO_IMG}
                                fill="none" stroke="#bbb" strokeWidth={0.5} />
                          <text x={ix + INFO_IMG / 2} y={imgY + INFO_IMG + 9}
                                textAnchor="middle" fontSize={6}
                                fontFamily="'Courier New',monospace"
                                letterSpacing="0.1em" fill="#999">
                            {img.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </>
          )}

          {/* ── Outer frame ── */}
          <rect x={0} y={0} width={totalW} height={BAND_H}
                fill="none" stroke="#111" strokeWidth={1} />
        </svg>
      </div>

      <div className="wall-footer">
        <button className="export-btn" onClick={handleExportAllSvg}>Export SVG</button>
        <span className="wall-note">
          {sections.length} stops · moiré across side bands · tree of life per section
        </span>
      </div>
    </div>
  );
}
