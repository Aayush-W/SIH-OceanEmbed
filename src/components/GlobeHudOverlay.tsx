import React from 'react';
import { STATIONS } from '../data/oceanData';
import { SurfaceLayer } from '../types';
import { Radio, Layers, MapPin } from 'lucide-react';

interface GlobeHudOverlayProps {
  activeLayer: SurfaceLayer;
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
}

export const GlobeHudOverlay: React.FC<GlobeHudOverlayProps> = ({
  activeLayer,
  selectedStationId,
  onSelectStation,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 select-none">
      {/* Subtle Tactical Viewport Corner Brackets */}
      <div className="corner-bracket corner-tl"></div>
      <div className="corner-bracket corner-tr"></div>
      <div className="corner-bracket corner-bl"></div>
      <div className="corner-bracket corner-br"></div>

      {/* Top Section */}
      <div className="flex justify-between items-start w-full">
        {/* Top Left: Quick Station Node Chips (Compact) */}
        <div className="pointer-events-auto bg-[#0A1119]/90 border border-[#1C2A33] p-2.5 backdrop-blur-md max-w-md hidden sm:block shadow-2xl">
          <div className="font-data text-[9px] text-[#3FE0C7] uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-semibold">
            <Radio className="w-3 h-3 text-[#3FE0C7] animate-pulse" />
            <span>NORTH INDIAN OCEAN NODES</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {STATIONS.map((st) => (
              <button
                key={st.id}
                onClick={() => onSelectStation(st.id)}
                className={`px-2.5 py-1 font-space text-[10px] uppercase border transition-all pointer-events-auto ${
                  selectedStationId === st.id
                    ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7] font-bold shadow-md'
                    : 'bg-[#05080D] text-[#E8EDF0] border-[#1C2A33] hover:text-[#3FE0C7] hover:border-[#3FE0C7]'
                }`}
                title={`Target ${st.name} (${st.lat}°N, ${st.lon}°E)`}
              >
                {st.name.split('/')[0].replace('Central ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Top Right: Compact Telemetry Badge (Moved here to never block the globe!) */}
        <div className="pointer-events-auto bg-[#0A1119]/90 border border-[#1C2A33] p-3 backdrop-blur-md text-right max-w-xs shadow-2xl relative">
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-br"></div>

          <div className="font-data text-[9px] text-[#3FE0C7] uppercase tracking-widest font-semibold flex items-center justify-end gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 bg-[#3FE0C7] rounded-full animate-ping"></span>
            <span>OCEANEMBED // ARC-01</span>
          </div>
          <h2 className="font-space font-bold text-xs sm:text-sm text-[#E8EDF0] uppercase tracking-wider">
            Subsurface Thermal Model
          </h2>
          <div className="font-data text-[10px] text-[#6E8391] mt-1">
            0–1000m Physics-Guided Thermocline
          </div>
          <div className="font-data text-[9px] text-[#3FE0C7] mt-0.5">
            Domain: 5°N–30°N, 45°E–105°E
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex justify-between items-end w-full relative">
        {/* Bottom Left Legend */}
        <div className="pointer-events-auto bg-[#0A1119]/90 border border-[#1C2A33] p-3 backdrop-blur-md max-w-xs relative shadow-2xl">
          <div className="corner-bracket-cyan-tl absolute w-2 h-2"></div>
          <div className="corner-bracket-coral-br absolute w-2 h-2"></div>

          <div className="font-data text-[10px] text-[#6E8391] uppercase mb-1.5 flex justify-between tracking-wider">
            <span>
              {activeLayer === 'SST' && 'SURFACE TEMPERATURE'}
              {activeLayer === 'SSS' && 'SURFACE SALINITY'}
              {activeLayer === 'SSH' && 'SEA SURFACE HEIGHT'}
              {activeLayer === 'CURRENTS' && 'GEOSTROPHIC CURRENT'}
              {activeLayer === 'WINDS' && 'SURFACE WIND SPEED'}
            </span>
            <span className="text-[#3FE0C7] font-bold">
              {activeLayer === 'SST' && '°C'}
              {activeLayer === 'SSS' && 'PSU'}
              {activeLayer === 'SSH' && 'cm'}
              {activeLayer === 'CURRENTS' && 'm/s'}
              {activeLayer === 'WINDS' && 'kt'}
            </span>
          </div>

          <div className="w-48 h-2 temp-gradient mb-1.5 border border-[#1C2A33]"></div>

          <div className="flex justify-between font-data text-[10px] text-[#6E8391]">
            {activeLayer === 'SST' && (
              <>
                <span>0°C</span>
                <span>10°C</span>
                <span>20°C</span>
                <span>30°C</span>
              </>
            )}
            {activeLayer === 'SSS' && (
              <>
                <span>32.0</span>
                <span>34.0</span>
                <span>36.0</span>
                <span>38.0</span>
              </>
            )}
            {activeLayer === 'SSH' && (
              <>
                <span>-20cm</span>
                <span>-10cm</span>
                <span>+10cm</span>
                <span>+20cm</span>
              </>
            )}
            {activeLayer === 'CURRENTS' && (
              <>
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
                <span>1.8m/s</span>
              </>
            )}
            {activeLayer === 'WINDS' && (
              <>
                <span>4 kt</span>
                <span>12 kt</span>
                <span>20 kt</span>
                <span>30 kt</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom Center Interaction Hint */}
        <div className="hidden lg:block absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="font-data text-[10px] text-[#6E8391] bg-[#0A1119]/90 px-4 py-1.5 border border-[#1C2A33] backdrop-blur-md tracking-widest uppercase shadow-lg">
            DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A MARKER TO SAMPLE
          </div>
        </div>

        {/* Empty placeholder for balance */}
        <div className="w-16"></div>
      </div>
    </div>
  );
};
