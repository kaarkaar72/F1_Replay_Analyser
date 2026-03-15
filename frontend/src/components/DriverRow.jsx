import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Minus } from 'lucide-react';

export default function DriverRow({ driver, totalLaps }) {
    // Logic
    const rpmPercent = Math.min((driver.rpm / 12500) * 100, 100);
    const isPitting = driver.is_pitting == 1; // Ensure boolean
    const [isPittingFlash, setPittingFlash] = useState(false);
    
    const grid = driver.grid_position || 0;
    const current = driver.position || 0;
    const delta = grid - current;

    const getSegmentColor = (val) => {
        if (val === 2051) return "bg-purple-500"; 
        if (val === 2049) return "bg-green-500";  
        if (val === 2048) return "bg-yellow-500"; 
        if (val === 2064) return "bg-red-500"; 
        return "bg-slate-700"; 
    };

    useEffect(() => {
        if (driver.last_pit_update) {
            setPittingFlash(true);
            const timer = setTimeout(() => setPittingFlash(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [driver.last_pit_update]);

    return (
        <div className={`rounded-lg border transition-all duration-500 group relative overflow-hidden flex flex-col ${
            isPittingFlash 
            ? "bg-purple-900/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]" 
            : "bg-slate-900/50 border-slate-700/50 hover:border-slate-500"
        }`}>
            
            {/* TOP ROW: Main Data */}
            <div className="p-3 flex items-center justify-between w-full">
                
                {/* LEFT: Identity Cluster */}
                <div className="flex items-center gap-3 w-[60%] shrink-0">
                
                {/* 1. POSITION (Big & Bold) */}
                <div className="flex flex-col items-center w-8 shrink-0">
                    <div className="text-3xl font-black italic text-slate-500 leading-none" style={{fontFamily: 'Impact, sans-serif'}}>
                        {driver.position || "-"}
                    </div>
                    {/* Delta Arrow */}
                    {grid > 0 && current > 0 && delta !== 0 && (
                        <div className={`flex items-center text-[10px] font-bold mt-1 ${delta > 0 ? "text-green-500" : "text-red-500"}`}>
                            {delta > 0 ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} 
                            {Math.abs(delta)}
                        </div>
                    )}
                </div>

                {/* 2. DRIVER DETAILS */}
                <div className="flex items-center gap-3 flex-grow">
                    
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <img 
                            src={driver.headshot || "..."} 
                            className="w-12 h-12 rounded-lg object-cover bg-slate-800 border-l-4" 
                            style={{borderColor: driver.team_color}}
                            alt={driver.team_name}
                        />
                        
                        {isPittingFlash && (
                            <div className="absolute -bottom-2 -right-4 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg animate-bounce z-20">
                                {driver.last_pit_duration}s
                            </div>
                        )}
                    </div>
                    
                    {/* Name & Metadata Grid */}
                    <div className="flex flex-col w-full justify-center h-full gap-1">
                        
                        {/* ROW 1: Name & Team Badge */}
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-lg leading-none truncate">{driver.name}</span>
                            {/* Team Badge (Small Pill) */}
                        </div>

                        {/* ROW 2: STATUS (Gap, Lap, Stop, Last Time) */}
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{driver.team_name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${driver.pit_count > 0 ? "bg-red-500" : "bg-slate-600"}`}></span>
                            <span>{driver.pit_count}</span>
                        </div>
                    </div>
                </div>
            </div>

                {/* RIGHT: Telemetry Cluster */}
                <div className="flex items-center gap-3 w-[40%] shrink-0">
                    
                    {/* Speed & Gear */}
                    <div className="flex flex-col items-end mr-2">
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-mono font-bold leading-none tracking-tighter ${isPitting ? "text-yellow-500" : "text-white"}`}>
                                {driver.speed}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold mb-1">KPH</span>
                        </div>
                        <div className="flex gap-1 mt-1">
                            {driver.gear <= 0 ? (
                                <span className="text-[9px] font-bold text-red-500 bg-red-900/20 px-1.5 rounded">{driver.gear === 0 ? "N" : "R"}</span>
                            ) : (
                                [1, 2, 3, 4, 5, 6, 7, 8].map(gearNum => (
                                    <div key={gearNum} className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                                        driver.gear >= gearNum ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)] scale-110" : "bg-slate-800"
                                    }`}></div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RPM Gauge */}
                    <div className="flex flex-col items-center">
                        <div className="relative w-10 h-10">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="20" cy="20" r="16" stroke="#1e293b" strokeWidth="3" fill="none" />
                                <circle 
                                    cx="20" cy="20" r="16" 
                                    stroke={driver.rpm > 11500 ? "#ef4444" : "#a855f7"} 
                                    strokeWidth="3" fill="none"
                                    strokeDasharray={100} 
                                    strokeDashoffset={100 - (Math.min(driver.rpm, 13000) / 13000) * 100} 
                                    strokeLinecap="round"
                                    className="transition-all duration-75 ease-linear"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-slate-300">
                                {(driver.rpm / 1000).toFixed(1)}
                            </div>
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">RPM</span>
                    </div>

                    {/* Pedals */}
                    <div className="flex gap-2 h-10 items-end">
                        <div className="flex flex-col items-center gap-1 h-full">
                            <div className="w-2 bg-slate-800 rounded-sm flex-grow relative overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-green-500 transition-all duration-75 ease-linear" style={{height: `${driver.throttle}%`}}></div>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold">THR</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 h-full">
                            <div className="w-2 bg-slate-800 rounded-sm flex-grow relative overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-red-500 transition-all duration-75 ease-linear" style={{height: `${driver.brake}%`}}></div>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold">BRK</span>
                        </div>
                    </div>

                </div>
            </div>
            <div className="flex items-center justify-between bg-slate-950/30 rounded px-2 py-1 mb-1 text-[9px] font-mono text-slate-400">
                            {/* Lap */}
                <div className="flex gap-1">
                    <span className="text-slate-600 font-bold">LAP</span>
                    <span className="text-white">{driver.lap}</span>
                </div>

                {/* Gap */}
                <div className={driver.position===1?"text-yellow-500":"text-slate-300"}>
                    {driver.gap}
                </div>

                {/* Last Lap */}
                <div className="text-green-400 font-bold">
                    {driver.lap_duration?.toFixed(3)}
                </div>

                {/* Sectors */}
                <div className="flex gap-2">
                    <span className={!driver.s1?"text-slate-700":"text-white"}>{driver.s1?.toFixed(1)}</span>
                    <span className={!driver.s2?"text-slate-700":"text-white"}>{driver.s2?.toFixed(1)}</span>
                    <span className={!driver.s3?"text-slate-700":"text-white"}>{driver.s3?.toFixed(1)}</span>
                </div>
            </div>

            {/* BOTTOM ROW: Sector Performance Bar */}
            <div className="w-full h-1.5 flex gap-px bg-slate-950/50">
                {[...(driver.segments_s1||[]), ...(driver.segments_s2||[]), ...(driver.segments_s3||[])].map((val, i) => (
                    <div key={i} className={`flex-grow h-full ${getSegmentColor(val)}`}></div>
                ))}
            </div>
            

        </div>
    )
}