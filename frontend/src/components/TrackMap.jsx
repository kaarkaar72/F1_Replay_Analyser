import { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceDot, Label } from 'recharts';
import { GitCompare, Users, X } from 'lucide-react';
import LiveFeed from './LiveFeed';

const API_URL = "http://localhost:8000";

export default function TrackMap({ sessionKey, drivers, trackImage, latestEvent, currentLap, totalLaps, onCompareRequest }) {
  const [trackData, setTrackData] = useState({ shape: [], corners: [] });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!sessionKey) return;
    setTrackData({ shape: [], corners: [] });
    fetch(`${API_URL}/track/${sessionKey}`)
      .then(res => res.json())
      .then(data => setTrackData(data))
      .catch(console.error);
  }, [sessionKey]);

  const secureUrl = url => url?.replace('http://', 'https://');
  const driverList = Object.values(drivers);

  // Group into teammate pairs by team_name
  const teammatePairs = Object.values(
    driverList.reduce((acc, d) => {
      if (!d.team_name) return acc;
      if (!acc[d.team_name]) acc[d.team_name] = [];
      acc[d.team_name].push(d);
      return acc;
    }, {})
  ).filter(arr => arr.length >= 2);

  const toggleDriver = (driver) => {
    if (!compareMode) return;
    setSelectedIds(prev => {
      if (prev.includes(driver.driver_id)) return prev.filter(id => id !== driver.driver_id);
      if (prev.length >= 2) return [...prev.slice(1), driver.driver_id];
      return [...prev, driver.driver_id];
    });
  };

  const fireCompare = (ids) => {
    const [a, b] = ids.map(id => drivers[id]).filter(Boolean);
    if (a && b && onCompareRequest) onCompareRequest(a, b);
  };

  const handleTeammateCompare = (pair) => {
    const ids = [pair[0].driver_id, pair[1].driver_id];
    setSelectedIds(ids);
    setCompareMode(true);
    fireCompare(ids);
  };

  const exitCompare = () => { setCompareMode(false); setSelectedIds([]); };

  // Custom SVG marker for each car
  const DriverMarker = ({ cx, cy, payload }) => {
    if (!cx || !cy) return null;
    const selIdx = selectedIds.indexOf(payload.driver_id);
    const isSelected = selIdx !== -1;
    const badgeColor = selIdx === 0 ? '#f59e0b' : '#22c55e';
    const showLabel = (payload.speed || 0) > 5;
    const teamColor = payload.team_color || '#475569';

    return (
      <g onClick={() => toggleDriver(payload)} style={{ cursor: compareMode ? 'pointer' : 'default' }}>
        {/* Selection halo */}
        {isSelected && (
          <circle cx={cx} cy={cy} r={14} fill={badgeColor} fillOpacity={0.12}
            stroke={badgeColor} strokeWidth={1.5} strokeDasharray="4 2" />
        )}
        {/* Outer ring (team color glow) */}
        <circle cx={cx} cy={cy} r={9} fill={teamColor} fillOpacity={0.25} stroke="none" />
        {/* Main dot */}
        <circle cx={cx} cy={cy} r={6} fill={teamColor} stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
        {/* Driver name pill */}
        {showLabel && (
          <g>
            <rect x={cx - 14} y={cy - 25} width={28} height={12} rx={3}
              fill={teamColor} fillOpacity={0.9} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <text x={cx} y={cy - 16} fill="white" textAnchor="middle"
              fontSize="8.5" fontWeight="bold" fontFamily="monospace">
              {payload.name}
            </text>
          </g>
        )}
        {/* Selection badge number */}
        {isSelected && (
          <g>
            <circle cx={cx + 9} cy={cy - 9} r={5.5} fill={badgeColor} stroke="#080c14" strokeWidth={1} />
            <text x={cx + 9} y={cy - 5.5} fill="black" textAnchor="middle"
              fontSize="7" fontWeight="bold">{selIdx + 1}</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="bg-[#080c14] rounded-2xl border border-slate-800/70 shadow-2xl h-[700px] flex flex-col overflow-hidden">

      {/* ── HEADER BAR ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-gradient-to-r from-slate-900/80 to-slate-900/40 backdrop-blur-sm">

        {/* Left: title */}
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-5 bg-red-500 rounded-full" />
          <span className="text-[11px] font-extrabold tracking-[0.18em] text-slate-400 uppercase">Live Circuit</span>
          {driverList.length > 0 && (
            <span className="text-[10px] text-slate-700 font-mono">{driverList.length} cars</span>
          )}
        </div>

        {/* Right: compare toolbar */}
        <div className="flex items-center gap-2">

          {/* Teammate quick-compare pills */}
          {!compareMode && teammatePairs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mr-1">Teammates</span>
              {teammatePairs.slice(0, 5).map(pair => (
                <button
                  key={pair[0].team_name}
                  onClick={() => handleTeammateCompare(pair)}
                  title={`Compare ${pair[0].name} vs ${pair[1].name}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 hover:border-slate-600 transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pair[0].team_color }} />
                  <span className="text-slate-300">{pair[0].name}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-300">{pair[1].name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Status hint */}
          {compareMode && (
            <span className="text-[10px] font-mono text-slate-500">
              {selectedIds.length === 0 && 'Click 2 drivers on track'}
              {selectedIds.length === 1 && 'Select 1 more driver'}
              {selectedIds.length === 2 && 'Ready —'}
            </span>
          )}

          {/* Confirm compare */}
          {compareMode && selectedIds.length === 2 && (
            <button
              onClick={() => fireCompare(selectedIds)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-900/30"
            >
              Compare
            </button>
          )}

          {/* Toggle compare mode */}
          <button
            onClick={() => compareMode ? exitCompare() : setCompareMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              compareMode
                ? 'bg-slate-700/80 border-slate-600 text-white'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            <GitCompare size={12} />
            {compareMode ? 'Cancel' : 'Compare'}
          </button>
        </div>
      </div>

      {/* ── MAP BODY ── */}
      <div className="flex-grow relative overflow-hidden">

        {/* Background radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(15,30,60,0.5),transparent_72%)] pointer-events-none" />

        {/* ── HUD: LAP COUNTER ── */}
        <div className="absolute top-3 left-3 z-20">
          <div className="bg-black/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2.5 shadow-2xl">
            <div className="text-[9px] font-extrabold tracking-[0.25em] text-slate-500 uppercase mb-0.5">Lap</div>
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-[28px] font-black text-white tabular-nums tracking-tight">
                {currentLap || '—'}
              </span>
              <span className="text-sm font-bold text-slate-500">/ {totalLaps || '—'}</span>
            </div>
          </div>
        </div>

        {/* ── HUD: SPEED LEGEND ── */}
        <div className="absolute top-3 right-3 z-20">
          <div className="bg-black/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2.5 shadow-xl">
            <div className="text-[9px] font-extrabold tracking-[0.2em] text-slate-500 uppercase mb-2">Speed</div>
            <div className="space-y-1.5">
              {[
                { color: '#ef4444', label: '> 290 km/h', shadow: '#ef444440' },
                { color: '#eab308', label: '200 – 290',  shadow: '#eab30840' },
                { color: '#22c55e', label: '100 – 200',  shadow: '#22c55e40' },
                { color: '#3b82f6', label: '< 100 km/h', shadow: '#3b82f640' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 5px ${s.shadow}` }} />
                  <span className="text-[9px] text-slate-400 font-mono tabular-nums">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Circuit thumbnail ── */}
        {trackImage && (
          <div className="absolute bottom-3 right-3 z-10 w-20 h-20 bg-black/50 rounded-xl border border-slate-700/50 p-1.5 pointer-events-none">
            <img src={secureUrl(trackImage)} alt="Circuit"
              className="w-full h-full object-contain invert opacity-40" />
          </div>
        )}

        {/* ── Empty state ── */}
        {trackData.shape.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-700 text-sm font-bold tracking-widest uppercase">
              Waiting for session…
            </span>
          </div>
        )}

        {/* ── Compare hint bar ── */}
        {compareMode && selectedIds.length < 2 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-blue-950/90 backdrop-blur border border-blue-500/30 rounded-full px-4 py-1.5 flex items-center gap-2">
              <GitCompare size={11} className="text-blue-400" />
              <span className="text-[11px] font-bold text-blue-300">
                {selectedIds.length === 0
                  ? 'Click a driver on the track to select'
                  : 'Select one more driver'}
              </span>
            </div>
          </div>
        )}

        {/* ── Selected drivers strip ── */}
        {compareMode && selectedIds.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex gap-2">
            {selectedIds.map((id, i) => {
              const d = drivers[id];
              if (!d) return null;
              return (
                <div key={id} className="flex items-center gap-2 bg-black/85 backdrop-blur border border-slate-700/80 rounded-lg px-2.5 py-1.5">
                  <span className={`text-[9px] font-extrabold tabular-nums ${i === 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {i + 1}
                  </span>
                  <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: d.team_color }} />
                  <span className="text-[11px] font-bold text-white font-mono">{d.name}</span>
                  <button
                    onClick={() => setSelectedIds(prev => prev.filter(x => x !== id))}
                    className="text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TRACK CHART ── */}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 40, right: 60, bottom: 10, left: 60 }}>
            <XAxis type="number" dataKey="x" hide domain={['dataMin - 600', 'dataMax + 600']} />
            <YAxis type="number" dataKey="y" hide domain={['dataMin - 600', 'dataMax + 600']} />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 8,
                fontSize: 11,
                padding: '6px 10px',
              }}
              itemStyle={{ color: '#94a3b8' }}
              labelStyle={{ display: 'none' }}
            />

            {/* Track: shadow base */}
            <Scatter
              name="shadow"
              data={trackData.shape}
              fill="none"
              line={{ stroke: '#04060a', strokeWidth: 24, strokeLinecap: 'round', strokeLinejoin: 'round' }}
              shape={() => null}
              isAnimationActive={false}
            />
            {/* Track: outer edge / kerb hint */}
            <Scatter
              name="edge"
              data={trackData.shape}
              fill="none"
              line={{ stroke: '#1a2535', strokeWidth: 18, strokeLinecap: 'round', strokeLinejoin: 'round' }}
              shape={() => null}
              isAnimationActive={false}
            />
            {/* Track: asphalt surface */}
            <Scatter
              name="surface"
              data={trackData.shape}
              fill="none"
              line={{ stroke: '#0e1a26', strokeWidth: 13, strokeLinecap: 'round', strokeLinejoin: 'round' }}
              shape={() => null}
              isAnimationActive={false}
            />
            {/* Track: center marking */}
            <Scatter
              name="center"
              data={trackData.shape}
              fill="none"
              line={{ stroke: '#162030', strokeWidth: 2, strokeDasharray: '10 10', strokeLinecap: 'round' }}
              shape={() => null}
              isAnimationActive={false}
            />

            {/* Corner markers */}
            {trackData.corners.map((corner) => (
              <ReferenceDot
                key={corner.number}
                x={corner.x}
                y={corner.y}
                r={3}
                fill="#2d3f52"
                stroke="#080c14"
                strokeWidth={1}
                isFront={true}
              >
                <Label
                  value={corner.number}
                  position="top"
                  offset={7}
                  style={{ fill: '#3d5060', fontSize: '9px', fontWeight: '700', fontFamily: 'monospace' }}
                />
              </ReferenceDot>
            ))}

            {/* Live cars */}
            <Scatter
              name="cars"
              data={driverList}
              shape={<DriverMarker />}
              isAnimationActive={false}
            >
              {driverList.map(d => (
                <Cell key={`car-${d.driver_id}`} fill={d.team_color || '#64748b'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Live feed overlay */}
        <div className="absolute bottom-16 left-2 z-20 pointer-events-none">
          <LiveFeed latestEvent={latestEvent} />
        </div>
      </div>
    </div>
  );
}
