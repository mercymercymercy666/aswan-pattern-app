import { useState, useRef } from 'react';
import OptionSwitch from './components/OptionSwitch';
import PatternWall from './components/PatternWall';
import ControlPanel from './components/ControlPanel';
import { OPTIONS, GEO_ORDER } from './data/locations';
import './App.css';

const DEFAULT_PARAMS = {
  mode:            'lines',
  lineSpacing:     8,
  lineWidth:       2.5,
  moireAngle:      4,
  coordMix:        8,
  sectionWidth:    600,
  treeWidth:       200,
  wallHeight:      304,
  treeDepth:       1.0,
  stitchSize:      1.0,
  motifType:       'diamond',
  motifScale:      3,
  imageLineWeight: 2.5,
  treeStyle:       'data',  // 'data' | 'tree'
  horizWeight:     1.0,    // horizontal grid line weight as fraction of lineWidth (0 = off)
  horizHeight:     0.25,   // fraction of band height from bottom that shows horizontal lines
};

export default function App() {
  const [option,          setOption]         = useState(1);
  const [activeLocations, setActiveLocations] = useState(OPTIONS[1].locations);
  const [params,          setParams]          = useState(DEFAULT_PARAMS);
  const [locationData,    setLocationData]    = useState({});
  const [sectionWidths,   setSectionWidths]   = useState({});
  const [treeWidths,      setTreeWidths]      = useState({});
  const [showPortions,    setShowPortions]    = useState(true);

  // PatternWall registers its doExport here so ControlPanel can trigger it
  const exportRef = useRef(null);
  const handleExportAllSvg      = ()   => exportRef.current?.exportAllSvg?.();
  const handleExportAllJpeg     = ()   => exportRef.current?.exportAllJpeg?.();
  const handleExportSectionSvg  = (id) => exportRef.current?.exportSectionSvg?.(id);
  const handleExportSectionJpeg = (id) => exportRef.current?.exportSectionJpeg?.(id);

  const handleOptionChange = (opt) => {
    setOption(opt);
    setActiveLocations(OPTIONS[opt].locations);
  };

  const handleToggle = (locId) => {
    setActiveLocations(prev => {
      if (prev.includes(locId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== locId);
      } else {
        const next = new Set([...prev, locId]);
        return GEO_ORDER.filter(id => next.has(id));
      }
    });
  };

  const handleUpload = (locId, data) => {
    // Merge into existing locationData entry so tree/moireA/moireB coexist
    setLocationData(prev => ({ ...prev, [locId]: { ...prev[locId], ...data } }));
  };

  const handleSectionWidth = (locId, w) => {
    setSectionWidths(prev => ({ ...prev, [locId]: w }));
  };

  const handleTreeWidth = (locId, w) => {
    setTreeWidths(prev => ({ ...prev, [locId]: w }));
  };

  // ── Session save / load ──────────────────────────────────
  const handleSaveSession = () => {
    // Blob URLs can't be serialised — strip all preview keys, keep only grids/data
    const stripPreviews = (obj) => {
      if (!obj) return obj;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.startsWith('blob:')) continue;
        out[k] = v;
      }
      return out;
    };
    const session = {
      params,
      activeLocations,
      sectionWidths,
      treeWidths,
      locationData: Object.fromEntries(
        Object.entries(locationData).map(([id, d]) => [id, stripPreviews(d)])
      ),
    };
    const blob = new Blob([JSON.stringify(session)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `aswan-session-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleLoadSession = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const s = JSON.parse(ev.target.result);
        if (s.params)          setParams(s.params);
        if (s.activeLocations) setActiveLocations(s.activeLocations);
        if (s.sectionWidths)   setSectionWidths(s.sectionWidths);
        if (s.treeWidths)      setTreeWidths(s.treeWidths);
        if (s.locationData)    setLocationData(s.locationData);
      } catch (err) {
        console.error('Session load failed', err);
        alert('Could not load session file.');
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be reloaded
    e.target.value = '';
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="header-brand-top">
            <span className="header-title">ASWAN</span>
            <span className="header-sub">Tree of Life — Nizari Ismaili Patternwork</span>
          </div>
          <span className="header-desc">Each country's coordinates are encoded as pattern — longitude sets line density and branch rhythm, latitude sets moiré angle and tree silhouette — together a displacement map for stone carving.</span>
        </div>
        <div className="header-right">
          <span className="preset-label">Presets</span>
          <OptionSwitch value={option} onChange={handleOptionChange} />
        </div>
      </header>

      <div className="app-body">
        <ControlPanel
          params={params}
          onChange={setParams}
          activeLocations={activeLocations}
          locationData={locationData}
          sectionWidths={sectionWidths}
          treeWidths={treeWidths}
          onToggle={handleToggle}
          onUpload={handleUpload}
          onSectionWidth={handleSectionWidth}
          onTreeWidth={handleTreeWidth}
          onExportAllSvg={handleExportAllSvg}
          onExportAllJpeg={handleExportAllJpeg}
          onExportSectionSvg={handleExportSectionSvg}
          onExportSectionJpeg={handleExportSectionJpeg}
          onSaveSession={handleSaveSession}
          onLoadSession={handleLoadSession}
        />

        <main className="app-main">
          <div className="wall-toolbar">
            <button
              className={`portions-btn ${showPortions ? 'active' : ''}`}
              onClick={() => setShowPortions(v => !v)}
            >
              {showPortions ? '◼ Portions' : '◻ Portions'}
            </button>
          </div>
          <PatternWall
            activeLocations={activeLocations}
            params={params}
            locationData={locationData}
            sectionWidths={sectionWidths}
            treeWidths={treeWidths}
            showPortions={showPortions}
            exportRef={exportRef}
          />
        </main>
      </div>
    </div>
  );
}
