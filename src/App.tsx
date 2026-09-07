/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavScreen, SurfaceLayer, GlobeMapStyle } from './types';
import { getStationData } from './data/oceanData';
import { GlobeView } from './components/GlobeView';
import { GlobeHudOverlay } from './components/GlobeHudOverlay';
import { SatelliteMapExplorer, BasemapType } from './components/SatelliteMapExplorer';
import { MLArchitectureView } from './components/MLArchitectureView';
import { CoreSamplePanel } from './components/CoreSamplePanel';
import { CrossSectionView } from './components/CrossSectionView';
import { AlertsFeedView } from './components/AlertsFeedView';
import { CycloneSimulatorView } from './components/CycloneSimulatorView';
import { CollapsibleNav } from './components/CollapsibleNav';
import { TimelineScrubber } from './components/TimelineScrubber';
import { TacticalVoiceAgent } from './components/TacticalVoiceAgent';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('globe');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('2024-08-15');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<SurfaceLayer>('SST');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(false);

  // Globe & Map Styling states (Voice AI controllable + HUD interactive)
  const [globeStyle, setGlobeStyle] = useState<GlobeMapStyle>('SATELLITE');
  const [basemap, setBasemap] = useState<BasemapType>('SATELLITE_HYBRID');
  const [showWaterRaster, setShowWaterRaster] = useState<boolean>(true);
  const [rasterOpacity, setRasterOpacity] = useState<number>(0.72);
  const [showStationMarkers, setShowStationMarkers] = useState<boolean>(true);

  // Selected station data for Core Sample panel
  const selectedStationData = selectedStationId
    ? getStationData(selectedStationId, currentDate, activeLayer)
    : null;

  // Handle station selection from alert, quick picker, or voice assistant
  const handleSelectStation = (stationId: string | null) => {
    setSelectedStationId(stationId);
    if (stationId && currentScreen !== 'globe' && currentScreen !== 'satellite-map') {
      setCurrentScreen('globe');
    }
  };

  return (
    <div className="app-shell relative w-screen h-screen bg-[#05080D] text-[#E8EDF0] overflow-hidden flex font-space select-none">
      {/* Background Technical Grid */}
      <div className="absolute inset-0 grid-overlay z-0 pointer-events-none"></div>

      {/* Sleek Left-Side Collapsible Tactical Navigation */}
      <CollapsibleNav
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        selectedStationId={selectedStationId}
        activeLayer={activeLayer}
        onChangeLayer={(layer) => setActiveLayer(layer)}
        isCollapsed={isNavCollapsed}
        onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
      />

      {/* Main Screen Container with dynamic left margin matching collapsible sidebar */}
      <div
        className={`relative flex-1 h-full overflow-hidden z-10 flex flex-col transition-all duration-300 ${
          isNavCollapsed ? 'pl-14' : 'pl-64'
        }`}
      >
        <main className="relative flex-1 w-full h-full pb-16 overflow-hidden">
          {/* 1. 3D Globe Screen */}
          {currentScreen === 'globe' && (
            <div className="relative w-full h-full">
              <GlobeView
                selectedStationId={selectedStationId}
                onSelectStation={handleSelectStation}
                currentDate={currentDate}
                activeLayer={activeLayer}
                autoRotate={autoRotate}
                onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
                globeStyle={globeStyle}
                onChangeGlobeStyle={(style) => setGlobeStyle(style)}
              />
              <GlobeHudOverlay
                activeLayer={activeLayer}
                selectedStationId={selectedStationId}
                onSelectStation={handleSelectStation}
              />
            </div>
          )}

          {/* 2. High-Res Satellite Map Explorer Screen */}
          {currentScreen === 'satellite-map' && (
            <div className="relative w-full h-full">
              <SatelliteMapExplorer
                currentDate={currentDate}
                activeLayer={activeLayer}
                onSelectStation={handleSelectStation}
                selectedStationId={selectedStationId}
                basemap={basemap}
                onChangeBasemap={(b) => setBasemap(b)}
                showWaterRaster={showWaterRaster}
                onToggleWaterRaster={(s) => setShowWaterRaster(s)}
                rasterOpacity={rasterOpacity}
                onChangeRasterOpacity={(o) => setRasterOpacity(o)}
                showStationMarkers={showStationMarkers}
                onToggleStationMarkers={(m) => setShowStationMarkers(m)}
                onOpenCycloneSimulator={() => setCurrentScreen('cyclone-simulator')}
              />
            </div>
          )}

          {/* 3. Transect Cross-Section Screen */}
          {currentScreen === 'cross-section' && (
            <CrossSectionView
              currentDate={currentDate}
              activeLayer={activeLayer}
              onOpenStation={handleSelectStation}
            />
          )}

          {/* 4. Subsurface Anomaly Alerts Screen */}
          {currentScreen === 'alerts' && (
            <AlertsFeedView
              currentDate={currentDate}
              onSelectStation={(stationId) => {
                handleSelectStation(stationId);
              }}
            />
          )}

          {/* 5. Physics-Informed Neural Network (PINN) Model Architecture & Verification */}
          {currentScreen === 'ml-model' && (
            <MLArchitectureView
              currentDate={currentDate}
              activeLayer={activeLayer}
              onSelectStation={handleSelectStation}
            />
          )}

          {/* 6. Cyclone Digital Twin & What-If Simulator (Price-Weller-Pinkel PWP Model) */}
          {currentScreen === 'cyclone-simulator' && (
            <CycloneSimulatorView
              currentDate={currentDate}
              activeLayer={activeLayer}
              selectedStationId={selectedStationId}
              onSelectStation={handleSelectStation}
              onNavigateToMap={() => setCurrentScreen('satellite-map')}
            />
          )}

          {/* Signature Moment: Core Sample Slide-in Side Panel */}
          {selectedStationData && currentScreen === 'globe' && (
            <CoreSamplePanel
              stationData={selectedStationData}
              onClose={() => setSelectedStationId(null)}
              onOpenCycloneSimulator={(stId) => {
                setSelectedStationId(stId);
                setCurrentScreen('cyclone-simulator');
              }}
            />
          )}
        </main>

        {/* Bottom Date/Time Scrubber & Layer Controls */}
        <TimelineScrubber
          currentDate={currentDate}
          onDateChange={(d) => setCurrentDate(d)}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          activeLayer={activeLayer}
          onChangeLayer={(layer) => setActiveLayer(layer)}
          autoRotate={autoRotate}
          onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        />
      </div>

      {/* Palantir-Style Tactical Voice AI Assistant */}
      <TacticalVoiceAgent
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        selectedStationId={selectedStationId}
        onSelectStation={handleSelectStation}
        activeLayer={activeLayer}
        onChangeLayer={(layer) => setActiveLayer(layer)}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        currentDate={currentDate}
        onDateChange={(d) => setCurrentDate(d)}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        globeStyle={globeStyle}
        onChangeGlobeStyle={(s) => setGlobeStyle(s)}
        basemap={basemap}
        onChangeBasemap={(b) => setBasemap(b)}
        showWaterRaster={showWaterRaster}
        onToggleWaterRaster={(s) => setShowWaterRaster(s)}
        rasterOpacity={rasterOpacity}
        onChangeRasterOpacity={(o) => setRasterOpacity(o)}
        showStationMarkers={showStationMarkers}
        onToggleStationMarkers={(m) => setShowStationMarkers(m)}
      />
    </div>
  );
}
