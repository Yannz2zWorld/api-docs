// Yannz API — monochrome WebGL hero scenes (login: "core", dashboard: "stack").
// Mounted on elements with [data-scene3d]. If WebGL or the CDN module is unavailable the
// page keeps its CSS fallback. Rendering pauses when the scene is off-screen or the tab is
// hidden, and prefers-reduced-motion renders a single still frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const BG = 0x0c0e1c;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Soft round sprite used for particles and glows (additive, so it never darkens the page).
function glowTexture(size = 128, hardness = 0.15) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hardness, 'rgba(255,255,255,.85)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glow(texture, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: 0xffffff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale);
  return s;
}

function edges(geometry, color, opacity) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function particles(count, spread, texture) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = spread * (0.35 + Math.random() * 0.65);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, map: texture, color: 0xb9c3ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
}

function floor(y) {
  const grid = new THREE.GridHelper(48, 48, 0x4a5290, 0x1d2245);
  grid.position.y = y;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  return grid;
}

// ---------------------------------------------------------------- Roxy (Blender scale figure)
// views/assets/roxy.glb is a detailed Roxy Migurdia figure on a display base, built in Blender
// (tools/roxy). Ambient occlusion and paint gradients are baked into vertex colours; here the
// materials become physically based "PVC figure" materials (clearcoat gloss, cloth sheen).
// Nodes "Head", "Hat" and "Staff" are animated in place.
let roxyPromise;
function loadRoxy() {
  if (!roxyPromise) {
    const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
    roxyPromise = new GLTFLoader().setDRACOLoader(draco).loadAsync('/assets/roxy.glb').then(g => g.scene);
  }
  return roxyPromise;
}

// Anime look: cel shading (colour kept, light quantised) + inverted-hull outline.
// Face decal is unlit like TV anime; skin gets a soft 2-step ramp so the face stays smooth;
// alpha-card hair keeps its cut-out and skips the outline. The display disc stays glossy PBR.
function celGradient(steps) {
  const data = new Uint8Array(steps.flatMap(v => [v, v, v, 255]));
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
function animeMaterials(model) {
  const gradientMap = celGradient([118, 196, 255]);
  const skinMap = celGradient([222, 255]);
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const outlineWorld = Math.max(size.x, size.y, size.z) * 0.0012;
  const outlines = new Map();
  const outlineFor = width => {
    const key = width.toPrecision(3);
    if (!outlines.has(key)) {
      const m = new THREE.MeshBasicMaterial({ color: 0x1a1830, side: THREE.BackSide });
      m.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${Number(key).toExponential(4)};`);
      };
      m.customProgramCacheKey = () => 'outline' + key;
      outlines.set(key, m);
    }
    return outlines.get(key);
  };
  const scale = new THREE.Vector3();
  const meshes = [];
  model.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const src = mesh.material;
    const name = src.name || '';
    if (/Base/.test(name)) {
      mesh.material = new THREE.MeshPhysicalMaterial({ color: src.color, metalness: src.metalness, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 });
      continue;
    }
    const cutout = src.transparent || src.alphaTest > 0;
    let m;
    if (name === 'Face') {
      m = new THREE.MeshBasicMaterial({ map: src.map || null, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      // Anime trick: eyes/brows read through the bangs. Each vertex slides toward the camera along
      // its view ray (screen position unchanged), so the decal wins against hair a few cm in front
      // but stays hidden behind the hand or the hat brim.
      m.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  float facePull = 0.028 * length(modelMatrix[0].xyz);
  mvPosition.xyz *= max(0.0, 1.0 - facePull / length(mvPosition.xyz));
  gl_Position = projectionMatrix * mvPosition;`);
      };
      m.customProgramCacheKey = () => 'anime-face';
    } else {
      m = new THREE.MeshToonMaterial({
        color: src.color.clone(), map: src.map || null, side: src.side,
        gradientMap: /^Skin/.test(name) ? skinMap : gradientMap,
        vertexColors: Boolean(mesh.geometry.attributes.color) && !src.map,
      });
      if (cutout) { m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
      if (name === 'Gold') m.emissive = new THREE.Color(0x3a2a08);
    }
    m.name = name;
    mesh.material = m;
    if (name !== 'Face' && !cutout && !/Button|Rivet|Clasp/.test(mesh.name)) {
      const hull = new THREE.Mesh(mesh.geometry, outlineFor(outlineWorld / (mesh.getWorldScale(scale).x || 1)));
      hull.name = mesh.name + '_outline';
      mesh.add(hull);
    }
  }
  return model;
}

