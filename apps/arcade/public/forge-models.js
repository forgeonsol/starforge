/* $FORGE · 3D model library.
   One visual universe: polished chrome, white ceramic, graphite, faceted obsidian, a little glass.
   Accent colours are rationed: white/ice for the player, signal red for threats, mint for rewards.
   Model space: forward = -Z, up = +Y, 1 unit ≈ 1 arena pixel. Shared by the arena renderer and the
   offline thumbnail renderer so the hangar and the game always match. */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  const PALETTE = {
    ice: 0xeef3f8, signal: 0xff4a2e, mint: 0x9ff2c4, amber: 0xffc46b, violet: 0xb79cff, cool: 0xcfe3ff,
    void: 0x060607, graphite: 0x2a2d33, obsidian: 0x111216,
  };
  const SKINS = ["#c8ff63","#f7ad68","#58e8df","#b98dff","#ff7968","#a9cfff","#f878cb","#82e9ff","#ffd369","#9ee581","#ff795b","#76e8f1","#cf80ff","#bce9dd","#b6b9ff","#5ce0aa","#ff77a9","#478bff","#ffbf58","#c1e676","#f7e484","#7ef5e5","#ff719d","#78a7ff","#ca8eff","#ff685c","#a483ff","#58d7ff","#82eeae","#f4a1ff","#e88aff","#ff8098","#75f2db","#ffd676","#a8b8ff","#85f7ff","#f3b1ff","#ff9760","#ffe789","#e3ff87"];

  // ------------------------------------------------------------------ materials
  let MAT = null;
  function materials() {
    if (MAT) return MAT;
    MAT = {
      chrome: new THREE.MeshStandardMaterial({ color: 0xe9ebf0, metalness: 1, roughness: .13, envMapIntensity: 1.6 }),
      chromeDark: new THREE.MeshStandardMaterial({ color: 0x8d929c, metalness: 1, roughness: .2 }),
      ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf0efeb, metalness: 0, roughness: .34, clearcoat: 1, clearcoatRoughness: .1 }),
      graphite: new THREE.MeshStandardMaterial({ color: 0x24272d, metalness: .35, roughness: .5, flatShading: true }),
      obsidian: new THREE.MeshStandardMaterial({ color: 0x101115, metalness: .85, roughness: .2, flatShading: true }),
      canopy: new THREE.MeshPhysicalMaterial({ color: 0x0a0e17, metalness: .3, roughness: .04, clearcoat: 1, clearcoatRoughness: .02 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .03, transmission: 1, thickness: 14, ior: 1.42, iridescence: .7, iridescenceIOR: 1.25, specularIntensity: 1, envMapIntensity: 1.4 }),
      nozzle: new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: .8, roughness: .5 }),
    };
    return MAT;
  }
  const glowCache = new Map();
  function glowMat(color, opacity = 1) {
    const key = color + ":" + opacity;
    if (!glowCache.has(key)) glowCache.set(key, new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity }));
    return glowCache.get(key);
  }
  function hexToColor(hex) { return new THREE.Color(hex); }
  function soften(hex, t = .45) { return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t); }

  // ------------------------------------------------------------------ geometry helpers
  // Loft a faceted body through cross-sections {z, rx, ry, y?}. Flat shading gives the cut-gem facets.
  function loft(sections, sides = 6, rot = Math.PI / 6) {
    const pos = [], idx = [];
    sections.forEach((s) => { for (let i = 0; i < sides; i++) { const a = rot + i / sides * Math.PI * 2; pos.push(Math.cos(a) * s.rx, (s.y || 0) + Math.sin(a) * s.ry, s.z); } });
    for (let k = 0; k < sections.length - 1; k++) for (let i = 0; i < sides; i++) {
      const a = k * sides + i, b = k * sides + (i + 1) % sides, c = (k + 1) * sides + i, d = (k + 1) * sides + (i + 1) % sides;
      idx.push(a, c, b, b, c, d);
    }
    const capStart = pos.length / 3; const s0 = sections[0]; pos.push(0, s0.y || 0, s0.z);
    for (let i = 0; i < sides; i++) idx.push(capStart, i, (i + 1) % sides);
    const capEnd = pos.length / 3; const sl = sections[sections.length - 1], base = (sections.length - 1) * sides; pos.push(0, sl.y || 0, sl.z);
    for (let i = 0; i < sides; i++) idx.push(capEnd, base + (i + 1) % sides, base + i);
    let g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g = g.toNonIndexed(); g.computeVertexNormals(); return g;
  }
  // Flat plate from a 2D outline in the XZ plane (x right, z forward=-), extruded downward by thickness.
  function plate(points, thickness = 2, bevel = .8) {
    const shape = new THREE.Shape(); points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, -thickness / 2, 0); g.computeVertexNormals(); return g;
  }
  function mirrorX(points) { return [...points, ...points.slice().reverse().map(([x, z]) => [-x, z])]; }
  function spike(len, rad, sides = 4) { const g = new THREE.ConeGeometry(rad, len, sides, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, -len / 2); return g; }
  function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); return m; }

  // Thruster flame: additive cone whose length the renderer drives with speed.
  let flameMatBase = null;
  function flameMaterial(color) {
    if (!flameMatBase) flameMatBase = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uTime: { value: 0 }, uPower: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uColor; uniform float uTime; uniform float uPower; varying vec2 vUv; void main(){ float t = 1.0 - vUv.y; float flick = .85 + .15*sin(uTime*60.0 + vUv.x*20.0); float a = pow(t, 1.6) * flick * uPower; vec3 c = mix(uColor, vec3(1.0), pow(t, 4.0)); gl_FragColor = vec4(c * a * 1.6, a); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    });
    const m = flameMatBase.clone(); m.uniforms.uColor.value = new THREE.Color(color); return m;
  }
  function flameGeo(len, rad) { const g = new THREE.ConeGeometry(rad, len, 10, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2); return g; }

  // ------------------------------------------------------------------ player ship
  // 6 families × 3 finishes × skin livery = 40 recognisably different hulls.
  function ship(index = 1, opts = {}) {
    const M = materials(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const fam = (index - 1) % 6, finish = Math.floor((index - 1) / 6) % 3;
    const livery = soften(SKINS[(index - 1) % 40] || "#eef3f8", .25);
    const hullMat = finish === 0 ? M.chrome : finish === 1 ? M.ceramic : M.graphite;
    const wingMat = finish === 0 ? M.graphite : finish === 1 ? M.chrome : M.chromeDark;
    // fuselage
    const fus = [
      [{ z: -38, rx: .6, ry: .5 }, { z: -26, rx: 4, ry: 3 }, { z: -6, rx: 7.2, ry: 5 }, { z: 14, rx: 7.6, ry: 4.6 }, { z: 26, rx: 5.6, ry: 3.6 }],
      [{ z: -34, rx: .6, ry: .5 }, { z: -20, rx: 5.2, ry: 3.4 }, { z: 0, rx: 8.4, ry: 5.2 }, { z: 18, rx: 6.6, ry: 4.2 }, { z: 26, rx: 4.6, ry: 3 }],
      [{ z: -32, rx: .6, ry: .5 }, { z: -18, rx: 4.6, ry: 3.2 }, { z: 4, rx: 6.4, ry: 4.4 }, { z: 22, rx: 5, ry: 3.4 }],
      [{ z: -30, rx: .8, ry: .6 }, { z: -16, rx: 7, ry: 4.2 }, { z: 2, rx: 10, ry: 5.6 }, { z: 18, rx: 8, ry: 4.4 }, { z: 26, rx: 5, ry: 3 }],
      [{ z: -40, rx: .5, ry: .4 }, { z: -24, rx: 3.8, ry: 2.8 }, { z: 0, rx: 6.2, ry: 4.2 }, { z: 24, rx: 5.2, ry: 3.4 }],
      [{ z: -36, rx: .6, ry: .5 }, { z: -22, rx: 4.6, ry: 3.2 }, { z: -2, rx: 7.4, ry: 5 }, { z: 16, rx: 7, ry: 4.4 }, { z: 26, rx: 5.2, ry: 3.2 }],
    ][fam];
    const fuselage = mesh(loft(fus, 6), hullMat); body.add(fuselage);
    // spine ridge + livery seam (emissive hairline, rationed accent)
    const seam = mesh(new THREE.BoxGeometry(.7, .5, 34), glowMat(livery.getHex())); seam.position.set(0, (fus[2].ry || 4) + .1, 2); body.add(seam);
    // wings
    const WINGS = [
      [[4, -6], [30, 16], [33, 22], [18, 22], [5, 18]],
      [[5, 8], [28, -12], [32, -9], [16, 20], [5, 22]],
      [[4, 0], [34, 4], [34, 10], [4, 14]],
      [[6, -8], [20, 4], [34, 16], [32, 22], [12, 22], [6, 24]],
      [[2, -26], [34, 22], [26, 26], [8, 22], [2, 24]],
      [[4, -4], [18, 2], [34, -6], [30, 18], [22, 14], [14, 24], [4, 22]],
    ];
    const wingGeo = plate(mirrorX(WINGS[fam]), 1.6, .7);
    const wings = mesh(wingGeo, wingMat); wings.position.y = -.6; body.add(wings);
    // wing livery edge strips
    const tip = WINGS[fam].reduce((a, p) => (p[0] > a[0] ? p : a), [0, 0]);
    for (const s of [-1, 1]) {
      const strip = mesh(new THREE.BoxGeometry(5.5, .5, 1), glowMat(livery.getHex())); strip.position.set(s * (tip[0] - 4), .5, tip[1] + 1.5); body.add(strip);
      const nav = mesh(new THREE.OctahedronGeometry(1.1), glowMat(s < 0 ? 0xff7a66 : PALETTE.mint)); nav.position.set(s * tip[0], .2, tip[1]); body.add(nav);
    }
    // canopy
    const can = mesh(new THREE.SphereGeometry(1, 20, 12), M.canopy); can.scale.set(3.6, 2.6, 9.5); can.position.set(0, (fus[2].ry || 4) - .4, -10); body.add(can);
    const glint = mesh(new THREE.SphereGeometry(1, 10, 6), glowMat(0xffffff, .55)); glint.scale.set(.6, .25, 3.4); glint.position.set(-1.2, (fus[2].ry || 4) + 1.9, -12); body.add(glint);
    // twin booms for family 2
    if (fam === 2) for (const s of [-1, 1]) { const boom = mesh(loft([{ z: -22, rx: .5, ry: .5 }, { z: -12, rx: 2.6, ry: 2.6 }, { z: 20, rx: 2.8, ry: 2.8 }, { z: 26, rx: 2.2, ry: 2.2 }], 6), hullMat); boom.position.x = s * 22; body.add(boom); }
    // tail fins
    for (const s of [-1, 1]) { const fin = mesh(plate([[0, 10], [0, 24], [7, 26], [6, 16]], .9, .3), wingMat); fin.rotation.z = s * 1.15; fin.position.set(s * 4, 2, 0); body.add(fin); }
    // engines + flames
    const engineX = fam === 2 ? [-22, 22] : [-5.5, 5.5], flames = [], nozzles = [];
    engineX.forEach((x) => {
      const noz = mesh(new THREE.CylinderGeometry(2.6, 3.2, 5, 10, 1, true), M.nozzle); noz.rotation.x = Math.PI / 2; noz.position.set(x, 0, 27); body.add(noz); nozzles.push(noz);
      const ring = mesh(new THREE.TorusGeometry(2.9, .45, 6, 16), M.chrome); ring.position.set(x, 0, 29.4); body.add(ring);
      const core = mesh(new THREE.CircleGeometry(2.2, 14), glowMat(0xdff2ff)); core.position.set(x, 0, 29.6); core.rotation.y = Math.PI; body.add(core);
      const flame = mesh(flameGeo(26, 2.6), flameMaterial(0xbfe3ff)); flame.position.set(x, 0, 29.5); body.add(flame); flames.push(flame);
    });
    // upgrade hardpoints (hidden until earned)
    const pods = [];
    for (let k = 0; k < 4; k++) {
      const s = k % 2 ? 1 : -1, row = Math.floor(k / 2);
      const pod = new THREE.Group();
      const barrel = mesh(new THREE.CylinderGeometry(1.1, 1.3, 14, 8), M.chrome); barrel.rotation.x = Math.PI / 2; pod.add(barrel);
      const muzzle = mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.4, 8), glowMat(PALETTE.ice)); muzzle.rotation.x = Math.PI / 2; muzzle.position.z = -7; pod.add(muzzle);
      pod.position.set(s * (13 + row * 9), -1.4, -2 + row * 6); pod.scale.setScalar(.001); pod.visible = false; body.add(pod); pods.push(pod);
    }
    root.userData = { body, flames, pods, seam, livery, fam, finish, hullMat };
    return root;
  }

  // ------------------------------------------------------------------ enemies
  const ENEMY_CORE = { NOISE: PALETTE.cool, SPOOF: PALETTE.signal, LEECH: PALETTE.violet, ELITE: PALETTE.amber };
  function obsidianClone() { const m = materials().obsidian.clone(); m.emissive = new THREE.Color(0x000000); return m; }
  function enemy(type = "NOISE", variant = 0) {
    const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
    const coreColor = ENEMY_CORE[type] || PALETTE.cool, shell = obsidianClone(), M = materials();
    const parts = { spin, shell, plates: [], spines: [], seams: [], core: null, halo: null };
    const core = mesh(new THREE.IcosahedronGeometry(1, 0), glowMat(coreColor)); parts.core = core;
    if (type === "NOISE") {
      core.scale.setScalar(.34); spin.add(core);
      if (variant % 2 === 0) { // shard crown: six obsidian blades around a lit core
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = mesh(spike(1.25, .34, 3), shell); b.position.set(Math.cos(a) * .32, 0, Math.sin(a) * .32); b.lookAt(Math.cos(a) * 3, (k % 2 ? .5 : -.5), Math.sin(a) * 3); b.rotateY(Math.PI); spin.add(b); parts.plates.push(b); }
      } else { // broken octahedron: eight faces held apart from the core
        const oct = new THREE.OctahedronGeometry(1, 0).toNonIndexed(), p = oct.attributes.position;
        for (let f = 0; f < p.count; f += 3) {
          let cx = 0, cy = 0, cz = 0;
          for (let j = 0; j < 3; j++) { cx += p.getX(f + j) / 3; cy += p.getY(f + j) / 3; cz += p.getZ(f + j) / 3; }
          const face = mesh(new THREE.TetrahedronGeometry(.5, 0), shell); face.position.set(cx * 1.15, cy * 1.15, cz * 1.15); face.lookAt(cx * 4, cy * 4, cz * 4); face.userData.home = face.position.clone(); spin.add(face); parts.plates.push(face);
        }
      }
      const ring = mesh(new THREE.TorusGeometry(.92, .035, 4, 40), M.chrome); ring.rotation.x = Math.PI / 2; spin.add(ring);
    } else if (type === "SPOOF") { // the Ram: a faceted lance that points where it is going
      const lance = mesh(loft([{ z: -1.6, rx: .02, ry: .02 }, { z: -.6, rx: .44, ry: .26 }, { z: .5, rx: .6, ry: .3 }, { z: 1, rx: .36, ry: .2 }], 4, Math.PI / 4), shell); root.add(lance);
      for (const s of [-1, 1]) { const blade = mesh(plate([[0, -.2], [1.15, .55], [.9, .8], [0, .6]], .06, .02), M.chrome); blade.scale.x = s; blade.position.set(0, -.02, 0); root.add(blade); parts.plates.push(blade); }
      core.scale.set(.2, .16, .34); core.position.set(0, .18, .62); root.add(core);
      const seam = mesh(new THREE.BoxGeometry(.05, .05, 1.8), glowMat(PALETTE.signal)); seam.position.set(0, .3, -.3); root.add(seam); parts.seams.push(seam);
    } else if (type === "LEECH") {
      const ring = mesh(new THREE.TorusGeometry(.7, .2, 6, 12), shell); ring.rotation.x = Math.PI / 2; spin.add(ring);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, sp = mesh(spike(.9, .12, 4), M.chromeDark); sp.position.set(Math.cos(a) * .82, 0, Math.sin(a) * .82); sp.lookAt(Math.cos(a + .5) * 3, 0, Math.sin(a + .5) * 3); sp.rotateY(Math.PI); spin.add(sp); parts.spines.push(sp); }
      core.scale.setScalar(.38); spin.add(core);
      const veil = mesh(new THREE.SphereGeometry(.55, 16, 10), glowMat(PALETTE.violet, .18)); spin.add(veil); parts.halo = veil;
    } else { // ELITE: amber core under orbiting armour that comes away as it is damaged
      core.scale.setScalar(.42); spin.add(core);
      const ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), p = ico.attributes.position;
      for (let f = 0; f < p.count; f += 6) {
        const n = new THREE.Vector3(p.getX(f) + p.getX(f + 1) + p.getX(f + 2), p.getY(f) + p.getY(f + 1) + p.getY(f + 2), p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)).normalize();
        const pl = mesh(new THREE.CylinderGeometry(.42, .5, .16, 5), f % 12 ? shell : M.chrome); pl.position.copy(n.clone().multiplyScalar(.9)); pl.lookAt(n.clone().multiplyScalar(3)); pl.rotateX(Math.PI / 2); pl.userData.home = pl.position.clone(); pl.userData.normal = n; spin.add(pl); parts.plates.push(pl);
      }
      const halo = mesh(new THREE.TorusGeometry(1.25, .03, 4, 48), glowMat(PALETTE.amber, .7)); halo.rotation.x = Math.PI / 2; root.add(halo); parts.halo = halo;
    }
    root.userData = { type, parts, coreColor };
    return root;
  }

  // ------------------------------------------------------------------ bosses
  function boss(kind = 0, accent = 0xff7a3d) {
    const M = materials(), root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
    const shell = obsidianClone(), parts = { rig, shell, wings: [], heads: [], plates: [], tail: [], core: null, coreGlass: null, seams: [] };
    const coreGlow = mesh(new THREE.IcosahedronGeometry(1, 2), glowMat(accent)); parts.core = coreGlow;
    if (kind === 0) { // ANVIL RAY: layered chrome wings that beat slowly
      const torso = mesh(loft([{ z: -1.05, rx: .06, ry: .05 }, { z: -.7, rx: .34, ry: .16 }, { z: -.1, rx: .5, ry: .22 }, { z: .45, rx: .36, ry: .16 }, { z: .8, rx: .12, ry: .07 }], 8, 0), shell); rig.add(torso);
      for (const s of [-1, 1]) {
        const wing = new THREE.Group(); wing.position.set(s * .32, 0, -.1);
        for (let l = 0; l < 3; l++) { const pl = mesh(plate([[0, -.42 + l * .1], [1.25 - l * .12, .02 + l * .06], [1.05 - l * .14, .2 + l * .05], [0, .36]], .04 + l * .01, .015), l === 1 ? M.chrome : shell); pl.position.y = .04 - l * .05; pl.scale.x = s; wing.add(pl); }
        const edge = mesh(new THREE.BoxGeometry(1.05, .02, .02), glowMat(accent, .9)); edge.position.set(s * .62, .06, -.16); edge.rotation.y = s * -.36; wing.add(edge); parts.seams.push(edge);
        rig.add(wing); parts.wings.push(wing);
      }
      for (let k = 0; k < 4; k++) { const seg = mesh(loft([{ z: -.12, rx: .1 - k * .02, ry: .06 }, { z: .12, rx: .08 - k * .015, ry: .05 }], 5, 0), k % 2 ? M.chromeDark : shell); seg.position.z = .85 + k * .2; rig.add(seg); parts.tail.push(seg); }
      coreGlow.scale.setScalar(.12); coreGlow.position.set(0, .2, -.15); rig.add(coreGlow);
      const glass = mesh(new THREE.SphereGeometry(.19, 24, 16), M.glass); glass.position.copy(coreGlow.position); rig.add(glass); parts.coreGlass = glass;
    } else if (kind === 1) { // TWIN HAMMER: two heavy heads on a turning spine
      const spine = mesh(new THREE.BoxGeometry(1.7, .14, .16), M.chromeDark); rig.add(spine);
      for (const s of [-1, 1]) {
        const head = new THREE.Group(); head.position.x = s * .92;
        const block = mesh(loft([{ z: -.42, rx: .12, ry: .12 }, { z: -.28, rx: .3, ry: .26 }, { z: .3, rx: .3, ry: .26 }, { z: .42, rx: .16, ry: .14 }], 6), shell); head.add(block);
        const face = mesh(new THREE.CylinderGeometry(.22, .22, .05, 6), M.chrome); face.rotation.x = Math.PI / 2; face.position.z = -.44; head.add(face);
        const eye = mesh(new THREE.CircleGeometry(.11, 6), glowMat(accent)); eye.position.z = -.47; eye.rotation.y = Math.PI; head.add(eye); parts.seams.push(eye);
        rig.add(head); parts.heads.push(head);
      }
      const hub = mesh(new THREE.CylinderGeometry(.24, .24, .34, 8), shell); rig.add(hub);
      coreGlow.scale.set(.12, .2, .12); rig.add(coreGlow);
      const glass = mesh(new THREE.CylinderGeometry(.17, .17, .44, 24), M.glass); rig.add(glass); parts.coreGlass = glass;
    } else { // BELLOWS: a breathing shell of plates around a glass knot
      const ico = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), p = ico.attributes.position;
      for (let f = 0; f < p.count; f += 3) {
        const n = new THREE.Vector3((p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3, (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3, (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3);
        if (n.y < -.55) continue;
        const pl = mesh(new THREE.CylinderGeometry(.2, .26, .05, 3), (f / 3) % 7 === 0 ? M.chrome : shell);
        pl.position.copy(n.clone().multiplyScalar(.82)); pl.lookAt(n.clone().multiplyScalar(4)); pl.rotateX(Math.PI / 2); pl.userData.home = pl.position.clone(); pl.userData.normal = n.clone().normalize(); rig.add(pl); parts.plates.push(pl);
      }
      const knot = mesh(new THREE.TorusKnotGeometry(.3, .09, 140, 18, 2, 3), M.glass); rig.add(knot); parts.coreGlass = knot;
      coreGlow.scale.setScalar(.16); rig.add(coreGlow);
    }
    root.userData = { kind, parts, accent };
    return root;
  }

  // ------------------------------------------------------------------ pickups & projectiles
  function pickup(kind) {
    const M = materials(), g = new THREE.Group();
    if (kind === "shard") { const c = mesh(new THREE.OctahedronGeometry(4.2, 0), glowMat(PALETTE.mint)); c.scale.y = 1.5; g.add(c); }
    else if (kind === "cache") { const box = mesh(new THREE.BoxGeometry(11, 11, 11), M.chrome); g.add(box); const c = mesh(new THREE.OctahedronGeometry(4, 0), glowMat(PALETTE.mint)); g.add(c); const cage = mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: PALETTE.mint, wireframe: true, transparent: true, opacity: .35, toneMapped: false })); g.add(cage); }
    else {
      const shell = mesh(new THREE.SphereGeometry(10, 24, 16), M.glass); g.add(shell);
      let icon;
      if (kind === "rapid") { icon = new THREE.Group(); for (let k = -1; k <= 1; k++) { const b = mesh(new THREE.BoxGeometry(1.6, 1.6, 9), glowMat(PALETTE.ice)); b.position.x = k * 3; icon.add(b); } }
      else if (kind === "shield") { icon = mesh(new THREE.TorusGeometry(4.2, 1, 8, 24), glowMat(PALETTE.mint)); }
      else { icon = mesh(new THREE.TorusGeometry(4, 1.2, 8, 20, Math.PI), glowMat(0xffb4c8)); icon.rotation.z = Math.PI; }
      g.add(icon); g.userData.icon = icon;
    }
    return g;
  }
  const PROJ = {};
  function projectileGeometry(shape) {
    if (PROJ[shape]) return PROJ[shape];
    let g;
    switch (shape) {
      case "diamond": g = new THREE.OctahedronGeometry(1, 0); g.scale(.8, .8, 2.2); break;
      case "flare": g = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(.55, 2.6, 3, 8) : new THREE.CylinderGeometry(.55, .55, 3.4, 8); g.rotateX(Math.PI / 2); break;
      case "ring": g = new THREE.TorusGeometry(1, .28, 6, 16); break;
      case "triangle": g = new THREE.TetrahedronGeometry(1.2, 0); break;
      case "star": g = new THREE.OctahedronGeometry(1.25, 0); g.scale(1, .45, 1); break;
      case "sun": g = new THREE.IcosahedronGeometry(1.1, 0); break;
      case "square": g = new THREE.BoxGeometry(1.5, 1.5, 1.5); break;
      default: g = new THREE.SphereGeometry(.8, 10, 8); g.scale(1, 1, 2.6);
    }
    PROJ[shape] = g; return g;
  }

  // ------------------------------------------------------------------ pilot (articulated, for pre-rendered frames)
  // pose: [torsoLean, frontThigh, frontKnee, backThigh, backKnee, frontUpper, frontElbow, backUpper, backElbow] in degrees.
  const lo = (sections, sides) => loft(sections.slice().reverse(), sides); // outward-facing winding for z-ascending sections
  const POSES = [
    // torsoLean, frontThigh, frontKnee, backThigh, backKnee, frontUpper, frontElbow, backUpper, backElbow
    [3, 8, 6, -6, 6, 18, 34, -10, 26],      // idle
    [12, 44, 26, -34, 74, -34, 70, 44, 50], // run a (contact)
    [9, 12, 64, -6, 14, 4, 74, -2, 56],     // run b (pass)
    [12, -30, 72, 42, 24, 46, 52, -36, 64], // run c (push)
    [8, 62, 96, 14, 48, 62, 60, -44, 70],   // jump (tuck, reach)
    [2, 24, 22, -18, 40, 86, 24, 58, 36],   // fall (arms out for balance)
    [4, 12, 6, -12, 8, 90, 0, -12, 46],     // shoot
    [30, -36, 34, -62, 44, -58, 30, -78, 24], // dash
  ];
  function capsule(len, r, mat) { const g = new THREE.Group(); const c = mesh(new THREE.CylinderGeometry(r, r * .9, len, 16), mat); c.position.y = -len / 2; g.add(c); const e = mesh(new THREE.SphereGeometry(r * .9, 14, 10), mat); e.position.y = -len; g.add(e); return g; }
  function pilot(variant = 0, poseIndex = 0) {
    const M = materials(), d = Math.PI / 180, P = Array.isArray(poseIndex) ? poseIndex : POSES[poseIndex], tag = Array.isArray(poseIndex) ? poseIndex.tag || 0 : poseIndex; poseIndex = tag; const airborne = poseIndex === 4 || poseIndex === 5 || poseIndex === 7;
    const accent = variant === 1 ? PALETTE.amber : PALETTE.mint;
    const armor = variant === 1 ? new THREE.MeshPhysicalMaterial({ color: 0x3b3f48, metalness: .5, roughness: .28, clearcoat: 1, clearcoatRoughness: .12 }) : M.ceramic;
    const under = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: .25, roughness: .62 });
    const trim = M.chrome;
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 84; root.add(hips);
    const pelvis = mesh(new THREE.SphereGeometry(14, 16, 12), under); pelvis.scale.set(1, .72, 1.05); hips.add(pelvis);
    const leg = (side, a, k) => {
      const thigh = new THREE.Group(); thigh.position.set(0, -3, side * 9); thigh.rotation.z = a * d; hips.add(thigh);
      thigh.add(capsule(36, 8.2, under));
      const tp = mesh(lo([{ z: -2, rx: 10.4, ry: 10 }, { z: 14, rx: 10.8, ry: 10.2 }, { z: 26, rx: 8.4, ry: 8.4 }], 10), armor); tp.rotation.x = Math.PI / 2; tp.position.y = -2; thigh.add(tp);
      const knee = new THREE.Group(); knee.position.y = -36; knee.rotation.z = -k * d; thigh.add(knee);
      const kp = mesh(new THREE.SphereGeometry(7.6, 14, 10), trim); kp.position.x = 3; knee.add(kp);
      knee.add(capsule(36, 7, under));
      const sp = mesh(lo([{ z: 4, rx: 9.4, ry: 8.6 }, { z: 18, rx: 9.6, ry: 8.4 }, { z: 32, rx: 7.6, ry: 7 }], 10), armor); sp.rotation.x = Math.PI / 2; sp.position.x = 1; knee.add(sp);
      const stripe = mesh(new THREE.BoxGeometry(1.2, 14, 2.4), glowMat(accent, .95)); stripe.position.set(10.3, -16, 0); knee.add(stripe);
      const boot = mesh(lo([{ z: -11, rx: 6, ry: 7.5 }, { z: 0, rx: 9, ry: 8 }, { z: 12, rx: 7, ry: 5 }, { z: 19, rx: 3.6, ry: 3.2 }], 8), armor); boot.rotation.y = Math.PI / 2; boot.position.set(4, -42, 0); knee.add(boot);
      const sole = mesh(new THREE.BoxGeometry(30, 3.4, 13), M.nozzle); sole.position.set(5, -48.5, 0); knee.add(sole);
      return thigh; };
    leg(-1, P[3], P[4]);
    const torso = new THREE.Group(); torso.rotation.z = -P[0] * d; hips.add(torso);
    const belly = mesh(new THREE.CylinderGeometry(11, 13, 24, 14), under); belly.position.y = 12; torso.add(belly);
    const chest = mesh(lo([{ z: -18, rx: 14, ry: 12 }, { z: -6, rx: 19, ry: 17 }, { z: 8, rx: 20, ry: 17.5 }, { z: 18, rx: 15, ry: 13 }, { z: 23, rx: 9, ry: 8 }], 12), armor); chest.rotation.x = -Math.PI / 2; chest.position.y = 42; torso.add(chest);
    const plateLine = mesh(new THREE.TorusGeometry(19.6, .7, 4, 40, Math.PI), trim); plateLine.rotation.y = Math.PI / 2; plateLine.rotation.z = Math.PI / 2; plateLine.position.y = 40; torso.add(plateLine);
    const coreRing = mesh(new THREE.TorusGeometry(5.6, 1.4, 8, 22), trim); coreRing.rotation.y = Math.PI / 2; coreRing.position.set(18.4, 46, 0); torso.add(coreRing);
    const core = mesh(new THREE.CircleGeometry(4.2, 18), glowMat(PALETTE.ice)); core.position.set(18.9, 46, 0); core.rotation.y = Math.PI / 2; torso.add(core);
    const belt = mesh(new THREE.TorusGeometry(13.4, 2.4, 8, 26), trim); belt.rotation.x = Math.PI / 2; belt.position.y = 22; torso.add(belt);
    // jetpack: two chrome-capped cells + nozzles
    const pack = mesh(lo([{ z: -18, rx: 7, ry: 11 }, { z: -4, rx: 9, ry: 13 }, { z: 12, rx: 8, ry: 12 }, { z: 18, rx: 5, ry: 8 }], 8), M.graphite); pack.rotation.x = -Math.PI / 2; pack.position.set(-21, 42, 0); torso.add(pack);
    for (const z of [-7, 7]) {
      const cell = mesh(new THREE.CylinderGeometry(4.6, 4.6, 30, 12), trim); cell.position.set(-27, 42, z); torso.add(cell);
      const n = mesh(new THREE.CylinderGeometry(3.6, 5, 8, 12), M.nozzle); n.position.set(-27, 24, z); torso.add(n);
      const g = mesh(new THREE.CircleGeometry(3.4, 14), glowMat(PALETTE.ice)); g.rotation.x = Math.PI / 2; g.position.set(-27, 19.8, z); torso.add(g);
      if (airborne) { const flame = mesh(new THREE.ConeGeometry(3.6, 26 + (poseIndex === 7 ? 14 : 0), 12, 1, true), glowMat(PALETTE.ice, .55)); flame.rotation.x = Math.PI; flame.position.set(-27, 6 - (poseIndex === 7 ? 7 : 0), z); torso.add(flame); const inner = mesh(new THREE.ConeGeometry(1.8, 16, 10, 1, true), glowMat(0xffffff)); inner.rotation.x = Math.PI; inner.position.set(-27, 11, z); torso.add(inner); }
    }
    // head
    const head = new THREE.Group(); head.position.y = 70; head.rotation.z = P[0] * d * .6; torso.add(head);
    const neck = mesh(new THREE.CylinderGeometry(6.4, 8, 10, 12), under); neck.position.y = -3; head.add(neck);
    const collar = mesh(new THREE.TorusGeometry(9.4, 2.2, 8, 22), trim); collar.rotation.x = Math.PI / 2; collar.position.y = -2; head.add(collar);
    const helmet = mesh(new THREE.SphereGeometry(18.5, 32, 24), armor); helmet.scale.set(1.04, 1, .96); helmet.position.y = 15; head.add(helmet);
    const visor = mesh(new THREE.SphereGeometry(16.6, 32, 20, -Math.PI * .4, Math.PI * .8, Math.PI * .3, Math.PI * .38), M.canopy); visor.position.set(4.4, 15, 0); visor.rotation.y = Math.PI / 2; head.add(visor);
    const visorRim = mesh(new THREE.TorusGeometry(15, .9, 6, 40, Math.PI * .9), trim); visorRim.position.set(8.6, 14, 0); visorRim.rotation.y = Math.PI / 2; visorRim.rotation.z = -Math.PI * .45; head.add(visorRim);
    const glint = mesh(new THREE.BoxGeometry(1.2, 1.8, 14), glowMat(accent, .95)); glint.position.set(20.6, 19, 0); head.add(glint);
    const ear = mesh(new THREE.CylinderGeometry(4.2, 4.6, 3, 16), trim); ear.rotation.x = Math.PI / 2; ear.position.set(-6, 14, 18.4); head.add(ear);
    const earLight = mesh(new THREE.BoxGeometry(5, 1.2, .6), glowMat(accent)); earLight.position.set(-6, 14, 20.1); head.add(earLight);
    const fin = mesh(plate([[0, 0], [22, 0], [16, 5], [2, 4]], 2.4, .6), trim); fin.position.set(-12, 32, -1.2); head.add(fin);
    if (variant === 0) { // braided cable ponytail, swept back by motion
      const sweep = poseIndex >= 1 && poseIndex <= 3 ? .6 : poseIndex === 7 ? 1 : poseIndex === 4 ? -.4 : airborne ? -.2 : 0;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-14, 22, 0), new THREE.Vector3(-26, 14 + sweep * 6, 0), new THREE.Vector3(-32 - sweep * 8, 0 + sweep * 10, 0), new THREE.Vector3(-34 - sweep * 16, -14 + sweep * 16, 0)]);
      const tube = new THREE.TubeGeometry(curve, 24, 3.6, 10, false); const pa = tube.attributes.position, tmp = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) { const u = Math.floor(i / 11) / 24; tmp.fromBufferAttribute(pa, i); const c = curve.getPoint(u), s = 1 - u * .6; pa.setXYZ(i, c.x + (tmp.x - c.x) * s, c.y + (tmp.y - c.y) * s, c.z + (tmp.z - c.z) * s); }
      tube.computeVertexNormals();
      head.add(mesh(tube, new THREE.MeshStandardMaterial({ color: 0x2c211e, metalness: .2, roughness: .45 })));
      const clip = mesh(new THREE.TorusGeometry(4.2, 1.4, 6, 16), trim); clip.position.set(-24, 15, 0); clip.rotation.y = Math.PI / 2; head.add(clip);
    }
    // arms
    const arm = (side, a, e, isFront) => {
      const sh = new THREE.Group(); sh.position.set(-1, 58, side * 19); sh.rotation.z = a * d; torso.add(sh);
      const pad = mesh(new THREE.SphereGeometry(10.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), armor); pad.scale.set(1.1, .9, 1); pad.position.y = 1; sh.add(pad);
      const padLine = mesh(new THREE.TorusGeometry(10.6, .8, 4, 30), trim); padLine.rotation.x = Math.PI / 2; padLine.position.y = 1; sh.add(padLine);
      sh.add(capsule(28, 6, under)); const up = mesh(new THREE.CylinderGeometry(7.2, 6.6, 15, 12), armor); up.position.y = -15; sh.add(up);
      const el = new THREE.Group(); el.position.y = -28; el.rotation.z = e * d; sh.add(el); el.add(capsule(25, 5.4, under));
      const fore = mesh(lo([{ z: 4, rx: 7.6, ry: 7.4 }, { z: 16, rx: 7.8, ry: 7.2 }, { z: 22, rx: 6.2, ry: 6 }], 10), armor); fore.rotation.x = Math.PI / 2; el.add(fore);
      const cuff = mesh(new THREE.TorusGeometry(6, 1, 6, 18), trim); cuff.rotation.x = Math.PI / 2; cuff.position.y = -22.5; el.add(cuff);
      const hand = mesh(new THREE.SphereGeometry(6, 14, 10), under); hand.scale.set(1, 1.15, .9); hand.position.y = -29; el.add(hand);
      if (isFront) { // compact sidearm; barrel along the forearm axis
        const gun = new THREE.Group(); gun.position.set(2, -30, side * 2); el.add(gun);
        const body = mesh(new THREE.BoxGeometry(9, 26, 8), M.graphite); body.position.y = -8; gun.add(body);
        const top = mesh(new THREE.BoxGeometry(5, 22, 8.6), trim); top.position.set(3.5, -9, 0); gun.add(top);
        const barrel = mesh(new THREE.CylinderGeometry(2.4, 2.4, 10, 12), M.chromeDark); barrel.position.y = -25; gun.add(barrel);
        const muzzle = mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.6, 12), glowMat(poseIndex === 6 ? 0xffffff : PALETTE.ice, poseIndex === 6 ? 1 : .6)); muzzle.position.y = -30.4; gun.add(muzzle);
        const cell = mesh(new THREE.BoxGeometry(1.2, 10, 3), glowMat(accent)); cell.position.set(6.2, -6, 0); gun.add(cell);
      }
      return sh; };
    arm(-1, P[7], P[8], false);
    arm(1, P[5], P[6], true);
    leg(1, P[1], P[2]);
    return root;
  }
  // Ground enemies for the pilot campaign (side view, facing +X).
  function walker(type = 0, phase = 0) {
    const M = materials(), root = new THREE.Group(), shell = M.obsidian, eyeCol = type === 1 ? PALETTE.cool : PALETTE.signal;
    const carapace = new THREE.MeshPhysicalMaterial({ color: 0x30333b, metalness: .6, roughness: .24, clearcoat: 1, clearcoatRoughness: .08, flatShading: true });
    if (type === 1) { // SENTRY: faceted hover drone with a tilted chrome rotor and a scanning lens
      const bob = Math.sin(phase * Math.PI / 4) * 2;
      const core = new THREE.Group(); core.position.y = 74 + bob; root.add(core);
      const body = mesh(new THREE.IcosahedronGeometry(25, 0), carapace); body.scale.set(1.15, .9, 1); core.add(body);
      const band = mesh(new THREE.TorusGeometry(26, 2.2, 6, 6), M.chrome); band.rotation.x = Math.PI / 2; band.scale.set(1.12, 1, 1); core.add(band);
      const lensRing = mesh(new THREE.TorusGeometry(9, 2, 10, 28), M.chrome); lensRing.position.set(25, 0, 0); lensRing.rotation.y = Math.PI / 2; core.add(lensRing);
      const lens = mesh(new THREE.SphereGeometry(7.6, 20, 14, 0, Math.PI), M.canopy); lens.position.set(24, 0, 0); lens.rotation.y = Math.PI / 2; core.add(lens);
      const pupil = mesh(new THREE.CircleGeometry(3.2, 18), glowMat(PALETTE.signal)); pupil.position.set(31.4, 0, 0); pupil.rotation.y = Math.PI / 2; core.add(pupil);
      for (const s of [-1, 1]) { const fin = mesh(plate([[0, 0], [26, -6], [30, 0], [4, 6]], 2.4, .6), M.chromeDark); fin.position.set(-18, s * 4, 0); fin.rotation.z = Math.PI + s * .5; core.add(fin); }
      const rotor = new THREE.Group(); rotor.position.y = 112 + bob; rotor.rotation.z = .18; root.add(rotor);
      const hoop = mesh(new THREE.TorusGeometry(36, 2, 8, 48), M.chrome); hoop.rotation.x = Math.PI / 2; rotor.add(hoop);
      const hub = mesh(new THREE.CylinderGeometry(5, 5, 5, 12), M.chromeDark); rotor.add(hub);
      for (let k = 0; k < 3; k++) { const blade = mesh(new THREE.BoxGeometry(68, 1.2, 6), carapace); blade.rotation.y = phase * Math.PI / 12 + k * Math.PI / 3; rotor.add(blade); }
      const mast = mesh(new THREE.CylinderGeometry(2.2, 3, 18, 10), M.chrome); mast.position.y = 99 + bob; root.add(mast);
      const thr = mesh(new THREE.CylinderGeometry(6, 9, 10, 8), M.graphite); thr.position.y = 50 + bob; root.add(thr);
      const jet = mesh(new THREE.ConeGeometry(5.4, 16 + (phase % 2) * 4, 12, 1, true), glowMat(PALETTE.cool, .45)); jet.rotation.x = Math.PI; jet.position.y = 37 + bob; root.add(jet);
      return root;
    }
    const big = type === 2, k = big ? 1.4 : 1, by = (big ? 50 : 36);
    const step = phase * Math.PI / 4, sway = Math.sin(step * 2) * 1.5 * k;
    const body = new THREE.Group(); body.position.y = by + sway; root.add(body);
    // segmented abdomen + thorax + head, faceted carapace with chrome seams
    const abdomen = mesh(lo([{ z: -40 * k, rx: 6 * k, ry: 6 * k }, { z: -30 * k, rx: 20 * k, ry: 17 * k }, { z: -12 * k, rx: 24 * k, ry: 20 * k }, { z: -2 * k, rx: 18 * k, ry: 15 * k }], 8), carapace); abdomen.rotation.y = Math.PI / 2; abdomen.rotation.z = -.12; body.add(abdomen);
    const thorax = mesh(lo([{ z: -2 * k, rx: 15 * k, ry: 14 * k }, { z: 10 * k, rx: 19 * k, ry: 17 * k }, { z: 22 * k, rx: 13 * k, ry: 12 * k }], 8), shell); thorax.rotation.y = Math.PI / 2; body.add(thorax);
    const headG = new THREE.Group(); headG.position.set(28 * k, 2 * k, 0); headG.rotation.z = -.08 + Math.sin(step) * .05; body.add(headG);
    const head = mesh(lo([{ z: -4 * k, rx: 11 * k, ry: 10 * k }, { z: 6 * k, rx: 12 * k, ry: 9 * k }, { z: 16 * k, rx: 6 * k, ry: 4 * k }], 6), carapace); head.rotation.y = Math.PI / 2; headG.add(head);
    const visor = mesh(new THREE.BoxGeometry(10 * k, 3.2 * k, 16 * k), glowMat(eyeCol)); visor.position.set(9 * k, 2 * k, 0); visor.rotation.z = -.2; headG.add(visor);
    for (const s of [-1, 1]) { const mand = mesh(plate([[0, 0], [16, -3], [20, -10], [6, -4]], 1.8, .5), M.chrome); mand.position.set(10 * k, -5 * k, s * 6 * k); mand.scale.setScalar(k); mand.rotation.z = Math.sin(step * 2) * .12 * s; headG.add(mand); }
    for (const [x, w] of [[-26, 30], [-6, 22], [12, 18]]) { const seam = mesh(new THREE.BoxGeometry(2, 2, w * k), M.chrome); seam.position.set(x * k, 15 * k - Math.abs(x) * .1 * k, 0); body.add(seam); }
    const spine = mesh(new THREE.BoxGeometry(58 * k, 2.4, 3), M.chrome); spine.position.set(-6 * k, 19 * k, 0); spine.rotation.z = -.06; body.add(spine);
    const vent = mesh(new THREE.BoxGeometry(14 * k, 2 * k, 8 * k), glowMat(eyeCol, .9)); vent.position.set(-22 * k, -10 * k, 0); body.add(vent);
    if (big) { // armoured back plates + twin cannon pods
      for (let i = 0; i < 3; i++) { const pl = mesh(plate([[0, 0], [22, 0], [18, 9], [3, 7]], 3, 1), i % 2 ? M.chrome : carapace); pl.position.set((-34 + i * 16) * k * .9, 18 * k, -4); pl.rotation.z = .25 - i * .1; body.add(pl); }
      for (const s of [-1, 1]) { const pod = mesh(new THREE.CylinderGeometry(4.6, 5.4, 30, 10), M.graphite); pod.rotation.z = Math.PI / 2; pod.position.set(18 * k, 22 * k, s * 12); body.add(pod); const tip = mesh(new THREE.CircleGeometry(3.2, 12), glowMat(PALETTE.signal)); tip.rotation.y = Math.PI / 2; tip.position.set(18 * k + 15.2, 22 * k, s * 12); body.add(tip); }
    }
    // legs: three pairs, knee raised outward, chrome joints, armored femur
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const ph = step + i * 2.1 + (s > 0 ? Math.PI : 0), lift = Math.max(0, Math.sin(ph)) * 9 * k, swing = Math.cos(ph) * 9 * k;
      const hx = (-14 + i * 15) * k, spread = (i - 1) * 16 * k;
      const hip = new THREE.Vector3(hx, body.position.y - 6 * k, s * 10 * k), foot = new THREE.Vector3(hx + spread * 2.1 + swing, lift, s * 22 * k), kneeP = new THREE.Vector3(hx + spread * 1.1 + swing * .5, body.position.y + 6 * k + lift * .4, s * 26 * k);
      for (const [p0, p1, r, mat] of [[hip, kneeP, 5.2 * k, carapace], [kneeP, foot, 3.4 * k, M.chromeDark]]) { const len = p0.distanceTo(p1), seg = mesh(new THREE.CylinderGeometry(r, r * .7, len, 8), mat); seg.position.copy(p0).add(p1).multiplyScalar(.5); seg.lookAt(p1); seg.rotateX(Math.PI / 2); root.add(seg); }
      const j = mesh(new THREE.SphereGeometry(4.4 * k, 10, 8), M.chrome); j.position.copy(kneeP); root.add(j);
      const toe = mesh(new THREE.ConeGeometry(2.6 * k, 7 * k, 6), M.chrome); toe.position.copy(foot).add(new THREE.Vector3(0, 3 * k, 0)); toe.rotation.x = Math.PI; root.add(toe);
    }
    return root;
  }

  // Studio environment: a black room lit by a few long softboxes, so chrome reads as high-contrast
  // highlights on black (the look of polished metal in a dark studio) instead of flat grey.
  function studioEnvironment(renderer, accent = 0xffffff) {
    const scene = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x0b0c0f, side: THREE.BackSide }));
    scene.add(room);
    const box = (w, h, x, y, z, ry, rx, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); };
    box(7, .55, 0, 4.6, -1.2, 0, Math.PI / 2, 0xffffff, 6);      // long overhead strip
    box(.5, 5, -4.7, 1.2, 0, Math.PI / 2, 0, 0xffffff, 3.2);     // left vertical strip
    box(.4, 4, 4.7, .6, 1.5, -Math.PI / 2, 0, accent, 2.2);      // right rim strip, tinted
    box(3.4, .3, 0, 2.2, 4.8, Math.PI, 0, 0xffffff, 2.4);        // front low strip
    box(10, 3, 0, -4.9, 0, 0, -Math.PI / 2, 0x16171b, 1);        // dark floor bounce
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(scene, .015); pm.dispose();
    return rt.texture;
  }


  // ------------------------------------------------------------------ premium hull finishes (token marketplace)
  // Re-skins an existing hull: swaps the hull material, recolours the livery seams and the engine flames.
  const FINISH = {
    obsidian: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, metalness: .9, roughness: .16, clearcoat: 1, clearcoatRoughness: .05 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0x1a1c21, metalness: .85, roughness: .22, clearcoat: 1 }), seam: 0xffffff, flame: 0xeef3f8 },
    crimson: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0x6e0b05, metalness: .25, roughness: .3, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: .7 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0x8f1207, metalness: .3, roughness: .28, clearcoat: 1, envMapIntensity: .7 }), seam: 0xff4a2e, flame: 0xff8a6e, pulse: true },
    phantom: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0xcfeee0, metalness: .1, roughness: .05, clearcoat: 1, transparent: true, opacity: .62, emissive: 0x2f6b52, emissiveIntensity: .35, iridescence: .6 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0xa8e8cb, metalness: .2, roughness: .08, clearcoat: 1, transparent: true, opacity: .5, emissive: 0x1f5a40, emissiveIntensity: .4 }), seam: 0x9ff2c4, flame: 0x9ff2c4, pulse: true },
    gold: { hull: () => new THREE.MeshStandardMaterial({ color: 0xc8901f, metalness: 1, roughness: .2, envMapIntensity: 1.1 }), trim: () => new THREE.MeshStandardMaterial({ color: 0x9a6a14, metalness: 1, roughness: .26, envMapIntensity: 1 }), seam: 0xffe2a8, flame: 0xffc46b },
    prism: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0xdfe3ea, metalness: .7, roughness: .1, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0xc9c2ff, metalness: .8, roughness: .12, iridescence: 1, iridescenceIOR: 1.9 }), seam: 0xb79cff, flame: 0xcfe3ff, hue: true },
    arctic: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, metalness: 0, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, metalness: .1, roughness: .25, clearcoat: 1 }), seam: 0x8fd3ff, flame: 0xbfe3ff },
    ignition: { hull: () => new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, metalness: .1, roughness: .3, clearcoat: 1 }), trim: () => new THREE.MeshPhysicalMaterial({ color: 0xff7a3d, metalness: .3, roughness: .25, clearcoat: 1 }), seam: 0xff7a3d, flame: 0xffa060, pulse: true },
  };
  function applyFinish(root, id) {
    const f = FINISH[id]; if (!f || !root) return root; const ud = root.userData, hull = f.hull(), seamMat = new THREE.MeshBasicMaterial({ color: f.seam, toneMapped: false }), livery = ud.livery ? ud.livery.getHex() : -1;
    const M0 = materials(), trimSet = [M0.chrome, M0.ceramic, M0.graphite, M0.chromeDark], trim = f.trim ? f.trim() : hull;
    root.traverse((o) => { if (!o.isMesh) return; if (o.material === ud.hullMat) o.material = hull; else if (trimSet.includes(o.material)) o.material = trim; else if (o.material && o.material.isMeshBasicMaterial && !o.material.transparent && o.material.color && o.material.color.getHex() === livery) o.material = seamMat; });
    (ud.flames || []).forEach((fl) => { fl.material = fl.material.clone(); fl.material.uniforms.uColor.value = new THREE.Color(f.flame); });
    ud.finish = { id, seamMat, pulse: !!f.pulse, hue: !!f.hue, base: new THREE.Color(f.seam) };
    return root;
  }
  function animateFinish(root, t) {
    const fi = root && root.userData.finish; if (!fi) return;
    if (fi.hue) fi.seamMat.color.setHSL((t * .08) % 1, .8, .7);
    else if (fi.pulse) fi.seamMat.color.copy(fi.base).multiplyScalar(.65 + .55 * (.5 + .5 * Math.sin(t * 3.2)));
  }
  global.ForgeModels = { applyFinish, animateFinish, FINISHES: Object.keys(FINISH), studioEnvironment, pilot, walker, POSES, PALETTE, SKINS, materials, glowMat, soften, ship, enemy, boss, pickup, projectileGeometry, loft, plate, spike, flameMaterial };
})(window);
