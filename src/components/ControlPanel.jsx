import { LOCATIONS, GEO_ORDER } from '../data/locations';
import { ditherImageFile, grayscaleImageFile, applyThreshold } from '../patterns/dither';
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

  const threshold = data?.threshold ?? 0.5;

  // rawKey stores the float grayscale; gridKey stores the thresholded binary
  const makeFileHandler = (gridKey, rawKey, previewKey) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { rawGray, grid } = await ditherImageFile(file, 48, threshold);
      const previewUrl = URL.createObjectURL(file);
      onUpload(locId, { [gridKey]: grid, [rawKey]: rawGray, [previewKey]: previewUrl });
    } catch (err) {
      console.error('Dither failed', err);
    }
  };

  const handleThresholdChange = (t) => {
    // Recompute all zone grids from stored raw data at new threshold
    const updates = { threshold: t };
    if (data?.crownRaw)  updates.crownGrid  = applyThreshold(data.crownRaw,  t);
    if (data?.branchRaw) updates.branchGrid = applyThreshold(data.branchRaw, t);
    if (data?.rootRaw)   updates.rootGrid   = applyThreshold(data.rootRaw,   t);
    onUpload(locId, updates);
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
          {/* ── Tree zone: Crown / Branch / Root ── */}
          <div className="loc-section-title">Tree zones</div>

          {[
            { key: 'crownGrid',  rawKey: 'crownRaw',  previewKey: 'previewCrown',  label: 'Crown' },
            { key: 'branchGrid', rawKey: 'branchRaw', previewKey: 'previewBranch', label: 'Branch' },
            { key: 'rootGrid',   rawKey: 'rootRaw',   previewKey: 'previewRoot',   label: 'Root' },
          ].map(({ key, rawKey, previewKey, label }) => (
            <div key={key} className="loc-upload-row">
              <span className="loc-upload-label">{label}</span>
              <label className={`upload-btn ${data?.[key] ? 'active' : ''}`}>
                {data?.[key] ? '✓' : '+'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                       onChange={makeFileHandler(key, rawKey, previewKey)} />
              </label>
              {data?.[key] && (
                <button className="clear-btn"
                        onClick={() => onUpload(locId, { [key]: null, [previewKey]: null })}>×</button>
              )}
              {data?.[previewKey] && (
                <img src={data[previewKey]} className="loc-preview-thumb" alt="" />
              )}
            </div>
          ))}

          {/* Threshold slider — only when at least one zone image exists */}
          {(data?.crownRaw || data?.branchRaw || data?.rootRaw) && (
            <div className="loc-width-row">
              <span className="loc-width-label">Thresh</span>
              <input type="range" min={5} max={95} step={1}
                     value={Math.round(threshold * 100)}
                     onChange={e => handleThresholdChange(Number(e.target.value) / 100)} />
              <span className="loc-width-val">{Math.round(threshold * 100)}%</span>
            </div>
          )}

          {/* Symmetry toggle */}
          <div className="loc-upload-row">
            <span className="loc-upload-label">Mirror</span>
            <button
              className={`upload-btn ${data?.zoneSymmetry ? 'active' : ''}`}
              onClick={() => onUpload(locId, { zoneSymmetry: !data?.zoneSymmetry })}
            >
              {data?.zoneSymmetry ? '⟷ on' : '⟷ off'}
            </button>
          </div>

          {/* Zone proportions — Crown / Branch (Root = remainder) */}
          {(data?.crownGrid || data?.branchGrid || data?.rootGrid) && (
            <>
              <div className="loc-width-row">
                <span className="loc-width-label">Crown</span>
                <input type="range" min={5} max={60} step={5}
                       value={Math.round((data?.crownFrac ?? 0.30) * 100)}
                       onChange={e => onUpload(locId, { crownFrac: Number(e.target.value) / 100 })} />
                <span className="loc-width-val">{Math.round((data?.crownFrac ?? 0.30) * 100)}%</span>
              </div>
              <div className="loc-width-row">
                <span className="loc-width-label">Branch</span>
                <input type="range" min={5} max={60} step={5}
                       value={Math.round((data?.branchFrac ?? 0.40) * 100)}
                       onChange={e => onUpload(locId, { branchFrac: Number(e.target.value) / 100 })} />
                <span className="loc-width-val">{Math.round((data?.branchFrac ?? 0.40) * 100)}%</span>
              </div>
            </>
          )}

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
        </>
      )}
    </div>
  );
}

export default function ControlPanel({
  params, onChange,
  activeLocations, locationData,
  sectionWidths, treeWidths,
  onToggle, onUpload, onSectionWidth, onTreeWidth, onExport,
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
      </section>

      {/* ── Tree of Life ── */}
      <section className="ctrl-section">
        <div className="ctrl-title">Tree of Life</div>

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
        <Slider label="Image Line Weight" value={params.imageLineWeight}
                min={0.5} max={8} step={0.5} unit="px"
                onChange={v => set('imageLineWeight', v)}
                hint="Stroke weight of image-derived line segments" />
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
        <button className="export-btn-panel" onClick={onExport}>Export SVG</button>
        <div className="session-row">
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
