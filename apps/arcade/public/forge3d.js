/* $FORGE · arena renderer (Three.js / WebGL).
   The simulation in game.js stays 2D (960×552); this layer reads a snapshot every frame and
   renders it as a 3D scene: a tilted camera over a living grid floor, a deep void with slow
   structures underneath, physical-ish materials, pooled particles and debris, and cinematic
   transitions driven by game events. Falls back silently (Forge3D.ready = false) if WebGL fails. */
(function () {
  "use strict";
  const THREE = window.THREE, F = window.ForgeModels;
  const Forge3D = { ready: false, quality: 2 };
  window.Forge3D = Forge3D;
  if (!THREE || !F) return;

  const W = 960, H = 552, HW = W / 2, HH = H / 2;
  const toWorld = (x, y, out) => (out || new THREE.Vector3()).set(x - HW, 0, y - HH);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rand = (a, b) => a + Math.random() * (b - a);
  // critically-damped spring on a number
  function spring(s, target, k, dt) { const f = k * k, d = 2 * k; s.v += (f * (target - s.x) - d * s.v) * dt; s.x += s.v * dt; return s.x; }

  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const SIGNAL = new THREE.Color(0xff3a1e), WHITE = new THREE.Color(0xffffff);
  const MAP_ACCENT = { rust: 0xd98c5f, neon: 0xe59bdc, abyss: 0x78d6ff, orbit: 0xb9a6ff };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer, scene, camera, composer, bloomPass, finalPass, wrap, glCanvas;
  let clock = 0, lastNow = 0, mapId = "rust";
  const accent = new THREE.Color(MAP_ACCENT.rust), accentTarget = new THREE.Color(MAP_ACCENT.rust);
  let hemi, key, rim, playerLight, flashLights = [];
  let floorMat, voidPlate, border, ticks, dustUp, dustDown, abyssGroups = {}, abyssActive = null;
  let hazardMesh, hazardMat, laneMeshes = [], beamPool = [];
  const ripples = []; for (let i = 0; i < 8; i++) ripples.push(new THREE.Vector4(0, 0, -99, 0));
  let rippleIdx = 0;

  // ------------------------------------------------------------------ setup
  Forge3D.init = function (canvasWrap) {
    try {
      wrap = canvasWrap;
      glCanvas = document.createElement("canvas"); glCanvas.className = "game3d"; glCanvas.setAttribute("aria-hidden", "true");
      wrap.insertBefore(glCanvas, wrap.firstChild);
      renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance", alpha: false });
      renderer.setClearColor(0x060607, 1);
      renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping;
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0a0a0b, .00046);
      scene.environment = F.studioEnvironment(renderer, 0xcfd8ff);
      camera = new THREE.PerspectiveCamera(32, W / H, 10, 6000);
      buildLights(); buildFloor(); buildAbyss(); buildDust(); buildPools(); buildHazard(); buildPost();
      fitCamera(); resize();
      new ResizeObserver(resize).observe(wrap);
      wrap.addEventListener("pointermove", (e) => { const r = wrap.getBoundingClientRect(); cursor.tx = ((e.clientX - r.left) / r.width - .5) * 2; cursor.ty = ((e.clientY - r.top) / r.height - .5) * 2; });
      wrap.addEventListener("pointerleave", () => { cursor.tx = 0; cursor.ty = 0; });
      glCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); Forge3D.ready = false; });
      Forge3D.ready = true;
      lastNow = performance.now();
      return true;
    } catch (err) {
      console.warn("Forge3D disabled:", err && err.message);
      if (glCanvas) glCanvas.remove();
      Forge3D.ready = false; return false;
    }
  };

  function resize() {
    if (!renderer || !wrap) return;
    const w = wrap.clientWidth || W, h = Math.round(w * H / W);
    const pr = [1, 1.25, Math.min(window.devicePixelRatio || 1, 1.75)][Forge3D.quality];
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    glCanvas.style.width = "100%"; glCanvas.style.height = "100%";
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
    if (bloomPass) bloomPass.resolution.set(w * pr * .5, h * pr * .5);
  }

  // Camera: tilted ~24° from vertical, distance solved so the whole 960×552 field plus a margin
  // stays on screen. Everything else (follow, parallax, shake, cinematics) is an offset on this pose.
  const camBase = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 0, 14) };
  const tilt = 0.42;
  function fitCamera() {
    const dir = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt)).normalize();
    const corners = [[-HW - 24, -HH - 30], [HW + 24, -HH - 30], [-HW - 24, HH + 22], [HW + 24, HH + 22]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let d = 700; d < 3000; d += 8) {
      camera.position.copy(camBase.target).addScaledVector(dir, d); camera.lookAt(camBase.target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      if (corners.every((c) => { const p = c.clone().project(camera); return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; })) { camBase.pos.copy(camera.position); return; }
    }
    camBase.pos.copy(camera.position);
  }

  function buildLights() {
    hemi = new THREE.HemisphereLight(0xb8c0d0, 0x050506, .55); scene.add(hemi);
    key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-420, 900, -260); scene.add(key);
    rim = new THREE.DirectionalLight(MAP_ACCENT.rust, .9); rim.position.set(520, 200, 700); scene.add(rim);
    playerLight = new THREE.PointLight(0xcfe6ff, 0, 220, 2); scene.add(playerLight);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 300, 2); l.userData.life = 0; scene.add(l); flashLights.push(l); }
  }

  // ------------------------------------------------------------------ floor
  function buildFloor() {
    floorMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAccent: { value: new THREE.Color() }, uPlayer: { value: new THREE.Vector2() }, uRipples: { value: ripples }, uIntensity: { value: 0 }, uFlash: { value: 0 }, uBoss: { value: 0 }, uBossColor: { value: new THREE.Color(0xff4a2e) }, uIgnite: { value: 1 } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `
        uniform float uTime, uIntensity, uFlash, uBoss, uIgnite; uniform vec3 uAccent, uBossColor; uniform vec2 uPlayer; uniform vec4 uRipples[8]; varying vec3 vW;
        float line(vec2 p, float cell, float w){ vec2 q = p / cell; vec2 g = abs(fract(q - .5) - .5) / fwidth(q); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
        float dots(vec2 p, float cell){ vec2 q = fract(p / cell) - .5; return smoothstep(.06, .0, length(q)); }
        void main(){
          vec2 p = vW.xz;
          vec2 q = abs(p) - vec2(480., 276.); float out_ = max(q.x, q.y);
          float inside = 1.0 - smoothstep(0., 220., out_);
          float major = line(p, 96., 1.1), minor = line(p, 24., .8), d = dots(p, 24.) * .6;
          float near = exp(-length(p - uPlayer) / 230.);
          float rip = 0.0;
          for (int i = 0; i < 8; i++) { vec4 r = uRipples[i]; float age = uTime - r.z; if (age > 0.0 && age < 1.8) { float rad = age * 560.; float band = exp(-pow((length(p - r.xy) - rad) / 22., 2.)); rip += band * pow(1. - age / 1.8, 2.) * r.w; } }
          float ignite = smoothstep(uIgnite * 1300. - 160., uIgnite * 1300., length(p)) ;
          float a = (minor * .045 + d * .05 + major * .11) * (.25 + .75 * inside) * (.8 + .5 * uIntensity);
          a += major * near * .22 * inside;
          a += (major * .9 + minor * .25) * min(rip, 1.2) * .38;
          a += major * uFlash * .35 * inside;
          float scan = exp(-pow((p.y + 700. - mod(uTime * 70., 1400.)) / 34., 2.)) * inside;
          a += scan * (major * .35 + minor * .12);
          a *= (1.0 - ignite);
          vec3 col = mix(vec3(.78, .81, .88), uAccent, .4 + .25 * uIntensity);
          col = mix(col, uBossColor, uBoss * .55);
          gl_FragColor = vec4(col * a * 1.4, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    floorMat.extensions = { derivatives: true };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3200, 2400), floorMat); floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; scene.add(floor);
    // a darkened glass plate under the field: keeps combat calm while the void stays visible through it
    const plateMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: .74 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uAlpha; varying vec2 vUv; void main(){ vec2 q = abs(vUv - .5) * 2.; float e = max(smoothstep(.86, 1., q.x), smoothstep(.8, 1., q.y)); float pool = smoothstep(1.1, .0, length((vUv - .5) * vec2(1.6, 1.))); vec3 c = mix(vec3(.0016,.0017,.002), vec3(.012,.013,.016), pool); gl_FragColor = vec4(c, uAlpha * (1. - e)); }",
      transparent: true, depthWrite: false,
    });
    voidPlate = new THREE.Mesh(new THREE.PlaneGeometry(1240, 760), plateMat); voidPlate.rotation.x = -Math.PI / 2; voidPlate.position.y = -1; voidPlate.renderOrder = 1; scene.add(voidPlate);
    // border: hairline frame, bright corner brackets, instrument ticks
    const pts = [], add = (a, b) => pts.push(a[0] - HW, .4, a[1] - HH, b[0] - HW, .4, b[1] - HH);
    add([0, 0], [W, 0]); add([W, 0], [W, H]); add([W, H], [0, H]); add([0, H], [0, 0]);
    const gb = new THREE.BufferGeometry(); gb.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    border = new THREE.LineSegments(gb, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .14, toneMapped: false })); scene.add(border);
    const c = [], L = 34, cor = (x, y, sx, sy) => { c.push(x - HW, .5, y - HH, x - HW + sx * L, .5, y - HH, x - HW, .5, y - HH, x - HW, .5, y - HH + sy * L); };
    cor(0, 0, 1, 1); cor(W, 0, -1, 1); cor(0, H, 1, -1); cor(W, H, -1, -1);
    for (let x = 96; x < W; x += 96) { c.push(x - HW, .5, -HH, x - HW, .5, -HH + 6, x - HW, .5, HH, x - HW, .5, HH - 6); }
    for (let y = 96; y < H; y += 96) { c.push(-HW, .5, y - HH, -HW + 6, .5, y - HH, HW, .5, y - HH, HW - 6, .5, y - HH); }
    const gt = new THREE.BufferGeometry(); gt.setAttribute("position", new THREE.Float32BufferAttribute(c, 3));
    ticks = new THREE.LineSegments(gt, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, toneMapped: false })); scene.add(ticks);
  }
  function ripple(x, y, strength = 1) { const r = ripples[rippleIdx++ % ripples.length]; r.set(x - HW, y - HH, clock, strength); }

  // ------------------------------------------------------------------ the void below
  // Elegant light geometry: thin additive edges that read like the wireframe studies on the reference,
  // plus dark faceted masses that catch the rim light. All of it sits deep under the glass field.
  const lineMats = [];
  function edges(geo, opacity = .35, thresh = 1) {
    const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
    m.userData.base = opacity; lineMats.push(m);
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, thresh), m);
  }
  function circleLine(r, opacity = .3, seg = 128, arc = Math.PI * 2) {
    const pts = []; for (let i = 0; i <= seg; i++) { const a = i / seg * arc; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }); m.userData.base = opacity; lineMats.push(m);
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
  }
  function buildAbyss() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: .85, roughness: .32, flatShading: true });
    const mk = (id) => { const g = new THREE.Group(); g.visible = false; g.userData.fade = 0; g.userData.lines = []; scene.add(g); abyssGroups[id] = g; return g; };
    const track = (g, o) => { g.add(o); if (o.material && o.material.isLineBasicMaterial) g.userData.lines.push(o.material); return o; };
    // RUST BELT: a vast wire dodecahedron turning over drifting slag
    { const g = mk("rust");
      const dod = track(g, edges(new THREE.DodecahedronGeometry(560, 0), .32)); dod.position.set(0, -1250, -160);
      const inner = track(g, edges(new THREE.IcosahedronGeometry(300, 0), .18)); inner.position.copy(dod.position);
      const rocks = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = rand(420, 820), m = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(22, 70), 0), dark); m.position.set(Math.cos(a) * rr, rand(-900, -320), Math.sin(a) * rr * .7 - 120); m.rotation.set(rand(0, 6), rand(0, 6), 0); m.userData.w = rand(-.3, .3); g.add(m); rocks.push(m); }
      g.userData.spin = [dod, inner]; g.userData.rocks = rocks; }
    // NEON GARDENS: a gyroscope of chrome hoops with light rings
    { const g = mk("neon"); const rings = [];
      for (let i = 0; i < 4; i++) { const r = new THREE.Group(); r.position.set(0, -1050, -260); const hoop = new THREE.Mesh(new THREE.TorusGeometry(470 - i * 90, 4, 6, 180), F.materials().chrome); r.add(hoop); const line = circleLine(470 - i * 90 + 14, .3); line.rotation.x = Math.PI / 2; r.add(line); g.userData.lines.push(line.material); g.add(r); rings.push(r); }
      const knot = track(g, edges(new THREE.TorusKnotGeometry(120, 34, 90, 8, 2, 3), .25, 20)); knot.position.set(0, -1050, -260);
      g.userData.rings = rings; g.userData.spin = [knot]; }
    // ABYSS REACTOR: a tunnel of light rings falling to a vanishing point
    { const g = mk("abyss"); const segs = [];
      for (let i = 0; i < 16; i++) { const arc = i % 3 === 0 ? Math.PI * 2 : Math.PI * (1.1 + (i % 2) * .5); const l = circleLine(520, .42 - i * .018, 160, arc); l.position.set(0, -260 - i * 170, -100); l.rotation.y = i * .8; g.add(l); g.userData.lines.push(l.material); segs.push(l); }
      const core = track(g, edges(new THREE.OctahedronGeometry(90, 0), .5)); core.position.set(0, -2900, -100);
      g.userData.segs = segs; g.userData.spin = [core]; }
    // ORBIT OF SILENCE: a faceted planet drawn in light, with a debris ring
    { const g = mk("orbit"); const planet = new THREE.Group(); planet.position.set(280, -1500, -560); g.add(planet);
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(430, 1), dark); planet.add(body);
      const wire = edges(new THREE.IcosahedronGeometry(436, 1), .22); planet.add(wire); g.userData.lines.push(wire.material);
      const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(16, 0), dark, 110), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      for (let i = 0; i < 110; i++) { const a = i / 110 * Math.PI * 2, rr = rand(640, 760); q.setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6))); sc.setScalar(rand(.5, 1.9)); m.compose(new THREE.Vector3(Math.cos(a) * rr, rand(-24, 24), Math.sin(a) * rr), q, sc); shards.setMatrixAt(i, m); }
      const ringGroup = new THREE.Group(); ringGroup.position.copy(planet.position); ringGroup.rotation.set(.35, 0, .25); ringGroup.add(shards);
      const orbitLine = circleLine(700, .3, 200); ringGroup.add(orbitLine); g.userData.lines.push(orbitLine.material); g.add(ringGroup);
      g.userData.spin = [planet]; g.userData.orbitRing = ringGroup; }
  }
  function setMap(id) {
    if (id === mapId && abyssActive) return;
    mapId = id; accentTarget.set(MAP_ACCENT[id] || MAP_ACCENT.rust);
    Object.entries(abyssGroups).forEach(([k, g]) => { g.userData.target = k === id ? 1 : 0; if (k === id) g.visible = true; });
    abyssActive = abyssGroups[id];
  }
  function updateAbyss(dt, intensity) {
    const sp = .4 + intensity * .8;
    Object.values(abyssGroups).forEach((g) => {
      g.userData.fade = damp(g.userData.fade, g.userData.target || 0, 1.6, dt);
      g.position.y = (1 - g.userData.fade) * -700; g.visible = g.userData.fade > .01;
      g.scale.setScalar(.85 + .15 * g.userData.fade);
      (g.userData.spin || []).forEach((m, i) => { m.rotation.y += dt * .05 * sp * (i % 2 ? -1 : 1); m.rotation.x += dt * .02 * sp; });
      (g.userData.rings || []).forEach((r, i) => { r.rotation.x += dt * (.06 + i * .03) * sp; r.rotation.y += dt * (.04 + i * .02) * sp * (i % 2 ? -1 : 1); });
      (g.userData.segs || []).forEach((r, i) => { r.rotation.z += dt * .08 * sp * (i % 2 ? -1 : 1); });
      if (g.userData.orbitRing) g.userData.orbitRing.rotation.y += dt * .04 * sp;
      (g.userData.rocks || []).forEach((r) => { r.rotation.x += dt * r.userData.w; r.rotation.y += dt * r.userData.w * .7; r.position.y += Math.sin(clock * .3 + r.id) * dt * 4; });
      g.userData.lines.forEach((m) => { m.opacity = m.userData.base * g.userData.fade * (1 + intensity * .5); m.color.copy(accent).lerp(WHITE, .45); });
    });
  }

  // ------------------------------------------------------------------ atmosphere
  let dustSpeed = 1;
  function pointsMaterial(size, opacity) {
    return new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uOpacity: { value: opacity }, uScale: { value: 1 }, uColor: { value: new THREE.Color(0xdfe6f2) } },
      vertexShader: "attribute float aSeed; uniform float uSize, uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uScale * (300.0 / -mv.z) * (.6 + aSeed); vA = .4 + .6 * aSeed; }",
      fragmentShader: "uniform float uOpacity; uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(uColor * a * uOpacity * vA, a * uOpacity * vA); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }
  function buildDust() {
    const mkDust = (n, y0, y1, spread, size, op) => {
      const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { p[i * 3] = rand(-spread, spread); p[i * 3 + 1] = rand(y0, y1); p[i * 3 + 2] = rand(-spread * .75, spread * .75); s[i] = Math.random(); }
      g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
      const pts = new THREE.Points(g, pointsMaterial(size, op)); pts.userData = { y0, y1 }; pts.frustumCulled = false; scene.add(pts); return pts;
    };
    dustDown = mkDust(1600, -1600, -40, 1500, 7, .8);
    dustUp = mkDust(140, 30, 220, 640, 2.4, .35);
  }
  function updateDust(dt) {
    [dustDown, dustUp].forEach((d, k) => {
      const p = d.geometry.attributes.position, a = p.array, rise = (k ? 6 : 26) * dustSpeed * dt;
      for (let i = 0; i < p.count; i++) { a[i * 3 + 1] += rise * (.5 + (i % 7) / 7); a[i * 3] += Math.sin(clock * .2 + i) * dt * 3; if (a[i * 3 + 1] > d.userData.y1) a[i * 3 + 1] = d.userData.y0; }
      p.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------------ pools: particles, debris, rings, glow points
  const SPARK_N = 1400, FRAG_N = 520, HOT_N = 160, GLOW_N = 1400;
  let sparks, sparkData, frags, fragData, hots, hotData, glow, glowCount = 0, rings = [], sparkCursor = 0, fragCursor = 0, hotCursor = 0;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
  function buildPools() {
    // sparks: additive points with velocity and drag
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARK_N * 3), 3)); sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SPARK_N * 3), 3)); sg.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(SPARK_N), 1));
    sparks = new THREE.Points(sg, new THREE.ShaderMaterial({
      vertexShader: "attribute float aSize; attribute vec3 color; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * (900.0 / -mv.z); }",
      fragmentShader: "varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a *= a; gl_FragColor = vec4(vC * a * 2.2, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sparks.frustumCulled = false; scene.add(sparks);
    sparkData = Array.from({ length: SPARK_N }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, s: 2 }));
    // debris: faceted obsidian fragments that tumble and fall through the grid into the void
    frags = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), F.materials().obsidian.clone(), FRAG_N); frags.instanceMatrix.setUsage(THREE.DynamicDrawUsage); frags.frustumCulled = false; scene.add(frags);
    frags.material.flatShading = true;
    fragData = Array.from({ length: FRAG_N }, () => ({ life: 0, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 1 }));
    for (let i = 0; i < FRAG_N; i++) { tmpM.makeScale(0, 0, 0); frags.setMatrixAt(i, tmpM); }
    // hot shards: emissive slivers that burn out
    hots = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), HOT_N); hots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hots.frustumCulled = false; scene.add(hots);
    hots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(HOT_N * 3), 3);
    hotData = Array.from({ length: HOT_N }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, rot: 0 }));
    for (let i = 0; i < HOT_N; i++) { tmpM.makeScale(0, 0, 0); hots.setMatrixAt(i, tmpM); }
    // floor rings (shockwaves)
    const ringMatBase = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uP: { value: 0 }, uW: { value: .04 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uColor; uniform float uP, uW; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.; float band = exp(-pow((r - uP) / uW, 2.)); float a = band * (1. - uP) ; a += smoothstep(uP, 0., r) * .05 * (1. - uP); gl_FragColor = vec4(uColor * a * 1.8, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMatBase.clone()); m.rotation.x = -Math.PI / 2; m.position.y = 1.5; m.visible = false; m.renderOrder = 3; m.userData = { life: 0, max: 1, size: 100 }; scene.add(m); rings.push(m); }
    // glow points: a single additive Points cloud for every luminous thing (shots, cores, pickups)
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(GLOW_N * 3), 3)); gg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GLOW_N * 3), 3)); gg.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(GLOW_N), 1));
    glow = new THREE.Points(gg, sparks.material.clone()); glow.material.fragmentShader = "varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a = a * a * a; gl_FragColor = vec4(vC * a * 1.4, a); }";
    glow.frustumCulled = false; scene.add(glow);
    buildProjectiles(); buildShadows();
  }
  function spark(x, y, z, color, n = 8, power = 1, dir = null, spread = Math.PI) {
    tmpC.set(color);
    for (let k = 0; k < n; k++) {
      const p = sparkData[sparkCursor = (sparkCursor + 1) % SPARK_N];
      const base = dir == null ? rand(0, Math.PI * 2) : dir + rand(-spread, spread), sp = rand(120, 420) * power;
      p.x = x; p.y = z; p.z = y; p.vx = Math.cos(base) * sp; p.vz = Math.sin(base) * sp; p.vy = rand(40, 260) * power;
      p.life = p.max = rand(.25, .7); p.r = tmpC.r; p.g = tmpC.g; p.b = tmpC.b; p.s = rand(1.4, 3.4);
    }
  }
  function debris(x, y, z, n, size, power = 1, hotColor = null) {
    for (let k = 0; k < n; k++) {
      const f = fragData[fragCursor = (fragCursor + 1) % FRAG_N];
      const a = rand(0, Math.PI * 2), sp = rand(60, 340) * power;
      f.x = x + rand(-size, size) * .3; f.z = y + rand(-size, size) * .3; f.y = z + rand(0, size * .4);
      f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp; f.vy = rand(80, 360) * power; f.life = 6;
      f.rx = rand(0, 6); f.ry = rand(0, 6); f.rz = rand(0, 6); f.wx = rand(-9, 9); f.wy = rand(-9, 9); f.wz = rand(-9, 9); f.s = size * rand(.12, .32);
    }
    if (hotColor != null) { tmpC.set(hotColor); for (let k = 0; k < Math.ceil(n / 2); k++) { const hi = hotCursor = (hotCursor + 1) % HOT_N, h = hotData[hi]; const a = rand(0, 6.28), sp = rand(120, 520) * power; h.x = x; h.z = y; h.y = z; h.vx = Math.cos(a) * sp; h.vz = Math.sin(a) * sp; h.vy = rand(60, 300) * power; h.life = h.max = rand(.3, .8); h.s = size * rand(.05, .14); h.rot = rand(0, 6); hots.instanceColor.setXYZ(hi, tmpC.r * 2, tmpC.g * 2, tmpC.b * 2); } hots.instanceColor.needsUpdate = true; }
  }
  function ring(x, y, color, size, life = .5, width = .04) {
    const m = rings.find((r) => !r.visible) || rings[0];
    m.visible = true; m.position.x = x - HW; m.position.z = y - HH; m.scale.setScalar(size); m.userData.life = m.userData.max = life; m.material.uniforms.uColor.value.set(color); m.material.uniforms.uW.value = width; m.material.uniforms.uP.value = 0;
  }
  function flash(x, y, color, intensity = 2.5, life = .35, dist = 320) {
    const l = flashLights.reduce((a, b) => (a.userData.life < b.userData.life ? a : b));
    l.position.set(x - HW, 40, y - HH); l.color.set(color); l.userData.peak = intensity; l.userData.life = l.userData.max = life; l.distance = dist;
  }
  function updatePools(dt) {
    // sparks
    const sp = sparks.geometry.attributes, pa = sp.position.array, ca = sp.color.array, sa = sp.aSize.array;
    for (let i = 0; i < SPARK_N; i++) {
      const p = sparkData[i];
      if (p.life > 0) { p.life -= dt; p.vx *= Math.pow(.04, dt); p.vz *= Math.pow(.04, dt); p.vy -= 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = Math.max(0, p.life / p.max); pa[i * 3] = p.x - HW; pa[i * 3 + 1] = Math.max(.5, p.y); pa[i * 3 + 2] = p.z - HH; ca[i * 3] = p.r * k; ca[i * 3 + 1] = p.g * k; ca[i * 3 + 2] = p.b * k; sa[i] = p.s * (.4 + .6 * k); }
      else sa[i] = 0;
    }
    sp.position.needsUpdate = sp.color.needsUpdate = sp.aSize.needsUpdate = true;
    // debris
    for (let i = 0; i < FRAG_N; i++) {
      const f = fragData[i]; if (f.life <= 0) continue;
      f.life -= dt; f.vy -= 900 * dt; f.vx *= Math.pow(.5, dt); f.vz *= Math.pow(.5, dt);
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.rx += f.wx * dt; f.ry += f.wy * dt; f.rz += f.wz * dt;
      if (f.y < -1400) f.life = 0;
      tmpQ.setFromEuler(tmpE.set(f.rx, f.ry, f.rz)); tmpS.setScalar(f.life > 0 ? f.s : 0);
      tmpM.compose(tmpV.set(f.x - HW, f.y, f.z - HH), tmpQ, tmpS); frags.setMatrixAt(i, tmpM);
    }
    frags.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < HOT_N; i++) {
      const h = hotData[i]; if (h.life <= 0) { continue; }
      h.life -= dt; h.vy -= 600 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.rot += dt * 8;
      const k = Math.max(0, h.life / h.max); tmpQ.setFromEuler(tmpE.set(h.rot, h.rot * .7, 0)); tmpS.set(h.s * k, h.s * k, h.s * k * 3);
      tmpM.compose(tmpV.set(h.x - HW, Math.max(1, h.y), h.z - HH), tmpQ, tmpS); hots.setMatrixAt(i, tmpM);
      if (h.life <= 0) { tmpM.makeScale(0, 0, 0); hots.setMatrixAt(i, tmpM); }
    }
    hots.instanceMatrix.needsUpdate = true;
    rings.forEach((m) => { if (!m.visible) return; m.userData.life -= dt; const t = 1 - m.userData.life / m.userData.max; m.material.uniforms.uP.value = easeOutCubic(clamp(t, 0, 1)); if (m.userData.life <= 0) m.visible = false; });
    flashLights.forEach((l) => { if (l.userData.life > 0) { l.userData.life -= dt; const k = Math.max(0, l.userData.life / l.userData.max); l.intensity = l.userData.peak * k * k; } else l.intensity = 0; });
  }

  // ------------------------------------------------------------------ projectiles & blob shadows
  const SHAPES = ["orb", "diamond", "flare", "ring", "triangle", "star", "sun", "square"];
  let shotMeshes = {}, enemyShots, streaks, shardsMesh, shadowMesh;
  const SHOT_N = 260;
  function buildProjectiles() {
    SHAPES.forEach((s) => { const m = new THREE.InstancedMesh(F.projectileGeometry(s), new THREE.MeshBasicMaterial({ toneMapped: false }), SHOT_N); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOT_N * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m); shotMeshes[s] = m; });
    enemyShots = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff5a3a, toneMapped: false }), 400); enemyShots.count = 0; enemyShots.frustumCulled = false; scene.add(enemyShots);
    // streaks: flat tapered quads behind every player shot
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, .5);
    streaks = new THREE.InstancedMesh(sg, new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vC; varying vec2 vUv; void main(){\n#ifdef USE_INSTANCING_COLOR\n vC = instanceColor;\n#else\n vC = vec3(1.0);\n#endif\n vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 vC; varying vec2 vUv; void main(){ float along = vUv.y; float across = 1. - abs(vUv.x - .5) * 2.; float a = pow(along, 1.6) * pow(across, 2.); gl_FragColor = vec4(vC * a * 1.6, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), SHOT_N * 2);
    streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOT_N * 2 * 3), 3); streaks.count = 0; streaks.frustumCulled = false; scene.add(streaks);
    shardsMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(4.2, 0), F.glowMat(F.PALETTE.mint), 120); shardsMesh.count = 0; shardsMesh.frustumCulled = false; scene.add(shardsMesh);
  }
  function buildShadows() {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(.5, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    shadowMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }), 120); shadowMesh.count = 0; shadowMesh.renderOrder = 1.5; shadowMesh.frustumCulled = false; scene.add(shadowMesh);
  }
  let shadowCount = 0;
  function shadowAt(x, y, size, alt) { if (shadowCount >= 120) return; const s = size * (1 + alt * .004); tmpM.compose(tmpV.set(x - HW + alt * .18, .2, y - HH + alt * .12), tmpQ.identity(), tmpS.set(s, 1, s)); shadowMesh.setMatrixAt(shadowCount++, tmpM); }
  function glowAt(x, y, z, color, size) { if (glowCount >= GLOW_N) return; const g = glow.geometry.attributes; g.position.setXYZ(glowCount, x - HW, z, y - HH); tmpC.set(color); g.color.setXYZ(glowCount, tmpC.r, tmpC.g, tmpC.b); g.aSize.setX(glowCount, size); glowCount++; }

  // ------------------------------------------------------------------ hazards, lanes, beams
  function buildHazard() {
    hazardMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWarn: { value: 0 }, uLive: { value: 0 }, uInner: { value: .7 }, uColor: { value: new THREE.Color(0xff4a2e) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform float uTime, uWarn, uLive, uInner; uniform vec3 uColor; varying vec2 vUv;
        void main(){ vec2 p = (vUv - .5) * 2.; float r = length(p); float ang = atan(p.y, p.x);
          float band = smoothstep(uInner - .02, uInner, r) * (1. - smoothstep(.98, 1., r));
          float edge = exp(-pow((r - 1.) / .012, 2.)) + (uInner > .01 ? exp(-pow((r - uInner) / .012, 2.)) : 0.);
          float dash = step(.5, fract(ang * 12. / 6.2831 + uTime * .6));
          float a = edge * mix(dash, 1., uLive) * (uWarn * .9 + uLive) + band * (uLive * .38 + uWarn * .05 * (.5 + .5 * sin(uTime * 18.)));
          float stripes = step(.5, fract((p.x + p.y) * 8. - uTime * 2.)) * band * uLive * .12;
          gl_FragColor = vec4(uColor * (a + stripes) * 1.6, a + stripes); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    hazardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hazardMat); hazardMesh.rotation.x = -Math.PI / 2; hazardMesh.position.y = 1; hazardMesh.visible = false; hazardMesh.renderOrder = 3; scene.add(hazardMesh);
    const laneMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uK: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uTime, uK; varying vec2 vUv; void main(){ float edge = smoothstep(.0, .04, vUv.y) * smoothstep(1., .96, vUv.y); float rails = (1. - smoothstep(.0, .03, vUv.y)) + smoothstep(.97, 1., vUv.y); float chev = step(.6, fract(vUv.x * 18. - abs(vUv.y - .5) * 2. - uTime * 3.)); float fade = 1. - vUv.x; float a = (rails * .9 + chev * .22 * edge + .06) * fade * (.4 + uK * .6); gl_FragColor = vec4(vec3(1., .3, .2) * a * 1.5, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 4; i++) { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(.5, 0, 0); const m = new THREE.Mesh(g, laneMat.clone()); m.position.y = 1.2; m.visible = false; m.renderOrder = 3; scene.add(m); laneMeshes.push(m); }
    for (let i = 0; i < 12; i++) { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(.5, 0, 0); const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(F.PALETTE.violet) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){ float across = 1. - abs(vUv.y - .5) * 2.; float pulse = .5 + .5 * sin(vUv.x * 30. + uTime * 14.); float a = pow(across, 3.) * (.35 + .65 * pulse); gl_FragColor = vec4(uColor * a * 1.6, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.y = 12; m.visible = false; scene.add(m); beamPool.push(m); }
  }

  // ------------------------------------------------------------------ post-processing
  function buildPost() {
    composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 }));
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .7, .45, .62); composer.addPass(bloomPass);
    finalPass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: .0012 }, uVig: { value: .85 }, uGrain: { value: .035 }, uDesat: { value: 0 }, uFlash: { value: 0 }, uLetter: { value: 0 }, uRed: { value: 0 }, uExposure: { value: 1.05 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAberr, uVig, uGrain, uDesat, uFlash, uLetter, uRed, uExposure; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
        void main(){ vec2 uv = vUv; vec2 c = uv - .5; float d = length(c);
          vec2 off = c * uAberr * (1. + d * 2.);
          vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
          col *= uExposure; col = aces(col);
          float l = dot(col, vec3(.299, .587, .114)); col = mix(col, vec3(l), uDesat);
          col += uFlash;
          col *= mix(1., smoothstep(.98, .28, d), uVig);
          col = mix(col, col * vec3(1., .45, .4) + vec3(.16, .015, .01), uRed * smoothstep(.25, .85, d));
          col = pow(max(col, 0.), vec3(1. / 2.2));
          float n = fract(sin(dot(uv * vec2(1931.7, 1069.3) + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - .5) * uGrain;
          float lb = step(uv.y, uLetter * .11) + step(1. - uLetter * .11, uv.y); col = mix(col, vec3(0.), clamp(lb, 0., 1.));
          gl_FragColor = vec4(col, 1.); }`,
    });
    finalPass.material.toneMapped = false; composer.addPass(finalPass);
  }

  // ------------------------------------------------------------------ views (player / enemies / bosses / pickups)
  const cursor = { x: 0, y: 0, tx: 0, ty: 0 };
  const camState = { fx: { x: 0, v: 0 }, fz: { x: 0, v: 0 }, trauma: 0, zoom: { x: 1, v: 0 }, cine: null, punch: 0, roll: 0 };
  let player = null, playerSkin = -1, playerState = { yaw: { x: 0, v: 0 }, bank: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, lastVx: 0, lastVy: 0, materialize: 0, ghosts: [], scan: 0, hidden: false, deathT: 0 };
  let shield, trail, drones = [];
  const enemyViews = new Map(), enemyPool = { NOISE: [], SPOOF: [], LEECH: [], ELITE: [] };
  const bossViews = new Map();
  const pickupViews = new Map(), pickupPool = { cache: [], rapid: [], shield: [], magnet: [] };

  function ensurePlayer(skinIndex, finish) {
    const key = skinIndex + ":" + (finish || "");
    if (player && playerSkin === key) return;
    if (player) scene.remove(player);
    player = F.ship(skinIndex); if (finish && F.applyFinish) F.applyFinish(player, finish); playerSkin = key; scene.add(player);
    player.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) o.castShadow = false; });
    if (!shield) {
      shield = new THREE.Mesh(new THREE.SphereGeometry(44, 32, 20), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uHit: { value: 0 }, uOn: { value: 0 }, uColor: { value: new THREE.Color(F.PALETTE.mint) } },
        vertexShader: "varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }",
        fragmentShader: "uniform float uTime, uHit, uOn; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.6); float hex = step(.92, fract(vP.x * .09 + vP.y * .05)) + step(.92, fract(vP.z * .09 - vP.y * .05)); float wave = exp(-pow((length(vP.xz) - uHit * 70.) / 8., 2.)) * step(.001, uHit) * (1. - uHit); float a = (f * .85 + hex * f * .4 + wave * 1.5) * uOn; gl_FragColor = vec4(uColor * a * 1.5, a); }",
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      scene.add(shield);
      trail = makeTrail(34);
    }
  }
  // tapered ribbon that follows the engines
  function makeTrail(n) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), alpha = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aA", new THREE.BufferAttribute(alpha, 1)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0xcfe6ff) } }, vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: "uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA, vA); }", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
    return { mesh, pts: [], n };
  }
  function updateTrail(tr, x, y, z, speed, color) {
    tr.pts.unshift({ x, y, z }); if (tr.pts.length > tr.n) tr.pts.length = tr.n;
    const pos = tr.mesh.geometry.attributes.position.array, al = tr.mesh.geometry.attributes.aA.array;
    for (let i = 0; i < tr.n; i++) {
      const p = tr.pts[Math.min(i, tr.pts.length - 1)], q = tr.pts[Math.min(i + 1, tr.pts.length - 1)];
      let dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const t = i / (tr.n - 1), w = (1 - t) * 7 * clamp(speed / 260, .15, 1);
      pos[i * 6] = p.x - dz * w; pos[i * 6 + 1] = p.y; pos[i * 6 + 2] = p.z + dx * w; pos[i * 6 + 3] = p.x + dz * w; pos[i * 6 + 4] = p.y; pos[i * 6 + 5] = p.z - dx * w;
      const a = Math.pow(1 - t, 1.8) * .55 * clamp(speed / 200, 0, 1); al[i * 2] = al[i * 2 + 1] = a;
    }
    tr.mesh.geometry.attributes.position.needsUpdate = tr.mesh.geometry.attributes.aA.needsUpdate = true;
    tr.mesh.material.uniforms.uColor.value.set(color);
  }

  function getEnemyView(mob) {
    let v = enemyViews.get(mob); if (v) return v;
    const type = enemyPool[mob.type] ? mob.type : "NOISE";
    v = enemyPool[type].pop() || { model: F.enemy(type, Math.abs(mob.id || 0) % 2), type, yaw: { x: 0, v: 0 }, px: mob.x, py: mob.y, lost: 0 };
    v.yaw.x = Math.random() * 6; v.px = mob.x; v.py = mob.y; v.lost = 0; v.model.visible = true; scene.add(v.model);
    v.model.userData.parts.plates.forEach((p) => { p.visible = true; });
    enemyViews.set(mob, v); return v;
  }
  function releaseEnemy(mob, v) { scene.remove(v.model); enemyViews.delete(mob); enemyPool[v.type].push(v); }

  function getBossView(boss) {
    let v = bossViews.get(boss); if (v) return v;
    const kind = boss.type.style === "volley" ? 0 : boss.type.style === "charge" ? 1 : 2;
    const color = new THREE.Color(boss.type.color);
    v = { model: F.boss(kind, color.getHex()), kind, yaw: { x: 0, v: 0 }, rage: 0, open: { x: 0, v: 0 }, color, hitShake: 0, tailLag: [] };
    v.light = new THREE.PointLight(color, 3.2, 420, 1.6); scene.add(v.light);
    scene.add(v.model); bossViews.set(boss, v); return v;
  }
  function getPickupView(drop) {
    let v = pickupViews.get(drop); if (v) return v;
    const kind = drop.power || "cache";
    v = pickupPool[kind].pop() || { model: F.pickup(kind), kind };
    v.model.visible = true; scene.add(v.model); pickupViews.set(drop, v); return v;
  }

  // ------------------------------------------------------------------ public: events
  const pendingCards = [];
  Forge3D.event = function (name, d = {}) {
    if (!Forge3D.ready) return;
    const shakeK = reduceMotion ? .35 : 1;
    switch (name) {
      case "run-start":
        camState.cine = { kind: "intro", t: 0, dur: 1.5 }; playerState.materialize = 1; playerState.hidden = false; playerState.deathT = 0;
        floorMat.uniforms.uIgnite.value = 0; ripple(HW, HH, 1.4); ring(HW, HH, 0xeef3f8, 160, .9, .03); break;
      case "level": ripple(d.x ?? HW, d.y ?? HH, 1.2); floorMat.uniforms.uFlash.value = 1; break;
      case "boss-spawn": camState.cine = { kind: "boss", t: 0, dur: 2.6, x: HW, y: 120 }; ripple(HW, 120, 1.6); camState.trauma = Math.max(camState.trauma, .25 * shakeK); break;
      case "boss-rage": ripple(d.x, d.y, 1.4); flash(d.x, d.y, 0xff4a2e, 5, .6, 520); camState.trauma = Math.max(camState.trauma, .5 * shakeK); post.aberr = .006; break;
      case "boss-down":
        debris(d.x, d.y, 30, 70, 120, 1.6, d.color); spark(d.x, d.y, 30, 0xffffff, 40, 1.8); spark(d.x, d.y, 30, d.color, 50, 2);
        ring(d.x, d.y, d.color, d.size * 2.2, 1.1, .03); ring(d.x, d.y, 0xffffff, d.size * 1.3, .7, .05); ripple(d.x, d.y, 2);
        flash(d.x, d.y, d.color, 9, 1, 700); post.flash = .35; camState.trauma = Math.max(camState.trauma, .8 * shakeK); camState.punch = 1; break;
      case "kill": {
        const elite = d.type === "ELITE", core = d.color || 0xcfe3ff;
        debris(d.x, d.y, 12, elite ? 22 : 10, (d.radius || 12) * 2.2, elite ? 1.2 : .9, core);
        spark(d.x, d.y, 12, core, elite ? 22 : 10, elite ? 1.3 : .9); ring(d.x, d.y, core, (d.radius || 12) * 4.5, .4, .05);
        flash(d.x, d.y, core, elite ? 4 : 1.8, .3, elite ? 420 : 260); if (elite) ripple(d.x, d.y, .5);
        if (elite) camState.trauma = Math.max(camState.trauma, .22 * shakeK);
        break;
      }
      case "hit": spark(d.x, d.y, 12, d.color || 0xffffff, 3, .5, d.angle != null ? d.angle + Math.PI : null, .7); break;
      case "boss-hit": spark(d.x, d.y, 28, d.color || 0xffffff, 3, .7, d.angle != null ? d.angle + Math.PI : null, .6); break;
      case "shoot": playerState.recoil = 1; break;
      case "player-hit": camState.trauma = Math.max(camState.trauma, .55 * shakeK); post.aberr = .009; post.red = .9; spark(d.x, d.y, 16, 0xff4a2e, 18, 1.2); ring(d.x, d.y, 0xff4a2e, 90, .45, .05); flash(d.x, d.y, 0xff4a2e, 3, .4); playerState.glitch = 1; break;
      case "shield-pop": if (shield) shield.material.uniforms.uHit.value = .001; ring(d.x, d.y, F.PALETTE.mint, 140, .6, .04); spark(d.x, d.y, 16, F.PALETTE.mint, 20, 1.1); flash(d.x, d.y, F.PALETTE.mint, 3, .4); camState.trauma = Math.max(camState.trauma, .25 * shakeK); break;
      case "pulse": ring(d.x, d.y, 0xeef3f8, d.radius * 2.1, .7, .025); ring(d.x, d.y, accent.getHex(), d.radius * 1.5, .55, .06); ripple(d.x, d.y, 2.2); flash(d.x, d.y, 0xeef3f8, 6, .6, 600); post.flash = .18; post.aberr = .008; camState.trauma = Math.max(camState.trauma, .35 * shakeK); break;
      case "dash": playerState.ghosts.push({ t: .35, x: d.x, y: d.y, yaw: playerState.yaw.x }); break;
      case "pickup": spark(d.x, d.y, 14, d.cache ? F.PALETTE.mint : 0xdfffee, d.cache ? 22 : 7, d.cache ? 1 : .55); ring(d.x, d.y, F.PALETTE.mint, d.cache ? 120 : 46, .4, .06); if (d.cache) flash(d.x, d.y, F.PALETTE.mint, 3, .45); break;
      case "power": ring(d.x, d.y, 0xffffff, 110, .5, .04); spark(d.x, d.y, 14, 0xffffff, 18, 1); playerState.scan = 1; break;
      case "graze": spark(d.x, d.y, 14, 0xffffff, 2, .35); break;
      case "upgrade": playerState.scan = 1; ring(d.x, d.y, 0xeef3f8, 120, .7, .03); flash(d.x, d.y, 0xeef3f8, 3, .5); break;
      case "hazard": ripple(d.x, d.y, 1.1); break;
      case "death":
        playerState.hidden = true; playerState.deathT = 1.6; debris(d.x, d.y, 16, 44, 46, 1.4, 0xeef3f8); spark(d.x, d.y, 16, 0xffffff, 40, 1.6); ring(d.x, d.y, 0xff4a2e, 220, .9, .03); flash(d.x, d.y, 0xffffff, 6, .8, 600);
        post.flash = .3; camState.trauma = Math.max(camState.trauma, .9 * shakeK); camState.cine = { kind: "death", t: 0, dur: 2.2, x: d.x, y: d.y }; break;
    }
  };
  const post = { aberr: 0, flash: 0, red: 0, desat: 0, letter: 0 };

  Forge3D.project = function (x, y, alt = 0) {
    if (!Forge3D.ready) return { x, y };
    tmpV.set(x - HW, alt, y - HH).project(camera);
    return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H };
  };

  // ------------------------------------------------------------------ public: render
  let frameTimes = [], qualityTimer = 0, upgradesTried = 0;
  Forge3D.render = function (s) {
    if (!Forge3D.ready) return;
    const now = performance.now(); let dt = Math.min(.05, (now - lastNow) / 1000 || .016); lastNow = now;
    clock += dt;
    adaptQuality(dt);
    if (s.activeMap !== mapId || !abyssActive) setMap(s.activeMap || "rust");
    const playing = s.state === "playing", bossOn = s.bosses.length > 0, intensity = clamp((s.level - 1) / 8, 0, 1);
    // colours
    accent.lerp(accentTarget, 1 - Math.exp(-1.5 * dt));
    const bossCol = bossOn ? new THREE.Color(s.bosses[0].type.color) : null;
    floorMat.uniforms.uBoss.value = damp(floorMat.uniforms.uBoss.value, bossOn ? 1 : 0, 1.4, dt);
    if (bossCol) floorMat.uniforms.uBossColor.value.lerp(bossCol, 1 - Math.exp(-2 * dt));
    floorMat.uniforms.uAccent.value.copy(accent); floorMat.uniforms.uTime.value = clock; floorMat.uniforms.uIntensity.value = intensity;
    floorMat.uniforms.uFlash.value = Math.max(0, floorMat.uniforms.uFlash.value - dt * 1.6);
    floorMat.uniforms.uIgnite.value = Math.min(1, floorMat.uniforms.uIgnite.value + dt * .9);
    floorMat.uniforms.uPlayer.value.set(s.player.x - HW, s.player.y - HH);
    rim.color.copy(accent).lerp(bossCol || accent, floorMat.uniforms.uBoss.value * .7);
    hemi.intensity = .55 * (1 - .35 * floorMat.uniforms.uBoss.value);
    key.intensity = 2.4 * (1 - .25 * floorMat.uniforms.uBoss.value);
    scene.fog.color.setRGB(.0042 + .002 * intensity, .0042, .005).lerp(new THREE.Color(0x0a0302), floorMat.uniforms.uBoss.value * .35);
    renderer.setClearColor(scene.fog.color);
    dustSpeed = 1 + intensity * 1.5 + (bossOn ? 1 : 0);
    updateAbyss(dt, intensity); updateDust(dt);

    shadowCount = 0; glowCount = 0;
    updatePlayer(s, dt); updateEnemies(s, dt); updateBosses(s, dt); updateShots(s, dt); updatePickups(s, dt); updateHazard(s, dt);
    updatePools(dt);
    shadowMesh.count = shadowCount; shadowMesh.instanceMatrix.needsUpdate = true;
    const ga = glow.geometry.attributes; for (let i = glowCount; i < GLOW_N; i++) ga.aSize.setX(i, 0); ga.position.needsUpdate = ga.color.needsUpdate = ga.aSize.needsUpdate = true; glow.geometry.setDrawRange(0, Math.max(glowCount, 1));
    updateCamera(s, dt);
    // post
    post.aberr = damp(post.aberr, 0, 4, dt); post.flash = damp(post.flash, 0, 7, dt); post.red = damp(post.red, s.state === "playing" && s.health === 1 && s.maxHealth > 1 ? .25 + .15 * Math.sin(clock * 6) : 0, 3, dt);
    post.desat = damp(post.desat, s.state === "over" ? .85 : s.state === "paused" || s.state === "upgrade" ? .45 : 0, 2.5, dt);
    post.letter = damp(post.letter, camState.cine && (camState.cine.kind === "boss" || camState.cine.kind === "death") ? 1 : 0, 4, dt);
    const u = finalPass.uniforms; u.uTime.value = clock; u.uAberr.value = .0012 + post.aberr; u.uFlash.value = post.flash; u.uRed.value = post.red; u.uDesat.value = post.desat; u.uLetter.value = post.letter;
    u.uGrain.value = Forge3D.quality ? .035 : .02;
    composer.render(dt);
  };

  function updatePlayer(s, dt) {
    const skinIndex = s.skin ? s.skin.index : 1; ensurePlayer(skinIndex, s.finish); if (F.animateFinish) F.animateFinish(player, clock);
    const show = (s.state !== "menu" && s.state !== "over") && !playerState.hidden;
    const P = s.player, speed = Math.hypot(P.vx, P.vy), moving = speed > 25;
    // facing: follow travel direction with a critically damped spring on the shortest arc
    let targetYaw = playerState.yaw.x;
    if (moving) targetYaw = Math.atan2(-P.vx, -P.vy);
    let diff = targetYaw - playerState.yaw.x; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const prevYaw = playerState.yaw.x;
    spring(playerState.yaw, playerState.yaw.x + diff, 14, dt);
    const yawRate = (playerState.yaw.x - prevYaw) / Math.max(dt, 1e-3);
    // banking from turn rate, pitch from acceleration
    const ax = (P.vx - playerState.lastVx) / Math.max(dt, 1e-3), ay = (P.vy - playerState.lastVy) / Math.max(dt, 1e-3); playerState.lastVx = P.vx; playerState.lastVy = P.vy;
    const fwdX = -Math.sin(playerState.yaw.x), fwdY = -Math.cos(playerState.yaw.x), along = (ax * fwdX + ay * fwdY) / 2400;
    spring(playerState.bank, clamp(-yawRate * .16, -.75, .75), 10, dt);
    spring(playerState.pitch, clamp(along * .25, -.22, .22), 9, dt);
    const hover = 16 + Math.sin(clock * 2.1) * 1.4;
    player.visible = show;
    playerState.materialize = Math.max(0, playerState.materialize - dt * 1.2);
    const mat = 1 - playerState.materialize, scl = easeOutBack(clamp(mat, 0, 1));
    player.position.set(P.x - HW, hover + playerState.materialize * 90, P.y - HH);
    player.rotation.set(0, playerState.yaw.x, 0); const body = player.userData.body;
    body.rotation.set(playerState.pitch.x, 0, playerState.bank.x + (s.dash > 0 ? Math.sin(clock * 30) * .4 : 0));
    playerState.recoil = Math.max(0, (playerState.recoil || 0) - dt * 10); body.position.z = (playerState.recoil || 0) * 1.6;
    player.scale.setScalar(1.22 * Math.max(.001, scl) * (1 + (playerState.scan > 0 ? Math.sin(playerState.scan * Math.PI) * .06 : 0)));
    // invulnerability blink, damage glitch
    playerState.glitch = Math.max(0, (playerState.glitch || 0) - dt * 2.5);
    if (s.invulnerable > 0 && s.dash <= 0 && s.state === "playing") player.visible = show && Math.floor(clock * 16) % 2 === 0;
    if (playerState.glitch > 0) body.position.x = (Math.random() - .5) * 6 * playerState.glitch;
    else body.position.x = 0;
    // engines
    const power = clamp(.35 + speed / 240, .35, 1.4) * (s.dash > 0 ? 1.8 : 1) * (s.rapid > 0 ? 1.15 : 1);
    player.userData.flames.forEach((f, i) => { f.material.uniforms.uTime.value = clock + i; f.material.uniforms.uPower.value = .7 + .3 * Math.sin(clock * 40 + i); f.scale.set(1, 1, power * (.9 + .1 * Math.sin(clock * 50 + i * 2))); });
    playerLight.position.set(P.x - HW, 26, P.y - HH); playerLight.intensity = show ? .9 + power * .9 : 0;
    // hardpoints grow in as Forked Lancer ranks are earned
    player.userData.pods.forEach((pod, i) => { const want = i < s.splitLevel ? 1 : 0; pod.userData.s = pod.userData.s || { x: 0, v: 0 }; const v = spring(pod.userData.s, want, 12, dt); pod.visible = v > .02; pod.scale.setScalar(Math.max(.001, v)); });
    // upgrade scan: a bright seam travels along the hull
    if (playerState.scan > 0) { playerState.scan = Math.max(0, playerState.scan - dt * 1.4); player.userData.seam.scale.set(1 + playerState.scan * 3, 1 + playerState.scan * 3, 1); } else player.userData.seam.scale.set(1, 1, 1);
    // trail
    if (show) updateTrail(trail, P.x - HW + Math.sin(playerState.yaw.x) * 26, hover - 2, P.y - HH + Math.cos(playerState.yaw.x) * 26, speed * (s.dash > 0 ? 2 : 1), s.dash > 0 ? 0xffffff : 0xbfd8ff);
    trail.mesh.visible = show;
    // dash ghosts
    playerState.ghosts = playerState.ghosts.filter((g) => (g.t -= dt) > 0);
    playerState.ghosts.forEach((g) => glowAt(g.x, g.y, 16, 0xeef3f8, 26 * g.t / .35));
    // shield
    shield.visible = show && (s.shieldUp || shield.material.uniforms.uHit.value > 0);
    shield.position.copy(player.position); shield.material.uniforms.uTime.value = clock;
    shield.material.uniforms.uOn.value = damp(shield.material.uniforms.uOn.value, s.shieldUp ? 1 : 0, 6, dt);
    if (shield.material.uniforms.uHit.value > 0) { shield.material.uniforms.uHit.value += dt * 1.6; if (shield.material.uniforms.uHit.value >= 1) shield.material.uniforms.uHit.value = 0; }
    shield.scale.setScalar(1 + Math.sin(clock * 3) * .02);
    // drones orbit exactly where game.js fires from
    while (drones.length < s.droneCount) { const d = new THREE.Group(); const m = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), F.materials().chrome); d.add(m); const c = new THREE.Mesh(new THREE.OctahedronGeometry(2, 0), F.glowMat(F.PALETTE.ice)); d.add(c); scene.add(d); drones.push(d); }
    drones.forEach((d, i) => { const on = show && i < s.droneCount; d.visible = on; if (!on) return; const a = s.elapsed * 1.8 + i * Math.PI * 2 / s.droneCount; d.position.set(P.x - HW + Math.cos(a) * 34, 22 + Math.sin(clock * 3 + i) * 2, P.y - HH + Math.sin(a) * 26); d.rotation.y += dt * 3; d.rotation.x += dt * 2; glowAt(P.x + Math.cos(a) * 34, P.y + Math.sin(a) * 26, 22, 0xcfe6ff, 10); });
    if (show) { shadowAt(P.x, P.y, 70, hover); glowAt(P.x + Math.sin(playerState.yaw.x) * 30, P.y + Math.cos(playerState.yaw.x) * 30, hover, 0xcfe6ff, 22 * power); }
    if (playerState.deathT > 0) playerState.deathT -= dt;
  }

  function updateEnemies(s, dt) {
    const seen = new Set();
    for (const mob of s.enemies) {
      seen.add(mob); const v = getEnemyView(mob), parts = v.model.userData.parts, r = mob.radius;
      const age = mob.age || 0, pop = age < .45 ? easeOutBack(clamp(age / .45, 0, 1)) : 1;
      const bob = Math.sin(clock * 3 + (mob.id || 0)) * 2.4, alt = 12 + bob;
      v.model.position.set(mob.x - HW, alt + (1 - pop) * 40, mob.y - HH);
      const base = r * 1.75 * Math.max(.01, pop);
      const hit = mob.hit > 0 ? Math.min(1, mob.hit * 10) : 0;
      parts.shell.emissive.setRGB(hit * .9, hit * .9, hit * .95);
      v.model.scale.setScalar(base * (1 + hit * .12));
      const vx = (mob.x - v.px) / Math.max(dt, 1e-3), vy = (mob.y - v.py) / Math.max(dt, 1e-3); v.px = mob.x; v.py = mob.y;
      if (v.type === "SPOOF") {
        let target = Math.hypot(vx, vy) > 5 ? Math.atan2(-vx, -vy) : v.yaw.x;
        if (mob.lungeWarn > 0 && mob.lungeAngle != null) target = Math.atan2(-Math.cos(mob.lungeAngle), -Math.sin(mob.lungeAngle));
        let dd = target - v.yaw.x; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); spring(v.yaw, v.yaw.x + dd, 12, dt);
        v.model.rotation.set(0, v.yaw.x, 0);
        const warn = mob.lungeWarn > 0 ? 1 : 0, lunge = mob.lunge > 0 ? 1 : 0;
        v.model.scale.z *= 1 - warn * .18 + lunge * .35; v.model.scale.x *= 1 + warn * .12 - lunge * .1;
        parts.seams.forEach((m) => { m.scale.set(1 + warn * 2.5, 1 + warn * 2.5, 1); });
        parts.core.scale.set(.2 + warn * .12, .16 + warn * .1, .34 + warn * .1);
        if (warn) glowAt(mob.x, mob.y, alt, 0xff4a2e, 34 + Math.sin(clock * 30) * 8);
        if (lunge && Math.random() < .5) spark(mob.x, mob.y, alt, 0xff4a2e, 1, .3);
      } else {
        parts.spin.rotation.y += dt * (v.type === "LEECH" ? 1.6 : v.type === "ELITE" ? .7 : 2.2);
        parts.spin.rotation.x = Math.sin(clock * 1.3 + (mob.id || 0)) * .25;
        if (v.type === "NOISE") parts.plates.forEach((p, i) => { if (p.userData.home) p.position.copy(p.userData.home).multiplyScalar(1 + .12 * Math.sin(clock * 4 + i)); });
        if (v.type === "LEECH") { const drain = mob.draining ? 1 : 0; parts.spines.forEach((sp) => sp.scale.setScalar(1 - drain * .35 + Math.sin(clock * 8) * .05 * drain)); parts.halo.scale.setScalar(1 + .15 * Math.sin(clock * 5) + drain * .4); }
        if (v.type === "ELITE") {
          const lost = Math.round((1 - mob.hp / mob.maxHp) * parts.plates.length * .85);
          if (lost > v.lost) { for (let k = v.lost; k < lost; k++) { const pl = parts.plates[k]; if (pl) { pl.visible = false; debris(mob.x, mob.y, alt, 3, r * 2, .7); } } spark(mob.x, mob.y, alt, F.PALETTE.amber, 6, .7); v.lost = lost; }
          parts.halo.rotation.z += dt * .8; parts.halo.scale.setScalar(1 + .04 * Math.sin(clock * 4));
        }
      }
      // leech drain beam
      shadowAt(mob.x, mob.y, r * 3.4, alt);
      glowAt(mob.x, mob.y, alt, v.model.userData.coreColor, r * (v.type === "ELITE" ? 3 : 2.2) * Math.max(.2, pop));
    }
    // leech beams
    let bi = 0;
    for (const mob of s.enemies) {
      if (!mob.draining || bi >= beamPool.length) continue;
      const b = beamPool[bi++]; const dx = s.player.x - mob.x, dy = s.player.y - mob.y, len = Math.hypot(dx, dy);
      b.visible = true; b.position.set(mob.x - HW, 14, mob.y - HH); b.rotation.y = -Math.atan2(dy, dx); b.scale.set(len, 1, 7); b.material.uniforms.uTime.value = clock;
    }
    for (; bi < beamPool.length; bi++) beamPool[bi].visible = false;
    enemyViews.forEach((v, mob) => { if (!seen.has(mob)) releaseEnemy(mob, v); });
  }

  function updateBosses(s, dt) {
    const seen = new Set(); let li = 0;
    for (const boss of s.bosses) {
      seen.add(boss); const v = getBossView(boss), P = v.model.userData.parts, size = boss.size || 204;
      const enter = boss.enter > 0 ? 1 - boss.enter / 1.1 : 1, e = easeOutCubic(clamp(enter, 0, 1));
      const k = v.kind === 0 ? .58 : v.kind === 1 ? .66 : .5;
      const alt = 34 + Math.sin(clock * 1.6 + boss.id) * 4 + (1 - e) * 320;
      v.model.position.set(boss.x - HW, alt, boss.y - HH);
      const hit = boss.hit > 0 ? 1 : 0; P.shell.emissive.setRGB(hit * .5, hit * .45, hit * .45);
      v.model.scale.setScalar(size * k * (.6 + .4 * e) * (1 + hit * .03));
      if (!boss.rage && v.rage > 0) v.rage = 0;
      v.rage = damp(v.rage, boss.rage ? 1 : 0, 3, dt);
      const angle = Math.atan2(s.player.y - boss.y, s.player.x - boss.x);
      let face = v.kind === 1 && boss.telegraph > 0 ? boss.chargeAngle : angle;
      if (v.kind === 1 && boss.charge > 0) face = boss.chargeAngle;
      const yawT = Math.atan2(-Math.cos(face), -Math.sin(face)); let dd = yawT - v.yaw.x; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); spring(v.yaw, v.yaw.x + dd, v.kind === 2 ? 2 : 5, dt);
      v.model.rotation.y = v.kind === 2 ? clock * .25 : v.yaw.x;
      const coreCol = v.rage > .5 ? SIGNAL : v.color;
      P.core.material = F.glowMat(coreCol.getHex());
      const corePulse = 1 + .12 * Math.sin(clock * (4 + v.rage * 6));
      if (v.kind === 0) {
        P.wings.forEach((w, i) => { const s2 = i ? 1 : -1; w.rotation.z = s2 * (Math.sin(clock * (2.2 + v.rage * 2)) * .22 + .08 + v.rage * .18); w.rotation.y = s2 * v.rage * -.12; });
        P.tail.forEach((t, i) => { t.position.x = Math.sin(clock * 3 - i * .7) * .05 * (i + 1); });
        P.core.scale.setScalar(.12 * corePulse * (1 + v.rage * .3));
      } else if (v.kind === 1) {
        const fold = boss.telegraph > 0 ? 1 - boss.telegraph / .9 : boss.charge > 0 ? 1 : 0;
        P.heads.forEach((h, i) => { h.rotation.x = clock * (1 + v.rage) * (i ? 1 : -1) * .6; h.position.z = -fold * .25; h.position.x = (i ? 1 : -1) * (.92 - fold * .18); });
        P.rig.rotation.z = Math.sin(clock * .8) * .08;
        P.core.scale.set(.12 * corePulse, .2 * corePulse, .12 * corePulse);
      } else {
        const breath = .08 * Math.sin(clock * 1.8) + v.rage * .32 + (boss.summonClock < .6 ? (.6 - boss.summonClock) * .5 : 0);
        P.plates.forEach((pl, i) => { pl.position.copy(pl.userData.home).addScaledVector(pl.userData.normal, breath + .02 * Math.sin(clock * 3 + i)); });
        P.coreGlass.rotation.x += dt * .6; P.coreGlass.rotation.y += dt * .9;
        P.core.scale.setScalar(.16 * corePulse * (1 + v.rage * .4));
      }
      P.seams.forEach((m) => { m.material = F.glowMat(coreCol.getHex()); });
      v.light.position.set(boss.x - HW, alt + 26, boss.y - HH); v.light.color.copy(coreCol); v.light.intensity = (2.6 + v.rage * 2 + Math.sin(clock * 5) * .4) * e;
      shadowAt(boss.x, boss.y, size * 1.5, alt);
      glowAt(boss.x, boss.y, alt + 10, coreCol.getHex(), size * .5 * corePulse);
      // charge lane telegraph
      if (boss.telegraph > 0 && li < laneMeshes.length) { const L = laneMeshes[li++]; L.visible = true; L.position.set(boss.x - HW, 1.2, boss.y - HH); L.rotation.y = -boss.chargeAngle; L.scale.set(900, 1, boss.radius * 2); L.material.uniforms.uTime.value = clock; L.material.uniforms.uK.value = 1 - boss.telegraph / .9; }
      if (boss.charge > 0 && Math.random() < .7) spark(boss.x, boss.y, alt, coreCol.getHex(), 2, .6);
    }
    for (; li < laneMeshes.length; li++) laneMeshes[li].visible = false;
    bossViews.forEach((v, b) => { if (!seen.has(b)) { scene.remove(v.model); scene.remove(v.light); bossViews.delete(b); } });
  }

  function updateShots(s, dt) {
    const counts = {}; SHAPES.forEach((k) => (counts[k] = 0)); let sc = 0;
    for (const b of s.bullets) {
      const shape = SHAPES.includes(b.shape) ? b.shape : "orb", m = shotMeshes[shape], i = counts[shape]++;
      if (i >= SHOT_N) continue;
      const ang = Math.atan2(b.vy, b.vx), r = (b.radius || 3.5) * 1.5;
      tmpQ.setFromEuler(tmpE.set(0, -ang + Math.PI / 2, 0)); if (shape === "ring" || shape === "star" || shape === "square") tmpQ.setFromEuler(tmpE.set(Math.PI / 2, clock * 6, 0));
      tmpM.compose(tmpV.set(b.x - HW, 12, b.y - HH), tmpQ, tmpS.setScalar(r)); m.setMatrixAt(i, tmpM);
      if (s.weaponFx && s.weaponFx.color) { if (s.weaponFx.color === "prism") tmpC.setHSL((clock * .5 + i * .07) % 1, .85, .68); else tmpC.set(s.weaponFx.color); } else tmpC.set(b.color || "#eef3f8").lerp(new THREE.Color(0xffffff), .35); m.setColorAt(i, tmpC);
      if (sc < SHOT_N * 2) { const len = Math.min(70, Math.hypot(b.vx, b.vy) * .055); tmpQ.setFromEuler(tmpE.set(0, -ang - Math.PI / 2, 0)); tmpM.compose(tmpV.set(b.x - HW, 11.5, b.y - HH), tmpQ, tmpS.set(r * 1.6, 1, len)); streaks.setMatrixAt(sc, tmpM); streaks.setColorAt(sc, tmpC); sc++; }
      glowAt(b.x, b.y, 12, tmpC.getHex(), r * 2.4);
    }
    SHAPES.forEach((k) => { const m = shotMeshes[k]; m.count = Math.min(SHOT_N, counts[k]); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    streaks.count = sc; streaks.instanceMatrix.needsUpdate = true; if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;
    let hc = 0;
    for (const h of s.hostileShots) {
      if (hc >= 400) break; const r = (h.radius || 5);
      tmpQ.setFromEuler(tmpE.set(clock * 3, clock * 2, 0)); tmpM.compose(tmpV.set(h.x - HW, 12, h.y - HH), tmpQ, tmpS.setScalar(r * .9)); enemyShots.setMatrixAt(hc++, tmpM);
      glowAt(h.x, h.y, 12, 0xff4a2e, r * 5.4); glowAt(h.x, h.y, 12.5, 0xffd9cc, r * 1.6);
    }
    enemyShots.count = hc; enemyShots.instanceMatrix.needsUpdate = true;
  }

  function updatePickups(s, dt) {
    let si = 0; const seen = new Set();
    for (const d of s.drops) {
      const blink = d.life < 2.5 && Math.floor(d.life * 8) % 2;
      if (!d.cache && !d.power) {
        if (si >= 120) continue; const y = 10 + Math.sin(clock * 4 + d.offset) * 3;
        tmpQ.setFromEuler(tmpE.set(0, clock * 2 + d.offset, 0)); tmpM.compose(tmpV.set(d.x - HW, y, d.y - HH), tmpQ, tmpS.setScalar(blink ? .001 : 1.5)); shardsMesh.setMatrixAt(si++, tmpM);
        if (!blink) { glowAt(d.x, d.y, y, F.PALETTE.mint, 24); shadowAt(d.x, d.y, 18, y); }
        continue;
      }
      seen.add(d); const v = getPickupView(d), y = 16 + Math.sin(clock * 3 + d.offset) * 4;
      v.model.visible = !blink; v.model.position.set(d.x - HW, y, d.y - HH); v.model.rotation.y += dt * 1.4; v.model.rotation.x = Math.sin(clock + d.offset) * .3;
      if (v.model.userData.icon) v.model.userData.icon.rotation.y -= dt * 3;
      v.model.scale.setScalar((d.cache ? 1.25 : 1.55) * (1 + .06 * Math.sin(clock * 5 + d.offset)));
      if (!blink) { glowAt(d.x, d.y, y, d.cache ? F.PALETTE.mint : d.power === "shield" ? F.PALETTE.mint : d.power === "magnet" ? 0xffb4c8 : 0xffffff, d.cache ? 46 : 52); shadowAt(d.x, d.y, 34, y); }
    }
    shardsMesh.count = si; shardsMesh.instanceMatrix.needsUpdate = true;
    pickupViews.forEach((v, d) => { if (!seen.has(d)) { scene.remove(v.model); pickupViews.delete(d); pickupPool[v.kind].push(v); } });
  }

  function updateHazard(s, dt) {
    const h = s.hazard; hazardMat.uniforms.uTime.value = clock;
    if (!h) { hazardMesh.visible = false; return; }
    hazardMesh.visible = h.warn > 0 || h.live;
    hazardMesh.position.set(h.x - HW, 1, h.y - HH);
    const outer = h.type === "disc" ? h.r : h.r + h.w / 2, inner = h.type === "disc" ? 0 : (h.r - h.w / 2) / outer;
    hazardMesh.scale.setScalar(outer); hazardMat.uniforms.uInner.value = inner;
    hazardMat.uniforms.uWarn.value = damp(hazardMat.uniforms.uWarn.value, h.warn > 0 ? 1 : 0, 10, dt);
    hazardMat.uniforms.uLive.value = damp(hazardMat.uniforms.uLive.value, h.live ? 1 : 0, 14, dt);
    if (h.live && !updateHazard.wasLive) Forge3D.event("hazard", { x: h.x, y: h.y });
    updateHazard.wasLive = h.live;
  }

  function updateCamera(s, dt) {
    // follow: a gentle spring toward the player, plus cursor parallax
    const P = s.player, focus = s.state === "playing" || s.state === "paused" || s.state === "upgrade";
    spring(camState.fx, focus ? (P.x - HW) * .05 : 0, 3, dt); spring(camState.fz, focus ? (P.y - HH) * .05 : 0, 3, dt);
    cursor.x = damp(cursor.x, reduceMotion ? 0 : cursor.tx, 2.5, dt); cursor.y = damp(cursor.y, reduceMotion ? 0 : cursor.ty, 2.5, dt);
    const pos = tmpV.copy(camBase.pos), target = new THREE.Vector3().copy(camBase.target);
    pos.x += camState.fx.x + cursor.x * 26; pos.z += camState.fz.x + cursor.y * 14;
    target.x += camState.fx.x * .9 + cursor.x * 6; target.z += camState.fz.x * .9 + cursor.y * 4;
    let zoom = 1, cineLift = 0;
    const c = camState.cine;
    if (c) {
      c.t += dt; const t = clamp(c.t / c.dur, 0, 1);
      if (c.kind === "intro") { const e = 1 - easeInOut(t); cineLift = e * 900; pos.x += e * -260; target.z -= e * 120; }
      else if (c.kind === "boss") { const w = Math.sin(t * Math.PI); zoom = 1 - w * .12; target.x = lerp(target.x, c.x - HW, w * .5); target.z = lerp(target.z, c.y - HH, w * .35); }
      else if (c.kind === "death") { const w = easeOutCubic(t); zoom = 1 - w * .2; target.x = lerp(target.x, c.x - HW, w * .6); target.z = lerp(target.z, c.y - HH, w * .6); }
      if (c.t >= c.dur) camState.cine = null;
    }
    spring(camState.zoom, zoom, 4, dt);
    const dir = pos.clone().sub(target); pos.copy(target).addScaledVector(dir, camState.zoom.x); pos.y += cineLift;
    // trauma shake (squared) + impact punch
    camState.trauma = Math.max(0, camState.trauma - dt * 1.4); const tr = camState.trauma * camState.trauma;
    camState.punch = Math.max(0, camState.punch - dt * 3);
    pos.x += (Math.random() - .5) * 26 * tr; pos.z += (Math.random() - .5) * 18 * tr; pos.y += -camState.punch * 30;
    camera.position.copy(pos); camera.lookAt(target);
    camera.rotation.z += (Math.random() - .5) * .025 * tr;
  }

  function adaptQuality(dt) {
    frameTimes.push(dt); if (frameTimes.length > 90) frameTimes.shift();
    qualityTimer += dt; if (qualityTimer < 2 || frameTimes.length < 60) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > .024 && Forge3D.quality > 0) { setQuality(Forge3D.quality - 1); qualityTimer = 0; frameTimes = []; }
    else if (avg < .0125 && Forge3D.quality < 2 && upgradesTried < 1 && qualityTimer > 6) { upgradesTried++; setQuality(Forge3D.quality + 1); qualityTimer = 0; frameTimes = []; }
  }
  function setQuality(q) {
    Forge3D.quality = q; bloomPass.enabled = q > 0; bloomPass.strength = q === 2 ? .62 : .5;
    dustDown.geometry.setDrawRange(0, q === 0 ? 500 : q === 1 ? 1000 : 1600);
    const glass = F.materials().glass; glass.transmission = q === 0 ? 0 : 1; glass.opacity = q === 0 ? .35 : 1; glass.transparent = q === 0; glass.needsUpdate = true;
    resize();
  }
  Forge3D.setQuality = setQuality;
  Forge3D._debug = () => ({ scene, camera, abyssGroups, camState, playerState });
})();