function addRoxy(group, tex, { height = 3, feetY = -1.5, x = 0, z = 0, yaw = 0 } = {}) {
  const holder = new THREE.Group();
  holder.position.set(x, feetY, z);
  holder.rotation.y = yaw;
  group.add(holder);
  const aura = glow(tex, height * 0.95, 0.08);
  aura.material.color = new THREE.Color(0x8fa2ff);
  aura.position.y = height * 0.5;
  holder.add(aura);
  const spot = new THREE.SpotLight(0xdfe4ff, 7, height * 3, 0.5, 0.6, 1.5);
  spot.position.set(height * 0.4, height * 1.4, height * 0.9);
  spot.target.position.set(0, height * 0.45, 0);
  holder.add(spot, spot.target);
  const rimLight = new THREE.DirectionalLight(0x9fb0ff, 2.2);
  rimLight.position.set(-height, height * 1.2, -height * 1.5);
  holder.add(rimLight);
  let model = null, head = null, hat = null, staff = null, born = 0;
  const glows = [];
  loadRoxy().then(scene => {
    model = animeMaterials(scene.clone(true));
    const box = new THREE.Box3().setFromObject(model);
    const s = height / (box.max.y - box.min.y);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    holder.add(model);
    head = model.getObjectByName('Head');
    hat = model.getObjectByName('Hat');
    staff = model.getObjectByName('Staff');
    model.traverse(o => { if (o.userData.glow) glows.push(o.material); });
    born = performance.now();
  }).catch(err => console.warn('Roxy model unavailable:', err && err.message));
  return {
    holder,
    update(t, dt, pointer) {
      aura.material.opacity = 0.06 + Math.sin(t * 1.1) * 0.02;
      if (!model) return;
      const intro = Math.min(1, (performance.now() - born) / 900);
      holder.scale.setScalar(0.85 + 0.15 * (1 - Math.pow(1 - intro, 3)));
      // display turntable: slow swing, nudged by the pointer
      model.rotation.y = -0.22 - yaw + Math.sin(t * 0.32) * 0.22 + (pointer ? pointer.x * 0.15 : 0);   // kept on the side where the saluting hand never hides the face
      if (head) { head.rotation.y = (pointer ? pointer.x * 0.25 : 0); head.rotation.x = (pointer ? pointer.y * 0.1 : 0) + Math.sin(t * 0.9) * 0.015; head.rotation.z = Math.sin(t * 0.7) * 0.02; }
      if (hat) hat.rotation.z = Math.sin(t * 1.3) * 0.015;
      if (staff) staff.rotation.z = Math.sin(t * 0.8) * 0.01;
      for (const m of glows) m.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.5;
    }
  };
}

