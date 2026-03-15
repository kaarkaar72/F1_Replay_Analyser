import { useState, useEffect, useRef } from 'react';

export default function RaceTimeline({ currentTimestamp, totalLaps, onSeek, lapMap }) {
  const [hoverLap, setHoverLap] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [displayLap, setDisplayLap] = useState(1); // The lap value shown on the bar
  
  const barRef = useRef(null);
  const lastSeekTime = useRef(0);

  // --- 1. INTERNAL CALCULATION LOGIC ---
  const calculateLapFromTimestamp = (ts) => {
      if (!lapMap || !ts || lapMap.length === 0) return 1;
      
      let currentLapObj = lapMap[0];
      let nextLapObj = null;

      for (let i = 0; i < lapMap.length; i++) {
          if (lapMap[i].start_time_ms <= ts) {
              currentLapObj = lapMap[i];
              nextLapObj = lapMap[i+1];
          } else {
              break;
          }
      }

      if (!nextLapObj) return currentLapObj.lap; 

      const start = currentLapObj.start_time_ms;
      const end = nextLapObj.start_time_ms;
      const duration = end - start;
      const elapsed = ts - start;
      
      if (duration <= 0) return currentLapObj.lap;
      
      return currentLapObj.lap + Math.min(Math.max(elapsed / duration, 0), 1);
  };

  // --- 2. SYNC WITH PROPS ---
  useEffect(() => {
    const timeSinceSeek = Date.now() - lastSeekTime.current;
    
    // Only update from backend if user is NOT dragging AND NOT recently seeked
    if (!isDragging) {
      const calculated = calculateLapFromTimestamp(currentTimestamp);
    //   console.log(calculated);
      setDisplayLap(calculated);
    }
  }, [currentTimestamp, isDragging, lapMap]);

  // --- 3. HELPERS ---
  const getTime = (lap) => {
    const l = lapMap?.find(x => x.lap === Math.round(lap));
    if (!l) return "";
    return new Date(l.start_time_ms).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  // --- 4. HANDLERS ---
  const handleMouseMove = (e) => {
      if (!barRef.current || !totalLaps) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      
      // Calculate lap based on mouse position
      const lap = Math.max(1, Math.min(totalLaps, pct * totalLaps));
      
      setHoverLap(Math.round(lap));
      
      if (isDragging) {
          setDisplayLap(lap);
      }
  };

  const handleMouseDown = (e) => {
      setIsDragging(true);
      handleMouseMove(e); // Snap thumb to mouse immediately
  };

  const handleMouseUp = () => {
      if (isDragging) {
          setIsDragging(false);
          lastSeekTime.current = Date.now(); 
          // Seek to the INTEGER lap start (e.g. Lap 5.0)
          onSeek(Math.floor(displayLap));
      }
  };

  if (!totalLaps) return null;

  const progressPct = (displayLap / totalLaps) * 100;
  const hoverPct = (hoverLap / totalLaps) * 100;
//   console.log(totalLaps,progressPct,hoverPct);
  return (
    <div 
        className="w-full h-12 flex items-center px-1 select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverLap(null)}
        onMouseUp={handleMouseUp}
    >
        {/* The Track Container */}
        <div ref={barRef} className="relative w-full h-2 bg-slate-800 rounded-full cursor-pointer group" onMouseDown={handleMouseDown}>
            
            {/* 1. Hover Preview Bar (Light Grey) */}
            <div 
                className="absolute top-0 left-0 h-full bg-white/20 rounded-full transition-all duration-75"
                style={{ width: `${hoverPct}%`, opacity: hoverLap ? 1 : 0 }}
            />

            {/* 2. Active Progress Bar (Red - F1 Style) */}
            <div 
                className="absolute top-0 left-0 h-full bg-red-600 rounded-full relative"
                style={{ width: `${progressPct}%` }}
            >
                {/* The Thumb (Only visible on hover/drag) */}
                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-100 ${isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100'}`} />
            </div>

            {/* 3. Hover Tooltip */}
            {hoverLap && (
                <div 
                    className="absolute bottom-4 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded border border-slate-700 shadow-xl pointer-events-none z-50 whitespace-nowrap"
                    style={{ left: `${hoverPct}%` }}
                >
                    <div className="text-center text-slate-400 uppercase tracking-widest text-[8px]">Lap {hoverLap}</div>
                    <div className="font-mono text-xs">{getTime(hoverLap)}</div>
                </div>
            )}
        </div>
    </div>
  );
}