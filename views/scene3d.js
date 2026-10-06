// Yannz API — WebGL hero: the Crimson Requiem scythe (the /3d model, baked to a light GLB).
// Mounted on elements with [data-scene3d] ("core" on the login page, "stack" on the dashboard).
// Loaded exactly like /3d — classic scripts of three r147 (WebGL1 and WebGL2, no import maps or
// ES modules) — so it runs on older and lighter phone browsers too. Until the model has loaded,
// or if WebGL, the CDN or the model is unavailable, the page keeps its CSS fallback. Rendering
// pauses when the scene is off-screen or the tab is hidden, resolution adapts to the measured
// frame rate, and prefers-reduced-motion renders a single still frame.
// Add ?debug3d to the page URL to see what the scene is doing (handy on phones without devtools).
(function () {
'use strict';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const SCRIPTS = ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/environments/RoomEnvironment.js'];
const DEBUG = /[?&]debug3d\b/.test(location.search);
let THREE;

let debugBox = null;
function note(msg) {
  if (!DEBUG) return;
  if (!debugBox) {
    debugBox = document.createElement('pre');
    debugBox.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;margin:0;padding:10px;max-height:40vh;overflow:auto;background:#0b0b0c;color:#f4f4f5;border:2px solid #c8202f;font:11px/1.45 monospace;white-space:pre-wrap';
    document.body.appendChild(debugBox);
  }
  debugBox.textContent += '[' + (performance.now() / 1000).toFixed(1) + 's] ' + msg + '\n';
}

const MODEL_URL = '/assets/scythe.glb';
const DRACO_PATH = CDN + 'examples/js/libs/draco/gltf/';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
// Phones, small screens and low-memory/low-core machines get the light path.
const LITE = COARSE || Math.min(innerWidth, innerHeight) < 600 || (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
const BG = 0x0b0b0c;
const RED = 0xff1a2c;

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
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function glow(texture, scale, opacity, color = 0xffffff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale);
  return s;
}

function dust(count, spread, texture) {
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
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, map: texture, color: 0xd4d4d8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// Embers drifting up off the blade: positions live in a small CPU buffer (a few hundred points).
function embers(count, texture) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random(), 0.25 + Math.random() * 0.75], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, map: texture, color: RED, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  return {
    points,
    update(t, w, h) {
      for (let i = 0; i < count; i++) {
        const [a, b, c, speed] = seed.subarray(i * 4, i * 4 + 4);
        const life = (t * 0.09 * speed + a) % 1;
        pos[i * 3] = (b - 0.5) * w + Math.sin(t * 0.7 + c * 9) * 0.12;
        pos[i * 3 + 1] = -h * 0.5 + life * h * 1.15;
        pos[i * 3 + 2] = (c - 0.5) * 0.9;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

// The baked model carries material names from the /3d scene; restore what glTF can't express.
function dressModel(model) {
  const pulse = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material;
    if (m.name === 'glow') {
      o.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: RED, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      pulse.push({ m: o.material, base: 0.55, key: 'opacity' });
      return;
    }
    if (m.name === 'energy' || m.name === 'energyCore' || m.name === 'gem') {
      m.emissiveIntensity = m.name === 'energyCore' ? 3 : 2.4;
      m.toneMapped = m.name !== 'energyCore';
      pulse.push({ m, base: m.emissiveIntensity, key: 'emissiveIntensity' });
    }
    if (m.name === 'steel' || m.name === 'metal') m.envMapIntensity = 1.25;
  });
  return pulse;
}

// Login only: a display case around the scythe, drawn in the site's border style — light square
// edges, crimson corner blocks, faint glass, a plinth with a name plate. Sized from the model.
function buildCase(size) {
  const group = new THREE.Group();
  const W = size.x + 1.6, H = size.y + 1.4, D = Math.max(size.z + 2.6, 3.6), T = 0.16, PH = 1.2;
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, roughness: 0.45, metalness: 0.25 });
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0xc8202f, roughness: 0.4, metalness: 0.3, emissive: 0x2a0006 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); return m; };
  for (const y of [-H / 2, H / 2]) for (const z of [-D / 2, D / 2]) add(new THREE.BoxGeometry(W, T, T), edgeMat, 0, y, z);
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) add(new THREE.BoxGeometry(T, H, T), edgeMat, x, 0, z);
  for (const x of [-W / 2, W / 2]) for (const y of [-H / 2, H / 2]) add(new THREE.BoxGeometry(T, T, D), edgeMat, x, y, 0);
  const corner = new THREE.BoxGeometry(T * 2, T * 2, T * 2);
  for (const x of [-W / 2, W / 2]) for (const y of [-H / 2, H / 2]) for (const z of [-D / 2, D / 2]) add(corner, cornerMat, x, y, z);

  // Glass: barely there, plus one diagonal glint on the front pane.
  const glass = add(new THREE.BoxGeometry(W, H, D), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0);
  glass.renderOrder = 2;
  const glint = add(new THREE.PlaneGeometry(0.55, H * 0.62), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }), -W * 0.22, H * 0.08, D / 2 + 0.01);
  glint.rotation.z = 0.35;

  // Back pane: a faint 1-unit grid, like the dotted grid on the pages.
  const grid = [];
  for (let x = -Math.floor(W / 2); x <= W / 2; x++) grid.push(x, -H / 2, -D / 2 + 0.02, x, H / 2, -D / 2 + 0.02);
  for (let y = -Math.floor(H / 2); y <= H / 2; y++) grid.push(-W / 2, y, -D / 2 + 0.02, W / 2, y, -D / 2 + 0.02);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  group.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x52525b, transparent: true, opacity: 0.35 })));

  // Plinth and name plate.
  const plinthY = -H / 2 - T / 2 - PH / 2;
  const plinthGeo = new THREE.BoxGeometry(W + 1, PH, D + 1);
  add(plinthGeo, new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6, metalness: 0.2 }), 0, plinthY, 0)
    .add(new THREE.LineSegments(new THREE.EdgesGeometry(plinthGeo), new THREE.LineBasicMaterial({ color: 0xd4d4d8 })));
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const plate = new THREE.CanvasTexture(c);
  plate.encoding = THREE.sRGBEncoding;
  plate.anisotropy = 4;
  const drawPlate = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, 1024, 128);
    g.strokeStyle = '#d4d4d8'; g.lineWidth = 6; g.strokeRect(3, 3, 1018, 122);
    g.fillStyle = '#c8202f'; g.beginPath(); g.arc(56, 64, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f4f5'; g.font = '700 46px "Space Grotesk", "Outfit", sans-serif'; g.textBaseline = 'middle';
    g.fillText('CRIMSON REQUIEM', 88, 66);
    g.fillStyle = '#a1a1aa'; g.font = '500 26px "DM Mono", monospace'; g.textAlign = 'right';
    g.fillText('YANNZ API / 3D', 990, 68);
    plate.needsUpdate = true;
  };
  drawPlate();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawPlate);
  add(new THREE.PlaneGeometry((W + 1) * 0.8, (W + 1) * 0.8 / 8), new THREE.MeshBasicMaterial({ map: plate, toneMapped: false }), 0, plinthY, (D + 1) / 2 + 0.01);

  // Whole display (case + plinth) for framing; offsetY recentres it on the root.
  return { group, size: new THREE.Vector3(W + 1, H + T + PH, D + 1), offsetY: (T + PH) / 2 };
}

