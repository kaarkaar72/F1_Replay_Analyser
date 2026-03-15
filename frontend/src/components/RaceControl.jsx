import { useState, useEffect } from 'react';
import { Play, Square, Loader2, X, Settings2, Activity, BarChart2} from 'lucide-react';
// import { FiActivity, FiBarChart2 } from 'react-icons/fi';

const API_URL = "http://localhost:8000";

export default function RaceControl({ currentView, setView, onSessionChange, onLoadMetadata, totalLaps, onClose }) {
  // --- STATE ---
  const [seasons, setSeasons] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  
  const [startLap, setStartLap] = useState(1);
  const [status, setStatus] = useState("idle"); // idle, loading, running, seeking

  // --- DATA FETCHING ---
  
  // 1. Seasons
  useEffect(() => {
    fetch(`${API_URL}/seasons`)
      .then(res => res.json())
      .then(data => setSeasons(data))
      .catch(err => console.error("API Error:", err));
  }, []);

  // 2. Meetings
  useEffect(() => {
    if (!selectedYear) return;
    fetch(`${API_URL}/meetings/${selectedYear}`)
      .then(res => res.json())
      .then(data => setMeetings(data));
  }, [selectedYear]);

  // 3. Sessions
  useEffect(() => {
    if (!selectedMeeting) return;
    fetch(`${API_URL}/sessions/${selectedMeeting}`)
      .then(res => res.json())
      .then(data => setSessions(data));
  }, [selectedMeeting]);

  // --- ACTIONS ---
  const handleSessionSelect = (e) => {
      const sess = e.target.value;
      setSelectedSession(sess);
      onSessionChange(sess); // Notify Parent
  };

  const handleStart = async () => {
    if (!selectedSession) return;
    setStatus("loading");
    
    try {
      // 1. Load Metadata First
      await onLoadMetadata(selectedSession);
      
      // 2. Start Simulation
      const res = await fetch(`${API_URL}/simulation/start?session_key=${selectedSession}`, { method: 'POST' });
      
      if (res.ok) setStatus("running");
      else setStatus("idle");
      
    } catch (e) {
      console.error(e);
      setStatus("idle");
    }
  };

  const handleStop = async () => {
    await fetch(`${API_URL}/simulation/stop`, { method: 'POST' });
    setStatus("idle");
  };

  const handleSeek = async () => {
    if (status !== "running") return; // Only seek if already running
    
    setStatus("seeking");
    try {
        await fetch(`${API_URL}/simulation/seek?session_key=${selectedSession}&lap=${startLap}`, { method: 'POST' });
        setStatus("running");
    } catch (e) {
        console.error(e);
        setStatus("running"); // Revert status on fail
    }
  };

  return (
    <div className="flex flex-col h-full text-white font-mono">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
        <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings2 size={20} className="text-blue-400"/> Mission Control
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded">
            <X size={20} />
        </button>
      </div>
      {/* VIEW TOGGLE */}
      <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 mb-6 flex">
          <button 
            onClick={() => setView('race')}
            className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${
                currentView === 'race' ? "bg-slate-700 text-white shadow" : "text-slate-500 hover:text-white"
            }`}
          >
            <Activity size={14} /> LIVE RACE
          </button>
          
          <button 
            onClick={() => setView('analysis')}
            className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${
                currentView === 'analysis' ? "bg-slate-700 text-white shadow" : "text-slate-500 hover:text-white"
            }`}
          >
            <BarChart2 size={14} /> ANALYSIS
          </button>
      </div>

      {/* FORM AREA */}
      <div className="flex flex-col gap-6 flex-grow overflow-y-auto">
        
        {/* Year */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Season</label>
          <select 
            className="bg-slate-800 border border-slate-600 text-white p-3 rounded-lg focus:border-blue-500 outline-none w-full transition-all hover:border-slate-500"
            onChange={(e) => setSelectedYear(e.target.value)}
            value={selectedYear}
          >
            <option value="">Select Year...</option>
            {seasons.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Meeting */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Grand Prix</label>
          <select 
            className="bg-slate-800 border border-slate-600 text-white p-3 rounded-lg focus:border-blue-500 outline-none w-full transition-all hover:border-slate-500"
            onChange={(e) => setSelectedMeeting(e.target.value)}
            disabled={!selectedYear}
          >
            <option value="">Select Race...</option>
            {meetings.map(m => (
              <option key={m.meeting_key} value={m.meeting_key}>{m.meeting_name}</option>
            ))}
          </select>
        </div>

        {/* Session */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Session</label>
          <select 
            className="bg-slate-800 border border-slate-600 text-white p-3 rounded-lg focus:border-blue-500 outline-none w-full transition-all hover:border-slate-500"
            onChange={handleSessionSelect}
            disabled={!selectedMeeting}
          >
            <option value="">Select Session...</option>
            {sessions.map(s => (
              <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
            ))}
          </select>
        </div>
      </div>


      

      {/* FOOTER ACTIONS */}
      <div className="mt-auto pt-6 border-t border-slate-700 flex flex-col gap-3">
        
        {/* Status Indicator */}
        {status !== "idle" && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-400 animate-pulse mb-2">
                <Loader2 size={14} className="animate-spin" /> 
                {status === "seeking" ? "SEEKING..." : "INITIALIZING..."}
            </div>
        )}

        <button 
          onClick={handleStart}
          disabled={!selectedSession || status === "running" || status === "seeking"}
          className={`w-full flex justify-center items-center gap-2 px-4 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
            status === "running" 
            ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" 
            : "bg-green-600 hover:bg-green-500 text-white hover:shadow-green-900/20 active:scale-95"
          }`}
        >
          <Play fill="currentColor" size={20} />
          {status === "running" ? "RUNNING" : "START REPLAY"}
        </button>

        <button 
          onClick={handleStop}
          className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold bg-red-900/10 text-red-400 border border-red-900/30 hover:bg-red-900/30 transition-all active:scale-95"
        >
          <Square size={18} fill="currentColor" /> STOP
        </button>
      </div>

    </div>
  );
}