import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, Wind, Timer, Gauge, Activity, Layers, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';

export default function DriverAnalysisPanel({ driver, sessionKey, currentTimestamp, onClose }) {
    const API_URL = "http://localhost:8000";
    const [telemetry, setTelemetry] = useState([]);
    const [corners, setCorners] = useState([]);
    const [mapOverlayData, setMapOverlayData] = useState([]);
    const [activeLapMetrics, setActiveLapMetrics] = useState(null)

    useEffect(() => {
        if (!driver || !sessionKey) return;
    
        const fetchData = () => {
            const timeParam = currentTimestamp ? `?time=${currentTimestamp}` : "";
            
            // fetch(`${API_URL}/analysis/laps/${sessionKey}/${driver.driver_id}${timeParam}`)
            //     .then(res => res.json())
            //     .then(data => setLaps(data))
            //     .catch(console.error);
                
            fetch(`${API_URL}/analysis/telemetry/${sessionKey}/${driver.driver_id}${timeParam}`)
                .then(res => res.json())
                .then(data => setTelemetry(data))
                .catch(console.error);
        };
    
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
      }, [driver, sessionKey, currentTimestamp]);

    const handleMapLapClick = async (lap) => {
        const res = await fetch(`${API_URL}/analysis/lap-telemetry/${sessionKey}/${driver.driver_id}/${lap}`);
        const data = await res.json();
        console.log(data)
        setMapOverlayData(data.trace);
        setActiveLapMetrics(data.metrics);
    };
    // const bestLap = laps.length > 0 ? Math.min(...laps.map(l => l.time)).toFixed(3) : "--.---";

    return (
        <div className="h-full flex flex-col p-4 animate-in slide-in-from-bottom-10">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <img src={driver.headshot} className="w-10 h-10 rounded-full border-2" style={{borderColor: driver.team_color}} />
                    <h2 className="text-xl font-bold">{driver.name} Analysis</h2>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
            </div>

            {/* Metrics Row */}
            <div className="flex gap-4 mb-4">
                {/* Metric Cards ... */}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-4 flex-grow">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col shadow-xl h-64">  
                </div> 
                
                {/* Lap History */}
                <div className="bg-slate-900/50 rounded border border-slate-700 p-2">
                    <ResponsiveContainer>
                        {/* <ScatterChart ... /> */}
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    )
}