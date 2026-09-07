/**
 * Cyclone Digital Twin & Counterfactual Simulator View
 * Cinematic NASA Mission Control / War Room Dashboard built around a full-bleed 3D Earth.
 *
 * Layered Architecture:
 * - Layer 0: Dominant Full-Bleed 3D Earth Globe (NASA Satellite Imagery, Specular Water, Bump, Atmospheric Glow, 3D Track Splines, Rotating Eyewall)
 * - Layer 1: Floating Edge-Anchored Overlays (Consolidated Right Panel with Hero SST & MLD, and On-Demand Collapsible Cross-Section Panel)
 * - Layer 2: Bottom Single Unified Timeline Strip (Scrubber + Playback Controls + Wind Stress Seismograph)
 * - Layer 3: Fixed Isolated Corner (Voice AI Agent in bottom-right with dedicated clear margins)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wind,
  Sparkles,
  Info,
  Layers,
  Satellite,
  Globe,
  Sliders,
  X,
} from 'lucide-react';
import { StationData, SurfaceLayer } from '../types';
import { STATIONS, getStationData } from '../data/oceanData';
import {
  HISTORICAL_CYCLONES,
  CycloneHistoricalPreset,
  CycloneScenarioParams,
  runPWPSimulation,
  PWPSimulationSummary,
} from '../physics/pwpModel';

import { CycloneGlobeHero3D } from './CycloneGlobeHero3D';
import { CycloneTimelineSeismograph } from './CycloneTimelineSeismograph';
import { CycloneSubsurfaceGlassPanel } from './CycloneSubsurfaceGlassPanel';
import { CycloneConsolidatedRightPanel } from './CycloneConsolidatedRightPanel';
import { CycloneMapExplorer } from './CycloneMapExplorer';

interface CycloneSimulatorViewProps {
  currentDate: string;
  activeLayer: SurfaceLayer;
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
  onNavigateToMap?: () => void;
}

export const CycloneSimulatorView: React.FC<CycloneSimulatorViewProps> = ({
  currentDate,
  activeLayer,
  selectedStationId,
  onSelectStation,
  onNavigateToMap,
}) => {
  // 1. Station State
  const activeStationId = selectedStationId || 'bay_bengal_alpha';
  const stationData = useMemo(() => {
    return getStationData(activeStationId, currentDate, activeLayer);
  }, [activeStationId, currentDate, activeLayer]);

  // 2. Cyclone Historical Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>('amphan_2020');
  const activePreset = useMemo(() => {
    return HISTORICAL_CYCLONES.find((c) => c.id === selectedPresetId) || HISTORICAL_CYCLONES[0];
  }, [selectedPresetId]);

  // 3. Counterfactual Scenario Modifiers
  const [windKts, setWindKts] = useState<number>(activePreset.baseWindKts);
  const [speedKmh, setSpeedKmh] = useState<number>(activePreset.baseSpeedKmh);
  const [trackDistanceKm, setTrackDistanceKm] = useState<number>(activePreset.baseTrackDistanceKm);
  const [rmaxKm, setRmaxKm] = useState<number>(activePreset.baseRmaxKm);
  const [pressureDeficitHpa, setPressureDeficitHpa] = useState<number>(
    activePreset.basePressureDeficitHpa
  );
  const [initialMldM, setInitialMldM] = useState<number | undefined>(undefined);
  const [physicsMode, setPhysicsMode] = useState<'FIXED_PHYSICS' | 'LEARNED_MIXING'>('LEARNED_MIXING');

  // UI States
  const [isCrossSectionOpen, setIsCrossSectionOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'3D_HERO' | '2D_SPATIAL_SWATH'>('3D_HERO');
  const [aiBriefingText, setAiBriefingText] = useState<string | null>(null);
  const [isAiBriefingLoading, setIsAiBriefingLoading] = useState<boolean>(false);

  // Sync state when switching cyclone preset
  const handleSelectPreset = (preset: CycloneHistoricalPreset) => {
    setSelectedPresetId(preset.id);
    setWindKts(preset.baseWindKts);
    setSpeedKmh(preset.baseSpeedKmh);
    setTrackDistanceKm(preset.baseTrackDistanceKm);
    setRmaxKm(preset.baseRmaxKm);
    setPressureDeficitHpa(preset.basePressureDeficitHpa);
    setInitialMldM(undefined);
    if (preset.recommendedStationId && preset.recommendedStationId !== activeStationId) {
      onSelectStation(preset.recommendedStationId);
    }
  };

  // Reset to current preset baseline
  const handleResetToBaseline = () => {
    setWindKts(activePreset.baseWindKts);
    setSpeedKmh(activePreset.baseSpeedKmh);
    setTrackDistanceKm(activePreset.baseTrackDistanceKm);
    setRmaxKm(activePreset.baseRmaxKm);
    setPressureDeficitHpa(activePreset.basePressureDeficitHpa);
    setInitialMldM(undefined);
  };

  // Package scenario parameters
  const counterfactualParams: CycloneScenarioParams = useMemo(() => {
    return {
      windSpeedKts: windKts,
      speedKmh: speedKmh,
      trackDistanceKm: trackDistanceKm,
      rmaxKm: rmaxKm,
      pressureDeficitHpa: pressureDeficitHpa,
      initialMldM: initialMldM,
      physicsMode: physicsMode,
    };
  }, [windKts, speedKmh, trackDistanceKm, rmaxKm, pressureDeficitHpa, initialMldM, physicsMode]);

  // Is current state diverging from historical baseline?
  const isScenarioActive = useMemo(() => {
    return (
      windKts !== activePreset.baseWindKts ||
      speedKmh !== activePreset.baseSpeedKmh ||
      trackDistanceKm !== activePreset.baseTrackDistanceKm ||
      initialMldM !== undefined
    );
  }, [windKts, speedKmh, trackDistanceKm, initialMldM, activePreset]);

  // Execute Price-Weller-Pinkel Simulation Engine
  const simulationSummary: PWPSimulationSummary = useMemo(() => {
    return runPWPSimulation(stationData, counterfactualParams);
  }, [stationData, counterfactualParams]);

  // 4. Timeline Animation Playback (-72h to +120h)
  const [selectedHour, setSelectedHour] = useState<number>(0); // Default to Landfall T0
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playbackRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      playbackRef.current = window.setInterval(() => {
        setSelectedHour((prev) => {
          if (prev >= 120) return -72;
          return prev + 1;
        });
      }, 380 / playbackSpeed);
    } else if (playbackRef.current) {
      clearInterval(playbackRef.current);
    }

    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Current active timestep data
  const currentTimestep = useMemo(() => {
    return (
      simulationSummary.timesteps.find((t) => t.hour === selectedHour) ||
      simulationSummary.timesteps[0]
    );
  }, [simulationSummary, selectedHour]);

  // Update a single counterfactual parameter
  const handleUpdateParam = (
    key: keyof CycloneScenarioParams,
    value: any
  ) => {
    switch (key) {
      case 'speedKmh':
        setSpeedKmh(value as number);
        break;
      case 'windKts':
        setWindKts(value as number);
        break;
      case 'trackDistanceKm':
        setTrackDistanceKm(value as number);
        break;
      case 'rmaxKm':
        setRmaxKm(value as number);
        break;
      case 'pressureDeficitHpa':
        setPressureDeficitHpa(value as number);
        break;
      case 'initialMldM':
        setInitialMldM(value as number);
        break;
      case 'physicsMode':
        setPhysicsMode(value as 'FIXED_PHYSICS' | 'LEARNED_MIXING');
        break;
    }
  };

  // Generate Tactical AI Physics Briefing
  const handleRequestAiBriefing = async () => {
    setIsAiBriefingLoading(true);
    try {
      const prompt = `Provide a succinct 2-sentence mission-control oceanographic briefing for Cyclone ${activePreset.name} under current parameters:
Forward Speed: ${speedKmh} km/h (Historical: ${activePreset.baseSpeedKmh} km/h)
Max Wind: ${windKts} kts
Track Offset: ${trackDistanceKm} km
Baseline SST: ${simulationSummary.baselineSst.toFixed(1)}°C -> Post-Storm SST: ${simulationSummary.simulatedSst.toFixed(1)}°C (Cooling: ${simulationSummary.deltaSst.toFixed(1)}°C)
Mixed Layer Deepening: +${Math.round(simulationSummary.deltaMld)}m.
Physics Mode: ${physicsMode}. Focus on wind-driven entrainment, shear instability, and cold-wake SST feedback.`;

      const response = await fetch('/api/tactical-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiBriefingText(data.answer || 'Briefing analysis generated.');
      } else {
        const delta = (activePreset.baseSpeedKmh - speedKmh).toFixed(1);
        setAiBriefingText(
          `Station ${stationData.station.name}: Forward translation speed at ${speedKmh} km/h extends wind stress residence time by ${Math.abs(Number(delta))} hrs, intensifying vertical shear entrainment and cooling the mixed layer by ${Math.abs(simulationSummary.deltaSst).toFixed(1)}°C.`
        );
      }
    } catch {
      setAiBriefingText(
        `Station ${stationData.station.name}: PWP simulation yields a peak SST cooling of ${Math.abs(simulationSummary.deltaSst).toFixed(1)}°C with Mixed Layer deepening to ${Math.round(simulationSummary.simulatedMld)}m, reducing oceanic heat potential available to fuel cyclone re-intensification.`
      );
    } finally {
      setIsAiBriefingLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05080D] select-none">
      {/* ========================================================================= */}
      {/* LAYER 0 (DOMINANT FULL-BLEED BACKGROUND CANVAS): 3D EARTH GLOBE           */}
      {/* ========================================================================= */}
      {viewMode === '3D_HERO' ? (
        <div className="absolute inset-0 z-0">
          <CycloneGlobeHero3D
            preset={activePreset}
            params={counterfactualParams}
            stationData={stationData}
            selectedHour={selectedHour}
            isScenarioActive={isScenarioActive}
            onSelectHour={setSelectedHour}
            className="w-full h-full"
          />
        </div>
      ) : (
        /* 2D Geospatial Swath Mode (Alternative Diagnostic) */
        <div className="absolute inset-0 z-0 p-4 pt-16 pb-28 overflow-y-auto bg-[#070D14]">
          <div className="max-w-6xl mx-auto h-[620px] bg-[#0A1119] border border-[#1C2A33] rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2A33] mb-3">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-[#3FE0C7]" />
                <h3 className="font-semibold text-xs text-[#E8EDF0] font-mono">
                  2D GEOSPATIAL SWATH & THERMAL COLD WAKE
                </h3>
              </div>
              <button
                onClick={() => setViewMode('3D_HERO')}
                className="text-xs text-[#3FE0C7] font-mono hover:underline"
              >
                RETURN TO 3D GLOBE HERO
              </button>
            </div>
            <div className="flex-1 w-full h-full rounded-xl overflow-hidden">
              <CycloneMapExplorer
                preset={activePreset}
                params={counterfactualParams}
                stationData={stationData}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
                showPlanner
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LAYER 1 (FLOATING, EDGE-ANCHORED OVERLAYS): NEVER TOUCHING OR SQUEEZING    */}
      {/* ========================================================================= */}

      {/* 1A. Top-Center Mini View & AI Briefing Trigger */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2">
        <button
          onClick={handleRequestAiBriefing}
          disabled={isAiBriefingLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1119]/80 backdrop-blur-md border border-[#3FE0C7]/40 hover:border-[#3FE0C7] text-xs font-mono font-semibold text-[#3FE0C7] rounded-xl transition-all shadow-lg hover:shadow-[0_0_15px_rgba(63,224,199,0.25)]"
          title="Generate tactical physics briefing"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAiBriefingLoading ? 'COMPUTING...' : 'AI BRIEFING'}</span>
        </button>

        {/* View Switcher Tabs (3D Earth vs 2D Swath) */}
        <div className="flex items-center bg-[#0A1119]/85 backdrop-blur-md border border-[#1C2A33] rounded-xl p-0.5 text-xs font-mono">
          <button
            onClick={() => setViewMode('3D_HERO')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
              viewMode === '3D_HERO'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>3D EARTH</span>
          </button>
          <button
            onClick={() => setViewMode('2D_SPATIAL_SWATH')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
              viewMode === '2D_SPATIAL_SWATH'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>2D SWATH</span>
          </button>
        </div>
      </div>

      {/* 1B. AI Briefing Floating Popover (When active) */}
      {aiBriefingText && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-xl w-[90%] bg-[#0A1119]/95 backdrop-blur-xl border border-[#3FE0C7]/60 rounded-2xl shadow-2xl p-4 text-xs font-mono animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#3FE0C7] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#3FE0C7] uppercase mr-2 tracking-wide">
                  TACTICAL AI PHYSICS BRIEFING:
                </span>
                <p className="text-[#E8EDF0] leading-relaxed mt-1">{aiBriefingText}</p>
              </div>
            </div>
            <button
              onClick={() => setAiBriefingText(null)}
              className="text-[#6E8391] hover:text-[#E8EDF0] p-1 rounded hover:bg-[#1C2A33]/50 transition-colors"
              title="Close briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1C. Consolidated Right-Side Panel (Storm Info + Hero SST/MLD + What-If Forcing) */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <CycloneConsolidatedRightPanel
          preset={activePreset}
          availablePresets={HISTORICAL_CYCLONES}
          onSelectPreset={handleSelectPreset}
          params={counterfactualParams}
          onUpdateParam={handleUpdateParam}
          onResetBaseline={handleResetToBaseline}
          isScenarioActive={isScenarioActive}
          physicsMode={physicsMode}
          currentTimestep={currentTimestep}
          summary={simulationSummary}
          stationData={stationData}
          isCrossSectionOpen={isCrossSectionOpen}
          onToggleCrossSection={() => setIsCrossSectionOpen(!isCrossSectionOpen)}
        />
      </div>

      {/* 1D. Collapsible Subsurface Cross-Section Panel (Expands on demand next to right panel) */}
      {isCrossSectionOpen && (
        <div className="absolute top-4 right-[380px] z-20 pointer-events-auto hidden lg:block animate-fadeIn">
          <CycloneSubsurfaceGlassPanel
            currentTimestep={currentTimestep}
            summary={simulationSummary}
            stationData={stationData}
            selectedHour={selectedHour}
            physicsMode={physicsMode}
            onTogglePhysicsMode={() =>
              setPhysicsMode(physicsMode === 'LEARNED_MIXING' ? 'FIXED_PHYSICS' : 'LEARNED_MIXING')
            }
            onClose={() => setIsCrossSectionOpen(false)}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* LAYER 2 (BOTTOM SINGLE UNIFIED TIMELINE STRIP): SCRUBBER + PLAYBACK       */}
      {/* Clears margin on the right for Voice AI Agent (Layer 3)                   */}
      {/* ========================================================================= */}
      <div className="absolute bottom-3 left-4 right-52 max-w-4xl z-20 pointer-events-auto">
        <CycloneTimelineSeismograph
          timesteps={simulationSummary.timesteps}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          playbackSpeed={playbackSpeed}
          onSetPlaybackSpeed={setPlaybackSpeed}
        />
      </div>

      {/* ========================================================================= */}
      {/* LAYER 3: FIXED ISOLATED CORNER FOR VOICE AI AGENT                         */}
      {/* Positioned at fixed bottom-3 right-4 z-50 via TacticalVoiceAgent           */}
      {/* ========================================================================= */}
    </div>
  );
};