// ---------------------------------------------------------------- login: chrome core
function buildCore(root, tex) {
  const group = new THREE.Group();
  root.add(group);

  const roxy = addRoxy(group, tex, { height: 4.1, feetY: -2.4 });
  const heart = glow(tex, 3.4, 0.12);
  group.add(heart);

  const shellGeo = new THREE.IcosahedronGeometry(2.6, 1);
  const shell = edges(shellGeo, 0xffffff, 0.06);
  const verts = new THREE.Points(shellGeo, new THREE.PointsMaterial({ size: 0.09, map: tex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  shell.add(verts);
  group.add(shell);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0x8fa0ff, metalness: 0.9, roughness: 0.3 });
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.4 });
  const linkMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 });
  const rings = [
    { r: 2.55, tilt: [1.2, 0.2, 0.15], speed: 0.16 },
    { r: 3.05, tilt: [1.45, -0.55, 0.4], speed: -0.11 },
    { r: 3.6, tilt: [0.95, 0.75, -0.3], speed: 0.07 }
  ].map((cfg, i) => {
    const holder = new THREE.Group();
    holder.rotation.set(...cfg.tilt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, 0.014, 12, 220), ringMat);
    holder.add(ring);
    const nodes = [0, Math.PI * (0.9 + i * 0.2)].map(offset => {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), nodeMat);
      n.add(glow(tex, 0.9, 0.55));
      holder.add(n);
      return { mesh: n, offset };
    });
    group.add(holder);
    return { ...cfg, holder, nodes };
  });

  const linkGeo = new THREE.BufferGeometry();
  const linkPos = new Float32Array(rings.length * 2 * 2 * 3);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
  group.add(new THREE.LineSegments(linkGeo, linkMat));

  const pulse = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 8, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  pulse.rotation.x = Math.PI / 2;
  group.add(pulse);

  const tmp = new THREE.Vector3();
  return {
    group,
    update(t, dt, pointer) {
      roxy.update(t, dt, pointer);
      shell.rotation.y -= dt * 0.09;
      shell.rotation.z += dt * 0.035;
      heart.material.opacity = 0.1 + Math.sin(t * 1.4) * 0.04;
      let k = 0;
      for (const ring of rings) {
        for (const node of ring.nodes) {
          const a = t * ring.speed * 2.2 + node.offset;
          node.mesh.position.set(Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0);
          node.mesh.getWorldPosition(tmp);
          group.worldToLocal(tmp);
          linkPos.set([0, 0, 0, tmp.x, tmp.y, tmp.z], k);
          k += 6;
        }
      }
      linkGeo.attributes.position.needsUpdate = true;
      const p = (t % 3.2) / 3.2;
      pulse.scale.setScalar(1.1 + p * 3.2);
      pulse.material.opacity = 0.32 * (1 - p) * (1 - p);
    }
  };
}

// ---------------------------------------------------------------- dashboard: API stack
function buildStack(root, tex) {
  const roxy = addRoxy(root, tex, { height: 3.1, feetY: -2.25, x: -1.75, z: 0.6, yaw: 0.35 });
  const group = new THREE.Group();
  group.rotation.set(0.5, -0.62, 0);
  group.position.set(1.15, 0.15, -0.4);
  group.scale.setScalar(0.72);
  root.add(group);
  const W = 3.3, H = 0.38, D = 2.25;
  const slabGeo = new RoundedBoxGeometry(W, H, D, 4, 0.1);
  const boxEdges = new THREE.BoxGeometry(W, H, D);
  const layers = [
    { color: 0x141831, line: 0xb9c3ff },
    { color: 0x1b2040, line: 0xb9c3ff },
    { color: 0xe6eaff, line: 0x0c0e1c }
  ].map((cfg, i) => {
    const slab = new THREE.Mesh(slabGeo, new THREE.MeshPhysicalMaterial({ color: cfg.color, metalness: i === 2 ? 0.1 : 0.45, roughness: i === 2 ? 0.35 : 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }));
    slab.add(edges(boxEdges, cfg.line, i === 2 ? 0.9 : 0.6));
    // Port "chips" on each layer: a hint of the gateway's modules.
    const chipMat = new THREE.MeshStandardMaterial({ color: i === 2 ? 0x151935 : 0xc4cdff, emissive: i === 2 ? 0x000000 : 0xffffff, emissiveIntensity: i === 2 ? 0 : 0.35, roughness: 0.4 });
    for (let c = 0; c < 4; c++) {
      const chip = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.06, 0.26, 2, 0.02), chipMat);
      chip.position.set(-1.05 + c * 0.7, H / 2 + 0.03, D / 2 - 0.35);
      slab.add(chip);
    }
    group.add(slab);
    return slab;
  });

  const beamGeo = new THREE.BufferGeometry();
  const beamPos = [];
  for (const [x, z] of [[-W / 2 + 0.2, -D / 2 + 0.2], [W / 2 - 0.2, -D / 2 + 0.2], [-W / 2 + 0.2, D / 2 - 0.2], [W / 2 - 0.2, D / 2 - 0.2]]) beamPos.push(x, -1.4, z, x, 1.4, z);
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(beamPos, 3));
  group.add(new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })));

  const packetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 });
  const packets = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), packetMat);
    m.add(glow(tex, 0.75, 0.5));
    m.position.set(-1.2 + (i % 4) * 0.8, 0, -0.55 + Math.floor(i / 4) * 0.9);
    group.add(m);
    return { mesh: m, phase: i / 7 };
  });
  const halo = glow(tex, 6.5, 0.07);
  halo.position.y = 0.2;
  group.add(halo);

  return {
    group,
    update(t, dt, pointer) {
      roxy.update(t, dt, pointer);
      const gap = 0.92 + Math.sin(t * 0.7) * 0.05;
      layers.forEach((slab, i) => { slab.position.y = (i - 1) * gap; });
      group.rotation.y = -0.62 + Math.sin(t * 0.18) * 0.32;
      for (const p of packets) {
        const s = (t * 0.22 + p.phase) % 1;
        p.mesh.position.y = -1.35 + s * 2.7;
        p.mesh.rotation.y = t * 1.2 + p.phase * 6;
        p.mesh.scale.setScalar(Math.sin(s * Math.PI) * 1.1 + 0.05);
      }
    }
  };
}

