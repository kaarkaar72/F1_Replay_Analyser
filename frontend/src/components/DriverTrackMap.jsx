import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ReferenceDot, Label } from 'recharts';
import { useMemo } from 'react';
export default function DriverTrackMap({ driver, trackData, lapTelemetry, driverTelemetry}) {
  if (!trackData) return null;
  // console.log(lapTelemetry)
  // console.log("MAP RENDER - Points:", lapTelemetry?.length);
  const lapPoints = (lapTelemetry && lapTelemetry.length > 0) ? lapTelemetry : trackData.shape;
  const mapPoints = (driverTelemetry && driverTelemetry.length > 0) ? driverTelemetry : trackData.shape;

//   console.log(mapPoints)
  const getDriverColor = (speed) => {
    if (!speed) return "#334155"; // Default Grey
    if (speed > 290) return "#ef4444"; // Red (Fast)
    if (speed > 200) return "#eab308"; // Yellow
    if (speed > 100) return "#22c55e"; // Green
    return "#3b82f6"; // Blue (Slow)
  };

  const heatmapData = useMemo(() => {
      if (!lapTelemetry) return [];
      // Take every 5th point (reduces DOM nodes by 80%)
      return lapTelemetry.filter((_, i) => i % 3 === 0);
    }, [lapTelemetry]);
//   console.log("Track Data:", trackData);
    // console.log(driver.lap)
    // console.log("Reference Lap",lapTelemetry)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl h-full relative">
        
        {/* HEADS UP DISPLAY (HUD) */}
        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur p-3 rounded-lg border border-slate-600">
            {/* <div className="text-xs text-slate-400 font-bold uppercase">Current Sector</div>
            <div className="text-xl text-white font-mono">SECTOR 2</div> */}

            {/* Live Telemetry Box */}
            {/* <div className="bg-slate-900/90 backdrop-blur p-3 rounded-lg border border-slate-600 shadow-lg min-w-[120px]">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500 font-bold">THROTTLE</span>
                    <span className="text-green-400 font-mono text-sm">{driver.throttle}%</span>
                </div>
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{width: `${driver.throttle}%`}}></div>
                </div>

                <div className="flex justify-between items-center mt-2 mb-1">
                    <span className="text-[10px] text-slate-500 font-bold">BRAKE</span>
                    <span className="text-red-400 font-mono text-sm">{driver.brake}%</span>
                </div>
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{width: `${driver.brake}%`}}></div>
                </div>
            </div> */}
        </div>

        {/* MAP */}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis type="number" dataKey="x" hide domain={['dataMin - 1000', 'dataMax + 1000']} />
            <YAxis type="number" dataKey="y" hide domain={['dataMin - 1000', 'dataMax + 1000']} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }} 
              contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}}
              itemStyle={{color: '#fff'}}
            />
            {/* Track Line */}
            <Scatter 
                data={trackData.shape} 
                fill="none" 
                line={{ stroke: '#334155', strokeWidth: 10 }} 
                isAnimationActive={false} />

              {trackData.corners.map((corner) => (
                <ReferenceDot 
                    key={corner.number}
                    x={corner.x} 
                    y={corner.y} 
                    r={3} 
                    fill="#e8eaec" 
                    stroke="none"
                    isFront={true} // Ensure it's above the track line
                >
                    <Label 
                        value={corner.number} 
                        position="top" 
                        offset={5} 
                        style={{ 
                            fill: '#94a3b8', 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            fontFamily: 'monospace'
                        }} 
                        
                    />
                    </ReferenceDot>
              ))}

            {/* <Scatter name="Driver Best" data={heatmapData} shape="circle">
                {heatmapData.map((p, i) => (
                    <Cell 
                        key={`pt-${i}`} 
                        fill={getDriverColor(p.speed)} 
                        fillOpacity={0.3}
                        r={4} // Thicker if it has data
                    />
                ))}
            </Scatter> */}

            <Scatter name="Driver Best" data={heatmapData} shape="circle">
                {heatmapData.map((p, i) => (
                    <Cell 
                        key={`pt-${i}`} 
                        fill={getDriverColor(p.speed)} 
                        r={p.speed ? 2 : 1} // Thicker if it has data
                    />
                ))}
            </Scatter>


            {/* The Driver */}
            <Scatter data={[driver]} fill={driver.team_color}>
                <Cell fill={driver.team_color} stroke="white" strokeWidth={2} />
                <LabelList dataKey="speed" position="top" style={{fill:'white', fontWeight:'bold'}} formatter={(v) => `${v} km/h`} />
            </Scatter>



          </ScatterChart>

        </ResponsiveContainer>
    </div>
    
  );
}