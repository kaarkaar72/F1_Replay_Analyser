import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// Cell is kept for the driver position dot
import { useMemo } from 'react';

const getSpeedColor = (speed) => {
  if (!speed) return "#334155";
  if (speed > 290) return "#ef4444";
  if (speed > 200) return "#eab308";
  if (speed > 100) return "#22c55e";
  return "#3b82f6";
};

export default function DriverTrackMap({ driver, trackData, lapTelemetry, lapTelemetryB, cornerStats, showCornerMetrics = false }) {
  if (!trackData) return null;

  const compareMode = !!(lapTelemetryB?.length);

  // Defined inside component so it closes over cornerStats and showCornerMetrics
  const CornerMarker = ({ cx, cy, payload }) => {
    if (!cx || !cy) return null;
    const stat = cornerStats?.find(c => c.number === payload.number);
    const showMetrics = showCornerMetrics && stat;

    if (showMetrics) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={5} fill="#162030" stroke="#22c55e" strokeWidth={1} />
          <text x={cx} y={cy} fill="#22c55e" fontSize="7" fontWeight="800"
            fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
            {payload.number}
          </text>
          <rect x={cx + 7} y={cy - 22} width={58} height={30} rx={3}
            fill="#07090f" fillOpacity={0.97} stroke="#1a2535" strokeWidth={0.5} />
          <text x={cx + 10} y={cy - 14} fill="#64748b" fontSize="7"
            fontWeight="bold" fontFamily="monospace">T{payload.number}</text>
          <text x={cx + 10} y={cy - 5} fill="#22c55e" fontSize="7.5"
            fontFamily="monospace">{stat.apex_speed} apex</text>
          <text x={cx + 10} y={cy + 4} fill="#60a5fa" fontSize="7.5"
            fontFamily="monospace">{stat.min_speed} min</text>
        </g>
      );
    }

    return (
      <g>
        <circle cx={cx} cy={cy} r={3} fill="#2d3f52" stroke="#080c14" strokeWidth={1} />
        <text x={cx} y={cy - 7} fill="#3d5060" fontSize="9" fontWeight="700"
          fontFamily="monospace" textAnchor="middle">{payload.number}</text>
      </g>
    );
  };

  // Custom shape renders a proper SVG circle so radius is guaranteed
  const SpeedDot = ({ cx, cy, payload }) => {
    if (!cx || !cy) return null;
    return (
      <circle cx={cx} cy={cy} r={4} fill={getSpeedColor(payload.speed)} fillOpacity={0.92} />
    );
  };

  // Every other point gives full-track coverage without excessive DOM nodes
  const heatmapData = useMemo(() => {
    if (!lapTelemetry || lapTelemetry.length === 0) return [];
    return lapTelemetry.filter((_, i) => i % 2 === 0);
  }, [lapTelemetry]);

  const traceDataB = useMemo(() => {
    if (!lapTelemetryB || lapTelemetryB.length === 0) return [];
    return lapTelemetryB.filter((_, i) => i % 2 === 0);
  }, [lapTelemetryB]);

  return (
    <div className="bg-[#080c14] rounded-xl border border-slate-800/70 shadow-2xl h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 24, right: 24, bottom: 16, left: 24 }}>
          <XAxis type="number" dataKey="x" hide domain={['dataMin - 800', 'dataMax + 800']} />
          <YAxis type="number" dataKey="y" hide domain={['dataMin - 800', 'dataMax + 800']} />
          <Tooltip
            cursor={false}
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            itemStyle={{ color: '#94a3b8' }}
          />

          {/* Track: shadow base */}
          <Scatter data={trackData.shape} fill="none"
            line={{ stroke: '#04060a', strokeWidth: 22, strokeLinecap: 'round', strokeLinejoin: 'round' }}
            shape={() => null} isAnimationActive={false} />
          {/* Track: surface */}
          <Scatter data={trackData.shape} fill="none"
            line={{ stroke: '#0e1b2a', strokeWidth: 14, strokeLinecap: 'round', strokeLinejoin: 'round' }}
            shape={() => null} isAnimationActive={false} />
          {/* Track: center dashes */}
          <Scatter data={trackData.shape} fill="none"
            line={{ stroke: '#142030', strokeWidth: 2, strokeDasharray: '8 8', strokeLinecap: 'round' }}
            shape={() => null} isAnimationActive={false} />

          {/* Compare mode: lap A solid team-colour line, lap B amber dashed line */}
          {compareMode && heatmapData.length > 0 && (
            <Scatter
              data={lapTelemetry}
              fill="none"
              line={{ stroke: driver?.team_color || '#3b82f6', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', strokeOpacity: 0.85 }}
              shape={() => null}
              isAnimationActive={false}
            />
          )}
          {compareMode && traceDataB.length > 0 && (
            <Scatter
              data={lapTelemetryB}
              fill="none"
              line={{ stroke: '#f59e0b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: '6 4', strokeOpacity: 0.8 }}
              shape={() => null}
              isAnimationActive={false}
            />
          )}

          {/* Speed heatmap overlay (single-lap mode only) */}
          {!compareMode && heatmapData.length > 0 && (
            <Scatter name="heatmap" data={heatmapData} shape={<SpeedDot />} isAnimationActive={false} />
          )}

          {/* Corner markers */}
          {trackData.corners?.length > 0 && (
            <Scatter
              name="corners"
              data={trackData.corners}
              shape={<CornerMarker />}
              isAnimationActive={false}
            />
          )}

          {/* Live driver position dot */}
          {driver?.x && (
            <Scatter name="driver" data={[{ x: driver.x, y: driver.y }]} isAnimationActive={false}>
              <Cell fill={driver.team_color || '#3b82f6'} stroke="white" strokeWidth={2} r={6} />
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
