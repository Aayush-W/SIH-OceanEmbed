import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getTransectData, tempToHexColor, tempToRgba } from '../data/oceanData';
import { SurfaceLayer, TransectData } from '../types';
import { Layers, Info, Navigation, ArrowRight, Download } from 'lucide-react';

interface CrossSectionViewProps {
  currentDate: string;
  activeLayer: SurfaceLayer;
  onOpenStation?: (stationId: string) => void;
}

export const CrossSectionView: React.FC<CrossSectionViewProps> = ({
  currentDate,
  activeLayer,
  onOpenStation,
}) => {
  const [activeTransectId, setActiveTransectId] = useState<string>('zonal_12n');
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; valX: number; valDepth: number; temp: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const transectData = useMemo(() => {
    return getTransectData(activeTransectId, currentDate, activeLayer);
  }, [activeTransectId, currentDate, activeLayer]);

  // Render high-resolution canvas heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !transectData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#05080D';
    ctx.fillRect(0, 0, width, height);

    const xPoints = transectData.points;
    const minX = xPoints[0].xCoord;
    const maxX = xPoints[xPoints.length - 1].xCoord;
    const maxDepth = 1000;

    const xToCanvas = (val: number) => ((val - minX) / (maxX - minX)) * width;
    const depthToCanvas = (d: number) => (d / maxDepth) * height;

    // Grid rendering with interpolation
    // We create a fine 2D pixel buffer or grid cells
    const cellW = 8;
    const cellH = 8;

    // Sample temperature at (x, depth) using bilinear interpolation from transectData
    const sampleTemp = (xVal: number, dVal: number): number => {
      // Find bounding x points
      let i0 = 0;
      for (let i = 0; i < xPoints.length - 1; i++) {
        if (xVal >= xPoints[i].xCoord && xVal <= xPoints[i + 1].xCoord) {
          i0 = i;
          break;
        }
      }
      const p0 = xPoints[i0];
      const p1 = xPoints[Math.min(i0 + 1, xPoints.length - 1)];
      const tX = p1.xCoord !== p0.xCoord ? (xVal - p0.xCoord) / (p1.xCoord - p0.xCoord) : 0;

      // Find bounding depth points in p0 and p1
      const getColTemp = (col: typeof p0, d: number) => {
        const grid = col.depthGrid;
        let j0 = 0;
        for (let j = 0; j < grid.length - 1; j++) {
          if (d >= grid[j].depth && d <= grid[j + 1].depth) {
            j0 = j;
            break;
          }
        }
        const g0 = grid[j0];
        const g1 = grid[Math.min(j0 + 1, grid.length - 1)];
        const tD = g1.depth !== g0.depth ? (d - g0.depth) / (g1.depth - g0.depth) : 0;
        return g0.temp + tD * (g1.temp - g0.temp);
      };

      const t0 = getColTemp(p0, dVal);
      const t1 = getColTemp(p1, dVal);
      return t0 + tX * (t1 - t0);
    };

    // Draw interpolated temperature field
    for (let px = 0; px < width; px += cellW) {
      const xNorm = px / width;
      const xVal = minX + xNorm * (maxX - minX);

      for (let py = 0; py < height; py += cellH) {
        const dNorm = py / height;
        const dVal = dNorm * maxDepth;

        const temp = sampleTemp(xVal, dVal);
        ctx.fillStyle = tempToHexColor(temp, 5, 30);
        ctx.fillRect(px, py, cellW, cellH);
      }
    }

    // Draw Isotherm contour lines (e.g. 26°C, 20°C, 15°C, 10°C)
    const isotherms = [26, 20, 15, 10];
    isotherms.forEach((isoT) => {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(232, 237, 240, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);

      for (let px = 0; px < width; px += 10) {
        const xVal = minX + (px / width) * (maxX - minX);
        // Find depth where sampleTemp ~ isoT
        let isoDepth = 100;
        for (let d = 0; d <= maxDepth; d += 10) {
          if (sampleTemp(xVal, d) <= isoT) {
            isoDepth = d;
            break;
          }
        }
        const py = depthToCanvas(isoDepth);
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Draw Mixed Layer Depth Contour (solid cyan line)
    ctx.beginPath();
    ctx.strokeStyle = '#3FE0C7';
    ctx.lineWidth = 2.5;
    transectData.mixedLayerContour.forEach((pt, idx) => {
      const px = xToCanvas(pt.x);
      const py = depthToCanvas(pt.depth);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Draw Stations markers on top surface
    xPoints.forEach((pt) => {
      const px = xToCanvas(pt.xCoord);
      ctx.fillStyle = '#E8EDF0';
      ctx.fillRect(px - 1, 0, 2, 8);
    });
  }, [transectData]);

  // Handle canvas mouse move for interactive depth probe
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !transectData) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, px / rect.width));
    const normY = Math.max(0, Math.min(1, py / rect.height));

    const xPoints = transectData.points;
    const minX = xPoints[0].xCoord;
    const maxX = xPoints[xPoints.length - 1].xCoord;

    const valX = minX + normX * (maxX - minX);
    const valDepth = Math.round(normY * 1000);

    // Approximate temp at hover
    // Find closest x column
    const closestCol = xPoints.reduce((prev, curr) =>
      Math.abs(curr.xCoord - valX) < Math.abs(prev.xCoord - valX) ? curr : prev
    );
    const grid = closestCol.depthGrid;
    let temp = grid[0].temp;
    for (let i = 0; i < grid.length - 1; i++) {
      if (valDepth >= grid[i].depth && valDepth <= grid[i + 1].depth) {
        const frac = (valDepth - grid[i].depth) / (grid[i + 1].depth - grid[i].depth);
        temp = grid[i].temp + frac * (grid[i + 1].temp - grid[i].temp);
        break;
      }
    }

    setHoverCoord({
      x: px,
      y: py,
      valX: Math.round(valX * 10) / 10,
      valDepth,
      temp: Math.round(temp * 10) / 10,
    });
  };

  return (
    <div id="cross-section-screen" className="flex-1 w-full h-full flex flex-col p-6 overflow-y-auto bg-[#05080D]">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-[#1C2A33] gap-4">
        <div>
          <div className="font-data text-[10px] text-[#3FE0C7] tracking-[0.2em] uppercase mb-1">
            VERTICAL TRANSECT RECONSTRUCTION
          </div>
          <h1 className="font-space text-2xl font-bold uppercase text-[#E8EDF0] tracking-tight">
            {transectData.title}
          </h1>
          <p className="font-space text-xs text-[#6E8391] mt-1 max-w-2xl">
            {transectData.description}
          </p>
        </div>

        {/* Transect Switcher Buttons */}
        <div className="flex items-center bg-[#0A1119] border border-[#1C2A33] p-1 gap-1">
          <button
            id="transect-zonal-btn"
            onClick={() => setActiveTransectId('zonal_12n')}
            className={`px-3 py-1.5 font-space text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTransectId === 'zonal_12n'
                ? 'bg-[#E8EDF0] text-[#05080D]'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            ZONAL 12.0°N (ARABIAN SEA → BOB)
          </button>
          <button
            id="transect-meridional-btn"
            onClick={() => setActiveTransectId('meridional_bob')}
            className={`px-3 py-1.5 font-space text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTransectId === 'meridional_bob'
                ? 'bg-[#E8EDF0] text-[#05080D]'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            MERIDIONAL 88.0°E (BAY OF BENGAL)
          </button>
        </div>
      </div>

      {/* Main Transect Heatmap Container */}
      <div className="bg-[#0A1119] border border-[#1C2A33] p-6 relative flex-1 min-h-[480px] flex flex-col justify-between">
        {/* HUD Brackets */}
        <div className="corner-bracket corner-tl"></div>
        <div className="corner-bracket corner-tr"></div>
        <div className="corner-bracket corner-bl"></div>
        <div className="corner-bracket corner-br"></div>

        {/* Top Status & Legend Bar */}
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-[#1C2A33]">
          <div className="flex items-center gap-4 font-data text-xs text-[#E8EDF0]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#3FE0C7]"></span>
              <span className="text-[#3FE0C7] font-semibold">MIXED LAYER CONTOUR (MLD)</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#6E8391]">
              <span className="w-2.5 h-0.5 border-b border-dashed border-[#E8EDF0]"></span>
              <span>ISOTHERMS (26°C, 20°C, 15°C, 10°C)</span>
            </span>
          </div>

          {/* Temperature Legend Bar */}
          <div className="flex items-center gap-3">
            <span className="font-data text-[10px] text-[#6E8391] uppercase">COLD (5°C)</span>
            <div className="w-40 h-2.5 temp-gradient border border-[#1C2A33]"></div>
            <span className="font-data text-[10px] text-[#FF8A5B] uppercase">WARM (30°C)</span>
          </div>
        </div>

        {/* Heatmap with Y & X Axis */}
        <div className="flex flex-1 relative gap-3">
          {/* Depth Inverted Y-Axis */}
          <div className="w-14 flex flex-col justify-between font-data text-[10px] text-[#6E8391] text-right pr-2 border-r border-[#1C2A33]">
            <span>0m</span>
            <span>200m</span>
            <span>400m</span>
            <span>600m</span>
            <span>800m</span>
            <span>1000m</span>
          </div>

          {/* Canvas Wrapper */}
          <div className="flex-1 relative border border-[#1C2A33] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={900}
              height={400}
              className="w-full h-full object-fill cursor-crosshair"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverCoord(null)}
            />

            {/* Interactive Hover Probe */}
            {hoverCoord && (
              <div
                className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
                style={{ left: hoverCoord.x, top: hoverCoord.y }}
              >
                <div className="bg-[#0A1119]/95 border border-[#3FE0C7] p-2.5 backdrop-blur-md font-data text-xs shadow-2xl">
                  <div className="text-[10px] text-[#3FE0C7] uppercase font-space font-semibold">
                    SUB-SURFACE PROBE
                  </div>
                  <div className="text-[#E8EDF0] mt-0.5">
                    {transectData.xLabel.includes('Longitude') ? `${hoverCoord.valX}°E` : `${hoverCoord.valX}°N`},{' '}
                    Depth: <span className="font-bold">{hoverCoord.valDepth}m</span>
                  </div>
                  <div className="text-[#FF8A5B] font-bold text-sm mt-0.5">
                    T = {hoverCoord.temp.toFixed(1)}°C
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between pl-14 pt-2 font-data text-[10px] text-[#6E8391]">
          {transectData.points.map((pt, i) => (
            <span key={i}>{pt.xLabel}</span>
          ))}
        </div>

        {/* Oceanographic Insight Footer */}
        <div className="mt-4 pt-3 border-t border-[#1C2A33] flex flex-col md:flex-row justify-between items-start md:items-center text-xs font-data text-[#6E8391] gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#3FE0C7]" />
            <span>
              Observed thermocline tilt indicates strong wind-driven eastward downwelling & salinity barrier layer formation.
            </span>
          </div>
          <div className="text-[#3FE0C7]">
            DATE: {currentDate} // 15 DISCRETE DEPTH PROFILES
          </div>
        </div>
      </div>
    </div>
  );
};