function mount(el) {
  const variant = el.dataset.scene3d;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !LITE, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    note('renderer failed: ' + (e && e.message));
    return;
  }
  note(variant + ': renderer ' + (renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1') + ', lite=' + LITE + ', loading model');
  const PR_MAX = Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.5), PR_MIN = 0.7;
  let pixelRatio = PR_MAX;
  renderer.setPixelRatio(pixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 12, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 6, 6);
  const rim = new THREE.DirectionalLight(0xff2a3a, 2.4);            // crimson rim, the site's one accent colour
  rim.position.set(-5, 2, -6);
  const rim2 = new THREE.DirectionalLight(0xa9bcff, 0.6);
  rim2.position.set(6, -1, -4);
  const blade = new THREE.PointLight(RED, 9, 5, 2);                 // the blade lights its own neighbourhood
  scene.add(key, rim, rim2, blade, new THREE.HemisphereLight(0xffffff, 0x0b0b0c, 0.35));

  const tex = glowTexture();
  const root = new THREE.Group();          // placed on screen by resize()
  const spin = new THREE.Group();          // slow turn + pointer response
  const tilt = new THREE.Group();          // the scythe leans across the frame
  tilt.rotation.z = variant === 'stack' ? -0.42 : 0;    // upright on its stand inside the login case
  root.add(spin);
  spin.add(tilt);
  scene.add(root);

  const halo = glow(tex, 1, 0.16, RED);    // a cheap red bloom behind the head instead of real post-processing
  const floorGlow = glow(tex, 1, 0.22, RED);
  if (variant === 'stack') root.add(floorGlow);
  const fx = embers(LITE ? 90 : 220, glowTexture(64, 0.3));
  spin.add(fx.points);                     // embers turn with the display
  const motes = dust(LITE ? 160 : 420, 10, glowTexture(64, 0.3));
  scene.add(motes);

  let model = null, pulse = [], size = new THREE.Vector3(1, 1, 1), frameSize = size, baseY = 0;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  const distance = 12;
  const LOOK = new THREE.Vector3(0, 0, 0);
  // World point on the z=0 plane under a given screen position (0..1, 0..1).
  function screenToWorld(sx, sy) {
    const v = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
    return camera.position.clone().add(v.multiplyScalar(-camera.position.z / v.z));
  }
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.set(0, 0, distance);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    // Fit the scythe to the visible height (and width on narrow frames), then anchor it:
    // login keeps it to the upper right so the headline below stays clear; the dashboard centres it.
    const visH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), visW = visH * camera.aspect;
    // [screen x, screen y, share of the height, share of the width]
    let sx, sy, frac, wide;
    if (variant === 'stack') [sx, sy, frac, wide] = [0.5, 0.48, 0.9, 1.05];
    else if (camera.aspect < 0.7) [sx, sy, frac, wide] = [0.54, 0.33, 0.56, 0.86];   // tall, narrow panel
    else if (w < 560) [sx, sy, frac, wide] = [0.74, 0.37, 0.6, 0.55];
    else [sx, sy, frac, wide] = camera.aspect > 1.25 ? [0.7, 0.42, 0.62, 0.5] : [0.68, 0.38, 0.62, 0.55];
    const fit = Math.min(visH * frac / frameSize.y, visW * wide / frameSize.x);
    root.position.copy(screenToWorld(sx, sy));
    root.scale.setScalar(fit);
  }

  // Drag to rotate (both pages). Touch: horizontal swipes turn it and vertical swipes still scroll
  // the page (touch-action: pan-y). Mouse can also tip it a little.
  const drag = { active: false, id: 0, x: 0, y: 0, yaw: 0, pitch: 0, v: 0, sway: 1, last: -1e4, mouse: false, at: 0 };
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', e => {
    if (!model) return;
    Object.assign(drag, { active: true, id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse', at: performance.now(), v: 0 });
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const now = performance.now(), dx = (e.clientX - drag.x) * 0.009, dt = Math.max(0.008, (now - drag.at) / 1000);
    drag.yaw += dx;
    drag.v = drag.v * 0.6 + (dx / dt) * 0.4;
    if (drag.mouse) drag.pitch = Math.max(-0.35, Math.min(0.35, drag.pitch + (e.clientY - drag.y) * 0.005));
    Object.assign(drag, { x: e.clientX, y: e.clientY, at: now, last: now });
    if (!raf) frame();   // reduced motion / idle loop: still follow the drag
  });
  const release = e => {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.active = false;
    drag.last = performance.now();
    if (drag.last - drag.at > 80) drag.v = 0;   // held still before letting go: no fling
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const clock = new THREE.Clock();
  let t = 0, visible = true, raf = 0, lost = false;
  // Average the frame time over 1.5 s; drop resolution when slow, raise it back when there's headroom.
  let fpsAcc = 0, fpsN = 0, fpsGood = 0;
  function adaptResolution(raw) {
    fpsAcc += raw; fpsN++;
    if (fpsAcc < 1.5) return;
    const fps = fpsN / fpsAcc;
    fpsAcc = 0; fpsN = 0;
    let next = pixelRatio;
    if (fps < 40) { next = Math.max(PR_MIN, pixelRatio - (fps < 25 ? 0.25 : 0.15)); fpsGood = 0; }
    else if (fps > 57 && ++fpsGood >= 2) { next = Math.min(PR_MAX, pixelRatio + 0.1); fpsGood = 0; }
    if (next !== pixelRatio) { pixelRatio = next; renderer.setPixelRatio(pixelRatio); resize(); }
  }

  function frame() {
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    camera.position.set(pointer.x * 0.9, -pointer.y * 0.5, distance);
    camera.lookAt(LOOK);
    if (model) {
      // Display-stand turn: a slow sway that keeps the blade facing the viewer, plus a gentle hover.
      // Drag to turn it; the idle sway fades out while dragging and back in a moment after.
      if (!drag.active) { drag.yaw += drag.v * dt; drag.v *= Math.exp(-dt * 3); }
      const idle = drag.active ? 0 : Math.min(1, Math.max(0, (performance.now() - drag.last) / 1000 - 1.5));
      drag.sway += (idle - drag.sway) * Math.min(1, dt * 1.5);
      spin.rotation.y = drag.yaw + (Math.sin(t * 0.32) * (variant === 'stack' ? 0.75 : 0.55) + pointer.x * 0.35) * drag.sway;
      spin.rotation.x = drag.pitch + pointer.y * 0.12 * drag.sway;
      spin.position.y = baseY;
      tilt.position.y = Math.sin(t * 0.9) * 0.06;
      const beat = 0.82 + Math.sin(t * 2.1) * 0.12 + Math.sin(t * 5.3) * 0.06;
      for (const p of pulse) p.m[p.key] = p.base * beat;
      blade.intensity = 9 * beat;
      halo.material.opacity = 0.14 * beat;
      fx.update(t, size.x * 0.9, size.y);
    }
    motes.rotation.y += dt * 0.012;
    renderer.render(scene, camera);
    if (raf) adaptResolution(raw);
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden || lost) return;
    raf = requestAnimationFrame(loop);
    frame();
  }
  function start() { if (!raf && !REDUCED && !lost && model) { clock.getDelta(); raf = requestAnimationFrame(loop); } }

  // setSize clears the canvas: repaint at once when the loop is idle (reduced motion,
  // off-screen) so the scene never stays blank after a resize or rotation.
  new ResizeObserver(() => { resize(); if (!raf && !lost && model) frame(); }).observe(el);
  resize();

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

  const draco = new THREE.DRACOLoader().setDecoderPath(DRACO_PATH);
  new THREE.GLTFLoader().setDRACOLoader(draco).load(MODEL_URL, gltf => {
    draco.dispose();
    model = gltf.scene;
    pulse = dressModel(model);
    // Centre on the bounding box and keep its size for framing.
    const box = new THREE.Box3().setFromObject(model);
    box.getSize(size);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    tilt.add(model);
    // Head (blade and skull) sits at the top-right of the model: anchor the glows there.
    const head = new THREE.Vector3(size.x * 0.12, size.y * 0.3, 0.3);
    blade.position.copy(head);
    tilt.add(blade, halo);
    halo.position.copy(head);
    halo.scale.setScalar(size.y * 0.75);
    floorGlow.position.set(0, -size.y * 0.52, -0.5);
    floorGlow.scale.set(size.x * 1.4, size.y * 0.18, 1);
    if (variant !== 'stack') {
      const display = buildCase(size);
      spin.add(display.group);
      frameSize = display.size;
      baseY = display.offsetY;
    }
    el.style.pointerEvents = 'auto';
    resize();
    t = 2.4;
    frame();
    el.classList.add('is-ready');
    document.documentElement.classList.add('webgl-' + variant);
    note(variant + ': model ready, showing the scythe');
    start();
  }, undefined, err => {
    // Keep the CSS fallback; free the GPU context.
    console.warn('3D model unavailable:', err && err.message);
    note('model failed: ' + (err && err.message || err));
    draco.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;          // download in parallel, run in order
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load ' + src));
    document.head.appendChild(s);
  });
}

function boot() {
  const els = document.querySelectorAll('[data-scene3d]');
  if (!els.length) return;
  if (!hasWebGL()) { note('WebGL is not available in this browser: keeping the CSS scene'); return; }
  note('WebGL ok, loading three.js');
  Promise.all(SCRIPTS.map(f => loadScript(CDN + f))).then(() => {
    THREE = window.THREE;
    THREE.ColorManagement.legacyMode = false;   // colours as authored (sRGB), like the r15x defaults
    els.forEach(el => { try { mount(el); } catch (e) { console.warn('3D scene unavailable:', e && e.message); note('mount failed: ' + (e && e.message)); } });
  }, e => { console.warn('3D scene unavailable:', e.message); note(e.message); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
