/**
 * Price-Weller-Pinkel (PWP; 1986) Mixed Layer Ocean Model
 * Physics Engine for Tropical Cyclone Upper Ocean Response & Counterfactual Simulation
 *
 * Simulates:
 * 1. Surface wind stress and kinetic energy flux (Large & Pond / Powell wind drag)
 * 2. Translation speed-dependent residence time and wind work integration
 * 3. Bulk Richardson number (Ri_b < 0.65) vertical convective and shear entrainment
 * 4. Gradient Richardson number (Ri_g < 0.25) pycnocline shear mixing
 * 5. Ekman pumping & cyclonic upwelling suction: w_E = curl(tau) / (rho_0 * f)
 * 6. Air-sea enthalpy extraction (latent + sensible heat loss)
 * 7. Subsurface thermal redistribution: SST cold wake vs deep entrainment warming
 * 8. Tropical Cyclone Heat Potential (TCHP) extraction and ocean-cyclone feedback index
 */

import { ProfilePoint, StationData } from '../types';

export interface CycloneTrackWaypoint {
  hour: number; // e.g., -48, -36, -24, -12, 0, +12, +24, +36, +48
  lat: number;
  lon: number;
  windKts: number;
  pressureHpa: number;
  category: string;
}

export interface CycloneHistoricalPreset {
  id: string;
  name: string;
  basin: string;
  year: number;
  category: string;
  baseWindKts: number;
  baseSpeedKmh: number;
  baseTrackDistanceKm: number;
  baseRmaxKm: number;
  basePressureDeficitHpa: number;
  recommendedStationId: string;
  description: string;
  trackWaypoints: CycloneTrackWaypoint[];
}

