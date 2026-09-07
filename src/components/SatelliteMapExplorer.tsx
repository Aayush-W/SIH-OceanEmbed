import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { STATIONS, getStationData, getLayerValueAndColor, getSpatialLayerValue, calculateSurfaceWinds, tempToHexColor } from '../data/oceanData';
import { Station, SurfaceLayer } from '../types';
import { Layers, ZoomIn, ZoomOut, Compass, MapPin, Eye, Radio, Activity, Wind, Sliders, Flame, Sparkles } from 'lucide-react';
import { HISTORICAL_CYCLONES, computeCycloneGeospatialData } from '../physics/pwpModel';

export type BasemapType = 'SATELLITE_HYBRID' | 'OCEAN_BATHYMETRY' | 'DARK_TACTICAL';

interface SatelliteMapExplorerProps {
  currentDate: string;
  activeLayer: SurfaceLayer;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string | null;
  basemap?: BasemapType;
  onChangeBasemap?: (b: BasemapType) => void;
  showWaterRaster?: boolean;
  onToggleWaterRaster?: (show: boolean) => void;
  rasterOpacity?: number;
  onChangeRasterOpacity?: (opacity: number) => void;
  showStationMarkers?: boolean;
  onToggleStationMarkers?: (show: boolean) => void;
  onOpenCycloneSimulator?: () => void;
}

// Bounding box for North Indian Ocean Basin Heatmap Overlay
const BASIN_BOUNDS: L.LatLngBoundsLiteral = [
  [-4.0, 42.0], // South-West (Equatorial Africa / Western IO)
  [28.0, 102.0], // North-East (Bay of Bengal / Myanmar / Indochina)
];

