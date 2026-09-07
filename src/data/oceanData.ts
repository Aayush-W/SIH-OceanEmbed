import { Station, StationData, ProfilePoint, ArgoValidationPoint, SurfaceLayer, TransectData, SubsurfaceAlert, WindVector } from '../types';

export const STATIONS: Station[] = [
  {
    id: 'bay_bengal_alpha',
    name: 'Central Bay of Bengal',
    code: 'BAY_BENGAL_ALPHA',
    region: 'North Indian Ocean',
    lat: 15.42,
    lon: 89.15,
    depthMax: 1000,
    argoFloatId: 'Argo Float 59062',
    satelliteSources: ['Sat: SSHA (Jason-3)', 'Sat: SST (MODIS)', 'Sat: SSS (SMAP)', 'Sat: Winds (ASCAT)'],
  },
  {
    id: 'arabian_sea_basin',
    name: 'Central Arabian Sea',
    code: 'ARABIAN_SEA_CENTRAL',
    region: 'North Indian Ocean',
    lat: 14.80,
    lon: 65.20,
    depthMax: 1000,
    argoFloatId: 'Argo Float 29018',
    satelliteSources: ['Sat: SSHA (Sentinel-6)', 'Sat: SST (MODIS)', 'Sat: Altimetry (CryoSat-2)', 'Sat: Winds (MetOp-B)'],
  },
  {
    id: 'andaman_basin',
    name: 'Andaman Sea Basin',
    code: 'ANDAMAN_BASIN_03',
    region: 'North Indian Ocean',
    lat: 10.50,
    lon: 93.80,
    depthMax: 1000,
    argoFloatId: 'Argo Float 59088',
    satelliteSources: ['Sat: SSHA (Jason-3)', 'Sat: SST (VIIRS)', 'Sat: SSS (SMAP)', 'Sat: Winds (ASCAT)'],
  },
  {
    id: 'sri_lanka_dome',
    name: 'Sri Lanka Dome / South BoB',
    code: 'SRI_LANKA_DOME_ARC',
    region: 'North Indian Ocean',
    lat: 7.50,
    lon: 83.20,
    depthMax: 1000,
    argoFloatId: 'Argo Float 59041',
    satelliteSources: ['Sat: SSHA (Sentinel-3)', 'Sat: SST (MODIS)', 'Sat: In-situ Mooring BD02', 'Sat: Winds (Oceansat-3)'],
  },
  {
    id: 'somali_current',
    name: 'Somali Current Convergence',
    code: 'SOMALI_EDGE_01',
    region: 'Western Arabian Sea',
    lat: 8.20,
    lon: 52.50,
    depthMax: 1000,
    argoFloatId: 'Argo Float 19022',
    satelliteSources: ['Sat: SSHA (Sentinel-6)', 'Sat: SST (VIIRS)', 'Sat: Altimetry (HY-2B)', 'Sat: Winds (ASCAT-C)'],
  },
  {
    id: 'lakshadweep_sea',
    name: 'Lakshadweep High/Low',
    code: 'LAKSHADWEEP_NODE_B',
    region: 'Southeastern Arabian Sea',
    lat: 10.00,
    lon: 72.50,
    depthMax: 1000,
    argoFloatId: 'Argo Float 29045',
    satelliteSources: ['Sat: SSHA (Jason-3)', 'Sat: SST (MODIS)', 'Sat: SSS (SMAP)', 'Sat: Winds (MetOp)'],
  },
];

// Helper to convert date string (e.g. "2024-05-15") to day-of-year fraction (0 to 1)
export function getDayOfYearFraction(dateStr: string): number {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return (day % 365) / 365;
}

/**
 * Calculates surface wind vectors (U, V, speed, direction) based on seasonal monsoon physics
 */
