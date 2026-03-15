import { useState, useEffect, useRef } from 'react'
import { Zap, Gauge, Menu,Settings, Activity, Trophy } from 'lucide-react';
import RaceControl from './components/RaceControl';
import TrackMap from './components/TrackMap';
import WeatherWidget from './components/WeatherWidget';
import SessionHeader from './components/SessionHeader';
import DriverRow from './components/DriverRow';
import NotificationFeed from './components/NotificationFeed';
import RaceTimeline from './components/RaceTimeline';
import DebugConsole from './components/DebugConsole';
import LoadingOverlay from './components/LoadingOverlay';
import LiveFeed from './components/LiveFeed';
import DriverAnalysis from './components/DriverAnalysis';
import DriverAnalysisPanel from './components/DriverAnalysisPanel';
function App() {
  const [currentView, setCurrentView] = useState("race");
  const [analysisDriver, setAnalysisDriver] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [drivers, setDrivers] = useState({});
  const [connectionStatus, setStatus] = useState("Connecting...");
  const [activeSession, setActiveSession] = useState(null);
  const [weather, setWeather] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [lastAlert, setLastAlert] = useState(null);
  const [currentLap, setCurrentLap] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [latestEvent, setLatestEvent] = useState(null);
  const [exactLap, setExactLap] = useState(1.0);
  const sessionInfoRef = useRef(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  // const [exactLap, setExactLap] = useState(1.0);
  // Use Ref for WebSocket to prevent re-connections on re-renders
  const ws = useRef(null);
  useEffect(() => {
    console.log("Updating Ref:", sessionInfo);
    sessionInfoRef.current = sessionInfo;
  }, [sessionInfo]);
  // --- 1. WEBSOCKET CONNECTION (Persistent) ---
  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000/ws/race");

    ws.current.onopen = () => setStatus("Live 🟢");
    ws.current.onclose = () => setStatus("Offline 🔴");

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setCurrentTimestamp(data.timestamp);
      if (data.type === "weather") {
        setWeather(data);
        return; // Don't try to process as a driver
      }
      if (data.type === "race_control") {
        setLastAlert(data);
        return;
      }
      if (data.type === "pit_alert") {
          setDrivers(prev => ({
              ...prev,
              [data.driver_id]: {
                  ...prev[data.driver_id],
                  is_pitting: 1, // Force flag on
                  pit_count: (prev[data.driver_id]?.pit_count || 0) + 1,
                  last_pit_update: Date.now(),
                  last_pit_duration: data.last_pit_duration,
                  last_stop_duration: data.last_stop_duration,
                  last_lane_duration: data.last_lane_duration

              }
          }));

          setTimeout(() => {
              setDrivers(prev => ({
                  ...prev,
                  [data.driver_id]: { ...prev[data.driver_id], is_pitting: 0 }
              }));
          }, 25000);


          return;
      }
      if (data.type === "overtake") {
        setLastAlert(data);
        return;
      }
      
      
      setCurrentTimestamp(data.timestamp); // Just pass the raw time
      
      // Merge new telemetry into existing state
      setDrivers(prev => {
        // If driver doesn't exist in state yet (rare race condition), create stub
        const existing = prev[data.driver_id] || { 
            name: "UNK", team_color: "#555", driver_id: data.driver_id,position: 99
        };

        return {
          ...prev,
          [data.driver_id]: {
            ...existing,
            ...data // Overwrite dynamic fields (speed, rpm, x, y)
          }
        };
      });
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // --- 2. METADATA LOADER (Triggered by RaceControl) ---
  const loadSessionMetadata = async (sessionKey) => {
    console.log(`🏎️ Pre-loading Grid for Session ${sessionKey}...`);
    setWeather(null); // Clear old weather immediately for better UX
    setDrivers({}); // Clear old data immediately for better UX
    setActiveSession(sessionKey); // Triggers TrackMap to load
    setIsLoading(true);
    try {
      const res1 = await fetch(`http://localhost:8000/session-info/${sessionKey}`);
      const data = await res1.json();
      const resTrack = await fetch(`http://localhost:8000/track/${sessionKey}`);
      const trackJson = await resTrack.json();

      // 2. SET SESSION INFO STATE
      setSessionInfo({
          name: data.name,
          country: data.country,
          location: data.location,
          circuit: data.circuit,
          circuit_type: data.circuit_type,
          date: data.date,
          total_laps: data.total_laps,
          lap_map: data.lap_map,
          circuit_image: data.circuit_image,
          track_shape: trackJson.shape,
          track_corners: trackJson.corners
      });

      const res = await fetch(`http://localhost:8000/drivers/${sessionKey}`);
      const driverList = await res.json();
      console.log("API Response:", driverList);
      const initialState = {};
      driverList.forEach(d => {
        initialState[d.driver_number] = {
          driver_id: d.driver_number,
          name: d.name_acronym,      
          team_color: `#${d.team_colour}`,
          team_name: d.team_name,
          headshot: d.headshot_url,  
          speed: 0,
          lap: 0, 
          lap_duration: 0,
          rpm: 0, 
          throttle: 0,
          brake: 0,
          gear: 1,
          gap: "+0.0s",
          grid_position: d.grid_position,
          position: d.grid_position || 99
        };
      });
      // Reset state with the new grid (clears old race data)
      setDrivers(initialState);
      console.log(`✅ Loaded ${driverList.length} drivers.`);
      
    } catch (e) {
      console.error("❌ Metadata Load Failed", e);
    }
    setIsLoading(false);
  };

    // --- RESTORE STATE ON REFRESH ---
  useEffect(() => {
    async function checkActiveSession() {
      try {
        const res = await fetch("http://localhost:8000/simulation/status");
        const data = await res.json();
        
        if (data.active && data.session_key) {
          console.log("🔄 Restoring Session:", data.session_key);
          // Re-load the metadata (Drivers + Map)
          loadSessionMetadata(data.session_key);
          // setCurrentLap(data.start_lap);
        }

        if(data.start_lap) {
            setCurrentLap(data.start_lap);
          }
      } catch (e) {
        console.error("Failed to restore session:", e);
      }
    }
    
    checkActiveSession();
  }, []); // Empty dependency array = Runs once on page load

  // Convert Dict to Array for Rendering
  const driverList = Object.values(drivers).sort((a, b) => {
      // Sort by Position if available, otherwise by Speed
      // (Real F1 sorting logic would go here)
      const posA = a.position || 99;
      const posB = b.position || 99;
      return posA - posB;
  });

  const handleSeek = async (lap) => {
      setCurrentLap(lap);
      // Call API
      await fetch(`http://localhost:8000/simulation/seek?session_key=${activeSession}&lap=${lap}`, { method: 'POST' });
  };

   // 1. Extract the Logic
  const handleMessage = (data) => {
      // Handle Weather
      setCurrentTimestamp(data.timestamp)

      if (data.type === "weather") { 
        setWeather(data); return; 
      }
      
      // Handle Alerts
      if (data.type === "race_control") { 
        setLatestEvent({
            type: 'control',
            category: data.category,
            message: data.message,
            flag: data.flag,
            timestamp: data.timestamp
        }); 
        return; 
      }

      // Handle Pit Alerts
      if (data.type === "pit_alert") {
          setDrivers(prev => ({
              ...prev,
              [data.driver_id]: { 
                  ...prev[data.driver_id], 
                  
                  // Update Data
                  last_pit_duration: data.last_pit_duration,
                  pit_count: data.pit_count || ((prev[data.driver_id]?.pit_count || 0) + 1),
                  
                  // TRIGGER THE FLASH (Critical)
                  last_pit_update: Date.now() 
              }
          }));
          const pitter = drivers[data.driver_id]?.name || `#${data.driver_id}`;
          setLatestEvent({
              type: 'pit',
              category: 'PIT STOP',
              message: `${pitter} Boxed (${data.last_pit_duration}s)`,
              timestamp: data.timestamp, // Or use data timestamp
              driver_code: `${data.driver_id}`
          });
          return;
      }

      if (data.type === "overtake"){
        const overtaker = drivers[data.overtaking_driver_number]?.name || `#${data.overtaking_driver_number}`;
        const victim = drivers[data.overtaken_driver_number]?.name || `#${data.overtaken_driver_number}`;
        setLatestEvent({
            type: 'overtake',
            category: "TAKE OVER",
            message: `${overtaker} crossed ${victim} and now in P${data.position}`,
            timestamp: data.timestamp
        }); 
        return; 
      }

      // Handle Driver Updates
      setDrivers(prev => {
        const existing = prev[data.driver_id] || { name: "UNK", driver_id: data.driver_id };
        return {
          ...prev,
          [data.driver_id]: { ...existing, ...data }
        };
      });
  };

  // 2. WebSocket calls it
  useEffect(() => {
    ws.current.onmessage = (event) => handleMessage(JSON.parse(event.data));
  }, []);

  const getCurrentLapDisplay = () => {
    if (!sessionInfo?.lap_map || !currentTimestamp) return 1;
    // console.log(currentTimestamp)
    // Simple lookup: Find last lap where start_time <= currentTimestamp
    // We iterate backwards for efficiency
    for (let i = sessionInfo.lap_map.length - 1; i >= 0; i--) {
        if (sessionInfo.lap_map[i].start_time_ms <= currentTimestamp) {
            return sessionInfo.lap_map[i].lap;
        }
    }
    return 1;
  };  

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-mono flex flex-col">
      {isLoading && <LoadingOverlay message="Initializing Session..." />}
      {/* --- HEADER --- */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-2xl">
        
        {/* LEFT: Logo & Menu */}
        <div className="flex items-center gap-6 w-1/3">
            <button onClick={() => setSidebarOpen(true)} className="..."> <Settings /> </button>
            <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
                <div className="bg-red-600 p-2 rounded-lg"><Zap className="text-white" size={20} /></div>
                <div>
                    <h1 className="text-xl font-black italic">F1 TELEMETRY</h1>
                </div>
            </div>
        </div>

        {/* CENTER: Info + Timeline (Stacked) */}
        <div className="flex-grow flex flex-col justify-center items-center gap-2 max-w-3xl">
            
            {/* 1. Session Info (Compact) */}
            <div className="w-full">
                <SessionHeader session={sessionInfo} />
            </div>
        </div>

        {/* RIGHT: Weather Component + Status */}
        <div className="flex items-center justify-end gap-4 w-1/4">
            <WeatherWidget weather={weather} />

                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-widest ${
            connectionStatus.includes("Live") 
            ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
        }`}>
            {connectionStatus.includes("Live") ? (
                <>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    PLAYING
                </>
            ) : (
                <>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                    PAUSED
                </>
            )}
          </div>
        </div>

      </header>
      {/* Slider Panel */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)} // <--- THIS CLOSES IT
      />
      <div className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-700 z-50 p-6 shadow-2xl transform transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
         <RaceControl 
            currentView={currentView}
            setView={setCurrentView}
            onSessionChange={setActiveSession} 
            onLoadMetadata={loadSessionMetadata}
            totalLaps={sessionInfo?.total_laps}
            onClose={() => setSidebarOpen(false)}
         />
      </div>

      {/* DASHBOARD GRID */}
      <div className="flex-grow p-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 flex flex-col gap-3">
              <TrackMap sessionKey={activeSession} drivers={drivers} trackImage={sessionInfo?.circuit_image} latestEvent={latestEvent} currentLap={getCurrentLapDisplay()} totalLaps={sessionInfo?.total_laps} />
            </div>
            <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-[700px] overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-700 bg-slate-800 z-10 flex justify-between items-center">
                  <h2 className="font-bold flex items-center gap-2"><Trophy size={16} className="text-yellow-500"/> Live Timing</h2>
                  <span className="text-xs text-slate-500">{driverList.length} Drivers</span>
              </div>
             <div className="overflow-y-auto p-1 space-y-3 custom-scrollbar">
                {driverList.map((driver) => (
                    <div 
                        key={driver.driver_id} 
                        onClick={() => {
                            setAnalysisDriver(driver);
                            setCurrentView('analysis');
                        }}
                        className="cursor-pointer transition-transform active:scale-[0.98]"
                    >
                        <DriverRow driver={driver} totalLaps={sessionInfo?.total_laps || 0} />
                    </div>
                ))}
                {driverList.length === 0 && (
                    <div className="text-center text-slate-500 py-10 italic">Waiting for session data...</div>
                )}
            </div>
            </div>
          </div> 


          {/* <DriverAnalysis 
                  driver={analysisDriver || driverList[0]} // Default to P1 if none selected
                  sessionKey={activeSession}
                  currentTimestamp={currentTimestamp}
                  onBack={() => setCurrentView('race')}
                  trackData={{ 
                    shape: sessionInfo?.track_shape, // Ensure you saved this in sessionInfo
                    corners: sessionInfo?.track_corners 
                  }}
              /> */}
      </div>
      <div className="flex-grow bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative">
               {analysisDriver ? (
                   <DriverAnalysisPanel 
                       driver={analysisDriver} 
                       sessionKey={activeSession} 
                       currentTimestamp={currentTimestamp}
                       onClose={() => setAnalysisDriver(null)}
                   />
               ) : (
                <RaceTimeline 
                    currentTimestamp={currentTimestamp} 
                    totalLaps={sessionInfo?.total_laps} 
                    onSeek={handleSeek}
                    // status={connectionStatus.includes("Live") ? "running" : "idle"}
                    lapMap={sessionInfo?.lap_map}
                    compact={true} // Add a prop to styling it smaller
                />
               )}
              </div>
      <DebugConsole onInjectMessage={handleMessage} />

    </div>
  )
}

export default App