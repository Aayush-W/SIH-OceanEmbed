import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Activity, Globe2, Map, Pause, Play, Radio, RotateCcw, Wind, ZoomIn, ZoomOut } from 'lucide-react';
import {
  CycloneHistoricalPreset,
  CycloneScenarioParams,
  CycloneGeospatialResult,
  computeCycloneGeospatialData,
  PWPSimulationSummary,
} from '../physics/pwpModel';
import { StationData } from '../types';
import { CycloneMapExplorer } from './CycloneMapExplorer';

type TwinViewMode = '2D' | '3D' | 'SPLIT';

interface CycloneTwinHeroProps {
  preset: CycloneHistoricalPreset;
  params: CycloneScenarioParams;
  stationData: StationData;
  selectedHour: number;
  simulation: PWPSimulationSummary;
  viewMode: TwinViewMode;
  isPlaying: boolean;
  onViewModeChange: (mode: TwinViewMode) => void;
  onHourChange: (hour: number) => void;
  onTogglePlayback: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const projectPoint = (lat: number, lon: number, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => ({
  x: ((lon - bounds.minLon) / Math.max(1, bounds.maxLon - bounds.minLon)) * 100,
  y: 100 - ((lat - bounds.minLat) / Math.max(1, bounds.maxLat - bounds.minLat)) * 100,
});

const pathFromTrack = (track: Array<{ lat: number; lon: number }>, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) =>
  track.map((point, index) => {
    const projected = projectPoint(point.lat, point.lon, bounds);
    return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
  }).join(' ');

const latLonToVector = (lat: number, lon: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
};

const Twin2DMap: React.FC<{ geoData: CycloneGeospatialResult; selectedHour: number; stationData: StationData }> = ({
  geoData,
  selectedHour,
  stationData,
}) => {
  const points = [...geoData.counterfactualTrack, ...geoData.baselineTrack, { lat: stationData.station.lat, lon: stationData.station.lon }];
  const bounds = useMemo(() => {
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    return {
      minLat: Math.min(...lats) - 3,
      maxLat: Math.max(...lats) + 3,
      minLon: Math.min(...lons) - 4,
      maxLon: Math.max(...lons) + 4,
    };
  }, [geoData, stationData]);
  const eye = projectPoint(geoData.activeEye.lat, geoData.activeEye.lon, bounds);
  const station = projectPoint(stationData.station.lat, stationData.station.lon, bounds);
  const baselinePath = pathFromTrack(geoData.baselineTrack, bounds);
  const counterfactualPath = pathFromTrack(geoData.counterfactualTrack, bounds);
  const wakePaths = geoData.coldWakePolygons.map((wake) => wake.points.map(([lat, lon]) => {
    const point = projectPoint(lat, lon, bounds);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(' '));

  return (
    <div className="cyclone-twin-map" aria-label="Animated 2D cyclone digital twin map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cyclone-map-svg">
        <defs>
          <pattern id="twin-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(110, 180, 190, 0.12)" strokeWidth="0.18" />
          </pattern>
          <radialGradient id="fuel-gradient">
            <stop offset="0" stopColor="#ffb36f" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffb36f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#twin-grid)" />
        <ellipse cx="54" cy="49" rx="34" ry="29" fill="url(#fuel-gradient)" />
        <path d={baselinePath} className="twin-track twin-track-baseline" />
        <path d={counterfactualPath} className="twin-track twin-track-counterfactual" />
        {wakePaths.map((path, index) => <polygon key={index} points={path} className={`twin-wake ${index === 1 ? 'twin-wake-core' : ''}`} />)}
        <line x1={station.x} y1={station.y} x2={eye.x} y2={eye.y} className="twin-station-link" />
        <circle cx={station.x} cy={station.y} r="1.4" className="twin-station" />
        <g transform={`translate(${eye.x} ${eye.y})`} className="twin-eye-group">
          <circle r="13" className="twin-wind-ring twin-wind-ring-outer" />
          <circle r="8" className="twin-wind-ring twin-wind-ring-inner" />
          <circle r="4" className="twin-eyewall" />
          <circle r="1.5" className="twin-eye" />
          <path d="M -5 -2 C -10 -8 -7 -12 0 -14 C -3 -8 3 -7 5 -3" className="twin-spiral twin-spiral-a" />
          <path d="M 5 2 C 10 8 7 12 0 14 C 3 8 -3 7 -5 3" className="twin-spiral twin-spiral-b" />
        </g>
        <text x={clamp(eye.x + 5, 4, 84)} y={clamp(eye.y - 5, 8, 92)} className="twin-map-label">{geoData.activeEye.windKts} KTS · T {selectedHour >= 0 ? `+${selectedHour}` : selectedHour}H</text>
        <text x={clamp(station.x + 3, 4, 92)} y={clamp(station.y + 5, 8, 94)} className="twin-map-label twin-map-label-muted">{stationData.station.code}</text>
      </svg>
      <div className="twin-map-coordinates">{geoData.activeEye.lat.toFixed(2)}°N · {geoData.activeEye.lon.toFixed(2)}°E</div>
      <div className="twin-map-scale"><span>WARM OCEAN FUEL</span><i></i><span>COLD WAKE</span></div>
    </div>
  );
};

const Twin3DGlobe: React.FC<{ geoData: CycloneGeospatialResult; selectedHour: number }> = ({ geoData, selectedHour }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stormRef = useRef<THREE.Group | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const wakeRef = useRef<THREE.Line | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const trackKey = useMemo(() => geoData.counterfactualTrack.map((point) => `${point.lat}:${point.lon}`).join('|'), [geoData.counterfactualTrack]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || webglUnavailable) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100);
    camera.position.set(0, 0.45, 5.6);
    cameraRef.current = camera;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.warn('Cyclone Twin 3D view is unavailable:', error);
      setWebglUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 3.2;
    controls.maxDistance = 9;
    controls.autoRotate = false;
    controlsRef.current = controls;

    const earthTexture = new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const earthBump = new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-topology.png');
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 64, 32),
      new THREE.MeshPhongMaterial({ map: earthTexture, bumpMap: earthBump, bumpScale: 0.035, shininess: 12, transparent: true, opacity: 0.98 }),
    );
    scene.add(globe);
    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(1.875, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xe8edf0, wireframe: true, transparent: true, opacity: 0.025 }),
    );
    scene.add(grid);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.98, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8edf0, transparent: true, opacity: 0.08, side: THREE.BackSide }),
    );
    scene.add(atmosphere);
    scene.add(new THREE.AmbientLight(0x6ea4b8, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 2, 4);
    scene.add(keyLight);

    const storm = new THREE.Group();
    stormRef.current = storm;
    scene.add(storm);

    const hurricaneModel = new THREE.Group();
    modelRef.current = hurricaneModel;
    storm.add(hurricaneModel);

    // Hurricane Maria's MODIS-derived cloud mesh is used as the storm body.
    // The geometry is normalized once, then reshaped from the active forecast state.
    const stlLoader = new STLLoader();
    stlLoader.load('/hurricane-maria-3d-model/files/maria.stl', (geometry) => {
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const bounds = geometry.boundingBox;
      if (!bounds || !modelRef.current) return;
      const dimensions = new THREE.Vector3();
      bounds.getSize(dimensions);
      const normalization = 1.35 / Math.max(dimensions.x, dimensions.y, dimensions.z);
      geometry.center();
      const halfExtent = new THREE.Vector2(Math.max(0.001, dimensions.x / 2), Math.max(0.001, dimensions.y / 2));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xf1f4f2) },
          uOpacity: { value: 0.72 },
          uHalfExtent: { value: halfExtent },
        },
        vertexShader: `
          varying vec2 vCloudPosition;
          varying vec3 vCloudNormal;
          uniform vec2 uHalfExtent;
          void main() {
            vCloudPosition = vec2(position.x / uHalfExtent.x, position.y / uHalfExtent.y);
            vCloudNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vCloudPosition;
          varying vec3 vCloudNormal;
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            float radius = length(vCloudPosition);
            float stormMask = 1.0 - smoothstep(0.62, 0.82, radius);
            float light = 0.58 + 0.42 * max(dot(vCloudNormal, normalize(vec3(0.2, 0.75, 1.0))), 0.0);
            float detail = 0.88 + 0.12 * sin(vCloudPosition.x * 19.0 + vCloudPosition.y * 13.0);
            float alpha = stormMask * uOpacity * detail;
            if (alpha < 0.018) discard;
            gl_FragColor = vec4(uColor * light, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.normalization = normalization;
      mesh.rotation.x = Math.PI;
      const windFactor = Math.max(0.72, Math.min(1.45, geoData.activeEye.windKts / 105));
      const residenceFactor = Math.max(0.85, Math.min(1.28, 1 + (24 - geoData.activeEye.localWindAtStationKts) / 240));
      const pressureFactor = Math.max(0.82, Math.min(1.2, 1 + (1010 - geoData.activeEye.pressureHpa) / 700));
      mesh.scale.set(
        normalization * windFactor * residenceFactor,
        normalization * windFactor,
        normalization * pressureFactor,
      );
      mesh.rotation.z = (geoData.activeEye.headingDeg * Math.PI) / 180;
      modelRef.current.add(mesh);
    });

    // Use a real cloud bitmap as the storm material, arranged into tapered spiral bands.
    const cloudTexture = new THREE.TextureLoader().load('/assets/cyclone-cloud-texture.svg');
    const cloudField = new THREE.Group();
    const cloudSeed = (index: number) => {
      const value = Math.sin(index * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    for (let index = 0; index < 74; index += 1) {
      const band = index % 4;
      const progress = cloudSeed(index + 2);
      const theta = (band * Math.PI * 0.5) + progress * Math.PI * 1.45;
      const radius = 0.2 + progress * 0.68;
      const material = new THREE.SpriteMaterial({
        map: cloudTexture,
        color: 0xf4f6f3,
        transparent: true,
        opacity: 0.1 + cloudSeed(index + 9) * 0.22,
        depthWrite: false,
        rotation: cloudSeed(index + 14) * Math.PI,
      });
      const cloud = new THREE.Sprite(material);
      cloud.position.set(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0.08 + cloudSeed(index + 22) * 0.08,
      );
      const size = 0.16 + cloudSeed(index + 31) * 0.28;
      cloud.scale.set(size * 1.45, size, 1);
      cloudField.add(cloud);
    }
    storm.add(cloudField);

    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.028, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xf7f8f7, transparent: true, opacity: 0.48 }),
    );
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    storm.add(pulse, eye);
    const windRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.018, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xf7f8f7, transparent: true, opacity: 0.18 }),
    );
    windRing.rotation.x = Math.PI / 2;
    storm.add(windRing);

    // Four tapered spiral bands give the storm a recognizable cyclonic structure.
    for (let armIndex = 0; armIndex < 4; armIndex += 1) {
      const points: THREE.Vector3[] = [];
      const phase = (Math.PI * 2 * armIndex) / 4;
      for (let i = 0; i <= 40; i += 1) {
        const theta = phase + (i / 40) * Math.PI * 2.1;
        const radius = 0.12 + (i / 40) * 0.52;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
      }
      const arm = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xe8edf0, transparent: true, opacity: 0.2 }),
      );
      storm.add(arm);
    }

    const trackMaterial = new THREE.LineBasicMaterial({ color: 0xf4f6f3, transparent: true, opacity: 0.62 });
    const trackGeometry = new THREE.BufferGeometry().setFromPoints(geoData.counterfactualTrack.map((point) => latLonToVector(point.lat, point.lon, 1.89)));
    scene.add(new THREE.Line(trackGeometry, trackMaterial));
    const wakeMaterial = new THREE.LineBasicMaterial({ color: 0xb8d2d8, transparent: true, opacity: 0.35 });
    const wakePoints = geoData.counterfactualTrack.filter((point) => point.hour <= geoData.activeEye.hour).map((point) => latLonToVector(point.lat, point.lon, 1.91));
    if (wakePoints.length > 1) {
      wakeRef.current = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wakePoints), wakeMaterial);
      scene.add(wakeRef.current);
    }

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      storm.rotation.z += 0.018;
      pulse.scale.setScalar(1 + Math.sin(Date.now() * 0.004) * 0.12);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      trackGeometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
      controlsRef.current = null;
      cameraRef.current = null;
      wakeRef.current = null;
      modelRef.current = null;
    };
  }, [trackKey, webglUnavailable]);

  useEffect(() => {
    if (!stormRef.current) return;
    const position = latLonToVector(geoData.activeEye.lat, geoData.activeEye.lon, 1.94);
    stormRef.current.position.copy(position);
    stormRef.current.lookAt(0, 0, 0);
    const visualRadius = Math.max(0.7, Math.min(2.1, 0.52 + geoData.activeEye.rmaxKm / 78 + geoData.activeEye.windKts / 900));
    stormRef.current.scale.setScalar(visualRadius);

    const model = modelRef.current?.children[0] as THREE.Mesh | undefined;
    if (model) {
      const normalization = Number(model.userData.normalization) || 0.1;
      const windFactor = Math.max(0.72, Math.min(1.45, geoData.activeEye.windKts / 105));
      const residenceFactor = Math.max(0.85, Math.min(1.28, 1 + (24 - geoData.activeEye.localWindAtStationKts) / 240));
      const pressureFactor = Math.max(0.82, Math.min(1.2, 1 + (1010 - geoData.activeEye.pressureHpa) / 700));
      model.scale.set(
        normalization * windFactor * residenceFactor,
        normalization * windFactor,
        normalization * pressureFactor,
      );
      model.rotation.z = (geoData.activeEye.headingDeg * Math.PI) / 180;
      const material = model.material as THREE.ShaderMaterial;
      if (material.uniforms?.uOpacity) {
        material.uniforms.uOpacity.value = Math.max(0.5, Math.min(0.86, 0.54 + geoData.activeEye.windKts / 600));
      }
    }

    if (wakeRef.current) {
      const wakePoints = geoData.counterfactualTrack
        .filter((point) => point.hour <= geoData.activeEye.hour)
        .map((point) => latLonToVector(point.lat, point.lon, 1.91));
      if (wakePoints.length > 1) {
        wakeRef.current.geometry.dispose();
        wakeRef.current.geometry = new THREE.BufferGeometry().setFromPoints(wakePoints);
      }
    }
  }, [geoData.activeEye]);

  if (webglUnavailable) {
    return (
      <div className="cyclone-twin-globe cyclone-twin-globe-fallback" role="status">
        <Globe2 className="w-8 h-8" />
        <span>3D view is unavailable on this device.</span>
        <small>Use the 2D map to explore the cyclone track and ocean response.</small>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="cyclone-twin-globe" aria-label="Interactive 3D cyclone globe">
      <div className="cyclone-model-attribution">CLOUD MESH: HURRICANE MARIA · MODIS · CC0</div>
      <div className="cyclone-globe-zoom-controls">
        <button onClick={() => controlsRef.current?.dollyIn(1.35)} title="Zoom into globe"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button onClick={() => controlsRef.current?.dollyOut(1.35)} title="Zoom out of globe"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={() => { if (cameraRef.current && controlsRef.current) { cameraRef.current.position.set(0, 0.45, 5.6); controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); } }} title="Reset globe view"><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};

export const CycloneTwinHero: React.FC<CycloneTwinHeroProps> = ({
  preset,
  params,
  stationData,
  selectedHour,
  simulation,
  viewMode,
  isPlaying,
  onViewModeChange,
  onHourChange,
  onTogglePlayback,
}) => {
  const geoData = useMemo(() => computeCycloneGeospatialData(preset, stationData, params, selectedHour), [preset, stationData, params, selectedHour]);
  const currentStep = simulation.timesteps.find((step) => step.hour === selectedHour) || simulation.timesteps[24];
  const status = simulation.feedbackType === 'STRONG_NEGATIVE' ? 'SELF-INDUCED WEAKENING' : simulation.feedbackType === 'MODERATE_NEGATIVE' ? 'OCEAN FEEDBACK ACTIVE' : 'INTENSIFICATION SUPPORTED';

  return (
    <section className="cyclone-twin-hero liquid-glass liquid-glass-hero" aria-label="Cyclone digital twin" style={{ minHeight: 0 }}>
      <div className="cyclone-twin-hero-header">
        <div>
          <div className="cyclone-twin-kicker"><Radio className="w-3.5 h-3.5" /> LIVE DIGITAL TWIN // {preset.name.toUpperCase()}</div>
          <h2>Storm evolution and ocean feedback</h2>
          <p>Change the environment, then watch the atmosphere, surface, and subsurface respond together.</p>
        </div>
        <div className="cyclone-twin-view-switcher">
          {([['2D', Map], ['3D', Globe2], ['SPLIT', Activity]] as const).map(([mode, Icon]) => (
            <button key={mode} onClick={() => onViewModeChange(mode)} className={viewMode === mode ? 'is-active' : ''} title={`${mode} digital twin view`}>
              <Icon className="w-3.5 h-3.5" /> {mode}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`cyclone-twin-stage is-${viewMode.toLowerCase()}`}
        style={{
          minHeight: 390,
          gridTemplateColumns: viewMode === 'SPLIT' ? 'minmax(0, 1.35fr) minmax(300px, 0.65fr)' : 'minmax(0, 1fr)',
        }}
      >
        {(viewMode === '2D' || viewMode === 'SPLIT') && (
          <div className="cyclone-twin-leaflet-map" style={{ minHeight: 390 }}>
            <CycloneMapExplorer
              preset={preset}
              params={params}
              stationData={stationData}
              geoData={geoData}
              showPlanner
              selectedHour={selectedHour}
              onSelectHour={onHourChange}
              isCompact
            />
          </div>
        )}
        {(viewMode === '3D' || viewMode === 'SPLIT') && <Twin3DGlobe geoData={geoData} selectedHour={selectedHour} />}
        <div className="cyclone-twin-overlay cyclone-twin-overlay-top"><span><Wind className="w-3.5 h-3.5" /> {geoData.activeEye.windKts} kt</span><span>{geoData.activeEye.pressureHpa} hPa</span><span>{geoData.activeEye.rmaxKm} km RMAX</span></div>
        <div className="cyclone-twin-overlay cyclone-twin-overlay-bottom"><span className="twin-status-dot"></span>{status}<b>{currentStep.sst.toFixed(1)}°C SST</b><b>MLD {currentStep.mld.toFixed(0)}m</b></div>
      </div>

      <div className="cyclone-twin-controls">
        <button onClick={onTogglePlayback} className="cyclone-twin-play" title={isPlaying ? 'Pause storm playback' : 'Play storm playback'}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {isPlaying ? 'PAUSE' : 'PLAY STORM'}</button>
        <div className="cyclone-twin-time-label"><span>T -24H</span><strong>T {selectedHour >= 0 ? `+${selectedHour}` : selectedHour}H</strong><span>T +48H</span></div>
        <input aria-label="Cyclone simulation time" type="range" min="-24" max="48" value={selectedHour} onChange={(event) => onHourChange(Number(event.target.value))} />
      </div>
    </section>
  );
};