export function calculateSurfaceWinds(lat: number, lon: number, dateStr: string): WindVector {
  const dayFrac = getDayOfYearFraction(dateStr);
  const seasonAngle = dayFrac * 2 * Math.PI;

  // SW Monsoon (June - Sept, peak July/Aug): Strong Southwesterly winds (210° - 240°)
  // NE Monsoon (Nov - Feb): Moderate Northeasterly winds (30° - 60°)
  // Transition periods (March-May, Oct): Light variable breezes
  const isSummerMonsoon = Math.sin(seasonAngle - 1.4) > 0;
  const monsoonIntensity = Math.max(0, Math.sin(seasonAngle - 1.4));
  const winterIntensity = Math.max(0, -Math.sin(seasonAngle - 1.4));

  let speedKts: number;
  let directionDeg: number;
  let cardinal: string;

  if (isSummerMonsoon) {
    // Somali Jet & Findlater Jet can reach 28-35 knots in Western Arabian Sea
    const somaliBoost = lon < 60 ? 12 * monsoonIntensity : 4 * monsoonIntensity;
    speedKts = 14 + monsoonIntensity * 12 + somaliBoost + (Math.sin(lat * 0.4) * 2);
    directionDeg = 225 + Math.sin(seasonAngle * 2) * 15; // South-Westerly
    cardinal = 'SW';
  } else {
    speedKts = 8 + winterIntensity * 8 + (Math.cos(lat * 0.3) * 2);
    directionDeg = 45 + Math.cos(seasonAngle * 2) * 15; // North-Easterly
    cardinal = 'NE';
  }

  const speedMs = Math.round((speedKts * 0.514444) * 10) / 10;
  const rad = (directionDeg * Math.PI) / 180;
  // Meteorological wind: direction wind is coming FROM
  const u = Math.round((-Math.sin(rad) * speedMs) * 10) / 10;
  const v = Math.round((-Math.cos(rad) * speedMs) * 10) / 10;
  const gustKts = Math.round((speedKts * 1.35) * 10) / 10;

  return {
    speedKts: Math.round(speedKts * 10) / 10,
    speedMs,
    directionDeg: Math.round(directionDeg),
    cardinal,
    u,
    v,
    gustKts,
  };
}

/**
 * Deterministic physics-grounded subsurface temperature profile reconstructor.
 * Reconstructs continuous 0-1000m thermal thermocline based on lat/lon, seasonal cycle, and depth.
 */
