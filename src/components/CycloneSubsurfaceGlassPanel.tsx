import React, { useMemo } from 'react';
import { PWPTimestepData, PWPSimulationSummary } from '../physics/pwpModel';
import { StationData } from '../types';
import {
  Waves,
  Thermometer,
  Layers,
  Flame,
  ShieldCheck,
  Cpu,
  TrendingDown,
  Info,
  Activity,
  ArrowDown,
} from 'lucide-react';

interface CycloneSubsurfaceGlassPanelProps {
  currentTimestep: PWPTimestepData;
  summary: PWPSimulationSummary;
  stationData: StationData;
  selectedHour: number;
  physicsMode: 'FIXED_PHYSICS' | 'LEARNED_MIXING';
  onTogglePhysicsMode: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export const CycloneSubsurfaceGlassPanel: React.FC<CycloneSubsurfaceGlassPanelProps> = ({
  currentTimestep,
  summary,
  stationData,
  selectedHour,
  physicsMode,
  onTogglePhysicsMode,
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}) => {
  const profile = currentTimestep.profile;
  const baselineProfile = summary.baselineProfile;

  // Chart dimensions
  const svgWidth = 280;
  const svgHeight = 260;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const innerW = svgWidth - padLeft - padRight;
  const innerH = svgHeight - padTop - padBottom;

  // Depth range: 0 to 250m
  const maxDepth = 250;
  // Temp range: 12°C to 32°C
  const minTemp = 12;
  const maxTemp = 32;

  const toX = (temp: number) => {
    const clamped = Math.max(minTemp, Math.min(maxTemp, temp));
    return padLeft + ((clamped - minTemp) / (maxTemp - minTemp)) * innerW;
  };

  const toY = (depth: number) => {
    const clamped = Math.max(0, Math.min(maxDepth, depth));
    return padTop + (clamped / maxDepth) * innerH;
  };

  // Generate SVG path strings
  const currentPathD = useMemo(() => {
    if (!profile || profile.length === 0) return '';
    return profile
      .filter((p) => p.depth <= maxDepth)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.temp).toFixed(1)} ${toY(p.depth).toFixed(1)}`)
      .join(' ');
  }, [profile]);

  const baselinePathD = useMemo(() => {
    if (!baselineProfile || baselineProfile.length === 0) return '';
    return baselineProfile
      .filter((p) => p.depth <= maxDepth)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.temp).toFixed(1)} ${toY(p.depth).toFixed(1)}`)
      .join(' ');
  }, [baselineProfile]);

  // Uncertainty ribbon polygon [T + sigma from top to bottom, then T - sigma from bottom to top]
  const uncertaintyAreaD = useMemo(() => {
    if (!profile || profile.length === 0) return '';
    const sigma = currentTimestep.uncertaintyC;
    const filtered = profile.filter((p) => p.depth <= maxDepth);

    const rightPoints = filtered.map((p) => ({
      x: toX(p.temp + sigma),
      y: toY(p.depth),
    }));

    const leftPoints = [...filtered].reverse().map((p) => ({
      x: toX(Math.max(minTemp, p.temp - sigma)),
      y: toY(p.depth),
    }));

    const all = [...rightPoints, ...leftPoints];
    return all.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ') + ' Z';
  }, [profile, currentTimestep.uncertaintyC]);

  const x26 = toX(26);
  const mldY = toY(currentTimestep.mld);
  const baseMldY = toY(summary.baselineMld);

  return (
    <div className="flex flex-col bg-[#0A1119]/85 backdrop-blur-xl border border-[#1C2A33] rounded-xl shadow-2xl p-4 text-[#E8EDF0] font-mono text-xs w-full max-w-[340px] pointer-events-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1C2A33] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#3FE0C7]" />
          <div>
            <h3 className="font-semibold text-xs text-[#E8EDF0] tracking-wide">
              SUBSURFACE CROSS-SECTION
            </h3>
            <p className="text-[10px] text-[#6E8391]">
              Station: {stationData.station.name}
            </p>
          </div>
        </div>

        {/* Physics Engine Toggle & Close Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePhysicsMode}
            title="Toggle between Classical Fixed Physics and Learned AI Mixing (PINN)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] transition-all ${
              physicsMode === 'LEARNED_MIXING'
                ? 'bg-[#3FE0C7] text-[#0A1119] border-[#3FE0C7] font-bold shadow-[0_0_10px_rgba(63,224,199,0.3)]'
                : 'bg-[#1C2A33]/60 border-[#6E8391]/40 text-[#6E8391]'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>
              {physicsMode === 'LEARNED_MIXING' ? 'AI PINN' : 'FIXED PWP'}
            </span>
          </button>

          {(onClose || onToggleCollapse) && (
            <button
              onClick={onClose || onToggleCollapse}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#1C2A33]/50 hover:bg-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0] border border-[#1C2A33] transition-colors"
              title="Close subsurface profile"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Key Real-Time Telemetry Badges */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Current SST */}
        <div className="bg-[#0D1822]/90 border border-[#1C2A33] rounded-lg p-2 flex flex-col">
          <span className="text-[10px] text-[#6E8391] flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-[#FF8A5B]" />
            SST
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#E8EDF0]">
              {currentTimestep.sst.toFixed(1)}°
            </span>
            <span className="text-[10px] text-[#6E8391]">C</span>
          </div>
          <span
            className={`text-[9px] mt-0.5 font-medium ${
              currentTimestep.sst - summary.baselineSst < -0.2
                ? 'text-[#3FE0C7]'
                : 'text-[#6E8391]'
            }`}
          >
            {(currentTimestep.sst - summary.baselineSst).toFixed(1)}°C wake
          </span>
        </div>

        {/* Mixed Layer Depth */}
        <div className="bg-[#0D1822]/90 border border-[#1C2A33] rounded-lg p-2 flex flex-col">
          <span className="text-[10px] text-[#6E8391] flex items-center gap-1">
            <Waves className="w-3 h-3 text-[#3FE0C7]" />
            MLD
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#3FE0C7]">
              {Math.round(currentTimestep.mld)}
            </span>
            <span className="text-[10px] text-[#6E8391]">m</span>
          </div>
          <span className="text-[9px] text-[#6E8391] mt-0.5">
            +{Math.round(currentTimestep.mld - summary.baselineMld)}m entrained
          </span>
        </div>

        {/* Ocean Heat Content TCHP */}
        <div className="bg-[#0D1822]/90 border border-[#1C2A33] rounded-lg p-2 flex flex-col">
          <span className="text-[10px] text-[#6E8391] flex items-center gap-1">
            <Flame className="w-3 h-3 text-[#FF8A5B]" />
            TCHP
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#FF8A5B]">
              {currentTimestep.tchpKjCm2.toFixed(0)}
            </span>
            <span className="text-[10px] text-[#6E8391]">kJ</span>
          </div>
          <span className="text-[9px] text-[#6E8391] mt-0.5">
            {currentTimestep.tchpKjCm2 >= 50 ? 'Cyclone-fueling' : 'Depleted'}
          </span>
        </div>
      </div>

      {/* SVG Depth Profile with Dynamic Uncertainty Interval */}
      <div className="relative bg-[#050C13] border border-[#1C2A33] rounded-lg p-1.5 overflow-hidden">
        {/* Top legend */}
        <div className="flex items-center justify-between text-[9px] text-[#6E8391] px-2 py-1 border-b border-[#1C2A33]/40 mb-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[#3FE0C7]" />
              <span className="text-[#E8EDF0]">Simulated</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-b border-dashed border-[#6E8391]" />
              <span>Pre-storm</span>
            </span>
          </div>
          <span className="text-[#3FE0C7] font-mono">
            Uncertainty: ±{currentTimestep.uncertaintyC.toFixed(2)}°C
          </span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
          <defs>
            {/* Uncertainty ribbon gradient */}
            <linearGradient id="uncertaintyGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3FE0C7" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#3FE0C7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3FE0C7" stopOpacity="0.12" />
            </linearGradient>

            {/* Isotherm 26C gradient */}
            <linearGradient id="iso26Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8A5B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FF8A5B" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Depth grid lines */}
          {[50, 100, 150, 200].map((d) => {
            const y = toY(d);
            return (
              <g key={d}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#1C2A33"
                  strokeDasharray="2 3"
                  strokeWidth="0.8"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="8"
                  fill="#6E8391"
                  fontFamily="monospace"
                >
                  {d}m
                </text>
              </g>
            );
          })}

          {/* Temperature grid ticks (15°C, 20°C, 26°C, 30°C) */}
          {[15, 20, 25, 30].map((t) => {
            const x = toX(t);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={svgHeight - padBottom}
                  stroke="#1C2A33"
                  strokeDasharray="2 3"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={svgHeight - padBottom + 12}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#6E8391"
                  fontFamily="monospace"
                >
                  {t}°
                </text>
              </g>
            );
          })}

          {/* Critical 26°C Cyclogenesis Threshold vertical line */}
          <line
            x1={x26}
            y1={padTop}
            x2={x26}
            y2={svgHeight - padBottom}
            stroke="#FF8A5B"
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />
          <text
            x={x26 + 4}
            y={padTop + 10}
            fontSize="8"
            fill="#FF8A5B"
            fontFamily="monospace"
            fontWeight="bold"
          >
            26°C D26
          </text>

          {/* Baseline Pre-Storm Profile */}
          <path
            d={baselinePathD}
            fill="none"
            stroke="#6E8391"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.75"
          />

          {/* Shaded Translucent Dynamic Uncertainty Band */}
          <path d={uncertaintyAreaD} fill="url(#uncertaintyGrad)" />

          {/* Active Timestep Simulated Profile */}
          <path
            d={currentPathD}
            fill="none"
            stroke="#3FE0C7"
            strokeWidth="2.2"
            strokeLinecap="round"
            filter="drop-shadow(0 0 4px rgba(63,224,199,0.5))"
          />

          {/* Baseline MLD indicator */}
          <line
            x1={padLeft}
            y1={baseMldY}
            x2={svgWidth - padRight}
            y2={baseMldY}
            stroke="#6E8391"
            strokeWidth="0.9"
            strokeDasharray="2 2"
          />

          {/* Current Dynamic MLD indicator line with active tag */}
          <g>
            <line
              x1={padLeft}
              y1={mldY}
              x2={svgWidth - padRight}
              y2={mldY}
              stroke="#3FE0C7"
              strokeWidth="1.8"
            />
            {/* Tag badge */}
            <rect
              x={svgWidth - padRight - 54}
              y={mldY - 8}
              width="54"
              height="15"
              rx="3"
              fill="#0A1119"
              stroke="#3FE0C7"
              strokeWidth="1"
            />
            <text
              x={svgWidth - padRight - 27}
              y={mldY + 3}
              textAnchor="middle"
              fontSize="8"
              fill="#3FE0C7"
              fontFamily="monospace"
              fontWeight="bold"
            >
              MLD {Math.round(currentTimestep.mld)}m
            </text>
          </g>
        </svg>
      </div>

      {/* Mechanics Description / Stratification Status */}
      <div className="mt-2.5 pt-2 border-t border-[#1C2A33] text-[10px] text-[#6E8391] space-y-1">
        <div className="flex justify-between">
          <span>Bulk Richardson Number:</span>
          <span className="text-[#E8EDF0] font-semibold">
            Ri_b = {currentTimestep.bulkRichardson}
            <span className="text-[#3FE0C7] ml-1">
              {currentTimestep.bulkRichardson < 0.65 ? '(Entrainment Active)' : '(Stable Stratification)'}
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span>Ekman Upwelling Suction:</span>
          <span className="text-[#3FE0C7] font-semibold">
            +{currentTimestep.upwellingDisplacementM}m
          </span>
        </div>
        <div className="flex justify-between">
          <span>Thermocline Depth:</span>
          <span className="text-[#E8EDF0] font-semibold">
            {currentTimestep.thermoclineDepthM}m
          </span>
        </div>
      </div>
    </div>
  );
};
