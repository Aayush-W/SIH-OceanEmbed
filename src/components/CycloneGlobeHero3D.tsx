import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CycloneHistoricalPreset,
  CycloneScenarioParams,
  CycloneTrackWaypoint,
  ActiveEyeState,
  computeCycloneGeospatialData,
} from '../physics/pwpModel';
import { StationData } from '../types';
import { Compass, RotateCw, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';

interface CycloneGlobeHero3DProps {
  preset: CycloneHistoricalPreset;
  params: CycloneScenarioParams;
  stationData: StationData;
  selectedHour: number;
  isScenarioActive: boolean;
  onSelectHour?: (hour: number) => void;
  className?: string;
}

// Convert geographic lat/lon to 3D Cartesian coordinates on sphere of radius R
export function geoToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const textureLoader = new THREE.TextureLoader();

const NASA_SATELLITE_IMG = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const EARTH_TOPOLOGY_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const EARTH_WATER_SPECULAR = 'https://unpkg.com/three-globe/example/img/earth-water.png';
const DARK_TACTICAL_MAP = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';

export const CycloneGlobeHero3D: React.FC<CycloneGlobeHero3DProps> = ({
  preset,
  params,
  stationData,
  selectedHour,
  isScenarioActive,
  onSelectHour,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const eyeMarkerGroupRef = useRef<THREE.Group | null>(null);
  const pulseRingMeshRef = useRef<THREE.Mesh | null>(null);
  const spiralMeshRef = useRef<THREE.Mesh | null>(null);
  const trackSplineMeshRef = useRef<THREE.Mesh | null>(null);
  const ghostTrackMeshRef = useRef<THREE.Line | null>(null);
  const wakeRibbonGroupRef = useRef<THREE.Group | null>(null);

  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const autoRotateTimerRef = useRef<any>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringEye, setIsHoveringEye] = useState<boolean>(false);

  const GLOBE_RADIUS = 2.15;

  // Compute full geospatial positions for this timestep
  const geoData = useMemo(() => {
    return computeCycloneGeospatialData(preset, stationData, params, selectedHour);
  }, [preset, stationData, params, selectedHour]);

  const activeEye = geoData.activeEye;

  // Filter waypoints up to current hour to render progressive cold wake
  const traversedWaypoints = useMemo(() => {
    return geoData.counterfactualTrack.filter((p) => p.hour <= selectedHour + 2);
  }, [geoData.counterfactualTrack, selectedHour]);

  // Restart auto-rotate gently after user stops dragging
  const handleUserInteract = useCallback(() => {
    setAutoRotate(false);
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    autoRotateTimerRef.current = setTimeout(() => {
      setAutoRotate(true);
    }, 4500);
  }, []);

  // Initialize Three.js Scene (same globe as GlobeView: NASA satellite texture, specular, bump, atmosphere)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Perspective Camera: looking at the North Indian Ocean & Bay of Bengal
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    const initialCamPos = geoToVector3(14, 86, 5.4);
    camera.position.copy(initialCamPos);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.8;
    controls.maxDistance = 8.5;
    controls.rotateSpeed = 0.75;
    controls.enablePan = false;
    controlsRef.current = controls;

    // Lighting (Warm Key + Ocean Rim Cool Fill)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff6ea, 1.6);
    sunLight.position.set(8, 7, 10);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x3fe0c7, 0.6);
    rimLight.position.set(-8, -4, -6);
    scene.add(rimLight);

    // Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // Load NASA Earth Blue Marble Sat Texture + Water Specular + Bump Map
    const satTexture = textureLoader.load(NASA_SATELLITE_IMG, () => {
      renderer.render(scene, camera);
    });
    const bumpTexture = textureLoader.load(EARTH_TOPOLOGY_BUMP);
    const specTexture = textureLoader.load(EARTH_WATER_SPECULAR);

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: satTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.03,
      roughnessMap: specTexture,
      roughness: 0.55,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // Atmospheric Glow Shader (same as GlobeView)
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.022, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x3fe0c7) },
        viewVector: { value: camera.position },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, normalize(vViewPosition)), 2.9);
          gl_FragColor = vec4(glowColor, intensity * 0.45);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const atmos = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmos);

    // Eye Marker Group (rotating eyewall spiral, wind radius circle, central eye beacon)
    const eyeGroup = new THREE.Group();
    globeGroup.add(eyeGroup);
    eyeMarkerGroupRef.current = eyeGroup;

    // Eyewall spiral canvas
    const spiralCanvas = document.createElement('canvas');
    spiralCanvas.width = 128;
    spiralCanvas.height = 128;
    const sCtx = spiralCanvas.getContext('2d')!;
    sCtx.strokeStyle = '#3FE0C7';
    sCtx.lineWidth = 4.5;
    sCtx.shadowColor = '#3FE0C7';
    sCtx.shadowBlur = 10;
    sCtx.beginPath();
    for (let i = 0; i < 720; i++) {
      const angle = (i * Math.PI) / 180;
      const r = (i / 720) * 46;
      const sx = 64 + r * Math.cos(angle);
      const sy = 64 + r * Math.sin(angle);
      if (i === 0) sCtx.moveTo(sx, sy);
      else sCtx.lineTo(sx, sy);
    }
    sCtx.stroke();

    // Opposite spiral arm
    sCtx.strokeStyle = '#7DD3FC';
    sCtx.lineWidth = 3;
    sCtx.beginPath();
    for (let i = 0; i < 720; i++) {
      const angle = (i * Math.PI) / 180 + Math.PI;
      const r = (i / 720) * 46;
      const sx = 64 + r * Math.cos(angle);
      const sy = 64 + r * Math.sin(angle);
      if (i === 0) sCtx.moveTo(sx, sy);
      else sCtx.lineTo(sx, sy);
    }
    sCtx.stroke();

    // Eyewall core
    sCtx.fillStyle = '#FFFFFF';
    sCtx.beginPath();
    sCtx.arc(64, 64, 5, 0, Math.PI * 2);
    sCtx.fill();

    const spiralTex = new THREE.CanvasTexture(spiralCanvas);
    const spiralMat = new THREE.MeshBasicMaterial({
      map: spiralTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const spiralGeo = new THREE.PlaneGeometry(0.38, 0.38);
    const spiralMesh = new THREE.Mesh(spiralGeo, spiralMat);
    eyeGroup.add(spiralMesh);
    spiralMeshRef.current = spiralMesh;

    // Pulsing Wind Radius Ring
    const ringGeo = new THREE.RingGeometry(0.18, 0.22, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3fe0c7,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const pulseRing = new THREE.Mesh(ringGeo, ringMat);
    eyeGroup.add(pulseRing);
    pulseRingMeshRef.current = pulseRing;

    // Vertical Core Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.01, 0.03, 0.45, 12);
    beaconGeo.translate(0, 0.225, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x3fe0c7,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.rotation.x = Math.PI / 2;
    eyeGroup.add(beacon);

    // Group for cold wake swaths
    const wakeGroup = new THREE.Group();
    globeGroup.add(wakeGroup);
    wakeRibbonGroupRef.current = wakeGroup;

    // Collocated Station Marker (e.g. RAMA BD08 or target station)
    const stLat = stationData.station.lat;
    const stLon = stationData.station.lon;
    const stPos = geoToVector3(stLat, stLon, GLOBE_RADIUS * 1.006);

    const stMarkerGroup = new THREE.Group();
    stMarkerGroup.position.copy(stPos);
    globeGroup.add(stMarkerGroup);

    const stPinGeo = new THREE.SphereGeometry(0.024, 16, 16);
    const stPinMat = new THREE.MeshBasicMaterial({ color: 0x3fe0c7 });
    const stPin = new THREE.Mesh(stPinGeo, stPinMat);
    stMarkerGroup.add(stPin);

    const stRingGeo = new THREE.RingGeometry(0.035, 0.045, 24);
    const stRingMat = new THREE.MeshBasicMaterial({
      color: 0x3fe0c7,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const stRing = new THREE.Mesh(stRingGeo, stRingMat);
    stRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), stPos.clone().normalize());
    stMarkerGroup.add(stRing);

    // Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    let clockTime = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clockTime += 0.016;

      // Gentle auto-rotation around globe Y axis when idle
      if (autoRotate && globeGroupRef.current) {
        globeGroupRef.current.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.001);
      }

      // Eyewall Spiral spin
      if (spiralMeshRef.current) {
        spiralMeshRef.current.rotation.z -= 0.055;
      }

      // Wind radius ring pulse
      if (pulseRingMeshRef.current) {
        const pulse = 1 + Math.sin(clockTime * 4) * 0.18;
        pulseRingMeshRef.current.scale.set(pulse, pulse, pulse);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Eye Position & Alignment on Globe
  useEffect(() => {
    if (!eyeMarkerGroupRef.current) return;
    const eyePos = geoToVector3(activeEye.lat, activeEye.lon, GLOBE_RADIUS * 1.008);
    eyeMarkerGroupRef.current.position.copy(eyePos);

    // Align eye marker outward along sphere normal
    eyeMarkerGroupRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      eyePos.clone().normalize()
    );

    // Scale wind radius ring according to simulated Rmax
    if (pulseRingMeshRef.current) {
      const scale = Math.max(0.6, Math.min(2.4, activeEye.rmaxKm / 32));
      pulseRingMeshRef.current.scale.set(scale, scale, scale);
    }
  }, [activeEye.lat, activeEye.lon, activeEye.rmaxKm]);

  // Update Cyclone 3D Track & Ghost Trail Splines
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    // 1. Remove previous tracks
    if (trackSplineMeshRef.current) {
      globeGroup.remove(trackSplineMeshRef.current);
      trackSplineMeshRef.current = null;
    }
    if (ghostTrackMeshRef.current) {
      globeGroup.remove(ghostTrackMeshRef.current);
      ghostTrackMeshRef.current = null;
    }

    // 2. Build Scenario Active Track (Glowing 3D Tube Spline)
    const pts = geoData.counterfactualTrack.map((wp) =>
      geoToVector3(wp.lat, wp.lon, GLOBE_RADIUS * 1.01)
    );

    if (pts.length > 2) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 96, 0.016, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x3fe0c7,
        emissive: 0x3fe0c7,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      globeGroup.add(tubeMesh);
      trackSplineMeshRef.current = tubeMesh;
    }

    // 3. Historical Baseline Ghost Trail (when scenario is active)
    if (isScenarioActive) {
      const ghostPts = geoData.historicalBaselineTrack.map((wp) =>
        geoToVector3(wp.lat, wp.lon, GLOBE_RADIUS * 1.007)
      );
      if (ghostPts.length > 2) {
        const ghostGeo = new THREE.BufferGeometry().setFromPoints(ghostPts);
        const ghostMat = new THREE.LineDashedMaterial({
          color: 0x6e8391,
          dashSize: 0.08,
          gapSize: 0.04,
          transparent: true,
          opacity: 0.65,
        });
        const ghostLine = new THREE.Line(ghostGeo, ghostMat);
        ghostLine.computeLineDistances();
        globeGroup.add(ghostLine);
        ghostTrackMeshRef.current = ghostLine;
      }
    }
  }, [geoData, isScenarioActive]);

  // Update Dynamic Cold Wake Ribbon on Ocean Surface
  useEffect(() => {
    const wakeGroup = wakeRibbonGroupRef.current;
    if (!wakeGroup) return;

    // Clear previous wake meshes
    while (wakeGroup.children.length > 0) {
      wakeGroup.remove(wakeGroup.children[0]);
    }

    if (traversedWaypoints.length < 2) return;

    // Draw cold wake swath along traversed waypoints
    const wakePts = traversedWaypoints.map((wp) =>
      geoToVector3(wp.lat, wp.lon, GLOBE_RADIUS * 1.005)
    );

    if (wakePts.length > 2) {
      const wakeCurve = new THREE.CatmullRomCurve3(wakePts);
      const wakeTubeGeo = new THREE.TubeGeometry(wakeCurve, 64, 0.045, 6, false);
      const wakeTubeMat = new THREE.MeshBasicMaterial({
        color: 0x0a2233,
        transparent: true,
        opacity: 0.7,
        depthTest: true,
      });
      const wakeTube = new THREE.Mesh(wakeTubeGeo, wakeTubeMat);
      wakeGroup.add(wakeTube);
    }
  }, [traversedWaypoints]);

  // Recenter Camera to Bay of Bengal Hero Observation View
  const handleRecenterBoB = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const heroPos = geoToVector3(14, 86, 5.4);
    cameraRef.current.position.copy(heroPos);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
      onPointerDown={handleUserInteract}
      onWheel={handleUserInteract}
    >
      {/* 3D WebGL Canvas Mount (Full Bleed Background) */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Floating Tactical Recenter & Scan Bar (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={handleRecenterBoB}
          title="Auto-Center Bay of Bengal & North Indian Ocean Basin"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1119]/80 backdrop-blur-md border border-[#1C2A33] hover:border-[#3FE0C7] text-xs font-mono text-[#E8EDF0] rounded-lg transition-colors shadow-lg"
        >
          <Compass className="w-3.5 h-3.5 text-[#3FE0C7]" />
          <span>RECENTER BAY OF BENGAL</span>
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0A1119]/80 backdrop-blur-md border rounded-lg text-xs font-mono transition-colors ${
            autoRotate
              ? 'border-[#3FE0C7]/40 text-[#3FE0C7]'
              : 'border-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0]'
          }`}
          title="Toggle gentle planetary orbit"
        >
          <span className={`w-2 h-2 rounded-full ${autoRotate ? 'bg-[#3FE0C7] animate-pulse' : 'bg-[#6E8391]'}`} />
          <span>{autoRotate ? 'ORBIT ACTIVE' : 'ORBIT PAUSED'}</span>
        </button>

        {isScenarioActive && (
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-[#0A1119]/85 backdrop-blur-md border border-[#1C2A33] rounded-lg text-[11px] font-mono">
            <span className="w-2.5 h-1 bg-[#3FE0C7] rounded shadow-[0_0_8px_#3FE0C7]" />
            <span className="text-[#3FE0C7] font-semibold">Scenario</span>
            <div className="w-[1px] h-3 bg-[#1C2A33]" />
            <span className="w-2.5 h-[2px] border-b border-dashed border-[#6E8391]" />
            <span className="text-[#6E8391]">Historical Ghost Trail</span>
          </div>
        )}
      </div>

      {/* Floating Eye Marker Telemetry Badge (Top Center-Left) */}
      <div className="absolute top-16 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0A1119]/80 backdrop-blur-md border border-[#1C2A33] rounded-lg text-xs font-mono text-[#6E8391]">
        <span className="w-2 h-2 rounded-full bg-[#3FE0C7] animate-ping" />
        <span className="text-[#E8EDF0] font-bold uppercase">{preset.name}</span>
        <span>•</span>
        <span className="text-[#3FE0C7]">{activeEye.windKts} kts ({Math.round(activeEye.windKts * 1.852)} km/h)</span>
        <span>•</span>
        <span className="text-[#E8EDF0] whitespace-nowrap">{activeEye.lat.toFixed(1)}°N, {activeEye.lon.toFixed(1)}°E</span>
      </div>
    </div>
  );
};
