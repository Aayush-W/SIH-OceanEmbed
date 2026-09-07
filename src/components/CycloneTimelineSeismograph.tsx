import React, { useRef, useMemo, useState } from 'react';
import { PWPTimestepData } from '../physics/pwpModel';
import {
  Play,
  Pause,
  Clock,
  Gauge,
  Wind,
  Activity,
} from 'lucide-react';

interface CycloneTimelineSeismographProps {
  timesteps: PWPTimestepData[];
  selectedHour: number;
  onSelectHour: (hour: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  className?: string;
}

interface PhaseInterval {
  startHour: number;
  endHour: number;
  label: string;
  shortLabel: string;
  color: string;
  bgFill: string;
}

const PHASES: PhaseInterval[] = [
  {
    startHour: -72,
    endHour: -24,
    label: 'Pre-Storm Stratification / Genesis',
    shortLabel: 'T-72h GENESIS',
    color: '#3FE0C7',
    bgFill: 'rgba(63, 224, 199, 0.08)',
  },
  {
    startHour: -24,
    endHour: -6,
    label: 'Rapid Intensification Phase',
    shortLabel: 'T-24h INTENSIFY',
    color: '#FF8A5B',
    bgFill: 'rgba(255, 138, 91, 0.12)',
  },
  {
    startHour: -6,
    endHour: 12,
    label: 'Eyewall Passage & Peak Shear Entrainment',
    shortLabel: 'T0 EYEWALL / PEAK',
    color: '#FF5252',
    bgFill: 'rgba(255, 82, 82, 0.18)',
  },
  {
    startHour: 12,
    endHour: 48,
    label: 'Cold Wake & Upwelling Swath Emergence',
    shortLabel: 'T+24h COLD WAKE',
    color: '#3FE0C7',
    bgFill: 'rgba(63, 224, 199, 0.10)',
  },
  {
    startHour: 48,
    endHour: 120,
    label: 'Post-Storm Solar Re-stratification',
    shortLabel: 'T+72h RECOVERY',
    color: '#6E8391',
    bgFill: 'rgba(110, 131, 145, 0.06)',
  },
];

export const CycloneTimelineSeismograph: React.FC<CycloneTimelineSeismographProps> = ({
  timesteps,
  selectedHour,
  onSelectHour,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSetPlaybackSpeed,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const minHour = -72;
  const maxHour = 120;
  const totalSpan = maxHour - minHour; // 192 hours

  // Current active timestep data
  const currentStep = useMemo(() => {
    return (
      timesteps.find((t) => t.hour === selectedHour) ||
      timesteps[0] || {
        hour: selectedHour,
        windStressPa: 0,
        windSpeedKts: 0,
        mld: 30,
        sst: 29.5,
      }
    );
  }, [timesteps, selectedHour]);

  // Generate SVG seismograph waveform curve from wind stress tau
  const maxStress = useMemo(() => {
    return Math.max(1.0, ...timesteps.map((t) => t.windStressPa));
  }, [timesteps]);

  const svgWaveformD = useMemo(() => {
    if (!timesteps || timesteps.length === 0) return '';
    const w = 1000;
    const h = 42;

    const points = timesteps.map((t) => {
      const x = ((t.hour - minHour) / totalSpan) * w;
      const norm = t.windStressPa / maxStress;
      const y = h - norm * (h - 4);
      return { x, y };
    });

    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }, [timesteps, maxStress]);

  const svgAreaD = useMemo(() => {
    if (!svgWaveformD) return '';
    return `${svgWaveformD} L 1000 42 L 0 42 Z`;
  }, [svgWaveformD]);

  // Handle Scrubbing Click / Drag
  const handlePointerScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const fraction = clickX / rect.width;
    const computedHour = Math.round(minHour + fraction * totalSpan);
    onSelectHour(computedHour);
  };

  const currentPercent = ((selectedHour - minHour) / totalSpan) * 100;

  const currentPhase =
    PHASES.find((p) => selectedHour >= p.startHour && selectedHour <= p.endHour) || PHASES[0];

  return (
    <div
      className={`bg-[#0A1119]/90 backdrop-blur-xl border border-[#1C2A33] rounded-2xl shadow-2xl p-3 sm:p-4 text-[#E8EDF0] font-mono select-none ${className}`}
    >
      {/* Top Controls & Hero Time Readout Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1C2A33] pb-2.5 mb-2.5">
        {/* Playback Controls Cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3FE0C7]/15 border border-[#3FE0C7]/50 hover:bg-[#3FE0C7]/25 text-[#3FE0C7] transition-colors"
            title={isPlaying ? 'Pause simulation' : 'Play timeline animation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => onSelectHour(0)}
            className="px-2.5 py-1.5 rounded-lg bg-[#1C2A33]/60 border border-[#1C2A33] hover:border-[#3FE0C7] text-xs text-[#E8EDF0] transition-colors whitespace-nowrap"
            title="Jump to T0 Eye Landfall"
          >
            T0 LANDFALL
          </button>

          {/* Speed Multipliers (Cyan active state) */}
          <div className="flex items-center bg-[#0D1822] border border-[#1C2A33] rounded-lg p-0.5 text-[10px]">
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => onSetPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-[#3FE0C7] text-[#0A1119] font-bold'
                    : 'text-[#6E8391] hover:text-[#E8EDF0]'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Hero Timestep Indicator & Phase Badge */}
        <div className="flex items-center gap-3">
          {/* Phase Badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap shrink-0"
            style={{
              borderColor: `${currentPhase.color}55`,
              backgroundColor: currentPhase.bgFill,
              color: currentPhase.color,
            }}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="font-semibold">{currentPhase.shortLabel}</span>
          </div>

          {/* Hero Simulation Time Readout */}
          <div className="flex items-baseline gap-2 px-3 py-1 bg-[#050C13] border border-[#1C2A33] rounded-lg">
            <Clock className="w-4 h-4 text-[#3FE0C7] self-center" />
            <span className="text-base sm:text-lg font-black text-[#3FE0C7] tracking-tight whitespace-nowrap">
              {selectedHour === 0
                ? 'T0 (LANDFALL)'
                : selectedHour > 0
                ? `T+${selectedHour}h`
                : `T${selectedHour}h`}
            </span>
            <span className="text-[10px] text-[#6E8391] hidden sm:inline whitespace-nowrap">
              ({selectedHour + 72}h / 192h)
            </span>
          </div>
        </div>
      </div>

      {/* Seismograph Waveform & Scrubber Track Area */}
      <div
        ref={containerRef}
        onPointerDown={(e) => {
          setIsDragging(true);
          handlePointerScrub(e);
        }}
        onPointerMove={(e) => {
          if (isDragging) handlePointerScrub(e);
        }}
        onPointerUp={() => setIsDragging(false)}
        className="relative w-full cursor-ew-resize pt-1 pb-4 group"
      >
        {/* Seismograph Wind Stress Waveform Box */}
        <div className="relative h-11 w-full bg-[#050C13] border border-[#1C2A33] rounded-lg overflow-hidden">
          {/* Phase Background Segments */}
          <div className="absolute inset-0 flex">
            {PHASES.map((p) => {
              const span = p.endHour - p.startHour;
              const widthPct = (span / totalSpan) * 100;
              return (
                <div
                  key={p.label}
                  style={{ width: `${widthPct}%`, backgroundColor: p.bgFill }}
                  className="h-full border-r border-[#1C2A33]/40 relative"
                />
              );
            })}
          </div>

          {/* Seismograph SVG */}
          <svg
            viewBox="0 0 1000 42"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <linearGradient id="seismoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3FE0C7" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3FE0C7" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Filled Area under Waveform */}
            <path d={svgAreaD} fill="url(#seismoGrad)" />

            {/* Waveform Stroke */}
            <path
              d={svgWaveformD}
              fill="none"
              stroke="#3FE0C7"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Center Eyewall T0 Line */}
          <div
            style={{ left: `${((0 - minHour) / totalSpan) * 100}%` }}
            className="absolute top-0 bottom-0 w-[1px] bg-[#FF5252] shadow-[0_0_8px_#FF5252] z-10"
          >
            <span className="absolute -top-0.5 -translate-x-1/2 px-1 text-[8px] font-bold bg-[#FF5252] text-[#0A1119] rounded-b">
              T0
            </span>
          </div>

          {/* Draggable Scrubber Needle */}
          <div
            style={{ left: `${currentPercent}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-[#3FE0C7] shadow-[0_0_12px_#3FE0C7] z-20 pointer-events-none transition-all duration-75 ease-out"
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#3FE0C7] shadow-[0_0_8px_#3FE0C7] border-2 border-[#0A1119]" />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#3FE0C7] shadow-[0_0_8px_#3FE0C7] border-2 border-[#0A1119]" />
          </div>
        </div>

        {/* Milestone Landmark Ticks */}
        <div className="relative w-full mt-2 h-4 text-[10px] text-[#6E8391] font-mono">
          {[
            { hour: -72, label: 'T-72h', note: 'Genesis' },
            { hour: -24, label: 'T-24h', note: 'Intensify' },
            { hour: 0, label: 'T0', note: 'Landfall' },
            { hour: 24, label: 'T+24h', note: 'Cold Wake' },
            { hour: 72, label: 'T+72h', note: 'Recovery' },
            { hour: 120, label: 'T+120h', note: 'Baseline' },
          ].map((tick) => {
            const pct = ((tick.hour - minHour) / totalSpan) * 100;
            const isT0 = tick.hour === 0;
            return (
              <div
                key={tick.hour}
                style={{ left: `${pct}%` }}
                className={`absolute -translate-x-1/2 flex flex-col items-center cursor-pointer hover:text-[#3FE0C7] whitespace-nowrap ${
                  isT0 ? 'text-[#3FE0C7] font-bold' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectHour(tick.hour);
                }}
              >
                <div
                  className={`w-[1px] h-1.5 ${
                    isT0 ? 'bg-[#3FE0C7]' : 'bg-[#1C2A33]'
                  }`}
                />
                <span className="mt-0.5 text-[10px]">{tick.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-bar Instantaneous Telemetry (Wind speed cyan/white, Wind stress tau, no truncation) */}
      <div className="mt-2 pt-2 border-t border-[#1C2A33] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6E8391]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Wind className="w-3.5 h-3.5 text-[#3FE0C7]" />
            <span>Local Wind:</span>
            <span className="text-[#E8EDF0] font-semibold">
              {currentStep.windSpeedKts} kts ({Math.round(currentStep.windSpeedKts * 1.852)} km/h)
            </span>
          </span>

          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Gauge className="w-3.5 h-3.5 text-[#3FE0C7]" />
            <span>Wind Stress:</span>
            <span className="text-[#3FE0C7] font-semibold">
              {currentStep.windStressPa.toFixed(2)} Pa
            </span>
          </span>
        </div>

        <div className="text-[10px] text-[#6E8391] hidden sm:flex items-center gap-1.5">
          <span>Waveform: Surface Friction Velocity Shear</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3FE0C7]" />
        </div>
      </div>
    </div>
  );
};
