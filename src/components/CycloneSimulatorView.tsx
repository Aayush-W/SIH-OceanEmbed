/**
 * Cyclone Digital Twin & Counterfactual Simulator View
 * Physics-informed upper ocean response simulation using the Price-Weller-Pinkel (PWP) mixed layer model.
 *
 * Pipeline:
 * OceanEmbed Inversion -> Current Ocean State -> Cyclone Digital Twin (What-If Controls) -> PWP Numerical Simulation -> Subsurface Thermal Response
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wind,
  Layers,
  Activity,
  Zap,
  TrendingDown,
  Clock,
  RotateCcw,
  Sparkles,
  Sliders,
  Play,
  Pause,
  HelpCircle,
  Download,
  Flame,
  Waves,
  Compass,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Split,
  ChevronRight,
  Info,
  Maximize2,
  MapPin,
  Globe,
} from 'lucide-react';
import { StationData, SurfaceLayer } from '../types';
import { STATIONS, getStationData } from '../data/oceanData';
import {
  HISTORICAL_CYCLONES,
  CycloneHistoricalPreset,
  CycloneScenarioParams,
  runPWPSimulation,
  PWPSimulationSummary,
  calculateDragCoefficient,
} from '../physics/pwpModel';
import { CycloneMapExplorer } from './CycloneMapExplorer';
import { CycloneTwinHero } from './CycloneTwinHero';

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

  // 2. Cyclone Preset & Counterfactual Parameters
  const [selectedPresetId, setSelectedPresetId] = useState<string>('amphan_2020');
  const activePreset = useMemo(() => {
    return HISTORICAL_CYCLONES.find((c) => c.id === selectedPresetId) || HISTORICAL_CYCLONES[0];
  }, [selectedPresetId]);

  // Counterfactual modifiers
  const [windKts, setWindKts] = useState<number>(activePreset.baseWindKts);
  const [speedKmh, setSpeedKmh] = useState<number>(activePreset.baseSpeedKmh);
  const [trackDistanceKm, setTrackDistanceKm] = useState<number>(activePreset.baseTrackDistanceKm);
  const [rmaxKm, setRmaxKm] = useState<number>(activePreset.baseRmaxKm);
  const [pressureDeficitHpa, setPressureDeficitHpa] = useState<number>(activePreset.basePressureDeficitHpa);

  // Sync with preset when preset changes
  const handleSelectPreset = (preset: CycloneHistoricalPreset) => {
    setSelectedPresetId(preset.id);
    setWindKts(preset.baseWindKts);
    setSpeedKmh(preset.baseSpeedKmh);
    setTrackDistanceKm(preset.baseTrackDistanceKm);
    setRmaxKm(preset.baseRmaxKm);
    setPressureDeficitHpa(preset.basePressureDeficitHpa);
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
  };

  // Quick Counterfactual Experiment Presets
  const applyCounterfactual = (type: 'WIND_PLUS_20' | 'WIND_MINUS_20' | 'SLOWER_30' | 'FASTER_50' | 'STALL' | 'DIRECT_HIT') => {
    switch (type) {
      case 'WIND_PLUS_20':
        setWindKts(Math.round(activePreset.baseWindKts * 1.2));
        break;
      case 'WIND_MINUS_20':
        setWindKts(Math.round(activePreset.baseWindKts * 0.8));
        break;
      case 'SLOWER_30':
        setSpeedKmh(Math.max(3.5, Math.round(activePreset.baseSpeedKmh * 0.7 * 10) / 10));
        break;
      case 'FASTER_50':
        setSpeedKmh(Math.round(activePreset.baseSpeedKmh * 1.5 * 10) / 10);
        break;
      case 'STALL':
        setSpeedKmh(4.5);
        break;
      case 'DIRECT_HIT':
        setTrackDistanceKm(0);
        break;
    }
  };

  // Percentage deviations from baseline
  const windDeltaPct = Math.round(((windKts - activePreset.baseWindKts) / activePreset.baseWindKts) * 100);
  const speedDeltaPct = Math.round(((speedKmh - activePreset.baseSpeedKmh) / activePreset.baseSpeedKmh) * 100);
  const isCounterfactualActive =
    windKts !== activePreset.baseWindKts ||
    speedKmh !== activePreset.baseSpeedKmh ||
    trackDistanceKm !== activePreset.baseTrackDistanceKm ||
    rmaxKm !== activePreset.baseRmaxKm;

  // 3. PWP Simulation Execution
  // Run both Baseline Historical Simulation and Current Counterfactual Simulation
  const baselineSim = useMemo(() => {
    return runPWPSimulation(stationData, {
      windKts: activePreset.baseWindKts,
      speedKmh: activePreset.baseSpeedKmh,
      trackDistanceKm: activePreset.baseTrackDistanceKm,
      rmaxKm: activePreset.baseRmaxKm,
      pressureDeficitHpa: activePreset.basePressureDeficitHpa,
    });
  }, [stationData, activePreset]);

  const counterfactualParams: CycloneScenarioParams = useMemo(() => ({
    windKts,
    speedKmh,
    trackDistanceKm,
    rmaxKm,
    pressureDeficitHpa,
  }), [windKts, speedKmh, trackDistanceKm, rmaxKm, pressureDeficitHpa]);

  const counterfactualSim = useMemo(() => {
    return runPWPSimulation(stationData, counterfactualParams);
  }, [stationData, counterfactualParams]);

  // Current active simulation results (or compare overlay)
  const [showComparisonOverlay, setShowComparisonOverlay] = useState<boolean>(true);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [isPlayingPassage, setIsPlayingPassage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SIMULATION' | 'SPATIAL_MAP' | 'HOVMOLLER' | 'PWP_PHYSICS'>('SIMULATION');
  const [simViewMode, setSimViewMode] = useState<'PROFILE' | 'MAP' | 'SPLIT'>('PROFILE');
  // The map remains usable if a device cannot create the optional WebGL globe.
  const [twinViewMode, setTwinViewMode] = useState<'2D' | '3D' | 'SPLIT'>('SPLIT');
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);

  // Tactical Spoken AI briefing states
  const [isAiBriefingLoading, setIsAiBriefingLoading] = useState<boolean>(false);
  const [aiBriefingText, setAiBriefingText] = useState<string | null>(null);

  // Time scrubber auto-play
  useEffect(() => {
    if (!isPlayingPassage) return;
    const interval = setInterval(() => {
      setSelectedHour((prev) => {
        if (prev >= 48) return -24;
        return prev + 1;
      });
    }, 180);
    return () => clearInterval(interval);
  }, [isPlayingPassage]);

  // Current timestep data based on selectedHour (-24 to +48)
  const currentStep = useMemo(() => {
    return counterfactualSim.timesteps.find((t) => t.hour === selectedHour) || counterfactualSim.timesteps[24];
  }, [counterfactualSim, selectedHour]);

  const baselineStep = useMemo(() => {
    return baselineSim.timesteps.find((t) => t.hour === selectedHour) || baselineSim.timesteps[24];
  }, [baselineSim, selectedHour]);

  // Request AI Tactical spoken intelligence on this counterfactual experiment
  const requestAiBriefing = async () => {
    setIsAiBriefingLoading(true);
    setAiBriefingText(null);
    try {
      const queryPrompt = `Generate a 3-sentence physics analysis of this counterfactual cyclone experiment:
Cyclone: ${activePreset.name} (${activePreset.category}).
Counterfactual Modifications: Wind is ${windDeltaPct >= 0 ? `+${windDeltaPct}%` : `${windDeltaPct}%`} (${windKts} kts), Translation speed is ${speedDeltaPct >= 0 ? `+${speedDeltaPct}%` : `${speedDeltaPct}%`} (${speedKmh} km/h), Track distance: ${trackDistanceKm} km.
PWP Simulation Outcomes:
- Sea Surface Temperature dropped by ${Math.abs(counterfactualSim.deltaSst).toFixed(1)}°C down to ${counterfactualSim.simulatedSst.toFixed(1)}°C.
- Mixed Layer Depth deepened by +${counterfactualSim.deltaMld}m to ${counterfactualSim.simulatedMld}m.
- Upwelling thermocline suction: ${counterfactualSim.upwellingLiftM}m.
- Heat potential: ${counterfactualSim.simulatedTchp.toFixed(1)} kJ/cm².
Explain whether the self-induced cold wake throttles the cyclone or if the storm sustains intensification.`;

      const res = await fetch('/api/tactical-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryPrompt,
          context: {
            stationName: stationData.station.name,
            currentDate,
            sst: counterfactualSim.simulatedSst,
            mld: counterfactualSim.simulatedMld,
          },
        }),
      });

      const data = await res.json();
      if (data.summary) {
        setAiBriefingText(data.summary);
      } else {
        setAiBriefingText(counterfactualSim.feedbackDescription);
      }
    } catch (e) {
      setAiBriefingText(counterfactualSim.feedbackDescription);
    } finally {
      setIsAiBriefingLoading(false);
    }
  };

  // Export CSV of PWP profile and timeseries
  const handleExportCSV = () => {
    let csv = `Depth_m,Baseline_Temp_C,Simulated_Temp_C,Temp_Delta_C\n`;
    counterfactualSim.simulatedProfile.forEach((p, idx) => {
      const baseT = counterfactualSim.baselineProfile[idx]?.temp || 0;
      csv += `${p.depth},${baseT.toFixed(2)},${p.temp.toFixed(2)},${p.delta.toFixed(2)}\n`;
    });
    csv += `\nHour_from_passage,Dist_km,Wind_kts,WindStress_Pa,MLD_m,SST_C,Upwelling_m,TCHP_kJcm2\n`;
    counterfactualSim.timesteps.forEach((t) => {
      csv += `${t.hour},${t.distanceKm},${t.windSpeedKts},${t.windStressPa},${t.mld},${t.sst},${t.upwellingDisplacementM},${t.tchpKjCm2}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PWP_Cyclone_Simulation_${activePreset.id}_${currentDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Chart Dimensions for Vertical Profile
  const chartConfig = useMemo(() => {
    const width = 440;
    const height = 480;
    const padding = { top: 25, right: 30, bottom: 45, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minTemp = 6;
    const maxTemp = 32;
    const minDepth = 0;
    const maxDepth = 500;

    const tempToX = (t: number) => padding.left + ((t - minTemp) / (maxTemp - minTemp)) * chartW;
    const depthToY = (d: number) => padding.top + ((d - minDepth) / (maxDepth - minDepth)) * chartH;

    // Baseline line path
    const baselinePoints = counterfactualSim.baselineProfile.filter((p) => p.depth <= maxDepth);
    const baselinePath = baselinePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp).toFixed(1)},${depthToY(p.depth).toFixed(1)}`)
      .join(' ');

    // Counterfactual simulated line path
    const simPoints = counterfactualSim.simulatedProfile.filter((p) => p.depth <= maxDepth);
    const simPath = simPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp).toFixed(1)},${depthToY(p.depth).toFixed(1)}`)
      .join(' ');

    // Historical baseline simulation line path (for comparison)
    const histPoints = baselineSim.simulatedProfile.filter((p) => p.depth <= maxDepth);
    const histPath = histPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp).toFixed(1)},${depthToY(p.depth).toFixed(1)}`)
      .join(' ');

    // Time-scrubbed dynamic path at selectedHour
    const dynamicPoints = currentStep.profile.filter((p) => p.depth <= maxDepth);
    const dynamicPath = dynamicPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp).toFixed(1)},${depthToY(p.depth).toFixed(1)}`)
      .join(' ');

    return {
      width,
      height,
      padding,
      chartW,
      chartH,
      minTemp,
      maxTemp,
      minDepth,
      maxDepth,
      tempToX,
      depthToY,
      baselinePath,
      simPath,
      histPath,
      dynamicPath,
      baselineMldY: depthToY(counterfactualSim.baselineMld),
      simMldY: depthToY(counterfactualSim.simulatedMld),
      currentMldY: depthToY(currentStep.mld),
    };
  }, [counterfactualSim, baselineSim, currentStep]);

  return (
    <div id="cyclone-simulator-screen" className="simulator-workspace relative w-full h-full bg-[#05080D] select-none overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 font-space">
      {/* 1. Header & Conceptual Pipeline Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1C2A33] mb-5">
        <div>
          <div className="flex items-center gap-2 font-data text-xs text-[#FF8A5B] tracking-widest uppercase">
            <Wind className="w-4 h-4 text-[#FF8A5B] animate-spin-slow" />
            <span>PRICE-WELLER-PINKEL (PWP) MODEL // CYCLONE DIGITAL TWIN</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#E8EDF0] tracking-wide uppercase mt-1">
            What-If Cyclone & Subsurface Simulator
          </h1>
          <p className="text-xs text-[#6E8391] font-sans mt-0.5 max-w-3xl">
            Reconstruct baseline ocean stratification with OceanEmbed, then inject counterfactual cyclone conditions (wind stress, translation speed, track offset) to simulate physical mixed-layer deepening, upwelling, and cold wake response.
          </p>
        </div>

        {/* View Mode Tabs & Actions */}
        <div className="simulator-actions flex items-center gap-2">
          <div className="simulator-tabs flex items-center bg-[#0A1119] border border-[#1C2A33] p-1 gap-1">
            <button
              onClick={() => setActiveTab('SIMULATION')}
              className={`px-3 py-1.5 font-data text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'SIMULATION'
                  ? 'bg-[#FF8A5B] text-[#05080D] font-bold shadow-md'
                  : 'text-[#6E8391] hover:text-[#E8EDF0]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>PWP SIMULATOR</span>
            </button>

            <button
              onClick={() => setActiveTab('SPATIAL_MAP')}
              className={`px-3 py-1.5 font-data text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'SPATIAL_MAP'
                  ? 'bg-[#FF8A5B] text-[#05080D] font-bold shadow-md'
                  : 'text-[#6E8391] hover:text-[#E8EDF0]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GEOSPATIAL TRACK & WAKE MAP</span>
            </button>

            <button
              onClick={() => setActiveTab('HOVMOLLER')}
              className={`px-3 py-1.5 font-data text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'HOVMOLLER'
                  ? 'bg-[#FF8A5B] text-[#05080D] font-bold shadow-md'
                  : 'text-[#6E8391] hover:text-[#E8EDF0]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>HOVMÖLLER TIME GRID</span>
            </button>

            <button
              onClick={() => setActiveTab('PWP_PHYSICS')}
              className={`px-3 py-1.5 font-data text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'PWP_PHYSICS'
                  ? 'bg-[#FF8A5B] text-[#05080D] font-bold shadow-md'
                  : 'text-[#6E8391] hover:text-[#E8EDF0]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>PWP PHYSICS THEORY</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="p-2 bg-[#0A1119] border border-[#1C2A33] text-[#6E8391] hover:text-[#3FE0C7] hover:border-[#3FE0C7] transition-all"
            title="Export Simulation Data (CSV)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Pipeline Breadcrumb / Architectural Visualizer */}
      <div className="simulation-pipeline-shell liquid-glass bg-[#0A1119] border border-[#1C2A33] p-3 mb-5">
        <div className="simulation-pipeline flex items-center justify-between text-xs font-data">
          {/* Step 1 */}
          <div className="pipeline-step flex items-center gap-2 text-[#3FE0C7]">
            <div className="w-5 h-5 rounded-none bg-[#3FE0C7]/20 border border-[#3FE0C7] flex items-center justify-center font-bold text-[10px]">
              1
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">OceanEmbed Model</div>
              <div className="text-[10px] text-[#6E8391]">Satellite Inversion</div>
            </div>
          </div>
          <ChevronRight className="pipeline-arrow w-4 h-4 text-[#1C2A33]" />

          {/* Step 2 */}
          <div className="pipeline-step flex items-center gap-2 text-[#3FE0C7]">
            <div className="w-5 h-5 rounded-none bg-[#3FE0C7]/20 border border-[#3FE0C7] flex items-center justify-center font-bold text-[10px]">
              2
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">Current Ocean State</div>
              <div className="text-[10px] text-[#6E8391]">SST {counterfactualSim.baselineSst}°C · MLD {counterfactualSim.baselineMld}m</div>
            </div>
          </div>
          <ChevronRight className="pipeline-arrow w-4 h-4 text-[#1C2A33]" />

          {/* Step 3 */}
          <div className="pipeline-step flex items-center gap-2 text-[#FF8A5B]">
            <div className="w-5 h-5 rounded-none bg-[#FF8A5B]/20 border border-[#FF8A5B] flex items-center justify-center font-bold text-[10px]">
              3
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">Cyclone Digital Twin</div>
              <div className="text-[10px] text-[#6E8391]">Counterfactual What-Ifs</div>
            </div>
          </div>
          <ChevronRight className="pipeline-arrow w-4 h-4 text-[#1C2A33]" />

          {/* Step 4 */}
          <div className="pipeline-step flex items-center gap-2 text-[#FF8A5B]">
            <div className="w-5 h-5 rounded-none bg-[#FF8A5B]/20 border border-[#FF8A5B] flex items-center justify-center font-bold text-[10px]">
              4
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">PWP Physics Solver</div>
              <div className="text-[10px] text-[#6E8391]">Ri_b Entrainment & Ekman Suction</div>
            </div>
          </div>
          <ChevronRight className="pipeline-arrow w-4 h-4 text-[#1C2A33]" />

          {/* Step 5 */}
          <div className="pipeline-step flex items-center gap-2 text-[#E8EDF0]">
            <div className="w-5 h-5 rounded-none bg-[#E8EDF0]/20 border border-[#E8EDF0] flex items-center justify-center font-bold text-[10px]">
              5
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">Subsurface Response</div>
              <div className="text-[10px] text-[#FF8A5B]">ΔSST {counterfactualSim.deltaSst}°C · ΔMLD +{counterfactualSim.deltaMld}m</div>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'SIMULATION' && (
        <>
        <CycloneTwinHero
          preset={activePreset}
          params={counterfactualParams}
          stationData={stationData}
          selectedHour={selectedHour}
          simulation={counterfactualSim}
          viewMode={twinViewMode}
          isPlaying={isPlayingPassage}
          onViewModeChange={setTwinViewMode}
          onHourChange={setSelectedHour}
          onTogglePlayback={() => setIsPlayingPassage((playing) => !playing)}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          {/* Left Column: Station Selector & Cyclone Digital Twin Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Step 1 & 2: Ocean State Baseline */}
            <div className="bg-[#0A1119] border border-[#1C2A33] p-4 relative">
              <div className="corner-bracket corner-tl"></div>
              <div className="corner-bracket corner-tr"></div>

              <div className="flex items-center justify-between mb-2">
                <div className="font-data text-[10px] text-[#3FE0C7] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#3FE0C7] rounded-full"></span>
                  <span>1. OCEANEMBED WATER COLUMN RECONSTRUCTION</span>
                </div>
                <span className="font-data text-[10px] text-[#6E8391]">{currentDate}</span>
              </div>

              {/* Station Picker */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                {STATIONS.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onSelectStation(st.id)}
                    className={`p-1.5 text-left border font-data text-[10px] uppercase transition-all ${
                      activeStationId === st.id
                        ? 'bg-[#3FE0C7]/15 text-[#3FE0C7] border-[#3FE0C7] font-bold'
                        : 'bg-[#05080D] text-[#6E8391] border-[#1C2A33] hover:text-[#E8EDF0]'
                    }`}
                  >
                    <div className="truncate">{st.name.split('/')[0].replace('Central ', '')}</div>
                    <div className="text-[9px] text-[#6E8391]">{st.lat}°N, {st.lon}°E</div>
                  </button>
                ))}
              </div>

              {/* Current Reconstructed Baseline Stats */}
              <div className="grid grid-cols-3 gap-2 p-2 bg-[#05080D] border border-[#1C2A33] font-data text-center">
                <div>
                  <div className="text-[9px] text-[#6E8391] uppercase">Baseline SST</div>
                  <div className="text-sm font-bold text-[#3FE0C7]">{counterfactualSim.baselineSst.toFixed(1)}°C</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6E8391] uppercase">Baseline MLD</div>
                  <div className="text-sm font-bold text-[#E8EDF0]">{counterfactualSim.baselineMld}m</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6E8391] uppercase">Base TCHP</div>
                  <div className="text-sm font-bold text-[#FFB800]">{counterfactualSim.baselineTchp.toFixed(1)} <span className="text-[9px]">kJ/cm²</span></div>
                </div>
              </div>
            </div>

            {/* Step 3: Cyclone Digital Twin & Counterfactual Controls */}
            <div className="bg-[#0A1119] border border-[#1C2A33] p-4 relative">
              <div className="corner-bracket corner-tl"></div>
              <div className="corner-bracket corner-tr"></div>

              <div className="flex items-center justify-between mb-2">
                <div className="font-data text-[10px] text-[#FF8A5B] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[#FF8A5B]" />
                  <span>2. CYCLONE DIGITAL TWIN (WHAT-IF MODIFIERS)</span>
                </div>
                {isCounterfactualActive && (
                  <button
                    onClick={handleResetToBaseline}
                    className="flex items-center gap-1 font-data text-[9px] text-[#FF8A5B] hover:text-[#E8EDF0] border border-[#FF8A5B]/40 px-2 py-0.5 uppercase transition-all"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset Baseline</span>
                  </button>
                )}
              </div>

              {/* Preset Selector */}
              <div className="mb-4">
                <div className="font-data text-[9px] text-[#6E8391] uppercase mb-1">Select Cyclone Archetype:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {HISTORICAL_CYCLONES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectPreset(c)}
                      className={`p-1.5 text-left border font-data text-[10px] uppercase transition-all ${
                        selectedPresetId === c.id
                          ? 'bg-[#FF8A5B]/15 text-[#FF8A5B] border-[#FF8A5B] font-bold'
                          : 'bg-[#05080D] text-[#6E8391] border-[#1C2A33] hover:text-[#E8EDF0]'
                      }`}
                    >
                      <div className="truncate font-semibold">{c.name.replace('Extremely Severe ', '').replace('Super ', '')}</div>
                      <div className="text-[9px] text-[#6E8391]">{c.baseWindKts}kt · {c.baseSpeedKmh}km/h</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* One-Click Counterfactual "What-If" Buttons */}
              <div className="mb-4">
                <div className="font-data text-[9px] text-[#6E8391] uppercase mb-1 flex items-center justify-between">
                  <span>Quick Counterfactual Scenarios:</span>
                  <span className="text-[#FF8A5B] text-[9px]">Click to Test</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => applyCounterfactual('WIND_PLUS_20')}
                    className="p-1.5 bg-[#05080D] border border-[#1C2A33] hover:border-[#FF8A5B] hover:text-[#FF8A5B] text-[#E8EDF0] font-data text-[10px] text-left transition-all flex items-center justify-between"
                  >
                    <span>🌪️ Wind +20% Stronger</span>
                    <span className="text-[#FF8A5B] font-bold">+20%</span>
                  </button>

                  <button
                    onClick={() => applyCounterfactual('SLOWER_30')}
                    className="p-1.5 bg-[#05080D] border border-[#1C2A33] hover:border-[#FF8A5B] hover:text-[#FF8A5B] text-[#E8EDF0] font-data text-[10px] text-left transition-all flex items-center justify-between"
                  >
                    <span>🐢 Moves 30% Slower</span>
                    <span className="text-[#FF8A5B] font-bold">-30%</span>
                  </button>

                  <button
                    onClick={() => applyCounterfactual('STALL')}
                    className="p-1.5 bg-[#05080D] border border-[#1C2A33] hover:border-[#FF8A5B] hover:text-[#FF8A5B] text-[#E8EDF0] font-data text-[10px] text-left transition-all flex items-center justify-between"
                  >
                    <span>⚓ Extreme Stall (4.5 km/h)</span>
                    <span className="text-[#FF8A5B] font-bold">STALL</span>
                  </button>

                  <button
                    onClick={() => applyCounterfactual('DIRECT_HIT')}
                    className="p-1.5 bg-[#05080D] border border-[#1C2A33] hover:border-[#FF8A5B] hover:text-[#FF8A5B] text-[#E8EDF0] font-data text-[10px] text-left transition-all flex items-center justify-between"
                  >
                    <span>🎯 Eyewall Direct (0 km)</span>
                    <span className="text-[#FF8A5B] font-bold">0 km</span>
                  </button>
                </div>
              </div>

              {/* Precision Sliders */}
              <div className="space-y-3 pt-2 border-t border-[#1C2A33]">
                {/* 1. Maximum Wind Speed */}
                <div>
                  <div className="flex justify-between items-center text-xs font-data mb-1">
                    <span className="text-[#6E8391]">Sustained Wind (V_max):</span>
                    <div className="flex items-center gap-2">
                      {windDeltaPct !== 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 border ${
                          windDeltaPct > 0 ? 'bg-[#FF8A5B]/20 text-[#FF8A5B] border-[#FF8A5B]' : 'bg-[#3FE0C7]/20 text-[#3FE0C7] border-[#3FE0C7]'
                        }`}>
                          {windDeltaPct > 0 ? `+${windDeltaPct}%` : `${windDeltaPct}%`}
                        </span>
                      )}
                      <span className="font-bold text-[#E8EDF0]">{windKts} kts <span className="text-[#6E8391] font-normal">({Math.round(windKts * 1.852)} km/h)</span></span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={175}
                    step={5}
                    value={windKts}
                    onChange={(e) => setWindKts(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#05080D] accent-[#FF8A5B] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-data text-[#6E8391] mt-0.5">
                    <span>40 kts (Depression)</span>
                    <span>115 kts (Cat 4)</span>
                    <span>175 kts (Super Cyclone)</span>
                  </div>
                </div>

                {/* 2. Forward Translation Speed */}
                <div>
                  <div className="flex justify-between items-center text-xs font-data mb-1">
                    <span className="text-[#6E8391]">Translation Speed (V_h):</span>
                    <div className="flex items-center gap-2">
                      {speedDeltaPct !== 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 border ${
                          speedDeltaPct < 0 ? 'bg-[#FF8A5B]/20 text-[#FF8A5B] border-[#FF8A5B]' : 'bg-[#3FE0C7]/20 text-[#3FE0C7] border-[#3FE0C7]'
                        }`}>
                          {speedDeltaPct > 0 ? `+${speedDeltaPct}% faster` : `${speedDeltaPct}% slower`}
                        </span>
                      )}
                      <span className="font-bold text-[#E8EDF0]">{speedKmh.toFixed(1)} km/h</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={35}
                    step={0.5}
                    value={speedKmh}
                    onChange={(e) => setSpeedKmh(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#05080D] accent-[#FF8A5B] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-data text-[#6E8391] mt-0.5">
                    <span>3 km/h (Catastrophic Stall)</span>
                    <span>15 km/h (Average)</span>
                    <span>35 km/h (Rapid)</span>
                  </div>
                </div>

                {/* 3. Track Distance Offset */}
                <div>
                  <div className="flex justify-between items-center text-xs font-data mb-1">
                    <span className="text-[#6E8391]">Track Offset to Station:</span>
                    <span className="font-bold text-[#E8EDF0]">{trackDistanceKm} km {trackDistanceKm === 0 ? '(Eye Direct)' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={5}
                    value={trackDistanceKm}
                    onChange={(e) => setTrackDistanceKm(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#05080D] accent-[#FF8A5B] cursor-pointer"
                  />
                </div>

                {/* 4. Radius of Max Winds */}
                <div>
                  <div className="flex justify-between items-center text-xs font-data mb-1">
                    <span className="text-[#6E8391]">Radius of Max Wind (R_max):</span>
                    <span className="font-bold text-[#E8EDF0]">{rmaxKm} km</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={75}
                    step={5}
                    value={rmaxKm}
                    onChange={(e) => setRmaxKm(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#05080D] accent-[#FF8A5B] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* AI Spoken Tactical Briefing Button */}
            <div className="bg-[#0A1119] border border-[#1C2A33] p-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#3FE0C7]" />
                  <span className="font-data text-xs text-[#E8EDF0] font-semibold uppercase">Tactical AI Analysis</span>
                </div>
                <button
                  onClick={requestAiBriefing}
                  disabled={isAiBriefingLoading}
                  className="px-3 py-1 bg-[#3FE0C7] text-[#05080D] font-data text-xs font-bold uppercase tracking-wider hover:bg-[#76d0bc] transition-all disabled:opacity-50"
                >
                  {isAiBriefingLoading ? 'Synthesizing...' : 'Assess What-If'}
                </button>
              </div>
              {aiBriefingText && (
                <div className="mt-2 p-2.5 bg-[#05080D] border border-[#3FE0C7]/40 text-xs text-[#E8EDF0] font-sans leading-relaxed">
                  <div className="font-data text-[9px] text-[#3FE0C7] uppercase tracking-wider mb-1 font-bold">
                    AEGIS // PHYSICAL ASSESSMENT:
                  </div>
                  {aiBriefingText}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visualizations & Ocean Response Metrics (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Top Stat Cards: Predicted Subsurface Response */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Stat 1: SST Cold Wake */}
              <div className="bg-[#0A1119] border border-[#1C2A33] p-3 relative">
                <div className="corner-bracket-coral-br absolute w-2 h-2"></div>
                <div className="font-data text-[9px] text-[#6E8391] uppercase">Surface Cold Wake</div>
                <div className="text-xl font-bold font-data text-[#FF8A5B] mt-0.5">
                  {counterfactualSim.deltaSst > 0 ? `+${counterfactualSim.deltaSst}` : counterfactualSim.deltaSst}°C
                </div>
                <div className="font-data text-[9px] text-[#6E8391] mt-0.5">
                  {counterfactualSim.baselineSst.toFixed(1)}°C → <span className="text-[#E8EDF0] font-bold">{counterfactualSim.simulatedSst.toFixed(1)}°C</span>
                </div>
              </div>

              {/* Stat 2: Mixed Layer Deepening */}
              <div className="bg-[#0A1119] border border-[#1C2A33] p-3 relative">
                <div className="corner-bracket-cyan-tl absolute w-2 h-2"></div>
                <div className="font-data text-[9px] text-[#6E8391] uppercase">Mixed Layer Deepening</div>
                <div className="text-xl font-bold font-data text-[#3FE0C7] mt-0.5">
                  +{counterfactualSim.deltaMld}m
                </div>
                <div className="font-data text-[9px] text-[#6E8391] mt-0.5">
                  {counterfactualSim.baselineMld}m → <span className="text-[#E8EDF0] font-bold">{counterfactualSim.simulatedMld}m</span>
                </div>
              </div>

              {/* Stat 3: Upwelling Lift */}
              <div className="bg-[#0A1119] border border-[#1C2A33] p-3">
                <div className="font-data text-[9px] text-[#6E8391] uppercase">Ekman Suction Lift</div>
                <div className="text-xl font-bold font-data text-[#E8EDF0] mt-0.5">
                  +{counterfactualSim.upwellingLiftM}m
                </div>
                <div className="font-data text-[9px] text-[#6E8391] mt-0.5">
                  Thermocline displacement
                </div>
              </div>

              {/* Stat 4: TCHP Depleted */}
              <div className="bg-[#0A1119] border border-[#1C2A33] p-3">
                <div className="font-data text-[9px] text-[#6E8391] uppercase">Heat Potential Change</div>
                <div className="text-xl font-bold font-data text-[#FFB800] mt-0.5">
                  {counterfactualSim.deltaTchpPct}%
                </div>
                <div className="font-data text-[9px] text-[#6E8391] mt-0.5">
                  {counterfactualSim.simulatedTchp.toFixed(1)} kJ/cm²
                </div>
              </div>
            </div>

            {/* Ocean-Cyclone Feedback Diagnosis Banner */}
            <div className={`p-3 border font-data text-xs flex items-start gap-3 ${
              counterfactualSim.feedbackType === 'STRONG_NEGATIVE'
                ? 'bg-[#FF8A5B]/10 border-[#FF8A5B] text-[#FF8A5B]'
                : counterfactualSim.feedbackType === 'MODERATE_NEGATIVE'
                ? 'bg-[#FFB800]/10 border-[#FFB800] text-[#FFB800]'
                : 'bg-[#3FE0C7]/10 border-[#3FE0C7] text-[#3FE0C7]'
            }`}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold tracking-wider uppercase mb-0.5">
                  {counterfactualSim.feedbackTitle}
                </div>
                <div className="text-[11px] text-[#E8EDF0] font-sans leading-relaxed">
                  {counterfactualSim.feedbackDescription}
                </div>
              </div>
            </div>

            {/* Storm Passage Timeline Scrubber */}
            <div className="bg-[#0A1119] border border-[#1C2A33] p-3">
              <div className="flex items-center justify-between mb-1.5 font-data text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlayingPassage(!isPlayingPassage)}
                    className="p-1 bg-[#FF8A5B] text-[#05080D] hover:bg-[#76d0bc] transition-all"
                    title={isPlayingPassage ? 'Pause animation' : 'Play passage animation'}
                  >
                    {isPlayingPassage ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[#6E8391] uppercase text-[10px]">Storm Passage Timeline:</span>
                  <span className="font-bold text-[#E8EDF0]">
                    {selectedHour === 0 ? 'T = 0h (Eye / Closest Approach)' : selectedHour < 0 ? `T ${selectedHour}h (Approaching)` : `T +${selectedHour}h (Wake / Wake Relaxation)`}
                  </span>
                </div>
                <div className="text-[10px] text-[#6E8391]">
                  Wind Stress: <span className="text-[#FF8A5B] font-bold">{currentStep.windStressPa.toFixed(2)} Pa</span> · Local Wind: <span className="text-[#E8EDF0] font-bold">{currentStep.windSpeedKts} kts</span>
                </div>
              </div>

              <input
                type="range"
                min={-24}
                max={48}
                step={1}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="w-full h-2 bg-[#05080D] accent-[#FF8A5B] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-data text-[#6E8391] mt-1">
                <span>T -24h (Ambient)</span>
                <span>T -6h (Gale Influx)</span>
                <span className="text-[#FF8A5B] font-bold">T=0h (Peak Eye Passage)</span>
                <span>T +12h (Max Mixing)</span>
                <span>T +48h (Relaxation)</span>
              </div>
            </div>

            {/* Main Interactive Upper Ocean Response: Vertical Profile and/or Geospatial Map */}
            <div className="bg-[#0A1119] border border-[#1C2A33] p-4 relative">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="font-data text-[10px] text-[#6E8391] uppercase tracking-widest font-semibold flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#3FE0C7]" />
                  <span>UPPER OCEAN RESPONSE // {simViewMode === 'PROFILE' ? '0–500m VERTICAL THERMAL PROFILE' : 'GEOSPATIAL TRACK & COLD WAKE MAP'}</span>
                </div>

                {/* View Switcher & Graph Legend */}
                <div className="flex items-center gap-3 font-data text-[10px]">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#05080D] border border-[#1C2A33] p-0.5">
                    <button
                      onClick={() => setSimViewMode('PROFILE')}
                      className={`px-2 py-0.5 text-[10px] uppercase font-mono transition-colors ${
                        simViewMode === 'PROFILE'
                          ? 'bg-[#1C2A33] text-[#3FE0C7] font-bold'
                          : 'text-[#6E8391] hover:text-[#E8EDF0]'
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => setSimViewMode('MAP')}
                      className={`px-2 py-0.5 text-[10px] uppercase font-mono transition-colors flex items-center gap-1 ${
                        simViewMode === 'MAP'
                          ? 'bg-[#1C2A33] text-[#FF8A5B] font-bold'
                          : 'text-[#6E8391] hover:text-[#E8EDF0]'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Map</span>
                    </button>
                  </div>

                  {simViewMode === 'PROFILE' && (
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[#3FE0C7]"></span>
                        <span className="text-[#3FE0C7]">OceanEmbed Baseline</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[#FF8A5B]"></span>
                        <span className="text-[#FF8A5B] font-bold">What-If Simulated</span>
                      </div>
                      {isCounterfactualActive && showComparisonOverlay && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 border-b border-dashed border-[#FFB800]"></span>
                          <span className="text-[#FFB800]">Historical Storm Baseline</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Map or Profile Body */}
              {simViewMode === 'MAP' ? (
                <div className="w-full h-[490px] border border-[#1C2A33] overflow-hidden">
                  <CycloneMapExplorer
                    preset={activePreset}
                    params={counterfactualParams}
                    stationData={stationData}
                    selectedHour={selectedHour}
                    onSelectHour={(h) => setSelectedHour(h)}
                    onSelectStation={(stId) => onSelectStation(stId)}
                  />
                </div>
              ) : (
                <>

              {/* SVG Chart */}
              <div className="relative w-full flex justify-center overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                  className="w-full max-w-[540px] h-auto overflow-visible select-none"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const scaleY = chartConfig.height / rect.height;
                    const svgY = y * scaleY;
                    const depth = Math.max(0, Math.min(500, Math.round(((svgY - chartConfig.padding.top) / chartConfig.chartH) * 500)));
                    setHoverDepth(depth);
                  }}
                  onMouseLeave={() => setHoverDepth(null)}
                >
                  <defs>
                    <linearGradient id="entrainmentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3FE0C7" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#FF8A5B" stopOpacity="0.35" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines & Axis */}
                  {/* Temperature horizontal grid */}
                  {[10, 15, 20, 25, 30].map((t) => {
                    const x = chartConfig.tempToX(t);
                    return (
                      <g key={t}>
                        <line
                          x1={x}
                          y1={chartConfig.padding.top}
                          x2={x}
                          y2={chartConfig.height - chartConfig.padding.bottom}
                          stroke="#1C2A33"
                          strokeDasharray="2,2"
                        />
                        <text
                          x={x}
                          y={chartConfig.height - chartConfig.padding.bottom + 18}
                          fill="#6E8391"
                          fontSize="10"
                          fontFamily="JetBrains Mono"
                          textAnchor="middle"
                        >
                          {t}°C
                        </text>
                      </g>
                    );
                  })}

                  {/* Depth vertical grid */}
                  {[0, 50, 100, 150, 200, 300, 400, 500].map((d) => {
                    const y = chartConfig.depthToY(d);
                    return (
                      <g key={d}>
                        <line
                          x1={chartConfig.padding.left}
                          y1={y}
                          x2={chartConfig.width - chartConfig.padding.right}
                          y2={y}
                          stroke="#1C2A33"
                          strokeDasharray="2,2"
                        />
                        <text
                          x={chartConfig.padding.left - 10}
                          y={y + 3}
                          fill="#6E8391"
                          fontSize="10"
                          fontFamily="JetBrains Mono"
                          textAnchor="end"
                        >
                          {d}m
                        </text>
                      </g>
                    );
                  })}

                  {/* Entrainment Deepening Shaded Zone */}
                  <rect
                    x={chartConfig.padding.left}
                    y={chartConfig.baselineMldY}
                    width={chartConfig.chartW}
                    height={Math.max(2, chartConfig.simMldY - chartConfig.baselineMldY)}
                    fill="url(#entrainmentGrad)"
                    stroke="#FF8A5B"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity={0.6}
                  />
                  <text
                    x={chartConfig.width - chartConfig.padding.right - 10}
                    y={(chartConfig.baselineMldY + chartConfig.simMldY) / 2 + 3}
                    fill="#FF8A5B"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    textAnchor="end"
                  >
                    PWP Entrainment Zone (+{counterfactualSim.deltaMld}m)
                  </text>

                  {/* Baseline Profile Line */}
                  <path
                    d={chartConfig.baselinePath}
                    fill="none"
                    stroke="#3FE0C7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Historical Baseline Simulation Line (if in counterfactual mode) */}
                  {isCounterfactualActive && showComparisonOverlay && (
                    <path
                      d={chartConfig.histPath}
                      fill="none"
                      stroke="#FFB800"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      strokeOpacity="0.8"
                    />
                  )}

                  {/* Counterfactual Final Simulated Profile Line */}
                  <path
                    d={chartConfig.simPath}
                    fill="none"
                    stroke="#FF8A5B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Timestep Scrub Dynamic Profile Line */}
                  {selectedHour !== 48 && (
                    <path
                      d={chartConfig.dynamicPath}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                      opacity="0.75"
                    />
                  )}

                  {/* Baseline MLD Marker */}
                  <line
                    x1={chartConfig.padding.left}
                    y1={chartConfig.baselineMldY}
                    x2={chartConfig.padding.left + 70}
                    y2={chartConfig.baselineMldY}
                    stroke="#3FE0C7"
                    strokeWidth="2"
                  />
                  <text
                    x={chartConfig.padding.left + 75}
                    y={chartConfig.baselineMldY + 3}
                    fill="#3FE0C7"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                  >
                    Base MLD: {counterfactualSim.baselineMld}m
                  </text>

                  {/* Post-Cyclone MLD Marker */}
                  <line
                    x1={chartConfig.padding.left}
                    y1={chartConfig.simMldY}
                    x2={chartConfig.padding.left + 70}
                    y2={chartConfig.simMldY}
                    stroke="#FF8A5B"
                    strokeWidth="2"
                  />
                  <text
                    x={chartConfig.padding.left + 75}
                    y={chartConfig.simMldY + 3}
                    fill="#FF8A5B"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    Simulated MLD: {counterfactualSim.simulatedMld}m
                  </text>

                  {/* Hover inspection cursor */}
                  {hoverDepth !== null && (
                    <g>
                      <line
                        x1={chartConfig.padding.left}
                        y1={chartConfig.depthToY(hoverDepth)}
                        x2={chartConfig.width - chartConfig.padding.right}
                        y2={chartConfig.depthToY(hoverDepth)}
                        stroke="#E8EDF0"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                    </g>
                  )}
                </svg>

                {/* Hover Depth Tooltip readout */}
                {hoverDepth !== null && (
                  <div className="absolute top-2 right-2 bg-[#05080D]/95 border border-[#1C2A33] p-2 font-data text-[10px] space-y-0.5 pointer-events-none shadow-xl">
                    <div className="text-[#6E8391] font-semibold">DEPTH: {hoverDepth}m</div>
                    <div className="text-[#3FE0C7]">
                      Baseline: {counterfactualSim.baselineProfile.find((p) => p.depth >= hoverDepth)?.temp.toFixed(2)}°C
                    </div>
                    <div className="text-[#FF8A5B] font-bold">
                      Simulated: {counterfactualSim.simulatedProfile.find((p) => p.depth >= hoverDepth)?.temp.toFixed(2)}°C
                    </div>
                    <div className="text-[#E8EDF0]">
                      ΔT: {(counterfactualSim.simulatedProfile.find((p) => p.depth >= hoverDepth)?.temp! - counterfactualSim.baselineProfile.find((p) => p.depth >= hoverDepth)?.temp!).toFixed(2)}°C
                    </div>
                  </div>
                )}
              </div>

              {/* Subsurface Heat Redistribution Dipole explanation */}
              <div className="mt-3 p-2 bg-[#05080D] border border-[#1C2A33] font-data text-[10px] text-[#6E8391] flex items-center justify-between">
                <span>
                  <strong className="text-[#FF8A5B]">Near-Surface (0–{counterfactualSim.baselineMld}m):</strong> Cooled by {Math.abs(counterfactualSim.deltaSst).toFixed(1)}°C
                </span>
                <span>
                  <strong className="text-[#3FE0C7]">Pycnocline ({counterfactualSim.baselineMld}–{counterfactualSim.simulatedMld}m):</strong> Heat mixed downward
                </span>
                <span>
                  <strong className="text-[#E8EDF0]">Deep Abyss (&gt;250m):</strong> Lifted +{counterfactualSim.upwellingLiftM}m by upwelling
                </span>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {/* 2. DEDICATED GEOSPATIAL MAP & COLD WAKE SCREEN */}
      {activeTab === 'SPATIAL_MAP' && (
        <div className="bg-[#0A1119] border border-[#1C2A33] p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1C2A33]">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#FF8A5B]">
                <MapPin className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider">PWP SPATIAL SIMULATION // TRACK & COLD WAKE FOOTPRINT</span>
              </div>
              <p className="text-xs text-[#6E8391] font-sans mt-0.5">
                Physical geospatial footprint of {activePreset.name}: Right-biased cold wake thermal anomaly (ΔSST) formed by inertial resonance wind mixing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToMap && (
                <button
                  onClick={onNavigateToMap}
                  className="px-3 py-1.5 bg-[#1C2A33] text-[#3FE0C7] border border-[#3FE0C7]/40 text-xs font-mono flex items-center gap-1.5 hover:bg-[#3FE0C7] hover:text-[#05080D] transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>OPEN IN BASIN SATELLITE MAP</span>
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-[640px] border border-[#1C2A33] overflow-hidden">
            <CycloneMapExplorer
              preset={activePreset}
              params={counterfactualParams}
              stationData={stationData}
              selectedHour={selectedHour}
              onSelectHour={(h) => setSelectedHour(h)}
              onSelectStation={(stId) => onSelectStation(stId)}
            />
          </div>
        </div>
      )}

      {/* 3. HOVMÖLLER DEPTH VS TIME GRID */}
      {activeTab === 'HOVMOLLER' && (
        <div className="bg-[#0A1119] border border-[#1C2A33] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold font-data text-[#E8EDF0] uppercase tracking-wider">
                Hovmöller Depth–Time Thermal Evolution (0 to 200m depth × 72 hours)
              </h2>
              <p className="text-xs text-[#6E8391] font-sans mt-0.5">
                Tracks the hour-by-hour vertical propagation of wind shear, isothermal mixing, and post-storm cold wake relaxation.
              </p>
            </div>
            <div className="flex items-center gap-2 font-data text-[10px] text-[#6E8391]">
              <span>Cold (18°C)</span>
              <div className="w-24 h-2 temp-gradient border border-[#1C2A33]"></div>
              <span>Warm (31°C)</span>
            </div>
          </div>

          {/* Hovmöller Matrix Heatmap */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px] border border-[#1C2A33] p-2 bg-[#05080D]">
              <div className="grid grid-cols-12 gap-1 text-[9px] font-data text-[#6E8391] mb-1">
                <div>Depth \ Hour</div>
                <div className="col-span-2">T -24h (Approach)</div>
                <div className="col-span-3">T -6h to T 0h (Eye Passage)</div>
                <div className="col-span-3">T +1h to T +18h (Entrainment)</div>
                <div className="col-span-3">T +24h to T +48h (Wake)</div>
              </div>

              {/* Depth Rows */}
              {[0, 15, 30, 45, 60, 80, 100, 130, 160, 200].map((depth) => (
                <div key={depth} className="flex items-center h-6 border-b border-[#1C2A33]/50">
                  <div className="w-16 font-data text-[10px] text-[#6E8391]">{depth}m</div>
                  <div className="flex-1 flex h-full">
                    {counterfactualSim.timesteps.filter((_, idx) => idx % 2 === 0).map((ts) => {
                      const temp = ts.profile.find((p) => p.depth >= depth)?.temp || 20;
                      // Color mapping
                      const norm = Math.max(0, Math.min(1, (temp - 18) / (31 - 18)));
                      const r = Math.round(63 + norm * (255 - 63));
                      const g = Math.round(224 + norm * (138 - 224));
                      const b = Math.round(199 + norm * (91 - 199));
                      return (
                        <div
                          key={ts.hour}
                          className="flex-1 h-full hover:opacity-80 transition-opacity cursor-pointer relative group"
                          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
                          title={`T ${ts.hour >= 0 ? `+${ts.hour}` : ts.hour}h · Depth ${depth}m: ${temp.toFixed(1)}°C`}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. PWP PHYSICS THEORY */}
      {activeTab === 'PWP_PHYSICS' && (
        <div className="bg-[#0A1119] border border-[#1C2A33] p-6 space-y-5 max-w-4xl">
          <div className="border-b border-[#1C2A33] pb-3">
            <h2 className="text-base font-bold font-data text-[#3FE0C7] uppercase tracking-wider">
              The Price-Weller-Pinkel (PWP; 1986) Ocean Mixed-Layer Model
            </h2>
            <p className="text-xs text-[#6E8391] font-sans mt-1">
              Theoretical physics underpinning how the upper ocean responds dynamically to cyclonic wind stress, entrainment, and shear instabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-[#E8EDF0] leading-relaxed">
            <div className="p-3 bg-[#05080D] border border-[#1C2A33] space-y-1.5">
              <div className="font-data font-bold text-[#FF8A5B] uppercase text-[11px]">
                1. Bulk Richardson Number (Convective Shear Entrainment)
              </div>
              <p>
                Wind stress transfers momentum into the upper ocean mixed layer. As the layer velocity accelerates, the Bulk Richardson number is calculated:
              </p>
              <div className="p-2 bg-[#0A1119] border border-[#1C2A33] font-data text-[10px] text-[#3FE0C7]">
                Ri_b = (g · Δρ · h) / (ρ_0 · (Δu)²)
              </div>
              <p>
                Whenever <strong>Ri_b &lt; 0.65</strong>, shear instability overcomes stratification. The mixed layer deepens (entrainment velocity w_e), engulfing cold, dense thermocline water until Ri_b re-stabilizes at 0.65.
              </p>
            </div>

            <div className="p-3 bg-[#05080D] border border-[#1C2A33] space-y-1.5">
              <div className="font-data font-bold text-[#3FE0C7] uppercase text-[11px]">
                2. Ekman Pumping & Upwelling Suction
              </div>
              <p>
                Tropical cyclones are intense cyclonic vortices with positive wind stress curl (∇ × τ &gt; 0). This causes divergent Ekman transport in the mixed layer:
              </p>
              <div className="p-2 bg-[#0A1119] border border-[#1C2A33] font-data text-[10px] text-[#3FE0C7]">
                w_E = curl(τ) / (ρ_0 · f)
              </div>
              <p>
                To replace the diverging surface water, deep cold isotherms are sucked upward towards the surface. This cools the subsurface thermocline and brings colder water directly into reach of the mixing layer.
              </p>
            </div>

            <div className="p-3 bg-[#05080D] border border-[#1C2A33] space-y-1.5">
              <div className="font-data font-bold text-[#FFB800] uppercase text-[11px]">
                3. The "What-If" Counterfactual Principle
              </div>
              <p>
                Historical cyclone datasets record only what happened in reality. But in ocean-climate research:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[#6E8391]">
                <li><strong className="text-[#E8EDF0]">"What if winds were 20% stronger?"</strong> → Drastically increases wind stress τ ∝ U² and work W ∝ U³, resulting in deeper entrainment.</li>
                <li><strong className="text-[#E8EDF0]">"What if the cyclone moved 30% slower?"</strong> → Increases residence time t_res ∝ 2 R_max / V_h, allowing wind to mix the same water column for hours longer.</li>
              </ul>
            </div>

            <div className="p-3 bg-[#05080D] border border-[#1C2A33] space-y-1.5">
              <div className="font-data font-bold text-[#E8EDF0] uppercase text-[11px]">
                4. Self-Induced Cold Wake Negative Feedback
              </div>
              <p>
                Hurricanes feed on latent heat flux from warm sea surface water (&gt;26.5°C). When slow translation or intense winds cause extreme mixing, the cyclone creates its own cold wake beneath its eyewall.
              </p>
              <p>
                If SST drops below 26.5°C, the enthalpy fuel is severed, triggering sudden de-intensification. OceanEmbed combined with this PWP twin accurately predicts this critical threshold!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
