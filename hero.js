// Animated 3D-Gaussian-splat-style hero canvas
// Renders a pile of anisotropic ellipsoids that orbit slowly, with tactile-orange + measure-blue tints

(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Generate splats around an implicit object (peach-like ellipsoid)
  const N = 320;
  const splats = [];
  const rng = mulberry32(7);

  // Object roughly an ellipsoid with a contact patch
  for (let i = 0; i < N; i++) {
    const u = rng() * Math.PI * 2;
    const v = Math.acos(2 * rng() - 1);
    const r = 0.9 + (rng() - 0.5) * 0.1;
    const x = r * Math.sin(v) * Math.cos(u);
    const y = r * Math.sin(v) * Math.sin(u) * 1.05;
    const z = r * Math.cos(v) * 0.95;

    // Tactile region: a patch on +x side
    const isTactile = x > 0.55 && Math.abs(y) < 0.5 && z > 0;
    // Sparse measured area at the back
    const isOcc = x < -0.4 && rng() < 0.4;

    splats.push({
      x, y, z,
      sx: 0.04 + rng() * 0.05,
      sy: 0.04 + rng() * 0.05,
      sz: 0.04 + rng() * 0.05,
      rot: rng() * Math.PI,
      isTactile, isOcc,
      a: 0.55 + rng() * 0.3,
    });
  }

  // Floor anchor points (sparse)
  for (let i = 0; i < 60; i++) {
    splats.push({
      x: (rng() - 0.5) * 3,
      y: (rng() - 0.5) * 3,
      z: -1.1 - rng() * 0.05,
      sx: 0.08, sy: 0.08, sz: 0.005,
      rot: 0, isFloor: true, a: 0.18,
    });
  }

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function project(p, cam) {
    // simple yaw rotation around z
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let x = p.x * cy - p.y * sy;
    let y = p.x * sy + p.y * cy;
    let z = p.z;
    // pitch around x-axis
    const y2 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    y = y2; z = z2;

    // perspective
    const f = 2.4;
    const dist = 4 + z;
    const sx = (x * f / dist) * (W * 0.32) + W * 0.5;
    const sy_ = (-y * f / dist) * (W * 0.32) + H * 0.5;
    return { x: sx, y: sy_, depth: dist, scale: f / dist };
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    // soft warm radial bg already in CSS

    const cam = {
      yaw: t * 0.00018,
      pitch: -0.35 + Math.sin(t * 0.0002) * 0.04,
    };

    // Sort by depth
    const projected = splats.map(s => ({ s, p: project(s, cam) }));
    projected.sort((a, b) => b.p.depth - a.p.depth);

    for (const { s, p } of projected) {
      const rx = s.sx * p.scale * (W * 0.32);
      const ry = s.sy * p.scale * (W * 0.32);
      let r = Math.max(rx, ry);
      if (r < 1.2) r = 1.2;

      let color, alpha = s.a;
      if (s.isFloor) {
        color = 'oklch(0.6 0.005 80)';
        alpha = 0.12;
      } else if (s.isTactile) {
        color = 'oklch(0.72 0.16 50)';
        alpha = 0.55;
      } else if (s.isOcc) {
        color = 'oklch(0.55 0.03 80)';
        alpha = 0.25;
      } else {
        // measurement-blue with slight depth fade
        color = 'oklch(0.62 0.13 240)';
        alpha = 0.4;
      }

      // gradient for splat
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, withAlpha(color, alpha));
      g.addColorStop(1, withAlpha(color, 0));

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.6, r * 1.0, s.rot + cam.yaw, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  function withAlpha(c, a) {
    // oklch supports alpha via /
    if (c.startsWith('oklch(')) {
      return c.replace(')', ` / ${a})`);
    }
    return c;
  }
  requestAnimationFrame(frame);
})();