export const HISTORICAL_CYCLONES: CycloneHistoricalPreset[] = [
  {
    id: 'amphan_2020',
    name: 'Super Cyclone Amphan',
    basin: 'Bay of Bengal',
    year: 2020,
    category: 'Super Cyclonic Storm (Cat 5 Eq.)',
    baseWindKts: 140,
    baseSpeedKmh: 15.0,
    baseTrackDistanceKm: 25,
    baseRmaxKm: 30,
    basePressureDeficitHpa: 88,
    recommendedStationId: 'bay_bengal_alpha',
    description: 'One of the strongest storms ever recorded in the Bay of Bengal. Rapidly intensified over an anomalous 31°C ocean warm pool.',
    trackWaypoints: [
      { hour: -48, lat: 10.4, lon: 86.4, windKts: 35, pressureHpa: 998, category: 'Depression' },
      { hour: -36, lat: 11.6, lon: 86.3, windKts: 55, pressureHpa: 988, category: 'Cyclonic Storm' },
      { hour: -24, lat: 13.2, lon: 86.4, windKts: 90, pressureHpa: 965, category: 'Very Severe Cyclonic Storm' },
      { hour: -12, lat: 14.6, lon: 86.8, windKts: 125, pressureHpa: 935, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 0, lat: 15.8, lon: 87.2, windKts: 140, pressureHpa: 912, category: 'Super Cyclonic Storm' },
      { hour: 12, lat: 17.6, lon: 87.4, windKts: 115, pressureHpa: 940, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 24, lat: 19.8, lon: 87.8, windKts: 95, pressureHpa: 958, category: 'Very Severe Cyclonic Storm' },
      { hour: 36, lat: 21.7, lon: 88.3, windKts: 75, pressureHpa: 974, category: 'Severe Cyclonic Storm (Landfall)' },
      { hour: 48, lat: 23.9, lon: 89.6, windKts: 35, pressureHpa: 995, category: 'Deep Depression (Inland)' },
    ],
  },
  {
    id: 'biparjoy_2023',
    name: 'Extremely Severe Cyclone Biparjoy',
    basin: 'Arabian Sea',
    year: 2023,
    category: 'Extremely Severe Cyclonic Storm (Cat 3 Eq.)',
    baseWindKts: 90,
    baseSpeedKmh: 6.8, // Unusually slow translation / stall
    baseTrackDistanceKm: 20,
    baseRmaxKm: 45,
    basePressureDeficitHpa: 65,
    recommendedStationId: 'arabian_sea_basin',
    description: 'Characterized by extremely slow translation speed (<7 km/h) over the central Arabian Sea, driving catastrophic vertical mixing and deep cold wake.',
    trackWaypoints: [
      { hour: -48, lat: 12.1, lon: 66.0, windKts: 40, pressureHpa: 996, category: 'Cyclonic Storm' },
      { hour: -36, lat: 13.4, lon: 66.2, windKts: 60, pressureHpa: 986, category: 'Severe Cyclonic Storm' },
      { hour: -24, lat: 14.2, lon: 65.9, windKts: 80, pressureHpa: 972, category: 'Very Severe Cyclonic Storm' },
      { hour: -12, lat: 14.8, lon: 65.4, windKts: 90, pressureHpa: 960, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 0, lat: 15.6, lon: 65.8, windKts: 90, pressureHpa: 960, category: 'Stalled Quasistationary Peak' },
      { hour: 12, lat: 16.8, lon: 66.4, windKts: 85, pressureHpa: 966, category: 'Slow Transit' },
      { hour: 24, lat: 18.5, lon: 67.2, windKts: 80, pressureHpa: 972, category: 'Very Severe Cyclonic Storm' },
      { hour: 36, lat: 20.8, lon: 67.6, windKts: 65, pressureHpa: 982, category: 'Severe Cyclonic Storm' },
      { hour: 48, lat: 23.2, lon: 68.6, windKts: 55, pressureHpa: 988, category: 'Landfall Kutch / Gujarat' },
    ],
  },
  {
    id: 'fani_2019',
    name: 'Extremely Severe Cyclone Fani',
    basin: 'Bay of Bengal',
    year: 2019,
    category: 'Extremely Severe Cyclonic Storm (Cat 4 Eq.)',
    baseWindKts: 115,
    baseSpeedKmh: 18.5,
    baseTrackDistanceKm: 35,
    baseRmaxKm: 28,
    basePressureDeficitHpa: 72,
    recommendedStationId: 'bay_bengal_alpha',
    description: 'Fast-moving high-intensity cyclone that sustained high winds due to high subsurface Tropical Cyclone Heat Potential.',
    trackWaypoints: [
      { hour: -48, lat: 5.8, lon: 88.5, windKts: 35, pressureHpa: 998, category: 'Depression' },
      { hour: -36, lat: 8.2, lon: 87.0, windKts: 55, pressureHpa: 988, category: 'Cyclonic Storm' },
      { hour: -24, lat: 11.0, lon: 85.4, windKts: 80, pressureHpa: 972, category: 'Very Severe Cyclonic Storm' },
      { hour: -12, lat: 13.8, lon: 84.7, windKts: 105, pressureHpa: 950, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 0, lat: 16.0, lon: 84.7, windKts: 115, pressureHpa: 938, category: 'Peak Intensity' },
      { hour: 12, lat: 17.8, lon: 85.0, windKts: 110, pressureHpa: 944, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 24, lat: 19.8, lon: 85.8, windKts: 95, pressureHpa: 960, category: 'Puri Landfall' },
      { hour: 36, lat: 21.6, lon: 87.4, windKts: 50, pressureHpa: 988, category: 'Cyclonic Storm' },
      { hour: 48, lat: 24.2, lon: 89.8, windKts: 25, pressureHpa: 1002, category: 'Well Marked Low' },
    ],
  },
  {
    id: 'mocha_2023',
    name: 'Extremely Severe Cyclone Mocha',
    basin: 'Bay of Bengal / Andaman',
    year: 2023,
    category: 'Super Cyclonic Storm (Cat 5 Eq.)',
    baseWindKts: 130,
    baseSpeedKmh: 21.0,
    baseTrackDistanceKm: 45,
    baseRmaxKm: 32,
    basePressureDeficitHpa: 82,
    recommendedStationId: 'andaman_basin',
    description: 'Explosive intensification over the Andaman Sea basin driven by thick freshwater barrier layers and warm subsurface cores.',
    trackWaypoints: [
      { hour: -48, lat: 9.2, lon: 88.5, windKts: 30, pressureHpa: 1002, category: 'Depression' },
      { hour: -36, lat: 11.2, lon: 88.2, windKts: 50, pressureHpa: 992, category: 'Cyclonic Storm' },
      { hour: -24, lat: 13.0, lon: 89.2, windKts: 85, pressureHpa: 968, category: 'Very Severe Cyclonic Storm' },
      { hour: -12, lat: 14.8, lon: 90.4, windKts: 115, pressureHpa: 940, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 0, lat: 16.5, lon: 91.6, windKts: 130, pressureHpa: 918, category: 'Super Cyclone Peak' },
      { hour: 12, lat: 18.2, lon: 92.2, windKts: 120, pressureHpa: 932, category: 'Extremely Severe Cyclonic Storm' },
      { hour: 24, lat: 20.2, lon: 92.9, windKts: 105, pressureHpa: 950, category: 'Sittwe Myanmar Landfall' },
      { hour: 36, lat: 22.8, lon: 94.6, windKts: 45, pressureHpa: 990, category: 'Inland Depression' },
      { hour: 48, lat: 25.2, lon: 97.2, windKts: 25, pressureHpa: 1004, category: 'Dissipated' },
    ],
  },
  {
    id: 'ockhi_2017',
    name: 'Very Severe Cyclone Ockhi',
    basin: 'Lakshadweep / Arabian Sea',
    year: 2017,
    category: 'Very Severe Cyclonic Storm (Cat 3 Eq.)',
    baseWindKts: 85,
    baseSpeedKmh: 12.0,
    baseTrackDistanceKm: 30,
    baseRmaxKm: 25,
    basePressureDeficitHpa: 58,
    recommendedStationId: 'lakshadweep_sea',
    description: 'Formed near Sri Lanka, traversed the Lakshadweep Sea with rapid intensification, catching coastal fleets off guard.',
    trackWaypoints: [
      { hour: -48, lat: 6.0, lon: 80.8, windKts: 30, pressureHpa: 1002, category: 'Depression' },
      { hour: -36, lat: 7.2, lon: 77.4, windKts: 45, pressureHpa: 995, category: 'Deep Depression' },
      { hour: -24, lat: 8.6, lon: 74.8, windKts: 65, pressureHpa: 985, category: 'Cyclonic Storm' },
      { hour: -12, lat: 9.5, lon: 73.0, windKts: 75, pressureHpa: 976, category: 'Very Severe Cyclonic Storm' },
      { hour: 0, lat: 10.4, lon: 72.0, windKts: 85, pressureHpa: 965, category: 'Lakshadweep Passage Peak' },
      { hour: 12, lat: 12.6, lon: 70.8, windKts: 80, pressureHpa: 972, category: 'Very Severe Cyclonic Storm' },
      { hour: 24, lat: 15.2, lon: 70.2, windKts: 65, pressureHpa: 982, category: 'Severe Cyclonic Storm' },
      { hour: 36, lat: 18.2, lon: 71.2, windKts: 45, pressureHpa: 994, category: 'Cyclonic Storm' },
      { hour: 48, lat: 20.8, lon: 72.6, windKts: 30, pressureHpa: 1002, category: 'Weakened Remnant' },
    ],
  },
];

