import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, Wind, Timer, Gauge, Activity, Layers, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import DriverTrackMap from './DriverTrackMap';

const API_URL = "http://localhost:8000";

export default function DriverAnalysis({ driver, sessionKey, onBack, currentTimestamp, trackData }) {
  const [laps, setLaps] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  
  // State for Charts
  const [selectedLaps, setSelectedLaps] = useState([]);
  const [traces, setTraces] = useState([]);
  
  // State for Map
  const [corners, setCorners] = useState([]);
  const [referenceLapTelemetry, setReferenceLap] = useState([]); // Session Best
  const [mapOverlayData, setMapOverlayData] = useState([]); // Selected Lap for Map
  const [activeLapMetrics, setActiveLapMetrics] = useState(null)
  // 1. Fetch Live Data & Laps
  useEffect(() => {
    if (!driver || !sessionKey) return;

    const fetchData = () => {
        const timeParam = currentTimestamp ? `?time=${currentTimestamp}` : "";
        
        fetch(`${API_URL}/analysis/laps/${sessionKey}/${driver.driver_id}${timeParam}`)
            .then(res => res.json())
            .then(data => setLaps(data))
            .catch(console.error);
            
        fetch(`${API_URL}/analysis/telemetry/${sessionKey}/${driver.driver_id}${timeParam}`)
            .then(res => res.json())
            .then(data => setTelemetry(data))
            .catch(console.error);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [driver, sessionKey, currentTimestamp]);

  // 2. Fetch Static Data (Corners & Reference Lap)
  useEffect(() => {
      if (!sessionKey) return;

      // Track Corners
      fetch(`${API_URL}/track/${sessionKey}`)
        .then(res => res.json())
        .then(data => setCorners(data.corners || []));

      // Session Best Trace
      fetch(`${API_URL}/analysis/reference-lap/${sessionKey}`)
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data) && data.length > 0) setReferenceLap(data);
        });
  }, [sessionKey]);

  // 3. Handle Trace Chart Selection (Multi-Select)
  useEffect(() => {
    async function fetchTraces() {
        const promises = selectedLaps.map(lap => 
            fetch(`${API_URL}/analysis/lap-telemetry/${sessionKey}/${driver.driver_id}/${lap}`).then(r => r.json())
        );
        const results = await Promise.all(promises);
        setTraces(results.map((data, i) => ({ lap: selectedLaps[i], data })));
    }
    if (selectedLaps.length > 0) fetchTraces();
    else setTraces([]);
  }, [selectedLaps]);

  // 4. Handle Map Overlay (Single Select on Click)
  const handleMapLapClick = async (lap) => {
      const res = await fetch(`${API_URL}/analysis/lap-telemetry/${sessionKey}/${driver.driver_id}/${lap}`);
      const data = await res.json();
      console.log(data)
      setMapOverlayData(data.trace);
      setActiveLapMetrics(data.metrics);
  };

  const toggleTraceLap = (lapNumber) => {
      setSelectedLaps(prev => {
          if (prev.includes(lapNumber)) return prev.filter(l => l !== lapNumber);
          if (prev.length >= 3) return prev; 
          return [...prev, lapNumber];
      });
  };

  const bestLap = laps.length > 0 ? Math.min(...laps.map(l => l.time)).toFixed(3) : "--.---";

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in zoom-in duration-300 p-6 bg-slate-900 absolute inset-0 z-50 overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-4 shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
                <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-4">
                <img src={driver.headshot} className="w-12 h-12 rounded-full border-2 bg-slate-800 object-cover" style={{borderColor: driver.team_color}} />
                <div>
                    <h1 className="text-2xl font-bold leading-none text-white">{driver.name}</h1>
                    <p className="text-sm text-slate-500 uppercase tracking-widest">{driver.team_name}</p>
                </div>
            </div>
        </div>
        <div className="flex gap-4">
            <KpiBadge icon={Timer} label="Best Lap" value={bestLap} color="text-purple-400" />
            <KpiBadge icon={Gauge} label="Live Speed" value={`${driver.speed} kph`} color="text-blue-400" />
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow min-h-[600px]">
          
          {/* COL 1: MAP (Span 3) */}
                    <div className="lg:col-span-3 flex flex-col gap-4">
              
              {/* Map Container */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl h-[500px] relative flex flex-col">
                  {/* Map Controls */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                    <span className="text-[10px] uppercase font-bold text-slate-500 self-center mr-2">Inspect Lap:</span>
                    {laps.map(l => (
                        <button 
                            key={l.lap}
                            onClick={() => handleMapLapClick(l.lap)}
                            className={`px-2 py-1 rounded text-[10px] font-mono border ] "bg-slate-900 border-slate-600"}`}
                        >
                            L{l.lap}
                        </button>
                    ))}
                  </div>
                  
                  {/* The Map */}
                  <div className="flex-grow">
                    <DriverTrackMap 
                        driver={driver} 
                        trackData={trackData} 
                        sessionBest={referenceLapTelemetry} // Purple Ghost   // Green Ghost
                        driverTelemetry={mapOverlayData}    // Selected Heatmap
                    />
                  </div>
              </div>

              {/* Advanced Metrics (Below Map) */}
              {activeLapMetrics && (
                  <div className="grid grid-cols-4 gap-4 animate-in slide-in-from-top-4">
                      <MetricCard label="Top Speed" value={activeLapMetrics.max_speed} unit="km/h" icon={Gauge} color="text-blue-400" />
                      <MetricCard label="Avg Speed" value={activeLapMetrics.avg_speed.toFixed(0)} unit="km/h" icon={Activity} color="text-purple-400" />
                      <MetricCard label="Full Throttle" value={`${activeLapMetrics.full_throttle_pct.toFixed(0)}%`} icon={Zap} color="text-green-400" />
                      <MetricCard label="Coasting" value={`${activeLapMetrics.braking_zones}`} icon={Wind} color="text-slate-400" />
                  </div>
              )}
          </div>

          {/* COL 2: GRAPHS (Span 2) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Lap Time History */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 h-64 flex flex-col">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                      <Activity size={16}/> Lap Times
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis type="number" dataKey="lap" stroke="#94a3b8" tick={{fontSize: 10}} />
                            <YAxis type="number" dataKey="time" domain={['auto', 'auto']} stroke="#94a3b8" tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{backgroundColor: '#1e293b'}} cursor={{strokeDasharray: '3 3'}} />
                            <Scatter name="Laps" data={laps} fill={driver.team_color} />
                        </ScatterChart>
                  </ResponsiveContainer>
              </div>

              {/* CHART 2: LIVE TELEMETRY */} 
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col shadow-xl h-64"> 
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"> 
                    <Layers size={16}/> Live Telemetry (Last 2m) </h3> 
                    <ResponsiveContainer width="100%" height="100%"> 
                        <LineChart data={telemetry} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}> 
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /> 
                            <XAxis dataKey="time" hide /> 
                            <YAxis yAxisId="left" domain={[0, 350]} stroke="#3b82f6" orientation="left" tick={{fontSize: 10}} /> 
                            <YAxis yAxisId="right" domain={[0, 110]} stroke="#22c55e" orientation="right" tick={{fontSize: 10}} /> 
                            <Tooltip contentStyle={{backgroundColor: '#1e293b'}} /> <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} /> 
                            <Line yAxisId="right" type="monotone" dataKey="throttle" stroke="#22c55e" dot={false} strokeWidth={1} isAnimationActive={false} /> 
                            <Line yAxisId="right" type="monotone" dataKey="brake" stroke="#ef4444" dot={false} strokeWidth={1} isAnimationActive={false} /> 
                            </LineChart> 
                        </ResponsiveContainer> 
                </div> 

              {/* Speed Trace Comparison */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 h-full flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                          <TrendingUp size={16}/> Speed Trace
                      </h3>
                  </div>
                  
                  {/* Trace Selectors */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                    {laps.map(l => (
                        <button 
                            key={l.lap}
                            onClick={() => toggleTraceLap(l.lap)}
                            className={`px-2 py-1 rounded text-[10px] font-mono border ${selectedLaps.includes(l.lap) ? "bg-green-600 border-green-400" : "bg-slate-900 border-slate-600"}`}
                        >
                            L{l.lap}
                        </button>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="flex-grow">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="distance_pct" type="number" unit="%" domain={[0, 100]} stroke="#94a3b8" />
                            <YAxis dataKey="speed" type="number" unit="kph" stroke="#94a3b8" />
                            <Tooltip contentStyle={{backgroundColor: '#1e293b'}} />
                            
                            {/* Corner Markers */}
                            {corners.map(c => (
                                <ReferenceLine key={c.number} x={c.distance_pct} stroke="#475569" strokeDasharray="3 3" label={{ value: `T${c.number}`, position: 'insideTop', fill: '#64748b', fontSize: 10 }} />
                            ))}

                            {/* Traces */}
                            {traces.map((trace, i) => (
                                <Scatter 
                                    key={trace.lap} 
                                    name={`Lap ${trace.lap}`} 
                                    data={trace.data} 
                                    line={{ strokeWidth: 2 }} 
                                    shape={() => null} 
                                    fill={['#22c55e', '#ef4444', '#3b82f6'][i % 3]} 
                                />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
}

function KpiBadge({ icon: Icon, label, value, color }) {
    return (
        <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
            <Icon size={20} className={color} />
            <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">{label}</div>
                <div className="font-mono font-bold leading-none text-white">{value}</div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, unit, icon: Icon, color }) {
    return (
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 shadow-lg">
            <div className={`p-2 rounded-lg bg-slate-900 ${color}`}>
                <Icon size={18} />
            </div>
            <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">{label}</div>
                <div className="text-lg font-mono font-bold text-white leading-none">
                    {value} <span className="text-xs text-slate-600 font-normal">{unit}</span>
                </div>
            </div>
        </div>
    )
}