// Generate dynamic continuous thermodynamic raster canvas for water surface
function generateBasinRasterUrl(dateStr: string, layer: SurfaceLayer, opacity: number = 0.75): string {
  const canvas = document.createElement('canvas');
  const width = 360;
  const height = 200;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const minLat = -4.0;
  const maxLat = 28.0;
  const minLon = 42.0;
  const maxLon = 102.0;

  // Precise Geographic Land Mask for North Indian Ocean Basin & Marginal Seas
  const isLand = (lat: number, lon: number) => {
    // 1. Indian Subcontinent
    if (lat >= 8.0 && lat <= 28.0) {
      if (lat >= 22.0 && lon >= 68.0 && lon <= 90.0) return true; // Northern India & Gangetic Plain
      if (lat >= 8.0 && lat < 22.0) {
        // High-precision triangular peninsula edge equations
        const westCoast = 72.8 + (lat - 8.0) * 0.22; // Gujarat to Kanyakumari
        const eastCoast = 80.2 + (lat - 8.0) * 0.42; // Tamil Nadu to Odisha / Bengal
        if (lon >= westCoast && lon <= eastCoast) return true;
      }
    }

    // 2. Sri Lanka Island
    if (lat >= 5.8 && lat <= 9.9 && lon >= 79.5 && lon <= 82.0) {
      return true;
    }

    // 3. Arabian Peninsula & Middle East
    if (lat >= 12.0 && lon <= 60.0 && lon >= 42.0) {
      if (lat >= 16.0) return true; // Saudi Arabia, Oman interior, UAE
      if (lat >= 12.0 && lon <= 54.0) return true; // Yemen & Southern Oman coast
    }

    // 4. Horn of Africa & East Africa
    if (lat <= 12.0 && lon <= 51.5 && lon >= 42.0) {
      const coastLon = 41.5 + (lat + 4.0) * 0.65;
      if (lon <= coastLon) return true;
    }

    // 5. Southeast Asia Mainland (Myanmar, Thailand, Malaysia)
    if (lat >= 1.0 && lon >= 96.0) {
      if (lat >= 14.0 && lon >= 94.0) return true; // Myanmar interior & Irrawaddy Delta
      if (lat >= 6.0 && lat < 14.0 && lon >= 98.2) return true; // Malay Peninsula
      if (lat < 6.0 && lon >= 100.0) return true; // Southern Malaya
    }

    // 6. Sumatra Island
    if (lat <= 6.0 && lat >= -4.0 && lon >= 95.0 && lon <= 104.0) {
      const sumatraCenterLon = 95.5 + (6.0 - lat) * 1.0;
      if (Math.abs(lon - sumatraCenterLon) <= 1.8) return true;
    }

    return false;
  };

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let py = 0; py < height; py++) {
    const lat = maxLat - (py / height) * (maxLat - minLat);
    for (let px = 0; px < width; px++) {
      const lon = minLon + (px / width) * (maxLon - minLon);
      const pixelIdx = (py * width + px) * 4;

      if (isLand(lat, lon)) {
        // Land: transparent to reveal satellite land photography
        data[pixelIdx + 3] = 0;
        continue;
      }

      // Compute physics-grounded spatial value & RGB
      const { val } = getSpatialLayerValue(lat, lon, dateStr, layer);
      
      let norm: number;
      if (layer === 'SST') {
        norm = Math.max(0, Math.min(1, (val - 22) / (32 - 22)));
      } else if (layer === 'SSS') {
        norm = Math.max(0, Math.min(1, (val - 32) / (37 - 32)));
      } else if (layer === 'SSH') {
        norm = Math.max(0, Math.min(1, (val + 15) / 35));
      } else if (layer === 'CURRENTS') {
        norm = Math.max(0, Math.min(1, (val - 0.2) / 1.6));
      } else {
        // WINDS
        norm = Math.max(0, Math.min(1, (val - 6) / 22));
      }

      // Smooth Thermal / Gradient interpolation:
      // Cyan #3FE0C7 rgb(63, 224, 199) -> Yellow/Gold rgb(255, 184, 0) -> Coral #FF8A5B rgb(255, 138, 91)
      let r: number, g: number, b: number;
      if (norm < 0.5) {
        const t = norm * 2;
        r = Math.round(63 + t * (255 - 63));
        g = Math.round(224 + t * (184 - 224));
        b = Math.round(199 + t * (0 - 199));
      } else {
        const t = (norm - 0.5) * 2;
        r = Math.round(255);
        g = Math.round(184 + t * (138 - 184));
        b = Math.round(0 + t * (91 - 0));
      }

      data[pixelIdx] = r;
      data[pixelIdx + 1] = g;
      data[pixelIdx + 2] = b;
      data[pixelIdx + 3] = Math.round(opacity * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // If WINDS or CURRENTS, draw streamline arrows
  if (layer === 'WINDS' || layer === 'CURRENTS') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;

    for (let py = 15; py < height; py += 30) {
      const lat = maxLat - (py / height) * (maxLat - minLat);
      for (let px = 20; px < width; px += 35) {
        const lon = minLon + (px / width) * (maxLon - minLon);
        if (isLand(lat, lon)) continue;

        const winds = calculateSurfaceWinds(lat, lon, dateStr);
        const rad = (winds.directionDeg * Math.PI) / 180;
        const len = Math.min(18, Math.max(8, winds.speedKts * 0.7));

        // Arrow vector pointing along wind direction
        const dx = Math.sin(rad) * len;
        const dy = -Math.cos(rad) * len;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();

        // Arrow head
        const headAngle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(px + dx, py + dy);
        ctx.lineTo(px + dx - 4 * Math.cos(headAngle - Math.PI / 6), py + dy - 4 * Math.sin(headAngle - Math.PI / 6));
        ctx.lineTo(px + dx - 4 * Math.cos(headAngle + Math.PI / 6), py + dy - 4 * Math.sin(headAngle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL();
}

export const SatelliteMapExplorer: React.FC<SatelliteMapExplorerProps> = ({
  currentDate,
  activeLayer,
  onSelectStation,
  selectedStationId,
  basemap: propBasemap,
  onChangeBasemap,
  showWaterRaster: propShowWaterRaster,
  onToggleWaterRaster,
  rasterOpacity: propRasterOpacity,
  onChangeRasterOpacity,
  showStationMarkers: propShowStationMarkers,
  onToggleStationMarkers,
  onOpenCycloneSimulator,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const rasterOverlayRef = useRef<L.ImageOverlay | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const cycloneGroupRef = useRef<L.LayerGroup | null>(null);

  const [internalBasemap, setInternalBasemap] = useState<BasemapType>('SATELLITE_HYBRID');
  const [internalShowWaterRaster, setInternalShowWaterRaster] = useState<boolean>(true);
  const [internalRasterOpacity, setInternalRasterOpacity] = useState<number>(0.72);
  const [internalShowMarkers, setInternalShowMarkers] = useState<boolean>(true);
  const [showCycloneTrack, setShowCycloneTrack] = useState<boolean>(true);
  const [activeCycloneId, setActiveCycloneId] = useState<string>('amphan_2020');

  const basemap = propBasemap !== undefined ? propBasemap : internalBasemap;
  const showWaterRaster = propShowWaterRaster !== undefined ? propShowWaterRaster : internalShowWaterRaster;
  const rasterOpacity = propRasterOpacity !== undefined ? propRasterOpacity : internalRasterOpacity;
  const showStationMarkers = propShowStationMarkers !== undefined ? propShowStationMarkers : internalShowMarkers;

  const handleSetBasemap = (b: BasemapType) => {
    if (onChangeBasemap) onChangeBasemap(b);
    else setInternalBasemap(b);
  };

  const handleToggleWaterRaster = (show: boolean) => {
    if (onToggleWaterRaster) onToggleWaterRaster(show);
    else setInternalShowWaterRaster(show);
  };

  const handleSetRasterOpacity = (op: number) => {
    if (onChangeRasterOpacity) onChangeRasterOpacity(op);
    else setInternalRasterOpacity(op);
  };

  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>({ lat: 14.2, lng: 79.5 });
  const [zoomLevel, setZoomLevel] = useState<number>(5);

  // Initialize Leaflet Map with Deep Zoom capability (maxZoom 18)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [13.2, 78.5],
      zoom: 5,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // ESRI High-Resolution Real Satellite Tile Layer
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, subdomains: 'abcd' }
    ).addTo(map);
    tileLayerRef.current = tileLayer;

    // Water Surface Thermal Raster Heatmap Overlay
    const rasterUrl = generateBasinRasterUrl(currentDate, activeLayer, rasterOpacity);
    const rasterOverlay = L.imageOverlay(rasterUrl, BASIN_BOUNDS, {
      opacity: 1.0,
      interactive: false,
    }).addTo(map);
    rasterOverlayRef.current = rasterOverlay;

    // Markers layer group
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Cyclone Track & Cold Wake layer group
    const cycloneGroup = L.layerGroup().addTo(map);
    cycloneGroupRef.current = cycloneGroup;

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorPos({
        lat: Math.round(e.latlng.lat * 1000) / 1000,
        lng: Math.round(e.latlng.lng * 1000) / 1000,
      });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer when `basemap` changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (basemap === 'OCEAN_BATHYMETRY') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
    } else if (basemap === 'DARK_TACTICAL') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }

    const newTileLayer = L.tileLayer(url, { maxZoom: 18, subdomains: 'abcd' }).addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [basemap]);

  // Update Water Surface Thermal / Winds Raster Overlay when Date, Layer, or Opacity changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (rasterOverlayRef.current) {
      map.removeLayer(rasterOverlayRef.current);
      rasterOverlayRef.current = null;
    }

    if (showWaterRaster) {
      const rasterUrl = generateBasinRasterUrl(currentDate, activeLayer, rasterOpacity);
      const newOverlay = L.imageOverlay(rasterUrl, BASIN_BOUNDS, {
        opacity: 1.0,
        interactive: false,
      }).addTo(map);
      rasterOverlayRef.current = newOverlay;
    }
  }, [currentDate, activeLayer, showWaterRaster, rasterOpacity]);

  // Update Station Markers & Badges
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    if (showStationMarkers) {
      STATIONS.forEach((st) => {
        const isSelected = selectedStationId === st.id;
        const stData = getStationData(st.id, currentDate, activeLayer);
        const { valueFormatted, unit, hexColor, label } = getLayerValueAndColor(stData, activeLayer);

        const iconHtml = `
          <div class="relative flex items-center justify-center group cursor-pointer" style="transform: translate(-50%, -50%);">
            <!-- Pulse Outer Ring -->
            <div class="absolute w-12 h-12 rounded-full border-2 ${isSelected ? 'animate-ping' : 'opacity-50'}" style="border-color: ${hexColor};"></div>
            
            <!-- Marker Core -->
            <div class="w-6 h-6 rounded-none border-2 flex items-center justify-center shadow-2xl transition-transform hover:scale-125 bg-[#0A1119]" style="border-color: ${hexColor};">
              <div class="w-2.5 h-2.5" style="background: ${hexColor};"></div>
            </div>

            <!-- Label Tag -->
            <div class="absolute left-7 top-1/2 -translate-y-1/2 bg-[#0A1119]/95 border px-2.5 py-1 whitespace-nowrap shadow-2xl pointer-events-none" style="border-color: ${isSelected ? '#3FE0C7' : '#1C2A33'};">
              <div class="text-[9px] font-mono font-bold tracking-wider" style="color: ${hexColor};">
                ${st.code}
              </div>
              <div class="text-[10px] text-[#E8EDF0] font-mono font-semibold">
                ${activeLayer}: ${valueFormatted} ${unit}
              </div>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-station-pin',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([st.lat, st.lon], { icon: customIcon });

        marker.on('click', () => {
          onSelectStation(st.id);
          mapInstanceRef.current?.flyTo([st.lat, st.lon], 8, { duration: 1.2 });
        });

        markersGroup.addLayer(marker);
      });
    }
  }, [currentDate, activeLayer, selectedStationId, onSelectStation, showStationMarkers]);

  // Render Cyclone Track, Cold Wake Footprint, and Active Eyewall on Map
  useEffect(() => {
    const cycloneGroup = cycloneGroupRef.current;
    if (!cycloneGroup) return;
    cycloneGroup.clearLayers();

    if (!showCycloneTrack) return;

    const preset = HISTORICAL_CYCLONES.find((c) => c.id === activeCycloneId) || HISTORICAL_CYCLONES[0];
    const stationData = getStationData(selectedStationId || 'st-bob-01', currentDate);
    const geoData = computeCycloneGeospatialData(
      preset,
      stationData,
      {
        windKts: preset.baseWindKts,
        speedKmh: preset.baseSpeedKmh,
        trackDistanceKm: preset.baseTrackDistanceKm,
        rmaxKm: preset.baseRmaxKm,
        pressureDeficitHpa: preset.basePressureDeficitHpa,
      },
      0
    );

    // 1. Cold Wake Footprint Polygons (Right-biased shear entrainment)
    geoData.coldWakePolygons.forEach((poly) => {
      if (poly.points.length >= 3) {
        const isCore = poly.deltaSst <= -2.0;
        const polygon = L.polygon(poly.points, {
          color: isCore ? '#00A8FF' : '#3FE0C7',
          weight: isCore ? 2 : 1.5,
          dashArray: isCore ? undefined : '4,4',
          fillColor: isCore ? '#0077CC' : '#3FE0C7',
          fillOpacity: isCore ? 0.35 : 0.2,
        });
        polygon.bindTooltip(
          `<strong>${preset.name} ${poly.label}</strong><br/>ΔSST: ${poly.deltaSst.toFixed(1)}°C · MLD: +${poly.mldDeepeningM}m`,
          { sticky: true }
        );
        cycloneGroup.addLayer(polygon);
      }
    });

    // 2. Storm Track Polyline
    const trackLatLons: L.LatLngExpression[] = geoData.baselineTrack.map((w) => [w.lat, w.lon]);
    const trackLine = L.polyline(trackLatLons, {
      color: '#FF8A5B',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round',
    });
    trackLine.bindTooltip(`<strong>${preset.name} Historical Track</strong><br/>${preset.category}`, { sticky: true });
    cycloneGroup.addLayer(trackLine);

    // 3. Waypoint Markers
    geoData.baselineTrack.forEach((wp) => {
      const dot = L.circleMarker([wp.lat, wp.lon], {
        radius: wp.hour === 0 ? 6 : 3.5,
        color: wp.hour === 0 ? '#FFFFFF' : '#FF8A5B',
        fillColor: wp.hour === 0 ? '#FF8A5B' : '#05080D',
        fillOpacity: 1,
        weight: 2,
      });
      dot.bindTooltip(
        `<strong>T ${wp.hour >= 0 ? '+' : ''}${wp.hour}h</strong><br/>Wind: ${wp.windKts} kts (${Math.round(wp.windKts * 1.852)} km/h)<br/>Pressure: ${wp.pressureHpa} hPa`,
        { sticky: true }
      );
      cycloneGroup.addLayer(dot);
    });

    // 4. Eyewall Radius Ring & Vortex Icon
    const eyePoint = geoData.activeEye;
    const rmaxCircle = L.circle([eyePoint.lat, eyePoint.lon], {
      radius: eyePoint.rmaxKm * 1000,
      color: '#FF8A5B',
      weight: 1.5,
      dashArray: '3,3',
      fillColor: '#FF8A5B',
      fillOpacity: 0.12,
    });
    rmaxCircle.bindTooltip(`R_max Eyewall: ${eyePoint.rmaxKm} km radius`, { sticky: true });
    cycloneGroup.addLayer(rmaxCircle);

    const eyeIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="absolute w-12 h-12 rounded-full border-2 border-[#FF8A5B] animate-ping opacity-60"></div>
          <div class="w-8 h-8 rounded-full border-2 border-[#FF8A5B] bg-[#0A1119]/90 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(255,138,91,0.8)]">
            🌪️
          </div>
          <div class="absolute left-9 top-1/2 -translate-y-1/2 bg-[#0A1119]/95 border border-[#FF8A5B] px-2 py-0.5 whitespace-nowrap shadow-xl pointer-events-none">
            <div class="text-[9px] font-mono font-bold text-[#FF8A5B] uppercase">${preset.name} (${eyePoint.windKts} kts)</div>
            <div class="text-[8px] font-mono text-[#E8EDF0]">T=0h Peak Eyewall</div>
          </div>
        </div>
      `,
      className: 'cyclone-eye-pin',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const eyeMarker = L.marker([eyePoint.lat, eyePoint.lon], { icon: eyeIcon });
    if (onOpenCycloneSimulator) {
      eyeMarker.on('click', () => onOpenCycloneSimulator());
    }
    cycloneGroup.addLayer(eyeMarker);
  }, [showCycloneTrack, activeCycloneId, selectedStationId, currentDate, onOpenCycloneSimulator]);

  // Exact Station Fly-To Navigation
  const flyToStation = (stationId: string) => {
    const station = STATIONS.find((s) => s.id === stationId);
    if (station && mapInstanceRef.current) {
      onSelectStation(station.id);
      mapInstanceRef.current.flyTo([station.lat, station.lon], 8, { duration: 1.4 });
    }
  };

  // Color scale bounds for legend
  const scaleInfo = useMemo(() => {
    switch (activeLayer) {
      case 'SST':
        return { title: 'SEA SURFACE TEMPERATURE', min: '22.0°C', mid: '27.0°C', max: '32.0°C', unit: '°C' };
      case 'SSS':
        return { title: 'SEA SURFACE SALINITY', min: '32.0 PSU', mid: '34.5 PSU', max: '37.0 PSU', unit: 'PSU' };
      case 'SSH':
        return { title: 'SEA SURFACE HEIGHT ANOMALY', min: '-15 cm', mid: '0 cm', max: '+20 cm', unit: 'cm' };
      case 'CURRENTS':
        return { title: 'GEOSTROPHIC SURFACE CURRENT', min: '0.2 m/s', mid: '1.0 m/s', max: '1.8 m/s', unit: 'm/s' };
      case 'WINDS':
        return { title: 'SURFACE WIND SPEED & STREAMLINES', min: '6 kt', mid: '16 kt', max: '28 kt', unit: 'kt' };
    }
  }, [activeLayer]);

  return (
    <div id="satellite-map-screen" className="relative w-full h-full bg-[#05080D] select-none overflow-hidden flex flex-col">
      {/* Top Map HUD Bar - Clean layout with distinct non-overlapping sections */}
      <div className="absolute top-4 left-6 right-6 z-[1000] flex flex-wrap justify-between items-start gap-3 pointer-events-none">
        {/* Left: Title Tag */}
        <div className="bg-[#0A1119]/95 border border-[#1C2A33] px-3.5 py-2 backdrop-blur-md pointer-events-auto relative shadow-2xl">
          <div className="corner-bracket corner-tl"></div>
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-bl"></div>
          <div className="corner-bracket corner-br"></div>
          <div className="font-data text-[10px] text-[#3FE0C7] uppercase tracking-widest flex items-center gap-1.5 font-semibold">
            <Radio className="w-3 h-3 animate-pulse text-[#3FE0C7]" />
            <span>SATELLITE & BATHYMETRY MAP</span>
          </div>
          <div className="font-space font-bold text-xs text-[#E8EDF0] uppercase tracking-wide mt-0.5">
            North Indian Ocean Surveillance
          </div>
        </div>

        {/* Center: Basemap Imagery Mode Switcher */}
        <div className="bg-[#0A1119]/95 border border-[#1C2A33] p-1 backdrop-blur-md pointer-events-auto flex items-center gap-1 shadow-2xl">
          <button
            id="basemap-satellite-btn"
            onClick={() => handleSetBasemap('SATELLITE_HYBRID')}
            className={`px-2.5 py-1 font-space text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              basemap === 'SATELLITE_HYBRID'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>TRUE SATELLITE</span>
          </button>

          <button
            id="basemap-bathymetry-btn"
            onClick={() => handleSetBasemap('OCEAN_BATHYMETRY')}
            className={`px-2.5 py-1 font-space text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              basemap === 'OCEAN_BATHYMETRY'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>BATHYMETRY</span>
          </button>

          <button
            id="basemap-dark-btn"
            onClick={() => handleSetBasemap('DARK_TACTICAL')}
            className={`px-2.5 py-1 font-space text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              basemap === 'DARK_TACTICAL'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DARK TACTICAL</span>
          </button>
        </div>

        {/* Right: Station Node Navigation Quick Chips */}
        <div className="hidden xl:flex items-center gap-1 bg-[#0A1119]/95 border border-[#1C2A33] p-1 pointer-events-auto backdrop-blur-md shadow-2xl">
          <span className="font-data text-[9px] text-[#3FE0C7] px-2 uppercase font-semibold">TARGET:</span>
          {STATIONS.map((st) => (
            <button
              key={st.id}
              onClick={() => flyToStation(st.id)}
              className={`px-2 py-0.5 text-[10px] font-space uppercase tracking-wider border transition-all ${
                selectedStationId === st.id
                  ? 'bg-[#3FE0C7] text-[#05080D] font-bold border-[#3FE0C7]'
                  : 'bg-[#05080D] text-[#E8EDF0] border-[#1C2A33] hover:border-[#3FE0C7] hover:text-[#3FE0C7]'
              }`}
              title={`Jump to ${st.name} (${st.lat}°N, ${st.lon}°E)`}
            >
              {st.name.split('/')[0].replace('Central ', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Leaflet Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Water Heatmap Controls & Scale Legend (Docked cleanly on the Right Side, below top bar) */}
      <div className="absolute top-20 right-6 z-[1000] pointer-events-auto flex flex-col gap-2">
        <div className="bg-[#0A1119]/95 border border-[#1C2A33] p-3 backdrop-blur-md font-data text-xs shadow-2xl min-w-[240px] max-w-[260px] relative">
          <div className="corner-bracket corner-tl"></div>
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-bl"></div>
          <div className="corner-bracket corner-br"></div>

          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#1C2A33]">
            <div className="flex items-center gap-1.5 text-[#3FE0C7] font-semibold text-[10px] uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#FF8A5B]" />
              <span>WATER SURFACE RASTER</span>
            </div>
            <button
              id="water-raster-toggle-btn"
              onClick={() => handleToggleWaterRaster(!showWaterRaster)}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-all ${
                showWaterRaster ? 'bg-[#3FE0C7] text-[#05080D]' : 'bg-[#1C2A33] text-[#6E8391]'
              }`}
            >
              {showWaterRaster ? 'ON' : 'OFF'}
            </button>
          </div>

          {showWaterRaster && (
            <>
              {/* Opacity Slider */}
              <div className="flex items-center justify-between text-[10px] text-[#6E8391] mb-1">
                <span>OPACITY:</span>
                <span className="text-[#3FE0C7] font-bold">{Math.round(rasterOpacity * 100)}%</span>
              </div>
              <input
                id="water-raster-opacity-slider"
                type="range"
                min="0.15"
                max="0.95"
                step="0.05"
                value={rasterOpacity}
                onChange={(e) => handleSetRasterOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#1C2A33] rounded-lg appearance-none cursor-pointer accent-[#3FE0C7] mb-2.5"
              />

              {/* Color Gradient Scale */}
              <div className="text-[9px] text-[#E8EDF0] font-semibold uppercase tracking-wider mb-1 truncate">
                {scaleInfo.title}
              </div>
              <div
                className="w-full h-2.5 border border-[#1C2A33] shadow-inner mb-1"
                style={{
                  background: 'linear-gradient(to right, #3FE0C7 0%, #FFB800 50%, #FF8A5B 100%)',
                }}
              />
              <div className="flex justify-between text-[9px] font-bold text-[#6E8391]">
                <span className="text-[#3FE0C7]">{scaleInfo.min}</span>
                <span className="text-[#FFB800]">{scaleInfo.mid}</span>
                <span className="text-[#FF8A5B]">{scaleInfo.max}</span>
              </div>
            </>
          )}
        </div>

        {/* Cyclone Track & Cold Wake Overlay Card */}
        <div className="bg-[#0A1119]/95 border border-[#1C2A33] p-3 backdrop-blur-md font-data text-xs shadow-2xl min-w-[240px] max-w-[260px] relative">
          <div className="corner-bracket corner-tl"></div>
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-bl"></div>
          <div className="corner-bracket corner-br"></div>

          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#1C2A33]">
            <div className="flex items-center gap-1.5 text-[#FF8A5B] font-semibold text-[10px] uppercase tracking-wider">
              <span>🌪️ CYCLONE & COLD WAKE</span>
            </div>
            <button
              id="cyclone-track-toggle-btn"
              onClick={() => setShowCycloneTrack(!showCycloneTrack)}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-all ${
                showCycloneTrack ? 'bg-[#FF8A5B] text-[#05080D]' : 'bg-[#1C2A33] text-[#6E8391]'
              }`}
            >
              {showCycloneTrack ? 'ON' : 'OFF'}
            </button>
          </div>

          {showCycloneTrack && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#6E8391]">STORM:</span>
                <select
                  value={activeCycloneId}
                  onChange={(e) => setActiveCycloneId(e.target.value)}
                  className="bg-[#05080D] border border-[#1C2A33] text-[#E8EDF0] text-[10px] px-1.5 py-0.5"
                >
                  {HISTORICAL_CYCLONES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.year})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[9px] text-[#6E8391] space-y-0.5">
                <div className="flex justify-between">
                  <span>Footprint:</span>
                  <span className="text-[#3FE0C7] font-mono font-bold">Right-Biased Cold Wake</span>
                </div>
                <div className="flex justify-between">
                  <span>Physics Model:</span>
                  <span className="text-[#E8EDF0] font-mono">PWP Mixed-Layer</span>
                </div>
              </div>

              {onOpenCycloneSimulator && (
                <button
                  onClick={onOpenCycloneSimulator}
                  className="w-full py-1.5 bg-[#FF8A5B] text-[#05080D] hover:bg-[#ff9c74] font-bold text-[10px] uppercase font-mono flex items-center justify-center gap-1.5 transition-all shadow-md mt-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>OPEN WHAT-IF SIMULATOR</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Telemetry Bar (Position, Magnification & Zoom Controls) - Elevated cleanly above bottom scrubber */}
      <div className="absolute bottom-6 left-6 right-6 z-[1000] pointer-events-none flex justify-between items-end">
        {/* Coordinates & Zoom Readout */}
        <div className="bg-[#0A1119]/95 border border-[#1C2A33] px-3.5 py-2 backdrop-blur-md font-data text-xs pointer-events-auto shadow-2xl relative">
          <div className="corner-bracket corner-tl"></div>
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-bl"></div>
          <div className="corner-bracket corner-br"></div>
          <div className="flex items-center gap-3.5 text-[#E8EDF0]">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#3FE0C7]" />
              <span className="font-mono">
                POS: {cursorPos?.lat.toFixed(3)}°N, {cursorPos?.lng.toFixed(3)}°E
              </span>
            </div>
            <span className="text-[#1C2A33]">|</span>
            <div className="text-[#6E8391]">
              MAG: <span className="text-[#3FE0C7] font-bold font-mono">{zoomLevel}x</span>
            </div>
            <span className="text-[#1C2A33]">|</span>
            <div className="text-[#6E8391]">
              LAYER: <span className="text-[#3FE0C7] font-bold">{activeLayer}</span>
            </div>
          </div>
        </div>

        {/* Deep Map Zoom Controls */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-lg"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-lg"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.flyTo([13.2, 78.5], 5)}
            className="w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-lg"
            title="Reset Basin View"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