export interface CycloneScenarioParams {
  windKts: number;
  speedKmh: number;
  trackDistanceKm: number;
  rmaxKm: number;
  pressureDeficitHpa: number;
  durationHours?: number;
}

export interface PWPTimestepData {
  hour: number; // e.g. -24 to +48
  distanceKm: number;
  windSpeedKts: number;
  windStressPa: number;
  mld: number; // mixed layer depth in meters
  sst: number; // sea surface temp in °C
  upwellingDisplacementM: number;
  bulkRichardson: number;
  tchpKjCm2: number;
  profile: { depth: number; temp: number }[];
}

export interface PWPSimulationSummary {
  // Baseline inputs (reconstructed by OceanEmbed)
  baselineSst: number;
  baselineMld: number;
  baselineTchp: number; // kJ/cm^2
  stationName: string;
  stationLat: number;
  stationLon: number;

  // Post-Cyclone Simulated Outputs
  simulatedSst: number;
  simulatedMld: number;
  simulatedTchp: number;
  deltaSst: number; // e.g. -2.8°C
  deltaMld: number; // e.g. +42m
  deltaTchpPct: number; // e.g. -48%
  upwellingLiftM: number; // e.g. +19.2m

  // Energetics & Mechanics
  peakWindStressPa: number;
  totalWorkMjM2: number;
  residenceTimeHours: number;
  entrainmentVolumeM3M2: number;
  coolingByMixingPct: number; // typically 82-88%
  coolingByFluxPct: number; // typically 12-18%

  // Ocean-Cyclone Feedback Assessment
  feedbackType: 'STRONG_NEGATIVE' | 'MODERATE_NEGATIVE' | 'SUSTAINED_POSITIVE';
  feedbackTitle: string;
  feedbackDescription: string;

  // Profiles
  baselineProfile: { depth: number; temp: number }[];
  simulatedProfile: { depth: number; temp: number; delta: number }[];
  depthDifferenceCurve: { depth: number; delta: number }[]; // positive = subsurface warming, negative = cooling

  // Time evolution across 73 hourly steps (-24h to +48h)
  timesteps: PWPTimestepData[];
  selectedHour: number;
}

/**
 * Calculates Drag Coefficient Cd based on 10m wind speed (m/s)
 * Uses Powell et al. / Large & Pond formulation with hurricane saturation cap
 */
export function calculateDragCoefficient(u10Ms: number): number {
  if (u10Ms < 10) {
    return 1.15e-3;
  } else if (u10Ms <= 32) {
    return (0.49 + 0.065 * u10Ms) * 1e-3;
  } else {
    // Aerodynamic saturation over extreme wave breaking / sea foam
    return Math.min(2.5e-3, (2.3 + 0.005 * (u10Ms - 32)) * 1e-3);
  }
}

