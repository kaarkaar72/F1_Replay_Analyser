import { Flag } from 'lucide-react';

export default function SessionHeader({ session }) {
  if (!session) {
    return <div className="text-slate-600 text-sm font-bold italic tracking-widest">SELECT SESSION</div>;
  }
  const dateStr = new Date(session.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const TRACK_PLACEHOLDER = "https://media.formula1.com/image/upload/f_auto/q_auto/v1677245035/content/dam/fom-website/2018-redesign-assets/circuit/Monaco_Circuit.png.transform/2col/image.png";

  return (
    <div className="flex items-center gap-8 bg-black/20 px-8 py-2 rounded-full border border-white/5 hover:border-white/11 transition-colors">
      

      {/* Race Name */}
      <div className="text-right">
        
        <div className="text-sm font-bold text-white leading-none">{session.name}</div>
        <span className="text-[10px] text-slate-600 font-normal align-middle">{session.circuit_type}</span>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-slate-800"></div>
      
      {/* Lap Counter */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-slate-400">
            {session.total_laps} <span className="text-[10px] text-slate-600 font-normal align-top">LAPS</span>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{session.country}
          <span className="text-[10px] text-slate-600 font-normal align-top"> {session.location}</span>
        </div>
        <span className="text-[10px] text-slate-600 font-normal align-bottom">{dateStr}</span>
        </span>
        
        {/* </span> */}
        
      </div>
    </div>
  );
}