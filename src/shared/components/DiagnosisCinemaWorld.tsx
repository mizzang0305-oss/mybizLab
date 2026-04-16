import { useDeferredValue, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  DIAGNOSIS_ACTION_LABELS,
  DIAGNOSIS_CHANNEL_LABELS,
  clampDiagnosisCorridorStepIndex,
  getDiagnosisSceneState,
} from '@/shared/lib/diagnosisCorridor';

const CAMERA_POSITIONS = [
  new THREE.Vector3(-0.6, 0.2, 16.4),
  new THREE.Vector3(-0.1, 0.15, 15.3),
  new THREE.Vector3(0.2, 0.1, 14.2),
  new THREE.Vector3(0.8, 0.16, 14.8),
  new THREE.Vector3(0.3, 0.05, 13.2),
] as const;

const CAMERA_TARGETS = [
  new THREE.Vector3(-2.4, 0, 0),
  new THREE.Vector3(1.8, 0, 0),
  new THREE.Vector3(2.8, 0, 0),
  new THREE.Vector3(3.2, 0, 0),
  new THREE.Vector3(1.2, 0.15, 0),
] as const;

const BRANCH_LABEL_POSITIONS = [
  { left: '61%', top: '23%' },
  { left: '71%', top: '48%' },
  { left: '61%', top: '73%' },
] as const;

const ACTION_LABEL_POSITIONS = [
  { left: '77%', top: '22%' },
  { left: '83%', top: '48%' },
  { left: '77%', top: '74%' },
] as const;

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

function createConnectionPairs(nodeCount: number) {
  const pairs: Array<[number, number]> = [];
  const channelCount = 3;
  const channelSize = Math.floor(nodeCount / channelCount);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const start = channel * channelSize;
    const end = channel === channelCount - 1 ? nodeCount : start + channelSize;

    for (let index = start; index < end - 1; index += 1) {
      pairs.push([index, index + 1]);
    }

    for (let index = start; index < end - 4; index += 4) {
      pairs.push([index, index + 4]);
    }
  }

  for (let index = 0; index < channelSize; index += 6) {
    const mid = Math.min(index + channelSize, nodeCount - 1);
    const low = Math.min(index + channelSize * 2, nodeCount - 1);
    pairs.push([index, mid]);
    pairs.push([mid, low]);
  }

  return pairs;
}

function buildStoreCheckLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);

  for (let index = 0; index < nodeCount; index += 1) {
    const progress = index / Math.max(1, nodeCount - 1);
    const x = THREE.MathUtils.lerp(-10.5, -1.5, progress) + seededRange(index + 10, -0.1, 0.1);
    const y = Math.sin(progress * Math.PI * 1.2) * 0.34 + seededRange(index + 20, -0.18, 0.18);
    const z = Math.cos(progress * Math.PI * 0.9) * 0.7 + seededRange(index + 30, -0.24, 0.24);
    setPosition(positions, index, x, y, z);
  }

  return positions;
}

function buildSignalCaptureLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const branches = 3;
  const branchSize = Math.floor(nodeCount / branches);
  const targetY = [-3.3, 0, 3.3];

  for (let branch = 0; branch < branches; branch += 1) {
    const start = branch * branchSize;
    const end = branch === branches - 1 ? nodeCount : start + branchSize;

    for (let index = start; index < end; index += 1) {
      const localIndex = index - start;
      const progress = localIndex / Math.max(1, end - start - 1);
      const bend = Math.sin(progress * Math.PI) * 0.9;
      const x = THREE.MathUtils.lerp(-1.2, 4.6, progress) + seededRange(index + 40, -0.12, 0.12);
      const y = THREE.MathUtils.lerp(0, targetY[branch], progress) + bend * (branch === 1 ? 0.1 : branch === 0 ? -0.2 : 0.2);
      const z = seededRange(index + 50, -1.1, 1.1) * (0.25 + progress * 0.55);
      setPosition(positions, index, x, y, z);
    }
  }

  return positions;
}

function buildMemoryMergeLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);

  for (let index = 0; index < nodeCount; index += 1) {
    const progress = index / Math.max(1, nodeCount - 1);
    const theta = progress * Math.PI * 7.5;
    const radius = 1.6 + (index % 18) * 0.085;
    const x = 2.8 + Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius * 0.72;
    const z = Math.sin(theta * 1.35) * 1.7 + seededRange(index + 60, -0.18, 0.18);
    setPosition(positions, index, x, y, z);
  }

  return positions;
}

function buildActionExtractionLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const rayTargets = [
    new THREE.Vector3(8.4, -3.4, 0.2),
    new THREE.Vector3(9.2, 0.1, 0.8),
    new THREE.Vector3(8.2, 3.7, -0.2),
  ];

  for (let index = 0; index < nodeCount; index += 1) {
    const rayIndex = index % rayTargets.length;
    const rayProgress = Math.floor(index / rayTargets.length) / Math.max(1, Math.floor(nodeCount / rayTargets.length) - 1);
    const sourceRadius = 1.2 + (index % 10) * 0.05;
    const sourceTheta = (index / nodeCount) * Math.PI * 5;
    const source = new THREE.Vector3(
      2.7 + Math.cos(sourceTheta) * sourceRadius,
      Math.sin(sourceTheta) * sourceRadius * 0.8,
      Math.cos(sourceTheta * 1.2) * 0.9,
    );
    const target = rayTargets[rayIndex];
    const x = THREE.MathUtils.lerp(source.x, target.x, rayProgress) + seededRange(index + 70, -0.1, 0.1);
    const y = THREE.MathUtils.lerp(source.y, target.y, rayProgress) + seededRange(index + 80, -0.12, 0.12);
    const z = THREE.MathUtils.lerp(source.z, target.z, rayProgress) + seededRange(index + 90, -0.14, 0.14);
    setPosition(positions, index, x, y, z);
  }

  return positions;
}

function finalFramePoint(progress: number, width: number, height: number) {
  const perimeter = width * 2 + height * 2;
  const distance = progress * perimeter;

  if (distance <= width) {
    return new THREE.Vector3(-width / 2 + distance, height / 2, 0);
  }
  if (distance <= width + height) {
    return new THREE.Vector3(width / 2, height / 2 - (distance - width), 0);
  }
  if (distance <= width * 2 + height) {
    return new THREE.Vector3(width / 2 - (distance - width - height), -height / 2, 0);
  }

  return new THREE.Vector3(-width / 2, -height / 2 + (distance - width * 2 - height), 0);
}

function buildPayoffLayout(nodeCount: number) {
  const positions = new Float32Array(nodeCount * 3);
  const storeCount = Math.floor(nodeCount * 0.34);
  const dashboardCount = Math.floor(nodeCount * 0.38);

  for (let index = 0; index < nodeCount; index += 1) {
    if (index < storeCount) {
      const point = finalFramePoint(index / Math.max(1, storeCount - 1), 4.2, 6.1);
      setPosition(positions, index, point.x - 2.6, point.y + 0.25, seededRange(index + 100, -0.3, 0.3));
      continue;
    }

    if (index < storeCount + dashboardCount) {
      const localIndex = index - storeCount;
      const point = finalFramePoint(localIndex / Math.max(1, dashboardCount - 1), 6.4, 4.1);
      setPosition(positions, index, point.x + 3.2, point.y - 0.15, seededRange(index + 110, -0.22, 0.22));
      continue;
    }

    const localIndex = index - storeCount - dashboardCount;
    const progress = localIndex / Math.max(1, nodeCount - storeCount - dashboardCount - 1);
    const theta = progress * Math.PI * 8;
    const radius = 0.8 + (localIndex % 12) * 0.08;
    setPosition(
      positions,
      index,
      0.4 + Math.cos(theta) * radius,
      Math.sin(theta) * radius * 0.8,
      Math.cos(theta * 1.3) * 0.8,
    );
  }

  return positions;
}

