import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ message = "Loading Telemetry..." }) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <Loader2 size={48} className="text-red-600 animate-spin mb-4" />
      <div className="text-sm font-bold text-white tracking-widest uppercase animate-pulse">
        {message}
      </div>
    </div>
  );
}