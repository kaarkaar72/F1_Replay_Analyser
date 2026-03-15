import { useEffect, useState, useRef } from 'react';
import { Flag, AlertTriangle, Info, Wrench, Zap } from 'lucide-react';

export default function LiveRaceFeed({ latestEvent }) {
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!latestEvent) return;

    // Add new event with unique ID
    const newMsg = { ...latestEvent, id: Date.now() };
    
    // Keep last 15 messages, newest at the bottom
    setMessages(prev => [...prev.slice(-14), newMsg]);

  }, [latestEvent]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Helper: Style based on event type
  const getStyle = (msg) => {
    if (msg.type === 'pit') return "border-l-purple-500 bg-purple-900/20";
    if (msg.type === 'fastest_lap') return "border-l-pink-500 bg-pink-900/20";
    if (msg.type == 'overtake') return "border-l-red-500 bg-red-900/20";
    // Race Control Flags
    switch (msg.flag) {
        case 'RED': return "border-l-red-600 bg-red-900/40";
        case 'YELLOW': return "border-l-yellow-500 bg-yellow-900/20";
        case 'GREEN': return "border-l-green-500 bg-green-900/20";
        default: return "border-l-slate-500 bg-slate-900/40";
    }
  };

  const getIcon = (msg) => {
      if (msg.type === 'pit') return <Wrench size={14} className="text-purple-400" />;
      if (msg.type === 'fastest_lap') return <Zap size={14} className="text-pink-400" />;
      if (msg.type == 'overtake') return <Zap size={14} className="text-pink-400" />;
      if (msg.category === 'SafetyCar') return <AlertTriangle size={14} className="text-orange-500" />;
      return <Flag size={14} className="text-white" />;
  };


  const formatEventTime = (ts) => {
      if (!ts) return "--:--:--";
      
      // If it's already a time string like "14:05:00", return it (rare)
      if (typeof ts === 'string' && ts.length === 8 && ts.includes(':')) return ts;

      // Handle ISO String or Epoch Number
      try {
          const date = new Date(ts);
          // Returns "14:05:23"
          return date.toLocaleTimeString('en-GB', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: false 
          });
      } catch (e) {
          return "--:--:--";
      }
  };

  return (
    <div className="flex flex-col justify-end h-64 w-72 font-mono text-xs pointer-events-none mask-linear-fade">
      {/* The mask-linear-fade class (custom CSS) helps top messages fade out */}
      
      <div className="overflow-hidden flex flex-col gap-1.5 p-2">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`
                relative p-2 rounded-r-md border-l-[3px] backdrop-blur-md shadow-sm 
                text-white animate-in slide-in-from-left-2 duration-300
                ${getStyle(msg)}
            `}
          >
            <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{getIcon(msg)}</div>
                <div>
                    <div className="flex gap-2 opacity-70 text-[9px] uppercase font-bold tracking-wider">
                        <span>{formatEventTime(msg.timestamp)}</span>
                        <span>{msg.driver_code ? `[${msg.driver_code}]` : msg.category}</span>
                    </div>
                    <div className="leading-tight font-medium shadow-black drop-shadow-md">
                        {msg.message}
                    </div>
                </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}