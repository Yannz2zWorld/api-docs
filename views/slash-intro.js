// Yannz API — page-load intro for the scythe pages (login, dashboard), about 5 s:
//   0.0–1.0 s  dark cover, "YANNZ API" with a crimson line filling under it
//   1.0–1.4 s  a crescent scythe slash sweeps across the screen
//   1.4 s      impact: a white cut line, a short crimson flash, a small shake, blood sprays
//   1.4–2.7 s  the cut opens into a glowing slit and blood runs down from its upper lip
//   2.7–4.0 s  the two halves slide apart off screen
//   → 4.9 s    the last drops fall away; then the 3D scythe makes its entrance
//              (scene3d.js waits for the "slash:done" event)
// The cover (#slash-intro) is in the HTML so it is there from the first paint; if this script
// never runs, a CSS fallback fades it out. prefers-reduced-motion skips the intro entirely.
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

  const BG = '#0b0b0c', RED = '#c8202f';
  const BLOOD = ['#5c0712', '#7a0a18', '#8f0d1e', '#a3172a'];
  const T = { swing: 1000, cut: 1400, fall: 2700, fallDur: 1300, end: 4900 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const ease = { out: t => 1 - Math.pow(1 - t, 3), outQuart: t => 1 - Math.pow(1 - t, 4), in: t => t * t, inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };

  // ---------------------------------------------------------------- geometry
  // The cut: a gentle scythe arc from the upper right to the lower left, sampled once per size.
  let W = 0, H = 0, k = 1, diag = 1, cut = [], mid = { nx: 0, ny: 0 };
  function size() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    k = Math.min(W, H) / 800 + 0.45;
    diag = Math.hypot(W, H);
    const x0 = W * 1.06, y0 = H * 0.16, cx = W * 0.52, cy = H * 0.66, x1 = -W * 0.06, y1 = H * 0.86;
    cut = [];
    for (let i = 0; i <= 80; i++) {
      const u = i / 80, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
      const tx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx), ty = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy), l = Math.hypot(tx, ty) || 1;
      // unit normal pointing to the side above the cut (up-left), so side 1 moves away from side -1
      cut.push({ x: a * x0 + b * cx + d * x1, y: a * y0 + b * cy + d * y1, tx: tx / l, ty: ty / l, nx: -ty / l, ny: tx / l });
    }
    mid = cut[40];
  }
  const at = u => cut[Math.max(0, Math.min(80, Math.round(u * 80)))];
  size();

  // ---------------------------------------------------------------- blood
  let drops = [], drips = [];
  function bleed() {
    for (let i = 0; i < (LITE ? 34 : 64); i++) {
      const p = at(rand(0.06, 0.94)), side = Math.random() < 0.7 ? -1 : 1, along = rand(140, 520), out = rand(30, 200);
      drops.push({
        x: p.x, y: p.y,
        vx: p.tx * along + p.nx * side * out, vy: p.ty * along + p.ny * side * out - rand(0, 120),
        r: rand(1.6, 4.2), c: BLOOD[(Math.random() * BLOOD.length) | 0]
      });
    }
    for (let i = 0; i < (LITE ? 7 : 11); i++) {
      drips.push({ u: 0.1 + (i + rand(0.15, 0.85)) * (0.8 / (LITE ? 7 : 11)), w: rand(3.4, 6), len: rand(26, 80), delay: rand(0, 600), dur: rand(1000, 1600) });
    }
  }

  // ---------------------------------------------------------------- drawing
  function cutPath(side) {        // one half of the cover: everything above (1) or below (-1) the cut
    ctx.beginPath();
    ctx.moveTo(cut[0].x, cut[0].y);
    for (const p of cut) ctx.lineTo(p.x, p.y);
    if (side > 0) { ctx.lineTo(-W * 0.2, -H * 0.2); ctx.lineTo(W * 1.2, -H * 0.2); }
    else { ctx.lineTo(-W * 0.2, H * 1.2); ctx.lineTo(W * 1.2, H * 1.2); }
    ctx.closePath();
  }
  function strokeCut(width, color) {
    ctx.beginPath();
    ctx.moveTo(cut[0].x, cut[0].y);
    for (const p of cut) ctx.lineTo(p.x, p.y);
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  }

  function half(side, shift, glow) {
    ctx.save();
    ctx.translate(mid.nx * side * shift, mid.ny * side * shift);
    cutPath(side);
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.clip();
    // the wound's lip: a crimson rim with a soft inner glow, clipped to this half
    strokeCut(22 * k, `rgba(200,32,47,${0.16 * glow})`);
    strokeCut(8 * k, `rgba(163,23,42,${0.75 * glow})`);
    strokeCut(2.5 * k, `rgba(255,90,100,${0.9 * glow})`);
    ctx.restore();
  }

  function drawDrips(t, shift) {
    ctx.save();
    ctx.translate(mid.nx * shift, mid.ny * shift);
    for (const d of drips) {
      const g = ease.out(clamp01((t - T.cut - d.delay) / d.dur));
      if (g <= 0) continue;
      const p = at(d.u), len = d.len * k * g, w = d.w * k, r = w * 0.95;
      ctx.fillStyle = '#7a0a18';
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2, p.y - 2);
      ctx.quadraticCurveTo(p.x - w * 0.22, p.y + len * 0.5, p.x - w * 0.3, p.y + len);
      ctx.arc(p.x, p.y + len, r, Math.PI, 0, true);
      ctx.quadraticCurveTo(p.x + w * 0.22, p.y + len * 0.5, p.x + w / 2, p.y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,130,.4)';       // a small highlight on the bead so it reads as liquid
      ctx.beginPath(); ctx.arc(p.x - r * 0.35, p.y + len - r * 0.25, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawDrops(dt) {
    for (const d of drops) {
      d.vy += 900 * dt;
      d.vx *= 1 - 0.6 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y > H + 40) continue;
      const v = Math.hypot(d.vx, d.vy), a = Math.atan2(d.vy, d.vx), r = d.r * k, len = r * Math.min(3.2, 1.3 + v / 320);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(a);
      ctx.fillStyle = d.c;
      ctx.beginPath();                                  // teardrop: round head, tapered tail
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      ctx.quadraticCurveTo(-len * 0.4, r * 0.6, -len, 0);
      ctx.quadraticCurveTo(-len * 0.4, -r * 0.6, 0, -r);
      ctx.fill();
      ctx.restore();
    }
  }

  // The swing: a tapered crescent (thicker toward its head) along the cut, white-hot at the head.
  function crescent(head, tail, alpha) {
    if (head - tail < 0.01 || alpha <= 0) return;
    const n = 40, maxW = 24 * k, top = [], bottom = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, p = at(tail + (head - tail) * s);
      const w = maxW * Math.pow(Math.sin(Math.PI * s), 0.7) * (0.3 + 0.7 * s) * 0.5;
      top.push([p.x + p.nx * w, p.y + p.ny * w]);
      bottom.push([p.x - p.nx * w, p.y - p.ny * w]);
    }
    const a = at(tail), b = at(head);
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, 'rgba(200,32,47,0)');
    grad.addColorStop(0.55, 'rgba(200,32,47,.95)');
    grad.addColorStop(0.9, '#ff6b77');
    grad.addColorStop(1, '#fff1f2');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const q of top) ctx.lineTo(q[0], q[1]);
    for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1]);
    ctx.closePath();
    if (!LITE) { ctx.shadowColor = RED; ctx.shadowBlur = 28 * k; }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function label(t) {
    const a = clamp01(t / 300) * (1 - clamp01((t - 780) / 220));
    if (a <= 0) return;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d4d4d8';
    ctx.font = `600 ${Math.round(13 * k + 4)}px "DM Mono", "Space Grotesk", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '0.32em'; } catch { /* older canvas */ }
    ctx.fillText('YANNZ API', cx, cy - 10 * k);
    const lw = 150 * k;
    ctx.fillStyle = '#26262b';
    ctx.fillRect(cx - lw / 2, cy + 12 * k, lw, 2);
    ctx.fillStyle = RED;
    ctx.fillRect(cx - lw / 2, cy + 12 * k, lw * ease.out(clamp01(t / 900)), 2);
    ctx.restore();
  }

  // ---------------------------------------------------------------- timeline
  let t0 = 0, last = 0, bled = false;
  function frame(now) {
    if (!t0) t0 = last = now;
    const t = now - t0, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const shake = t > T.cut && t < T.cut + 180 ? (1 - (t - T.cut) / 180) * 3.5 * k : 0;
    if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    if (t < T.cut) {
      ctx.fillStyle = BG;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, diag * 0.6);
      g.addColorStop(0, `rgba(200,32,47,${0.07 * clamp01(t / T.swing)})`);
      g.addColorStop(1, 'rgba(200,32,47,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      label(t);
    } else {
      if (!bled) { bled = true; bleed(); }
      const open = 16 * k * ease.out(clamp01((t - T.cut) / 600));
      const shift = open + ease.inOut(clamp01((t - T.fall) / T.fallDur)) * diag * 1.15;
      const glow = 1 - 0.5 * clamp01((t - T.fall) / T.fallDur);
      half(1, shift, glow);
      half(-1, shift, glow);
      drawDrips(t, shift);
      // impact: a bright cut line and a short crimson flash
      const hit = 1 - clamp01((t - T.cut) / 260);
      if (hit > 0) {
        ctx.save();
        ctx.globalAlpha = hit;
        strokeCut(3 * k, '#fff1f2');
        ctx.restore();
        ctx.fillStyle = `rgba(200,32,47,${0.2 * hit})`;
        ctx.fillRect(-10, -10, W + 20, H + 20);
      }
    }

    if (t > T.swing && t < T.cut + 380) {
      const s = clamp01((t - T.swing) / (T.cut - T.swing));
      crescent(ease.outQuart(s), ease.in(clamp01((t - T.swing - 120) / (T.cut - T.swing + 240))), 1 - clamp01((t - T.cut) / 380));
    }

    if (bled) drawDrops(dt);

    if (t < T.end) requestAnimationFrame(frame);
    else { cover.remove(); done(); }
  }

  addEventListener('resize', size);
  // Wait a frame so the page underneath has painted, then start.
  requestAnimationFrame(() => requestAnimationFrame(frame));
})();
