import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  CycloneHistoricalPreset,
  CycloneScenarioParams,
  computeCycloneGeospatialData,
  CycloneGeospatialResult,
  calculateGeoDistanceKm,
} from '../physics/pwpModel';
import { StationData, BasemapType } from '../types';
import { STATIONS } from '../data/oceanData';
import {
  Layers,
  Eye,
  Wind,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  MapPin,
  ChevronRight,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface CycloneMapExplorerProps {
  preset: CycloneHistoricalPreset;
  params: CycloneScenarioParams;
  stationData: StationData;
  selectedHour: number;
  onSelectHour: (hour: number) => void;
  onSelectStation?: (stationId: string) => void;
  showPlanner?: boolean;
  className?: string;
  isCompact?: boolean;
}

export const CycloneMapExplorer: React.FC<CycloneMapExplorerProps> = ({
  preset,
  params,
  stationData,
  selectedHour,
  onSelectHour,
  onSelectStation,
  showPlanner = false,
  className = '',
  isCompact = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups for clean dynamic updating
  const baseTrackLayerRef = useRef<L.LayerGroup | null>(null);
  const simTrackLayerRef = useRef<L.LayerGroup | null>(null);
  const coldWakeLayerRef = useRef<L.LayerGroup | null>(null);
  const eyeMarkerLayerRef = useRef<L.LayerGroup | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const plannerLayerRef = useRef<L.LayerGroup | null>(null);

  const [basemap, setBasemap] = useState<BasemapType>('DARK_TACTICAL');
  const [showColdWake, setShowColdWake] = useState<boolean>(true);
  const [showBaseTrack, setShowBaseTrack] = useState<boolean>(true);
  const [showWindRadii, setShowWindRadii] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [plannerPoints, setPlannerPoints] = useState<Array<Record<string, string | number>>>([]);

  // Compute full geospatial cyclone state
  const geoData: CycloneGeospatialResult = useMemo(() => {
    return computeCycloneGeospatialData(preset, stationData, params, selectedHour);
  }, [preset, stationData, params, selectedHour]);

  // Timeline scrubber auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onSelectHour(selectedHour >= 48 ? -24 : selectedHour + 2);
    }, 450);
    return () => clearInterval(interval);
  }, [isPlaying, selectedHour, onSelectHour]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center map approximately around preset track or station
    const centerLat = stationData.station.lat;
    const centerLon = stationData.station.lon;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: isCompact ? 5 : 6,
      minZoom: 4,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Create persistent layer groups
    coldWakeLayerRef.current = L.layerGroup().addTo(map);
    baseTrackLayerRef.current = L.layerGroup().addTo(map);
    simTrackLayerRef.current = L.layerGroup().addTo(map);
    stationsLayerRef.current = L.layerGroup().addTo(map);
    plannerLayerRef.current = L.layerGroup().addTo(map);
    eyeMarkerLayerRef.current = L.layerGroup().addTo(map);

    // Initial tile layer
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 18, subdomains: 'abcd' }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!showPlanner) {
      setPlannerPoints([]);
      return;
    }

    let cancelled = false;
    fetch('/api/observation-planner')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('planner unavailable')))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.points)) setPlannerPoints(payload.points);
      })
      .catch(() => {
        if (!cancelled) setPlannerPoints([]);
      });

    return () => { cancelled = true; };
  }, [showPlanner]);

  // Update Basemap Tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (basemap === 'SATELLITE_HYBRID') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (basemap === 'OCEAN_BATHYMETRY') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
    }

    tileLayerRef.current = L.tileLayer(url, { maxZoom: 18, subdomains: 'abcd' }).addTo(map);
  }, [basemap]);

  // Fit bounds when preset changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoData.counterfactualTrack.length) return;

    const lats = geoData.counterfactualTrack.map((p) => p.lat);
    const lons = geoData.counterfactualTrack.map((p) => p.lon);
    lats.push(stationData.station.lat);
    lons.push(stationData.station.lon);
    if (showPlanner) {
      plannerPoints.forEach((point) => {
        lats.push(Number(point.grid_lat));
        lons.push(Number(point.grid_lon));
      });
    }

    const minLat = Math.min(...lats) - 1.5;
    const maxLat = Math.max(...lats) + 1.5;
    const minLon = Math.min(...lons) - 2.0;
    const maxLon = Math.max(...lons) + 2.0;

    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [25, 25], maxZoom: isCompact ? 7 : 9, animate: false }
    );
  }, [preset.id, stationData.station.id, params.trackDistanceKm, params.rmaxKm, isCompact, showPlanner, plannerPoints]);

  useEffect(() => {
    const group = plannerLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showPlanner) return;

    plannerPoints.forEach((point) => {
      const lat = Number(point.grid_lat);
      const lon = Number(point.grid_lon);
      const priority = Number(point.predicted_priority) || 0;
      const uncertainty = Number(point.prediction_uncertainty) || 0;
      const marker = L.circleMarker([lat, lon], {
        radius: 4 + priority * 9,
        color: '#f0f5f3',
        weight: 1,
        fillColor: '#b8cfd2',
        fillOpacity: 0.16 + priority * 0.55,
        interactive: true,
      });
      marker.bindTooltip(
        `<div class="font-mono text-xs bg-[#0A1119] border border-[#E8EDF0] p-1.5 text-[#E8EDF0]">
          <div class="font-bold uppercase">ACTIVE OBSERVATION PLANNER</div>
          <div>Priority: <b>${priority.toFixed(3)}</b></div>
          <div>Uncertainty: <b>+/-${uncertainty.toFixed(3)}</b></div>
          <div>Argo distance: <b>${Number(point.nearest_argo_distance_km).toFixed(0)} km</b></div>
        </div>`,
        { sticky: true },
      );
      group.addLayer(marker);
    });
  }, [plannerPoints, showPlanner]);

  // Render Cold Wake Footprints
  useEffect(() => {
    const group = coldWakeLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showColdWake) return;

    geoData.coldWakePolygons.forEach((poly) => {
      const isCore = poly.deltaSst <= -3.0;
      const polygon = L.polygon(poly.points, {
        color: isCore ? '#00E5FF' : '#0091EA',
        weight: isCore ? 1.5 : 1.0,
        dashArray: isCore ? undefined : '4, 4',
        fillColor: isCore ? '#00E5FF' : '#0070BA',
        fillOpacity: isCore ? 0.38 : 0.22,
        interactive: true,
      });

      polygon.bindTooltip(
        `<div class="font-mono text-xs p-1 bg-[#0A1119] border border-[#00E5FF] text-[#E8EDF0]">
          <span class="text-[#00E5FF] font-bold">PWP COLD WAKE FOOTPRINT</span><br/>
          <span>ΔSST Anomaly: <b>${poly.deltaSst}°C</b></span><br/>
          <span>Mixed Layer Deepening: <b>+${poly.mldDeepeningM}m</b></span><br/>
          <span class="text-[10px] text-[#6E8391]">Driven by resonant vertical shear mixing</span>
        </div>`,
        { sticky: true }
      );

      group.addLayer(polygon);
    });
  }, [geoData.coldWakePolygons, showColdWake]);

  // Render Baseline Historical Track
  useEffect(() => {
    const group = baseTrackLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showBaseTrack || !geoData.baselineTrack.length) return;

    const latlngs: [number, number][] = geoData.baselineTrack.map((p) => [p.lat, p.lon]);

    // Baseline dashed polyline
    const line = L.polyline(latlngs, {
      color: '#4B6B82',
      weight: 2.2,
      dashArray: '5, 6',
      opacity: 0.75,
      interactive: false,
    });
    group.addLayer(line);

    // Baseline historical waypoint markers
    geoData.baselineTrack.forEach((pt) => {
      const marker = L.circleMarker([pt.lat, pt.lon], {
        radius: 3.5,
        color: '#4B6B82',
        weight: 1.5,
        fillColor: '#0A1119',
        fillOpacity: 0.9,
      });
      marker.bindTooltip(
        `<div class="font-mono text-xs bg-[#0A1119] border border-[#4B6B82] p-1 text-[#E8EDF0]">
          <span class="text-[#8FA7B8] font-bold">HISTORICAL BASELINE // ${pt.category}</span><br/>
          <span>Hour: ${pt.hour >= 0 ? `+${pt.hour}h` : `${pt.hour}h`}</span> | 
          <span>Wind: ${pt.windKts} kts</span> | 
          <span>Pressure: ${pt.pressureHpa} hPa</span>
        </div>`,
        { sticky: true }
      );
      group.addLayer(marker);
    });
  }, [geoData.baselineTrack, showBaseTrack]);

  // Render Counterfactual Modified Track
  useEffect(() => {
    const group = simTrackLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (!geoData.counterfactualTrack.length) return;

    const latlngs: [number, number][] = geoData.counterfactualTrack.map((p) => [p.lat, p.lon]);

    // Outer glow track
    const glowLine = L.polyline(latlngs, {
      color: '#FF8A5B',
      weight: 6.0,
      opacity: 0.25,
      interactive: false,
    });
    group.addLayer(glowLine);

    // Core solid track
    const coreLine = L.polyline(latlngs, {
      color: '#FF8A5B',
      weight: 3.0,
      opacity: 0.95,
      interactive: true,
    });
    group.addLayer(coreLine);

    // Waypoint dots with category colors
    geoData.counterfactualTrack.forEach((pt) => {
      let dotColor = '#FF8A5B';
      let dotRadius = 4.5;
      if (pt.windKts >= 120) {
        dotColor = '#FF3B30'; // Cat 4/5 / Super
        dotRadius = 6.0;
      } else if (pt.windKts >= 90) {
        dotColor = '#FF9500'; // Cat 2/3
        dotRadius = 5.0;
      }

      const marker = L.circleMarker([pt.lat, pt.lon], {
        radius: dotRadius,
        color: dotColor,
        weight: 2,
        fillColor: '#05080D',
        fillOpacity: 1,
      });

      marker.bindTooltip(
        `<div class="font-mono text-xs bg-[#0A1119] border border-[#FF8A5B] p-1.5 text-[#E8EDF0]">
          <div class="text-[#FF8A5B] font-bold uppercase tracking-wider">COUNTERFACTUAL TRACK // ${pt.category}</div>
          <div class="mt-1 flex gap-3 text-[11px]">
            <span>Time: <b>${pt.hour >= 0 ? `+${pt.hour}h` : `${pt.hour}h`}</b></span>
            <span>Winds: <b class="text-[#FFB188]">${pt.windKts} kts</b></span>
            <span>Pressure: <b>${pt.pressureHpa} hPa</b></span>
          </div>
          <div class="text-[10px] text-[#6E8391] mt-0.5">Click to jump simulation timeline to this hour</div>
        </div>`,
        { sticky: true }
      );

      marker.on('click', () => {
        onSelectHour(pt.hour);
      });

      group.addLayer(marker);
    });
  }, [geoData.counterfactualTrack, onSelectHour]);

  // Render Ocean Stations & Distance Interconnect
  useEffect(() => {
    const group = stationsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showStations) return;

    // Line from Active Station to Cyclone Eye
    const eyeLat = geoData.activeEye.lat;
    const eyeLon = geoData.activeEye.lon;
    const stLat = stationData.station.lat;
    const stLon = stationData.station.lon;

    const distancePolyline = L.polyline(
      [
        [stLat, stLon],
        [eyeLat, eyeLon],
      ],
      {
        color: '#3FE0C7',
        weight: 1.5,
        dashArray: '3, 4',
        opacity: 0.75,
      }
    );
    group.addLayer(distancePolyline);

    // Distance Pill Midpoint
    const midLat = (stLat + eyeLat) / 2;
    const midLon = (stLon + eyeLon) / 2;
    const distIcon = L.divIcon({
      className: 'distance-label-icon',
      html: `
        <div style="transform: translate(-50%, -50%);" class="bg-[#0A1119]/90 border border-[#3FE0C7] text-[#3FE0C7] font-mono text-[9px] px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none">
          Dist: ${geoData.activeEye.distanceToStationKm} km
        </div>
      `,
    });
    group.addLayer(L.marker([midLat, midLon], { icon: distIcon, interactive: false }));

    // Station Markers
    STATIONS.forEach((st) => {
      const isCurrent = st.id === stationData.station.id;
      const markerColor = isCurrent ? '#3FE0C7' : '#6E8391';

      const customIcon = L.divIcon({
        className: 'station-marker-icon',
        html: `
          <div style="transform: translate(-50%, -50%);" class="relative group cursor-pointer">
            ${isCurrent ? '<div class="absolute -inset-2 rounded-full border border-[#3FE0C7] animate-ping opacity-60"></div>' : ''}
            <div class="w-4 h-4 bg-[#0A1119] border-2 flex items-center justify-center transition-transform group-hover:scale-125" style="border-color: ${markerColor}">
              <div class="w-1.5 h-1.5" style="background: ${markerColor}"></div>
            </div>
            <div class="absolute left-5 top-1/2 -translate-y-1/2 bg-[#0A1119]/95 border px-1.5 py-0.5 text-[9px] font-mono whitespace-nowrap shadow-xl" style="border-color: ${isCurrent ? '#3FE0C7' : '#1C2A33'}">
              <span class="${isCurrent ? 'text-[#3FE0C7] font-bold' : 'text-[#A4B5C1]'}">${st.code}</span>
            </div>
          </div>
        `,
      });

      const marker = L.marker([st.lat, st.lon], { icon: customIcon });
      marker.bindTooltip(
        `<div class="font-mono text-xs bg-[#0A1119] border border-[#3FE0C7] p-1.5 text-[#E8EDF0]">
          <span class="text-[#3FE0C7] font-bold">${st.name}</span><br/>
          <span>Depth: 0–${st.depthMax}m | ${st.argoFloatId}</span><br/>
          <span>Distance to Eye: <b>${calculateGeoDistanceKm(st.lat, st.lon, eyeLat, eyeLon).toFixed(0)} km</b></span>
        </div>`,
        { sticky: true }
      );

      marker.on('click', () => {
        if (onSelectStation) onSelectStation(st.id);
      });

      group.addLayer(marker);
    });
  }, [stationData.station, geoData.activeEye, showStations, onSelectStation]);

  // Render Active Storm Eye & Dynamic Wind Radii
  useEffect(() => {
    const group = eyeMarkerLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const eye = geoData.activeEye;

    // Gale Force Wind Radius Circle (34 kt threshold, approx 150-250 km)
    if (showWindRadii) {
      const galeCircle = L.circle([eye.lat, eye.lon], {
        radius: eye.galeRadiusKm * 1000,
        color: '#FF8A5B',
        weight: 1,
        dashArray: '4, 4',
        fillColor: '#FF8A5B',
        fillOpacity: 0.08,
        interactive: false,
      });
      group.addLayer(galeCircle);
    }

    // Radius of Maximum Winds (Rmax circle)
    const rmaxCircle = L.circle([eye.lat, eye.lon], {
      radius: eye.rmaxKm * 1000,
      color: '#FF3B30',
      weight: 2,
      fillColor: '#FF3B30',
      fillOpacity: 0.18,
      interactive: false,
    });
    group.addLayer(rmaxCircle);

    // Active Eye Animated Vortex Icon
    const vortexIcon = L.divIcon({
      className: 'cyclone-eye-icon',
      html: `
        <div style="transform: translate(-50%, -50%);" class="relative flex items-center justify-center pointer-events-auto cursor-pointer">
          <!-- Animated Eyewall Pulse -->
          <div class="absolute w-12 h-12 rounded-full border-2 border-[#FF8A5B] animate-ping opacity-60"></div>
          
          <!-- Spinning Cyclonic Vortex Arms -->
          <div class="w-10 h-10 flex items-center justify-center animate-spin-slow">
            <svg viewBox="0 0 100 100" class="w-full h-full text-[#FF8A5B] filter drop-shadow(0 0 6px rgba(255,138,91,0.8))">
              <path fill="currentColor" opacity="0.9" d="M50 15 C35 15, 20 28, 20 45 C20 49, 23 50, 26 47 C33 40, 42 38, 50 40 C53 41, 55 38, 54 36 C52 28, 55 20, 50 15 Z" />
              <path fill="currentColor" opacity="0.9" d="M50 85 C65 85, 80 72, 80 55 C80 51, 77 50, 74 53 C67 60, 58 62, 50 60 C47 59, 45 62, 46 64 C48 72, 45 80, 50 85 Z" />
              <circle cx="50" cy="50" r="8" fill="#05080D" stroke="#FF3B30" stroke-width="4" />
            </svg>
          </div>

          <!-- Central Eye Radar Pip -->
          <div class="absolute w-2 h-2 rounded-full bg-[#FF3B30]"></div>

          <!-- Floating Eye Tag -->
          <div class="absolute left-10 top-1/2 -translate-y-1/2 bg-[#0A1119]/95 border border-[#FF8A5B] px-2 py-1 shadow-2xl pointer-events-none whitespace-nowrap">
            <div class="text-[9px] font-mono font-bold text-[#FF8A5B]">
              ${preset.name.toUpperCase()} (T: ${eye.hour >= 0 ? `+${eye.hour}h` : `${eye.hour}h`})
            </div>
            <div class="text-[10px] text-[#E8EDF0] font-mono flex items-center gap-2">
              <span><b>${eye.windKts} kts</b> (${(eye.windKts * 1.852).toFixed(0)} km/h)</span>
              <span class="text-[#6E8391]">|</span>
              <span class="text-[#3FE0C7]">${eye.pressureHpa} hPa</span>
            </div>
          </div>
        </div>
      `,
    });

    const eyeMarker = L.marker([eye.lat, eye.lon], { icon: vortexIcon, zIndexOffset: 1000 });
    eyeMarker.bindTooltip(
      `<div class="font-mono text-xs bg-[#0A1119] border border-[#FF8A5B] p-2 text-[#E8EDF0]">
        <div class="text-[#FF8A5B] font-bold uppercase">${preset.name} // Active Position</div>
        <div class="mt-1 space-y-0.5 text-[11px]">
          <div>Coordinates: <b>${eye.lat}°N, ${eye.lon}°E</b></div>
          <div>Max Sustained Winds: <b class="text-[#FF8A5B]">${eye.windKts} kts</b> (${(eye.windKts * 1.852).toFixed(0)} km/h)</div>
          <div>Central Pressure: <b>${eye.pressureHpa} hPa</b></div>
          <div>Radius of Max Winds (Rmax): <b>${eye.rmaxKm} km</b></div>
          <div>Forward Heading: <b>${eye.headingDeg}°</b></div>
          <div class="pt-1 border-t border-[#1C2A33] text-[#3FE0C7]">
            Distance to ${stationData.station.name}: <b>${eye.distanceToStationKm} km</b><br/>
            Local Wind at Station: <b>${eye.localWindAtStationKts} kts</b>
          </div>
        </div>
      </div>`,
      { sticky: true }
    );
    group.addLayer(eyeMarker);
  }, [geoData.activeEye, showWindRadii, preset.name, stationData.station]);

  return (
    <div className={`relative w-full h-full flex flex-col bg-[#05080D] overflow-hidden ${className}`}>
      {/* 1. Map Canvas */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0 relative" style={{ minHeight: isCompact ? '260px' : '380px' }} />

      {/* 2. Top-Left Tactical HUD Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none">
        <div className="bg-[#0A1119]/90 backdrop-blur border border-[#1C2A33] p-2.5 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between gap-2 border-b border-[#1C2A33] pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#FF8A5B] font-bold uppercase tracking-wider">
              <Wind className="w-3.5 h-3.5 animate-spin-slow" />
              <span>{preset.name} // MAP TWIN</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#FF8A5B]/15 text-[#FF8A5B] border border-[#FF8A5B]/30 font-semibold">
              {params.windKts} kts
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#E8EDF0]">
            <div className="bg-[#05080D] p-1.5 border border-[#1C2A33]">
              <span className="text-[#6E8391] block text-[9px]">EYE POSITION</span>
              <span className="font-bold text-[#E8EDF0]">{geoData.activeEye.lat}°N, {geoData.activeEye.lon}°E</span>
            </div>
            <div className="bg-[#05080D] p-1.5 border border-[#1C2A33]">
              <span className="text-[#6E8391] block text-[9px]">CENTRAL PRESSURE</span>
              <span className="font-bold text-[#3FE0C7]">{geoData.activeEye.pressureHpa} hPa</span>
            </div>
            <div className="bg-[#05080D] p-1.5 border border-[#1C2A33]">
              <span className="text-[#6E8391] block text-[9px]">DIST TO STATION</span>
              <span className="font-bold text-[#FF8A5B]">{geoData.activeEye.distanceToStationKm} km</span>
            </div>
            <div className="bg-[#05080D] p-1.5 border border-[#1C2A33]">
              <span className="text-[#6E8391] block text-[9px]">STATION WIND</span>
              <span className="font-bold text-[#3FE0C7]">{geoData.activeEye.localWindAtStationKts} kts</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top-Right Basemap & Layer Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="bg-[#0A1119]/90 backdrop-blur border border-[#1C2A33] p-1.5 flex items-center gap-1 shadow-2xl">
          <button
            onClick={() => setBasemap('DARK_TACTICAL')}
            className={`px-2 py-1 text-[10px] font-mono uppercase transition-colors ${
              basemap === 'DARK_TACTICAL'
                ? 'bg-[#1C2A33] text-[#3FE0C7] font-bold border border-[#3FE0C7]/40'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            Dark Tactical
          </button>
          <button
            onClick={() => setBasemap('SATELLITE_HYBRID')}
            className={`px-2 py-1 text-[10px] font-mono uppercase transition-colors ${
              basemap === 'SATELLITE_HYBRID'
                ? 'bg-[#1C2A33] text-[#3FE0C7] font-bold border border-[#3FE0C7]/40'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setBasemap('OCEAN_BATHYMETRY')}
            className={`px-2 py-1 text-[10px] font-mono uppercase transition-colors ${
              basemap === 'OCEAN_BATHYMETRY'
                ? 'bg-[#1C2A33] text-[#3FE0C7] font-bold border border-[#3FE0C7]/40'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            Bathymetry
          </button>
        </div>

        {/* Layer Visibility Toggles */}
        <div className="bg-[#0A1119]/90 backdrop-blur border border-[#1C2A33] p-2 flex flex-col gap-1.5 text-[10px] font-mono text-[#6E8391] shadow-2xl">
          <label className="flex items-center gap-2 cursor-pointer hover:text-[#E8EDF0]">
            <input
              type="checkbox"
              checked={showColdWake}
              onChange={(e) => setShowColdWake(e.target.checked)}
              className="accent-[#00E5FF] w-3 h-3"
            />
            <span className="text-[#00E5FF] font-semibold">Cold Wake Swath (PWP)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-[#E8EDF0]">
            <input
              type="checkbox"
              checked={showBaseTrack}
              onChange={(e) => setShowBaseTrack(e.target.checked)}
              className="accent-[#8FA7B8] w-3 h-3"
            />
            <span>Historical Baseline Track</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-[#E8EDF0]">
            <input
              type="checkbox"
              checked={showWindRadii}
              onChange={(e) => setShowWindRadii(e.target.checked)}
              className="accent-[#FF8A5B] w-3 h-3"
            />
            <span>Rmax & Gale Wind Radii</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-[#E8EDF0]">
            <input
              type="checkbox"
              checked={showStations}
              onChange={(e) => setShowStations(e.target.checked)}
              className="accent-[#3FE0C7] w-3 h-3"
            />
            <span>Mooring / Argo Stations</span>
          </label>
        </div>
      </div>

      {/* 4. Bottom Map Legend */}
      <div className="absolute bottom-16 left-3 z-10 hidden sm:flex items-center gap-3 bg-[#0A1119]/90 backdrop-blur border border-[#1C2A33] px-3 py-1.5 text-[10px] font-mono text-[#6E8391] shadow-2xl pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-1 bg-[#FF8A5B]"></div>
          <span className="text-[#E8EDF0]">Simulated Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-0.5 border-b border-dashed border-[#4B6B82]"></div>
          <span>Baseline Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#00E5FF]/40 border border-[#00E5FF]"></div>
          <span className="text-[#00E5FF]">Cold Wake (&le; -3.0°C)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-[#FF3B30] bg-[#FF3B30]/30"></div>
          <span className="text-[#FF8A5B]">Rmax Swath</span>
        </div>
      </div>

      {/* 5. Bottom Timeline Playback Scrubber Bar */}
      <div className="bg-[#0A1119] border-t border-[#1C2A33] p-2 sm:px-4 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 border font-mono text-xs flex items-center gap-1 transition-all ${
              isPlaying
                ? 'bg-[#FF8A5B] text-[#05080D] font-bold border-[#FF8A5B]'
                : 'bg-[#1C2A33] text-[#E8EDF0] border-[#2A3F4D] hover:border-[#FF8A5B]'
            }`}
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => onSelectHour(0)}
            className="p-1.5 bg-[#1C2A33] text-[#E8EDF0] border border-[#2A3F4D] hover:border-[#3FE0C7] text-xs font-mono"
            title="Reset to Peak Passage (T=0)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrubber slider */}
        <div className="flex-1 flex items-center gap-3">
          <div className="text-[11px] font-mono text-[#FF8A5B] font-bold whitespace-nowrap min-w-[70px]">
            T: {selectedHour >= 0 ? `+${selectedHour}h` : `${selectedHour}h`}
            <span className="text-[#6E8391] text-[9px] block">
              {selectedHour === 0 ? 'PEAK PASSAGE' : selectedHour < 0 ? 'APPROACH' : 'COLD WAKE'}
            </span>
          </div>

          <input
            type="range"
            min={-24}
            max={48}
            step={2}
            value={selectedHour}
            onChange={(e) => onSelectHour(Number(e.target.value))}
            className="w-full accent-[#FF8A5B] h-1.5 bg-[#1C2A33] cursor-pointer"
          />

          <div className="text-[10px] font-mono text-[#6E8391] whitespace-nowrap hidden sm:block">
            -24h ... +48h
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono border-l border-[#1C2A33] pl-3">
          <span className="text-[#6E8391]">STATION SST DROP:</span>
          <span className="text-[#00E5FF] font-bold">
            {geoData.activeEye.distanceToStationKm <= 50 ? '-3.2°C' : '-1.4°C'}
          </span>
        </div>
      </div>
    </div>
  );
};
