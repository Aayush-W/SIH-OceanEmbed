import React from 'react';
import { getAnomalyAlerts } from '../data/oceanData';
import { SubsurfaceAlert } from '../types';
import { AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, ShieldAlert } from 'lucide-react';

interface AlertsFeedViewProps {
  currentDate: string;
  onSelectStation: (stationId: string) => void;
}

// Sparkline Mini Canvas Renderer
const SparklineCanvas: React.FC<{ data: number[]; isPositive: boolean }> = ({ data, isPositive }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const strokeColor = isPositive ? '#FF8A5B' : '#3FE0C7';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * (w - 8) + 4;
      const y = h - 6 - ((val - min) / range) * (h - 12);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // End point dot
    const lastX = w - 4;
    const lastY = h - 6 - ((data[data.length - 1] - min) / range) * (h - 12);
    ctx.fillStyle = strokeColor;
    ctx.fillRect(lastX - 2, lastY - 2, 4, 4);
  }, [data, isPositive]);

  return <canvas ref={canvasRef} width={90} height={28} className="w-[90px] h-[28px]" />;
};

export const AlertsFeedView: React.FC<AlertsFeedViewProps> = ({ currentDate, onSelectStation }) => {
  const alerts = getAnomalyAlerts(currentDate);

  const getSeverityBadge = (sev: SubsurfaceAlert['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="bg-[#FF8A5B]/15 border border-[#FF8A5B] text-[#FF8A5B] px-2 py-0.5 font-data text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#FF8A5B] animate-ping"></span>
            CRITICAL
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="bg-[#fbad7e]/15 border border-[#fbad7e] text-[#fbad7e] px-2 py-0.5 font-data text-[10px] font-semibold tracking-wider uppercase">
            ELEVATED
          </span>
        );
      case 'MONITORING':
        return (
          <span className="bg-[#3FE0C7]/15 border border-[#3FE0C7] text-[#3FE0C7] px-2 py-0.5 font-data text-[10px] font-semibold tracking-wider uppercase">
            MONITORING
          </span>
        );
    }
  };

  return (
    <div id="alerts-feed-screen" className="flex-1 w-full h-full flex flex-col p-6 overflow-y-auto bg-[#05080D]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-[#1C2A33] gap-4">
        <div>
          <div className="font-data text-[10px] text-[#FF8A5B] tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>SUB-SURFACE ANOMALY SURVEILLANCE</span>
          </div>
          <h1 className="font-space text-2xl font-bold uppercase text-[#E8EDF0] tracking-tight">
            Active Thermal & Dynamic Anomalies
          </h1>
          <p className="font-space text-xs text-[#6E8391] mt-1">
            Detected via satellite altimetry residual decomposition and 3D subsurface temperature divergence.
          </p>
        </div>

        {/* Global Alert Count */}
        <div className="flex items-center gap-3 bg-[#0A1119] border border-[#1C2A33] px-4 py-2">
          <span className="font-data text-xs text-[#6E8391] uppercase">ACTIVE DETECTIONS:</span>
          <span className="font-data text-base font-bold text-[#FF8A5B]">{alerts.length}</span>
          <span className="text-[#1C2A33]">•</span>
          <span className="font-data text-xs text-[#3FE0C7]">MODEL: v2.4 RESIDUAL-NET</span>
        </div>
      </div>

      {/* Alert Feed Rows */}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const isPositive = alert.deltaValue > 0;
          return (
            <div
              key={alert.id}
              className="bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7]/50 p-4 transition-all duration-200 relative group flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* HUD Framing Corner */}
              <div className="corner-bracket corner-tl"></div>
              <div className="corner-bracket corner-tr"></div>
              <div className="corner-bracket corner-bl"></div>
              <div className="corner-bracket corner-br"></div>

              {/* Left Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                  {getSeverityBadge(alert.severity)}
                  <span className="font-data text-xs text-[#3FE0C7] font-semibold uppercase">
                    {alert.region}
                  </span>
                  <span className="font-data text-xs text-[#6E8391]">
                    {alert.lat.toFixed(2)}°N, {alert.lon.toFixed(2)}°E
                  </span>
                  <span className="font-data text-[10px] text-[#6E8391] border border-[#1C2A33] px-1.5 py-0.5">
                    LAYER: {alert.depthRange}
                  </span>
                </div>

                <h3 className="font-space text-base font-bold text-[#E8EDF0] uppercase tracking-wide">
                  {alert.title}
                </h3>
                <p className="font-space text-xs text-[#6E8391] mt-1 leading-relaxed max-w-3xl">
                  {alert.description}
                </p>
              </div>

              {/* Middle Metrics & Sparkline */}
              <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[#1C2A33] pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                <div>
                  <div className="font-space text-[10px] text-[#6E8391] uppercase">ANOMALY ΔT</div>
                  <div
                    className={`font-data text-lg font-bold flex items-center gap-1 ${
                      isPositive ? 'text-[#FF8A5B]' : 'text-[#3FE0C7]'
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{alert.anomalyDelta}</span>
                  </div>
                </div>

                {/* Sparkline */}
                <div>
                  <div className="font-space text-[10px] text-[#6E8391] uppercase mb-0.5">30-DAY DRIFT</div>
                  <SparklineCanvas data={alert.sparkline} isPositive={isPositive} />
                </div>

                <div>
                  <div className="font-space text-[10px] text-[#6E8391] uppercase">CONFIDENCE</div>
                  <div className="font-data text-xs font-semibold text-[#E8EDF0]">{alert.confidence}</div>
                </div>

                {/* Inspect Action */}
                <button
                  id={`sample-node-btn-${alert.id}`}
                  onClick={() => onSelectStation(alert.linkedStationId)}
                  className="bg-[#05080D] hover:bg-[#E8EDF0] text-[#E8EDF0] hover:text-[#05080D] border border-[#1C2A33] hover:border-[#E8EDF0] px-3.5 py-2 font-space text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <span>SAMPLE NODE</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