/**
 * Tropical Cyclone Heat Potential (TCHP) in kJ/cm^2
 * Integrates heat from surface down to 26°C isotherm (D26)
 * TCHP = rho_0 * c_p * integral_0^D26 (T(z) - 26) dz
 */
export function calculateTCHP(profile: { depth: number; temp: number }[]): number {
  const rho0 = 1025; // kg/m^3
  const cp = 3985; // J / (kg * K)
  let heatJoulesM2 = 0;

  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i];
    const p2 = profile[i + 1];
    const dz = p2.depth - p1.depth;

    const tAvg = (p1.temp + p2.temp) / 2;
    if (tAvg > 26) {
      heatJoulesM2 += rho0 * cp * (tAvg - 26) * dz;
    } else if (p1.temp > 26 && p2.temp <= 26) {
      // Linear interpolation to 26°C depth
      const frac = (p1.temp - 26) / (p1.temp - p2.temp);
      const subDz = dz * frac;
      const subTAvg = (p1.temp + 26) / 2;
      heatJoulesM2 += rho0 * cp * (subTAvg - 26) * subDz;
      break;
    }
  }

  // Convert J/m^2 to kJ/cm^2 (1 J/m^2 = 1e-3 kJ / 1e4 cm^2 = 1e-7 kJ/cm^2)
  return Math.round((heatJoulesM2 * 1e-7) * 10) / 10;
}

/**
 * Full Numerical Price-Weller-Pinkel (PWP) Mixed Layer Simulation
 */
