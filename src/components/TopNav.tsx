import React, { useState } from 'react';
import { NavScreen, SurfaceLayer } from '../types';
import { Globe, Activity, ShieldAlert, Settings, HelpCircle, Layers, Cpu, Database, RefreshCw, X } from 'lucide-react';

interface TopNavProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  selectedStationId: string | null;
  activeLayer: SurfaceLayer;
  onChangeLayer: (layer: SurfaceLayer) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentScreen,
  onNavigate,
  selectedStationId,
  activeLayer,
  onChangeLayer,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <header className="bg-[#05080D] border-b border-[#1C2A33] flex justify-between items-center px-6 h-16 w-full fixed top-0 left-0 right-0 z-50 select-none">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-8">
          <div
            onClick={() => onNavigate('globe')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-3 h-3 bg-[#3FE0C7] rounded-none rotate-45 group-hover:scale-110 transition-transform"></div>
            <span className="font-space font-bold text-lg tracking-tight text-[#E8EDF0]">
              OCEANEMBED <span className="text-[#6E8391] font-normal">// ARC-01</span>
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex gap-6 h-full items-center">
            <button
              id="nav-globe-btn"
              onClick={() => onNavigate('globe')}
              className={`font-data text-xs uppercase tracking-widest py-1 border-b-2 transition-all flex items-center gap-2 ${
                currentScreen === 'globe'
                  ? 'text-[#3FE0C7] border-[#3FE0C7] font-semibold'
                  : 'text-[#6E8391] border-transparent hover:text-[#E8EDF0]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D GLOBE</span>
            </button>

            <button
              id="nav-sat-map-btn"
              onClick={() => onNavigate('satellite-map')}
              className={`font-data text-xs uppercase tracking-widest py-1 border-b-2 transition-all flex items-center gap-2 ${
                currentScreen === 'satellite-map'
                  ? 'text-[#3FE0C7] border-[#3FE0C7] font-semibold'
                  : 'text-[#6E8391] border-transparent hover:text-[#E8EDF0]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D/3D SATELLITE MAP</span>
            </button>

            <button
              id="nav-cross-section-btn"
              onClick={() => onNavigate('cross-section')}
              className={`font-data text-xs uppercase tracking-widest py-1 border-b-2 transition-all flex items-center gap-2 ${
                currentScreen === 'cross-section'
                  ? 'text-[#3FE0C7] border-[#3FE0C7] font-semibold'
                  : 'text-[#6E8391] border-transparent hover:text-[#E8EDF0]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>TRANSECT CROSS-SECTION</span>
            </button>

            <button
              id="nav-alerts-btn"
              onClick={() => onNavigate('alerts')}
              className={`font-data text-xs uppercase tracking-widest py-1 border-b-2 transition-all flex items-center gap-2 ${
                currentScreen === 'alerts'
                  ? 'text-[#3FE0C7] border-[#3FE0C7] font-semibold'
                  : 'text-[#6E8391] border-transparent hover:text-[#E8EDF0]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SUBSURFACE ANOMALIES</span>
            </button>
          </nav>
        </div>

        {/* Right: Model Status & Actions */}
        <div className="flex items-center gap-4">
          {/* Surface Layer Quick Selector */}
          <div className="hidden lg:flex items-center bg-[#0A1119] border border-[#1C2A33] p-0.5">
            {(['SST', 'SSS', 'SSH', 'CURRENTS', 'WINDS'] as SurfaceLayer[]).map((layer) => (
              <button
                key={layer}
                id={`layer-selector-${layer}`}
                onClick={() => onChangeLayer(layer)}
                className={`px-2.5 py-1 font-data text-[11px] font-semibold transition-colors uppercase ${
                  activeLayer === layer
                    ? 'bg-[#E8EDF0] text-[#05080D]'
                    : 'text-[#6E8391] hover:text-[#E8EDF0]'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>

          {/* Model Status Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-[#0A1119] border border-[#1C2A33] px-3 py-1.5 font-data text-[11px] text-[#3FE0C7]">
            <span className="w-2 h-2 bg-[#3FE0C7] animate-pulse"></span>
            <span>MODEL ONLINE — 15 DEPTH LEVELS (0-1000M)</span>
          </div>

          {/* Tools */}
          <button
            id="sys-diagnostics-btn"
            onClick={() => setShowDiagnostics(true)}
            className="p-2 text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119] border border-transparent hover:border-[#1C2A33] transition-colors"
            title="System Diagnostics & Telemetry"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            id="sys-help-btn"
            onClick={() => setShowHelp(true)}
            className="p-2 text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119] border border-transparent hover:border-[#1C2A33] transition-colors"
            title="OceanEmbed Architecture & Guidance"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Research Avatar Badge */}
          <div className="w-8 h-8 border border-[#1C2A33] bg-[#0A1119] flex items-center justify-center font-data text-xs text-[#3FE0C7] font-bold">
            OE
          </div>
        </div>
      </header>

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A1119] border border-[#1C2A33] max-w-lg w-full p-6 relative font-data">
            <div className="corner-bracket corner-tl"></div>
            <div className="corner-bracket corner-tr"></div>
            <div className="corner-bracket corner-bl"></div>
            <div className="corner-bracket corner-br"></div>

            <div className="flex justify-between items-center pb-3 border-b border-[#1C2A33] mb-4">
              <div className="flex items-center gap-2 text-[#3FE0C7] font-space font-bold uppercase text-sm">
                <Cpu className="w-4 h-4" />
                <span>OCEANEMBED // SYSTEM TELEMETRY</span>
              </div>
              <button onClick={() => setShowDiagnostics(false)} className="text-[#6E8391] hover:text-[#E8EDF0]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">INFERENCE ARCHITECTURE:</span>
                <span className="text-[#E8EDF0]">Deep Transformer + Physics Guided Loss</span>
              </div>
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">COVERAGE DOMAIN:</span>
                <span className="text-[#E8EDF0]">North Indian Ocean (5°N–30°N, 45°E–105°E)</span>
              </div>
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">SATELLITE INGEST:</span>
                <span className="text-[#3FE0C7]">Jason-3, Sentinel-6, MODIS, SMAP</span>
              </div>
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">ARGO IN-SITU VALIDATION:</span>
                <span className="text-[#3FE0C7]">6 Real Floats Synchronized</span>
              </div>
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">INFERENCE LATENCY:</span>
                <span className="text-[#E8EDF0]">12.4 ms / profile</span>
              </div>
              <div className="flex justify-between border-b border-[#1C2A33]/50 pb-1.5">
                <span className="text-[#6E8391]">UNCERTAINTY ENSEMBLE:</span>
                <span className="text-[#E8EDF0]">Monte Carlo Dropout (N=50, 1σ)</span>
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(false)}
              className="mt-6 w-full bg-[#E8EDF0] text-[#05080D] font-space font-semibold text-xs py-2 uppercase tracking-wider hover:bg-white"
            >
              CLOSE DIAGNOSTICS
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A1119] border border-[#1C2A33] max-w-md w-full p-6 relative font-space">
            <div className="corner-bracket corner-tl"></div>
            <div className="corner-bracket corner-tr"></div>
            <div className="corner-bracket corner-bl"></div>
            <div className="corner-bracket corner-br"></div>

            <div className="flex justify-between items-center pb-3 border-b border-[#1C2A33] mb-4">
              <div className="flex items-center gap-2 text-[#3FE0C7] font-bold uppercase text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>USER INTERACTION GUIDE</span>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-[#6E8391] hover:text-[#E8EDF0]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#E8EDF0] font-space leading-relaxed">
              <p>
                <strong className="text-[#3FE0C7]">1. 3D Globe Sampling:</strong> Drag to rotate, scroll to zoom. Click any glowing node marker in the North Indian Ocean to fire a 1000m vertical core-sampling beam and open its full depth-temperature curve.
              </p>
              <p>
                <strong className="text-[#3FE0C7]">2. Timeline Scrubber:</strong> Drag the bottom timeline slider or press Play to watch seasonal monsoon warming and cooling cycles dynamically reconstruct subsurface temperatures.
              </p>
              <p>
                <strong className="text-[#3FE0C7]">3. Layer Toggle:</strong> Switch between SST (temperature), SSS (salinity), SSH (sea surface height), and Geostrophic currents to inspect multi-sensor satellite inputs.
              </p>
              <p>
                <strong className="text-[#3FE0C7]">4. Cross-Section & Alerts:</strong> Explore basin-wide 2D vertical heatmaps and real-time subsurface thermal anomaly surveillance.
              </p>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full bg-[#E8EDF0] text-[#05080D] font-space font-semibold text-xs py-2 uppercase tracking-wider hover:bg-white"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  );
};
