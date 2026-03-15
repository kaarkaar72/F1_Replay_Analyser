import { useState } from 'react';
import { Bug, AlertTriangle, Fuel } from 'lucide-react';

export default function DebugConsole({ onInjectMessage }) {
  const [isOpen, setIsOpen] = useState(false);

  const triggerPit = () => {
    // Simulate Driver 1 (Verstappen) Pitting
    onInjectMessage({
      driver_id: 1,
      speed: 60, // Slow down
      lap: 15
    });
    
    // Simulate Pit Alert
    onInjectMessage({
      type: "pit_alert",
      driver_id: 1,
        last_pit_duration: (Math.random() * 5 + 20).toFixed(1), // Random 20-25s
      pit_count: 2, // Mock count
    });
  };

  const triggerSafetyCar = () => {
    onInjectMessage({
      type: "race_control",
      category: "SafetyCar",
      flag: "YELLOW",
      message: "SAFETY CAR DEPLOYED - NO OVERTAKING",
      timestamp: new Date().toISOString()
    });
  };

  const triggerOvertake = () => {
    // Swap Driver 1 and 14 positions
    onInjectMessage({ driver_id: 1, position: 2 });
    onInjectMessage({ driver_id: 14, position: 1 });
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 p-3 rounded-full shadow-xl hover:bg-purple-500 transition-all z-50"
      >
        <Bug size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-purple-500 p-4 rounded-xl shadow-2xl z-50 w-64">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-purple-400 flex items-center gap-2"><Bug size={16}/> Debug Tools</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={triggerPit} className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-xs font-mono flex items-center gap-2 border border-slate-700">
            <Fuel size={14} className="text-yellow-500"/> Force Pit (VER)
        </button>
        <button onClick={triggerSafetyCar} className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-xs font-mono flex items-center gap-2 border border-slate-700">
            <AlertTriangle size={14} className="text-orange-500"/> Force Safety Car
        </button>
        <button onClick={triggerOvertake} className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-xs font-mono flex items-center gap-2 border border-slate-700">
            🏎️ Force Overtake (ALO P1)
        </button>
      </div>
    </div>
  );
}