export function getTemperatureProfile(
  lat: number,
  lon: number,
  dateStr: string,
  layer: SurfaceLayer = 'SST'
): {
  surfaceTemp: number;
  mixedLayerDepth: number;
  mixedLayerRate: number;
  uncertaintySigma: number;
  confidencePct: number;
  profile: ProfilePoint[];
  argoPoints: ArgoValidationPoint[];
  variableValues: { SST: number; SSS: number; SSH: number; CURRENTS: number; WINDS: WindVector };
} {
  const dayFrac = getDayOfYearFraction(dateStr);
  const seasonAngle = dayFrac * 2 * Math.PI;

  // Seasonal monsoon cycle in North Indian Ocean:
  // Pre-monsoon warm peak (May/June), Monsoon cooling/mixing (July/Aug), Post-monsoon warming (Oct), Winter cooling (Jan/Feb)
  const monsoonCycle = Math.sin(seasonAngle - 1.2) * 2.2 + Math.cos(seasonAngle * 2) * 0.8;
  const latFactor = (30 - lat) * 0.25; // Equatorward is generally warmer
  const basinFactor = lon > 80 ? 0.8 : -0.5; // Bay of Bengal warmer/fresher than Arabian Sea

  // Base surface temp
  const baseSST = 27.5 + monsoonCycle + latFactor * 0.3 + basinFactor;
  const surfaceTemp = Math.round(baseSST * 10) / 10;

  // Variables
  const sss = Math.round((lon > 80 ? 32.8 - Math.sin(seasonAngle) * 1.5 : 36.2 + Math.cos(seasonAngle) * 0.8) * 10) / 10;
  const ssh = Math.round((Math.sin(seasonAngle + lat * 0.1) * 12 + basinFactor * 4) * 10) / 10;
  const currents = Math.round((0.8 + Math.abs(Math.sin(seasonAngle)) * 0.7 + (lat < 10 ? 0.4 : 0)) * 100) / 100;
  const winds = calculateSurfaceWinds(lat, lon, dateStr);

  // Mixed layer depth (deeper in monsoon June-Aug, shallower in pre-monsoon)
  const baseMLD = 35 + (lon < 70 ? 20 : 10) + Math.cos(seasonAngle - 2.5) * 18;
  const mixedLayerDepth = Math.max(18, Math.round(baseMLD));
  const mixedLayerRate = Math.round((Math.sin(seasonAngle * 3) * 3.5 - 1.2) * 10) / 10;

  const uncertaintySigma = Math.round((0.08 + Math.abs(Math.sin(seasonAngle + lon * 0.05)) * 0.06) * 100) / 100;
  const confidencePct = Math.round((98.8 - uncertaintySigma * 8) * 10) / 10;

  // Deep ocean temperature asymptote at 1000m is ~6.5°C to 7.8°C
  const deepTemp = 6.8 + (lat < 10 ? 0.4 : 0);
  const thermoclineDepth = mixedLayerDepth + 110;
  const thermoclineSharpness = 0.018;

  // Generate 15 depth level points (0 to 1000m)
  const depthLevels = [0, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000];
  const profile: ProfilePoint[] = depthLevels.map((depth) => {
    let t: number;
    if (depth <= mixedLayerDepth) {
      // Isothermal mixed layer with micro gradient
      t = surfaceTemp - (depth / mixedLayerDepth) * 0.15;
    } else {
      // Modified Sigmoidal / Thermocline decay
      const z = depth - thermoclineDepth;
      const sigmoid = 1 / (1 + Math.exp(z * thermoclineSharpness));
      const midT = deepTemp + (surfaceTemp - deepTemp) * sigmoid;
      // Secondary exponential tail into abyss
      t = midT - Math.exp(-depth / 400) * 0.4;
    }

    t = Math.max(deepTemp - 0.5, t);
    const sigma = uncertaintySigma * (1 + (depth / 300) * 0.6);
    const sal = depth < 100 ? sss : sss + Math.min(1.8, (depth / 400) * 0.9);
    const rho = 1024 + (depth / 200) * 2.1 - (t - 15) * 0.18;

    return {
      depth,
      temp: Math.round(t * 100) / 100,
      tempMin: Math.round((t - sigma) * 100) / 100,
      tempMax: Math.round((t + sigma) * 100) / 100,
      salinity: Math.round(sal * 10) / 10,
      density: Math.round(rho * 10) / 10,
    };
  });

  // Simulated real in-situ Argo validation soundings
  const sampleDepths = [45, 120, 260, 390, 510, 780, 950];
  const argoPoints: ArgoValidationPoint[] = sampleDepths.map((d) => {
    const profMatch = profile.find((p) => p.depth >= d) || profile[profile.length - 1];
    // Argo noise ±0.15°C
    const noise = (Math.sin(d * 13.7 + lat) * 0.14) + (Math.cos(lon * 5.3) * 0.08);
    return {
      depth: d,
      temp: Math.round((profMatch.temp + noise) * 100) / 100,
      confidence: Math.round((96 + Math.random() * 3.5) * 10) / 10,
    };
  });

  return {
    surfaceTemp,
    mixedLayerDepth,
    mixedLayerRate,
    uncertaintySigma,
    confidencePct,
    profile,
    argoPoints,
    variableValues: {
      SST: surfaceTemp,
      SSS: sss,
      SSH: ssh,
      CURRENTS: currents,
      WINDS: winds,
    },
  };
}

export function getStationData(stationId: string, dateStr: string, layer: SurfaceLayer = 'SST'): StationData {
  const station = STATIONS.find((s) => s.id === stationId) || STATIONS[0];
  const profileData = getTemperatureProfile(station.lat, station.lon, dateStr, layer);
  return {
    station,
    date: dateStr,
    ...profileData,
  };
}

/**
 * Generates Cross-Section transect grid data (0-1000m depth x longitude range)
 */
