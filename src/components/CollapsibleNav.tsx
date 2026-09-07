import React, { useState } from 'react';
import { NavScreen, SurfaceLayer } from '../types';
import {
  Globe,
  Activity,
  ShieldAlert,
  Settings,
  HelpCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Radio,
  Clock,
  X,
  Wind,
} from 'lucide-react';

interface CollapsibleNavProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  selectedStationId: string | null;
  activeLayer: SurfaceLayer;
  onChangeLayer: (layer: SurfaceLayer) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const CollapsibleNav: React.FC<CollapsibleNavProps> = ({
  currentScreen,
  onNavigate,
  selectedStationId,
  activeLayer,
  onChangeLayer,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      {/* Sleek Vertical Left-Side Navigation Bar */}
      <aside
        className={`glass-nav fixed top-0 left-0 bottom-0 z-40 bg-[#05080D]/95 border-r border-[#1C2A33] backdrop-blur-xl transition-all duration-300 select-none flex flex-col justify-between ${
          isCollapsed ? 'w-14' : 'w-64'
        }`}
      >
        {/* Top: Brand & Collapse Toggle */}
        <div className="border-b border-[#1C2A33]">
          <div className="h-14 px-3 flex items-center justify-between">
            {!isCollapsed ? (
              <div
                onClick={() => onNavigate('globe')}
                className="flex items-center gap-2.5 cursor-pointer group overflow-hidden"
              >
                <div className="w-3 h-3 bg-[#3FE0C7] rounded-none rotate-45 group-hover:scale-110 transition-transform shrink-0"></div>
                <div className="flex flex-col">
                  <span className="font-space font-bold text-sm tracking-tight text-[#E8EDF0] leading-none">
                    OCEANEMBED
                  </span>
                  <span className="font-data text-[9px] text-[#3FE0C7] tracking-widest uppercase mt-0.5">
                    ARC-01 // TACTICAL
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onNavigate('globe')}
                className="w-8 h-8 mx-auto flex items-center justify-center cursor-pointer"
                title="OceanEmbed"
              >
                <div className="w-3 h-3 bg-[#3FE0C7] rounded-none rotate-45"></div>
              </div>
            )}

            {/* Collapse / Expand Toggle Button */}
            <button
              onClick={onToggleCollapse}
              className={`p-1 text-[#6E8391] hover:text-[#3FE0C7] hover:bg-[#0A1119] border border-transparent hover:border-[#1C2A33] transition-colors ${
                isCollapsed ? 'mx-auto' : ''
              }`}
              title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar for Fullscreen'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center: Navigation Screens & Layer Selector */}
        <div className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
          {/* Navigation Items */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pb-1 font-data text-[9px] text-[#6E8391] uppercase tracking-widest">
                MONITORING & ANALYSIS
              </div>
            )}

            <button
              id="nav-globe-btn"
              onClick={() => onNavigate('globe')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'globe'
                  ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-l-2 border-[#3FE0C7] font-bold'
                  : 'text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119]'
              }`}
              title="3D Globe"
            >
              <Globe className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>3D GLOBE</span>}
            </button>

            <button
              id="nav-sat-map-btn"
              onClick={() => onNavigate('satellite-map')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'satellite-map'
                  ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-l-2 border-[#3FE0C7] font-bold'
                  : 'text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119]'
              }`}
              title="2D/3D Satellite Map"
            >
              <Layers className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>SATELLITE MAP</span>}
            </button>

            <button
              id="nav-cross-section-btn"
              onClick={() => onNavigate('cross-section')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'cross-section'
                  ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-l-2 border-[#3FE0C7] font-bold'
                  : 'text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119]'
              }`}
              title="Transect Cross-Section"
            >
              <Activity className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>CROSS-SECTION</span>}
            </button>

            <button
              id="nav-alerts-btn"
              onClick={() => onNavigate('alerts')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'alerts'
                  ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-l-2 border-[#3FE0C7] font-bold'
                  : 'text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119]'
              }`}
              title="Subsurface Anomalies"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>ANOMALIES</span>}
            </button>

            <button
              id="nav-ml-model-btn"
              onClick={() => onNavigate('ml-model')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'ml-model'
                  ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-l-2 border-[#3FE0C7] font-bold'
                  : 'text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119]'
              }`}
              title="PINN Neural Architecture & Model Benchmarks"
            >
              <Cpu className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>PINN ML MODEL</span>}
            </button>

            {!isCollapsed && (
              <div className="px-2 pt-3 pb-1 font-data text-[9px] text-[#6E8391] uppercase tracking-widest">
                SIMULATION
              </div>
            )}

            <button
              id="nav-cyclone-sim-btn"
              onClick={() => onNavigate('cyclone-simulator')}
              className={`w-full py-2.5 px-2.5 rounded-none font-data text-xs uppercase tracking-wider transition-all flex items-center gap-3 ${
                currentScreen === 'cyclone-simulator'
                  ? 'bg-[#FF8A5B]/15 text-[#FF8A5B] border-l-2 border-[#FF8A5B] font-bold'
                  : 'text-[#6E8391] hover:text-[#FF8A5B] hover:bg-[#0A1119]'
              }`}
              title="Price-Weller-Pinkel (PWP) What-If Cyclone Simulator"
            >
              <Wind className="w-4 h-4 shrink-0 text-[#FF8A5B]" />
              {!isCollapsed && <span className="text-[#FF8A5B] font-semibold">CYCLONE TWIN</span>}
            </button>
          </div>

          {/* Sensor Layer Switcher */}
          <div className="space-y-1.5 pt-2 border-t border-[#1C2A33]">
            {!isCollapsed ? (
              <>
                <div className="px-2 pb-1 font-data text-[9px] text-[#6E8391] uppercase tracking-widest flex items-center justify-between">
                  <span>SENSOR LAYER</span>
                  <span className="text-[#3FE0C7] font-bold">{activeLayer}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 px-1">
                  {(['SST', 'SSS', 'SSH', 'CURRENTS', 'WINDS'] as SurfaceLayer[]).map((layer) => (
                    <button
                      key={layer}
                      id={`layer-selector-${layer}`}
                      onClick={() => onChangeLayer(layer)}
                      className={`py-1.5 px-2 font-data text-[10px] font-semibold uppercase border transition-all text-center ${
                        activeLayer === layer
                          ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7] font-bold shadow-md'
                          : 'bg-[#0A1119] text-[#6E8391] border-[#1C2A33] hover:text-[#E8EDF0]'
                      }`}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {(['SST', 'SSS', 'SSH', 'CURRENTS'] as SurfaceLayer[]).map((layer) => (
                  <button
                    key={layer}
                    onClick={() => onChangeLayer(layer)}
                    className={`w-9 h-7 font-data text-[9px] font-bold uppercase transition-all flex items-center justify-center border ${
                      activeLayer === layer
                        ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7]'
                        : 'bg-[#0A1119] text-[#6E8391] border-[#1C2A33]'
                    }`}
                    title={`Layer: ${layer}`}
                  >
                    {layer}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live Status Badge */}
          {!isCollapsed && (
            <div className="bg-[#0A1119] border border-[#1C2A33] p-2.5 font-data text-[10px] text-[#6E8391] space-y-1">
              <div className="flex items-center gap-1.5 text-[#3FE0C7] font-semibold uppercase">
                <span className="w-1.5 h-1.5 bg-[#3FE0C7] rounded-full animate-ping"></span>
                <span>MODEL INFERENCE ACTIVE</span>
              </div>
              <div>0–1000m Depth Thermocline</div>
              <div className="text-[9px] text-[#6E8391]">ARGO Validation: Synchronized</div>
            </div>
          )}
        </div>

        {/* Bottom: Diagnostics, Guide, & Version */}
        <div className="border-t border-[#1C2A33] p-2 bg-[#05080D]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-1">
              <button
                id="sys-diagnostics-btn"
                onClick={() => setShowDiagnostics(true)}
                className="flex-1 py-1.5 px-2 bg-[#0A1119] hover:bg-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0] border border-[#1C2A33] text-[10px] font-data uppercase flex items-center justify-center gap-1.5 transition-colors"
                title="Diagnostics"
              >
                <Cpu className="w-3.5 h-3.5 text-[#3FE0C7]" />
                <span>TELEMETRY</span>
              </button>

              <button
                id="sys-help-btn"
                onClick={() => setShowHelp(true)}
                className="p-1.5 bg-[#0A1119] hover:bg-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0] border border-[#1C2A33] transition-colors"
                title="User Interaction Guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => setShowDiagnostics(true)}
                className="p-2 text-[#6E8391] hover:text-[#3FE0C7]"
                title="Telemetry"
              >
                <Cpu className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 text-[#6E8391] hover:text-[#3FE0C7]"
                title="Help Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

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
                <strong className="text-[#3FE0C7]">1. Voice Assistant:</strong> Click the microphone icon at bottom right or speak commands ("Zoom to Bay of Bengal", "Advice for fishermen", "Pause orbit", "Show cross-section").
              </p>
              <p>
                <strong className="text-[#3FE0C7]">2. 3D Globe Sampling:</strong> Drag to rotate, scroll to zoom. Click any glowing node marker in the North Indian Ocean to fire a 1000m vertical core-sampling beam and open its full depth-temperature curve.
              </p>
              <p>
                <strong className="text-[#3FE0C7]">3. Timeline Scrubber:</strong> Drag the bottom timeline slider or press Play to watch seasonal monsoon warming and cooling cycles dynamically reconstruct subsurface temperatures.
              </p>
              <p>
                <strong className="text-[#3FE0C7]">4. Layer Toggle:</strong> Switch between SST (temperature), SSS (salinity), SSH (sea surface height), and Geostrophic currents to inspect multi-sensor satellite inputs.
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
