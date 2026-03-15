export default function MiniGauge({ value, max, color, label }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / max) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg className="transform -rotate-90 w-12 h-12">
        <circle cx="24" cy="24" r={radius} stroke="#334155" strokeWidth="4" fill="transparent" />
        <circle 
            cx="24" cy="24" r={radius} stroke={color} strokeWidth="4" fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round"
            className="transition-all duration-75 ease-linear"
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
          {value}
      </div>
      <div className="text-[8px] text-slate-500 font-bold -mt-1">{label}</div>
    </div>
  );
}