// Yannz API — page-load intro for the scythe pages (login, dashboard): a scythe slash cuts the
// dark cover in two, blood sprays and drips from the cut, the halves fall apart, and then the
// 3D scythe makes its entrance (scene3d.js waits for the "slash:done" event).
// The cover (#slash-intro) is in the HTML so it is there from the first paint; if this script
// never runs, a CSS fallback fades it out. prefers-reduced-motion hides it entirely.
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
  cover.appendChild(canvas);

  const LITE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  const dpr = Math.min(window.devicePixelRatio || 1, LITE ? 1.5 : 2);
  let W = 0, H = 0;
  function size() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  }
  size();

  const BG = '#0b0b0c';
  const BLOOD = ['#4a000c', '#6e0014', '#8f0a1d', '#a3172a', '#c8202f'];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;

  // The cut: a scythe arc from upper right to lower left (quadratic curve).
  const curve = () => ({ x0: W * 1.08, y0: H * 0.02, cx: W * 0.56, cy: H * 0.66, x1: -W * 0.08, y1: H * 0.98 });
  function point(c, u) {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
    return { x: a * c.x0 + b * c.cx + d * c.x1, y: a * c.y0 + b * c.cy + d * c.y1 };
  }
  function normal(c, u) {   // unit normal pointing to the upper-right side of the cut
    const tx = 2 * (1 - u) * (c.cx - c.x0) + 2 * u * (c.x1 - c.cx), ty = 2 * (1 - u) * (c.cy - c.y0) + 2 * u * (c.y1 - c.cy);
    const l = Math.hypot(tx, ty) || 1;
    return { x: ty / l, y: -tx / l };
  }

  // Timeline (ms)
  const T_SWING = 110, T_CUT = 330, T_SPLIT = 420, T_FALL = 700, T_END = 1450;
  const N = LITE ? 70 : 150;
  let drops = [], blots = [], drips = [], spawned = false;

  function spawn(c) {
    spawned = true;
    for (let i = 0; i < N; i++) {
      const u = rand(0.05, 0.95), p = point(c, u), n = normal(c, u), side = Math.random() < 0.5 ? 1 : -1;
      const sp = rand(260, 900) * (LITE ? 0.85 : 1);
      drops.push({
        x: p.x, y: p.y,
        vx: n.x * side * sp + rand(-160, 60), vy: n.y * side * sp + rand(-120, 120),
        r: rand(1.2, 4.6), c: BLOOD[(Math.random() * BLOOD.length) | 0], life: rand(0.7, 1.15)
      });
    }
    for (let i = 0; i < (LITE ? 12 : 22); i++) {
      const u = rand(0.08, 0.92), p = point(c, u), n = normal(c, u), side = Math.random() < 0.5 ? 1 : -1, off = rand(6, 70);
      blots.push({ side, x: p.x + n.x * side * off, y: p.y + n.y * side * off, r: rand(5, 22), c: BLOOD[1 + ((Math.random() * 3) | 0)], rot: rand(0, 6.3), spikes: Array.from({ length: 5 + ((Math.random() * 6) | 0) }, () => rand(1.3, 2.2)) });
    }
    for (let i = 0; i < (LITE ? 8 : 14); i++) {
      const u = rand(0.12, 0.9);
      drips.push({ u, w: rand(2, 5), len: rand(40, 180), speed: rand(0.6, 1.4), c: BLOOD[2 + ((Math.random() * 2) | 0)] });
    }
  }

  // One half of the cover: everything above (side 1) or below (side -1) the cut.
  function halfPath(c, side) {
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    if (side > 0) { ctx.lineTo(-W * 0.1, -H * 0.1); ctx.lineTo(W * 1.1, -H * 0.1); }
    else { ctx.lineTo(-W * 0.1, H * 1.1); ctx.lineTo(W * 1.1, H * 1.1); }
    ctx.closePath();
  }

  function drawHalf(c, side, shift, alpha, k) {
    const mid = normal(c, 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(mid.x * side * shift, mid.y * side * shift + (side < 0 ? shift * 0.35 : -shift * 0.1));
    halfPath(c, side);
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.clip();
    // Bleeding cut edge
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    ctx.strokeStyle = '#8f0a1d';
    ctx.lineWidth = 10 * k;
    ctx.shadowColor = '#c8202f';
    ctx.shadowBlur = 18 * k;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Splatter that landed on this half
    for (const b of blots) {
      if (b.side !== side) continue;
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * k, 0, Math.PI * 2);
      ctx.fill();
      for (let s = 0; s < b.spikes.length; s++) {
        const a = b.rot + (s / b.spikes.length) * Math.PI * 2, l = b.r * k * b.spikes[s];
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a) * l, b.y + Math.sin(a) * l, b.r * 0.22 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // Drips run down from the upper half's cut edge
    if (side > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(mid.x * shift, mid.y * shift - shift * 0.1);
      for (const d of drips) {
        const p = point(c, d.u), l = d.len * d.speed * k;
        const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + l);
        g.addColorStop(0, d.c); g.addColorStop(1, 'rgba(143,10,29,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - d.w / 2, p.y - 2, d.w, l);
        ctx.fillStyle = d.c;
        ctx.beginPath(); ctx.arc(p.x, p.y + l * 0.92, d.w * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // The swing itself: a crescent that grows along the curve, white-hot core in a crimson glow.
  function drawSwing(c, head, tail, fade) {
    const steps = 46;
    if (head - tail < 0.004) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    for (const [color, width, blur] of [['rgba(200,32,47,.55)', 34, 30], ['#ff2a3a', 13, 16], ['#fff1f2', 4.5, 0]]) {
      ctx.strokeStyle = color;
      ctx.shadowColor = '#ff1a2c';
      ctx.shadowBlur = blur;
      for (let i = 0; i < steps; i++) {
        const u0 = tail + (head - tail) * (i / steps), u1 = tail + (head - tail) * ((i + 1) / steps);
        const w = Math.sin(((i + 0.5) / steps) * Math.PI) * width;
        if (w < 0.3) continue;
        const a = point(c, u0), b = point(c, u1);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  let t0 = 0, last = 0;
  function frame(now) {
    if (!t0) t0 = last = now;
    const t = now - t0, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const c = curve(), k = Math.min(W, H) / 800 + 0.5;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Screen shake on impact
    const shake = t > T_CUT - 40 && t < T_CUT + 220 ? (1 - (t - T_CUT + 40) / 260) * 9 * k : 0;
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // Cover halves: whole until the cut, then they fall apart
    const sp = clamp01((t - T_SPLIT) / T_FALL);
    // the slit opens at once (page shows through the cut), then the halves fall away
    const shift = sp * sp * Math.hypot(W, H) * 0.9 + easeOut(clamp01((t - T_CUT) / 220)) * 28 * k;
    const coverAlpha = 1 - clamp01((t - T_SPLIT - T_FALL * 0.6) / (T_FALL * 0.4));
    if (t < T_CUT) {
      ctx.fillStyle = BG;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      // a breath of red before the swing
      const g = ctx.createRadialGradient(W * 0.62, H * 0.42, 0, W * 0.62, H * 0.42, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(200,32,47,${0.1 * clamp01(t / T_CUT)})`);
      g.addColorStop(1, 'rgba(200,32,47,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (t < T_SPLIT + T_FALL) {
      if (!spawned) spawn(c);
      drawHalf(c, 1, shift, coverAlpha, k);
      drawHalf(c, -1, shift, coverAlpha, k);
    }

    // Red flash on impact
    if (t > T_CUT && t < T_CUT + 300) {
      ctx.fillStyle = `rgba(200,32,47,${0.32 * (1 - (t - T_CUT) / 300)})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // The swing
    if (t > T_SWING && t < T_CUT + 420) {
      const head = easeOut(clamp01((t - T_SWING) / (T_CUT - T_SWING)));
      const tail = easeIn(clamp01((t - T_SWING - 80) / (T_CUT - T_SWING + 260)));
      drawSwing(c, head, tail, 1 - clamp01((t - T_CUT - 60) / 360));
    }

    // Blood spray
    if (spawned) {
      for (const d of drops) {
        d.vy += 1500 * dt;
        d.vx *= 1 - 0.8 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        const age = (t - T_CUT) / 1000, a = clamp01(1 - age / d.life);
        if (a <= 0) continue;
        const v = Math.hypot(d.vx, d.vy), stretch = 1 + Math.min(3, v / 420);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(d.x, d.y);
        ctx.rotate(Math.atan2(d.vy, d.vx));
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.r * k * stretch, d.r * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (t < T_END) requestAnimationFrame(frame);
    else { cover.remove(); done(); }
  }

  addEventListener('resize', size);
  // Wait a frame so the page underneath has painted, then cut.
  requestAnimationFrame(() => requestAnimationFrame(frame));
})();
