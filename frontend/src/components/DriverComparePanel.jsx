import { useState, useEffect } from 'react';
import { X, Users, Trophy } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const API_URL = "http://localhost:8000";

// Build a merged speed trace sampled at integer distance_pct values (0–100)
function buildSpeedTrace(traceA, traceB) {
  if (!traceA?.length || !traceB?.length) return [];
  const mapA = {};
  const mapB = {};
  traceA.forEach(p => { mapA[Math.round(p.distance_pct)] = p.speed; });
  traceB.forEach(p => { mapB[Math.round(p.distance_pct)] = p.speed; });
  return Array.from({ length: 101 }, (_, i) => ({
    pct: i,
    speedA: mapA[i] ?? null,
    speedB: mapB[i] ?? null,
  }));
}

// Single metric comparison row with dual progress bars
function MetricRow({ label, a, b, unit, higherIsBetter, format, colorA, colorB }) {
  if (a == null || b == null) return null;
  const fa = format ? format(a) : a;
  const fb = format ? format(b) : b;
  const max = Math.max(Math.abs(a), Math.abs(b)) || 1;
  const pctA = (Math.abs(a) / max) * 100;
  const pctB = (Math.abs(b) / max) * 100;

  let win = null;
  if (higherIsBetter !== null && Math.abs(a - b) > 0.001) {
    win = (higherIsBetter ? a > b : a < b) ? 'a' : 'b';
  }

  const winColorA = win === 'a' ? colorA : '#1e293b';
  const winColorB = win === 'b' ? colorB : '#1e293b';

  return (
    <div className="grid grid-cols-[1fr_130px_1fr] items-center py-2 border-b border-slate-800/50 last:border-0">

      {/* Driver A side — value right-aligned, bar fills right→left */}
      <div className="flex items-center justify-end gap-2 pr-3">
        {win === 'a' && (
          <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: colorA }} />
        )}
        <span className={`text-xs font-bold font-mono tabular-nums ${win === 'a' ? 'text-white' : 'text-slate-500'}`}>
          {fa}
          {unit && <span className="text-[9px] font-normal text-slate-700 ml-0.5">{unit}</span>}
        </span>
        <div className="w-20 h-1.5 bg-slate-800/80 rounded-full overflow-hidden flex justify-end">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctA}%`, backgroundColor: winColorA }} />
        </div>
      </div>

      {/* Center label */}
      <div className="flex items-center justify-center px-1">
        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-[0.12em] text-center leading-tight">
          {label}
        </span>
      </div>

      {/* Driver B side — bar fills left→right, value left-aligned */}
      <div className="flex items-center gap-2 pl-3">
        <div className="w-20 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctB}%`, backgroundColor: winColorB }} />
        </div>
        <span className={`text-xs font-bold font-mono tabular-nums ${win === 'b' ? 'text-white' : 'text-slate-500'}`}>
          {fb}
          {unit && <span className="text-[9px] font-normal text-slate-700 ml-0.5">{unit}</span>}
        </span>
        {win === 'b' && (
          <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: colorB }} />
        )}
      </div>
    </div>
  );
}

// Sector time row (S1 / S2 / S3)
function SectorRow({ label, timeA, timeB, colorA, colorB }) {
  if (!timeA || !timeB) return null;
  const winA = timeA < timeB;
  const winB = timeB < timeA;
  const delta = (timeA - timeB).toFixed(3);
  return (
    <div className="grid grid-cols-[1fr_80px_auto_80px_1fr] items-center gap-1 py-1.5 border-b border-slate-800/40 last:border-0">
      <span className={`text-right text-xs font-mono font-bold tabular-nums ${winA ? 'text-white' : 'text-slate-500'}`}>
        {timeA.toFixed(3)}
      </span>
      <div className="flex justify-end">
        {winA && <div className="w-1 h-3 rounded-full" style={{ backgroundColor: colorA }} />}
      </div>
      <div className="text-center px-2">
        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">{label}</span>
        <div className={`text-[9px] font-mono tabular-nums mt-0.5 ${parseFloat(delta) < 0 ? 'text-green-500' : 'text-red-500'}`}>
          {parseFloat(delta) > 0 ? '+' : ''}{delta}s
        </div>
      </div>
      <div className="flex justify-start">
        {winB && <div className="w-1 h-3 rounded-full" style={{ backgroundColor: colorB }} />}
      </div>
      <span className={`text-left text-xs font-mono font-bold tabular-nums ${winB ? 'text-white' : 'text-slate-500'}`}>
        {timeB.toFixed(3)}
      </span>
    </div>
  );
}

