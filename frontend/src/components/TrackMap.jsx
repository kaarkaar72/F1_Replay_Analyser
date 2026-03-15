import { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Map } from 'lucide-react';
import { ReferenceDot, Label } from 'recharts';
import RaceTimeline from './RaceTimeline';
import LiveFeed from './LiveFeed';
const API_URL = "http://localhost:8000";

export default function TrackMap({ sessionKey, drivers, trackImage, latestEvent,currentLap , totalLaps  }) {
  const [trackData, setTrackData] = useState({ shape: [], corners: [] });
  // Fetch Track Shape when Session changes
  useEffect(() => {
    if (!sessionKey) return;
    fetch(`${API_URL}/track/${sessionKey}`)
      .then(res => res.json())
      .then(data => setTrackData(data)) // Expects { shape: [], corners: [] }
      .catch(err => console.error(err));
  }, [sessionKey]);

  // Helper for Driver Colors
  const getDriverColor = (speed) => {
    if (speed > 290) return "#ef4444"; // Red (Fast)
    if (speed > 200) return "#eab308"; // Yellow
    if (speed > 100) return "#22c55e"; // Green
    return "#3b82f6"; // Blue (Slow)
  };

  const secureUrl = (url) => {
    if (!url) return null;
    return url.replace("http://", "https://");
  };

  // Convert Dict to Array for Recharts
  const driverList = Object.values(drivers);
  const DriverMarker = (props) => {
    const { cx, cy, payload } = props;
    const showLabel = payload.speed > 10;
    return (
      <g>
        {/* The Dot */}
        <circle cx={cx} cy={cy} r={6} fill={props.fill} stroke="white" strokeWidth={1} />
        
        {/* The Label */}
        {showLabel && (
          <text 
            x={cx} 
            y={cy - 10} 
            fill="white" 
            textAnchor="middle" 
            fontSize="10" 
            fontWeight="bold"
            style={{ textShadow: "0px 0px 4px black" }} // Outline for readability
          >
            {payload.name}
          </text>
        )}
      </g>
    );
  };


  return (
    
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-xl h-[700px] flex flex-col">
      
      
      <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
        <Map size={10} /> Live Circuit Telemetry
      </h2>

      <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur border border-slate-700 px-4 py-2 rounded-lg shadow-xl">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lap</div>
          <div className="text-3xl font-mono font-bold text-white leading-none">
              {currentLap}||1 <span className="text-sm text-slate-500">/ {totalLaps}</span>
          </div>
      </div>
      
      <div className="flex-grow w-full relative">
        {/* Loading State */}
        {trackData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            Waiting for Session...
          </div>
        )}

        {/* OVERLAY: Track Map PNG */}
        {trackImage && (
          <div className="absolute bottom-0 right-0 w-24 h-24 z-10 hover:opacity-80 transition-opacity bg-slate-900/50 rounded-lg p-1 border border-slate-700 pointer-events-none">
              <img 
                  src={secureUrl(trackImage) || "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Singapore%20carbon.png"} 
                  alt="Circuit Layout" 
                  className="w-full h-full object-contain invert grayscale"
              />
          </div>
        )}
        
      <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur border border-slate-700 px-4 py-2 rounded-lg shadow-xl">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lap</div>
          <div className="text-3xl font-mono font-bold text-white leading-none">
              {currentLap} <span className="text-sm text-slate-500">/ {totalLaps}</span>
          </div>
      </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            {/* Hide Axes for clean look */}
            <XAxis type="number" dataKey="x" hide domain={['dataMin - 1000', 'dataMax + 1000']} />
            <YAxis type="number" dataKey="y" hide domain={['dataMin - 1000', 'dataMax + 1000']} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }} 
              contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}}
              itemStyle={{color: '#fff'}}
            />
                
            {/* LAYER 1: Static TRACK */}
            <Scatter 
              name="Track" 
              data={trackData.shape} 
              fill="none" 
              line={{ stroke: '#334155', strokeWidth: 12, strokeLinecap: 'round' }} 
              shape={() => null} 
              isAnimationActive={false} 
            />

            {/* LAYER 2: Static CORNER LABELS */}
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

                     <Label 
                        value={corner.distance} 
                        position="top" 
                        offset={-20} 
                        style={{ 
                            fill: '#94a3b8', 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            fontFamily: 'monospace'
                        }} 
                        
                    />
                </ReferenceDot>
            ))}

            {/* LAYER 3: Dynamic CARS */}
            <Scatter name="Drivers" data={driverList} shape={<DriverMarker />}>
              {driverList.map((entry, index) => (
                <Cell key={`car-${entry.driver_id}`} 
                fill={entry.team_color} 
                border={getDriverColor(entry.speed)}
                />
              ))}
            </Scatter>

            {/* LAYER 4: Static SECTORS */}
              {trackData.sectors && (
                <Scatter 
                    name="Sectors" 
                    data={trackData.sectors} 
                    shape="diamond" 
                    fill="#475569" // Subtle Grey
                >
                    {/* Only show label on hover to avoid clutter */}
                    <LabelList dataKey="number" position="bottom" style={{ fill: '#475569', fontSize: '8px' }} />
                </Scatter>
              )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-center text-xs text-slate-500 mt-2">
        <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span> &gt;290 km/h
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full ml-3 mr-1"></span> &lt;200 km/h
      </div>

       <div className="absolute bottom-4 z-10 pointer-events-none">
          <div className="absolute bottom-16 left-2 z-20">
            <LiveFeed latestEvent={latestEvent} />
          </div>
      </div>
    </div>
  );
}