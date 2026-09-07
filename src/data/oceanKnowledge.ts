// Comprehensive Local Tactical Intelligence & Knowledge Engine for OceanEmbed
// Provides immediate, rich, real answers to oceanographic, fishing, marine biology, weather, and science questions
// even when offline or without an external API key.

export interface QuestionAnswer {
  keywords: string[];
  title: string;
  response: (context: { stationName: string; sst: number; mld: number; sss: number }) => string;
}

export const LOCAL_KNOWLEDGE_BASE: QuestionAnswer[] = [
  {
    keywords: ['cyclone', 'cyclones', 'hurricane', 'typhoon', 'storm', 'depression', 'low pressure'],
    title: 'CYCLONIC DYNAMICS // BAY OF BENGAL VS ARABIAN SEA',
    response: (ctx) =>
      `The Bay of Bengal experiences four to five times more cyclones than the Arabian Sea. This is due to three factors: very high Sea Surface Temperatures consistently exceeding 28.5 degrees Celsius, shallow low-salinity river freshwater lenses that trap solar heat in the upper 20 meters, and frequent remnant tropical depressions moving across the Andaman Sea from the Pacific. In contrast, the Arabian Sea experiences stronger vertical wind shear and cooler upwelled waters along the Somali coast that suppress cyclone intensification.`
  },
  {
    keywords: ['monsoon', 'southwest monsoon', 'summer monsoon', 'northeast monsoon', 'rain', 'winds'],
    title: 'MONSOONAL CIRCULATION // NORTH INDIAN OCEAN',
    response: (ctx) =>
      `The Indian Summer Monsoon is driven by differential thermal heating between the Asian landmass and the Indian Ocean. During June to September, strong southwesterly low-level Findlater jet winds exceed 25 knots, driving intense coastal upwelling off Somalia and the southwest coast of India. In winter (November to February), the winds reverse to northeasterly, driving cold evaporative cooling and convective mixing in the northern Arabian Sea.`
  },
  {
    keywords: ['thermocline', 'mixed layer', 'mld', 'isotherm', 'isothermal', 'stratification'],
    title: 'VERTICAL THERMAL STRUCTURE // WATER COLUMN PHYSICS',
    response: (ctx) =>
      `The thermocline is the ocean layer where water temperature drops rapidly with increasing depth. Above it lies the turbulent Mixed Layer, currently measured at ${ctx.mld} meters depth at ${ctx.stationName}, where wind and waves homogenize temperature. Below the mixed layer, the main thermocline transitions from warm surface waters (${ctx.sst.toFixed(1)}°C) down to approximately 6.8°C at 1000 meters abyss depth. The depth and sharpness of this thermocline governs nutrient upwelling and fish distribution.`
  },
  {
    keywords: ['satellite', 'measure', 'altimetry', 'altimeter', 'radiometer', 'radar', 'smap', 'modis', 'sentinel'],
    title: 'SATELLITE REMOTE SENSING // MULTI-SENSOR RECONSTRUCTION',
    response: (ctx) =>
      `Satellites monitor the ocean using specialized electromagnetic bands: Infrared and microwave radiometers (like MODIS and VIIRS) measure Sea Surface Temperature via thermal skin emissions. Radar altimeters (like Sentinel-3 and Jason-3) fire precision microwave radar pulses to calculate Sea Surface Height to within 2 centimeters, detecting mesoscale eddies. Microwave radiometers (SMAP and SMOS) measure ocean emissivity at 1.4 gigahertz to derive Sea Surface Salinity.`
  },
  {
    keywords: ['deep', 'deepest', 'trench', 'abyss', 'bottom', 'java trench', 'sunda'],
    title: 'BATHYMETRY & TRENCHES // INDIAN OCEAN ABYSS',
    response: (ctx) =>
      `The deepest point in the Indian Ocean is the Diamantina Deep in the Diamantina Trench at approximately 8,047 meters, followed by the Sunda (Java) Trench south of Sumatra at 7,290 meters. The Central Indian Ocean Basin averages 4,000 to 5,000 meters depth, bordered by the Ninety East Ridge and the Central Indian Ridge.`
  },
  {
    keywords: ['fish', 'fishing', 'catch', 'tuna', 'mackerel', 'pomfret', 'hilsa', 'pfz', 'bait'],
    title: 'POTENTIAL FISHING ZONE (PFZ) ADVISORY',
    response: (ctx) =>
      `Optimal fishing zones are located along thermal and salinity fronts where upwelling brings deep nutrients to the surface. At ${ctx.stationName}, with surface temperature at ${ctx.sst.toFixed(1)}°C and Mixed Layer Depth at ${ctx.mld} meters, commercial pelagic schools (including Tuna, Mackerel, and Kingfish) aggregate along the thermocline inflection between ${Math.round(ctx.mld * 0.8)}m and ${Math.round(ctx.mld * 1.5)}m depth. Early morning gillnetting and trolling along bathymetric shelf breaks yield optimal catch rates.`
  },
  {
    keywords: ['salinity', 'salt', 'freshwater', 'ganges', 'brahmaputra', 'indus'],
    title: 'SALINITY DISTRIBUTION // SSS CONTRAST',
    response: (ctx) =>
      `The North Indian Ocean exhibits a stark salinity contrast: The Arabian Sea has high salinity (35.5 to 36.8 PSU) due to heavy evaporation exceeding precipitation. In contrast, the Bay of Bengal has low salinity (28.0 to 33.5 PSU) caused by massive freshwater discharge from the Ganges-Brahmaputra, Irrawaddy, and Godavari rivers, creating a persistent freshwater barrier layer.`
  },
  {
    keywords: ['shark', 'whale', 'dolphin', 'turtle', 'mammal', 'marine life', 'coral', 'reef'],
    title: 'MARINE BIODIVERSITY & MIGRATION',
    response: (ctx) =>
      `The North Indian Ocean hosts rich marine ecosystems, including Blue Whale populations off Sri Lanka, Whale Shark aggregations off Gujarat and Lakshadweep, and pristine coral atolls. Pelagic species follow seasonal chlorophyll blooms generated by monsoonal upwelling.`
  },
  {
    keywords: ['argo', 'float', 'buoy', 'in-situ', 'core beam'],
    title: 'ARGO PROFILING NETWORK // IN-SITU VALIDATION',
    response: (ctx) =>
      `The global Argo program maintains over 4,000 autonomous robotic floats. Each float drifts at 1,000 meters depth, sinks to 2,000 meters every 10 days, and collects high-precision temperature, salinity, and pressure profiles as it ascends to beam data to satellites. This provides the in-situ truth used to calibrate satellite models.`
  },
  {
    keywords: ['who are you', 'what are you', 'your name', 'aegis', 'agent', 'help'],
    title: 'AEGIS TACTICAL SYSTEM OVERVIEW',
    response: (ctx) =>
      `I am AEGIS, an AI oceanographic intelligence and coastal surveillance agent. I monitor the 3D water column across the North Indian Ocean from surface down to 1000 meters depth, track thermal anomalies, analyze satellite telemetry, and provide real-time fishing advisories.`
  }
];

export function getLocalIntelligenceAnswer(
  query: string,
  context: { stationName: string; sst: number; mld: number; sss: number }
): { title: string; summary: string } {
  const clean = query.toLowerCase();

  // Find best match in knowledge base
  for (const item of LOCAL_KNOWLEDGE_BASE) {
    if (item.keywords.some((kw) => clean.includes(kw))) {
      return {
        title: item.title,
        summary: item.response(context),
      };
    }
  }

  // General fallback for unmatched or open-ended questions
  return {
    title: `TACTICAL BRIEFING // ${context.stationName.toUpperCase()}`,
    summary: `Regarding your query "${query}": At ${context.stationName}, sea surface temperature is currently ${context.sst.toFixed(1)} degrees Celsius with a mixed layer depth of ${context.mld} meters and salinity at ${context.sss.toFixed(1)} practical salinity units. Vertical thermal gradients indicate standard seasonal stratification across the basin column down to 1000 meters abyss depth.`,
  };
}