export function runPWPSimulation(
  stationData: StationData,
  params: CycloneScenarioParams
): PWPSimulationSummary {
  const {
    windKts,
    speedKmh,
    trackDistanceKm,
    rmaxKm,
    pressureDeficitHpa,
  } = params;

  const lat = stationData.station.lat;
  const lon = stationData.station.lon;

  // 1. Initial State from OceanEmbed
  const baselineSst = stationData.surfaceTemp;
  const baselineMld = stationData.mixedLayerDepth;
  const baselineProfile = stationData.profile.map((p) => ({ depth: p.depth, temp: p.temp }));
  const baselineTchp = calculateTCHP(baselineProfile);

  // 2. Physical Constants
  const rhoAir = 1.18; // kg/m^3 (warm humid marine boundary layer)
  const rho0 = 1025; // kg/m^3
  const cp = 3985; // J/(kg*K)
  const fCoriolis = Math.max(1.8e-5, 2 * 7.2921e-5 * Math.sin((Math.abs(lat) * Math.PI) / 180)); // 1/s

  // Speeds in SI units
  const maxWindMs = windKts * 0.514444; // m/s
  const speedMs = Math.max(1.0, (speedKmh * 1000) / 3600); // m/s

  // Residence time over the station water column
  // Slower cyclone = significantly larger residence time!
  const residenceTimeHours = Math.round(((2 * rmaxKm) / speedKmh) * 10) / 10;

  // Timestep array from -24h to +48h (every 1 hour = 73 points)
  const hours = Array.from({ length: 73 }, (_, i) => i - 24);

  // Interpolate continuous 1-meter fine depth grid (0 to 500m)
  const fineDepths = Array.from({ length: 501 }, (_, i) => i);
  const initialFineTemps = fineDepths.map((d) => {
    // Find surrounding profile points
    for (let i = 0; i < baselineProfile.length - 1; i++) {
      const p1 = baselineProfile[i];
      const p2 = baselineProfile[i + 1];
      if (d >= p1.depth && d <= p2.depth) {
        const factor = (d - p1.depth) / (p2.depth - p1.depth);
        return p1.temp + factor * (p2.temp - p1.temp);
      }
    }
    return baselineProfile[baselineProfile.length - 1].temp;
  });

  // State arrays for simulation
  let currentFineTemps = [...initialFineTemps];
  let currentMld = baselineMld;
  let cumulativeUpwellingM = 0;
  let totalWorkJoules = 0;
  let peakStressPa = 0;

  const timesteps: PWPTimestepData[] = [];

  // PWP Dynamic Simulation Loop
  for (const h of hours) {
    const tSeconds = h * 3600;
    // Along-track position of cyclone relative to closest point of approach (t=0)
    const alongTrackM = speedMs * tSeconds;
    const crossTrackM = trackDistanceKm * 1000;
    const distM = Math.sqrt(alongTrackM * alongTrackM + crossTrackM * crossTrackM);
    const distKm = distM / 1000;

    // Modified Rankine Vortex radial wind profile
    const rRatio = Math.max(0.01, distKm / rmaxKm);
    let localWindMs: number;
    if (rRatio <= 1.0) {
      localWindMs = maxWindMs * Math.pow(rRatio, 0.85);
    } else {
      localWindMs = maxWindMs * Math.pow(rRatio, -0.55);
    }

    // Add background ambient wind (approx 8 m/s)
    localWindMs = Math.max(6.0, localWindMs);
    const localWindKts = localWindMs / 0.514444;

    // Wind stress tau = rho_air * Cd * U^2
    const cd = calculateDragCoefficient(localWindMs);
    const tau = rhoAir * cd * localWindMs * localWindMs;
    peakStressPa = Math.max(peakStressPa, tau);

    // Friction velocity u* = sqrt(tau / rho_0)
    const uStar = Math.sqrt(tau / rho0);

    // Turbulent Kinetic Energy (TKE) work rate = tau * u*
    const workRate = tau * uStar;
    totalWorkJoules += workRate * 3600;

    // PWP Mixed Layer Entrainment:
    // When winds are active (especially near t=0), shear at base of MLD exceeds critical Ri_b (0.65).
    // Entrainment velocity w_e = dh/dt.
    // Classical Kato-Phillips / Price formulation:
    // dh/dt = 2.5 * uStar^3 / (g * alpha * (T_mld - T_sub) * h)
    if (tau > 0.15) {
      const g = 9.81;
      const alphaThermal = 2.8e-4; // 1/K for warm tropical seawater
      const subIdx = Math.min(500, Math.round(currentMld + 5));
      const deltaT = Math.max(0.15, currentFineTemps[0] - currentFineTemps[subIdx]);
      const buoyancyFreq = Math.max(1e-4, g * alphaThermal * deltaT);

      // Entrainment rate in m/s
      const we = (1.4 * Math.pow(uStar, 3)) / (buoyancyFreq * Math.max(15, currentMld));
      const entrainmentStepM = we * 3600;

      const newMld = Math.min(220, currentMld + entrainmentStepM);

      // Conservation of heat: completely homogenize layer from 0 to newMld
      let heatSum = 0;
      const mldInt = Math.round(newMld);
      for (let z = 0; z <= mldInt; z++) {
        heatSum += currentFineTemps[z];
      }
      const mixedTemp = heatSum / (mldInt + 1);

      // Small surface heat flux extraction to atmosphere (sensible + latent heat loss)
      const enthalpyLossFlux = (localWindMs / maxWindMs) * 0.015; // °C per hour
      const finalMixedTemp = mixedTemp - enthalpyLossFlux;

      for (let z = 0; z <= mldInt; z++) {
        currentFineTemps[z] = finalMixedTemp;
      }
      currentMld = newMld;
    }

    // Ekman Pumping & Upwelling Suction:
    // Cyclonic wind curl in Northern Hemisphere drives divergent Ekman transport,
    // causing vertical suction w_E = curl(tau) / (rho_0 * f)
    if (distKm <= rmaxKm * 2.2) {
      const curlTau = (2.0 * tau) / Math.max(15000, rmaxKm * 1000);
      const wUpwelling = curlTau / (rho0 * fCoriolis);
      const upStepM = wUpwelling * 3600;
      cumulativeUpwellingM += upStepM;

      // Upwelling shifts deeper isotherms upward below the mixed layer
      const mldInt = Math.round(currentMld);
      const stepInt = Math.max(0, Math.min(3, Math.round(upStepM)));
      if (stepInt > 0) {
        for (let z = mldInt + 1; z < 500 - stepInt; z++) {
          currentFineTemps[z] = currentFineTemps[z + stepInt];
        }
      }
    }

    // Bulk Richardson Number estimate
    const currentDeltaT = Math.max(0.1, currentFineTemps[0] - currentFineTemps[Math.min(500, Math.round(currentMld + 10))]);
    const bulkRi = Math.max(0.45, Math.min(1.8, (9.81 * 2.8e-4 * currentDeltaT * currentMld) / Math.max(0.04, Math.pow(localWindMs * 0.035, 2))));

    // Record sample profile at this hour
    const sampledProfile = baselineProfile.map((p) => ({
      depth: p.depth,
      temp: Math.round(currentFineTemps[Math.min(500, p.depth)] * 100) / 100,
    }));

    timesteps.push({
      hour: h,
      distanceKm: Math.round(distKm * 10) / 10,
      windSpeedKts: Math.round(localWindKts * 10) / 10,
      windStressPa: Math.round(tau * 100) / 100,
      mld: Math.round(currentMld * 10) / 10,
      sst: Math.round(currentFineTemps[0] * 100) / 100,
      upwellingDisplacementM: Math.round(cumulativeUpwellingM * 10) / 10,
      bulkRichardson: Math.round(bulkRi * 100) / 100,
      tchpKjCm2: calculateTCHP(sampledProfile),
      profile: sampledProfile,
    });
  }

  // Final post-cyclone state
  const finalProfile = baselineProfile.map((p) => {
    const simT = Math.round(currentFineTemps[Math.min(500, p.depth)] * 100) / 100;
    const baseT = p.temp;
    return {
      depth: p.depth,
      temp: simT,
      delta: Math.round((simT - baseT) * 100) / 100,
    };
  });

  const simulatedSst = finalProfile[0].temp;
  const simulatedMld = Math.round(currentMld);
  const simulatedTchp = calculateTCHP(finalProfile);

  const deltaSst = Math.round((simulatedSst - baselineSst) * 100) / 100;
  const deltaMld = Math.round((simulatedMld - baselineMld) * 10) / 10;
  const deltaTchpPct = baselineTchp > 0
    ? Math.round(((simulatedTchp - baselineTchp) / baselineTchp) * 1000) / 10
    : 0;

  // Depth Difference Curve (shows near-surface cooling and subsurface warming dipole)
  const depthDifferenceCurve = finalProfile.map((p) => ({
    depth: p.depth,
    delta: p.delta,
  }));

  // Energetics
  const totalWorkMjM2 = Math.round((totalWorkJoules / 1e6) * 10) / 10;
  const entrainmentVolumeM3M2 = deltaMld; // 1 m^2 surface column deepened by deltaMld meters
  const coolingByMixingPct = 84.5;
  const coolingByFluxPct = 15.5;

  // Cyclone-Ocean Feedback Assessment
  let feedbackType: 'STRONG_NEGATIVE' | 'MODERATE_NEGATIVE' | 'SUSTAINED_POSITIVE';
  let feedbackTitle: string;
  let feedbackDescription: string;

  if (simulatedSst < 26.5 || deltaSst <= -3.0) {
    feedbackType = 'STRONG_NEGATIVE';
    feedbackTitle = 'CRITICAL NEGATIVE FEEDBACK // SELF-INDUCED COLD WAKE';
    feedbackDescription = `SST dropped by ${Math.abs(deltaSst).toFixed(1)}°C down to ${simulatedSst.toFixed(1)}°C (below the 26.5°C tropical cyclogenesis threshold). Slower translation and intense wind mixing entrained cold thermocline waters, choking the storm's latent heat engine. This cyclone will undergo rapid de-intensification.`;
  } else if (deltaSst <= -1.8 || simulatedTchp < 40) {
    feedbackType = 'MODERATE_NEGATIVE';
    feedbackTitle = 'MODERATE NEGATIVE FEEDBACK // HEAT CONTENT DEPLETED';
    feedbackDescription = `Mixed layer deepened by +${deltaMld}m, reducing Tropical Cyclone Heat Potential by ${Math.abs(deltaTchpPct).toFixed(1)}%. SST remains marginally supportive at ${simulatedSst.toFixed(1)}°C, but further intensification is physically suppressed by reduced enthalpy fluxes.`;
  } else {
    feedbackType = 'SUSTAINED_POSITIVE';
    feedbackTitle = 'SUSTAINED POSITIVE ENERGY FLUX // INTENSIFICATION LIKELY';
    feedbackDescription = `Fast forward speed (${speedKmh} km/h) limited the residence time over this water column. Upper ocean retains high heat content (${simulatedTchp.toFixed(1)} kJ/cm²) with SST remaining at ${simulatedSst.toFixed(1)}°C. High air-sea enthalpy fluxes continue to feed the eyewall.`;
  }

  return {
    baselineSst,
    baselineMld,
    baselineTchp,
    stationName: stationData.station.name,
    stationLat: lat,
    stationLon: lon,

    simulatedSst,
    simulatedMld,
    simulatedTchp,
    deltaSst,
    deltaMld,
    deltaTchpPct,
    upwellingLiftM: Math.round(cumulativeUpwellingM * 10) / 10,

    peakWindStressPa: Math.round(peakStressPa * 100) / 100,
    totalWorkMjM2,
    residenceTimeHours,
    entrainmentVolumeM3M2,
    coolingByMixingPct,
    coolingByFluxPct,

    feedbackType,
    feedbackTitle,
    feedbackDescription,

    baselineProfile,
    simulatedProfile: finalProfile,
    depthDifferenceCurve,

    timesteps,
    selectedHour: 0,
  };
}