function mount(el) {
  const variant = el.dataset.scene3d;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 10, 24);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(-5, 2, -6);
  const follow = new THREE.PointLight(0xffffff, 18, 14, 2);
  scene.add(key, rim, follow, new THREE.HemisphereLight(0xffffff, 0x0c0e1c, 0.35));

  const tex = glowTexture();
  const root = new THREE.Group();
  scene.add(root);
  const world = variant === 'stack' ? buildStack(root, tex) : buildCore(root, tex);
  const dust = particles(COARSE ? 260 : 620, variant === 'stack' ? 9 : 11, glowTexture(64, 0.3));
  scene.add(dust);
  const ground = floor(variant === 'stack' ? -2.4 : -3.4);
  if (variant === 'core') ground.material.opacity = 0.3;
  scene.add(ground);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let distance = 11;
  const LOOK = new THREE.Vector3(0, variant === 'stack' ? 0 : 0.3, 0);
  // World point on the z=0 plane under a given screen position (0..1, 0..1).
  function screenToWorld(sx, sy) {
    const v = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
    return camera.position.clone().add(v.multiplyScalar(-camera.position.z / v.z));
  }
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the object fully framed on narrow/portrait containers.
    distance = (variant === 'stack' ? 9.2 : 10.5) * Math.max(1, 1.15 / Math.min(camera.aspect, 1.15));
    camera.updateProjectionMatrix();
    // Login: anchor the core to the upper-right of the visual so the headline below stays clear.
    if (variant === 'core') {
      camera.position.set(0, 1.2, distance);
      camera.lookAt(LOOK);
      camera.updateMatrixWorld();
      const [sx, sy, scale] = w < 560 ? [0.7, 0.25, 0.88] : camera.aspect > 1.25 ? [0.62, 0.34, 0.9] : [0.6, 0.29, 0.8];
      root.position.copy(screenToWorld(sx, sy));
      root.scale.setScalar(scale);
    }
  }
  // setSize clears the canvas: repaint at once when the loop is idle (reduced motion,
  // off-screen) so the scene never stays blank after a resize or rotation.
  new ResizeObserver(() => { resize(); if (!raf && !lost) frame(); }).observe(el);
  resize();

  const clock = new THREE.Clock();
  let t = 0, visible = true, raf = 0, lost = false;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    camera.position.set(pointer.x * 1.3, 1.2 - pointer.y * 0.7, distance);
    camera.lookAt(LOOK);
    follow.position.set(pointer.x * 5, -pointer.y * 3 + 2, 4);
    world.update(t, dt, pointer);
    dust.rotation.y += dt * 0.012;
    renderer.render(scene, camera);
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden || lost) return;
    frame();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !REDUCED && !lost) { clock.getDelta(); raf = requestAnimationFrame(loop); } }

  // GPU reset / too many contexts: fall back to the CSS backdrop until the browser restores it.
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    el.classList.remove('is-ready');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false;
    resize();
    frame();
    el.classList.add('is-ready');
    start();
  });

  new IntersectionObserver(entries => {
    visible = entries.some(e => e.isIntersecting);
    if (visible) start();
  }, { rootMargin: '80px' }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  t = 2.4;
  frame();
  el.classList.add('is-ready');
  document.documentElement.classList.add('webgl-' + variant);
  start();
}

if (hasWebGL()) document.querySelectorAll('[data-scene3d]').forEach(el => { try { mount(el); } catch (e) { console.warn('3D scene unavailable:', e && e.message); } });
export { loadRoxy, animeMaterials };