export function getTransectData(transectId: string, dateStr: string, layer: SurfaceLayer = 'SST'): TransectData {
  const dayFrac = getDayOfYearFraction(dateStr);
  const seasonAngle = dayFrac * 2 * Math.PI;

  if (transectId === 'meridional_bob') {
    // 88°E Transect from 5°N to 22°N
    const lats = [5, 7, 9, 11, 13, 15, 17, 19, 21];
    const depths = [0, 50, 100, 150, 200, 300, 400, 500, 600, 750, 1000];
    const points = lats.map((lat) => {
      const prof = getTemperatureProfile(lat, 88.0, dateStr, layer);
      const depthGrid = depths.map((d) => {
        const p = prof.profile.find((pt) => pt.depth >= d) || prof.profile[prof.profile.length - 1];
        return { depth: d, temp: p.temp };
      });
      return {
        xCoord: lat,
        xLabel: `${lat}°N`,
        depthGrid,
      };
    });

    const mixedLayerContour = lats.map((lat) => {
      const p = getTemperatureProfile(lat, 88.0, dateStr, layer);
      return { x: lat, depth: p.mixedLayerDepth };
    });

    return {
      id: 'meridional_bob',
      title: 'Bay of Bengal Meridional Transect (88.0°E)',
      description: 'North-South vertical thermal section across Central Bay of Bengal from Equator to Ganges Delta.',
      xLabel: 'Latitude (°N)',
      points,
      mixedLayerContour,
    };
  }

  // Default: Zonal 12°N Transect (Arabian Sea to Bay of Bengal: 52°E to 95°E)
  const lons = [52, 58, 64, 70, 76, 82, 88, 94];
  const depths = [0, 30, 60, 100, 150, 200, 300, 400, 500, 600, 750, 1000];

  const points = lons.map((lon) => {
    // Add realistic subsurface thermocline tilt:
    // Western Arabian Sea has upwelling (shallower thermocline in summer), Bay of Bengal has thick warm pool & fresh cap
    const prof = getTemperatureProfile(12.0, lon, dateStr, layer);
    const depthGrid = depths.map((d) => {
      const p = prof.profile.find((pt) => pt.depth >= d) || prof.profile[prof.profile.length - 1];
      // Subtle zonal gradient: BoB warm lens vs Arabian Sea cold tongue
      const zonalDelta = (lon - 70) * 0.04 * (1 - d / 1000);
      return {
        depth: d,
        temp: Math.round((p.temp + zonalDelta) * 100) / 100,
      };
    });

    return {
      xCoord: lon,
      xLabel: `${lon}°E`,
      depthGrid,
    };
  });

  const mixedLayerContour = lons.map((lon) => {
    const prof = getTemperatureProfile(12.0, lon, dateStr, layer);
    // Thermocline tilt: deeper in east (60m) vs shallow upwelling in west (25m)
    const tilt = (lon - 52) * 0.45;
    return {
      x: lon,
      depth: Math.round(prof.mixedLayerDepth + tilt),
    };
  });

  return {
    id: 'zonal_12n',
    title: 'North Indian Ocean Zonal Transect (12.0°N)',
    description: 'East-West vertical cross-section from Somali Coast (52°E) through Arabian Sea, South India, to Andaman Sea (94°E).',
    xLabel: 'Longitude (°E)',
    points,
    mixedLayerContour,
  };
}

/**
 * Subsurface Thermal Anomaly Alerts
 */
