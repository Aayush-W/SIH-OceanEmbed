import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  X,
  Fish,
  Send,
  Waves,
  Compass,
  Anchor,
  Activity,
  Maximize2,
  Loader2,
  Bot
} from 'lucide-react';
import { STATIONS, getStationData } from '../data/oceanData';
import { getLocalIntelligenceAnswer } from '../data/oceanKnowledge';
import { NavScreen, SurfaceLayer, Station, GlobeMapStyle } from '../types';
import { BasemapType } from './SatelliteMapExplorer';

interface TacticalVoiceAgentProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  selectedStationId: string | null;
  onSelectStation: (id: string | null) => void;
  activeLayer: SurfaceLayer;
  onChangeLayer: (layer: SurfaceLayer) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  currentDate: string;
  onDateChange?: (date: string) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  globeStyle?: GlobeMapStyle;
  onChangeGlobeStyle?: (style: GlobeMapStyle) => void;
  basemap?: BasemapType;
  onChangeBasemap?: (b: BasemapType) => void;
  showWaterRaster?: boolean;
  onToggleWaterRaster?: (show: boolean) => void;
  rasterOpacity?: number;
  onChangeRasterOpacity?: (opacity: number) => void;
  showStationMarkers?: boolean;
  onToggleStationMarkers?: (show: boolean) => void;
}

interface AgentReport {
  title: string;
  query: string;
  transcript: string;
  summary: string;
  stationData?: {
    station: Station;
    sst: number;
    mld: number;
    thermoclineDepth: number;
    upwellingStatus: string;
    fishingAdvice: string;
    targetSpecies: string[];
    optimalDepth: string;
    seaConditions: string;
    salinity: number;
    density: number;
  };
  hasCrossSection?: boolean;
  actionTaken?: string;
  category: 'NAVIGATION' | 'STATION' | 'FISHERMAN' | 'SCIENTIST' | 'ORBIT' | 'LAYER' | 'GENERAL';
}

// Convert technical scientific symbols to clear phonetic text for natural speech synthesis
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[*#_`]/g, '') // remove markdown artifacts
    .replace(/°C/g, ' degrees Celsius')
    .replace(/\bPSU\b/g, ' practical salinity units')
    .replace(/\bm\/s\b/g, ' meters per second')
    .replace(/\bm\/hr\b/g, ' meters per hour')
    .replace(/\bMLD\b/g, 'Mixed Layer Depth')
    .replace(/\bSST\b/g, 'Sea Surface Temperature')
    .replace(/\bSSS\b/g, 'Sea Surface Salinity')
    .replace(/\bSSH\b/g, 'Sea Surface Height')
    .replace(/\bPFZ\b/g, 'Potential Fishing Zone')
    .replace(/1-sigma/g, 'one-sigma')
    .replace(/±/g, 'plus or minus ')
    .replace(/\bdMLD\/dt\b/g, 'rate of mixed layer change')
    .replace(/\bD20\b/g, '20 degree isotherm depth')
    .replace(/\s+/g, ' ')
    .trim();
}

