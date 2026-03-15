import { AlertTriangle, Flag, Info, MessageSquare } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function NotificationFeed({ lastAlert }) {
  const [alerts, setAlerts] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!lastAlert) return;

    // Add new alert to top
    const newAlert = { ...lastAlert, id: Date.now() };
    setAlerts(prev => [newAlert, ...prev]); // Prepend to list

    // Optional: Auto-scroll to top if user scrolled down
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [lastAlert]);

  // Helper for Flag Colors
  const getIcon = (alert) => {
    if (alert.flag) return <Flag size={16} className={alert.flag === "GREEN" ? "text-green-500" : "text-yellow-500"} />;
    if (alert.category === "SafetyCar") return <AlertTriangle size={16} className="text-orange-500" />;
    return <Info size={16} className="text-blue-400" />;
  };

  return (
    // Inside NotificationFeed
<div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-2xl ...">
      
      {/* Header */}
      <div className="p-3 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <MessageSquare size={16} /> RACE CONTROL MESSAGES
        </h3>
        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-400">{alerts.length} EVENTS</span>
      </div>

      {/* Scrollable List */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {alerts.length === 0 && (
            <div className="text-center text-slate-600 text-xs py-10 italic">No events yet...</div>
        )}
        
        {alerts.map((alert, index) => (
          <div 
            key={alert.id}
            className={`p-3 rounded border border-slate-700/50 bg-slate-900/30 flex gap-3 items-start transition-all hover:bg-slate-700/30 ${index === 0 ? "animate-in slide-in-from-top-2 duration-300 border-l-4 border-l-blue-500" : ""}`}
          >
            <div className="mt-0.5">{getIcon(alert)}</div>
            
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{alert.category}</span>
                    <span className="text-[10px] font-mono text-slate-600">{alert.timestamp.substring(11, 19)}</span>
                </div>
                <div className="text-sm font-medium text-slate-200 leading-tight mt-0.5">
                    {alert.message}
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}