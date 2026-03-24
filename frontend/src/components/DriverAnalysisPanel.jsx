import { useState, useEffect } from 'react';


import { ArrowLeft, Zap, Wind, Timer, Gauge, Activity, Layers, TrendingUp, Trophy, X, Settings, Flame, Hand} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import DriverTrackMap from './DriverTrackMap';
const API_URL = "http://localhost:8000";

export default function DriverAnalysisPanel({ driver, sessionKey, trackData, onClose }) {
    const [laps, setLaps] = useState([]);
    const [activeLapData, setActiveLapData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLap, setSelectedLap] = useState(null);
    const [sessionBest, setSessionBest] = useState(null);
    const [personalBest, setPersonalBest] = useState(null);

    // 1. Fetch Lap List (History)
    useEffect(() => {
        fetch(`${API_URL}/analysis/laps/${sessionKey}/${driver.driver_id}`)
            .then(res => res.json())
            .then(data => {
                setLaps(data);
                // console.log(data)
                // Auto-select the last completed lap
                if (data.length > 0) handleLapClick(data[data.length - 1].lap);
            });

    }, [driver]);

    useEffect(() => {
      // 1. Session Best
      fetch(`${API_URL}/analysis/reference-lap/${sessionKey}`)
        .then(r => r.json())
        .then(setSessionBest);
    //   console.log(sessionBest)
      // 2. Personal Best
      fetch(`${API_URL}/analysis/best-driver-lap/${sessionKey}/${driver.driver_id}`)
        .then(r => r.json())
        .then(setPersonalBest);
        console.log(personalBest)
    }, [sessionKey, driver.driver_id]);

    // 2. Handle Lap Selection
    const handleLapClick = async (lap) => {
        setSelectedLap(lap);
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/analysis/lap-telemetry/${sessionKey}/${driver.driver_id}/${lap}`);
            const data = await res.json();
            // console.log(data)
            setActiveLapData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for Sector Colors (Simple logic: < 30s is fast, > 30s is slow for demo)
    // In real app, compare vs Session Best
    const getSectorColor = (time) => {
        if (!time) return "text-slate-600";
        if (time < 30) return "text-green-400"; // Fast
        return "text-yellow-500"; // Slow
    };

    return (
        <div className="h-full flex flex-col p-4 animate-in slide-in-from-bottom-10 bg-slate-900 border-t border-slate-700">
            
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div className="flex items-center gap-4">
                    <img src={driver.headshot} className="w-12 h-12 rounded-lg border-2 bg-slate-800 object-cover" style={{borderColor: driver.team_color}} />
                    <div>
                        <h2 className="text-xl font-bold text-white leading-none">{driver.name}</h2>
                        <div className="flex gap-4 mt-1 text-xs text-slate-400 font-mono">
                            <span>{driver.team_name}</span>  
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <KpiBadge icon={Timer} label="Avg Pace" value={laps.stats?.avg_pace.toFixed(3)} color="text-blue-400" />
                        <KpiBadge icon={Activity} label="Consistency" value={`±${laps.stats?.consistency.toFixed(2)}s`} color="text-green-400" />
                        <KpiBadge icon={Trophy} label="Best Lap" value={laps.stats?.best_lap.toFixed(3)} color="text-purple-400" />
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <X className="text-slate-400" />
                </button>
            </div>

            {/* CONTENT GRID */}
            <div className="flex gap-6 h-full overflow-hidden">
                
                {/* LEFT: LAP LIST (Selector) */}
                <div className="w-64 flex-shrink-0 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Lap</span>
                        <span className="flex gap-3">
                            <span>time</span><span>S1</span><span>S2</span><span>S3</span>
                        </span>
                    </div>
                    <div className="p-3 bg-purple-900/20 border-b border-purple-500/30 text-xs font-mono">
                        <div className="flex justify-between font-bold text-purple-300 mb-1">
                            <span>SESSION BEST</span>
                            <span>{personalBest?.sectors?.lap_time?.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-purple-400/70">
                            <span>{personalBest?.sectors?.lap_duration?.toFixed(1)}</span>
                            <span>{personalBest?.sectors?.s1?.toFixed(1)}</span>
                            <span>{personalBest?.sectors?.s2?.toFixed(1)}</span>
                            <span>{personalBest?.sectors?.s3?.toFixed(1)}</span>
                        </div>
                    </div>

                    <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {laps.laps?.map(l => (
                            <div 
                                key={l.lap} 
                                onClick={() => handleLapClick(l.lap)}
                                className={`p-2 rounded cursor-pointer flex justify-between items-center transition-all text-xs font-mono border ${
                                    selectedLap === l.lap 
                                    ? "bg-blue-600/20 border-blue-500 text-white" 
                                    : "bg-transparent border-transparent hover:bg-slate-700"
                                }`}
                            >
                                <span className="font-bold">L{l.lap}</span>
                                <div className="flex gap-3">
                                    <span>{l.time}</span>
                                    <span className={getSectorColor(l.s1)}>{l.s1?.toFixed(1)}</span>
                                    <span className={getSectorColor(l.s2)}>{l.s2?.toFixed(1)}</span>
                                    <span className={getSectorColor(l.s3)}>{l.s3?.toFixed(1)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: TELEMETRY STACK */}
                <div className="flex-grow flex flex-col gap-4 relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-slate-900/80 z-10 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                    )}

                    {activeLapData?.metrics && (
                        <div className="grid grid-cols-4 gap-4 animate-in slide-in-from-top-4">
                            <MetricCard label="Top Speed" value={activeLapData?.metrics.max_speed} unit="km/h" icon={Gauge} color="text-blue-400" />
                            <MetricCard label="Avg Speed" value={activeLapData?.metrics.avg_speed.toFixed(0)} unit="km/h" icon={Activity} color="text-purple-400" />
                            <MetricCard label="Full Throttle" value={`${activeLapData?.metrics.full_throttle_pct.toFixed(0)}%`} icon={Zap} color="text-green-400" />
                            <MetricCard label="Braking Zones" value={`${activeLapData?.metrics.braking_zones}`} icon={X} color="text-red-400" />
                            <MetricCard label="Coasting" value={`${activeLapData?.metrics.coast_duration}s`} icon={Wind} color="text-slate-400" />
                            <MetricCard label="Gear Changes" value={`${activeLapData?.metrics.gear_shifts}`} icon={Settings} color="text-yellow-400" />
                            <MetricCard label="Aggression" value={`${activeLapData?.metrics.throttle_aggression}`} icon={Flame} color="text-orange-400" />
                            <MetricCard label="Grip" value={`${activeLapData?.metrics.low_speed_grip}`} icon={Hand} color="text-white-400" />
                        </div>
                    )}
                    {/* 1. SPEED */}
                    <div className="h-1/3 bg-slate-800/50 rounded-xl border border-slate-700 p-2 relative">
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">SPEED (KPH)</div>
                        {activeLapData?.corner_stat.map(c => (
                                    <ReferenceLine key={c.number} x={c.distance_pct} stroke="#475569" strokeDasharray="3 3" label={{ value: `T${c.number}`, position: 'insideTop', fill: '#64748b', fontSize: 10 }} />
                                ))}
                        <ResponsiveContainer>
                            <LineChart data={activeLapData?.trace} syncId="telemetry">
                                <XAxis dataKey="distance_pct" type="number" domain={[0, 100]} hide />
                                <YAxis domain={['dataMin', 'dataMax']} hide />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                                {activeLapData?.corner_stat.map(c => (
                                    <ReferenceLine 
                                        key={c.number} 
                                        x={c.distance_pct} 
                                        stroke="#475569" 
                                        strokeDasharray="3 3" 
                                        ifOverflow="visible" // Ensure it draws even if slightly out of bounds
                                        label={{ value: `T${c.number}`, position: 'insideTop', fill: '#64748b', fontSize: 10 }} 
                                    />
                                ))}
                                <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            </LineChart>
                            <LineChart data={sessionBest?.trace} syncId="telemetry">
                                <XAxis dataKey="distance_pct" type="number" domain={[0, 100]} hide />
                                <YAxis domain={['dataMin', 'dataMax']} hide />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                                <Line type="monotone" dataKey="speed" stroke="#ccd4e2" strokeWidth={2} dot={true} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 2. THROTTLE / BRAKE */}
                    <div className="h-1/3 bg-slate-800/50 rounded-xl border border-slate-700 p-2 relative">
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">INPUTS (%)</div>
                        <ResponsiveContainer>
                            <AreaChart data={activeLapData?.trace} syncId="telemetry">
                                <XAxis dataKey="distance_pct" type="number" hide />
                                <YAxis domain={[0, 100]} hide />
                                <Tooltip />
                                {activeLapData?.corner_stat.map(c => (
                                    <ReferenceLine 
                                        key={c.number} 
                                        x={c.distance_pct} 
                                        stroke="#475569" 
                                        strokeDasharray="3 3" 
                                        ifOverflow="visible" // Ensure it draws even if slightly out of bounds
                                        label={{ value: `T${c.number}`, position: 'insideTop', fill: '#64748b', fontSize: 10 }} 
                                    />
                                ))}
                                <Area type="step" dataKey="throttle" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                                <Area type="step" dataKey="brake" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 3. GEAR */}
                    <div className="h-1/3 bg-slate-800/50 rounded-xl border border-slate-700 p-2 relative">
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">GEAR</div>
                        <ResponsiveContainer>
                            <LineChart data={activeLapData?.trace} syncId="telemetry">
                                <XAxis dataKey="distance_pct" type="number" domain={[0, 100]} hide />
                                <YAxis domain={[0, 8]} hide />
                                <Tooltip />
                                {activeLapData?.corner_stat.map(c => (
                                    <ReferenceLine 
                                        key={c.number} 
                                        x={c.distance_pct} 
                                        stroke="#475569" 
                                        strokeDasharray="3 3" 
                                        ifOverflow="visible" // Ensure it draws even if slightly out of bounds
                                        label={{ value: `T${c.number}`, position: 'insideTop', fill: '#64748b', fontSize: 10 }} 
                                    />
                                ))}
                                <Line type="stepAfter" dataKey="gear" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>


                <div className="w-[30%] flex flex-col gap-4">
              
                    {/* Mini Map */}
                    <div className="h-64 bg-slate-800 rounded-xl border border-slate-700 p-2 relative">
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-slate-500">TRACK DOMINANCE</div>
                        {/* Reuse DriverTrackMap but pass 'compact={true}' prop to strip HUD */}
                        <DriverTrackMap 
                            driver={driver} 
                            trackData={trackData} 
                            lapTelemetry={activeLapData?.trace} 
                            compact={true}
                        />
                    </div>

                    {/* Corner Stats Table */}
                    <div className="flex-grow bg-slate-800 rounded-xl border border-slate-700 p-2 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500 border-b border-slate-700">
                                <tr>
                                    <th className="pb-2 pl-2">Turn</th>
                                    <th className="pb-2 text-right">Min Speed</th>
                                    <th className="pb-2 text-right">Apex Speed</th>
                                </tr>
                            </thead>
                            <tbody>

                                {activeLapData?.corner_stat.map(c => (
                                    <tr key={c.number} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                        <td className="py-2 pl-2 font-bold text-slate-300">T{c.number}</td>
                                        <td className="py-2 text-right font-mono text-white">{c.min_speed}</td>
                                        {/* Calculate Delta vs Best */}
                                        <td className={`py-2 text-right font-mono font-bold ${c.apex_speed < 0 ? "text-green-400" : "text-red-400"}`}>
                                            {c.apex_speed}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        
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