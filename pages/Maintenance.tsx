import React from 'react';
import { Lock } from 'lucide-react';

const Maintenance: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#0a1128] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
        {/* Glowing Icon Container */}
        <div className="mb-8 relative group">
          <div className="absolute inset-0 bg-teal-400 opacity-20 blur-xl rounded-full transition-opacity duration-1000 group-hover:opacity-40 animate-pulse" />
          <div className="relative bg-[#111c38] p-6 rounded-full border border-teal-500/30 shadow-[0_0_40px_-10px_rgba(45,212,191,0.3)]">
            <Lock className="w-16 h-16 text-teal-400 stroke-[1.5]" />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight drop-shadow-sm">
          ClinicOS is in the <span className="text-teal-400">Operating Room</span>. 🛠️
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-12 leading-relaxed max-w-xl font-medium">
          We are currently deploying a massive infrastructure upgrade to handle new features. The system is temporarily locked for maintenance.
        </p>

        {/* Bottom Text */}
        <p className="text-sm text-slate-600 font-semibold tracking-wide uppercase mt-8">
          Check back later.
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