export const TacticalVoiceAgent: React.FC<TacticalVoiceAgentProps> = ({
  currentScreen,
  onNavigate,
  selectedStationId,
  onSelectStation,
  activeLayer,
  onChangeLayer,
  autoRotate,
  onToggleAutoRotate,
  currentDate,
  onDateChange,
  isPlaying,
  onTogglePlay,
  globeStyle,
  onChangeGlobeStyle,
  basemap,
  onChangeBasemap,
  showWaterRaster,
  onToggleWaterRaster,
  rasterOpacity,
  onChangeRasterOpacity,
  showStationMarkers,
  onToggleStationMarkers,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const cachedVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Initialize Web Speech API & Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        if (synthRef.current) {
          cachedVoicesRef.current = synthRef.current.getVoices();
        }
      };

      updateVoices();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const text = event.results[current][0].transcript;
          setTranscript(text);

          if (event.results[current].isFinal) {
            handleVoiceCommand(text);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Text-To-Speech speaker with browser-resilience and natural cadence
  const speak = useCallback(
    (rawText: string) => {
      if (isMuted || !synthRef.current) return;

      try {
        synthRef.current.cancel(); // Stop any ongoing utterance
        if (synthRef.current.paused) {
          synthRef.current.resume();
        }

        const cleanText = cleanTextForSpeech(rawText);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        // Select the most natural available voice
        const voices = cachedVoicesRef.current.length > 0 ? cachedVoicesRef.current : synthRef.current.getVoices();
        const preferredVoice =
          voices.find(
            (v) =>
              (v.lang.startsWith('en') || v.lang === 'en-US') &&
              (v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Samantha') ||
                v.name.includes('Daniel') ||
                v.name.includes('Karen') ||
                v.name.includes('Serena'))
          ) || voices.find((v) => v.lang.startsWith('en'));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
        setIsSpeaking(false);
      }
    },
    [isMuted]
  );

  // Toggle voice listening
  const toggleListening = () => {
    if (!speechSupported) {
      setShowPopup(true);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  // Comprehensive Natural Language Command & Intelligence Engine with Gemini Backend
  const handleVoiceCommand = async (cmd: string) => {
    const raw = cmd.toLowerCase().trim();
    setTranscript(cmd);
    setShowPopup(true);

    // STEP 1: DETECT TARGET REGION / STATION IF MENTIONED
    let targetStation: Station | undefined;

    if (
      raw.includes('mumbai') ||
      raw.includes('bombay') ||
      raw.includes('maharashtra') ||
      raw.includes('arabian') ||
      raw.includes('arabia') ||
      raw.includes('goa') ||
      raw.includes('gujarat') ||
      raw.includes('ratnagiri')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'arabian_sea_basin') || STATIONS[1];
    } else if (
      raw.includes('bengal') ||
      raw.includes('bob') ||
      raw.includes('bay of bengal') ||
      raw.includes('chennai') ||
      raw.includes('kolkata') ||
      raw.includes('calcutta') ||
      raw.includes('odisha') ||
      raw.includes('orissa') ||
      raw.includes('vizag') ||
      raw.includes('visakhapatnam') ||
      raw.includes('andhra')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'bay_bengal_alpha') || STATIONS[0];
    } else if (
      raw.includes('andaman') ||
      raw.includes('nicobar') ||
      raw.includes('port blair') ||
      raw.includes('havelock')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'andaman_basin') || STATIONS[2];
    } else if (
      raw.includes('sri lanka') ||
      raw.includes('colombo') ||
      raw.includes('gulf of mannar') ||
      raw.includes('palk strait') ||
      raw.includes('dome')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'sri_lanka_dome') || STATIONS[3];
    } else if (
      raw.includes('somali') ||
      raw.includes('somalia') ||
      raw.includes('horn of africa') ||
      raw.includes('socotra') ||
      raw.includes('aden') ||
      raw.includes('upwelling')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'somali_current') || STATIONS[4];
    } else if (
      raw.includes('lakshadweep') ||
      raw.includes('kerala') ||
      raw.includes('kochi') ||
      raw.includes('cochin') ||
      raw.includes('maldives') ||
      raw.includes('kavaratti') ||
      raw.includes('calicut') ||
      raw.includes('trivandrum')
    ) {
      targetStation = STATIONS.find((s) => s.id === 'lakshadweep_sea') || STATIONS[5];
    }

    // Active Station determination (prefer explicitly mentioned, fallback to selected or default)
    const activeSt =
      targetStation ||
      STATIONS.find((s) => s.id === selectedStationId) ||
      STATIONS[0];

    const stData = getStationData(activeSt.id, currentDate, activeLayer);

    // If location was explicitly mentioned, trigger camera target & switch to globe
    if (targetStation) {
      onSelectStation(targetStation.id);
      if (currentScreen !== 'globe' && currentScreen !== 'satellite-map') {
        onNavigate('globe');
      }
    }

    // STEP 2: ROBUST & NATURAL NAVIGATION / TAB SWITCHING COMMANDS
    // 2.1 Satellite Map view
    if (
      raw.includes('satellite') ||
      raw.includes('sat map') ||
      raw.includes('2d map') ||
      raw.includes('flat map') ||
      raw.includes('optical map') ||
      raw.includes('switch to satellite') ||
      raw.includes('open satellite') ||
      raw.includes('show satellite')
    ) {
      onNavigate('satellite-map');
      const reply = 'Switching to 2D High-Resolution Satellite Map Explorer. Real-world optical imagery loaded.';
      setReport({
        title: 'TACTICAL NAV // SATELLITE EXPLORER',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Navigated to 2D Satellite Map',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    // 2.2 Cross-Section / Transect view
    if (
      raw.includes('cross section') ||
      raw.includes('transect') ||
      raw.includes('vertical profile') ||
      raw.includes('depth profile') ||
      raw.includes('water column') ||
      raw.includes('isotherms') ||
      raw.includes('show transect') ||
      raw.includes('open transect') ||
      raw.includes('open cross') ||
      raw.includes('switch to cross')
    ) {
      onNavigate('cross-section');
      const reply = 'Displaying Basin Transect Cross-Section. Visualizing vertical isotherms from surface down to 1000 meters depth.';
      setReport({
        title: 'TACTICAL REPORT // TRANSECT CROSS-SECTION',
        query: cmd,
        transcript: cmd,
        summary: reply,
        hasCrossSection: true,
        actionTaken: 'Navigated to Transect Cross-Section',
        category: 'SCIENTIST',
      });
      speak(reply);
      return;
    }

    // 2.3 Anomalies / Heatwave Alerts view
    if (
      raw.includes('alert') ||
      raw.includes('alerts') ||
      raw.includes('anomaly') ||
      raw.includes('anomalies') ||
      raw.includes('heatwave') ||
      raw.includes('warning') ||
      raw.includes('warnings') ||
      raw.includes('subsurface alert') ||
      raw.includes('open alert') ||
      raw.includes('switch to alert')
    ) {
      onNavigate('alerts');
      const reply = 'Opening Subsurface Thermal Anomalies and Marine Heatwave surveillance feed.';
      setReport({
        title: 'TACTICAL NAV // ANOMALIES FEED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Navigated to Anomaly Alerts',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    // 2.4 3D Globe view
    if (
      raw.includes('globe') ||
      raw.includes('3d') ||
      raw.includes('earth') ||
      raw.includes('sphere') ||
      raw.includes('home') ||
      raw.includes('back to globe') ||
      raw.includes('open globe') ||
      raw.includes('show globe') ||
      raw.includes('switch to globe')
    ) {
      onNavigate('globe');
      const reply = 'Returning to 3D Orbital Globe surveillance.';
      setReport({
        title: 'TACTICAL NAV // 3D GLOBE',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Navigated to 3D Globe',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    // 2.5 Orbit Controls (Pause/Resume/Rotate)
    if (
      raw.includes('pause orbit') ||
      raw.includes('stop orbit') ||
      raw.includes('stop rotation') ||
      raw.includes('hold rotation') ||
      raw.includes('pause rotation') ||
      raw.includes('freeze') ||
      raw.includes('stop spinning')
    ) {
      if (autoRotate) onToggleAutoRotate();
      const reply = 'Orbital rotation held. 3D Globe camera locked in stationary surveillance mode.';
      setReport({
        title: 'ORBITAL ENGINE // ROTATION HALTED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Auto-orbit paused',
        category: 'ORBIT',
      });
      speak(reply);
      return;
    }

    if (
      raw.includes('resume orbit') ||
      raw.includes('start orbit') ||
      raw.includes('play orbit') ||
      raw.includes('start rotation') ||
      raw.includes('rotate') ||
      raw.includes('spin')
    ) {
      if (!autoRotate) onToggleAutoRotate();
      const reply = 'Orbital rotation resumed. Scanning North Indian Ocean basin.';
      setReport({
        title: 'ORBITAL ENGINE // ROTATION ACTIVE',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Auto-orbit active',
        category: 'ORBIT',
      });
      speak(reply);
      return;
    }

    // 2.6 Sensor Layer Switchers
    if (
      raw.includes('salinity') ||
      raw.includes('sss') ||
      raw.includes('salt layer') ||
      raw.includes('show salinity') ||
      raw.includes('switch to salinity')
    ) {
      onChangeLayer('SSS');
      const reply = `Sensor layer switched to Sea Surface Salinity (SSS). Arabian Sea displays high evaporation (${stData.variableValues.SSS.toFixed(1)} PSU) contrasted with Bay of Bengal freshwater lenses.`;
      setReport({
        title: 'SENSOR SATELLITE // SALINITY (SSS)',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Layer switched to SSS',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      raw.includes('temperature') ||
      raw.includes('sst') ||
      raw.includes('thermal layer') ||
      raw.includes('show temp') ||
      raw.includes('switch to temp')
    ) {
      onChangeLayer('SST');
      const reply = `Sensor layer switched to Sea Surface Temperature (SST). Current temperature at ${activeSt.name} is ${stData.surfaceTemp.toFixed(1)} degrees Celsius.`;
      setReport({
        title: 'SENSOR SATELLITE // TEMPERATURE (SST)',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Layer switched to SST',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      raw.includes('sea height') ||
      raw.includes('ssh') ||
      raw.includes('altimetry') ||
      raw.includes('height layer') ||
      raw.includes('show height') ||
      raw.includes('switch to height')
    ) {
      onChangeLayer('SSH');
      const reply = `Sensor layer switched to Sea Surface Height (SSH) radar altimetry. Mesoscale cyclonic and anticyclonic eddies active across the basin.`;
      setReport({
        title: 'SENSOR SATELLITE // HEIGHT (SSH)',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Layer switched to SSH',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      raw.includes('current') ||
      raw.includes('currents') ||
      raw.includes('drift') ||
      raw.includes('vector') ||
      raw.includes('velocity') ||
      raw.includes('show currents') ||
      raw.includes('switch to currents')
    ) {
      onChangeLayer('CURRENTS');
      const reply = `Sensor layer switched to Surface Geostrophic Currents. Somali Jet and East India Coastal Current vector fields active.`;
      setReport({
        title: 'SENSOR SATELLITE // CURRENTS',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Layer switched to CURRENTS',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      raw.includes('wind') ||
      raw.includes('winds') ||
      raw.includes('surface wind') ||
      raw.includes('scatterometry') ||
      raw.includes('ascat') ||
      raw.includes('breeze') ||
      raw.includes('show winds') ||
      raw.includes('switch to winds')
    ) {
      onChangeLayer('WINDS');
      const reply = `Sensor layer switched to Surface Winds. Reconstructing scatterometry wind stress vectors across the North Indian Ocean basin.`;
      setReport({
        title: 'SENSOR SATELLITE // SURFACE WINDS',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Layer switched to WINDS',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    // 2.7 PINN Machine Learning Model Screen
    if (
      raw.includes('ml') ||
      raw.includes('pinn') ||
      raw.includes('neural') ||
      raw.includes('physics model') ||
      raw.includes('model architecture') ||
      raw.includes('benchmark') ||
      raw.includes('ai model') ||
      raw.includes('show model') ||
      raw.includes('switch to model')
    ) {
      onNavigate('ml-model');
      const reply = 'Navigating to Physics-Informed Neural Network (PINN) ML Model architecture and subsurface accuracy benchmarks.';
      setReport({
        title: 'NEURAL SYSTEM // PINN ARCHITECTURE',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Navigated to PINN ML Model View',
        category: 'SCIENTIST',
      });
      speak(reply);
      return;
    }

    // 2.7b Navigate to Cyclone Digital Twin (PWP Model)
    if (
      raw.includes('cyclone') ||
      raw.includes('twin') ||
      raw.includes('pwp') ||
      raw.includes('simulator') ||
      raw.includes('what if') ||
      raw.includes('counterfactual') ||
      raw.includes('cold wake')
    ) {
      onNavigate('cyclone-simulator');
      const reply = 'Launching Price-Weller-Pinkel (PWP) Cyclone Digital Twin. Ready for counterfactual upper-ocean response simulations and wind stress modifiers.';
      setReport({
        title: 'PHYSICS SIMULATOR // PWP CYCLONE TWIN',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Navigated to Cyclone Digital Twin Simulator',
        category: 'SCIENTIST',
      });
      speak(reply);
      return;
    }

    // 2.8 Water Surface Thermal Raster Overlay Toggle
    if (
      (raw.includes('raster') || raw.includes('water layer') || raw.includes('thermal map') || raw.includes('heat map') || raw.includes('heatmap') || raw.includes('water surface')) &&
      (raw.includes('off') || raw.includes('disable') || raw.includes('hide') || raw.includes('remove') || raw.includes('stop'))
    ) {
      if (onToggleWaterRaster) onToggleWaterRaster(false);
      const reply = 'Water surface thermodynamic raster overlay disabled.';
      setReport({
        title: 'HUD CONTROL // RASTER DEACTIVATED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Disabled water raster overlay',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      (raw.includes('raster') || raw.includes('water layer') || raw.includes('thermal map') || raw.includes('heat map') || raw.includes('heatmap') || raw.includes('water surface')) &&
      (raw.includes('on') || raw.includes('enable') || raw.includes('show') || raw.includes('activate') || raw.includes('start'))
    ) {
      if (onToggleWaterRaster) onToggleWaterRaster(true);
      const reply = 'Water surface thermodynamic raster overlay enabled.';
      setReport({
        title: 'HUD CONTROL // RASTER ACTIVATED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Enabled water raster overlay',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    // 2.9 Raster Opacity Slider Control
    if (raw.includes('opacity') || raw.includes('transparency') || (raw.includes('slider') && (raw.includes('raster') || raw.includes('water')))) {
      let targetOpacity = rasterOpacity !== undefined ? rasterOpacity : 0.72;
      const numMatch = raw.match(/\b(\d{1,3})\s*(%|percent)?\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 0 && val <= 100) {
          targetOpacity = Math.max(0.15, Math.min(0.95, val / 100));
        }
      } else if (raw.includes('increase') || raw.includes('more') || raw.includes('higher') || raw.includes('up')) {
        targetOpacity = Math.min(0.95, (rasterOpacity || 0.72) + 0.15);
      } else if (raw.includes('decrease') || raw.includes('less') || raw.includes('lower') || raw.includes('down') || raw.includes('dim')) {
        targetOpacity = Math.max(0.15, (rasterOpacity || 0.72) - 0.15);
      } else if (raw.includes('max') || raw.includes('full') || raw.includes('100')) {
        targetOpacity = 0.95;
      } else if (raw.includes('min') || raw.includes('low')) {
        targetOpacity = 0.2;
      }

      if (onChangeRasterOpacity) onChangeRasterOpacity(targetOpacity);
      const pct = Math.round(targetOpacity * 100);
      const reply = `Water raster opacity adjusted to ${pct} percent.`;
      setReport({
        title: 'HUD CONTROL // OPACITY ADJUSTED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: `Set raster opacity to ${pct}%`,
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    // 2.10 Station Buoy Markers Toggle
    if (
      (raw.includes('marker') || raw.includes('buoy') || raw.includes('pin') || raw.includes('buoys') || raw.includes('pins')) &&
      (raw.includes('off') || raw.includes('hide') || raw.includes('disable'))
    ) {
      if (onToggleStationMarkers) onToggleStationMarkers(false);
      const reply = 'Station buoy markers and telemetry pins hidden.';
      setReport({
        title: 'HUD CONTROL // MARKERS HIDDEN',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Disabled station markers',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      (raw.includes('marker') || raw.includes('buoy') || raw.includes('pin') || raw.includes('buoys') || raw.includes('pins')) &&
      (raw.includes('on') || raw.includes('show') || raw.includes('enable'))
    ) {
      if (onToggleStationMarkers) onToggleStationMarkers(true);
      const reply = 'Station buoy markers and telemetry pins displayed.';
      setReport({
        title: 'HUD CONTROL // MARKERS DISPLAYED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Enabled station markers',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    // 2.11 Basemap Imagery Mode Switchers (Satellite / Bathymetry / Dark Tactical)
    if (
      (raw.includes('satellite') || raw.includes('optical') || raw.includes('photo')) &&
      (raw.includes('basemap') || raw.includes('texture') || raw.includes('layer') || raw.includes('style') || raw.includes('imagery') || raw.includes('map'))
    ) {
      if (onChangeGlobeStyle) onChangeGlobeStyle('SATELLITE');
      if (onChangeBasemap) onChangeBasemap('SATELLITE_HYBRID');
      const reply = 'Basemap switched to High-Resolution Real Optical Satellite imagery.';
      setReport({
        title: 'BASEMAP // REAL SATELLITE',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Switched basemap to SATELLITE',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      (raw.includes('bathymetry') || raw.includes('gebco') || raw.includes('seafloor') || raw.includes('depth map') || raw.includes('topography')) &&
      (raw.includes('basemap') || raw.includes('texture') || raw.includes('style') || raw.includes('map') || raw.includes('layer'))
    ) {
      if (onChangeGlobeStyle) onChangeGlobeStyle('BATHYMETRY');
      if (onChangeBasemap) onChangeBasemap('OCEAN_BATHYMETRY');
      const reply = 'Basemap switched to High-Resolution Seafloor Bathymetry and ocean floor topography.';
      setReport({
        title: 'BASEMAP // HIGH-RES BATHYMETRY',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Switched basemap to BATHYMETRY',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    if (
      (raw.includes('dark') || raw.includes('tactical') || raw.includes('night')) &&
      (raw.includes('basemap') || raw.includes('texture') || raw.includes('style') || raw.includes('map') || raw.includes('mode'))
    ) {
      if (onChangeGlobeStyle) onChangeGlobeStyle('TACTICAL');
      if (onChangeBasemap) onChangeBasemap('DARK_TACTICAL');
      const reply = 'Basemap switched to Tactical Dark Surveillance mode.';
      setReport({
        title: 'BASEMAP // TACTICAL DARK',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Switched basemap to TACTICAL DARK',
        category: 'LAYER',
      });
      speak(reply);
      return;
    }

    // 2.12 Timeline Playback
    if (
      (raw.includes('play') || raw.includes('start') || raw.includes('animate')) &&
      (raw.includes('time') || raw.includes('timeline') || raw.includes('date') || raw.includes('month'))
    ) {
      if (!isPlaying && onTogglePlay) onTogglePlay();
      const reply = 'Timeline time-series playback started across 2024 season.';
      setReport({
        title: 'TIMELINE // PLAYBACK ACTIVE',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Started timeline animation',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    if (
      (raw.includes('pause') || raw.includes('stop') || raw.includes('freeze')) &&
      (raw.includes('time') || raw.includes('timeline') || raw.includes('date') || raw.includes('month'))
    ) {
      if (isPlaying && onTogglePlay) onTogglePlay();
      const reply = 'Timeline time-series playback paused.';
      setReport({
        title: 'TIMELINE // PLAYBACK PAUSED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Paused timeline animation',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    // 2.13 Deselect Station / Clear Target
    if (
      raw.includes('deselect') ||
      raw.includes('clear station') ||
      raw.includes('clear target') ||
      raw.includes('unselect') ||
      raw.includes('reset target')
    ) {
      onSelectStation(null);
      const reply = 'Station target cleared. Displaying wide basin overview.';
      setReport({
        title: 'TARGET NODE // CLEARED',
        query: cmd,
        transcript: cmd,
        summary: reply,
        actionTaken: 'Cleared selected station target',
        category: 'NAVIGATION',
      });
      speak(reply);
      return;
    }

    // STEP 3: FOR QUESTIONS & COMPLEX INTEL, QUERY THE FULL-STACK GEMINI BACKEND WITH REAL HYDROGRAPHIC CONTEXT
    setIsAnalyzing(true);

    const isFishingQuery =
      raw.includes('fish') ||
      raw.includes('catch') ||
      raw.includes('boat') ||
      raw.includes('pfz') ||
      raw.includes('tuna') ||
      raw.includes('mackerel') ||
      raw.includes('pomfret') ||
      raw.includes('hilsa') ||
      raw.includes('sardine') ||
      raw.includes('species') ||
      raw.includes('angler');

    let targetSpecies: string[] = ['Indian Mackerel', 'Yellowfin Tuna', 'Kingfish', 'Pomfret'];
    let optimalDepth = '30m - 50m thermal boundary';
    let seaConditions = 'Calm to moderate swell, 0.4 m/s drift';

    if (activeSt.id === 'arabian_sea_basin') {
      targetSpecies = ['Indian Mackerel', 'Bombay Duck (Harpadon)', 'Kingfish (Surmai)', 'Yellowfin Tuna', 'Silver Pomfret'];
      optimalDepth = 'Upper 35m to 50m thermal layer';
      seaConditions = 'Favorable swell, southward geostrophic drift at 0.4 m/s';
    } else if (activeSt.id === 'bay_bengal_alpha') {
      targetSpecies = ['Skipjack Tuna', 'Hilsa Shad', 'Carangids (Trevally)', 'Anchovies', 'Ribbonfish'];
      optimalDepth = 'Top 25m above freshwater halocline';
      seaConditions = 'Low salinity barrier layer, wave height 0.8m';
    } else if (activeSt.id === 'somali_current') {
      targetSpecies = ['Yellowfin Tuna', 'Swordfish', 'Bigeye Tuna', 'Sardinella', 'Mahi-Mahi'];
      optimalDepth = 'Top 20m intensive upwelling zone';
      seaConditions = 'Strong current drift at 1.4 m/s, active whitecaps';
    } else if (activeSt.id === 'sri_lanka_dome') {
      targetSpecies = ['Yellowfin Tuna', 'Bigeye Tuna', 'Mahi-Mahi (Dorado)', 'Flying Fish', 'Sailfish'];
      optimalDepth = '25m - 40m cyclonic dome rim';
      seaConditions = 'Cyclonic eddy convergence, moderate swell';
    } else if (activeSt.id === 'lakshadweep_sea') {
      targetSpecies = ['Skipjack Tuna', 'Yellowfin Tuna', 'Seer Fish', 'Mackerel'];
      optimalDepth = '40m - 60m coral atoll drop-offs';
      seaConditions = 'Warm pool anticyclonic circulation, mild chop';
    } else {
      targetSpecies = ['Snappers', 'Grouper', 'Spanish Mackerel', 'Yellowfin Tuna', 'Squid'];
      optimalDepth = '30m - 45m submarine ridge';
      seaConditions = 'Internal wave solitons present, calm surface';
    }

    try {
      const response = await fetch('/api/tactical-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cmd,
          context: {
            stationName: activeSt.name,
            currentDate,
            activeLayer,
            sst: stData.surfaceTemp,
            mld: stData.mixedLayerDepth,
            targetSpecies,
          },
        }),
      });

      const data = await response.json();
      let answer = data.summary || '';
      let title = data.title || (isFishingQuery ? `FISHERMAN ADVISORY // ${activeSt.name.toUpperCase()}` : 'AEGIS TACTICAL INTEL');

      // If backend returned generic fallback or error string, enrich it with local intelligence
      if (!answer || answer.includes('atmospheric attenuation')) {
        const localKnowledge = getLocalIntelligenceAnswer(cmd, {
          stationName: activeSt.name,
          sst: stData.surfaceTemp,
          mld: stData.mixedLayerDepth,
          sss: stData.variableValues.SSS,
        });
        answer = localKnowledge.summary;
        title = localKnowledge.title;
      }

      setReport({
        title,
        query: cmd,
        transcript: cmd,
        summary: answer,
        stationData: {
          station: activeSt,
          sst: stData.surfaceTemp,
          mld: stData.mixedLayerDepth,
          thermoclineDepth: Math.round(stData.mixedLayerDepth * 1.5),
          upwellingStatus: stData.mixedLayerDepth < 35 ? 'ACTIVE UPWELLING // HIGH PRODUCTIVITY' : 'STABLE STRATIFIED // MODERATE MIXING',
          fishingAdvice: answer,
          targetSpecies,
          optimalDepth,
          seaConditions,
          salinity: stData.variableValues.SSS,
          density: 1024.2,
        },
        actionTaken: targetStation ? `Targeted ${activeSt.name} & calculated tactical analysis` : undefined,
        category: isFishingQuery ? 'FISHERMAN' : 'GENERAL',
      });

      speak(answer);
    } catch (err) {
      console.warn('Error fetching tactical query from backend, using local intelligence engine:', err);
      const localKnowledge = getLocalIntelligenceAnswer(cmd, {
        stationName: activeSt.name,
        sst: stData.surfaceTemp,
        mld: stData.mixedLayerDepth,
        sss: stData.variableValues.SSS,
      });

      setReport({
        title: isFishingQuery ? `FISHERMAN ADVISORY // ${activeSt.name.toUpperCase()}` : localKnowledge.title,
        query: cmd,
        transcript: cmd,
        summary: localKnowledge.summary,
        stationData: {
          station: activeSt,
          sst: stData.surfaceTemp,
          mld: stData.mixedLayerDepth,
          thermoclineDepth: Math.round(stData.mixedLayerDepth * 1.5),
          upwellingStatus: stData.mixedLayerDepth < 35 ? 'ACTIVE UPWELLING // HIGH PRODUCTIVITY' : 'STABLE STRATIFIED',
          fishingAdvice: localKnowledge.summary,
          targetSpecies,
          optimalDepth,
          seaConditions,
          salinity: stData.variableValues.SSS,
          density: 1024.2,
        },
        category: isFishingQuery ? 'FISHERMAN' : 'STATION',
      });

      speak(localKnowledge.summary);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleVoiceCommand(manualInput);
    setManualInput('');
  };

  return (
    <>
      {/* FLOATING HUD CONTROLS: MIC, MUTE & INTEL WINDOW */}
      <div
        className={`fixed z-50 flex items-center gap-2 transition-all ${
          currentScreen === 'cyclone-simulator'
            ? 'bottom-3 right-4'
            : 'bottom-20 right-6'
        }`}
      >
        {/* Main Glowing Tactical Mic Button */}
        <button
          onClick={toggleListening}
          className={`h-12 px-4 border flex items-center gap-2.5 font-space text-xs font-bold tracking-wider uppercase backdrop-blur-md transition-all shadow-lg ${
            isListening
              ? 'bg-[#FF4A5A] text-white border-[#FF4A5A] shadow-[0_0_25px_rgba(255,74,90,0.6)] animate-pulse'
              : isAnalyzing
              ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7] shadow-[0_0_20px_rgba(63,224,199,0.5)]'
              : isSpeaking
              ? 'bg-[#FFB800] text-[#05080D] border-[#FFB800] shadow-[0_0_20px_rgba(255,184,0,0.5)]'
              : 'bg-[#0A1119]/90 text-[#E8EDF0] border-[#1C2A33] hover:border-[#3FE0C7] hover:text-[#3FE0C7] shadow-[0_0_15px_rgba(0,0,0,0.6)]'
          }`}
          title={isListening ? 'Click to stop listening' : 'Click to speak to Tactical Voice AI'}
        >
          {isListening ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              <span>LISTENING...</span>
            </>
          ) : isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#05080D]" />
              <span>ANALYZING...</span>
            </>
          ) : isSpeaking ? (
            <>
              <Volume2 className="w-4 h-4 animate-bounce text-[#05080D]" />
              <span>AEGIS SPEAKING...</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-[#3FE0C7]" />
              <span className="hidden sm:inline">VOICE AI AGENT</span>
            </>
          )}
        </button>

        {/* Mute Audio Narration Toggle */}
        <button
          onClick={() => {
            setIsMuted(!isMuted);
            if (!isMuted && synthRef.current) synthRef.current.cancel();
          }}
          className={`w-12 h-12 border flex items-center justify-center backdrop-blur-md transition-all ${
            isMuted
              ? 'bg-[#0A1119] text-[#6E8391] border-[#1C2A33]'
              : 'bg-[#0A1119] text-[#3FE0C7] border-[#1C2A33] hover:border-[#3FE0C7]'
          }`}
          title={isMuted ? 'Unmute voice output' : 'Mute voice output'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Quick Intel Popup Open Button */}
        <button
          onClick={() => setShowPopup(!showPopup)}
          className={`w-12 h-12 border flex items-center justify-center backdrop-blur-md transition-all ${
            showPopup
              ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7]'
              : 'bg-[#0A1119] text-[#E8EDF0] border-[#1C2A33] hover:text-[#3FE0C7]'
          }`}
          title="Open Tactical Intelligence Terminal"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* PALANTIR-STYLE TACTICAL INTELLIGENCE POP-UP HUD */}
      {showPopup && (
        <div className="fixed top-16 right-6 z-50 w-[92vw] sm:w-[440px] max-h-[84vh] bg-[#0A1119]/95 border border-[#3FE0C7] shadow-[0_0_35px_rgba(5,8,13,0.9)] backdrop-blur-xl flex flex-col font-data text-xs select-none animate-in fade-in zoom-in-95 duration-200">
          {/* Tactical Corner Brackets */}
          <div className="corner-bracket corner-tl"></div>
          <div className="corner-bracket corner-tr"></div>
          <div className="corner-bracket corner-bl"></div>
          <div className="corner-bracket corner-br"></div>

          {/* Header Bar */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#1C2A33] bg-[#05080D]/80">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-[#FFB800] animate-ping' : 'bg-[#3FE0C7] animate-pulse'}`}></span>
              <span className="font-space font-bold text-xs text-[#3FE0C7] tracking-widest uppercase">
                {report ? report.title : 'TACTICAL OCEAN INTEL // AEGIS-AI'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isAnalyzing && (
                <span className="text-[10px] text-[#FFB800] font-mono flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> THINKING
                </span>
              )}
              {isSpeaking && (
                <span className="text-[10px] text-[#FFB800] font-mono animate-pulse flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> SPEAKING
                </span>
              )}
              <button
                onClick={() => setShowPopup(false)}
                className="text-[#6E8391] hover:text-[#E8EDF0] p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-y-auto space-y-4 max-h-[60vh]">
            {/* User Command Transcript */}
            {transcript && (
              <div className="bg-[#05080D] border border-[#1C2A33] p-2.5">
                <div className="text-[9px] text-[#6E8391] uppercase tracking-wider mb-1">
                  INTERCEPTED USER QUERY:
                </div>
                <div className="text-xs text-[#3FE0C7] font-mono font-semibold">
                  "{transcript}"
                </div>
              </div>
            )}

            {/* AI Agent Briefing Text */}
            <div className="bg-[#0A1119] border-l-2 border-[#3FE0C7] p-3 text-xs leading-relaxed text-[#E8EDF0]">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-[#3FE0C7] py-2 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing tactical ocean intelligence with Gemini model...</span>
                </div>
              ) : report ? (
                <div>
                  <div className="font-medium text-[#E8EDF0] leading-relaxed">
                    {report.summary}
                  </div>
                  {report.actionTaken && (
                    <div className="mt-2 text-[10px] text-[#3FE0C7] font-mono">
                      ▶ ACTION: {report.actionTaken}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[#6E8391] space-y-2">
                  <p className="text-[#E8EDF0] font-semibold">
                    Aegis Oceanographic Intelligence Agent Ready.
                  </p>
                  <p>Speak or type any question: ocean science, fishing, monsoons, water depths, or general queries.</p>
                  <div className="text-[10px] text-[#3FE0C7] pt-2 space-y-1">
                    <div>• "What do you think for fishing near Mumbai?"</div>
                    <div>• "Why does the Bay of Bengal have more cyclones?"</div>
                    <div>• "What causes the Indian monsoon?"</div>
                    <div>• "Explain thermoclines in simple terms"</div>
                    <div>• "Zoom to Somali Current"</div>
                    <div>• "Pause orbit" / "Resume orbit"</div>
                  </div>
                </div>
              )}
            </div>

            {/* Station Telemetry Data Cards (If Station Targeted) */}
            {report?.stationData && (
              <div className="space-y-2">
                <div className="text-[10px] text-[#6E8391] uppercase tracking-widest flex items-center justify-between">
                  <span>HYDROGRAPHIC TELEMETRY</span>
                  <span className="text-[#3FE0C7] font-bold">{report.stationData.station.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#05080D] border border-[#1C2A33] p-2">
                    <div className="text-[9px] text-[#6E8391]">SURFACE SST</div>
                    <div className="text-sm font-bold text-[#FF8A5B]">
                      {report.stationData.sst.toFixed(1)} °C
                    </div>
                  </div>
                  <div className="bg-[#05080D] border border-[#1C2A33] p-2">
                    <div className="text-[9px] text-[#6E8391]">MIXED LAYER (MLD)</div>
                    <div className="text-sm font-bold text-[#3FE0C7]">
                      {report.stationData.mld} m
                    </div>
                  </div>
                  <div className="bg-[#05080D] border border-[#1C2A33] p-2">
                    <div className="text-[9px] text-[#6E8391]">THERMOCLINE DEPTH</div>
                    <div className="text-sm font-bold text-[#E8EDF0]">
                      ~{report.stationData.thermoclineDepth} m
                    </div>
                  </div>
                  <div className="bg-[#05080D] border border-[#1C2A33] p-2">
                    <div className="text-[9px] text-[#6E8391]">SALINITY (SSS)</div>
                    <div className="text-sm font-bold text-[#E8EDF0]">
                      {report.stationData.salinity.toFixed(1)} PSU
                    </div>
                  </div>
                </div>

                {/* Fishermen / Upwelling Advisory Card with Species & Depth */}
                <div className="bg-[#05080D] border border-[#FFB800]/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-[#FFB800] uppercase font-bold">
                    <div className="flex items-center gap-1.5">
                      <Fish className="w-4 h-4 text-[#FFB800]" />
                      <span>POTENTIAL FISHING ZONE (PFZ) INTEL</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30 font-mono">
                      {report.stationData.upwellingStatus}
                    </span>
                  </div>

                  {report.stationData.targetSpecies && report.stationData.targetSpecies.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[9px] text-[#6E8391] uppercase">Key Commercial Species:</div>
                      <div className="flex flex-wrap gap-1">
                        {report.stationData.targetSpecies.map((sp, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-[#0A1119] border border-[#1C2A33] text-[10px] text-[#E8EDF0] font-medium"
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1C2A33]">
                    <div>
                      <div className="text-[9px] text-[#6E8391] uppercase">Optimal Net/Line Depth:</div>
                      <div className="text-[11px] text-[#3FE0C7] font-semibold">
                        {report.stationData.optimalDepth}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#6E8391] uppercase">Sea & Drift State:</div>
                      <div className="text-[11px] text-[#E8EDF0] font-semibold">
                        {report.stationData.seaConditions}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mini Tactical Cross-Section SVG Preview (When Asked) */}
            {report?.hasCrossSection && (
              <div className="bg-[#05080D] border border-[#1C2A33] p-2.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-[#3FE0C7] font-bold uppercase">
                  <span>VERTICAL ISOTHERM CROSS-SECTION (0-1000M)</span>
                  <span>TRANSECT 89°E</span>
                </div>
                <div className="h-24 w-full bg-[#07131F] relative border border-[#1C2A33] overflow-hidden flex items-end">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 50">
                    <defs>
                      <linearGradient id="popCrossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff4a5a" stopOpacity="0.9" />
                        <stop offset="30%" stopColor="#ff8a5b" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#3fe0c7" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#0b2438" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>
                    <rect width="100" height="50" fill="url(#popCrossGrad)" />
                    {/* Mixed layer dashed line */}
                    <path
                      d="M 0 12 Q 25 10 50 16 T 100 14"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                    />
                    {/* 20C thermocline */}
                    <path
                      d="M 0 24 Q 30 20 60 28 T 100 25"
                      fill="none"
                      stroke="#3fe0c7"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <div className="absolute top-1 left-2 text-[8px] text-[#E8EDF0] bg-black/60 px-1 font-mono">
                    0m (29.5°C)
                  </div>
                  <div className="absolute top-7 left-2 text-[8px] text-[#3FE0C7] bg-black/60 px-1 font-mono">
                    20°C Isotherm
                  </div>
                  <div className="absolute bottom-1 left-2 text-[8px] text-[#6E8391] bg-black/60 px-1 font-mono">
                    1000m (6.8°C)
                  </div>
                </div>
                <button
                  onClick={() => {
                    onNavigate('cross-section');
                    setShowPopup(false);
                  }}
                  className="w-full py-1.5 text-center bg-[#3FE0C7] text-[#05080D] font-bold text-[10px] uppercase hover:bg-white transition-colors"
                >
                  EXPAND FULL BASIN CROSS-SECTION VIEW ▶
                </button>
              </div>
            )}
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="p-3 border-t border-[#1C2A33] bg-[#05080D]/50 flex flex-wrap gap-1">
            <button
              onClick={() => handleVoiceCommand('show cyclone simulator')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#FF8A5B] text-[#FF8A5B] hover:text-white flex items-center gap-1"
            >
              <span>🌪️ Cyclone Twin (PWP)</span>
            </button>
            <button
              onClick={() => handleVoiceCommand('show satellite map')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#3FE0C7] hover:text-white flex items-center gap-1"
            >
              <span>🛰️ Satellite Map</span>
            </button>
            <button
              onClick={() => handleVoiceCommand('show cross section')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#3FE0C7] hover:text-white flex items-center gap-1"
            >
              <span>📊 Cross-Section</span>
            </button>
            <button
              onClick={() => handleVoiceCommand('show alerts')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#FF4A5A] text-[#FF4A5A] hover:text-white flex items-center gap-1"
            >
              <span>⚠️ Alerts Feed</span>
            </button>
            <button
              onClick={() => handleVoiceCommand('show 3d globe')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#3FE0C7] hover:text-white flex items-center gap-1"
            >
              <span>🌐 3D Globe</span>
            </button>
            <button
              onClick={() => handleVoiceCommand('switch to salinity')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#6E8391] hover:text-[#E8EDF0]"
            >
              Salinity (SSS)
            </button>
            <button
              onClick={() => handleVoiceCommand('switch to temperature')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#FF8A5B] text-[#FF8A5B] hover:text-[#E8EDF0]"
            >
              Temperature (SST)
            </button>
            <button
              onClick={() => handleVoiceCommand('switch to winds')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#3FE0C7] hover:text-[#E8EDF0]"
            >
              Winds (ASCAT)
            </button>
            <button
              onClick={() => handleVoiceCommand('What do you think for fishing near Mumbai?')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#FFB800] text-[#FFB800] hover:text-white"
            >
              Fishing near Mumbai
            </button>
            <button
              onClick={() => handleVoiceCommand(autoRotate ? 'Pause orbit' : 'Resume orbit')}
              className="px-2 py-0.5 text-[9px] bg-[#0A1119] border border-[#1C2A33] hover:border-[#3FE0C7] text-[#6E8391] hover:text-[#E8EDF0]"
            >
              {autoRotate ? 'Pause Orbit' : 'Resume Orbit'}
            </button>
          </div>

          {/* Text Command Input (For Keyboard or Mute Environments) */}
          <form onSubmit={handleManualSubmit} className="p-3 border-t border-[#1C2A33] flex items-center gap-2 bg-[#05080D]">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ask anything: fishing, monsoons, cyclones, satellites, trivia..."
              className="flex-1 bg-[#0A1119] border border-[#1C2A33] px-3 py-1.5 text-xs text-[#E8EDF0] placeholder-[#6E8391] focus:outline-none focus:border-[#3FE0C7] font-mono"
            />
            <button
              type="submit"
              disabled={isAnalyzing}
              className="p-1.5 bg-[#3FE0C7] text-[#05080D] hover:bg-white transition-colors disabled:opacity-50"
              title="Submit query"
            >
              {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
