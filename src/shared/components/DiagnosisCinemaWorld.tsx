import { useDeferredValue, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { clampDiagnosisCorridorStepIndex, getDiagnosisSceneState } from '@/shared/lib/diagnosisCorridor';

const CAMERA_POSITIONS = [
  new THREE.Vector3(-4.6, 1.2, 22.4),
  new THREE.Vector3(-1.1, 0.7, 18.6),
  new THREE.Vector3(0.3, 0.4, 14.2),
  new THREE.Vector3(2.6, 0.3, 15.6),
  new THREE.Vector3(1.1, 0.2, 13.4),
] as const;

const CAMERA_TARGETS = [
  new THREE.Vector3(-3.2, 0, 0),
  new THREE.Vector3(1.4, 0, 0),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(2.4, 0, 0),
  new THREE.Vector3(0.4, 0, 0),
] as const;

const FOCAL_POINTS = [
  new THREE.Vector3(-3.2, 0, 0),
  new THREE.Vector3(-0.6, 0, 0),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(2.4, 0, 0),
  new THREE.Vector3(0.4, 0, 0),
] as const;

const COLOR_WHITE = new THREE.Color(0xf8fbff);
const COLOR_SKY = new THREE.Color(0x7dd3fc);
const COLOR_VIOLET = new THREE.Color(0xc4b5fd);

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

function seededRange(seed: number, min: number, max: number) {
  return min + seededUnit(seed) * (max - min);
}

function setPosition(buffer: Float32Array, index: number, x: number, y: number, z: number) {
  const offset = index * 3;
  buffer[offset] = x;
  buffer[offset + 1] = y;
  buffer[offset + 2] = z;
}

function setColor(buffer: Float32Array, index: number, color: THREE.Color) {
  const offset = index * 3;
  buffer[offset] = color.r;
  buffer[offset + 1] = color.g;
  buffer[offset + 2] = color.b;
}

function finalFramePoint(progress: number, width: number, height: number) {
  const perimeter = width * 2 + height * 2;
  const distance = progress * perimeter;

  if (distance <= width) return new THREE.Vector3(-width / 2 + distance, height / 2, 0);
  if (distance <= width + height) return new THREE.Vector3(width / 2, height / 2 - (distance - width), 0);
  if (distance <= width * 2 + height) return new THREE.Vector3(width / 2 - (distance - width - height), -height / 2, 0);
  return new THREE.Vector3(-width / 2, -height / 2 + (distance - width * 2 - height), 0);
}

function createPairs(nodeCount: number) {
  const pairs: Array<[number, number]> = [];

  for (let index = 0; index < nodeCount - 1; index += 1) {
    pairs.push([index, index + 1]);
  }

  for (let index = 0; index < nodeCount - 6; index += 3) {
    pairs.push([index, index + 6]);
  }

  for (let index = 0; index < nodeCount / 3; index += 5) {
    pairs.push([index, index + Math.floor(nodeCount / 3)]);
    pairs.push([index + Math.floor(nodeCount / 3), index + Math.floor((nodeCount / 3) * 2)]);
  }

  return pairs;
}

function buildDetectionLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);

  for (let index = 0; index < nodeCount; index += 1) {
    const progress = index / Math.max(1, nodeCount - 1);
    const band = index % 7;
    const x = THREE.MathUtils.lerp(-12, 11.5, progress) + Math.sin(progress * Math.PI * 7 + band) * 0.9;
    const y = Math.sin(progress * Math.PI * 5 + band * 0.7) * (1.3 + (band % 3)) + seededRange(index + 11, -1.4, 1.4);
    const z = Math.cos(progress * Math.PI * 4 + band * 0.45) * 2.7 + seededRange(index + 21, -1.3, 1.3);
    setPosition(positions, index, index < nodeCount * 0.22 ? THREE.MathUtils.lerp(-7.8, -2.4, progress / 0.22) : x, y, z);
  }

  return positions;
}

function buildBranchLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const third = Math.floor(nodeCount / 3);

  for (let index = 0; index < nodeCount; index += 1) {
    const branch = Math.min(2, Math.floor(index / third));
    const local = (index % third) / Math.max(1, third - 1);
    const targetY = [-5.2, 0, 5.2][branch];
    const x = THREE.MathUtils.lerp(-5.8, 9.6, local);
    const y = THREE.MathUtils.lerp(0, targetY, local) + Math.sin(local * Math.PI) * (branch === 1 ? 0.3 : 1.2);
    const z = Math.sin(local * Math.PI * 3 + branch) * 1.5 + seededRange(index + 31, -0.5, 0.5);
    setPosition(positions, index, x + seededRange(index + 41, -0.4, 0.4), y + seededRange(index + 51, -0.35, 0.35), z);
  }

  return positions;
}

function buildMergeLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);

  for (let index = 0; index < nodeCount; index += 1) {
    const progress = index / Math.max(1, nodeCount - 1);
    const theta = progress * Math.PI * 11;
    const radius = 0.9 + (index % 22) * 0.12;
    setPosition(
      positions,
      index,
      Math.cos(theta) * radius * 0.9,
      Math.sin(theta) * radius * 0.72,
      Math.sin(theta * 1.3) * 1.5 + seededRange(index + 61, -0.15, 0.15),
    );
  }

  return positions;
}

function buildOutputLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const rayTargets = [
    new THREE.Vector3(9.4, -4.8, 1.1),
    new THREE.Vector3(10.2, 0.2, 1.4),
    new THREE.Vector3(9.2, 4.8, -1),
  ];

  for (let index = 0; index < nodeCount; index += 1) {
    const rayIndex = index % 3;
    const progress = Math.floor(index / 3) / Math.max(1, Math.floor(nodeCount / 3) - 1);
    const theta = (index / nodeCount) * Math.PI * 8;
    const source = new THREE.Vector3(Math.cos(theta) * 1.9, Math.sin(theta) * 1.3, Math.sin(theta * 1.4) * 0.7);
    const point = source.lerp(rayTargets[rayIndex], progress);
    setPosition(
      positions,
      index,
      point.x + seededRange(index + 71, -0.22, 0.22),
      point.y + seededRange(index + 81, -0.28, 0.28),
      point.z + seededRange(index + 91, -0.26, 0.26),
    );
  }

  return positions;
}

function buildPayoffLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const storeCount = Math.floor(nodeCount * 0.26);
  const dashboardCount = Math.floor(nodeCount * 0.3);
  const orbitStart = storeCount + dashboardCount;

  for (let index = 0; index < storeCount; index += 1) {
    const point = finalFramePoint(index / Math.max(1, storeCount - 1), 5.1, 7);
    setPosition(positions, index, point.x - 4.5, point.y + 0.35, seededRange(index + 101, -0.25, 0.25));
  }

  for (let index = 0; index < dashboardCount; index += 1) {
    const point = finalFramePoint(index / Math.max(1, dashboardCount - 1), 7.4, 4.6);
    setPosition(positions, storeCount + index, point.x + 4.7, point.y - 0.1, seededRange(index + 111, -0.22, 0.22));
  }

  for (let index = orbitStart; index < nodeCount; index += 1) {
    const progress = (index - orbitStart) / Math.max(1, nodeCount - orbitStart - 1);
    const theta = progress * Math.PI * 8;
    const radius = 1 + (index % 14) * 0.09;
    setPosition(
      positions,
      index,
      Math.cos(theta) * radius * 0.84,
      Math.sin(theta) * radius * 0.7,
      Math.sin(theta * 1.2) * 1 + seededRange(index + 121, -0.12, 0.12),
    );
  }

  return positions;
}

function buildLayouts(nodeCount: number) {
  return [
    buildDetectionLayout(nodeCount),
    buildBranchLayout(nodeCount),
    buildMergeLayout(nodeCount),
    buildOutputLayout(nodeCount),
    buildPayoffLayout(nodeCount),
  ] as const;
}

function updateLinePositions(linePositions: Float32Array, points: Float32Array, pairs: Array<[number, number]>) {
  for (let index = 0; index < pairs.length; index += 1) {
    const [from, to] = pairs[index];
    const targetOffset = index * 6;
    const fromOffset = from * 3;
    const toOffset = to * 3;
    linePositions[targetOffset] = points[fromOffset];
    linePositions[targetOffset + 1] = points[fromOffset + 1];
    linePositions[targetOffset + 2] = points[fromOffset + 2];
    linePositions[targetOffset + 3] = points[toOffset];
    linePositions[targetOffset + 4] = points[toOffset + 1];
    linePositions[targetOffset + 5] = points[toOffset + 2];
  }
}

