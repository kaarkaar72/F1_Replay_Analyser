import { CloudRain, Thermometer, Droplets } from 'lucide-react';

export default function WeatherWidget({ weather }) {
  if (!weather) return null;

  return (
    <div className="flex items-center gap-5 text-xs font-bold text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50 transition-all hover:border-slate-600">
      
      {/* Air Temp */}
      <div className="flex items-center gap-1.5">
        <Thermometer size={14} className="text-orange-400" /> 
        <span className="text-white font-mono text-sm">{weather.air_temp}°</span>
      </div>

      {/* Humidity */}
      <div className="flex items-center gap-1.5 border-l border-slate-700 pl-4">
        <Droplets size={14} className="text-cyan-400" />
        <span className="text-white font-mono text-sm">{weather.humidity}%</span>
      </div>

      {/* Rain Status */}
      {weather.rainfall > 0 && (
        <div className="flex items-center gap-1 text-red-400 animate-pulse border-l border-slate-700 pl-4">
          <CloudRain size={14} /> RAIN
        </div>
      )}
    </div>
  );
}