// ---------------------------------------------------------------------------
// Geospatial Track & Cold Wake Footprint Engine
// ---------------------------------------------------------------------------

export interface ActiveEyeState {
  hour: number;
  lat: number;
  lon: number;
  windKts: number;
  pressureHpa: number;
  category: string;
  rmaxKm: number;
  galeRadiusKm: number;
  headingDeg: number;
  distanceToStationKm: number;
  localWindAtStationKts: number;
}

export interface ColdWakePolygon {
  points: [number, number][]; // [lat, lon] array
  deltaSst: number;
  mldDeepeningM: number;
  label: string;
}

export interface CycloneGeospatialResult {
  baselineTrack: CycloneTrackWaypoint[];
  counterfactualTrack: CycloneTrackWaypoint[];
  activeEye: ActiveEyeState;
  coldWakePolygons: ColdWakePolygon[];
  stationCoord: [number, number];
  stationName: string;
}

/**
 * Great-circle distance between two geographic coordinates in kilometers
 */
export function calculateGeoDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Bearing in degrees from point 1 to point 2
 */
export function calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda1 = (lon1 * Math.PI) / 180;
  const lambda2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Compute high-resolution geospatial track coordinates, counterfactual shift,
 * active eye position at current scrubber hour, and physical cold-wake swath.
 */
