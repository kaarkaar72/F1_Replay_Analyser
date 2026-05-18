import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';

const STAGES = [
  { id: 1, label: 'Loading session data' },
  { id: 2, label: 'Building driver grid' },
  { id: 3, label: 'Starting simulation' },
];

export default function LoadingOverlay({ stage = 1, sessionName = "", sessionCountry = "" }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 450);
    return () => clearInterval(t);
  }, []);

  const progress = Math.round((stage / STAGES.length) * 100);

  return (
    <div className="fixed inset-0 bg-[#060810] z-50 flex flex-col items-center justify-center">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-600 to-transparent" />

      <div className="relative flex flex-col items-center w-full max-w-xs px-6">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-red-600 p-2 rounded-lg">
            <Zap size={20} className="text-white" fill="currentColor" />
          </div>
          <span className="text-xl font-black italic tracking-tight text-white">F1 TELEMETRY</span>
        </div>

        {/* Session name */}
        {sessionName ? (
          <div className="text-center mb-10">
            <div className="text-[9px] font-extrabold tracking-[0.3em] text-slate-500 uppercase mb-2">
              Now Loading
            </div>
            <div className="text-2xl font-black text-white leading-tight">{sessionName}</div>
            {sessionCountry && (
              <div className="text-xs text-slate-500 mt-1 font-mono">{sessionCountry}</div>
            )}
          </div>
        ) : (
          <div className="mb-10 h-16 flex items-center">
            <div className="text-[9px] font-extrabold tracking-[0.3em] text-slate-500 uppercase">
              Initializing{dots}
            </div>
          </div>
        )}

        {/* Stage list */}
        <div className="w-full space-y-4 mb-8">
          {STAGES.map(s => {
            const done = stage > s.id;
            const current = stage === s.id;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                    done
                      ? 'bg-green-500/20'
                      : current
                      ? 'bg-blue-500/10 ring-1 ring-blue-500/30'
                      : 'bg-slate-800/60'
                  }`}
                >
                  {done && <CheckCircle2 size={14} className="text-green-400" />}
                  {current && <Loader2 size={12} className="text-blue-400 animate-spin" />}
                  {!done && !current && <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />}
                </div>
                <span
                  className={`text-xs font-bold tracking-wider transition-colors duration-300 ${
                    done ? 'text-green-400' : current ? 'text-white' : 'text-slate-700'
                  }`}
                >
                  {s.label}{current ? dots : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-0.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-red-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-[9px] text-slate-600 font-mono font-bold tabular-nums">
          {progress}%
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />
    </div>
  );
}
