// Animated mini "experiment" canvases used in the video grid + failure cases.
// Each canvas simulates a different aspect of GaussianFeels behavior.

(function () {
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
  function withAlpha(c, a) {
    if (c.startsWith('oklch(')) return c.replace(')', ` / ${a})`);
    return c;
  }

  // Generic projection helpers
  function rot3(p, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let x = p.x * cy - p.z * sy;
    let z = p.x * sy + p.z * cy;
    let y = p.y;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    return { x, y: y2, z: z2 };
  }
  function proj(p, W, H, dist) {
    const f = 2.0;
    const d = dist + p.z;
    return { x: (p.x * f / d) * (W * 0.36) + W * 0.5, y: (-p.y * f / d) * (W * 0.36) + H * 0.55, scale: f / d, depth: d };
  }

  // ---------- Sequence #1: Online reconstruction over time ----------
  function makeReconstructionSeq(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);

    const seed = opts.seed || 12;
    const rng = mulberry32(seed);
    const N = 600;
    const points = [];
    for (let i = 0; i < N; i++) {
      const u = rng() * Math.PI * 2;
      const v = Math.acos(2 * rng() - 1);
      const r = 0.85 + (rng() - 0.5) * 0.06;
      // bunny-like deformation
      const x = r * Math.sin(v) * Math.cos(u) * 0.9;
      const y = r * Math.sin(v) * Math.sin(u) * 1.1;
      const z = r * Math.cos(v) * 0.7;
      const tactileSide = x > 0.5;
      const back = z < -0.3;
      points.push({ x, y, z, birthT: rng(), tactile: tactileSide && rng() < 0.4, back });
    }

    // Camera ring around object
    let progress = 0;
    let playing = true;
    let lastT = performance.now();

    canvas._setProgress = (p) => { progress = p; };
    canvas._togglePlay = () => { playing = !playing; lastT = performance.now(); return playing; };
    canvas._isPlaying = () => playing;
    canvas._getProgress = () => progress;

    function draw(t) {
      const dt = t - lastT; lastT = t;
      if (playing) progress = (progress + dt * 0.00012) % 1;

      // bg
      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      // grid floor
      ctx.strokeStyle = 'oklch(0.25 0.008 80)';
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        const a = proj(rot3({x:i*0.3, y:-0.7, z:-1.2}, progress*Math.PI*2, -0.4), W, H, 3.5);
        const b = proj(rot3({x:i*0.3, y:-0.7, z:1.2}, progress*Math.PI*2, -0.4), W, H, 3.5);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      const yaw = progress * Math.PI * 2;
      const pitch = -0.35;

      const projected = points
        .filter(pt => pt.birthT < progress + 0.05)
        .map(pt => {
          const r = rot3(pt, yaw, pitch);
          const p = proj(r, W, H, 3.6);
          return { pt, p };
        })
        .sort((a, b) => b.p.depth - a.p.depth);

      for (const { pt, p } of projected) {
        let color, a = 0.6, sz = 4 * p.scale;
        const age = Math.min(1, (progress - pt.birthT + 0.3) / 0.3);
        if (pt.tactile) { color = 'oklch(0.72 0.16 50)'; a = 0.7 * age; sz *= 1.1; }
        else if (pt.back) { color = 'oklch(0.55 0.04 80)'; a = 0.35 * age; }
        else { color = 'oklch(0.62 0.13 240)'; a = 0.5 * age; }

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2.5);
        g.addColorStop(0, withAlpha(color, a));
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sz * 2.5, sz * 1.4, yaw, 0, Math.PI * 2);
        ctx.fill();
      }

      // overlay text
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 11px JetBrains Mono, monospace';
      ctx.fillText(`frame ${Math.floor(progress * 240).toString().padStart(3,'0')}/240`, 14, 22);
      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.fillText(`splats ${Math.floor(projected.length).toString().padStart(4,'0')}`, 14, 38);

      // legend
      drawLegend(ctx, W - 160, H - 56, [
        ['oklch(0.62 0.13 240)', 'measured (cam)'],
        ['oklch(0.72 0.16 50)', 'tactile'],
      ]);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Sequence #2: Pose tracking under occlusion ----------
  function makePoseTracking(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);

    const rng = mulberry32(opts.seed || 23);
    const N = 280;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = rng() * Math.PI * 2;
      const v = Math.acos(2 * rng() - 1);
      pts.push({
        x: 0.7 * Math.sin(v) * Math.cos(u),
        y: 0.95 * Math.sin(v) * Math.sin(u),
        z: 0.6 * Math.cos(v),
      });
    }

    let progress = 0; let playing = true; let lastT = performance.now();
    canvas._setProgress = p => progress = p;
    canvas._togglePlay = () => { playing = !playing; lastT = performance.now(); return playing; };
    canvas._isPlaying = () => playing;
    canvas._getProgress = () => progress;

    function draw(t) {
      const dt = t - lastT; lastT = t;
      if (playing) progress = (progress + dt * 0.00009) % 1;

      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      const yaw = Math.sin(progress * Math.PI * 2) * 0.6 + progress * Math.PI * 0.5;
      const pitch = -0.3 + Math.sin(progress * Math.PI * 2) * 0.12;

      // Project object
      const projected = pts.map(pt => {
        const r = rot3(pt, yaw, pitch);
        return { pt, p: proj(r, W, H, 3.4) };
      }).sort((a, b) => b.p.depth - a.p.depth);

      for (const { pt, p } of projected) {
        const sz = 3.5 * p.scale;
        // occluded if to the right and progress > 0.3
        const occlusion = (Math.sin(progress * Math.PI * 2) + 1) / 2; // 0..1
        const occluded = pt.x > -0.1 && Math.random() < occlusion * 0.4;
        let color = occluded ? 'oklch(0.45 0.05 80)' : 'oklch(0.62 0.13 240)';
        let a = occluded ? 0.2 : 0.55;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2.3);
        g.addColorStop(0, withAlpha(color, a));
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sz * 2.3, sz * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // hand silhouette: a soft semi-transparent arc occluding
      const occRatio = (Math.sin(progress * Math.PI * 2) + 1) / 2;
      ctx.fillStyle = 'oklch(0.32 0.02 60 / 0.55)';
      ctx.beginPath();
      const cx = W * 0.55, cy = H * 0.55;
      const ang = progress * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(ang) * 80, cy + Math.sin(ang) * 60);
      for (let a = 0; a < Math.PI; a += 0.2) {
        ctx.lineTo(cx + Math.cos(ang + a - Math.PI/2) * (90 + 20*Math.sin(a*3)), cy + Math.sin(ang + a - Math.PI/2) * (70 + 10*Math.sin(a*3)));
      }
      ctx.closePath();
      ctx.fill();

      // tactile contact dots near hand
      for (let i = 0; i < 4; i++) {
        const a = ang - Math.PI/2 + (i - 1.5) * 0.25;
        const x = cx + Math.cos(a) * 90;
        const y = cy + Math.sin(a) * 70;
        ctx.fillStyle = 'oklch(0.72 0.16 50)';
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'oklch(0.72 0.16 50 / 0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
      }

      // hud: trajectory plot
      ctx.fillStyle = 'oklch(0.18 0.01 80)';
      ctx.fillRect(W - 132, 12, 120, 60);
      ctx.strokeStyle = 'oklch(0.35 0.01 80)'; ctx.lineWidth = 1;
      ctx.strokeRect(W - 132, 12, 120, 60);
      ctx.strokeStyle = 'oklch(0.62 0.13 240)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 80; i++) {
        const u = i / 80;
        const x = W - 130 + u * 116;
        const y = 42 + Math.sin(u * Math.PI * 4 + progress * 6) * 18 * (0.3 + (1 - Math.abs(u - 0.5)));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.font = '500 9px JetBrains Mono, monospace';
      ctx.fillText('pose error (mm)', W - 128, 24);

      // text
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 11px JetBrains Mono, monospace';
      ctx.fillText(`occlusion ρ = ${(occRatio).toFixed(2)}`, 14, 22);
      ctx.fillStyle = occRatio > 0.6 ? 'oklch(0.72 0.16 50)' : 'oklch(0.7 0.005 80)';
      ctx.fillText(occRatio > 0.6 ? 'tactile-dominant' : 'visual-dominant', 14, 38);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Sequence #3: Progressive replacement ----------
  function makeProgReplace(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);

    const rng = mulberry32(opts.seed || 41);
    const N = 700;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = rng() * Math.PI * 2;
      const v = Math.acos(2 * rng() - 1);
      const r = 0.85 + (rng() - 0.5) * 0.04;
      const ang = Math.atan2(Math.sin(v)*Math.sin(u), Math.cos(v));
      // measured emerges in a wedge that grows with progress
      pts.push({
        x: r * Math.sin(v) * Math.cos(u) * 1.0,
        y: r * Math.sin(v) * Math.sin(u) * 1.05,
        z: r * Math.cos(v) * 0.9,
        ang,
        u, v
      });
    }

    let progress = 0; let playing = true; let lastT = performance.now();
    canvas._setProgress = p => progress = p;
    canvas._togglePlay = () => { playing = !playing; lastT = performance.now(); return playing; };
    canvas._isPlaying = () => playing;
    canvas._getProgress = () => progress;

    function draw(t) {
      const dt = t - lastT; lastT = t;
      if (playing) progress = (progress + dt * 0.00010) % 1;
      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      const yaw = progress * Math.PI * 2 * 0.5;
      const pitch = -0.3;
      const projected = pts.map(pt => {
        const r = rot3(pt, yaw, pitch);
        return { pt, p: proj(r, W, H, 3.6) };
      }).sort((a, b) => b.p.depth - a.p.depth);

      for (const { pt, p } of projected) {
        // measured fraction: a wedge centered at u=0 widening with progress
        const measuredAngle = progress * Math.PI * 1.6;
        const du = ((pt.u + Math.PI) % (Math.PI * 2)) - Math.PI;
        const measured = Math.abs(du) < measuredAngle;
        const sz = 3.2 * p.scale;
        let color = measured ? 'oklch(0.62 0.13 240)' : 'oklch(0.72 0.16 50)';
        const a = 0.55;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2.2);
        g.addColorStop(0, withAlpha(color, a));
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sz * 2.2, sz * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // progress bar
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 11px JetBrains Mono, monospace';
      ctx.fillText(`measured ${Math.floor(progress * 100)}%`, 14, 22);
      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.fillText(`generated ${100 - Math.floor(progress * 100)}%`, 14, 38);

      drawLegend(ctx, W - 160, H - 56, [
        ['oklch(0.72 0.16 50)', 'generated (prior)'],
        ['oklch(0.62 0.13 240)', 'measured (real)'],
      ]);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Sequence #4: Frame-0 PCA candidate search ----------
  function makePCASearch(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);

    let progress = 0, playing = true, lastT = performance.now();
    canvas._setProgress = p => progress = p;
    canvas._togglePlay = () => { playing = !playing; lastT = performance.now(); return playing; };
    canvas._isPlaying = () => playing;
    canvas._getProgress = () => progress;

    function draw(t) {
      const dt = t - lastT; lastT = t;
      if (playing) progress = (progress + dt * 0.00012) % 1;

      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      // 6 rows × 4 cols of small ellipsoid candidates
      const cols = 4, rows = 6;
      const cellW = (W - 80) / cols;
      const cellH = (H - 60) / rows;
      const offX = 60, offY = 30;
      const totalCells = cols * rows;
      const selected = Math.floor(progress * totalCells * 1.0) % totalCells;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const x = offX + c * cellW + cellW * 0.5;
          const y = offY + r * cellH + cellH * 0.5;
          const isSel = idx === selected;
          ctx.strokeStyle = isSel ? 'oklch(0.72 0.16 50)' : 'oklch(0.3 0.01 80)';
          ctx.lineWidth = isSel ? 1.5 : 1;
          ctx.strokeRect(x - cellW * 0.42, y - cellH * 0.42, cellW * 0.84, cellH * 0.84);

          // mini ellipsoid
          ctx.fillStyle = isSel ? 'oklch(0.72 0.16 50 / 0.5)' : 'oklch(0.6 0.13 240 / 0.35)';
          ctx.beginPath();
          ctx.ellipse(x, y, cellW * 0.18, cellH * 0.28, ((r + c) * 0.4) % Math.PI, 0, Math.PI * 2);
          ctx.fill();

          // axes
          const ax = ((idx * 31) % 360) * Math.PI / 180;
          const ay = ((idx * 17) % 360) * Math.PI / 180;
          ctx.strokeStyle = isSel ? 'oklch(0.72 0.16 50)' : 'oklch(0.5 0.005 80)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ax) * cellW * 0.18, y + Math.sin(ax) * cellH * 0.2);
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ay) * cellW * 0.14, y + Math.sin(ay) * cellH * 0.16);
          ctx.stroke();

          // cost label
          ctx.fillStyle = isSel ? 'oklch(0.72 0.16 50)' : 'oklch(0.55 0.005 80)';
          ctx.font = '500 9px JetBrains Mono, monospace';
          ctx.fillText(`R${idx + 1}`, x - cellW * 0.4, y - cellH * 0.32);
        }
      }

      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 11px JetBrains Mono, monospace';
      ctx.fillText('arg min ϕ(Rk)', 14, 18);
      ctx.fillStyle = 'oklch(0.72 0.16 50)';
      ctx.fillText(`R${selected + 1} selected`, 14, H - 12);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Failure: thin/transparent object ----------
  function makeFailureThin(canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);
    let t0 = performance.now();
    function draw(t) {
      const u = ((t - t0) / 5000) % 1;
      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      // Thin "wire" object: ground truth as line
      ctx.strokeStyle = 'oklch(0.7 0.005 80 / 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      const cx = W * 0.5, cy = H * 0.55;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const x = cx + Math.cos(a + u * 0.5) * 60;
        const y = cy + Math.sin(a + u * 0.5) * 30 - Math.cos(a*2)*8;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Sparse, scattered splats trying to fit a wire
      for (let i = 0; i < 40; i++) {
        const a = i * 0.16 + u * 1.2;
        const r = 60 + Math.sin(i * 1.7 + u * 6) * 28;
        const x = cx + Math.cos(a) * r + (Math.sin(i * 9.1) * 20);
        const y = cy + Math.sin(a) * r * 0.5 + (Math.cos(i * 7.3) * 14);
        const sz = 4 + Math.sin(i + u * 4) * 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 2);
        g.addColorStop(0, 'oklch(0.62 0.13 240 / 0.5)');
        g.addColorStop(1, 'oklch(0.62 0.13 240 / 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, sz * 2, sz * 1.2, 0, 0, Math.PI*2); ctx.fill();
      }

      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText('GT (dashed)', 12, 18);
      ctx.fillStyle = 'oklch(0.62 0.13 240)';
      ctx.fillText('splats — bias outside wire', 12, 32);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Failure: ICP rejection / large motion ----------
  function makeFailureICP(canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);
    let t0 = performance.now();
    function draw(t) {
      const u = ((t - t0) / 4000) % 1;
      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      const cx = W * 0.5, cy = H * 0.55;

      // Frame t-1 cloud (faded)
      ctx.fillStyle = 'oklch(0.55 0.13 240 / 0.4)';
      const rng = mulberry32(7);
      for (let i = 0; i < 60; i++) {
        const x = cx - 60 + (rng() - 0.5) * 80;
        const y = cy + (rng() - 0.5) * 60;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
      }

      // Frame t cloud (lurched)
      const lurch = u < 0.5 ? u * 2 : 1 - (u - 0.5) * 2;
      const dx = lurch * 80;
      ctx.fillStyle = 'oklch(0.72 0.16 50 / 0.55)';
      const rng2 = mulberry32(11);
      for (let i = 0; i < 60; i++) {
        const x = cx - 60 + dx + (rng2() - 0.5) * 80;
        const y = cy - 20 * lurch + (rng2() - 0.5) * 60;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
      }

      // Status box
      const trans = lurch * 80;
      const rejected = trans > 50;
      ctx.fillStyle = 'oklch(0.18 0.01 80)';
      ctx.strokeStyle = rejected ? 'oklch(0.62 0.18 25)' : 'oklch(0.5 0.12 145)';
      ctx.lineWidth = 1;
      ctx.fillRect(W - 168, 12, 156, 76);
      ctx.strokeRect(W - 168, 12, 156, 76);
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText('ICP gates', W - 162, 26);
      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.fillText(`Δt = ${Math.round(trans)} mm`, W - 162, 42);
      ctx.fillStyle = trans > 50 ? 'oklch(0.62 0.18 25)' : 'oklch(0.5 0.12 145)';
      ctx.fillText(`gate Δt ≤ 50 mm: ${trans <= 50 ? 'pass' : 'FAIL'}`, W - 162, 58);
      ctx.fillStyle = 'oklch(0.5 0.12 145)';
      ctx.fillText(`fitness 0.34: pass`, W - 162, 74);

      ctx.fillStyle = rejected ? 'oklch(0.62 0.18 25)' : 'oklch(0.7 0.005 80)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText(rejected ? '↳ fall back to temporal prior' : '↳ ICP accepted', 12, H - 14);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- Failure: Mask drift ----------
  function makeFailureMask(canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize(); new ResizeObserver(resize).observe(canvas);
    let t0 = performance.now();
    function draw(t) {
      const u = ((t - t0) / 5000) % 1;
      ctx.fillStyle = 'oklch(0.16 0.008 80)';
      ctx.fillRect(0, 0, W, H);

      const cx = W * 0.5, cy = H * 0.55;

      // Object outline
      ctx.fillStyle = 'oklch(0.4 0.05 80 / 0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70, 50, 0, 0, Math.PI*2); ctx.fill();

      // Drifting mask boundary
      const drift = Math.sin(u * Math.PI * 2);
      ctx.strokeStyle = 'oklch(0.72 0.16 50)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(cx + drift * 30, cy + drift * 15, 70 + drift * 25, 50 + drift * 20, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sensor glow region
      ctx.fillStyle = 'oklch(0.85 0.12 80 / 0.55)';
      ctx.beginPath(); ctx.arc(cx + 90, cy - 15, 18, 0, Math.PI*2); ctx.fill();

      // Mask area: median area gauge
      ctx.fillStyle = 'oklch(0.18 0.01 80)';
      ctx.fillRect(W - 168, 12, 156, 56);
      ctx.strokeStyle = 'oklch(0.3 0.01 80)';
      ctx.strokeRect(W - 168, 12, 156, 56);
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText('mask area / median', W - 162, 26);
      ctx.fillStyle = 'oklch(0.6 0.005 80)';
      const ratio = 1 + drift * 0.4;
      ctx.fillText(`ratio ${ratio.toFixed(2)}×`, W - 162, 42);
      // bar
      ctx.fillStyle = 'oklch(0.3 0.01 80)';
      ctx.fillRect(W - 162, 50, 144, 6);
      ctx.fillStyle = ratio > 1.3 || ratio < 0.7 ? 'oklch(0.62 0.18 25)' : 'oklch(0.5 0.12 145)';
      ctx.fillRect(W - 162, 50, Math.min(144, ratio * 72), 6);

      ctx.fillStyle = 'oklch(0.7 0.005 80)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText('GT mask (gray) vs SAM proposal (orange dashed)', 12, H - 14);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------- legend helper ----------
  function drawLegend(ctx, x, y, items) {
    ctx.font = '500 10px JetBrains Mono, monospace';
    ctx.fillStyle = 'oklch(0.16 0.008 80 / 0.7)';
    ctx.fillRect(x, y, 150, items.length * 18 + 8);
    items.forEach((item, i) => {
      ctx.fillStyle = item[0];
      ctx.beginPath(); ctx.arc(x + 10, y + 12 + i * 18, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'oklch(0.85 0.005 80)';
      ctx.fillText(item[1], x + 22, y + 16 + i * 18);
    });
  }

  // Expose globally
  window.GFViz = {
    reconstruction: makeReconstructionSeq,
    poseTracking: makePoseTracking,
    progReplace: makeProgReplace,
    pcaSearch: makePCASearch,
    failureThin: makeFailureThin,
    failureICP: makeFailureICP,
    failureMask: makeFailureMask,
  };
})();
