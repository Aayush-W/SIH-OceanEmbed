export type SurfaceLayer = 'SST' | 'SSS' | 'SSH' | 'CURRENTS' | 'WINDS';

export type GlobeMapStyle = 'SATELLITE' | 'BATHYMETRY' | 'TACTICAL';

export type BasemapType = 'SATELLITE_HYBRID' | 'OCEAN_BATHYMETRY' | 'DARK_TACTICAL';

export type NavScreen = 'globe' | 'satellite-map' | 'cross-section' | 'alerts' | 'ml-model' | 'cyclone-simulator';

export interface Station {
  id: string;
  name: string;
  code: string;
  region: string;
  lat: number;
  lon: number;
  depthMax: number;
  argoFloatId: string;
  satelliteSources: string[];
}

export interface ProfilePoint {
  depth: number; // 0 to 1000m
  temp: number; // in °C
  tempMin: number; // uncertainty lower bound
  tempMax: number; // uncertainty upper bound
  salinity: number; // in PSU
  density: number; // kg/m^3
}

export interface ArgoValidationPoint {
  depth: number;
  temp: number;
  confidence: number;
}

export interface WindVector {
  speedKts: number;
  speedMs: number;
  directionDeg: number;
  cardinal: string;
  u: number;
  v: number;
  gustKts: number;
}

export interface StationData {
  station: Station;
  date: string;
  surfaceTemp: number;
  mixedLayerDepth: number; // in meters
  mixedLayerRate: number; // e.g. -2.1 m/hr
  uncertaintySigma: number; // in ±°C
  confidencePct: number;
  profile: ProfilePoint[];
  argoPoints: ArgoValidationPoint[];
  variableValues: {
    SST: number; // °C
    SSS: number; // PSU (e.g. 33.5 - 36.5)
    SSH: number; // cm (e.g. -20 to +20)
    CURRENTS: number; // m/s (e.g. 0.1 to 1.8)
    WINDS: WindVector;
  };
}

export interface TransectPoint {
  xCoord: number; // e.g. longitude
  xLabel: string;
  depthGrid: {
    depth: number;
    temp: number;
  }[];
}

export interface TransectData {
  id: string;
  title: string;
  description: string;
  xLabel: string;
  points: TransectPoint[];
  mixedLayerContour: { x: number; depth: number }[];
}

export interface SubsurfaceAlert {
  id: string;
  title: string;
  region: string;
  lat: number;
  lon: number;
  depthRange: string;
  anomalyDelta: string;
  deltaValue: number;
  severity: 'CRITICAL' | 'ELEVATED' | 'MONITORING';
  confidence: string;
  sparkline: number[];
  detectedDate: string;
  description: string;
  linkedStationId: string;
}