export function getAnomalyAlerts(dateStr: string): SubsurfaceAlert[] {
  return [
    {
      id: 'alt-01',
      title: 'Warm Core Anticyclonic Eddy',
      region: 'Central Bay of Bengal',
      lat: 15.42,
      lon: 89.15,
      depthRange: '80m – 220m',
      anomalyDelta: '+2.4°C',
      deltaValue: 2.4,
      severity: 'CRITICAL',
      confidence: '99.1%',
      sparkline: [0.6, 0.9, 1.4, 1.8, 2.1, 2.4, 2.3, 2.5],
      detectedDate: dateStr,
      description: 'Intense thermocline depression detected via Jason-3 SSHA (+18cm) and reconstructed warm subsurface core.',
      linkedStationId: 'bay_bengal_alpha',
    },
    {
      id: 'alt-02',
      title: 'Somali Upwelling Cold Tongue',
      region: 'Western Arabian Sea',
      lat: 8.20,
      lon: 52.50,
      depthRange: '20m – 140m',
      anomalyDelta: '-2.8°C',
      deltaValue: -2.8,
      severity: 'ELEVATED',
      confidence: '97.6%',
      sparkline: [-0.4, -0.8, -1.5, -2.1, -2.5, -2.8, -2.7, -2.9],
      detectedDate: dateStr,
      description: 'Strong coastal wind stress elevating 18°C isotherm towards the surface layer.',
      linkedStationId: 'somali_current',
    },
    {
      id: 'alt-03',
      title: 'Subsurface Marine Heatwave Cat II',
      region: 'Andaman Basin',
      lat: 10.50,
      lon: 93.80,
      depthRange: '40m – 160m',
      anomalyDelta: '+1.7°C',
      deltaValue: 1.7,
      severity: 'ELEVATED',
      confidence: '96.8%',
      sparkline: [0.2, 0.4, 0.8, 1.1, 1.3, 1.5, 1.6, 1.7],
      detectedDate: dateStr,
      description: 'Persistent warm anomaly exceeding 90th percentile climatology for >14 days.',
      linkedStationId: 'andaman_basin',
    },
    {
      id: 'alt-04',
      title: 'Sri Lanka Dome Cyclonic Upwelling',
      region: 'Southern Bay of Bengal',
      lat: 7.50,
      lon: 83.20,
      depthRange: '50m – 180m',
      anomalyDelta: '-1.4°C',
      deltaValue: -1.4,
      severity: 'MONITORING',
      confidence: '95.4%',
      sparkline: [-0.1, -0.3, -0.6, -0.9, -1.1, -1.3, -1.4, -1.4],
      detectedDate: dateStr,
      description: 'Open-ocean cyclonic eddy lifting deep cold nutrient-rich waters into euphotic zone.',
      linkedStationId: 'sri_lanka_dome',
    },
    {
      id: 'alt-05',
      title: 'Lakshadweep High Thermocline Bulge',
      region: 'Southeastern Arabian Sea',
      lat: 10.00,
      lon: 72.50,
      depthRange: '60m – 200m',
      anomalyDelta: '+1.1°C',
      deltaValue: 1.1,
      severity: 'MONITORING',
      confidence: '94.9%',
      sparkline: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0, 1.1, 1.1],
      detectedDate: dateStr,
      description: 'Anticyclonic circulation propagating westward as downwelling Rossby waves.',
      linkedStationId: 'lakshadweep_sea',
    },
  ];
}

/**
 * Color mapper: cyan #3FE0C7 (cold) -> coral #FF8A5B (warm)
 */
