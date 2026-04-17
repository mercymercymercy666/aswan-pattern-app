import { LOCATIONS, GEO_ORDER } from '../data/locations';
import { ditherImageFileAspect, grayscaleImageFile, applyThreshold } from '../patterns/dither';
import { coordsToSectionParams } from '../patterns/moire';

function Slider({ label, value, min, max, step, unit, onChange, hint }) {
  const display = step < 1 ? Number(value).toFixed(1) : Math.round(value);
  return (
    <label className="slider-row">
      <div className="slider-meta">
        <span className="slider-label">{label}</span>
        <span className="slider-val">{display}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))} />
      {hint && <span className="slider-hint">{hint}</span>}
    </label>
  );
}

function LocationCard({ locId, isActive, locationData, params, sectionWidths, treeWidths, onToggle, onUpload, onSectionWidth, onTreeWidth }) {
  const loc    = LOCATIONS[locId];
  const data = locationData[locId];
  const secW = sectionWidths[locId] ?? params.sectionWidth;
  const treeW  = treeWidths[locId]    ?? params.treeWidth;

  const sp = isActive
    ? coordsToSectionParams(loc.lat, loc.lon, params)
    : null;

  // Tatreez stitch pattern upload — preserve aspect ratio so tall narrow trees aren't squashed
  const handleFileTatreez = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const t = data?.thresholdTatreez ?? 0.5;
      const { rawGray, grid } = await ditherImageFileAspect(file, 128, t);
      const previewUrl = URL.createObjectURL(file);
      onUpload(locId, { tatreezGrid: grid, tatreezRaw: rawGray, previewTatreez: previewUrl, thresholdTatreez: t });
    } catch (err) {
      console.error('Tatreez load failed', err);
    }
  };

  const handleTatreezThreshold = (t) => {
    onUpload(locId, { thresholdTatreez: t, tatreezGrid: applyThreshold(data.tatreezRaw, t) });
  };

  // Growth frames — array of { tatreezGrid, tatreezRaw, previewTatreez, thresholdTatreez, tatreezPixelSize }
  const growthFrames = data?.growthFrames ?? [];

  const handleAddGrowthFrame = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const t = 0.5;
      const { rawGray, grid } = await ditherImageFileAspect(file, 128, t);
      const previewUrl = URL.createObjectURL(file);
      const newFrame = { tatreezGrid: grid, tatreezRaw: rawGray, previewTatreez: previewUrl, thresholdTatreez: t, tatreezPixelSize: 1 };
      onUpload(locId, { growthFrames: [...growthFrames, newFrame] });
    } catch (err) {
      console.error('Growth frame load failed', err);
    }
    e.target.value = '';
  };

  const handleGrowthFrameThreshold = (fi, t) => {
    const updated = growthFrames.map((f, i) =>
      i === fi ? { ...f, thresholdTatreez: t, tatreezGrid: applyThreshold(f.tatreezRaw, t) } : f
    );
    onUpload(locId, { growthFrames: updated });
  };

  const handleGrowthFramePixelSize = (fi, ps) => {
    const updated = growthFrames.map((f, i) => i === fi ? { ...f, tatreezPixelSize: ps } : f);
    onUpload(locId, { growthFrames: updated });
  };

  const handleGrowthFrameThickness = (fi, t) => {
    const updated = growthFrames.map((f, i) => i === fi ? { ...f, tatreezThickness: t } : f);
    onUpload(locId, { growthFrames: updated });
  };

  const handleGrowthFrameXOffset = (fi, x) => {
    const updated = growthFrames.map((f, i) => i === fi ? { ...f, xOffset: x } : f);
    onUpload(locId, { growthFrames: updated });
  };

  const handleGrowthFrameInvert = (fi) => {
    const updated = growthFrames.map((f, i) => i === fi ? { ...f, inverted: !f.inverted } : f);
    onUpload(locId, { growthFrames: updated });
  };

  const handleGrowthFrameWidth = (fi, w) => {
    const updated = growthFrames.map((f, i) => i === fi ? { ...f, frameW: w } : f);
    onUpload(locId, { growthFrames: updated });
  };

  const handleRemoveGrowthFrame = (fi) => {
    onUpload(locId, { growthFrames: growthFrames.filter((_, i) => i !== fi) });
  };

  // Moiré layers use grayscale (not dithered binary) so pixel darkness = line width
  const makeMoireHandler = (grayKey, previewKey) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const gray       = await grayscaleImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      onUpload(locId, { [grayKey]: gray, [previewKey]: previewUrl });
    } catch (err) {
      console.error('Grayscale load failed', err);
    }
  };

  const handleFileMoireA = makeMoireHandler('grayA', 'previewA');
  const handleFileMoireB = makeMoireHandler('grayB', 'previewB');
  const handleFileMoireC = makeMoireHandler('grayC', 'previewC');

  const hasZones = !!(data?.crownGrid || data?.branchGrid || data?.rootGrid);
  return (
    <div className={`loc-card ${isActive ? 'active' : 'inactive'} ${hasZones ? 'has-img' : ''}`}>
      <div className="loc-card-row">
        {/* Toggle */}
        <button
          className={`loc-toggle ${isActive ? 'on' : 'off'}`}
          onClick={() => onToggle(locId)}
          title={isActive ? 'Remove stop' : 'Add stop'}
        >
          {isActive ? '●' : '○'}
        </button>

        {/* Info */}
        <div className="loc-info">
          <div className="loc-name">{loc.name}</div>
          <div className="loc-sub">{loc.subtitle}</div>
        </div>

        {/* Coordinates */}
        <div className="loc-coords">
          {loc.lat.toFixed(1)}°N<br />
          {Math.abs(loc.lon).toFixed(1)}°{loc.lon >= 0 ? 'E' : 'W'}
        </div>
      </div>

      {/* Derived params (only when active) */}
      {isActive && sp && (
        <div className="loc-derived">
          <span>α={sp.angle.toFixed(1)}°</span>
          <span>f={sp.freq.toFixed(0)}px</span>
          {sp.bandWidth < 500 && <span>~{sp.bandWidth}px bands</span>}
        </div>
      )}

      {/* Section width slider (only when active) */}
      {isActive && (
        <div className="loc-width-row">
          <span className="loc-width-label">Width</span>
          <input
            type="range" min={150} max={1400} step={25}
            value={secW}
            onChange={e => onSectionWidth(locId, Number(e.target.value))}
          />
          <span className="loc-width-val">{secW}px</span>
        </div>
      )}

      {/* Tree zone width slider (only when active) */}
      {isActive && (
        <div className="loc-width-row">
          <span className="loc-width-label">Tree W</span>
          <input
            type="range" min={50} max={Math.max(50, secW - 50)} step={10}
            value={Math.min(treeW, Math.max(50, secW - 50))}
            onChange={e => onTreeWidth(locId, Number(e.target.value))}
          />
          <span className="loc-width-val">{Math.min(treeW, Math.max(50, secW - 50))}px</span>
        </div>
      )}

      {/* Uploads (only when active) */}
      {isActive && (
        <>
          {/* ── Tatreez stitch pattern ── */}
          {/* Upload one of the numbered tatreez designs. Dark cells become bold
              stitches aligned to the moiré thread columns — no white background,
              the moiré shows through void cells as the fabric. */}
          <div className="loc-section-title">Tatreez</div>

          <div className="loc-upload-row">
            <span className="loc-upload-label">Pattern</span>
            <label className={`upload-btn ${data?.tatreezGrid ? 'active' : ''}`}>
              {data?.tatreezGrid ? '✓' : '+'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                     onChange={handleFileTatreez} />
            </label>
            {data?.tatreezGrid && (
              <button className="clear-btn"
                      onClick={() => onUpload(locId, { tatreezGrid: null, tatreezRaw: null, previewTatreez: null })}>×</button>
            )}
            {data?.previewTatreez && (
              <img src={data.previewTatreez} className="loc-preview-thumb" alt="" />
            )}
          </div>

          {data?.tatreezRaw && (
            <>
              <div className="loc-width-row">
                <span className="loc-width-label">Thresh</span>
                <input type="range" min={5} max={95} step={1}
                       value={Math.round((data?.thresholdTatreez ?? 0.5) * 100)}
                       onChange={e => handleTatreezThreshold(Number(e.target.value) / 100)} />
                <span className="loc-width-val">{Math.round((data?.thresholdTatreez ?? 0.5) * 100)}%</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Px size</span>
                <input type="range" min={0.25} max={12} step={0.25}
                       value={data?.tatreezPixelSize ?? 1}
                       onChange={e => onUpload(locId, { tatreezPixelSize: Number(e.target.value) })} />
                <span className="loc-width-val">{Number(data?.tatreezPixelSize ?? 1).toFixed(2).replace(/\.?0+$/, '')}×</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Thickness</span>
                <input type="range" min={0.1} max={4} step={0.1}
                       value={data?.tatreezThickness ?? 1}
                       onChange={e => onUpload(locId, { tatreezThickness: Number(e.target.value) })} />
                <span className="loc-width-val">{Number(data?.tatreezThickness ?? 1).toFixed(1)}×</span>
              </div>
            </>
          )}

          {/* ── Growth frames ── */}
          {/* Upload animation frames (01→08) in order. Each appears as a strip
              below the main band so the tree reads as growing upward. Optional —
              nothing shows if no frames are uploaded. */}
          <div className="loc-section-title">
            Growth frames
            {growthFrames.length > 0 && (
              <span className="loc-width-val" style={{ marginLeft: 8, fontWeight: 400 }}>pos</span>
            )}
            {growthFrames.length < Math.floor(params.wallHeight / Math.max(20, data?.growthFrameH ?? params.growthFrameH)) && (
              <label className="upload-btn" style={{ marginLeft: 8, fontSize: 11 }}>
                + add
                <input type="file" accept="image/*" style={{ display: 'none' }}
                       onChange={handleAddGrowthFrame} />
              </label>
            )}
          </div>

          {growthFrames.length > 0 && (
            <div className="loc-width-row">
              <span className="loc-width-label">Frame H</span>
              <input type="range" min={20} max={params.wallHeight} step={5}
                     value={data?.growthFrameH ?? params.growthFrameH}
                     onChange={e => onUpload(locId, { growthFrameH: Number(e.target.value) })} />
              <span className="loc-width-val">{data?.growthFrameH ?? params.growthFrameH}px</span>
            </div>
          )}

          {growthFrames.map((frame, fi) => (
            <div key={fi} className="growth-frame-row">
              <span className="loc-upload-label">F{fi + 1}</span>
              {frame.previewTatreez && (
                <img src={frame.previewTatreez} className="loc-preview-thumb" alt="" />
              )}
              <button
                className={`upload-btn${frame.inverted ? ' active' : ''}`}
                style={{ fontSize: 8, padding: '2px 6px' }}
                onClick={() => handleGrowthFrameInvert(fi)}
              >INV</button>
              <button className="clear-btn" onClick={() => handleRemoveGrowthFrame(fi)}>×</button>
              <div className="loc-width-row" style={{ marginTop: 2 }}>
                <span className="loc-width-label">Position</span>
                <input type="range"
                       min={-secW} max={secW} step={5}
                       value={frame.xOffset ?? 0}
                       onChange={e => handleGrowthFrameXOffset(fi, Number(e.target.value))} />
                <span className="loc-width-val">{frame.xOffset ?? 0}px</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Width</span>
                <input type="range" min={20} max={secW} step={5}
                       value={frame.frameW ?? treeW}
                       onChange={e => handleGrowthFrameWidth(fi, Number(e.target.value))} />
                <span className="loc-width-val">{frame.frameW ?? treeW}px</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Thresh</span>
                <input type="range" min={5} max={95} step={1}
                       value={Math.round((frame.thresholdTatreez ?? 0.5) * 100)}
                       onChange={e => handleGrowthFrameThreshold(fi, Number(e.target.value) / 100)} />
                <span className="loc-width-val">{Math.round((frame.thresholdTatreez ?? 0.5) * 100)}%</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Px size</span>
                <input type="range" min={0.25} max={12} step={0.25}
                       value={frame.tatreezPixelSize ?? 1}
                       onChange={e => handleGrowthFramePixelSize(fi, Number(e.target.value))} />
                <span className="loc-width-val">{Number(frame.tatreezPixelSize ?? 1).toFixed(2).replace(/\.?0+$/, '')}×</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Thickness</span>
                <input type="range" min={0.1} max={4} step={0.1}
                       value={frame.tatreezThickness ?? 1}
                       onChange={e => handleGrowthFrameThickness(fi, Number(e.target.value))} />
                <span className="loc-width-val">{Number(frame.tatreezThickness ?? 1).toFixed(1)}×</span>
              </div>
            </div>
          ))}

          {/* ── Moiré band images ── */}
          <div className="loc-section-title">Moiré layers</div>

          {/* Layer A (vertical) */}
          <div className="loc-upload-row">
            <span className="loc-upload-label">A vert</span>
            <label className={`upload-btn ${data?.grayA ? 'active' : ''}`}>
              {data?.grayA ? '✓' : '+'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileMoireA} />
            </label>
            {data?.grayA && (
              <button className="clear-btn" onClick={() => onUpload(locId, { grayA: null, previewA: null })}>×</button>
            )}
            {data?.previewA && <img src={data.previewA} className="loc-preview-thumb" alt="" />}
          </div>
          {data?.grayA && (<>
            <div className="loc-width-row">
              <span className="loc-width-label">Thresh</span>
              <input type="range" min={5} max={99} step={1}
                     value={Math.round((data?.thresholdA ?? 0.82) * 100)}
                     onChange={e => onUpload(locId, { thresholdA: Number(e.target.value) / 100 })} />
              <span className="loc-width-val">{Math.round((data?.thresholdA ?? 0.82) * 100)}%</span>
            </div>
            <div className="loc-width-row">
              <span className="loc-width-label">Contrast</span>
              <input type="range" min={10} max={300} step={5}
                     value={Math.round((data?.contrastA ?? 1.0) * 100)}
                     onChange={e => onUpload(locId, { contrastA: Number(e.target.value) / 100 })} />
              <span className="loc-width-val">{((data?.contrastA ?? 1.0)).toFixed(1)}×</span>
            </div>
          </>)}

          {/* Layer B (angled) */}
          <div className="loc-upload-row">
            <span className="loc-upload-label">B angle</span>
            <label className={`upload-btn ${data?.grayB ? 'active' : ''}`}>
              {data?.grayB ? '✓' : '+'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileMoireB} />
            </label>
            {data?.grayB && (
              <button className="clear-btn" onClick={() => onUpload(locId, { grayB: null, previewB: null })}>×</button>
            )}
            {data?.previewB && <img src={data.previewB} className="loc-preview-thumb" alt="" />}
          </div>
          {data?.grayB && (<>
            <div className="loc-width-row">
              <span className="loc-width-label">Thresh</span>
              <input type="range" min={5} max={99} step={1}
                     value={Math.round((data?.thresholdB ?? 0.82) * 100)}
                     onChange={e => onUpload(locId, { thresholdB: Number(e.target.value) / 100 })} />
              <span className="loc-width-val">{Math.round((data?.thresholdB ?? 0.82) * 100)}%</span>
            </div>
            <div className="loc-width-row">
              <span className="loc-width-label">Contrast</span>
              <input type="range" min={10} max={300} step={5}
                     value={Math.round((data?.contrastB ?? 1.0) * 100)}
                     onChange={e => onUpload(locId, { contrastB: Number(e.target.value) / 100 })} />
              <span className="loc-width-val">{((data?.contrastB ?? 1.0)).toFixed(1)}×</span>
            </div>
          </>)}

          {/* Layer C (embroidery erase) */}
          <div className="loc-upload-row">
            <span className="loc-upload-label">C erase</span>
            <label className={`upload-btn ${data?.grayC ? 'active' : ''}`}>
              {data?.grayC ? '✓' : '+'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileMoireC} />
            </label>
            {data?.grayC && (
              <button className="clear-btn" onClick={() => onUpload(locId, { grayC: null, previewC: null })}>×</button>
            )}
            {data?.previewC && <img src={data.previewC} className="loc-preview-thumb" alt="" />}
          </div>
          {data?.grayC && (
            <div className="loc-width-row">
              <span className="loc-width-label">Thresh</span>
              <input type="range" min={5} max={99} step={1}
                     value={Math.round((data?.thresholdC ?? 0.5) * 100)}
                     onChange={e => onUpload(locId, { thresholdC: Number(e.target.value) / 100 })} />
              <span className="loc-width-val">{Math.round((data?.thresholdC ?? 0.5) * 100)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ControlPanel({
  params, onChange,
  activeLocations, locationData,
  sectionWidths, treeWidths,
  onToggle, onUpload, onSectionWidth, onTreeWidth,
  onExportAllSvg, onExportAllJpeg, onExportSectionSvg, onExportSectionJpeg,
  onSaveSession, onLoadSession,
}) {
  const set = (key, val) => onChange({ ...params, [key]: val });
  const bandWidth = (() => {
    const a = Math.abs(params.moireAngle) * Math.PI / 180;
    return a > 0.001 ? Math.round(params.lineSpacing / (2 * Math.sin(a / 2))) : '∞';
  })();

  return (
    <aside className="control-panel">

      {/* ── Mode ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Mode</div>
        <div className="mode-btns">
          <button
            className={`mode-btn ${params.mode === 'lines' ? 'active' : ''}`}
            onClick={() => { set('mode', 'lines'); set('moireAngle', 4); }}
          >
            Lines
            <span className="mode-sub">moiré</span>
          </button>
          <button
            className={`mode-btn ${params.mode === 'cross' ? 'active' : ''}`}
            onClick={() => { set('mode', 'cross'); set('moireAngle', 45); }}
          >
            Cross
            <span className="mode-sub">hatch</span>
          </button>
        </div>
        <p className="slider-hint">
          Both layers always intersect.
          {params.mode === 'lines'
            ? ' Small angle creates interference bands.'
            : ' Large angle creates cross-hatch engraving.'}
        </p>
      </section>

      {/* ── Hatch controls ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Lines</div>

        <Slider label="Line Spacing" value={params.lineSpacing}
                min={3} max={30} step={1} unit="px"
                onChange={v => set('lineSpacing', v)} />

        <Slider label="Stroke Weight" value={params.lineWidth}
                min={0.5} max={8} step={0.5} unit="px"
                onChange={v => set('lineWidth', v)}
                hint="Thicker = deeper carve in Rhino displacement" />

      </section>

      <section className="ctrl-section">
        <div className="ctrl-title">Moiré / Hatch Angle</div>

        <Slider
          label="Overlay Angle" value={params.moireAngle}
          min={0.5} max={89} step={0.5} unit="°"
          onChange={v => set('moireAngle', v)}
          hint={
            params.moireAngle < 10
              ? `Moiré — interference band ≈ ${bandWidth}px wide`
              : params.moireAngle < 35
              ? 'Transitional cross-hatch'
              : 'Deep cross-hatch engraving'
          }
        />

        <Slider label="Coord Influence" value={params.coordMix}
                min={0} max={25} step={0.5} unit="°"
                onChange={v => set('coordMix', v)}
                hint="How much lat/lon shifts angle per stop" />
      </section>

      {/* ── Layout ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Layout</div>
        <Slider label="Band Width" value={params.sectionWidth}
                min={200} max={1400} step={50} unit="px"
                onChange={v => set('sectionWidth', v)}
                hint="Default width for all sections" />
        <Slider label="Tree Width" value={params.treeWidth}
                min={50} max={params.sectionWidth - 50} step={10} unit="px"
                onChange={v => set('treeWidth', v)}
                hint="Default tree zone width (override per section below)" />
        <Slider label="Wall Height" value={params.wallHeight}
                min={100} max={600} step={10} unit="px"
                onChange={v => set('wallHeight', v)}
                hint="Total height of the pattern band" />
        <Slider label="Frame Strip H" value={params.growthFrameH}
                min={40} max={400} step={10} unit="px"
                onChange={v => set('growthFrameH', v)}
                hint="Height of each growth frame strip below the main band" />
      </section>

      {/* ── Tree of Life ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Tree of Life</div>

        <div className="ctrl-label">Branch style</div>
        <div className="motif-btns">
          <button
            className={`motif-btn ${params.treeStyle === 'data' ? 'active' : ''}`}
            onClick={() => set('treeStyle', 'data')}
          >data</button>
          <button
            className={`motif-btn ${params.treeStyle === 'tree' ? 'active' : ''}`}
            onClick={() => set('treeStyle', 'tree')}
          >tree</button>
        </div>

        <Slider label="Tree Depth" value={params.treeDepth}
                min={0} max={3} step={0.05} unit="×"
                onChange={v => set('treeDepth', v)}
                hint="How tall the silhouette rises (0=flat, 2=deep)" />

        <Slider label="Stitch Size" value={params.stitchSize}
                min={0.5} max={4} step={0.25} unit="×"
                onChange={v => set('stitchSize', v)}
                hint="Cell size multiplier — smaller = more lines" />

        <div className="ctrl-label">Motif</div>
        <div className="motif-btns">
          {['none','diamond','chevron','star','all'].map(m => (
            <button key={m}
              className={`motif-btn ${params.motifType === m ? 'active' : ''}`}
              onClick={() => set('motifType', m)}
            >{m}</button>
          ))}
        </div>

        <Slider label="Motif Scale" value={params.motifScale}
                min={1} max={8} step={1} unit=" cells"
                onChange={v => set('motifScale', v)}
                hint="Tile repeat size — larger = bigger diamonds / wider chevrons" />
      </section>

      {/* ── Image input ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Image Input</div>
        <Slider label="Image Resolution" value={params.imageLineWeight}
                min={0.5} max={8} step={0.5} unit="×"
                onChange={v => set('imageLineWeight', v)}
                hint="Higher = coarser grid = more recognisable shape; lower = finer detail" />
      </section>

      {/* ── Location stops ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">
          Stops
          <span className="ctrl-count"> — {activeLocations.length} active</span>
        </div>
        <p className="slider-hint" style={{ marginBottom: 8 }}>
          Toggle locations on/off. Order follows the geographic journey east → west.
        </p>
        {GEO_ORDER.map(id => (
          <LocationCard
            key={id}
            locId={id}
            isActive={activeLocations.includes(id)}
            locationData={locationData}
            params={params}
            sectionWidths={sectionWidths}
            treeWidths={treeWidths}
            onToggle={onToggle}
            onUpload={onUpload}
            onSectionWidth={onSectionWidth}
            onTreeWidth={onTreeWidth}
          />
        ))}
      </section>

      {/* ── Export / Session ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Export</div>

        <div className="session-row">
          <button className="export-btn-panel" onClick={onExportAllSvg}>All SVG</button>
          <button className="export-btn-panel" onClick={onExportAllJpeg}>All JPG</button>
        </div>

        <div className="export-section-list">
          {activeLocations.map(id => {
            const loc = LOCATIONS[id];
            return (
              <div key={id} className="export-loc-row">
                <span className="export-loc-name">{loc.name}</span>
                <button className="session-btn" onClick={() => onExportSectionSvg(id)}>SVG</button>
                <button className="session-btn" onClick={() => onExportSectionJpeg(id)}>JPG</button>
              </div>
            );
          })}
        </div>

        <div className="session-row" style={{ marginTop: 10 }}>
          <button className="session-btn" onClick={onSaveSession}>Save session</button>
          <label className="session-btn">
            Load session
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={onLoadSession} />
          </label>
        </div>
      </section>

    </aside>
  );
}
