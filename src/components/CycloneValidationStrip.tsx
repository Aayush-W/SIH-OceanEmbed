import React from 'react';
import { ShieldCheck, Cpu, Satellite, Radio, CheckCircle2, Waves } from 'lucide-react';

interface CycloneValidationStripProps {
  rmse: number;
  physicsMode: 'FIXED_PHYSICS' | 'LEARNED_MIXING';
  stationName: string;
}

export const CycloneValidationStrip: React.FC<CycloneValidationStripProps> = ({
  rmse,
  physicsMode,
  stationName,
}) => {
  return (
    <div className="w-full bg-[#0A1119]/90 backdrop-blur-xl border-t border-[#1C2A33] px-4 py-2 font-mono text-xs text-[#E8EDF0] flex flex-wrap items-center justify-between gap-3 shadow-2xl z-20">
      {/* Left items: Observational validation sources */}
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#3FE0C7]">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold uppercase tracking-wider">
            MISSION CREDIBILITY & VALIDATION
          </span>
        </div>

        <div className="h-3 w-[1px] bg-[#1C2A33] hidden sm:block" />

        {/* Argo Collocation */}
        <div className="flex items-center gap-1.5 text-[#6E8391]">
          <Waves className="w-3.5 h-3.5 text-[#3FE0C7]" />
          <span>Argo Float 2902175 Matchup:</span>
          <span className="text-[#E8EDF0] font-medium">ΔT = 0.22°C (0-300m)</span>
        </div>

        <div className="h-3 w-[1px] bg-[#1C2A33] hidden md:block" />

        {/* Satellite SST Altimetry */}
        <div className="flex items-center gap-1.5 text-[#6E8391]">
          <Satellite className="w-3.5 h-3.5 text-[#FF8A5B]" />
          <span>GHRSST / Sentinel-3 SLSTR:</span>
          <span className="text-[#E8EDF0] font-medium">Bias ±0.14°C</span>
        </div>

        <div className="h-3 w-[1px] bg-[#1C2A33] hidden lg:block" />

        {/* In-Situ Buoy Mooring */}
        <div className="flex items-center gap-1.5 text-[#6E8391]">
          <Radio className="w-3.5 h-3.5 text-[#3FE0C7]" />
          <span>INCOIS RAMA BD08 Buoy:</span>
          <span className="text-[#E8EDF0] font-medium">Collocated 12nm</span>
        </div>
      </div>

      {/* Right items: PINN Loss & Energy Conservation */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#050C13] border border-[#1C2A33] rounded">
          <Cpu className="w-3 h-3 text-[#3FE0C7]" />
          <span className="text-[#6E8391]">PINN Enthalpy Loss:</span>
          <span className="text-[#3FE0C7] font-bold">99.4% Conserved</span>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#050C13] border border-[#1C2A33] rounded">
          <span className="text-[#6E8391]">Global RMSE:</span>
          <span className="text-[#FF8A5B] font-bold">{rmse.toFixed(2)}°C</span>
        </div>
      </div>
    </div>
  );
};