export function tempToHexColor(temp: number, minTemp: number = 5, maxTemp: number = 30): string {
  const norm = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
  // Interpolate RGB:
  // Cyan #3FE0C7 = rgb(63, 224, 199)
  // Coral #FF8A5B = rgb(255, 138, 91)
  const r = Math.round(63 + norm * (255 - 63));
  const g = Math.round(224 + norm * (138 - 224));
  const b = Math.round(199 + norm * (91 - 199));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function tempToRgba(temp: number, alpha: number = 1, minTemp: number = 5, maxTemp: number = 30): string {
  const norm = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
  const r = Math.round(63 + norm * (255 - 63));
  const g = Math.round(224 + norm * (138 - 224));
  const b = Math.round(199 + norm * (91 - 199));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLayerValueAndColor(
  stationData: StationData,
  layer: SurfaceLayer
): { label: string; valueFormatted: string; hexColor: string; unit: string } {
  switch (layer) {
    case 'SST':
      return {
        label: 'Sea Surface Temp',
        valueFormatted: `${stationData.variableValues.SST.toFixed(1)}`,
        unit: '°C',
        hexColor: tempToHexColor(stationData.variableValues.SST, 22, 32),
      };
    case 'SSS':
      return {
        label: 'Sea Surface Salinity',
        valueFormatted: `${stationData.variableValues.SSS.toFixed(1)}`,
        unit: 'PSU',
        hexColor: tempToHexColor(stationData.variableValues.SSS, 32, 37),
      };
    case 'SSH':
      return {
        label: 'Sea Surface Height',
        valueFormatted: `${stationData.variableValues.SSH > 0 ? '+' : ''}${stationData.variableValues.SSH.toFixed(1)}`,
        unit: 'cm',
        hexColor: tempToHexColor(stationData.variableValues.SSH, -15, 20),
      };
    case 'CURRENTS':
      return {
        label: 'Geostrophic Current',
        valueFormatted: `${stationData.variableValues.CURRENTS.toFixed(2)}`,
        unit: 'm/s',
        hexColor: tempToHexColor(stationData.variableValues.CURRENTS, 0.2, 1.8),
      };
    case 'WINDS':
      return {
        label: 'Surface Wind Vector',
        valueFormatted: `${stationData.variableValues.WINDS.cardinal} ${stationData.variableValues.WINDS.speedKts.toFixed(1)}`,
        unit: 'kt',
        hexColor: tempToHexColor(stationData.variableValues.WINDS.speedKts, 6, 28),
      };
  }
}

/**
 * Calculates continuous spatial grid values for rendering on 2D Satellite Map and 3D globe
 */
export function getSpatialLayerValue(
  lat: number,
  lon: number,
  dateStr: string,
  layer: SurfaceLayer
): { val: number; color: string; rgba: string } {
  const dayFrac = getDayOfYearFraction(dateStr);
  const seasonAngle = dayFrac * 2 * Math.PI;
  const isSummer = Math.sin(seasonAngle - 1.4) > 0;

  if (layer === 'SST') {
    // Spatial SST physics:
    // Bay of Bengal Warm Pool (29-31.5°C)
    // Central Arabian Sea (28-29.5°C)
    // Somali / Oman coastal upwelling cold wedge (22-25°C in summer)
    // Equatorial tongue (28.5-30°C)
    const base = 28.2 + Math.sin(seasonAngle - 1.2) * 1.8;
    const latGrad = (25 - lat) * 0.12;
    const bobWarmPool = lon > 82 && lat > 8 && lat < 22 ? 1.6 : 0;
    const somaliUpwell = isSummer && lon < 58 && lat < 14 ? -5.5 * Math.exp(-((lon - 50) ** 2 + (lat - 9) ** 2) / 45) : 0;
    const omanUpwell = isSummer && lon > 56 && lon < 62 && lat > 17 && lat < 24 ? -3.5 : 0;
    const val = Math.round((base + latGrad + bobWarmPool + somaliUpwell + omanUpwell) * 10) / 10;
    return { val, color: tempToHexColor(val, 22, 32), rgba: tempToRgba(val, 0.78, 22, 32) };
  } else if (layer === 'SSS') {
    // SSS physics: Arabian Sea salty (36-37 PSU), Bay of Bengal fresh runoff lens (31.5-33.5 PSU)
    const val = Math.round((lon > 78 ? 32.5 + (lon - 78) * -0.08 : 36.4 - (78 - lon) * 0.03) * 10) / 10;
    return { val, color: tempToHexColor(val, 32, 37), rgba: tempToRgba(val, 0.78, 32, 37) };
  } else if (layer === 'SSH') {
    const val = Math.round((Math.sin(seasonAngle + lat * 0.15 + lon * 0.1) * 14 + (lon > 82 ? 5 : -4)) * 10) / 10;
    return { val, color: tempToHexColor(val, -15, 20), rgba: tempToRgba(val, 0.78, -15, 20) };
  } else if (layer === 'CURRENTS') {
    const somaliJet = isSummer && lon < 60 && lat < 15 ? 1.8 : 0.6;
    const val = Math.round((somaliJet + Math.abs(Math.sin(lat * 0.2 + lon * 0.2)) * 0.6) * 100) / 100;
    return { val, color: tempToHexColor(val, 0.2, 1.8), rgba: tempToRgba(val, 0.78, 0.2, 1.8) };
  } else {
    // WINDS
    const winds = calculateSurfaceWinds(lat, lon, dateStr);
    return {
      val: winds.speedKts,
      color: tempToHexColor(winds.speedKts, 6, 28),
      rgba: tempToRgba(winds.speedKts, 0.78, 6, 28),
    };
  }
}
