// Yannz API — monochrome WebGL hero scenes (login: "core", dashboard: "stack").
// Mounted on elements with [data-scene3d]. If WebGL or the CDN module is unavailable the
// page keeps its CSS fallback. Rendering pauses when the scene is off-screen or the tab is
// hidden, and prefers-reduced-motion renders a single still frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const BG = 0x0b0b0c;

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
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, map: texture, color: 0xd4d4d8, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
}

function floor(y) {
  const grid = new THREE.GridHelper(48, 48, 0x52525b, 0x26262b);
  grid.position.y = y;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  return grid;
}

// ---------------------------------------------------------------- login: chrome core
function buildCore(root, tex) {
  const group = new THREE.Group();
  root.add(group);

  const gemGeo = new THREE.IcosahedronGeometry(1.05, 0);
  const gem = new THREE.Mesh(gemGeo, new THREE.MeshPhysicalMaterial({ color: 0xe4e4e7, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true, envMapIntensity: 1.25 }));
  gem.add(edges(gemGeo, 0x0b0b0c, 0.55));
  group.add(gem);
  const heart = glow(tex, 3.4, 0.22);
  group.add(heart);

  const shellGeo = new THREE.IcosahedronGeometry(1.85, 1);
  const shell = edges(shellGeo, 0xffffff, 0.2);
  const verts = new THREE.Points(shellGeo, new THREE.PointsMaterial({ size: 0.09, map: tex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  shell.add(verts);
  group.add(shell);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.9, roughness: 0.3 });
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
    update(t, dt) {
      gem.rotation.y += dt * 0.32;
      gem.rotation.x = Math.sin(t * 0.35) * 0.22;
      shell.rotation.y -= dt * 0.09;
      shell.rotation.z += dt * 0.035;
      heart.material.opacity = 0.18 + Math.sin(t * 1.4) * 0.05;
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
  const group = new THREE.Group();
  group.rotation.set(0.5, -0.62, 0);
  root.add(group);
  const W = 3.3, H = 0.38, D = 2.25;
  const slabGeo = new RoundedBoxGeometry(W, H, D, 4, 0.1);
  const boxEdges = new THREE.BoxGeometry(W, H, D);
  const layers = [
    { color: 0x141416, line: 0xd4d4d8 },
    { color: 0x1d1d21, line: 0xd4d4d8 },
    { color: 0xf4f4f5, line: 0x0b0b0c }
  ].map((cfg, i) => {
    const slab = new THREE.Mesh(slabGeo, new THREE.MeshPhysicalMaterial({ color: cfg.color, metalness: i === 2 ? 0.1 : 0.45, roughness: i === 2 ? 0.35 : 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }));
    slab.add(edges(boxEdges, cfg.line, i === 2 ? 0.9 : 0.6));
    // Port "chips" on each layer: a hint of the gateway's modules.
    const chipMat = new THREE.MeshStandardMaterial({ color: i === 2 ? 0x18181b : 0xe4e4e7, emissive: i === 2 ? 0x000000 : 0xffffff, emissiveIntensity: i === 2 ? 0 : 0.35, roughness: 0.4 });
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
    update(t) {
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
  scene.add(key, rim, follow, new THREE.HemisphereLight(0xffffff, 0x0b0b0c, 0.35));

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
      const [sx, sy, scale] = w < 560 ? [0.66, 0.25, 0.6] : camera.aspect > 1.25 ? [0.66, 0.4, 0.95] : [0.6, 0.29, 0.8];
      root.position.copy(screenToWorld(sx, sy));
      root.scale.setScalar(scale);
    }
  }
  new ResizeObserver(resize).observe(el);
  resize();

  const clock = new THREE.Clock();
  let t = 0, visible = true, raf = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    camera.position.set(pointer.x * 1.3, 1.2 - pointer.y * 0.7, distance);
    camera.lookAt(LOOK);
    follow.position.set(pointer.x * 5, -pointer.y * 3 + 2, 4);
    world.update(t, dt);
    dust.rotation.y += dt * 0.012;
    renderer.render(scene, camera);
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    frame();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !REDUCED) { clock.getDelta(); raf = requestAnimationFrame(loop); } }

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
