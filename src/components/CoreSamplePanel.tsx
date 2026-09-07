import React, { useState, useMemo } from 'react';
import { X, Download, MapPin, CheckSquare, Square, Layers, Activity, HelpCircle, Wind } from 'lucide-react';
import { StationData } from '../types';

interface CoreSamplePanelProps {
  stationData: StationData | null;
  onClose: () => void;
  onOpenCycloneSimulator?: (stationId: string) => void;
}

export const CoreSamplePanel: React.FC<CoreSamplePanelProps> = ({ stationData, onClose, onOpenCycloneSimulator }) => {
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);

  // Compute SVG chart coordinates
  const chartData = useMemo(() => {
    if (!stationData) return null;

    const width = 340;
    const height = 280;
    const padding = { top: 20, right: 25, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minTemp = 0;
    const maxTemp = 30;
    const minDepth = 0;
    const maxDepth = 1000;

    const tempToX = (t: number) => padding.left + ((t - minTemp) / (maxTemp - minTemp)) * chartW;
    const depthToY = (d: number) => padding.top + ((d - minDepth) / (maxDepth - minDepth)) * chartH;
    const yToDepth = (y: number) => minDepth + ((y - padding.top) / chartH) * (maxDepth - minDepth);

    // Build thermocline path
    const points = stationData.profile;
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp).toFixed(1)},${depthToY(p.depth).toFixed(1)}`)
      .join(' ');

    // Build uncertainty area polygon (upper curve forward, lower curve backwards)
    const upperPoints = points.map((p) => `${tempToX(p.tempMax).toFixed(1)},${depthToY(p.depth).toFixed(1)}`);
    const lowerPoints = [...points].reverse().map((p) => `${tempToX(p.tempMin).toFixed(1)},${depthToY(p.depth).toFixed(1)}`);
    const areaPath = `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;

    // Mixed Layer Depth line
    const mldY = depthToY(stationData.mixedLayerDepth);

    return {
      width,
      height,
      padding,
      chartW,
      chartH,
      tempToX,
      depthToY,
      yToDepth,
      linePath,
      areaPath,
      mldY,
      points,
    };
  }, [stationData]);

  if (!stationData || !chartData) return null;

  // Handle Export CSV
  const handleExportData = () => {
    const header = 'Depth_m,Predicted_Temp_C,Uncertainty_Min_C,Uncertainty_Max_C,Salinity_PSU,Density_kg_m3\n';
    const rows = stationData.profile
      .map(
        (p) =>
          `${p.depth},${p.temp.toFixed(2)},${p.tempMin.toFixed(2)},${p.tempMax.toFixed(2)},${p.salinity.toFixed(1)},${p.density.toFixed(1)}`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OceanEmbed_${stationData.station.code}_${stationData.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Find hovered point on chart
  const activeHoverPoint = hoverDepth !== null
    ? stationData.profile.reduce((prev, curr) =>
        Math.abs(curr.depth - hoverDepth) < Math.abs(prev.depth - hoverDepth) ? curr : prev
      )
    : null;

  return (
    <aside
      id="core-sample-panel"
      className="fixed right-0 top-16 bottom-12 w-full sm:w-[440px] bg-[#0A1119] border-l border-[#1C2A33] z-40 flex flex-col p-6 overflow-y-auto transition-transform duration-300 ease-out shadow-2xl backdrop-blur-md"
      style={{
        transform: 'translateX(0%)',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Corner HUD framing */}
      <div className="corner-bracket corner-tl"></div>
      <div className="corner-bracket corner-tr"></div>
      <div className="corner-bracket corner-bl"></div>
      <div className="corner-bracket corner-br"></div>

      {/* Top Header */}
      <div className="flex justify-between items-start pb-4 border-b border-[#1C2A33] mb-5">
        <div>
          <div className="font-data text-[10px] text-[#ffb4ab] tracking-[0.2em] uppercase mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#FF8A5B]"></span>
            RECONSTRUCTED PROFILE
          </div>
          <h2 className="font-space text-xl font-bold uppercase text-[#E8EDF0] tracking-tight">
            {stationData.station.name}
          </h2>
          <div className="font-data text-xs text-[#6E8391] flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5 text-[#3FE0C7]" />
            <span>
              {stationData.station.lat.toFixed(2)}°N, {stationData.station.lon.toFixed(2)}°E
            </span>
            <span className="text-[#1C2A33]">•</span>
            <span className="text-[#3FE0C7]">{stationData.station.code}</span>
          </div>
        </div>

        <button
          id="close-core-panel-btn"
          onClick={onClose}
          className="p-1.5 text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#1C2A33] border border-transparent hover:border-[#1C2A33] transition-colors"
          title="Close profile panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Validation Status Block */}
      <div className="bg-[#05080D] border border-[#1C2A33] p-3.5 mb-5">
        <div className="font-data text-[10px] text-[#6E8391] uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>VALIDATION STATUS</span>
          <span className="text-[#3FE0C7]">ACTIVE SYNCHRONIZATION</span>
        </div>
        <div className="space-y-1.5 font-data text-xs">
          {stationData.station.satelliteSources.map((src, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[#E8EDF0]">
              <CheckSquare className="w-3.5 h-3.5 text-[#3FE0C7]" />
              <span>{src}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[#6E8391]">
            <CheckSquare className="w-3.5 h-3.5 text-[#FF8A5B]" />
            <span>In-situ: {stationData.station.argoFloatId} (Validated)</span>
          </div>
        </div>
      </div>

      {/* 3 Metric Stat Readouts */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {/* Surface Temp */}
        <div className="bg-[#05080D] border border-[#1C2A33] p-3 relative flex flex-col justify-between">
          <div className="font-space text-[10px] font-semibold text-[#6E8391] uppercase tracking-wider">
            SURFACE TEMP
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="font-data text-lg font-bold text-[#E8EDF0]">
              {stationData.surfaceTemp.toFixed(1)}
            </span>
            <span className="font-data text-xs text-[#6E8391]">°C</span>
          </div>
          <div className="w-full h-1 bg-[#1C2A33]">
            <div
              className="h-full bg-[#3FE0C7]"
              style={{ width: `${Math.min(100, (stationData.surfaceTemp / 32) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Mixed Layer Depth */}
        <div className="bg-[#05080D] border border-[#1C2A33] p-3 relative flex flex-col justify-between">
          <div className="font-space text-[10px] font-semibold text-[#6E8391] uppercase tracking-wider">
            MIXED LAYER
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="font-data text-lg font-bold text-[#E8EDF0]">
              {stationData.mixedLayerDepth}
            </span>
            <span className="font-data text-xs text-[#6E8391]">m</span>
          </div>
          <div className="font-data text-[9px] text-[#FF8A5B] flex items-center gap-0.5">
            <span>↓ {stationData.mixedLayerRate}m/hr</span>
          </div>
        </div>

        {/* Uncertainty */}
        <div className="bg-[#05080D] border border-[#1C2A33] p-3 relative flex flex-col justify-between">
          <div className="font-space text-[10px] font-semibold text-[#6E8391] uppercase tracking-wider">
            UNCERTAINTY
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="font-data text-lg font-bold text-[#E8EDF0]">
              ±{stationData.uncertaintySigma.toFixed(2)}
            </span>
            <span className="font-data text-xs text-[#6E8391]">°C</span>
          </div>
          <div className="font-data text-[9px] text-[#3FE0C7]">NOMINAL (1σ)</div>
        </div>
      </div>

      {/* Depth Profile Analysis Chart */}
      <div className="bg-[#05080D] border border-[#1C2A33] p-4 relative mb-4">
        {/* HUD Brackets */}
        <div className="corner-bracket corner-tl"></div>
        <div className="corner-bracket corner-tr"></div>
        <div className="corner-bracket corner-bl"></div>
        <div className="corner-bracket corner-br"></div>

        {/* Chart Title & Legend */}
        <div className="flex justify-between items-center pb-2 mb-2 border-b border-[#1C2A33]">
          <span className="font-space text-xs font-bold text-[#E8EDF0] uppercase tracking-wider">
            TEMPERATURE VS DEPTH
          </span>
          <div className="flex items-center gap-3 font-data text-[10px] text-[#6E8391]">
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#3FE0C7]"></span>
              <span>THERMOCLINE</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-none bg-[#FF8A5B]"></span>
              <span>ARGO IN-SITU</span>
            </div>
          </div>
        </div>

        {/* SVG Profile Chart */}
        <div
          className="relative w-full h-[280px] cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const depth = Math.max(0, Math.min(1000, chartData.yToDepth(y)));
            setHoverDepth(depth);
          }}
          onMouseLeave={() => setHoverDepth(null)}
        >
          <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="w-full h-full">
            {/* Grid Horizontal Depth lines */}
            {[0, 200, 400, 600, 800, 1000].map((d) => {
              const y = chartData.depthToY(d);
              return (
                <g key={d}>
                  <line
                    x1={chartData.padding.left}
                    y1={y}
                    x2={chartData.width - chartData.padding.right}
                    y2={y}
                    stroke="#1C2A33"
                    strokeDasharray={d === 0 || d === 1000 ? '0' : '2,4'}
                  />
                  <text
                    x={chartData.padding.left - 8}
                    y={y + 3}
                    fill="#6E8391"
                    fontFamily="JetBrains Mono"
                    fontSize="9"
                    textAnchor="end"
                  >
                    {d}m
                  </text>
                </g>
              );
            })}

            {/* Grid Vertical Temp lines */}
            {[0, 5, 10, 15, 20, 25, 30].map((t) => {
              const x = chartData.tempToX(t);
              return (
                <g key={t}>
                  <line
                    x1={x}
                    y1={chartData.padding.top}
                    x2={x}
                    y2={chartData.height - chartData.padding.bottom}
                    stroke="#1C2A33"
                    strokeDasharray="2,4"
                  />
                  <text
                    x={x}
                    y={chartData.height - chartData.padding.bottom + 14}
                    fill="#6E8391"
                    fontFamily="JetBrains Mono"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {t}°C
                  </text>
                </g>
              );
            })}

            {/* Mixed Layer Depth reference dashed line */}
            <line
              x1={chartData.padding.left}
              y1={chartData.mldY}
              x2={chartData.width - chartData.padding.right}
              y2={chartData.mldY}
              stroke="#3FE0C7"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.6"
            />
            <text
              x={chartData.width - chartData.padding.right - 2}
              y={chartData.mldY - 4}
              fill="#3FE0C7"
              fontFamily="JetBrains Mono"
              fontSize="8"
              textAnchor="end"
              opacity="0.8"
            >
              MLD: {stationData.mixedLayerDepth}m
            </text>

            {/* Uncertainty Shaded Band */}
            <path d={chartData.areaPath} fill="rgba(63, 224, 199, 0.12)" />

            {/* Main Reconstructed Thermocline Line */}
            <path d={chartData.linePath} fill="none" stroke="#3FE0C7" strokeWidth="2" />

            {/* Argo In-Situ Sounding Points */}
            {stationData.argoPoints.map((pt, i) => (
              <g key={i}>
                <rect
                  x={chartData.tempToX(pt.temp) - 2.5}
                  y={chartData.depthToY(pt.depth) - 2.5}
                  width="5"
                  height="5"
                  fill="#FF8A5B"
                />
              </g>
            ))}

            {/* Hover Cursor Probe Indicator */}
            {activeHoverPoint && (
              <g>
                <line
                  x1={chartData.padding.left}
                  y1={chartData.depthToY(activeHoverPoint.depth)}
                  x2={chartData.width - chartData.padding.right}
                  y2={chartData.depthToY(activeHoverPoint.depth)}
                  stroke="#E8EDF0"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
                <circle
                  cx={chartData.tempToX(activeHoverPoint.temp)}
                  cy={chartData.depthToY(activeHoverPoint.depth)}
                  r="4"
                  fill="#E8EDF0"
                  stroke="#3FE0C7"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* Top-right confidence tag */}
          <div className="absolute top-2 right-2 bg-[#0A1119]/90 border border-[#1C2A33] px-2 py-0.5 font-data text-[9px] text-[#3FE0C7]">
            CONFIDENCE: {stationData.confidencePct}%
          </div>

          {/* Floating Hover Info Chip */}
          {activeHoverPoint && (
            <div className="absolute top-3 left-14 bg-[#0A1119]/95 border border-[#3FE0C7] px-2.5 py-1 font-data text-[10px] text-[#E8EDF0] shadow-lg pointer-events-none">
              <span className="text-[#3FE0C7]">z={activeHoverPoint.depth}m:</span>{' '}
              <span className="font-bold">{activeHoverPoint.temp.toFixed(2)}°C</span>{' '}
              <span className="text-[#6E8391]">({activeHoverPoint.salinity.toFixed(1)} PSU)</span>
            </div>
          )}
        </div>
      </div>

      {/* Model Architecture Note */}
      <div className="font-data text-[10px] text-[#6E8391] p-3 bg-[#05080D] border border-[#1C2A33] leading-relaxed mb-4">
        Subsurface profile reconstructed via Transformer-based OceanEmbed model integrating surface SSHA,
        SST, and gridded Argo climatology.
      </div>

      {/* Actions */}
      <div className="mt-auto pt-2 space-y-2">
        {onOpenCycloneSimulator && (
          <button
            id="simulate-cyclone-panel-btn"
            onClick={() => onOpenCycloneSimulator(stationData.station.id)}
            className="w-full bg-[#FF8A5B] hover:bg-[#ff9e75] text-[#05080D] font-space font-bold text-xs py-3 px-4 uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-[#FF8A5B] shadow-lg"
          >
            <Wind className="w-4 h-4 text-[#05080D]" />
            <span>WHAT-IF CYCLONE SIMULATOR (PWP)</span>
          </button>
        )}

        <button
          id="export-profile-btn"
          onClick={handleExportData}
          className="w-full bg-[#05080D] hover:bg-[#1C2A33] text-[#E8EDF0] font-space font-semibold text-xs py-2.5 px-4 uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-[#1C2A33]"
        >
          <Download className="w-4 h-4 text-[#6E8391]" />
          <span>EXPORT DATA (.CSV)</span>
        </button>
      </div>
    </aside>
  );
};
