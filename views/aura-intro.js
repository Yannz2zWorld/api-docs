// Yannz API — page-load intro for the dashboard (the login page has the slash intro), about 4.5 s:
//   0.0–0.7 s  the scythe rises out of the dark as a silhouette
//   0.6–2.4 s  a crimson aura sweeps across the screen; the scythe lights up where it passes
//   2.4–3.1 s  the lit scythe pulses: two aura rings and rising embers
//   3.1–4.3 s  the cover opens from the scythe outward in a glowing circle, showing the page
//   → 4.4 s    the 3D scythe makes its entrance (scene3d.js waits for the "slash:done" event)
// Shares the #slash-intro cover and the "slash:done" event with slash-intro.js. If this script
// never runs, the CSS fallback fades the cover; prefers-reduced-motion skips it.
(function () {
  'use strict';
  const cover = document.getElementById('slash-intro');
  const done = () => {
    window.__slashDone = true;
    document.dispatchEvent(new Event('slash:done'));
  };
  if (!cover || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (cover) cover.remove(); done(); return; }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) { cover.remove(); done(); return; }
  cover.style.animation = 'none';          // this script takes over from the CSS fallback
  cover.style.background = 'transparent';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  cover.appendChild(canvas);

  const LITE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  const dpr = Math.min(window.devicePixelRatio || 1, LITE ? 1.5 : 2);
  const BG = '#0b0b0c';
  const T = { rise: 700, sweep: 600, sweepDur: 1800, pulse: 2400, open: 3100, openDur: 1200, end: 4400 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const out = t => 1 - Math.pow(1 - t, 3);
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let W = 0, H = 0, k = 1, diag = 1;
  function size() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    k = Math.min(W, H) / 800 + 0.45;
    diag = Math.hypot(W, H);
  }
  size();

  // The scythe mark (rendered from the 3D model); the intro still runs if it fails to load.
  const mark = new Image();
  let markOk = false;
  mark.onload = () => { markOk = true; };
  mark.src = '/assets/scythe-mark.webp';
  // An offscreen layer so the silhouette/lit split can be composited without touching the cover.
  const layer = document.createElement('canvas'), lctx = layer.getContext('2d');

  function markBox() {
    const h = Math.min(H * 0.6, W * 0.9 * (681 / 440)), w = h * (440 / 681);
    return { w, h, x: W / 2 - w / 2, y: H / 2 - h / 2 };
  }

  // Draws the scythe: lit (full colour + crimson sheen) left of `litX`, a dark silhouette right of it.
  function drawMark(t, litX, alpha, scale) {
    if (!markOk || alpha <= 0) return;
    const b = markBox(), pw = Math.ceil(b.w * dpr), ph = Math.ceil(b.h * dpr);
    if (layer.width !== pw || layer.height !== ph) { layer.width = pw; layer.height = ph; }
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, pw, ph);
    lctx.drawImage(mark, 0, 0, pw, ph);
    lctx.globalCompositeOperation = 'source-atop';
    const edge = (litX - b.x) * dpr;
    const g = lctx.createLinearGradient(edge - 90 * dpr * k, 0, edge + 30 * dpr * k, 0);
    g.addColorStop(0, 'rgba(255,40,56,0)');
    g.addColorStop(0.75, 'rgba(255,40,56,.55)');      // crimson sheen riding the aura's front
    g.addColorStop(0.76, 'rgba(8,8,9,.86)');
    g.addColorStop(1, 'rgba(8,8,9,.86)');
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, pw, ph);
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = W / 2, cy = H / 2 + Math.sin(t / 520) * 4 * k;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.drawImage(layer, -b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  }

  // Aura streaks (thin speed lines riding the band) and embers, drawn additively.
  const streaks = [], embers = [];
  function addStreak(x) {
    streaks.push({ x: x - rand(0, 120) * k, y: rand(0.04, 0.96) * H, v: rand(500, 1100), len: rand(70, 220) * k, w: rand(1, 2.2) * k, life: rand(0.35, 0.7), age: 0 });
  }
  function addEmber() {
    const b = markBox();
    embers.push({ x: W / 2 + rand(-0.5, 0.5) * b.w, y: H / 2 + rand(0, 0.5) * b.h, vy: rand(-90, -30), vx: rand(-15, 15), r: rand(1, 2.6) * k, life: rand(0.8, 1.6), age: 0 });
  }
  function soft(x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,42,58,${a})`);
    g.addColorStop(1, 'rgba(255,42,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  let t0 = 0, last = 0;
  function frame(now) {
    if (!t0) t0 = last = now;
    const t = now - t0, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;

    // Cover, with a growing circular opening once the reveal starts.
    const o = inOut(clamp01((t - T.open) / T.openDur)), hole = o * diag * 0.62;
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.rect(-10, -10, W + 20, H + 20);
    if (hole > 0.5) ctx.arc(cx, cy, hole, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    if (hole > 0.5) {                              // glowing rim of the opening
      ctx.save();
      ctx.lineWidth = 10 * k; ctx.strokeStyle = `rgba(200,32,47,${0.35 * (1 - o)})`;
      ctx.beginPath(); ctx.arc(cx, cy, hole + 4 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2.5 * k; ctx.strokeStyle = `rgba(255,110,120,${0.9 * (1 - o)})`;
      ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // The aura sweep: a soft crimson band crossing left → right.
    const s = clamp01((t - T.sweep) / T.sweepDur), bandX = -0.35 * W + inOut(s) * 1.7 * W;
    const glowAll = clamp01((t - T.pulse) / 400) * (1 - o);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (s > 0 && s < 1) {
      // soft on both sides: a long trailing glow behind a brighter front
      const bw = Math.max(280, W * 0.5), lead = bw * 0.45, fade = Math.sin(Math.PI * s);
      const g = ctx.createLinearGradient(bandX - bw, 0, bandX + lead, 0);
      g.addColorStop(0, 'rgba(200,32,47,0)');
      g.addColorStop(0.45, `rgba(200,32,47,${0.14 * fade})`);
      g.addColorStop(0.68, `rgba(220,38,54,${0.34 * fade})`);
      g.addColorStop(0.78, `rgba(255,80,92,${0.4 * fade})`);
      g.addColorStop(0.9, `rgba(200,32,47,${0.12 * fade})`);
      g.addColorStop(1, 'rgba(200,32,47,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bandX - bw, 0, bw + lead, H);
      if (Math.random() < (LITE ? 0.45 : 0.8)) addStreak(bandX);
    }
    for (const st of streaks) {
      st.age += dt; st.x += st.v * dt;
      const a = Math.sin(Math.PI * clamp01(st.age / st.life)) * 0.55;
      if (a <= 0) continue;
      const g = ctx.createLinearGradient(st.x - st.len, 0, st.x, 0);
      g.addColorStop(0, 'rgba(255,60,74,0)');
      g.addColorStop(1, `rgba(255,120,130,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(st.x - st.len, st.y - st.w / 2, st.len, st.w);
    }
    // a steady aura behind the scythe once it is lit
    if (glowAll > 0) soft(cx, cy, Math.min(W, H) * 0.42, 0.22 * glowAll * (0.85 + 0.15 * Math.sin(t / 180)));
    // pulse rings
    for (const start of [T.pulse, T.pulse + 320]) {
      const p = clamp01((t - start) / 900);
      if (p <= 0 || p >= 1) continue;
      ctx.lineWidth = 3 * k * (1 - p) + 0.5;
      ctx.strokeStyle = `rgba(255,60,74,${0.6 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(cx, cy, (0.12 + p * 0.5) * Math.min(W, H), 0, Math.PI * 2); ctx.stroke();
    }
    // embers
    if (t > T.sweep + 400 && t < T.open + 600 && Math.random() < (LITE ? 0.35 : 0.7)) addEmber();
    for (const e of embers) {
      e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt;
      const a = clamp01(1 - e.age / e.life);
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(255,90,100,${a})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // The scythe: rises in, lights up behind the aura's front, then fades as the cover opens.
    const rise = out(clamp01(t / T.rise));
    const litX = s >= 1 ? W * 2 : bandX;
    drawMark(t, litX, rise * (1 - clamp01((t - T.open - 200) / 700)), (0.94 + 0.06 * rise) * (1 + 0.08 * o));

    if (t < T.end) requestAnimationFrame(frame);
    else { cover.remove(); done(); }
  }

  addEventListener('resize', size);
  // Give the mark a moment to load (it is small and cached), then start.
  let started = false;
  const start = () => { if (!started) { started = true; requestAnimationFrame(() => requestAnimationFrame(frame)); } };
  mark.addEventListener('load', start);
  mark.addEventListener('error', start);
  setTimeout(start, 600);
})();