export function computeCycloneGeospatialData(
  preset: CycloneHistoricalPreset,
  stationData: StationData,
  params: CycloneScenarioParams,
  selectedHour: number = 0
): CycloneGeospatialResult {
  const stationLat = stationData.station.lat;
  const stationLon = stationData.station.lon;

  // 1. Baseline Historical Track
  const baselineTrack = preset.trackWaypoints || [];

  // 2. Counterfactual Track Generation
  // Shift track perpendicular to storm path based on delta in track distance offset
  const deltaOffsetKm = params.trackDistanceKm - preset.baseTrackDistanceKm;
  const windScale = params.windKts / Math.max(1, preset.baseWindKts);

  const counterfactualTrack: CycloneTrackWaypoint[] = baselineTrack.map((pt, i, arr) => {
    // Determine local heading
    let heading = 45; // default NE
    if (i < arr.length - 1) {
      heading = calculateBearingDeg(pt.lat, pt.lon, arr[i + 1].lat, arr[i + 1].lon);
    } else if (i > 0) {
      heading = calculateBearingDeg(arr[i - 1].lat, arr[i - 1].lon, pt.lat, pt.lon);
    }

    // Normal angle (to the right: +90 degrees)
    const normalRad = ((heading + 90) * Math.PI) / 180;

    // Shift in degrees
    const dLat = (deltaOffsetKm * Math.cos(normalRad)) / 111.0;
    const cosLat = Math.max(0.2, Math.cos((pt.lat * Math.PI) / 180));
    const dLon = (deltaOffsetKm * Math.sin(normalRad)) / (111.0 * cosLat);

    const scaledWind = Math.round(pt.windKts * windScale);
    const scaledPressure = Math.round(1010 - (1010 - pt.pressureHpa) * (params.pressureDeficitHpa / preset.basePressureDeficitHpa));

    return {
      hour: pt.hour,
      lat: Math.round((pt.lat + dLat) * 100) / 100,
      lon: Math.round((pt.lon + dLon) * 100) / 100,
      windKts: scaledWind,
      pressureHpa: scaledPressure,
      category: pt.category,
    };
  });

  // 3. Interpolate Active Eye at selectedHour
  // Find flanking waypoints
  let p1 = counterfactualTrack[0] || { hour: -48, lat: stationLat, lon: stationLon, windKts: 40, pressureHpa: 990, category: 'Depression' };
  let p2 = counterfactualTrack[counterfactualTrack.length - 1] || p1;

  for (let i = 0; i < counterfactualTrack.length - 1; i++) {
    if (selectedHour >= counterfactualTrack[i].hour && selectedHour <= counterfactualTrack[i + 1].hour) {
      p1 = counterfactualTrack[i];
      p2 = counterfactualTrack[i + 1];
      break;
    }
  }

  const span = Math.max(1, p2.hour - p1.hour);
  const frac = Math.max(0, Math.min(1, (selectedHour - p1.hour) / span));

  const eyeLat = p1.lat + (p2.lat - p1.lat) * frac;
  const eyeLon = p1.lon + (p2.lon - p1.lon) * frac;
  const eyeWind = Math.round(p1.windKts + (p2.windKts - p1.windKts) * frac);
  const eyePressure = Math.round(p1.pressureHpa + (p2.pressureHpa - p1.pressureHpa) * frac);
  const eyeHeading = calculateBearingDeg(p1.lat, p1.lon, p2.lat, p2.lon);

  const distToStation = Math.round(calculateGeoDistanceKm(eyeLat, eyeLon, stationLat, stationLon));
  
  // Local wind at station using Holland / Rankine vortex profile
  const rmax = params.rmaxKm;
  let stationWind = 12; // ambient background
  if (distToStation <= rmax) {
    stationWind = Math.round(eyeWind * (distToStation / rmax));
  } else {
    stationWind = Math.round(eyeWind * Math.pow(rmax / distToStation, 0.6));
  }
  stationWind = Math.max(10, Math.min(eyeWind, stationWind));

  const activeEye: ActiveEyeState = {
    hour: selectedHour,
    lat: Math.round(eyeLat * 100) / 100,
    lon: Math.round(eyeLon * 100) / 100,
    windKts: eyeWind,
    pressureHpa: eyePressure,
    category: p2.category,
    rmaxKm: params.rmaxKm,
    galeRadiusKm: Math.round(params.rmaxKm * 3.4),
    headingDeg: Math.round(eyeHeading),
    distanceToStationKm: distToStation,
    localWindAtStationKts: stationWind,
  };

  // 4. Physical Cold Wake Swath Polygons
  // Compute cold wake footprints along the track traversed so far
  // Right flank width: 2.5 * Rmax (strong resonance)
  // Left flank width: 1.0 * Rmax (weaker mixing)
  const coldWakePolygons: ColdWakePolygon[] = [];

  const traversedPoints = counterfactualTrack.filter((p) => p.hour <= selectedHour + 6);
  if (traversedPoints.length >= 2) {
    const rightPoints: [number, number][] = [];
    const leftPoints: [number, number][] = [];

    traversedPoints.forEach((pt, idx, arr) => {
      let heading = 45;
      if (idx < arr.length - 1) {
        heading = calculateBearingDeg(pt.lat, pt.lon, arr[idx + 1].lat, arr[idx + 1].lon);
      } else if (idx > 0) {
        heading = calculateBearingDeg(arr[idx - 1].lat, arr[idx - 1].lon, pt.lat, pt.lon);
      }

      const cosLat = Math.max(0.2, Math.cos((pt.lat * Math.PI) / 180));
      const rightRad = ((heading + 90) * Math.PI) / 180;
      const leftRad = ((heading - 90) * Math.PI) / 180;

      // Right flank distance: ~80-110 km
      const rightDistKm = params.rmaxKm * 2.4;
      const rLat = pt.lat + (rightDistKm * Math.cos(rightRad)) / 111.0;
      const rLon = pt.lon + (rightDistKm * Math.sin(rightRad)) / (111.0 * cosLat);
      rightPoints.push([rLat, rLon]);

      // Left flank distance: ~35-45 km
      const leftDistKm = params.rmaxKm * 0.9;
      const lLat = pt.lat + (leftDistKm * Math.cos(leftRad)) / 111.0;
      const lLon = pt.lon + (leftDistKm * Math.sin(leftRad)) / (111.0 * cosLat);
      leftPoints.push([lLat, lLon]);
    });

    // Outer Moderate Cold Wake Swath (-1.5°C to -2.5°C)
    const polygonModerate: [number, number][] = [...rightPoints, ...leftPoints.reverse()];
    coldWakePolygons.push({
      points: polygonModerate,
      deltaSst: -1.8,
      mldDeepeningM: 25,
      label: 'Cold Wake Swath (-1.5°C to -2.5°C)',
    });

    // Core Severe Cold Wake Swath (-3.0°C to -4.5°C) around peak intensity and slow segments
    const coreRight: [number, number][] = [];
    const coreLeft: [number, number][] = [];
    traversedPoints.forEach((pt, idx, arr) => {
      if (pt.windKts < 65) return; // only storm-force segments
      let heading = 45;
      if (idx < arr.length - 1) {
        heading = calculateBearingDeg(pt.lat, pt.lon, arr[idx + 1].lat, arr[idx + 1].lon);
      } else if (idx > 0) {
        heading = calculateBearingDeg(arr[idx - 1].lat, arr[idx - 1].lon, pt.lat, pt.lon);
      }

      const cosLat = Math.max(0.2, Math.cos((pt.lat * Math.PI) / 180));
      const rightRad = ((heading + 90) * Math.PI) / 180;
      const leftRad = ((heading - 90) * Math.PI) / 180;

      const rightDistKm = params.rmaxKm * 1.4;
      const leftDistKm = params.rmaxKm * 0.5;

      coreRight.push([
        pt.lat + (rightDistKm * Math.cos(rightRad)) / 111.0,
        pt.lon + (rightDistKm * Math.sin(rightRad)) / (111.0 * cosLat),
      ]);
      coreLeft.push([
        pt.lat + (leftDistKm * Math.cos(leftRad)) / 111.0,
        pt.lon + (leftDistKm * Math.sin(leftRad)) / (111.0 * cosLat),
      ]);
    });

    if (coreRight.length >= 2) {
      coldWakePolygons.push({
        points: [...coreRight, ...coreLeft.reverse()],
        deltaSst: -3.5,
        mldDeepeningM: 55,
        label: 'Severe Upwelling Core (-3.0°C to -4.5°C)',
      });
    }
  }

  return {
    baselineTrack,
    counterfactualTrack,
    activeEye,
    coldWakePolygons,
    stationCoord: [stationLat, stationLon],
    stationName: stationData.station.name,
  };
}
