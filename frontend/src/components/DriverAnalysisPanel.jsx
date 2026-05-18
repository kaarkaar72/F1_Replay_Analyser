import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap, Wind, Timer, Gauge, Activity, TrendingUp, Trophy,
  X, Settings, Flame, Hand, Map, Table, ChevronDown, ChevronUp,
  Sliders, Cpu, BarChart2, Clock, GitCommit
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DriverTrackMap from './DriverTrackMap';

const API_URL = "http://localhost:8000";

const formatLapTime = (seconds) => {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
};

export default function DriverAnalysisPanel({ driver, sessionKey, trackData, currentTimestamp, onClose }) {
  const [laps, setLaps] = useState({ laps: [], stats: null });
  const [lapA, setLapA] = useState(null);
  const [lapB, setLapB] = useState(null);
  const [lapDataA, setLapDataA] = useState(null);
  const [lapDataB, setLapDataB] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [personalBest, setPersonalBest] = useState(null);
  const [showTraces, setShowTraces] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const compareMode = lapA !== null && lapB !== null;

  // Track whether lapA was auto-selected (vs manually chosen by user)
  const isAutoSelected = useRef(true);
  const lapCountRef = useRef(0);

  const fetchLapData = async (lap) => {
    const res = await fetch(`${API_URL}/analysis/lap-telemetry/${sessionKey}/${driver.driver_id}/${lap}`);
    return res.json();
  };

  // Initial load
  useEffect(() => {
    isAutoSelected.current = true;
    lapCountRef.current = 0;
    setLapA(null); setLapB(null); setLapDataA(null); setLapDataB(null);
    Promise.all([
      fetch(`${API_URL}/analysis/laps/${sessionKey}/${driver.driver_id}`).then(r => r.json()),
      fetch(`${API_URL}/analysis/best-driver-lap/${sessionKey}/${driver.driver_id}`).then(r => r.json()),
    ]).then(([lapList, pb]) => {
      setLaps(lapList);
      setPersonalBest(pb);
      lapCountRef.current = lapList.laps?.length || 0;
      if (lapList.laps?.length > 0) {
        const lastLap = lapList.laps[lapList.laps.length - 1].lap;
        setLapA(lastLap);
        setIsLoading(true);
        fetchLapData(lastLap).then(d => { setLapDataA(d); setIsLoading(false); });
      }
    });
  }, [driver.driver_id, sessionKey]);

  // Live polling — detect new laps and refresh panel
  useEffect(() => {
    const poll = async () => {
      try {
        const [lapList, pb] = await Promise.all([
          fetch(`${API_URL}/analysis/laps/${sessionKey}/${driver.driver_id}`).then(r => r.json()),
          fetch(`${API_URL}/analysis/best-driver-lap/${sessionKey}/${driver.driver_id}`).then(r => r.json()),
        ]);
        const newLapCount = lapList.laps?.length || 0;
        const hasNewLap = newLapCount > lapCountRef.current;
        lapCountRef.current = newLapCount;
        setLaps(lapList);
        setPersonalBest(pb);
        // Auto-advance to newest lap only if the user hasn't manually selected one
        if (hasNewLap && isAutoSelected.current && lapList.laps?.length > 0) {
          const lastLap = lapList.laps[lapList.laps.length - 1].lap;
          setLapA(lastLap);
          setIsLoading(true);
          fetchLapData(lastLap).then(d => { setLapDataA(d); setIsLoading(false); });
        }
      } catch (_) {}
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [driver.driver_id, sessionKey]);

  const handleLapClick = async (lap) => {
    isAutoSelected.current = false;
    if (lap === lapA) {
      // Deselect A → promote B to A
      setLapA(lapB); setLapDataA(lapDataB);
      setLapB(null); setLapDataB(null);
      return;
    }
    if (lap === lapB) {
      setLapB(null); setLapDataB(null);
      return;
    }
    if (lapA === null) {
      setIsLoading(true);
      setLapA(lap);
      fetchLapData(lap).then(d => { setLapDataA(d); setIsLoading(false); });
    } else {
      setLapB(lap);
      fetchLapData(lap).then(setLapDataB);
    }
  };

  // Merged trace keyed by integer distance_pct (0–100)
  const mergedTrace = useMemo(() => {
    if (!lapDataA?.trace) return [];
    const mapA = {}, mapB = {};
    lapDataA.trace.forEach(p => { mapA[Math.round(p.distance_pct)] = p; });
    lapDataB?.trace?.forEach(p => { mapB[Math.round(p.distance_pct)] = p; });
    return Array.from({ length: 101 }, (_, i) => ({
      distance_pct: i,
      speedA: mapA[i]?.speed ?? null,
      speedB: mapB[i]?.speed ?? null,
      throttleA: mapA[i]?.throttle ?? null,
      brakeA: mapA[i]?.brake ?? null,
      gearA: mapA[i]?.gear ?? null,
      gearB: mapB[i]?.gear ?? null,
    }));
  }, [lapDataA, lapDataB]);

  const lapInfoA = laps.laps?.find(l => l.lap === lapA);
  const lapInfoB = laps.laps?.find(l => l.lap === lapB);

  // Lap with the lowest total sector time = driver's personal best lap number
  const bestLapNum = useMemo(() => {
    if (!laps.laps?.length) return null;
    let best = null, bestTime = Infinity;
    laps.laps.forEach(l => {
      const total = (l.s1 ?? 0) + (l.s2 ?? 0) + (l.s3 ?? 0);
      if (total > 0 && total < bestTime) { bestTime = total; best = l.lap; }
    });
    return best;
  }, [laps.laps]);

  return (
    <div className="h-full flex flex-col bg-[#0a0f1a] border-t border-slate-700/60">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60 bg-slate-900/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={driver.headshot}
              className="w-9 h-9 rounded-lg bg-slate-800 object-cover border"
              style={{ borderColor: driver.team_color }}
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0a0f1a]"
              style={{ backgroundColor: driver.team_color }} />
          </div>
          <div>
            <div className="font-black text-white text-sm leading-none">{driver.name}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-0.5">{driver.team_name}</div>
          </div>
          <div className="h-5 w-px bg-slate-700 mx-1" />
          <KpiBadge icon={Timer} label="Best" value={personalBest?.sectors?.lap_duration ? formatLapTime(personalBest.sectors.lap_duration) : '—'} color="text-purple-400" />
          <KpiBadge icon={Activity} label="Consistency" value={laps.stats?.consistency ? `±${laps.stats.consistency.toFixed(2)}s` : '—'} color="text-green-400" />
          <KpiBadge icon={Trophy} label="Avg Pace" value={laps.stats?.avg_pace ? formatLapTime(laps.stats.avg_pace) : '—'} color="text-blue-400" />
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* ── METRICS STRIP (always visible, top) ── */}
      {lapDataA?.metrics && (
        <div className="flex-shrink-0 border-b border-slate-700/40 bg-slate-900/50">
          <div className="grid grid-cols-8 gap-1.5 px-4 pt-2 pb-1.5">
            <MetricCard label="Top Speed" value={lapDataA.metrics.max_speed} unit="km/h" icon={Gauge} color="text-blue-400" />
            <MetricCard label="Avg Speed" value={lapDataA.metrics.avg_speed?.toFixed(0)} unit="km/h" icon={Activity} color="text-purple-400" />
            <MetricCard label="Full Throttle" value={`${lapDataA.metrics.full_throttle_pct?.toFixed(0)}%`} icon={Zap} color="text-green-400" />
            <MetricCard label="Braking Zones" value={lapDataA.metrics.braking_zones} icon={X} color="text-red-400" />
            <MetricCard label="Coasting" value={`${lapDataA.metrics.coast_duration}s`} icon={Wind} color="text-slate-400" />
            <MetricCard label="Gear Changes" value={lapDataA.metrics.gear_shifts} icon={Settings} color="text-yellow-400" />
            <MetricCard label="Aggression" value={lapDataA.metrics.throttle_aggression} icon={Flame} color="text-orange-400" />
            <MetricCard label="Grip Score" value={lapDataA.metrics.low_speed_grip} icon={Hand} color="text-cyan-400" />
          </div>
          {lapDataA.advanced_metrics && (
            <div className="grid grid-cols-5 gap-1.5 px-4 pb-2">
              <MetricCard label="Throttle Smooth" value={`${(lapDataA.advanced_metrics.throttle_smoothness * 100).toFixed(1)}%`} icon={Sliders} color="text-teal-400" />
              <MetricCard label="G-Force Util." value={`${(lapDataA.advanced_metrics.g_force_utilization * 100).toFixed(1)}%`} icon={Cpu} color="text-indigo-400" />
              <MetricCard label="Accel. Gradient" value={lapDataA.advanced_metrics.acceleration_gradient?.toFixed(1)} unit="km/h/s" icon={BarChart2} color="text-lime-400" />
              <MetricCard label="Brake Duration" value={`${lapDataA.advanced_metrics.braking_zone_duration?.toFixed(1)}s`} icon={Clock} color="text-rose-400" />
              <MetricCard label="Line Consist." value={(lapDataA.advanced_metrics.line_consistency * 100).toFixed(2)} icon={GitCommit} color="text-amber-400" />
            </div>
          )}
        </div>
      )}

      {/* ── CONTENT AREA ── */}
      <div className="flex flex-grow overflow-hidden min-h-0">

        {/* LEFT: LAP SELECTOR */}
        <div className="w-52 flex-shrink-0 border-r border-slate-700/60 flex flex-col bg-slate-900/20 min-h-0">
          <div className="px-3 py-1.5 border-b border-slate-700/40 flex items-center justify-between flex-shrink-0">
            <span className="text-[9px] font-extrabold tracking-widest text-slate-500 uppercase">Laps</span>
            {compareMode
              ? <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">COMPARE</span>
              : <span className="text-[9px] text-slate-700 italic">tap 2 to compare</span>
            }
          </div>

          {/* Personal best banner */}
          {personalBest?.sectors?.lap_duration && (
            <div className="flex justify-between items-center px-3 py-1 bg-purple-900/20 border-b border-purple-500/20 flex-shrink-0">
              <span className="text-[8px] font-extrabold text-purple-400 tracking-widest">PB</span>
              <span className="text-[10px] font-mono font-bold text-purple-300">
                {formatLapTime(personalBest.sectors.lap_duration)}
              </span>
            </div>
          )}

          {/* Lap rows — sorted numerically, fixed height + scroll */}
          <div className="overflow-y-auto py-1 custom-scrollbar" style={{ maxHeight: '180px' }}>
            {[...(laps.laps || [])].sort((a, b) => Number(a.lap) - Number(b.lap)).map(l => {
              const isA = l.lap === lapA;
              const isB = l.lap === lapB;
              const isBest = l.lap === bestLapNum && !isA && !isB;
              return (
                <div
                  key={l.lap}
                  onClick={() => handleLapClick(l.lap)}
                  className={`mx-1.5 mb-0.5 px-2 py-1.5 rounded-lg cursor-pointer flex items-center justify-between border transition-all ${
                    isA    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                    : isB  ? 'bg-amber-500/15 border-amber-400/40 text-white'
                    : isBest ? 'bg-purple-600/15 border-purple-500/35 text-white'
                    : 'bg-transparent border-transparent hover:bg-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isA    && <span className="text-[7px] font-black bg-blue-500 text-white px-1 py-0.5 rounded shrink-0">A</span>}
                    {isB    && <span className="text-[7px] font-black bg-amber-500 text-black px-1 py-0.5 rounded shrink-0">B</span>}
                    {isBest && <span className="text-[7px] font-black bg-purple-500 text-white px-1 py-0.5 rounded shrink-0">PB</span>}
                    <span className={`text-[10px] font-bold font-mono ${isA || isB ? 'text-white' : isBest ? 'text-purple-200' : ''}`}>L{l.lap}</span>
                  </div>
                  <div className="flex gap-1 text-[9px] font-mono">
                    <span className={isBest ? 'text-purple-300' : 'text-slate-300'}>{l.time}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compare deltas section */}
          {compareMode && lapInfoA && lapInfoB && (
            <div className="border-t border-slate-700/60 flex-shrink-0 p-2 bg-slate-900/60">
              <div className="text-[8px] font-extrabold text-slate-600 tracking-widest uppercase mb-1.5 px-1">
                L{lapA} vs L{lapB} — delta
              </div>
              <div className="space-y-0.5">
                <DeltaRow label="S1" a={lapInfoA.s1} b={lapInfoB.s1} lowerIsBetter />
                <DeltaRow label="S2" a={lapInfoA.s2} b={lapInfoB.s2} lowerIsBetter />
                <DeltaRow label="S3" a={lapInfoA.s3} b={lapInfoB.s3} lowerIsBetter />
                {lapDataA?.metrics && lapDataB?.metrics && (
                  <>
                    <DeltaRow label="Top Spd" a={lapDataA.metrics.max_speed} b={lapDataB.metrics.max_speed} higherIsBetter />
                    <DeltaRow label="Throttle" a={lapDataA.metrics.full_throttle_pct} b={lapDataB.metrics.full_throttle_pct} higherIsBetter />
                    <DeltaRow label="Braking" a={lapDataA.metrics.braking_zones} b={lapDataB.metrics.braking_zones} lowerIsBetter />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CENTER: MAIN MAP / TABLE + TRACES */}
        <div className="flex-grow flex flex-col overflow-hidden min-h-0">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/40 bg-slate-900/40 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowTable(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  !showTable ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-800 text-slate-500 hover:text-white border border-slate-700'
                }`}
              >
                <Map size={10} /> Map
              </button>
              <button
                onClick={() => setShowTable(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  showTable ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-800 text-slate-500 hover:text-white border border-slate-700'
                }`}
              >
                <Table size={10} /> Table
              </button>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="w-3 h-3 rounded-full border border-slate-600 border-t-white animate-spin" />
              )}
              <button
                onClick={() => setShowTraces(p => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  showTraces ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-white'
                }`}
              >
                <TrendingUp size={10} />
                {showTraces ? 'Hide Traces' : 'Show Traces'}
                {showTraces ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
              </button>
            </div>
          </div>

          {/* Map or Table — fixed height to keep the map compact */}
          <div className="h-52 relative overflow-hidden flex-shrink-0">
            {!showTable ? (
              <div className="absolute inset-0 p-2">
                {/* Map legend */}
                <div className="absolute top-4 right-4 z-10 bg-[#090d14]/92 backdrop-blur border border-slate-700/60 rounded-xl px-2.5 py-2 shadow-xl pointer-events-none">
                  {compareMode ? (
                    <>
                      <div className="text-[8px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5">Lap Traces</div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-4 h-1 rounded-full" style={{ backgroundColor: driver.team_color || '#3b82f6' }} />
                        <span className="text-[9px] text-slate-400 font-mono font-bold">L{lapA}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded-full bg-amber-400" style={{ borderTop: '2px dashed #f59e0b', background: 'none' }} />
                        <span className="text-[9px] text-slate-400 font-mono font-bold">L{lapB}</span>
                      </div>
                    </>
                  ) : lapDataA?.corner_stat?.length > 0 ? (
                    <>
                      <div className="text-[8px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5">Corner Data</div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[9px] text-slate-500 font-mono">Apex speed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span className="text-[9px] text-slate-500 font-mono">Min speed</span>
                      </div>
                    </>
                  ) : null}
                </div>
                <DriverTrackMap
                  driver={driver}
                  trackData={trackData}
                  lapTelemetry={lapDataA?.trace}
                  lapTelemetryB={lapDataB?.trace}
                  cornerStats={lapDataA?.corner_stat}
                  showCornerMetrics={!!lapDataA?.corner_stat?.length && !compareMode}
                />
              </div>
            ) : (
              <div className="absolute inset-0 overflow-y-auto p-3 custom-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-700">
                      <th className="pb-2 pl-2">Turn</th>
                      <th className="pb-2 text-right">Apex (km/h)</th>
                      <th className="pb-2 text-right">Min (km/h)</th>
                      {compareMode && lapDataB && (
                        <th className="pb-2 text-right text-amber-400/70">Apex Δ vs L{lapB}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lapDataA?.corner_stat?.map(c => {
                      const cB = lapDataB?.corner_stat?.find(x => x.number === c.number);
                      const apexDelta = cB != null ? (c.apex_speed - cB.apex_speed) : null;
                      return (
                        <tr key={c.number} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors text-xs font-mono">
                          <td className="py-1.5 pl-2 font-bold text-slate-300">T{c.number}</td>
                          <td className="py-1.5 text-right text-green-400">{c.apex_speed}</td>
                          <td className="py-1.5 text-right text-blue-400">{c.min_speed}</td>
                          {compareMode && lapDataB && (
                            <td className={`py-1.5 text-right font-bold ${
                              apexDelta > 0 ? 'text-green-400' : apexDelta < 0 ? 'text-red-400' : 'text-slate-500'
                            }`}>
                              {apexDelta !== null ? `${apexDelta > 0 ? '+' : ''}${apexDelta}` : '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Traces panel (collapsible) */}
          {showTraces && (
            <div className={`border-t border-slate-700/60 flex-shrink-0 flex flex-col bg-slate-900/40 min-h-0 ${showTable ? 'h-52 overflow-hidden' : 'h-52 p-2 gap-0.5'}`}>

              {showTable ? (
                /* ── Trace table view ── */
                <div className="overflow-y-auto h-full custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-900/95 z-10">
                      <tr className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-700">
                        <th className="pb-2 pl-3 py-2">Dist %</th>
                        <th className="pb-2 text-right" style={{ color: driver.team_color || '#3b82f6' }}>
                          Speed {lapA ? `L${lapA}` : 'A'} (km/h)
                        </th>
                        {lapDataB && (
                          <th className="pb-2 text-right text-amber-400/80">Speed L{lapB} (km/h)</th>
                        )}
                        <th className="pb-2 text-right text-green-400/80">Throttle %</th>
                        <th className="pb-2 text-right text-red-400/80">Brake %</th>
                        <th className="pb-2 text-right text-yellow-400/80">
                          Gear {lapA ? `L${lapA}` : 'A'}
                        </th>
                        {lapDataB && (
                          <th className="pb-2 text-right text-purple-400/80">Gear L{lapB}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {mergedTrace.filter(p => p.distance_pct % 5 === 0).map(p => (
                        <tr key={p.distance_pct} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors text-xs font-mono">
                          <td className="py-1 pl-3 font-bold text-slate-400">{p.distance_pct}%</td>
                          <td className="py-1 text-right" style={{ color: driver.team_color || '#3b82f6' }}>
                            {p.speedA ?? '—'}
                          </td>
                          {lapDataB && (
                            <td className="py-1 text-right text-amber-400">{p.speedB ?? '—'}</td>
                          )}
                          <td className="py-1 text-right text-green-400">{p.throttleA ?? '—'}</td>
                          <td className="py-1 text-right text-red-400">{p.brakeA ?? '—'}</td>
                          <td className="py-1 text-right text-yellow-400">{p.gearA ?? '—'}</td>
                          {lapDataB && (
                            <td className="py-1 text-right text-purple-400">{p.gearB ?? '—'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  {/* Speed */}
                  <div className="flex-1 relative min-h-0">
                    <div className="absolute top-1 left-1 text-[8px] font-bold text-slate-600 bg-slate-900/80 px-1.5 py-0.5 rounded z-10 border border-slate-800/80">SPEED</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergedTrace} syncId="dap" margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="distance_pct" type="number" domain={[0, 100]} hide />
                        <YAxis domain={['dataMin - 20', 'dataMax + 20']} hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 10, padding: '4px 8px' }}
                          labelFormatter={v => `${v}%`}
                        />
                        {lapDataA?.corner_stat?.map(c => (
                          <ReferenceLine key={c.number} x={c.distance_pct} stroke="#1a2535" strokeDasharray="3 3" />
                        ))}
                        <Line type="monotone" dataKey="speedA" stroke={driver.team_color || '#3b82f6'} strokeWidth={1.5} dot={false} name={`L${lapA}`} connectNulls />
                        {lapDataB && <Line type="monotone" dataKey="speedB" stroke="#f59e0b" strokeWidth={1.5} dot={false} name={`L${lapB}`} strokeDasharray="5 2" connectNulls />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 relative min-h-0">
                    <div className="absolute top-1 left-1 text-[8px] font-bold text-slate-600 bg-slate-900/80 px-1.5 py-0.5 rounded z-10 border border-slate-800/80">INPUTS</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedTrace} syncId="dap" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="distance_pct" type="number" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 10, padding: '4px 8px' }}
                        />
                        {lapDataA?.corner_stat?.map(c => (
                          <ReferenceLine key={c.number} x={c.distance_pct} stroke="#1a2535" strokeDasharray="3 3" />
                        ))}
                        <Area type="step" dataKey="throttleA" stroke="#22c55e" fill="#22c55e" fillOpacity={0.12} dot={false} name="Throttle" connectNulls />
                        <Area type="step" dataKey="brakeA" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} dot={false} name="Brake" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Gear */}
                  <div className="flex-1 relative min-h-0">
                    <div className="absolute top-1 left-1 text-[8px] font-bold text-slate-600 bg-slate-900/80 px-1.5 py-0.5 rounded z-10 border border-slate-800/80">GEAR</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergedTrace} syncId="dap" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="distance_pct" type="number" domain={[0, 100]} hide />
                        <YAxis domain={[1, 8]} hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 10, padding: '4px 8px' }}
                        />
                        {lapDataA?.corner_stat?.map(c => (
                          <ReferenceLine key={c.number} x={c.distance_pct} stroke="#1a2535" strokeDasharray="3 3" />
                        ))}
                        <Line type="stepAfter" dataKey="gearA" stroke="#f59e0b" strokeWidth={1.5} dot={false} name={`L${lapA}`} connectNulls />
                        {lapDataB && <Line type="stepAfter" dataKey="gearB" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name={`L${lapB}`} strokeDasharray="5 2" connectNulls />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Sub-components ──

function KpiBadge({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
      <Icon size={13} className={color} />
      <div>
        <div className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono font-bold text-white leading-none">{value}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon: Icon, color }) {
  return (
    <div className="bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-2">
      <Icon size={13} className={`${color} shrink-0`} />
      <div className="min-w-0">
        <div className="text-[7px] text-slate-600 uppercase font-bold truncate leading-none mb-0.5">{label}</div>
        <div className="text-sm font-mono font-bold text-white leading-none">
          {value ?? '—'} <span className="text-[9px] text-slate-600 font-normal">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function DeltaRow({ label, a, b, lowerIsBetter, higherIsBetter }) {
  if (a == null || b == null) return null;
  const delta = b - a;
  const better = lowerIsBetter ? delta < 0 : higherIsBetter ? delta > 0 : null;
  const absSmall = Math.abs(delta) < 0.01;
  const sign = delta > 0 ? '+' : '';
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-slate-700/20 last:border-0">
      <span className="text-[9px] text-slate-600">{label}</span>
      <span className={`font-mono font-bold text-[9px] ${
        absSmall ? 'text-slate-500'
        : better === true ? 'text-green-400'
        : better === false ? 'text-red-400'
        : 'text-slate-400'
      }`}>
        {sign}{delta.toFixed(2)}
      </span>
    </div>
  );
}