export default function DriverComparePanel({ driverA, driverB, sessionKey, onClose }) {
  const [lapA, setLapA] = useState(null);
  const [lapB, setLapB] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverA || !driverB || !sessionKey) return;
    setLoading(true);
    setLapA(null);
    setLapB(null);
    Promise.all([
      fetch(`${API_URL}/analysis/best-driver-lap/${sessionKey}/${driverA.driver_id}`).then(r => r.json()),
      fetch(`${API_URL}/analysis/best-driver-lap/${sessionKey}/${driverB.driver_id}`).then(r => r.json()),
    ]).then(([a, b]) => {
      setLapA(Array.isArray(a) || !a?.metrics ? null : a);
      setLapB(Array.isArray(b) || !b?.metrics ? null : b);
    }).finally(() => setLoading(false));
  }, [driverA?.driver_id, driverB?.driver_id, sessionKey]);

  const colorA = driverA.team_color || '#3b82f6';
  const colorB = driverB.team_color || '#ef4444';
  const isTeammates = driverA.team_name && driverA.team_name === driverB.team_name;

  const metrics = (lapA?.metrics && lapB?.metrics) ? [
    { label: 'Top Speed',          a: lapA.metrics.max_speed,           b: lapB.metrics.max_speed,           unit: 'km/h', higherIsBetter: true,  format: v => Math.round(v) },
    { label: 'Avg Speed',          a: lapA.metrics.avg_speed,           b: lapB.metrics.avg_speed,           unit: 'km/h', higherIsBetter: true,  format: v => Math.round(v) },
    { label: 'Full Throttle',      a: lapA.metrics.full_throttle_pct,   b: lapB.metrics.full_throttle_pct,   unit: '%',    higherIsBetter: true,  format: v => v.toFixed(1) },
    { label: 'Braking Zones',      a: lapA.metrics.braking_zones,       b: lapB.metrics.braking_zones,       unit: '',     higherIsBetter: false, format: v => v },
    { label: 'Coast Duration',     a: lapA.metrics.coast_duration,      b: lapB.metrics.coast_duration,      unit: 's',    higherIsBetter: false, format: v => v },
    { label: 'Gear Changes',       a: lapA.metrics.gear_shifts,         b: lapB.metrics.gear_shifts,         unit: '',     higherIsBetter: null,  format: v => v },
    { label: 'Aggression',         a: lapA.metrics.throttle_aggression, b: lapB.metrics.throttle_aggression, unit: '',     higherIsBetter: null,  format: v => v.toFixed(1) },
    { label: 'Low Speed Grip',     a: lapA.metrics.low_speed_grip,      b: lapB.metrics.low_speed_grip,      unit: 'km/h', higherIsBetter: true,  format: v => v },
  ] : [];

  const advMetrics = (lapA?.advanced_metrics && lapB?.advanced_metrics) ? [
    { label: 'Throttle Smoothness', a: lapA.advanced_metrics.throttle_smoothness * 100, b: lapB.advanced_metrics.throttle_smoothness * 100, unit: '%',      higherIsBetter: true,  format: v => v.toFixed(1) },
    { label: 'G-Force Util.',       a: lapA.advanced_metrics.g_force_utilization * 100, b: lapB.advanced_metrics.g_force_utilization * 100, unit: '%',      higherIsBetter: true,  format: v => v.toFixed(1) },
    { label: 'Accel. Gradient',     a: lapA.advanced_metrics.acceleration_gradient,     b: lapB.advanced_metrics.acceleration_gradient,     unit: 'km/h/s', higherIsBetter: true,  format: v => v.toFixed(1) },
    { label: 'Braking Duration',    a: lapA.advanced_metrics.braking_zone_duration,     b: lapB.advanced_metrics.braking_zone_duration,     unit: 's',      higherIsBetter: false, format: v => v.toFixed(1) },
    { label: 'Line Consistency',    a: lapA.advanced_metrics.line_consistency * 100,    b: lapB.advanced_metrics.line_consistency * 100,    unit: '',       higherIsBetter: false, format: v => v.toFixed(2) },
  ] : [];

  const allMetrics = [...metrics, ...advMetrics];

  const aWins = allMetrics.filter(m => m.higherIsBetter !== null && (m.higherIsBetter ? m.a > m.b : m.a < m.b)).length;
  const bWins = allMetrics.filter(m => m.higherIsBetter !== null && (m.higherIsBetter ? m.b > m.a : m.b < m.a)).length;

  const lapTimeA = lapA?.sectors?.lap_duration;
  const lapTimeB = lapB?.sectors?.lap_duration;
  const lapDelta = (lapTimeA && lapTimeB) ? (lapTimeA - lapTimeB) : null;

  const speedTrace = buildSpeedTrace(lapA?.trace, lapB?.trace);
  const cornerStats = lapA?.corner_stat || [];

  return (
    <div className="h-full flex flex-col bg-[#080c14] border-t border-slate-800/70 font-mono">

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800/70 bg-slate-900/40 backdrop-blur-sm">

        {/* Driver A */}
        <div className="flex items-center gap-3">
          {driverA.headshot && (
            <img src={driverA.headshot} alt={driverA.name}
              className="w-10 h-10 rounded-lg object-cover bg-slate-800 border-l-[3px]"
              style={{ borderColor: colorA }} />
          )}
          <div>
            <div className="text-base font-black text-white leading-none tracking-tight">{driverA.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{driverA.team_name}</div>
          </div>
          {isTeammates && (
            <div className="ml-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold border"
              style={{ borderColor: colorA, color: colorA, backgroundColor: `${colorA}18` }}>
              P{driverA.position}
            </div>
          )}
        </div>

        {/* Center: score + label */}
        <div className="flex flex-col items-center gap-1.5">
          {isTeammates && (
            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">
              <Users size={9} /> Teammate Battle
            </div>
          )}
          <div className="flex items-center gap-2 font-black tabular-nums">
            <span className="text-2xl" style={{ color: colorA }}>{aWins}</span>
            <span className="text-slate-700 text-lg">:</span>
            <span className="text-2xl" style={{ color: colorB }}>{bWins}</span>
          </div>
          <div className="text-[9px] text-slate-600 uppercase tracking-widest">metric wins</div>
        </div>

        {/* Driver B */}
        <div className="flex items-center gap-3">
          {isTeammates && (
            <div className="mr-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold border"
              style={{ borderColor: colorB, color: colorB, backgroundColor: `${colorB}18` }}>
              P{driverB.position}
            </div>
          )}
          <div className="text-right">
            <div className="text-base font-black text-white leading-none tracking-tight">{driverB.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{driverB.team_name}</div>
          </div>
          {driverB.headshot && (
            <img src={driverB.headshot} alt={driverB.name}
              className="w-10 h-10 rounded-lg object-cover bg-slate-800 border-r-[3px]"
              style={{ borderColor: colorB }} />
          )}
        </div>

        <button onClick={onClose}
          className="ml-5 p-2 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* ── BODY ── */}
      {loading ? (
        <div className="flex-grow flex items-center justify-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin" />
          <span className="text-slate-600 text-xs uppercase tracking-widest">Loading telemetry…</span>
        </div>
      ) : (!lapA && !lapB) ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-2 text-slate-700">
          <Trophy size={24} />
          <span className="text-sm font-bold">No lap data yet</span>
          <span className="text-xs">Start the session to populate telemetry</span>
        </div>
      ) : (
        <div className="flex-grow overflow-hidden flex gap-0">

          {/* ── LEFT COLUMN: Lap time + Sectors + Metrics ── */}
          <div className="flex-grow overflow-y-auto custom-scrollbar">

            {/* Lap time comparison banner */}
            {lapTimeA && lapTimeB && (
              <div className="grid grid-cols-3 border-b border-slate-800/60">
                <div className="px-5 py-3 text-right">
                  <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5">Best Lap</div>
                  <div className={`text-lg font-black tabular-nums ${lapTimeA < lapTimeB ? 'text-green-400' : 'text-white'}`}>
                    {lapTimeA.toFixed(3)}s
                  </div>
                  {lapTimeA < lapTimeB && (
                    <div className="mt-0.5 text-[9px] font-bold text-green-500 flex items-center justify-end gap-1">
                      <Trophy size={8} /> FASTER
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 flex flex-col items-center justify-center border-x border-slate-800/60">
                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Lap Time Δ</div>
                  {lapDelta !== null && (
                    <div className={`mt-1.5 px-2.5 py-1 rounded-lg text-xs font-black tabular-nums ${
                      lapDelta < 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                    }`}>
                      {lapDelta > 0 ? '+' : ''}{lapDelta.toFixed(3)}s
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 text-left">
                  <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5">Best Lap</div>
                  <div className={`text-lg font-black tabular-nums ${lapTimeB < lapTimeA ? 'text-green-400' : 'text-white'}`}>
                    {lapTimeB.toFixed(3)}s
                  </div>
                  {lapTimeB < lapTimeA && (
                    <div className="mt-0.5 text-[9px] font-bold text-green-500 flex items-center gap-1">
                      <Trophy size={8} /> FASTER
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sector times */}
            {lapA?.sectors && lapB?.sectors && (
              <div className="px-5 py-2 border-b border-slate-800/60">
                <SectorRow label="S1" timeA={lapA.sectors.s1} timeB={lapB.sectors.s1} colorA={colorA} colorB={colorB} />
                <SectorRow label="S2" timeA={lapA.sectors.s2} timeB={lapB.sectors.s2} colorA={colorA} colorB={colorB} />
                <SectorRow label="S3" timeA={lapA.sectors.s3} timeB={lapB.sectors.s3} colorA={colorA} colorB={colorB} />
              </div>
            )}

            {/* Core metrics */}
            {metrics.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-800/60">
                <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-2 px-1">
                  Lap Metrics
                </div>
                {metrics.map(m => (
                  <MetricRow key={m.label} {...m} colorA={colorA} colorB={colorB} />
                ))}
              </div>
            )}

            {/* Advanced metrics */}
            {advMetrics.length > 0 && (
              <div className="px-4 py-2">
                <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-2 px-1">
                  Advanced
                </div>
                {advMetrics.map(m => (
                  <MetricRow key={m.label} {...m} colorA={colorA} colorB={colorB} />
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Speed trace ── */}
          {speedTrace.length > 0 && (
            <div className="w-[340px] shrink-0 border-l border-slate-800/60 flex flex-col">
              <div className="px-4 pt-3 pb-2 border-b border-slate-800/60">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                  Speed Trace — Best Laps
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: colorA }}>
                    <div className="w-5 h-0.5 rounded" style={{ backgroundColor: colorA }} />
                    {driverA.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: colorB }}>
                    <div className="w-5 h-0.5 rounded" style={{ backgroundColor: colorB }} />
                    {driverB.name}
                  </div>
                </div>
              </div>
              <div className="flex-grow p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={speedTrace} margin={{ top: 10, right: 5, bottom: 10, left: 0 }}>
                    <XAxis dataKey="pct" type="number" domain={[0, 100]} hide />
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 6,
                        fontSize: 10,
                        padding: '4px 8px',
                      }}
                      itemStyle={{ color: '#94a3b8' }}
                      formatter={(v, name) => [
                        `${Math.round(v)} km/h`,
                        name === 'speedA' ? driverA.name : driverB.name,
                      ]}
                      labelFormatter={() => ''}
                    />
                    {cornerStats.map(c => (
                      <ReferenceLine
                        key={c.number}
                        x={c.distance_pct}
                        stroke="#1e293b"
                        strokeDasharray="2 5"
                      />
                    ))}
                    <Line type="monotone" dataKey="speedA" stroke={colorA}
                      strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    <Line type="monotone" dataKey="speedB" stroke={colorB}
                      strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Speed delta at corners */}
              {cornerStats.length > 0 && lapA?.corner_stat && lapB?.corner_stat && (
                <div className="border-t border-slate-800/60 px-4 py-3 overflow-y-auto custom-scrollbar max-h-48">
                  <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-2">
                    Corner Speed Δ
                  </div>
                  {lapA.corner_stat.slice(0, 15).map(ca => {
                    const cb = lapB.corner_stat?.find(x => x.number === ca.number);
                    if (!cb) return null;
                    const delta = ca.apex_speed - cb.apex_speed;
                    return (
                      <div key={ca.number} className="flex items-center justify-between py-1 border-b border-slate-800/30 last:border-0">
                        <span className="text-[10px] text-slate-500 font-bold">T{ca.number}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">{ca.apex_speed}</span>
                        <span className={`text-[10px] font-bold tabular-nums ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums">{cb.apex_speed}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
