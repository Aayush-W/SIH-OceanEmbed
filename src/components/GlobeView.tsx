import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STATIONS, getStationData, getLayerValueAndColor } from '../data/oceanData';
import { Station, SurfaceLayer, GlobeMapStyle } from '../types';
import { Layers, Eye, Activity, RotateCw, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface GlobeViewProps {
  selectedStationId: string | null;
  onSelectStation: (stationId: string | null) => void;
  currentDate: string;
  activeLayer: SurfaceLayer;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  globeStyle?: GlobeMapStyle;
  onChangeGlobeStyle?: (style: GlobeMapStyle) => void;
}

// Convert Lat/Lon to 3D Vector on Sphere
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
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

function createHighResBathymetryTexture(): {
  mapTexture: THREE.Texture;
  specularTexture: THREE.Texture;
  bumpTexture: THREE.Texture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const toCanvas = (lat: number, lon: number) => ({
    x: ((lon + 180) / 360) * canvas.width,
    y: ((90 - lat) / 180) * canvas.height,
  });

  const drawPoly = (points: [number, number][], fill: string, stroke: string, width = 1.5) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([lat, lon], idx) => {
      const { x, y } = toCanvas(lat, lon);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Base GEBCO Ocean Depth Gradient
  const oceanGrad = ctx.createRadialGradient(
    canvas.width * 0.72, canvas.height * 0.55, 50,
    canvas.width * 0.72, canvas.height * 0.55, canvas.width * 0.4
  );
  oceanGrad.addColorStop(0, '#0a2233');
  oceanGrad.addColorStop(0.3, '#061624');
  oceanGrad.addColorStop(0.7, '#030a12');
  oceanGrad.addColorStop(1, '#02060a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Continental Shelf Shallows
  const shelfGrad = ctx.createRadialGradient(
    toCanvas(15, 80).x, toCanvas(15, 80).y, 10,
    toCanvas(15, 80).x, toCanvas(15, 80).y, 320
  );
  shelfGrad.addColorStop(0, 'rgba(63, 224, 199, 0.15)');
  shelfGrad.addColorStop(0.6, 'rgba(28, 80, 100, 0.12)');
  shelfGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = shelfGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Bathymetric Depth Contours
  ctx.strokeStyle = 'rgba(63, 224, 199, 0.25)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 15) {
    const { y } = toCanvas(lat, 0);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 30) {
    const { x } = toCanvas(0, lon);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Ninety East Ridge
  ctx.strokeStyle = '#3FE0C7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const ne1 = toCanvas(18, 90);
  const ne2 = toCanvas(-32, 90);
  ctx.moveTo(ne1.x, ne1.y);
  ctx.lineTo(ne2.x, ne2.y);
  ctx.stroke();

  // Carlsberg Ridge
  ctx.strokeStyle = '#FF8A5B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const cir1 = toCanvas(23, 60);
  const cir2 = toCanvas(10, 64);
  const cir3 = toCanvas(-5, 68);
  const cir4 = toCanvas(-28, 70);
  ctx.moveTo(cir1.x, cir1.y);
  ctx.quadraticCurveTo(cir2.x, cir2.y, cir3.x, cir3.y);
  ctx.lineTo(cir4.x, cir4.y);
  ctx.stroke();

  // Landmasses & Coastlines
  const landFill = '#111D24';
  const landBorder = '#3FE0C7';

  // Indian Subcontinent
  drawPoly([
    [24, 68], [22, 70], [20.5, 72.8], [19, 72.9], [15.5, 73.8], [12, 75], [8.1, 77.5],
    [9.5, 79.2], [11, 79.8], [13.1, 80.3], [16, 81.5], [17.7, 83.3], [20, 86.5], [21.8, 87.5],
    [22.5, 89], [22, 91.5], [21, 92.5], [16, 94.5], [12, 98.5], [7, 99.5], [2, 102],
    [5, 105], [12, 109], [22, 108], [28, 97], [28, 85], [31, 77], [27, 70]
  ], landFill, landBorder, 2);

  // Sri Lanka
  drawPoly([[9.8, 80.2], [8.5, 79.7], [6.2, 80.5], [6.8, 81.8], [8.8, 81.3]], landFill, landBorder, 1.8);

  // Arabian Peninsula
  drawPoly([
    [30, 48], [28, 50], [25, 56], [24, 58], [22.5, 59.8], [18, 56], [14.5, 49], [12.5, 44.5],
    [14.5, 42.5], [20, 39], [26, 36], [29, 35], [31, 36], [32, 44]
  ], landFill, landBorder, 1.8);

  // Horn of Africa
  drawPoly([
    [12, 43], [11.8, 51.2], [4, 48], [-2, 41], [-11, 40.5], [-25, 33], [-34, 18], [-20, 12],
    [0, 9], [12, 15], [16, 39]
  ], landFill, landBorder, 1.8);

  // Madagascar
  drawPoly([[-12.2, 49.3], [-16, 44], [-25, 44], [-25.5, 47], [-15, 50.5]], landFill, landBorder, 1.5);

  // Sumatra, Java, Andaman Islands
  drawPoly([[5.5, 95.5], [2, 98], [-3, 102], [-6, 106], [-5, 104], [0, 100], [4, 96]], landFill, landBorder, 1.5);
  drawPoly([[13.5, 93], [11.5, 92.8], [11.5, 93.2], [13.5, 93.2]], landFill, '#3FE0C7', 2);
  drawPoly([[8, 93.5], [6.8, 93.8], [6.8, 94], [8, 93.8]], landFill, '#3FE0C7', 2);

  const specCanvas = document.createElement('canvas');
  specCanvas.width = 1024;
  specCanvas.height = 512;
  const sCtx = specCanvas.getContext('2d')!;
  sCtx.fillStyle = '#1c3044';
  sCtx.fillRect(0, 0, 1024, 512);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 1024;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 1024, 512);

  const mapTexture = new THREE.CanvasTexture(canvas);
  mapTexture.wrapS = THREE.RepeatWrapping;
  mapTexture.wrapT = THREE.ClampToEdgeWrapping;

  const specularTexture = new THREE.CanvasTexture(specCanvas);
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);

  return { mapTexture, specularTexture, bumpTexture };
}

function getGlobeTextures(style: GlobeMapStyle, onLoaded?: () => void): {
  mapTexture: THREE.Texture;
  bumpTexture?: THREE.Texture;
  specularTexture?: THREE.Texture;
} {
  if (style === 'SATELLITE') {
    const realSatTexture = textureLoader.load(NASA_SATELLITE_IMG, () => {
      if (onLoaded) onLoaded();
    });
    const bump = textureLoader.load(EARTH_TOPOLOGY_BUMP);
    const spec = textureLoader.load(EARTH_WATER_SPECULAR);
    return { mapTexture: realSatTexture, bumpTexture: bump, specularTexture: spec };
  } else if (style === 'TACTICAL') {
    const tacticalTexture = textureLoader.load(DARK_TACTICAL_MAP, () => {
      if (onLoaded) onLoaded();
    });
    return { mapTexture: tacticalTexture };
  } else {
    return createHighResBathymetryTexture();
  }
}

export const GlobeView: React.FC<GlobeViewProps> = ({
  selectedStationId,
  onSelectStation,
  currentDate,
  activeLayer,
  autoRotate,
  onToggleAutoRotate,
  globeStyle = 'SATELLITE',
  onChangeGlobeStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const markersRef = useRef<Map<string, { mesh: THREE.Mesh; sprite: THREE.Sprite; pulseRing: THREE.Mesh; station: Station }>>(new Map());
  const hoveredStationRef = useRef<Station | null>(null);

  const targetQuatRef = useRef<THREE.Quaternion | null>(null);
  const isTargetingStationRef = useRef<boolean>(false);

  const [internalGlobeStyle, setInternalGlobeStyle] = useState<GlobeMapStyle>(globeStyle);
  const activeGlobeStyle = globeStyle || internalGlobeStyle;

  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const selectedStationIdRef = useRef(selectedStationId);
  selectedStationIdRef.current = selectedStationId;

  const GLOBE_RADIUS = 2.0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.0, 5.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 8.5;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;
    controls.addEventListener('start', () => {
      isTargetingStationRef.current = false;
    });
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(5, 4, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3fe0c7, 0.5);
    dirLight2.position.set(-5, -2, -3);
    scene.add(dirLight2);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const { mapTexture, bumpTexture, specularTexture } = getGlobeTextures(activeGlobeStyle, () => {
      renderer.render(scene, camera);
    });
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: mapTexture,
      roughnessMap: specularTexture || null,
      bumpMap: bumpTexture || null,
      bumpScale: 0.03,
      roughness: 0.6,
      metalness: 0.1,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earth);
    earthMeshRef.current = earth;

    // Atmospheric Glow
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.02, 48, 48);
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
          float intensity = pow(0.65 - dot(vNormal, normalize(vViewPosition)), 3.0);
          gl_FragColor = vec4(glowColor, intensity * 0.45);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const atmos = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmos);

    // Initial center on Indian Ocean basin
    globeGroup.rotation.y = -Math.PI * 0.72;
    globeGroup.rotation.x = 0.22;

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    let animId: number;
    let time = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.015;

      if (isTargetingStationRef.current && targetQuatRef.current) {
        globeGroup.quaternion.slerp(targetQuatRef.current, 0.08);

        // Smoothly adjust camera zoom towards optimal observation distance
        if (camera) {
          const targetLen = 4.2;
          const currentLen = camera.position.length();
          if (Math.abs(currentLen - targetLen) > 0.02) {
            camera.position.setLength(currentLen + (targetLen - currentLen) * 0.06);
          }
        }

        if (globeGroup.quaternion.angleTo(targetQuatRef.current) < 0.0015) {
          isTargetingStationRef.current = false;
        }
      } else if (autoRotateRef.current && !selectedStationIdRef.current) {
        globeGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.001);
      }

      controls.update();

      markersRef.current.forEach(({ pulseRing }) => {
        const scale = 1 + (Math.sin(time * 3) * 0.5 + 0.5) * 0.6;
        pulseRing.scale.set(scale, scale, scale);
        const mat = pulseRing.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 * (1 - (scale - 1) / 0.6);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const earth = earthMeshRef.current;
    if (!earth) return;

    const { mapTexture, specularTexture, bumpTexture } = getGlobeTextures(activeGlobeStyle, () => {
      const mat = earth.material as THREE.MeshStandardMaterial;
      mat.needsUpdate = true;
    });

    const mat = earth.material as THREE.MeshStandardMaterial;
    mat.map = mapTexture;
    mat.roughnessMap = specularTexture || null;
    mat.bumpMap = bumpTexture || null;
    mat.needsUpdate = true;
  }, [activeGlobeStyle]);

  // Station focus rotation - mathematically exact quaternion alignment toward camera
  useEffect(() => {
    if (selectedStationId && globeGroupRef.current && cameraRef.current) {
      const station = STATIONS.find((s) => s.id === selectedStationId);
      if (station) {
        // Point vector on unrotated local sphere
        const localPos = latLonToVector3(station.lat, station.lon, 1.0);
        // Camera direction in world coordinates looking from target
        const cam = cameraRef.current;
        const camDir = cam.position.clone().normalize();

        // Exact rotation quaternion from local station vector to camera direction
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
          localPos.normalize(),
          camDir
        );

        targetQuatRef.current = targetQuat;
        isTargetingStationRef.current = true;
      }
    } else if (!selectedStationId) {
      isTargetingStationRef.current = false;
      targetQuatRef.current = null;
    }
  }, [selectedStationId]);

  // Update Station Markers
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    markersRef.current.forEach(({ mesh, sprite, pulseRing }) => {
      globeGroup.remove(mesh);
      globeGroup.remove(sprite);
      globeGroup.remove(pulseRing);
    });
    markersRef.current.clear();

    STATIONS.forEach((station) => {
      const data = getStationData(station.id, currentDate, activeLayer);
      const { hexColor } = getLayerValueAndColor(data, activeLayer);
      const color = new THREE.Color(hexColor);

      const pos = latLonToVector3(station.lat, station.lon, GLOBE_RADIUS * 1.012);

      const markerGeo = new THREE.SphereGeometry(0.038, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: color });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.copy(pos);
      markerMesh.userData = { stationId: station.id, station };

      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = 128;
      spriteCanvas.height = 128;
      const sCtx = spriteCanvas.getContext('2d')!;
      const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, hexColor);
      grad.addColorStop(0.35, hexColor + 'bb');
      grad.addColorStop(0.75, hexColor + '22');
      grad.addColorStop(1, 'transparent');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);

      const spriteMat = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(spriteCanvas),
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.35, 0.35, 1);
      markerMesh.add(sprite);

      const ringGeo = new THREE.RingGeometry(0.045, 0.07, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.position.copy(pos);
      pulseRing.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(pulseRing);

      globeGroup.add(markerMesh);
      markersRef.current.set(station.id, { mesh: markerMesh, sprite, pulseRing, station });
    });
  }, [currentDate, activeLayer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!container || !camera || !scene) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const meshes: THREE.Mesh[] = [];
      markersRef.current.forEach(({ mesh }) => meshes.push(mesh));

      const intersects = raycaster.intersectObjects(meshes, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.stationId && obj.parent) {
          obj = obj.parent as THREE.Mesh;
        }
        if (obj?.userData?.stationId) {
          onSelectStation(obj.userData.stationId);
        }
      }
    },
    [onSelectStation]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const meshes: THREE.Mesh[] = [];
    markersRef.current.forEach(({ mesh }) => meshes.push(mesh));

    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.stationId && obj.parent) {
        obj = obj.parent as THREE.Mesh;
      }
      if (obj?.userData?.station) {
        hoveredStationRef.current = obj.userData.station;
        setHoveredStation(obj.userData.station);
        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        container.style.cursor = 'pointer';
        return;
      }
    }

    hoveredStationRef.current = null;
    setHoveredStation(null);
    setHoverPos(null);
    container.style.cursor = 'default';
  }, []);

  const handleZoom = (delta: number) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const currentLen = cam.position.length();
    const newLen = Math.max(2.8, Math.min(8.5, currentLen + delta));
    cam.position.setLength(newLen);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {/* Globe Controls & Texture Switcher HUD */}
      <div className="absolute top-4 left-6 z-20 flex flex-wrap items-center gap-2">
        <div className="glass-control bg-[#0A1119]/95 border border-[#1C2A33] p-1 backdrop-blur-md flex items-center gap-1 shadow-2xl">
          <button
            onClick={() => {
              if (onChangeGlobeStyle) onChangeGlobeStyle('SATELLITE');
              else setInternalGlobeStyle('SATELLITE');
            }}
            className={`px-2.5 py-1 text-[11px] font-space font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeGlobeStyle === 'SATELLITE'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>REAL SATELLITE</span>
          </button>
          <button
            onClick={() => {
              if (onChangeGlobeStyle) onChangeGlobeStyle('BATHYMETRY');
              else setInternalGlobeStyle('BATHYMETRY');
            }}
            className={`px-2.5 py-1 text-[11px] font-space font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeGlobeStyle === 'BATHYMETRY'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>HIGH-RES BATHYMETRY</span>
          </button>
          <button
            onClick={() => {
              if (onChangeGlobeStyle) onChangeGlobeStyle('TACTICAL');
              else setInternalGlobeStyle('TACTICAL');
            }}
            className={`px-2.5 py-1 text-[11px] font-space font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeGlobeStyle === 'TACTICAL'
                ? 'bg-[#3FE0C7] text-[#05080D] font-bold shadow-md'
                : 'text-[#6E8391] hover:text-[#E8EDF0]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>TACTICAL DARK</span>
          </button>
        </div>

        {/* Auto-Rotate Switch */}
        <button
          onClick={onToggleAutoRotate}
          className={`px-3 py-1 text-[11px] font-space font-semibold uppercase tracking-wider border backdrop-blur-md flex items-center gap-1.5 shadow-2xl transition-all ${
            autoRotate
              ? 'bg-[#3FE0C7]/15 border-[#3FE0C7] text-[#3FE0C7]'
              : 'bg-[#0A1119]/95 border-[#1C2A33] text-[#6E8391] hover:text-[#E8EDF0]'
          }`}
          title="Toggle globe orbit rotation"
        >
          <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          <span>{autoRotate ? 'ORBIT: ON' : 'ORBIT: PAUSED'}</span>
        </button>
      </div>

      {/* Manual Zoom Controls on 3D Globe */}
      <div className="absolute right-6 bottom-24 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => handleZoom(-0.6)}
          className="glass-control w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-xl"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.6)}
          className="glass-control w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-xl"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const cam = cameraRef.current;
            if (cam) cam.position.set(0, 1.0, 5.2);
            if (globeGroupRef.current) {
              globeGroupRef.current.rotation.set(0.22, -Math.PI * 0.72, 0);
            }
          }}
          className="glass-control w-8 h-8 bg-[#0A1119]/95 hover:bg-[#3FE0C7] hover:text-[#05080D] text-[#E8EDF0] border border-[#1C2A33] flex items-center justify-center transition-colors shadow-xl"
          title="Reset Globe View"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Target Node Hover Tooltip */}
      {hoveredStation && hoverPos && !selectedStationId && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <div className="bg-[#0A1119]/95 border border-[#1C2A33] p-2.5 backdrop-blur-md relative font-data shadow-2xl">
            <div className="corner-bracket corner-tl"></div>
            <div className="corner-bracket corner-tr"></div>
            <div className="corner-bracket corner-bl"></div>
            <div className="corner-bracket corner-br"></div>
            <div className="text-[10px] text-[#3FE0C7] tracking-widest font-space uppercase mb-0.5">
              TARGET NODE
            </div>
            <div className="text-xs font-bold text-[#E8EDF0] tracking-wider uppercase">
              {hoveredStation.code} — {hoveredStation.name}
            </div>
            <div className="text-[11px] text-[#6E8391] mt-0.5">
              {hoveredStation.lat.toFixed(2)}°N, {hoveredStation.lon.toFixed(2)}°E
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-[#1C2A33] flex items-center justify-between text-[10px] text-[#3FE0C7]">
              <span>CLICK TO INSPECT PROFILE</span>
              <span className="animate-pulse">▶</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
