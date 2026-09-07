import React from 'react';
import { CycloneScenarioParams, CycloneHistoricalPreset, PWPSimulationSummary } from '../physics/pwpModel';
import {
  Sliders,
  RotateCcw,
  Zap,
  Gauge,
  Navigation,
  Layers,
  Cpu,
  HelpCircle,
  TrendingDown,
} from 'lucide-react';

interface CycloneWhatIfConsoleProps {
  params: CycloneScenarioParams;
  preset: CycloneHistoricalPreset;
  summary: PWPSimulationSummary;
  physicsMode: 'FIXED_PHYSICS' | 'LEARNED_MIXING';
  isScenarioActive: boolean;
  onUpdateParam: <K extends keyof CycloneScenarioParams>(key: K, value: CycloneScenarioParams[K]) => void;
  onTogglePhysicsMode: () => void;
  onResetBaseline: () => void;
  className?: string;
}

export const CycloneWhatIfConsole: React.FC<CycloneWhatIfConsoleProps> = ({
  params,
  preset,
  summary,
  physicsMode,
  isScenarioActive,
  onUpdateParam,
  onTogglePhysicsMode,
  onResetBaseline,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#0A1119]/85 backdrop-blur-xl border border-[#1C2A33] rounded-xl shadow-2xl p-4 text-[#E8EDF0] font-mono text-xs w-full max-w-[340px] pointer-events-auto ${className}`}
    >
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-[#1C2A33] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#FF8A5B]" />
          <div>
            <h3 className="font-semibold text-xs text-[#E8EDF0] tracking-wide">
              "WHAT-IF" COUNTERFACTUAL
            </h3>
            <p className="text-[10px] text-[#6E8391]">
              Mixing Console // Dynamic Forcing
            </p>
          </div>
        </div>

        {/* Reset Button */}
        {isScenarioActive && (
          <button
            onClick={onResetBaseline}
            className="flex items-center gap-1 px-2 py-1 bg-[#1C2A33]/70 hover:bg-[#1C2A33] border border-[#6E8391]/40 rounded text-[10px] text-[#3FE0C7] transition-colors"
            title="Reset parameters to historical storm baseline"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET</span>
          </button>
        )}
      </div>

      {/* Physics Engine Toggle */}
      <div className="bg-[#050C13] border border-[#1C2A33] rounded-lg p-2.5 mb-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#6E8391] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#3FE0C7]" />
            Physics & Neural Mixing:
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              physicsMode === 'LEARNED_MIXING'
                ? 'bg-[#3FE0C7]/20 text-[#3FE0C7] border border-[#3FE0C7]/40'
                : 'bg-[#6E8391]/20 text-[#6E8391] border border-[#6E8391]/40'
            }`}
          >
            RMSE: {summary.rmseVsObserved.toFixed(2)}°C
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onUpdateParam('physicsMode', 'LEARNED_MIXING')}
            className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all text-center ${
              physicsMode === 'LEARNED_MIXING'
                ? 'bg-[#3FE0C7]/15 border-[#3FE0C7] text-[#3FE0C7] shadow-[0_0_10px_rgba(63,224,199,0.2)]'
                : 'bg-[#0D1822] border-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            Learned Mixing (AI)
            <span className="block text-[8px] font-normal text-[#6E8391] mt-0.5">
              Neural Eddy Diffusivity Kz
            </span>
          </button>

          <button
            onClick={() => onUpdateParam('physicsMode', 'FIXED_PHYSICS')}
            className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all text-center ${
              physicsMode === 'FIXED_PHYSICS'
                ? 'bg-[#FF8A5B]/15 border-[#FF8A5B] text-[#FF8A5B] shadow-[0_0_10px_rgba(255,138,91,0.2)]'
                : 'bg-[#0D1822] border-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            Fixed Physics (PWP)
            <span className="block text-[8px] font-normal text-[#6E8391] mt-0.5">
              Classical Price-Weller-Pinkel
            </span>
          </button>
        </div>
      </div>

      {/* Mixing Console Sliders */}
      <div className="space-y-3.5">
        {/* Slider 1: Forward Translation Speed */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#6E8391] flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#3FE0C7]" />
              Translation Speed (Vh):
            </span>
            <span className="font-bold text-[#E8EDF0]">
              {params.speedKmh.toFixed(1)} km/h
              <span className="text-[10px] text-[#6E8391] ml-1">
                ({preset.baseSpeedKmh} base)
              </span>
            </span>
          </div>
          <input
            type="range"
            min="6"
            max="34"
            step="0.5"
            value={params.speedKmh}
            onChange={(e) => onUpdateParam('speedKmh', parseFloat(e.target.value))}
            className="w-full accent-[#3FE0C7] h-1.5 bg-[#1C2A33] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#6E8391]">
            <span>6 km/h (Prolonged Dwelling)</span>
            <span>34 km/h (Rapid Transit)</span>
          </div>
        </div>

        {/* Slider 2: Maximum Sustained Wind */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#6E8391] flex items-center gap-1">
              <Gauge className="w-3 h-3 text-[#FF8A5B]" />
              Max Wind Speed (Vmax):
            </span>
            <span className="font-bold text-[#FF8A5B]">
              {params.windKts} kts
              <span className="text-[10px] text-[#6E8391] ml-1">
                ({preset.baseWindKts} base)
              </span>
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="165"
            step="5"
            value={params.windKts}
            onChange={(e) => {
              const w = parseInt(e.target.value);
              onUpdateParam('windKts', w);
              // Scale pressure deficit proportionally
              const scaledDeficit = Math.round(w * 0.62);
              onUpdateParam('pressureDeficitHpa', scaledDeficit);
            }}
            className="w-full accent-[#FF8A5B] h-1.5 bg-[#1C2A33] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#6E8391]">
            <span>60 kts (Cat 1)</span>
            <span>165 kts (Super Cyclone)</span>
          </div>
        </div>

        {/* Slider 3: Track Offset Distance */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#6E8391] flex items-center gap-1">
              <Navigation className="w-3 h-3 text-[#3FE0C7]" />
              Track Offset (dcpa):
            </span>
            <span className="font-bold text-[#E8EDF0]">
              {params.trackDistanceKm} km
              <span className="text-[10px] text-[#6E8391] ml-1">
                ({preset.baseTrackDistanceKm} base)
              </span>
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="160"
            step="5"
            value={params.trackDistanceKm}
            onChange={(e) => onUpdateParam('trackDistanceKm', parseInt(e.target.value))}
            className="w-full accent-[#3FE0C7] h-1.5 bg-[#1C2A33] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#6E8391]">
            <span>0 km (Direct Eyewall Hit)</span>
            <span>160 km (Outer Feeder Band)</span>
          </div>
        </div>

        {/* Slider 4: Initial Mixed Layer Depth (h0) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#6E8391] flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#FF8A5B]" />
              Initial Mixed Layer (h0):
            </span>
            <span className="font-bold text-[#E8EDF0]">
              {Math.round(params.initialMldM || summary.baselineMld)} m
              <span className="text-[10px] text-[#6E8391] ml-1">
                ({summary.baselineMld}m base)
              </span>
            </span>
          </div>
          <input
            type="range"
            min="15"
            max="85"
            step="2"
            value={params.initialMldM || summary.baselineMld}
            onChange={(e) => onUpdateParam('initialMldM', parseInt(e.target.value))}
            className="w-full accent-[#FF8A5B] h-1.5 bg-[#1C2A33] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#6E8391]">
            <span>15m (Thin / Vulnerable)</span>
            <span>85m (Thick Barrier Layer)</span>
          </div>
        </div>
      </div>

      {/* Counterfactual Impact Outcome Banner */}
      <div className="mt-3.5 pt-2.5 border-t border-[#1C2A33] bg-[#050C13] rounded-lg p-2 flex items-center justify-between text-[11px]">
        <span className="text-[#6E8391]">Predicted Wake Drop:</span>
        <span
          className={`font-bold ${
            summary.deltaSst < -2.5 ? 'text-[#3FE0C7]' : 'text-[#FF8A5B]'
          }`}
        >
          {summary.deltaSst.toFixed(1)}°C (Down to {summary.simulatedSst.toFixed(1)}°C)
        </span>
      </div>
    </div>
  );
};