function buildLayouts(nodeCount: number) {
  return [
    buildStoreCheckLayout(nodeCount),
    buildSignalCaptureLayout(nodeCount),
    buildMemoryMergeLayout(nodeCount),
    buildActionExtractionLayout(nodeCount),
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

export function DiagnosisCinemaWorld({ stepIndex }: { stepIndex: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef(clampDiagnosisCorridorStepIndex(stepIndex));
  const deferredStepIndex = useDeferredValue(stepIndex);

  useEffect(() => {
    stepRef.current = clampDiagnosisCorridorStepIndex(deferredStepIndex);
  }, [deferredStepIndex]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const isMobile = window.innerWidth < 768;
    const nodeCount = isMobile ? 72 : 114;
    const layouts = buildLayouts(nodeCount);
    const connectionPairs = createConnectionPairs(nodeCount);
    const currentPositions = layouts[0].slice();
    const linePositions = new Float32Array(connectionPairs.length * 6);
    updateLinePositions(linePositions, currentPositions, connectionPairs);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x02050a, 10, 24);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.copy(CAMERA_POSITIONS[0]);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.6));
    renderer.setClearColor(0x02050a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        isMobile ? 0.85 : 1.15,
        isMobile ? 0.45 : 0.7,
        isMobile ? 0.92 : 0.78,
      ),
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;
    controls.minPolarAngle = Math.PI * 0.34;
    controls.maxPolarAngle = Math.PI * 0.66;
    controls.target.copy(CAMERA_TARGETS[0]);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    const keyLight = new THREE.PointLight(0xff8b3d, 1.35, 24);
    keyLight.position.set(1.5, 2.4, 4.4);
    const fillLight = new THREE.PointLight(0x76a4ff, 1.1, 24);
    fillLight.position.set(6.8, 1.2, 5.6);
    scene.add(ambientLight, keyLight, fillLight);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array((isMobile ? 220 : 360) * 3);
    for (let index = 0; index < starPositions.length / 3; index += 1) {
      starPositions[index * 3] = seededRange(index + 120, -18, 18);
      starPositions[index * 3 + 1] = seededRange(index + 140, -10, 10);
      starPositions[index * 3 + 2] = seededRange(index + 160, -15, 5);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0x9fbfff,
        size: isMobile ? 0.035 : 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.38,
      }),
    );
    scene.add(stars);

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xfff0dc,
      size: isMobile ? 0.12 : 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pointGeometry, pointsMaterial);
    scene.add(points);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffb56a,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(lines);

    const coreGroup = new THREE.Group();
    const coreOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.035, 18, 120),
      new THREE.MeshBasicMaterial({
        color: 0xff9e52,
        transparent: true,
        opacity: 0,
      }),
    );
    const coreInner = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      }),
    );
    const coreHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff7b2c,
        transparent: true,
        opacity: 0,
      }),
    );
    coreHalo.scale.set(1.4, 0.92, 1.4);
    coreGroup.position.set(2.8, 0, 0);
    coreGroup.add(coreOuter, coreHalo, coreInner);
    scene.add(coreGroup);

    const actionGroup = new THREE.Group();
    const actionMaterial = new THREE.LineBasicMaterial({
      color: 0x7fd0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    [
      [new THREE.Vector3(2.9, 0, 0), new THREE.Vector3(5.2, -2.2, 0.2), new THREE.Vector3(8.2, -3.2, 0.4)],
      [new THREE.Vector3(2.9, 0, 0), new THREE.Vector3(5.8, 0.1, 0.4), new THREE.Vector3(9.0, 0.1, 0.8)],
      [new THREE.Vector3(2.9, 0, 0), new THREE.Vector3(5.1, 2.3, -0.1), new THREE.Vector3(8.1, 3.4, -0.2)],
    ].forEach((curvePoints) => {
      const curve = new THREE.CatmullRomCurve3(curvePoints.map((point) => point.clone()));
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      actionGroup.add(new THREE.Line(geometry, actionMaterial));
    });
    scene.add(actionGroup);

    const storeGroup = new THREE.Group();
    const storeMaterial = new THREE.LineBasicMaterial({
      color: 0xffa45d,
      transparent: true,
      opacity: 0,
    });
    const storeFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.8, 5.2, 0.36)),
      storeMaterial,
    );
    storeGroup.position.set(-2.6, 0.2, 0.1);
    storeGroup.add(storeFrame);
    const storeBeacon = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    );
    storeBeacon.position.set(0, 1.8, 0.2);
    storeGroup.add(storeBeacon);
    scene.add(storeGroup);

    const dashboardGroup = new THREE.Group();
    const dashboardMaterial = new THREE.LineBasicMaterial({
      color: 0x9ac3ff,
      transparent: true,
      opacity: 0,
    });
    const dashboardFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.8, 3.5, 0.3)),
      dashboardMaterial,
    );
    dashboardGroup.position.set(3.3, 0.15, 0.85);
    dashboardGroup.add(dashboardFrame);
    [-1.4, 0, 1.4].forEach((offsetX, index) => {
      const bar = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.78, 0.9 + index * 0.55, 0.16)),
        dashboardMaterial,
      );
      bar.position.set(offsetX, -0.7 + index * 0.3, 0.16);
      dashboardGroup.add(bar);
    });
    scene.add(dashboardGroup);

    const resize = () => {
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) {
        return;
      }

      frame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const safeStepIndex = stepRef.current;
      const sceneState = getDiagnosisSceneState(safeStepIndex);
      const targetPositions = layouts[safeStepIndex];

      for (let index = 0; index < currentPositions.length; index += 1) {
        currentPositions[index] = dampValue(currentPositions[index], targetPositions[index], 7.6, delta);
      }

      updateLinePositions(linePositions, currentPositions, connectionPairs);
      (pointGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      const linesMaterial = lines.material as THREE.LineBasicMaterial;
      linesMaterial.opacity = dampValue(
        linesMaterial.opacity,
        sceneState.showGeneratedStore ? 0.18 : sceneState.showActionOutputs ? 0.42 : sceneState.showMemoryCore ? 0.5 : 0.36,
        5.2,
        delta,
      );
      pointsMaterial.opacity = dampValue(pointsMaterial.opacity, sceneState.showGeneratedStore ? 0.48 : 0.9, 5.2, delta);

      coreGroup.position.lerp(CAMERA_TARGETS[Math.min(safeStepIndex, 2)], 1 - Math.exp(-delta * 4.2));
      coreGroup.scale.x = dampValue(coreGroup.scale.x, sceneState.showMemoryCore ? (safeStepIndex === 2 ? 1.2 : 1) : 0.55, 5.5, delta);
      coreGroup.scale.y = dampValue(coreGroup.scale.y, sceneState.showMemoryCore ? (safeStepIndex === 2 ? 1.2 : 1) : 0.55, 5.5, delta);
      coreGroup.scale.z = dampValue(coreGroup.scale.z, sceneState.showMemoryCore ? (safeStepIndex === 2 ? 1.2 : 1) : 0.55, 5.5, delta);
      (coreOuter.material as THREE.MeshBasicMaterial).opacity = dampValue(
        (coreOuter.material as THREE.MeshBasicMaterial).opacity,
        sceneState.showMemoryCore ? 0.82 : 0,
        5.6,
        delta,
      );
      (coreInner.material as THREE.MeshBasicMaterial).opacity = dampValue(
        (coreInner.material as THREE.MeshBasicMaterial).opacity,
        sceneState.showMemoryCore ? 0.98 : 0,
        6.2,
        delta,
      );
      (coreHalo.material as THREE.MeshBasicMaterial).opacity = dampValue(
        (coreHalo.material as THREE.MeshBasicMaterial).opacity,
        sceneState.showMemoryCore ? 0.18 : 0,
        5.2,
        delta,
      );
      coreOuter.rotation.y += delta * 0.42;
      coreOuter.rotation.x += delta * 0.12;
      coreHalo.rotation.z -= delta * 0.2;

      actionGroup.children.forEach((child: THREE.Object3D) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = dampValue(material.opacity, sceneState.showActionOutputs ? 0.78 : 0, 5.5, delta);
      });
      actionGroup.scale.x = dampValue(actionGroup.scale.x, sceneState.showActionOutputs ? 1 : 0.75, 5.5, delta);
      actionGroup.scale.y = dampValue(actionGroup.scale.y, sceneState.showActionOutputs ? 1 : 0.75, 5.5, delta);
      actionGroup.scale.z = dampValue(actionGroup.scale.z, sceneState.showActionOutputs ? 1 : 0.75, 5.5, delta);

      storeGroup.scale.x = dampValue(storeGroup.scale.x, sceneState.showGeneratedStore ? 1 : 0.72, 5.2, delta);
      storeGroup.scale.y = dampValue(storeGroup.scale.y, sceneState.showGeneratedStore ? 1 : 0.72, 5.2, delta);
      storeGroup.scale.z = dampValue(storeGroup.scale.z, sceneState.showGeneratedStore ? 1 : 0.72, 5.2, delta);
      storeGroup.position.y = dampValue(storeGroup.position.y, sceneState.showGeneratedStore ? 0.2 : -0.4, 5.6, delta);
      storeMaterial.opacity = dampValue(storeMaterial.opacity, sceneState.showGeneratedStore ? 0.76 : 0, 5.6, delta);
      (storeBeacon.material as THREE.MeshBasicMaterial).opacity = dampValue(
        (storeBeacon.material as THREE.MeshBasicMaterial).opacity,
        sceneState.showGeneratedStore ? 0.16 : 0,
        5.6,
        delta,
      );

      dashboardGroup.scale.x = dampValue(dashboardGroup.scale.x, sceneState.showDashboardPayoff ? 1 : 0.74, 5.4, delta);
      dashboardGroup.scale.y = dampValue(dashboardGroup.scale.y, sceneState.showDashboardPayoff ? 1 : 0.74, 5.4, delta);
      dashboardGroup.scale.z = dampValue(dashboardGroup.scale.z, sceneState.showDashboardPayoff ? 1 : 0.74, 5.4, delta);
      dashboardGroup.position.y = dampValue(dashboardGroup.position.y, sceneState.showDashboardPayoff ? 0.15 : -0.5, 5.4, delta);
      dashboardMaterial.opacity = dampValue(dashboardMaterial.opacity, sceneState.showDashboardPayoff ? 0.86 : 0, 5.6, delta);

      camera.position.lerp(CAMERA_POSITIONS[safeStepIndex], 1 - Math.exp(-delta * 3.8));
      controls.target.lerp(CAMERA_TARGETS[safeStepIndex], 1 - Math.exp(-delta * 3.8));
      controls.update();

      stars.rotation.y += delta * 0.01;
      stars.rotation.x += delta * 0.003;

      composer.render();
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      scene.traverse((object: THREE.Object3D) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
          object.geometry.dispose();
        }

        if ('material' in object) {
          const materials = Array.isArray(object.material)
            ? (object.material as THREE.Material[])
            : [object.material as THREE.Material];
          materials.forEach((material: THREE.Material) => {
            material.dispose();
          });
        }
      });

      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const sceneState = getDiagnosisSceneState(stepIndex);

  return (
    <div className="absolute inset-0" data-diagnosis-render-mode="webgl">
      <div ref={hostRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[22%] top-[16%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-xl">
          public store signal
        </div>

        {DIAGNOSIS_CHANNEL_LABELS.map((label, index) => (
          <div
            key={label}
            className={`absolute rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-100 backdrop-blur-xl transition duration-500 ${
              sceneState.showSignalBranches ? 'opacity-100' : 'opacity-0'
            }`}
            style={BRANCH_LABEL_POSITIONS[index]}
          >
            {label}
          </div>
        ))}

        <div
          className={`absolute left-[68%] top-[30%] rounded-full border border-orange-300/18 bg-orange-300/[0.08] px-3 py-1.5 text-[11px] font-semibold text-orange-50 backdrop-blur-xl transition duration-500 ${
            sceneState.showMemoryCore ? 'opacity-100' : 'opacity-0'
          }`}
        >
          customer memory core
        </div>

        {DIAGNOSIS_ACTION_LABELS.map((label, index) => (
          <div
            key={label}
            className={`absolute rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-100 backdrop-blur-xl transition duration-500 ${
              sceneState.showActionOutputs ? 'opacity-100' : 'opacity-0'
            }`}
            style={ACTION_LABEL_POSITIONS[index]}
          >
            {label}
          </div>
        ))}

        <div
          className={`absolute left-[28%] top-[20%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-xl transition duration-700 ${
            sceneState.showGeneratedStore ? 'opacity-100' : 'opacity-0'
          }`}
        >
          generated store
        </div>
        <div
          className={`absolute left-[67%] top-[18%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-xl transition duration-700 ${
            sceneState.showDashboardPayoff ? 'opacity-100' : 'opacity-0'
          }`}
        >
          operator dashboard
        </div>
      </div>
    </div>
  );
}