function dampValue(current: number, target: number, lambda: number, delta: number) {
  return THREE.MathUtils.damp(current, target, lambda, delta);
}

export function DiagnosisCinemaWorld({
  isFrozen = false,
  pulseSeed = 0,
  stepIndex,
}: {
  isFrozen?: boolean;
  pulseSeed?: number;
  stepIndex: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef(clampDiagnosisCorridorStepIndex(stepIndex));
  const frozenRef = useRef(isFrozen);
  const pulseSeedRef = useRef(pulseSeed);
  const pulseProgressRef = useRef(1);
  const pulseAnchorRef = useRef(FOCAL_POINTS[0].clone());
  const payoffProgressRef = useRef(0);
  const deferredStepIndex = useDeferredValue(stepIndex);

  useEffect(() => {
    stepRef.current = clampDiagnosisCorridorStepIndex(deferredStepIndex);
    if (stepRef.current !== 4) {
      payoffProgressRef.current = 0;
    }
  }, [deferredStepIndex]);

  useEffect(() => {
    frozenRef.current = isFrozen;
  }, [isFrozen]);

  useEffect(() => {
    if (pulseSeed === pulseSeedRef.current) return;
    pulseSeedRef.current = pulseSeed;
    pulseProgressRef.current = 0;
    pulseAnchorRef.current.copy(FOCAL_POINTS[stepRef.current]);
  }, [pulseSeed]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const isMobile = window.innerWidth < 768;
    const nodeCount = isMobile ? 126 : 174;
    const layouts = buildLayouts(nodeCount);
    const colors = new Float32Array(nodeCount * 3);
    for (let index = 0; index < nodeCount; index += 1) {
      setColor(colors, index, index % 6 < 2 ? COLOR_SKY : index % 6 < 4 ? COLOR_VIOLET : COLOR_WHITE);
    }

    const currentPositions = layouts[0].slice();
    const pairs = createPairs(nodeCount);
    const linePositions = new Float32Array(pairs.length * 6);
    updateLinePositions(linePositions, currentPositions, pairs);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x02050a, 14, 34);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.copy(CAMERA_POSITIONS[0]);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 1.75));
    renderer.setClearColor(0x02050a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 1.2 : 1.55, 0.95, 0.62);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloomPass);

    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const coolLight = new THREE.PointLight(0xbcc8ff, 1.7, 30);
    coolLight.position.set(2, 4.8, 8.4);
    const skyLight = new THREE.PointLight(0x7dd3fc, 1.4, 30);
    skyLight.position.set(-8, -3, 5.4);
    const warmLight = new THREE.PointLight(0xff8a2b, 0.88, 16);
    warmLight.position.set(0, 0, 6.4);
    scene.add(coolLight, skyLight, warmLight);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = isMobile ? 320 : 520;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      starPositions[index * 3] = seededRange(index + 131, -24, 24);
      starPositions[index * 3 + 1] = seededRange(index + 141, -14, 14);
      starPositions[index * 3 + 2] = seededRange(index + 151, -20, 2);
      setColor(starColors, index, index % 4 === 0 ? COLOR_WHITE : index % 2 === 0 ? COLOR_VIOLET : COLOR_SKY);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ size: isMobile ? 0.05 : 0.06, transparent: true, opacity: 0.5, sizeAttenuation: true, vertexColors: true }),
    );
    scene.add(stars);

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      size: isMobile ? 0.12 : 0.145,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      vertexColors: true,
    });
    const points = new THREE.Points(pointGeometry, pointsMaterial);
    scene.add(points);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0xb8b5ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending }),
    );
    scene.add(lines);

    const coreGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 18, 128), new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0 }));
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.03, 18, 96), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0 }));
    const coreHalo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    coreHalo.scale.set(1.6, 1.1, 1.6);
    const coreDot = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    coreGroup.add(outerRing, innerRing, coreHalo, coreDot);
    scene.add(coreGroup);

    const outputGroup = new THREE.Group();
    const outputMaterial = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    [
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4.4, -1.8, 0.4), new THREE.Vector3(9, -4.8, 1.2)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4.8, 0.1, 0.6), new THREE.Vector3(10, 0.2, 1.3)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4.4, 1.8, -0.3), new THREE.Vector3(9, 4.8, -1)],
    ].forEach((curvePoints) => {
      const curve = new THREE.CatmullRomCurve3(curvePoints.map((point) => point.clone()));
      outputGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(56)), outputMaterial));
    });
    scene.add(outputGroup);

    const storeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const storeAccent = new THREE.LineBasicMaterial({ color: 0xff8a2b, transparent: true, opacity: 0 });
    const storeGroup = new THREE.Group();
    storeGroup.position.set(-4.5, 0.35, 0.2);
    storeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.8, 6.8, 0.34)), storeMaterial));
    const canopy = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.8, 0.7, 0.42)), storeAccent);
    canopy.position.set(0, 3.9, 0);
    storeGroup.add(canopy);
    scene.add(storeGroup);

    const dashboardMaterial = new THREE.LineBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0 });
    const dashboardGroup = new THREE.Group();
    dashboardGroup.position.set(4.7, -0.1, 0.8);
    dashboardGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.4, 4.6, 0.28)), dashboardMaterial));
    [-1.8, 0, 1.8].forEach((offsetX, index) => {
      const bar = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 1.1 + index * 0.62, 0.18)), dashboardMaterial);
      bar.position.set(offsetX, -0.8 + index * 0.34, 0.14);
      dashboardGroup.add(bar);
    });
    scene.add(dashboardGroup);

    const pulseGroup = new THREE.Group();
    const pulseShell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.04, 16, 120), new THREE.MeshBasicMaterial({ color: 0xff8a2b, transparent: true, opacity: 0 }));
    pulseGroup.add(pulseShell, pulseRing);
    scene.add(pulseGroup);

    const resize = () => {
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;
      frame = window.requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const safeStepIndex = stepRef.current;
      const sceneState = getDiagnosisSceneState(safeStepIndex);
      const targetPositions = layouts[safeStepIndex];

      if (pulseProgressRef.current < 1) {
        pulseProgressRef.current = Math.min(1, pulseProgressRef.current + delta / 0.74);
      }

      payoffProgressRef.current = sceneState.isPayoffShot
        ? THREE.MathUtils.clamp(frozenRef.current ? 1 : payoffProgressRef.current + delta / 1.9, 0, 1)
        : 0;

      for (let index = 0; index < currentPositions.length; index += 1) {
        currentPositions[index] = dampValue(currentPositions[index], targetPositions[index], 6.8, delta);
      }

      updateLinePositions(linePositions, currentPositions, pairs);
      (pointGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      const lineMaterial = lines.material as THREE.LineBasicMaterial;
      lines.visible = !(sceneState.isPayoffShot && payoffProgressRef.current > 0.12);
      lineMaterial.opacity = dampValue(
        lineMaterial.opacity,
        sceneState.isDetectionShot ? 0.18 : sceneState.isMemoryMergeShot ? 0.48 : sceneState.isOutputShot ? 0.2 : sceneState.isPayoffShot ? 0.012 : 0.34,
        4.8,
        delta,
      );
      pointsMaterial.opacity = dampValue(pointsMaterial.opacity, sceneState.isPayoffShot ? 0.24 : sceneState.isDetectionShot ? 0.82 : 0.94, 5.2, delta);

      coreGroup.position.lerp(FOCAL_POINTS[safeStepIndex], 1 - Math.exp(-delta * 4.2));
      const coreScale = sceneState.showMemoryCore ? (sceneState.isMemoryMergeShot ? 1.18 : sceneState.isPayoffShot ? THREE.MathUtils.lerp(0.94, 0.72, payoffProgressRef.current) : 1) : 0.46;
      coreGroup.scale.x = dampValue(coreGroup.scale.x, coreScale, 5.2, delta);
      coreGroup.scale.y = dampValue(coreGroup.scale.y, coreScale, 5.2, delta);
      coreGroup.scale.z = dampValue(coreGroup.scale.z, coreScale, 5.2, delta);
      (outerRing.material as THREE.MeshBasicMaterial).opacity = dampValue((outerRing.material as THREE.MeshBasicMaterial).opacity, sceneState.showMemoryCore ? 0.58 : 0, 5.6, delta);
      (innerRing.material as THREE.MeshBasicMaterial).opacity = dampValue((innerRing.material as THREE.MeshBasicMaterial).opacity, sceneState.showMemoryCore ? 0.72 : 0, 5.6, delta);
      (coreHalo.material as THREE.MeshBasicMaterial).opacity = dampValue((coreHalo.material as THREE.MeshBasicMaterial).opacity, sceneState.showMemoryCore ? 0.22 : 0, 5.2, delta);
      (coreDot.material as THREE.MeshBasicMaterial).opacity = dampValue((coreDot.material as THREE.MeshBasicMaterial).opacity, sceneState.showMemoryCore ? 0.98 : 0, 6.2, delta);

      if (!frozenRef.current) {
        outerRing.rotation.y += delta * 0.18;
        innerRing.rotation.z -= delta * 0.22;
      }

      outputGroup.children.forEach((child) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = dampValue(material.opacity, sceneState.showOutputRays ? (sceneState.isPayoffShot ? Math.max(0, 0.22 - payoffProgressRef.current * 0.26) : 0.42) : 0, 5.2, delta);
      });

      const storeVisible = sceneState.showGeneratedStore && payoffProgressRef.current >= 0.18;
      storeGroup.scale.setScalar(dampValue(storeGroup.scale.x, storeVisible ? 1 : 0.64, 5.2, delta));
      storeGroup.position.y = dampValue(storeGroup.position.y, storeVisible ? 0.35 : -0.8, 5.2, delta);
      storeMaterial.opacity = dampValue(storeMaterial.opacity, storeVisible ? 0.76 : 0, 5.4, delta);
      storeAccent.opacity = dampValue(storeAccent.opacity, storeVisible ? 0.82 : 0, 5.4, delta);

      const dashboardVisible = sceneState.showDashboardPayoff && payoffProgressRef.current >= 0.58;
      dashboardGroup.scale.setScalar(dampValue(dashboardGroup.scale.x, dashboardVisible ? 1 : 0.72, 5.2, delta));
      dashboardGroup.position.y = dampValue(dashboardGroup.position.y, dashboardVisible ? -0.1 : -0.9, 5.2, delta);
      dashboardMaterial.opacity = dampValue(dashboardMaterial.opacity, dashboardVisible ? 0.84 : 0, 5.2, delta);

      const pulseAlpha = 1 - pulseProgressRef.current;
      pulseGroup.position.copy(pulseAnchorRef.current);
      pulseGroup.scale.setScalar(THREE.MathUtils.lerp(0.2, 2.8, 1 - pulseAlpha));
      (pulseShell.material as THREE.MeshBasicMaterial).opacity = pulseAlpha * 0.18;
      (pulseRing.material as THREE.MeshBasicMaterial).opacity = pulseAlpha * 0.68;

      bloomPass.strength = dampValue(bloomPass.strength, (isMobile ? 1.2 : 1.55) + pulseAlpha * (isMobile ? 0.4 : 0.56) + (sceneState.isMemoryMergeShot ? 0.2 : 0), 5, delta);

      const driftX = frozenRef.current ? 0 : Math.sin(elapsed * 0.22) * 0.28;
      const driftY = frozenRef.current ? 0 : Math.cos(elapsed * 0.16) * 0.18;
      const driftZ = frozenRef.current ? 0 : Math.sin(elapsed * 0.12) * 0.22;
      const basePosition = CAMERA_POSITIONS[safeStepIndex];
      camera.position.x = dampValue(camera.position.x, basePosition.x + driftX, 3.8, delta);
      camera.position.y = dampValue(camera.position.y, basePosition.y + driftY, 3.8, delta);
      camera.position.z = dampValue(camera.position.z, basePosition.z + driftZ, 3.8, delta);
      warmLight.position.copy(coreGroup.position).add(new THREE.Vector3(0, 0, 6.2));
      camera.lookAt(CAMERA_TARGETS[safeStepIndex]);

      if (!frozenRef.current) {
        stars.rotation.y += delta * 0.01;
        stars.rotation.x += delta * 0.002;
      }

      composer.render();
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      composer.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) object.geometry.dispose();
        if ('material' in object) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="absolute inset-0" data-diagnosis-render-mode="webgl">
      <div ref={hostRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06),transparent_16%),radial-gradient(circle_at_18%_20%,rgba(96,165,250,0.08),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(196,181,253,0.08),transparent_16%)]" />
    </div>
  );
}
