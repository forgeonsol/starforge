/* $FORGE landing: same visual system as the game — studio-lit chrome on black, one rationed accent. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function pad(n) { return String(n).padStart(2, "0"); }

  // ---------------------------------------------------------------- i18n
  var ZH = {
 navToken: "代币", navLaunch: "上线", navBoard: "排行榜", lbLabel: "排行榜", lbTitle: "顶尖飞行员，实时排名。", lbIntro: "按每位飞行员的最佳竞技场成绩排名。完成一局，你的成绩就会出现在这里。", lbMore: "完整排行榜 →", navPilot: "飞行员", menu: "菜单", tokCta: "代币用途", tokLabel: "$FORGE 代币", tokTitle: "代币的用途。", tokIntro: "同一枚代币，贯通竞技场、飞行员战役与机库。",
    u1k: "商店", u1h: "游戏内购买", u1p: "使用代币购买战舰外观、飞行员服装、武器特效、地图通行权及其他外观升级。", u1a: "外观", u1b: "服装", u1c: "武器特效", u1d: "地图",
    u2k: "竞技", u2h: "竞技玩法", u2p: "使用代币参加特别首领突袭与锦标赛，表现最佳者可获得奖励。", u2a: "首领突袭", u2b: "锦标赛", u2c: "顶尖奖励",
    u3k: "解锁", u3h: "进度与准入", u3p: "使用代币解锁高级任务、限时活动与赛季内容。", u3a: "高级任务", u3b: "活动", u3c: "赛季",
    u4k: "每日", u4h: "每日回购", u4p: "将部分游戏费用用于定期的每日代币回购，具体受项目金库规则及可用收入约束。", u4a: "游戏费用", u4b: "定期执行", u4c: "金库规则",
    navRun: "玩法", navBoss: "首领", navHangar: "机库", navArmory: "军械库", navSectors: "区域", play: "开始", season: "游戏 + 代币 · 第一季",
    lede: "由 $FORGE 驱动的街机射击游戏。抵御蜂群，每四十秒击碎一位首领，用代币解锁战舰、突袭与锦标赛。",
    launch: "开始一局", pilotCta: "飞行员战役", tk1: "编号战舰", tk2: "模块", tk3: "飞行员任务", tk4: "首领", tag1: "铬面涂装 · 双引擎", tag2: "移动鼠标操控战舰",
    mLabel: "熔炉", manifesto: "每四十秒，蜂群就会更快。每次击杀都在叠加倍率。每一次擦弹都在为爆破充能。当钟声响起，巨物将穿过闸门。",
    certLabel: "规格", certTitle: "$FORGE 铸造了什么", certIntro: "一款游戏，两种模式，机库随你的飞行时间不断扩充。全部在浏览器中运行——无需安装，无需账号。",
    d1: "类型", v1: "3D 街机生存射击，另有横版飞行员战役", d2: "回合", v2: "四十秒，随后强化并迎战首领", d3: "机库", v3: "四十艘编号战舰：铬、陶瓷与石墨",
    d4: "军械库", v4: "十二个改变生存方式的模块", d5: "战役", v5: "十个世界，一百个任务，技能可带入竞技场", d6: "操作", v6: "键盘或触屏",
    runLabel: "一局", runTitle: "三个乐章，直到战舰报废。", runIntro: "连杀获得得分倍率，擦弹为熔炉爆破充能，冲刺可直接撞碎小怪。",
    b1t: "蜂群", b2t: "钟声", b3t: "首领", b1h: "守住防线", b1p: "碎片无人机成群而来，冲角兽锁定路线后猛冲，水蛭靠近时会吸走热能。",
    b2h: "选择强化", b2p: "钟声响起时三选一：增加炮管、更快扳机、穿透弹、僚机无人机或更多装甲。", b3h: "击碎首领", b3p: "每次冲锋都有预警。血量过半后，首领会变红并改变攻击方式。",
    bossLabel: "三位首领", bossTitle: "熔炉的首领。", bossIntro: "每位首领都有破绽。读懂它，你总能找到空间。",
    r1: "大范围齐射，随后旋出一圈只留一个缺口的弹环。", r2: "锁定一条线，闪光后沿线直冲。", r3: "喷出水蛭群，吸走你的热能。", r1t: "预警 · 双翼展开", r2t: "预警 · 航道闪光", r3t: "预警 · 甲片张开",
    pLabel: "第二模式", pTitle: "然后，走出驾驶舱。", pText: "十个世界、一百个徒步任务。训练的每项技能都会带回竞技场。", pGo: "打开战役",
    hangarLabel: "机库", hangarTitle: "四十艘编号战舰。", hangarIntro: "十艘通过飞行解锁，每七分钟一艘。其余三十艘在商店。",
    armoryLabel: "军械库", armoryTitle: "十二个模块。", armoryIntro: "模块解锁一次，永久生效。",
    sectorLabel: "区域", sectorTitle: "四片星空，四种规则。", sectorIntro: "抵达对应等级一次，区域即永久开放。",
    lv1: "等级 1 起", lv2: "等级 2 起", lv4: "等级 4 起", lv7: "等级 7 起",
    m1: "锈带", m1p: "开阔航道与漂浮岩石。所有飞行员的起点。", m2: "霓虹花园", m2p: "光环随节拍收紧，待在外面。", m3: "深渊反应堆", m3p: "炽热核心在一侧闪耀，随后换到另一侧。", m4: "寂静轨道", m4p: "重力把你拉向中心，逆向飞行。",
    k1: "飞行", k2: "向最近目标开火", k3: "冲刺撞碎小怪", k4: "熔炉爆破", k5: "暂停",
    finalLabel: "就绪", finalTitle: "熔炉已点燃。", finalText: "现在即可免费游玩。$FORGE 与游戏同步上线。", foot: "© 2026 星铸。金币、战舰与模块均为游戏内道具，不具现金价值。"
  };
  var MODS = [["Ion Core", "离子核心", "Faster heat regeneration", "热能恢复更快"], ["Phantom Hull", "幻影装甲", "One more hull point", "额外一格装甲"], ["Overdrive Array", "超频阵列", "Faster trigger", "射速提升"],
    ["Revenant Frame", "复苏机架", "More score per kill", "击杀得分提升"], ["Shard Magnet", "碎片磁吸器", "Wider pickup range", "拾取范围更大"], ["Chrono Greaves", "时序护胫", "Faster flight", "飞行更快"],
    ["Warden Drone", "守望无人机", "A drone that fires", "自动射击无人机"], ["Nova Capacitor", "新星电容器", "Bigger forge blast", "熔炉爆破更大"], ["Kinetic Lens", "动能透镜", "Rounds pierce", "子弹穿透"],
    ["Siphon Matrix", "虹吸矩阵", "Heal on boss kills", "击败首领回复"], ["Aurora Mantle", "极光披风", "A colder contrail", "冰晶尾迹"], ["Rift Walker", "裂隙行者", "A secret hull", "隐藏战舰"]];
  var HULLS = ["Signal Runner", "Dust Comet", "Tidal Prism", "Violet Warden", "Copper Finch", "Moonlit Kite", "Static Bloom", "Frost Circuit", "Solar Relic", "Ember Lynx", "Cinder Viper", "Glass Tempest", "Velvet Singularity", "Chrome Mantis", "Jade Afterburn", "Candy Fracture", "Deep Current", "Amber Oracle", "Ion Seraph", "Night Lotus", "Starforge Ace", "Polar Mirage", "Rose Engine", "Blue Hour", "Neon Sparrow", "Redshift Monarch", "Dream Eater", "Sapphire Howl", "Primal Aurora", "Halo Drift", "Rift Dancer", "Obsidian Bloom", "Electric Koi", "Mirage Drifter", "Quartz Wraith", "Prism Breaker", "Eclipse Herald", "Wildfire Bloom", "Last Light", "Zero Point"];
  var lang = "en";

  // hulls marquee (two rows, duplicated for a seamless loop)
  function hullCard(i) { var earned = i <= 10, zh = lang === "zh";
    return '<div class="hull' + (earned ? " earned" : "") + '"><div class="im"><span class="hull-no">No. ' + pad(i) + '</span><img src="assets/3d/ships/ship-' + pad(i) + '.webp" alt="' + HULLS[i - 1] + '" loading="lazy" decoding="async"></div><div class="meta"><b>' + HULLS[i - 1] + '</b><span class="hull-tag">' + (earned ? (zh ? "飞行解锁" : "Earned in flight") : (zh ? "机库商店" : "Hangar shop")) + "</span></div></div>"; }
  function fillTracks() { var h = ""; for (var i = 1; i <= 40; i++) h += hullCard(i); var t = $("#trackA"); if (t) t.innerHTML = h + h; }
  fillTracks();
  function renderMods() { var h = ""; MODS.forEach(function (m, k) { h += '<div class="mod"><span class="mono">' + pad(k + 1) + '</span><div class="im"><img src="assets/3d/modules/module-' + pad(k + 1) + '.webp" alt="" loading="lazy"></div><b>' + (lang === "zh" ? m[1] : m[0]) + "</b><small>" + (lang === "zh" ? m[3] : m[2]) + "</small></div>"; }); $("#mods").innerHTML = h; }

  var nodes = $$("[data-t]"); nodes.forEach(function (n) { n.dataset.en = n.textContent; });
  function setLang(l) {
    lang = l; document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    nodes.forEach(function (n) { n.textContent = l === "zh" && ZH[n.dataset.t] ? ZH[n.dataset.t] : n.dataset.en; });
    $$("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === l)); });
    renderMods(); fillTracks(); splitManifesto();
    try { localStorage.setItem("signal-language", l); } catch (e) {}
  }
  $$("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang); }); });

  // manifesto: words light up as the paragraph scrolls through the viewport
  var mWords = [], mLit = false;
  function splitManifesto() {
    var p = $("#manifesto"), txt = p.textContent, zh = lang === "zh";
    var parts = zh ? Array.from(txt) : txt.split(/(\s+)/);
    p.innerHTML = parts.map(function (w) { return /^\s+$/.test(w) ? w : '<span class="w">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>"; }).join("");
    mWords = $$(".w", p); mWords.forEach(function (w, i) { w.style.transitionDelay = (Math.min(i, 60) * (zh ? 14 : 34)) + "ms"; }); mLit = false; updateManifesto();
  }
  function updateManifesto() {
    if (!mWords.length || mLit) return; var r = $("#manifesto").getBoundingClientRect(), vh = window.innerHeight;
    if (reduce || r.top < vh * .92) { mLit = true; mWords.forEach(function (w) { w.classList.add("on"); }); }
  }
  var saved = null; try { saved = localStorage.getItem("signal-language"); } catch (e) {}
  setLang(saved === "zh" ? "zh" : "en");

  // ---------------------------------------------------------------- reveal, counters, header
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px 12% 0px", threshold: 0 }) : null;
  $$(".rv, .mask").forEach(function (el) { if (io && !reduce) io.observe(el); else el.classList.add("in"); });
  function countUp() { $$("[data-count]").forEach(function (el, i) { var to = +el.dataset.count, t0 = performance.now() + i * 90, dur = 1400; (function tick(now) { var k = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 4); el.textContent = String(Math.round(to * e)).padStart(to >= 100 ? 3 : 2, "0"); if (k < 1) requestAnimationFrame(tick); })(performance.now()); }); }
  var header = $("#top"), navLinks = $$(".top nav a"), sections = navLinks.map(function (a) { return $(a.getAttribute("href")); });
  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 40); updateManifesto();
    var y = window.scrollY + window.innerHeight * .35, cur = -1; sections.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; }); navLinks.forEach(function (a, i) { a.classList.toggle("on", i === cur); });
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  var menuBtn = $("#menuBtn"); function setMenu(on) { header.classList.toggle("open", on); if (menuBtn) menuBtn.setAttribute("aria-expanded", String(on)); document.documentElement.classList.toggle("menu-open", on); }
  if (menuBtn) menuBtn.addEventListener("click", function () { setMenu(!header.classList.contains("open")); });
  navLinks.forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  // cursor light + card tilt
  var glow = $("#glow"), mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
  window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
  $$(".tilt").forEach(function (card) {
    card.addEventListener("pointermove", function (e) { if (reduce || e.pointerType !== "mouse") return; var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; card.style.transform = "perspective(900px) rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg) translateY(-4px)"; });
    card.addEventListener("pointerleave", function () { card.style.transform = ""; });
  });

  // ---------------------------------------------------------------- guardians: idle frames while in view, faster on hover
  // live turntables: the arena's own boss models, spinning, draggable, and enraged on hover
  var bossRows = $$(".boss"), bossVisible = false, bossViews = [];
  if (io) new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.__vis = e.isIntersecting; }); bossVisible = bossRows.some(function (b) { return b.__vis; }); }, { rootMargin: "120px 0px" }).observe($(".bosses-list"));
  if (io) bossRows.forEach(function (b) { new IntersectionObserver(function (es) { b.__vis = es[0].isIntersecting; bossVisible = bossRows.some(function (r) { return r.__vis; }); }, { rootMargin: "80px 0px" }).observe(b); });
  bossRows.forEach(function (row) { row.addEventListener("pointerenter", function () { row.hot = true; }); row.addEventListener("pointerleave", function () { row.hot = false; }); });
  function initBossViews(only) {
    var THREE = window.THREE, F = window.ForgeModels; if (!THREE || !F) return;
    var ACC = [0xff7a3d, 0x4aa8ff, 0x3fe0c5], SIGNAL = new THREE.Color(0xff4a2e);
    bossRows.forEach(function (row, k) {
      if (only !== undefined && k !== only) return; if (row.__built) return; row.__built = true;
      var box = $(".gimg", row), cv = document.createElement("canvas"), renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return; }
      box.appendChild(cv); box.classList.add("live");
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputEncoding = THREE.sRGBEncoding; renderer.setClearColor(0x000000, 0);
      var scene = new THREE.Scene(); scene.environment = F.studioEnvironment(renderer);
      var cam = new THREE.PerspectiveCamera(28, 1.5, 1, 2000); cam.position.set(0, 200, 360); cam.lookAt(0, -4, 0);
      var key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-200, 400, 260); scene.add(key);
      var rim = new THREE.DirectionalLight(0xcfe3ff, 1.4); rim.position.set(260, 80, -300); scene.add(rim);
      var lamp = new THREE.PointLight(ACC[k], 2.4, 320); lamp.position.set(0, 40, 40); scene.add(lamp);
      var model = F.boss(k, ACC[k]); model.scale.setScalar(k === 0 ? 66 : k === 1 ? 70 : 72); scene.add(model);
      var floor = new THREE.Mesh(new THREE.RingGeometry(70, 71.5, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -42; scene.add(floor);
      var floor2 = new THREE.Mesh(new THREE.RingGeometry(96, 96.8, 96), new THREE.MeshBasicMaterial({ color: ACC[k], transparent: true, opacity: .25 })); floor2.rotation.x = -Math.PI / 2; floor2.position.y = -42; scene.add(floor2);
      var view = { renderer: renderer, scene: scene, cam: cam, model: model, lamp: lamp, ring: floor2, k: k, row: row, cv: cv, yaw: k * 1.4, vel: .45, rage: 0, t: k * 2, drag: null, accent: new THREE.Color(ACC[k]), SIGNAL: SIGNAL, F: F };
      function size() { var w = box.clientWidth, h = box.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      size(); window.addEventListener("resize", size);
      cv.addEventListener("pointerdown", function (e) { view.drag = { x: e.clientX, last: e.clientX, t: performance.now() }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", function (e) { if (!view.drag) return; var dx = e.clientX - view.drag.last, now = performance.now(); view.drag.last = e.clientX; view.yaw += dx * .012; view.vel = dx * .012 / Math.max(.008, (now - view.drag.t) / 1000); view.drag.t = now; });
      var up = function () { view.drag = null; view.vel = Math.max(-6, Math.min(6, view.vel)); }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      bossViews.push(view);
    });
  }
  function renderBoss(v, dt) {
    var P = v.model.userData.parts, hot = v.row.hot ? 1 : 0; v.t += dt; v.rage += (hot - v.rage) * Math.min(1, dt * 3);
    if (!v.drag) { var base = .45 + v.rage * .9; v.vel += (base - v.vel) * Math.min(1, dt * 1.6); v.yaw += v.vel * dt; }
    v.model.rotation.y = v.yaw; v.model.position.y = Math.sin(v.t * 1.4) * 4; v.model.rotation.z = Math.sin(v.t * .9) * .04;
    var c = v.t, pulse = 1 + .12 * Math.sin(c * (4 + v.rage * 6)), col = v.rage > .5 ? v.SIGNAL : v.accent;
    P.core.material = v.F.glowMat(col.getHex()); P.seams.forEach(function (m) { m.material = v.F.glowMat(col.getHex()); });
    if (v.k === 0) { P.wings.forEach(function (w, i) { var s2 = i ? 1 : -1; w.rotation.z = s2 * (Math.sin(c * (2.2 + v.rage * 2)) * .22 + .08 + v.rage * .18); }); P.tail.forEach(function (t, i) { t.position.x = Math.sin(c * 3 - i * .7) * .05 * (i + 1); }); P.core.scale.setScalar(.12 * pulse * (1 + v.rage * .3)); }
    else if (v.k === 1) { P.heads.forEach(function (h, i) { h.rotation.x = c * (1 + v.rage) * (i ? 1 : -1) * .6; h.position.x = (i ? 1 : -1) * (.92 - v.rage * .12); }); P.core.scale.set(.12 * pulse, .2 * pulse, .12 * pulse); }
    else { var br = .08 * Math.sin(c * 1.8) + v.rage * .3; P.plates.forEach(function (pl, i) { pl.position.copy(pl.userData.home).addScaledVector(pl.userData.normal, br + .02 * Math.sin(c * 3 + i)); }); if (P.coreGlass) { P.coreGlass.rotation.x += dt * .6; P.coreGlass.rotation.y += dt * .9; } P.core.scale.setScalar(.16 * pulse * (1 + v.rage * .4)); }
    v.lamp.color.copy(col); v.lamp.intensity = 2.2 + v.rage * 2 + Math.sin(c * 5) * .3; v.ring.material.color.copy(col); v.ring.rotation.z += dt * .2;
    v.renderer.render(v.scene, v.cam);
  }

  // ---------------------------------------------------------------- pilot strip: a playable mini-run. Autopilot by default; tap / click / Space to take over.
  var pcv = $("#pilotCv"), pctx = pcv.getContext("2d"), pilotVisible = false, pW = 0, pH = 0, pdpr = 1;
  // sprites download only when the pilot stage gets close
  var lazyIm = [], imLoaded = false; function im_(src) { var im = new Image(); im.decoding = "async"; if (imLoaded) im.src = src; else { im.__src = src; lazyIm.push(im); } return im; }
  function loadPilotSprites() { if (imLoaded) return; imLoaded = true; lazyIm.forEach(function (im) { im.src = im.__src; }); }
  if (io) { var pio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { pio.disconnect(); loadPilotSprites(); } }, { rootMargin: "1400px 0px" }); pio.observe($("#pilotStrip") || pcv); } else imLoaded = true;
  var pRun = [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return im_("assets/3d/pilot-a/p-0" + i + ".webp"); });
  var pAir = [17, 18, 19].map(function (i) { return im_("assets/3d/pilot-a/p-" + i + ".webp"); }), pDash = im_("assets/3d/pilot-a/p-21.webp");
  var foeIm = [0, 1, 2, 3, 4, 5, 6, 7].map(function (f) { return im_("assets/3d/foes/foe-0-" + f + ".webp"); });
  var droneIm = [0, 1, 2, 3, 4, 5, 6, 7].map(function (f) { return im_("assets/3d/foes/foe-1-" + f + ".webp"); });
  function sizePilot() { var r = pcv.getBoundingClientRect(); pdpr = Math.min(2, devicePixelRatio || 1); pW = r.width; pH = r.height; pcv.width = Math.round(pW * pdpr); pcv.height = Math.round(pH * pdpr); }
  sizePilot(); window.addEventListener("resize", sizePilot);
  if (io) new IntersectionObserver(function (es) { pilotVisible = es[0].isIntersecting; }).observe(pcv);
  function seeded(n) { var s = n * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  var ridgeA = [], ridgeB = []; (function () { var r = seeded(7); for (var i = 0; i < 40; i++) { ridgeA.push(.25 + r() * .75); ridgeB.push(.3 + r() * .7); } })();

  // course in "design units" (1u = 1px at a 400px-tall strip); everything is scaled by k when drawn
  var G = { scroll: 0, last: 0, gen: 0, rnd: seeded(11), gaps: [], plats: [], spikes: [], coins: [], foes: [], stars: [], fx: [], pops: [], dust: [],
    p: { y: 0, vy: 0, ground: true, dj: true, coyote: 0, flip: 0, flipOn: false, squash: 0, inv: 0, run: 0, air: 0 }, coins_: 0, best: 0, combo: 0, manualT: 0, flash: 0, ring: 0 };
  var SPEED = 240, GRAV = 2400, JUMP = 770, PX = 0.56;
  function genChunk() {
    var r = G.rnd, x = G.gen;
    if (x < 400) { G.gen = 400; for (var i = 0; i < 4; i++) G.coins.push({ x: 220 + i * 30, y: 46 }); return; }
    var kind = r();
    if (kind < .34) { // chasm with a coin arc
      var gw = 60 + r() * 50; G.gaps.push({ x: x, w: gw }); for (var c = 0; c < 4; c++) { var t = c / 3; G.coins.push({ x: x - 24 + (gw + 48) * t, y: 60 + Math.sin(t * Math.PI) * 66 }); } G.gen = x + gw + 120 + r() * 60;
    } else if (kind < .62) { // floating plate over a chasm, coins on top
      var gw2 = 90 + r() * 70, pw = 130 + r() * 50, ph = 70 + r() * 24; G.gaps.push({ x: x + 30, w: gw2 }); G.plats.push({ x: x + 30 + gw2 / 2 - pw / 2, y: ph, w: pw });
      for (var c2 = 0; c2 < 4; c2++) G.coins.push({ x: x + 30 + gw2 / 2 - 39 + c2 * 26, y: ph + 30 });
      if (r() < .35) G.stars.push({ x: x + 30 + gw2 / 2, y: ph + 70, taken: false });
      G.gen = x + 30 + gw2 + 150 + r() * 60;
    } else if (kind < .82) { // walker on solid ground
      G.foes.push({ x: x + 60, dead: false, ph: r() * 8, t: 0 }); for (var c3 = 0; c3 < 3; c3++) G.coins.push({ x: x + 10 + c3 * 26, y: 44 }); G.gen = x + 220 + r() * 60;
    } else { // spikes, plus a stepping plate above them
      var sw = 44 + r() * 30; G.spikes.push({ x: x + 40, w: sw }); if (r() < .5) { G.plats.push({ x: x + 10, y: 84, w: sw + 80 }); for (var c4 = 0; c4 < 3; c4++) G.coins.push({ x: x + 50 + c4 * 24, y: 114 }); } else for (var c5 = 0; c5 < 3; c5++) { var t5 = c5 / 2; G.coins.push({ x: x + 24 + (sw + 32) * t5, y: 60 + Math.sin(t5 * Math.PI) * 54 }); }
      G.gen = x + sw + 200 + r() * 50;
    }
  }
  function gapAt(x) { for (var i = 0; i < G.gaps.length; i++) { var g = G.gaps[i]; if (x > g.x && x < g.x + g.w) return g; } return null; }
  function stripJump(manual) { var P = G.p; if (!(P.ground || P.coyote > 0)) { if (!P.dj) return false; P.dj = false; P.vy = JUMP * .86; P.flipOn = true; P.flip = 0; P.squash = -1; for (var i = 0; i < 12; i++) G.fx.push({ x: G.scroll + vw() * PX - 14, y: P.y + 40, vx: -60 - Math.random() * 120, vy: -120 - Math.random() * 220, l: .4, c: i % 2 ? "#cfe3ff" : "#ffffff", r: Math.random() * 6 }); pop(G.scroll + vw() * PX, P.y + 150, "JET", "#cfe3ff"); return true; } P.vy = JUMP; P.ground = false; P.coyote = 0; P.squash = -1; P.air = 0; P.flipOn = manual ? Math.random() < .5 : Math.random() < .55; P.flip = 0; burstDust(10); return true; }
  function burstDust(n) { var x = G.scroll + vw() * PX; for (var i = 0; i < n; i++) { var d = i % 2 ? 1 : -1; G.dust.push({ x: x + d * Math.random() * 8, y: G.p.y, vx: d * (40 + Math.random() * 120), vy: 20 + Math.random() * 50, l: .45 + Math.random() * .3 }); } }
  function pop(x, y, txt, col) { G.pops.push({ x: x, y: y, txt: txt, col: col || "#ffffff", l: .9 }); }
  function hurt() { var P = G.p; if (P.inv > 0) return; P.inv = 1; P.vy = 620; P.ground = false; G.combo = 0; G.flash = .35; pop(G.scroll + vw() * PX, P.y + 120, "−COMBO", "#ff4a2e"); }
  function KS() { return pW < 640 ? pH * .6 / 400 : pH / 400; }
  function vw() { return pW / KS(); }
  pcv.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest("a")) return; G.manualT = 5; stripJump(true); });
  document.addEventListener("keydown", function (e) { if (!pilotVisible || e.code !== "Space" || /input|textarea/i.test(document.activeElement.tagName)) return; var r = pcv.getBoundingClientRect(); if (r.top > innerHeight * .8 || r.bottom < innerHeight * .2) return; e.preventDefault(); G.manualT = 5; stripJump(true); });

  function stepStrip(dt) {
    var P = G.p, W = vw(), px = G.scroll + W * PX;
    G.scroll += SPEED * dt; px = G.scroll + W * PX;
    while (G.gen < G.scroll + W + 400) genChunk();
    var cut = G.scroll - 200; ["gaps", "plats", "spikes"].forEach(function (k) { G[k] = G[k].filter(function (o) { return o.x + (o.w || 0) > cut; }); }); G.coins = G.coins.filter(function (o) { return o.x > cut && !o.taken; }); G.foes = G.foes.filter(function (o) { return o.x > cut; }); G.stars = G.stars.filter(function (o) { return o.x > cut && !o.taken; });
    G.manualT = Math.max(0, G.manualT - dt); P.inv = Math.max(0, P.inv - dt); G.flash = Math.max(0, G.flash - dt); G.ring = Math.max(0, G.ring - dt); P.squash += (0 - P.squash) * Math.min(1, dt * 10); P.run += dt * 15;
    // autopilot: reads hazards ahead and jumps for coins on plates
    if (G.manualT <= 0 && P.ground) {
      var look0 = px - 4, look1 = px + 14 + SPEED * .13, want = false;
      G.gaps.forEach(function (g) { if (g.x > look0 && g.x < look1 && P.y < 1) want = true; });
      G.spikes.forEach(function (s) { if (s.x > look0 && s.x < look1 && P.y < 1) want = true; });
      G.foes.forEach(function (f) { if (!f.dead && f.x - px > 50 && f.x - px < 110) want = true; });
      G.plats.forEach(function (pl) { if (P.y < 1 && pl.x - px > 30 && pl.x - px < 70) want = true; if (P.y > 1 && Math.abs(P.y - pl.y) < 2 && pl.x + pl.w - px < 34 && pl.x + pl.w - px > 0) want = true; });
      if (P.y < 1 && gapAt(px + 12)) want = true;
      if (want) stripJump(false);
    }
    if (G.manualT <= 0 && !P.ground && P.vy < 0 && P.dj && P.y < 40 && gapAt(px + 6)) stripJump(false);
    // physics
    var prevY = P.y; P.vy -= GRAV * dt; P.y += P.vy * dt; var landed = false;
    if (!gapAt(px) && P.y <= 0 && prevY >= -4) { P.y = 0; landed = true; }
    G.plats.forEach(function (pl) { if (P.vy <= 0 && px > pl.x - 8 && px < pl.x + pl.w + 8 && prevY >= pl.y - 1 && P.y <= pl.y) { P.y = pl.y; landed = true; } });
    if (landed) { if (!P.ground && P.air > .15) { P.squash = 1; burstDust(12); } P.vy = 0; P.ground = true; P.dj = true; P.coyote = .1; P.flip = 0; P.flipOn = false; P.air = 0; }
    else { if (P.ground) { P.coyote = .1; } P.ground = false; P.coyote = Math.max(0, P.coyote - dt); P.air += dt; if (P.flipOn) P.flip = Math.min(1, P.flip + dt / .62); }
    if (P.y < -260) { G.falls = (G.falls || 0) + 1; // fell: re-materialise on the next solid ground
      var nx = px + 40; while (gapAt(nx)) nx += 20; G.scroll = nx - W * PX; P.y = 120; P.vy = 0; P.inv = 1.2; G.combo = 0; G.ring = .6; G.flash = .3;
    }
    // spikes, foes, pickups
    G.spikes.forEach(function (s) { if (P.y < 18 && px > s.x - 6 && px < s.x + s.w + 6) hurt(); });
    G.foes.forEach(function (f) { if (f.dead) { f.t += dt; return; } if (!gapAt(f.x - 34)) f.x -= 46 * dt; var dx = Math.abs(f.x - px);
      if (dx < 34 && P.y < 56) { if (P.vy < -80 && P.y > 26) { f.dead = true; f.t = 0; P.vy = 640; P.flipOn = true; P.flip = 0; G.combo++; pop(f.x, 90, "+25 · STOMP"); for (var i = 0; i < 14; i++) G.fx.push({ x: f.x, y: 34, vx: (Math.random() - .5) * 360, vy: 120 + Math.random() * 260, l: .7, c: i % 3 ? "#3a3d44" : "#ffffff", r: Math.random() * 6 }); } else hurt(); } });
    G.coins.forEach(function (c) { if (!c.taken && Math.abs(c.x - px) < 22 && Math.abs(c.y - (P.y + 44)) < 40) { c.taken = true; G.coins_++; G.combo++; pop(c.x, c.y + 18, "+1"); for (var i = 0; i < 6; i++) G.fx.push({ x: c.x, y: c.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .2) * 200, l: .45, c: i % 2 ? "#9ff2c4" : "#ffffff", r: Math.random() * 6 }); } });
    G.stars.forEach(function (s) { if (!s.taken && Math.abs(s.x - px) < 26 && Math.abs(s.y - (P.y + 44)) < 44) { s.taken = true; G.ring = .7; G.coins_ += 5; pop(s.x, s.y + 24, "NOVA STAR · +5", "#9ff2c4"); G.foes.forEach(function (f) { if (!f.dead && f.x - px < 420) { f.dead = true; f.t = 0; } }); } });
    G.best = Math.max(G.best, G.combo);
    G.fx.forEach(function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 700 * dt; q.l -= dt; q.r += dt * 10; }); G.fx = G.fx.filter(function (q) { return q.l > 0; });
    G.dust.forEach(function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 120 * dt; q.l -= dt; }); G.dust = G.dust.filter(function (q) { return q.l > 0; });
    G.pops.forEach(function (q) { q.y += 40 * dt; q.l -= dt; }); G.pops = G.pops.filter(function (q) { return q.l > 0; });
  }

  window.__strip = G;
  function drawPilot(t) {
    var dt = Math.min(.05, Math.max(0, t - (G.lastT || t))); G.lastT = t; if (!reduce) stepStrip(dt);
    var c = pctx, w = pW, h = pH, narrow = w < 640, floor = narrow ? h * .8 : h * .8, k = KS(), scroll = G.scroll * k, S = function (x) { return (x - G.scroll) * k; }, Y = function (y) { return floor - y * k; };
    c.setTransform(pdpr, 0, 0, pdpr, 0, 0);
    var sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#050506"); sky.addColorStop(.75, "#0e0d10"); sky.addColorStop(1, "#060607"); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    var gl = c.createRadialGradient(w * .72, h * .38, 0, w * .72, h * .38, h * .9); gl.addColorStop(0, "rgba(255,196,107,.14)"); gl.addColorStop(1, "rgba(255,196,107,0)"); c.fillStyle = gl; c.fillRect(0, 0, w, h);
    var ex = w * .74, ey = narrow ? h * .5 : h * .34, er = Math.min(h * .19, w * .17); c.fillStyle = "#020203"; c.beginPath(); c.arc(ex, ey, er, 0, 7); c.fill(); c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 1.4; c.beginPath(); c.arc(ex, ey, er, Math.PI * .95, Math.PI * 2.25); c.stroke(); c.strokeStyle = "rgba(255,255,255,.12)"; c.beginPath(); c.ellipse(ex, ey, er * 2, er * .32, -.18, 0, 7); c.stroke();
    function ridge(arr, par, base, amp, fill, line) { var step = w / 10; c.beginPath(); c.moveTo(0, h); for (var i = -1; i < 14; i++) { var idx = ((i + Math.floor(scroll * par / step)) % arr.length + arr.length) % arr.length, x = i * step - (scroll * par) % step; c.lineTo(x, base - arr[idx] * amp); } c.lineTo(w, h); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 1; c.stroke(); }
    ridge(ridgeA, .08, floor - 20 * k, 90 * k, "#0d0e11", "rgba(255,255,255,.1)");
    for (var pi = -1; pi < 9; pi++) { var px0 = pi * 220 * k - (scroll * .3) % (220 * k), ph = (110 + (pi * 37 + 400) % 90) * k; c.fillStyle = "#0b0c0f"; c.fillRect(px0, floor - ph, 3, ph); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(px0, floor - ph, 1, ph); c.fillStyle = Math.sin(t * 2 + pi) > .5 ? "#ffc46b" : "rgba(255,196,107,.3)"; c.fillRect(px0 - 2, floor - ph - 4, 7, 3); }
    ridge(ridgeB, .16, floor + 4, 60 * k, "#08080a", "rgba(255,196,107,.16)");
    // ground slabs with chasms
    var a = G.scroll - 40, spans = [], cur = a; G.gaps.slice().sort(function (u, v) { return u.x - v.x; }).forEach(function (g) { if (g.x + g.w < a) return; if (g.x > cur) spans.push([cur, g.x]); cur = Math.max(cur, g.x + g.w); }); spans.push([cur, G.scroll + vw() + 40]);
    spans.forEach(function (sp) { var x0 = S(sp[0]), x1 = S(sp[1]); c.fillStyle = "#1d1e23"; c.fillRect(x0, floor - 4, x1 - x0, 12); c.fillStyle = "#08080a"; c.fillRect(x0, floor + 8, x1 - x0, h - floor); c.fillStyle = "rgba(255,255,255,.85)"; c.fillRect(x0, floor + 8, x1 - x0, 1);
      c.strokeStyle = "rgba(255,255,255,.07)"; c.beginPath(); for (var gx = Math.ceil(sp[0] / 40) * 40; gx < sp[1]; gx += 40) { var sx = S(gx); c.moveTo(sx + (sx - w / 2) * .05, floor - 4); c.lineTo(sx, floor + 8); } c.stroke(); });
    G.gaps.forEach(function (g) { var x0 = S(g.x), x1 = S(g.x + g.w); var gg = c.createLinearGradient(0, floor, 0, h); gg.addColorStop(0, "rgba(255,74,46,.09)"); gg.addColorStop(1, "rgba(255,74,46,0)"); c.fillStyle = gg; c.fillRect(x0, floor, x1 - x0, h - floor); c.fillStyle = "rgba(255,74,46,.9)"; c.fillRect(x0 - 1, floor - 4, 1.5, 40 * k); c.fillRect(x1, floor - 4, 1.5, 40 * k); });
    G.spikes.forEach(function (s) { var n = Math.max(2, Math.round(s.w / 14)), sw = s.w / n; for (var i = 0; i < n; i++) { var x1 = S(s.x + i * sw), tip = x1 + sw * .45 * k, hh = (18 + (i % 2) * 6) * k; c.beginPath(); c.moveTo(x1, floor + 2); c.lineTo(tip, floor - hh); c.lineTo(tip, floor + 2); c.closePath(); c.fillStyle = "#ff6a4d"; c.fill(); c.beginPath(); c.moveTo(tip, floor - hh); c.lineTo(x1 + sw * k, floor + 2); c.lineTo(tip, floor + 2); c.closePath(); c.fillStyle = "#8a1a0c"; c.fill(); } c.fillStyle = "#ff4a2e"; c.fillRect(S(s.x) - 2, floor + 2, s.w * k + 4, 1.5); });
    G.plats.forEach(function (pl) { var x = S(pl.x), y = Y(pl.y), pw = pl.w * k; c.fillStyle = "rgba(0,0,0,.4)"; if (!gapAt(pl.x + pl.w / 2)) { c.beginPath(); c.ellipse(x + pw / 2, floor + 2, pw * .45, 3, 0, 0, 7); c.fill(); }
      c.beginPath(); c.moveTo(x + 3, y - 5 * k); c.lineTo(x + pw - 3, y - 5 * k); c.lineTo(x + pw, y + 2); c.lineTo(x, y + 2); c.closePath(); c.fillStyle = "#26282e"; c.fill();
      c.fillStyle = "#101114"; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + pw, y + 2); c.lineTo(x + pw - 6, y + 16 * k); c.lineTo(x + 6, y + 16 * k); c.closePath(); c.fill(); c.fillStyle = "rgba(255,255,255,.9)"; c.fillRect(x, y + 2, pw, 1); c.fillStyle = "rgba(255,196,107,.7)"; c.fillRect(x + 12, y + 16 * k, pw - 24, 1);
      var tg = c.createRadialGradient(x + pw / 2, y + 22 * k, 0, x + pw / 2, y + 22 * k, 26 * k); tg.addColorStop(0, "rgba(255,196,107,.35)"); tg.addColorStop(1, "rgba(255,196,107,0)"); c.fillStyle = tg; c.fillRect(x, y + 4, pw, 50 * k); });
    // coins & stars
    G.coins.forEach(function (cn) { if (cn.taken) return; var x = S(cn.x), y = Y(cn.y) + Math.sin(t * 3 + cn.x) * 2 * k, sp = Math.cos(t * 3 + cn.x * .05), cw = Math.max(1.5, Math.abs(sp) * 9 * k); c.fillStyle = "#16171b"; c.beginPath(); c.ellipse(x + (sp > 0 ? 1.5 : -1.5), y, cw, 11 * k, 0, 0, 7); c.fill(); var cg = c.createLinearGradient(x - cw, y - 11 * k, x + cw, y + 11 * k); cg.addColorStop(0, "#ffffff"); cg.addColorStop(.5, "#9aa0aa"); cg.addColorStop(1, "#25282e"); c.fillStyle = cg; c.beginPath(); c.ellipse(x, y, cw, 11 * k, 0, 0, 7); c.fill(); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 1; c.stroke(); if (Math.abs(sp) > .4) { c.fillStyle = "#9ff2c4"; c.fillRect(x - 1.2, y - 3.5 * k, 2.4, 7 * k); } });
    G.stars.forEach(function (s) { if (s.taken) return; var x = S(s.x), y = Y(s.y) + Math.sin(t * 2.4) * 4 * k, r = 13 * k, rot = t * 1.6; var sg = c.createRadialGradient(x, y, 0, x, y, r * 3); sg.addColorStop(0, "rgba(159,242,196,.5)"); sg.addColorStop(1, "rgba(159,242,196,0)"); c.fillStyle = sg; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.beginPath(); for (var i = 0; i < 4; i++) { var aa = rot + i * Math.PI / 2; c.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r * 1.3); } c.closePath(); c.fillStyle = "#6fcf9f"; c.fill(); c.strokeStyle = "#fff"; c.stroke(); });
    // walkers
    var fs = 118 * k; G.foes.forEach(function (f) { var x = S(f.x); if (x < -fs || x > w + fs) return; if (f.dead) { if (f.t < .35) { c.save(); c.globalAlpha = 1 - f.t / .35; c.translate(x, floor + 8); c.scale(-1.2, 1 - f.t * 2); var di = foeIm[0]; if (di.complete && di.naturalWidth) c.drawImage(di, -fs / 2, -fs, fs, fs); c.restore(); } return; } var fi = foeIm[Math.floor(t * 14 + f.ph) % 8]; c.fillStyle = "rgba(0,0,0,.45)"; c.beginPath(); c.ellipse(x, floor + 9, fs * .32, 4, 0, 0, 7); c.fill(); if (fi.complete && fi.naturalWidth) { c.save(); c.translate(x, floor + 8); c.scale(-1, 1); c.drawImage(fi, -fs / 2, -fs, fs, fs); c.restore(); } });
    // pilot
    var P = G.p, ps = 150 * k, pxs = w * PX, py = Y(P.y) + 8, sq = P.squash, sx = 1 + (sq > 0 ? sq * .16 : sq * -.1), sy = 1 - (sq > 0 ? sq * .2 : sq * -.14), fl = P.flip, rot = P.flipOn ? (fl < .5 ? 4 * fl * fl * fl : 1 - Math.pow(-2 * fl + 2, 3) / 2) * Math.PI * 2 : (P.ground ? 0 : Math.max(-.15, Math.min(.15, -P.vy * .0002)));
    var pim = P.ground ? pRun[Math.floor(P.run) % 8] : P.vy > 300 ? pAir[0] : P.vy > -300 ? pAir[1] : pAir[2];
    var shY = gapAt(G.scroll + vw() * PX) ? null : floor; G.plats.forEach(function (pl) { var lx = G.scroll + vw() * PX; if (lx > pl.x && lx < pl.x + pl.w && pl.y <= P.y + 1) shY = Y(pl.y); });
    if (shY !== null) { var dd = Math.max(0, Math.min(1, (shY - py) / (160 * k))); c.fillStyle = "rgba(0,0,0," + (.5 - dd * .35) + ")"; c.beginPath(); c.ellipse(pxs, shY + 2, 28 * k * (1 - dd * .5), 4, 0, 0, 7); c.fill(); }
    function body(img, x, y, r, al, ssx, ssy) { if (!img.complete || !img.naturalWidth) return; c.save(); c.globalAlpha = al; c.translate(x, y - ps * .45); c.rotate(r); c.scale(ssx, ssy); c.drawImage(img, -ps * .375, -ps * .55, ps * .75, ps); c.restore(); }
    if (!P.ground) { c.save(); c.globalCompositeOperation = "lighter"; for (var gi = 1; gi <= 3; gi++) body(pAir[1], pxs - gi * 13 * k, py + P.vy * gi * .012 * k, rot - gi * .25 * (P.flipOn ? 1 : 0), .12 / gi, 1, 1); c.restore(); }
    if (G.ring > 0) { c.strokeStyle = "#9ff2c4"; c.globalAlpha = G.ring / .7; c.lineWidth = 2; c.beginPath(); c.arc(pxs, py - 60 * k, (1 - G.ring / .7) * 380 * k, 0, 7); c.stroke(); c.globalAlpha = 1; }
    var blink = P.inv > 0 ? .5 + .5 * Math.cos(t * 26) : 1; body(pim, pxs, py, rot, blink, sx, sy);
    if (P.ground && pim.complete && pim.naturalWidth) { c.save(); c.globalAlpha = .12; c.translate(0, (py + 1) * 2); c.scale(1, -1); c.drawImage(pim, pxs - ps * .375, py - ps, ps * .75, ps); c.restore(); }
    // particles, dust, pops
    G.dust.forEach(function (q) { c.fillStyle = "rgba(220,224,232," + (q.l * .5) + ")"; c.beginPath(); c.arc(S(q.x), Y(q.y) + 8, (1.2 - q.l) * 5 * k + 1, 0, 7); c.fill(); });
    c.save(); c.globalCompositeOperation = "lighter"; G.fx.forEach(function (q) { var x = S(q.x), y = Y(q.y), s = 3 * k; c.globalAlpha = Math.max(0, q.l * 1.6); c.fillStyle = q.c; c.beginPath(); c.moveTo(x + Math.cos(q.r) * s * 1.6, y + Math.sin(q.r) * s * 1.6); c.lineTo(x - Math.sin(q.r) * s, y + Math.cos(q.r) * s); c.lineTo(x - Math.cos(q.r) * s, y - Math.sin(q.r) * s); c.closePath(); c.fill(); }); c.restore(); c.globalAlpha = 1;
    c.textAlign = "center"; G.pops.forEach(function (q) { c.globalAlpha = Math.min(1, q.l * 2); c.fillStyle = q.col; c.font = "500 " + Math.round(11 * k + 2) + "px 'Geist Mono', monospace"; c.fillText(q.txt, S(q.x), Y(q.y)); }); c.globalAlpha = 1; c.textAlign = "left";
    var fade = c.createLinearGradient(0, floor + 9, 0, h); fade.addColorStop(0, "rgba(8,8,10,.2)"); fade.addColorStop(1, "rgba(8,8,10,1)"); c.fillStyle = fade; c.fillRect(0, floor + 9, w, h - floor);
    var v = c.createLinearGradient(0, 0, w * .42, 0); v.addColorStop(0, "rgba(6,6,7,.8)"); v.addColorStop(1, "rgba(6,6,7,0)"); c.fillStyle = v; c.fillRect(0, 0, w * .42, h);
    if (G.flash > 0) { c.strokeStyle = "rgba(255,74,46," + G.flash * 2 + ")"; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8); }
    // mini HUD
    var m = Math.floor(G.scroll / 40), hudY = h - 18; c.font = "500 10px 'Geist Mono', monospace"; c.textAlign = "right"; c.fillStyle = "rgba(255,255,255,.55)";
    if (!narrow) c.fillText("COINS " + String(G.coins_).padStart(3, "0") + "   ·   " + String(m).padStart(4, "0") + " M   ·   COMBO ×" + G.combo + "   ·   BEST ×" + G.best, w - 20, hudY);
    else { c.fillText("◈ " + String(G.coins_).padStart(3, "0") + " · ×" + G.combo, w - 16, floor - 8 - 150 * k); }
    c.textAlign = "left"; var manual = G.manualT > 0, label = manual ? (lang === "zh" ? "手动驾驶" : "MANUAL") : narrow ? (lang === "zh" ? "点击跳跃" : "TAP TO JUMP") : (lang === "zh" ? "自动驾驶 · 点击跳跃 · 空中再点喷射" : "AUTOPILOT · TAP TO JUMP · TAP AGAIN FOR JET");
    c.font = "500 10px 'Geist Mono', monospace"; var lw = c.measureText(label).width + 26; var lx = narrow ? w - lw - 14 : 20; c.fillStyle = manual ? "#9ff2c4" : "rgba(255,255,255,.08)"; c.beginPath(); c.roundRect ? c.roundRect(lx, hudY - 14, lw, 22, 11) : c.rect(lx, hudY - 14, lw, 22); c.fill(); c.strokeStyle = "rgba(255,255,255,.18)"; c.stroke();
    c.fillStyle = manual ? "#0b0b0c" : "rgba(255,255,255,.8)"; c.fillText(label, lx + 13, hudY + 1);
  }

  // ---------------------------------------------------------------- hero: the arena's own chrome hull, studio-lit, steered by the cursor
  var stage = $("#stage"), hero = $("#hero"), heroVisible = true, gl3 = null;
  if (io) new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; }).observe(hero);
  function initStage() {
    var THREE = window.THREE, F = window.ForgeModels; if (!THREE || !F) return null;
    var renderer; try { renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputEncoding = THREE.sRGBEncoding; renderer.setClearColor(0x000000, 0); window.__forgeRenderer = renderer;
    var scene = new THREE.Scene(); scene.environment = F.studioEnvironment(renderer); scene.fog = new THREE.Fog(0x060607, 500, 1500);
    var cam = new THREE.PerspectiveCamera(30, 1, 1, 4000); cam.position.set(0, 30, 520);
    var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-300, 500, 300); scene.add(key);
    var rim = new THREE.DirectionalLight(0xa77bff, 1.7); rim.position.set(400, 120, -400); scene.add(rim);
    var solFill = new THREE.DirectionalLight(0x14f195, .55); solFill.position.set(-420, -160, -260); scene.add(solFill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x08080a, .22));
    // background: slow wireframe forms and orbiting obsidian shards
    var bg = new THREE.Group(); scene.add(bg);
    var icoL = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(380, 1)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .06 })); icoL.position.set(120, 40, -500); bg.add(icoL);
    var octL = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(150, 0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .14 })); octL.position.copy(icoL.position); bg.add(octL);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(260, .6, 6, 200), F.glowMat(0xffffff, .35)); ring.rotation.x = Math.PI / 2.25; ring.position.set(60, -40, -60); bg.add(ring);
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(330, .5, 6, 200), F.glowMat(0x9945ff, .5)); ring2.rotation.x = Math.PI / 2.1; ring2.rotation.y = .12; ring2.position.copy(ring.position); bg.add(ring2);
    var M = F.materials(), shardGeo = new THREE.TetrahedronGeometry(1, 0), N = 70, shards = new THREE.InstancedMesh(shardGeo, M.obsidian, N), sd = [], dummy = new THREE.Object3D();
    for (var i = 0; i < N; i++) sd.push({ r: 220 + Math.random() * 260, a: Math.random() * Math.PI * 2, y: (Math.random() - .5) * 160, s: 3 + Math.random() * 11, sp: (.04 + Math.random() * .08) * (Math.random() < .5 ? 1 : -1), rx: Math.random() * 6, ry: Math.random() * 6 });
    shards.position.copy(ring.position); bg.add(shards);
    var pts = new THREE.BufferGeometry(), pa = []; for (var j = 0; j < 700; j++) pa.push((Math.random() - .5) * 3000, (Math.random() - .5) * 1600, -600 - Math.random() * 900); pts.setAttribute("position", new THREE.Float32BufferAttribute(pa, 3));
    scene.add(new THREE.Points(pts, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: .55, fog: false })));
    // the hull
    var pivot = new THREE.Group(), ship = F.ship(1); ship.scale.setScalar(3.4); pivot.add(ship); scene.add(pivot);
    var flames = (ship.userData && ship.userData.flames) || [];
    var glowC = document.createElement("canvas"); glowC.width = glowC.height = 64; var gg = glowC.getContext("2d"), rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(.3, "rgba(255,255,255,.3)"); rg.addColorStop(1, "rgba(255,255,255,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
    var engine = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), color: 0xcfe3ff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); engine.scale.setScalar(120); engine.position.set(0, 0, 80); ship.add(engine); engine.scale.setScalar(44);
    var S = { yaw: { x: 2.3, v: 0 }, pitch: { x: .25, v: 0 }, roll: { x: 0, v: 0 }, px: { x: 0, v: 0 }, py: { x: 0, v: 0 } };
    function spring(s, target, k, dt) { var a = (target - s.x) * k * k - 2 * k * s.v; s.v += a * dt; s.x += s.v * dt; }
    var intro = reduce ? 1 : 0, boost = 0, t = 0;
    hero.addEventListener("pointerdown", function () { boost = 1; });
    function resize() { var w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); var narrow = w < 760; pivot.userData.base = narrow ? [4, 92, 40] : [70, -6, 110]; ship.scale.setScalar(narrow ? 1.35 : 2.55); }
    resize(); window.addEventListener("resize", resize);
    return function render(dt) {
      t += dt; intro = Math.min(1, intro + dt / 1.8); var e = 1 - Math.pow(1 - intro, 4);
      var nx = mx / innerWidth - .5, ny = my / innerHeight - .5, sc = Math.min(1, window.scrollY / innerHeight), base = pivot.userData.base;
      spring(S.yaw, 2.25 + nx * .6 - sc * .9, 4, dt); spring(S.pitch, .42 + ny * .3 + sc * .2, 4, dt); spring(S.roll, -nx * .45 + Math.sin(t * .8) * .05, 3.4, dt);
      spring(S.px, base[0] + nx * 30, 3, dt); spring(S.py, base[1] - ny * 16 + sc * 90, 3, dt);
      pivot.position.set(S.px.x, S.py.x + Math.sin(t * 1.1) * 5, base[2] - (1 - e) * 900); pivot.rotation.set(S.pitch.x, S.yaw.x + (1 - e) * 1.6, S.roll.x - (1 - e) * .9);
      boost = Math.max(0, boost - dt * 1.4);
      flames.forEach(function (f, i) { if (f.material && f.material.uniforms) { f.material.uniforms.uTime.value = t + i; f.material.uniforms.uPower.value = .75 + .25 * Math.sin(t * 40 + i) + boost * .8; } f.scale.set(1, 1, 1 + boost * 1.4 + .08 * Math.sin(t * 50 + i)); });
      engine.material.opacity = .45 + boost * .5;
      icoL.rotation.y += dt * .03; icoL.rotation.x += dt * .012; octL.rotation.y -= dt * .1; octL.rotation.z += dt * .05;
      ring.rotation.z += dt * .05; ring2.rotation.z -= dt * .03;
      for (var i = 0; i < N; i++) { var d = sd[i]; d.a += d.sp * dt; dummy.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t * .6 + i) * 6, Math.sin(d.a) * d.r * .55); dummy.rotation.set(d.rx + t * .3, d.ry + t * .2, 0); dummy.scale.setScalar(d.s); dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix); }
      shards.instanceMatrix.needsUpdate = true;
      cam.position.x = nx * 18; cam.position.y = 30 - ny * 10; cam.lookAt(30, 20, 0);
      renderer.render(scene, cam);
      var hc = $("#hudCoord"); if (hc && (t * 10 | 0) % 2 === 0) hc.textContent = "X " + String(Math.round((nx + .5) * 999)).padStart(3, "0") + " · Y " + String(Math.round((ny + .5) * 999)).padStart(3, "0");
    };
  }

  // ---------------------------------------------------------------- main loop: everything pauses when off screen
  var last = 0, bossClock = 0, bossFrame = 0, slow = 0;
  function frame(now) {
    var raw = (now - last) / 1000 || 0, dt = Math.min(.05, raw); last = now;
    gx += (mx - gx) * Math.min(1, dt * 6); gy += (my - gy) * Math.min(1, dt * 6); if (glow) glow.style.transform = "translate3d(" + gx.toFixed(1) + "px," + gy.toFixed(1) + "px,0)";
    if (!document.hidden) {
      if (heroVisible && gl3) { gl3(dt); if (raw > .03 && raw < .3) { slow += raw; if (slow > 3 && stage.__dprDropped !== true) { stage.__dprDropped = true; try { window.__forgeRenderer && window.__forgeRenderer.setPixelRatio(1); } catch (e) {} } } }
      if (pilotVisible) drawPilot(now / 1000);
      if (bossVisible) bossViews.forEach(function (v) { if (v.row.__vis !== false) renderBoss(v, dt); });
    }
    requestAnimationFrame(frame);
  }
  // boss turntables are built only as the bosses stage approaches, one per idle slot, so page load stays light
  function lazyBosses() {
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 80); }, queued = false;
    var go = function () { if (queued) return; queued = true; var k = 0; (function next() { if (k >= bossRows.length) return; try { initBossViews(k); } catch (e) {} k++; idle(next, { timeout: 400 }); })(); };
    var sec = $("#bosses"); if (!sec || !io) { go(); return; }
    var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); go(); } }, { rootMargin: "1200px 0px" }); o.observe(sec);
  }
  function start() {
    requestAnimationFrame(function () { document.body.classList.add("ready"); countUp(); });
    // first paint first: the hero scene is built right after the page has shown its text
    setTimeout(function () { try { gl3 = initStage(); } catch (e) { gl3 = null; } if (!gl3) document.documentElement.classList.add("no-gl"); }, 30);
    lazyBosses();
    if (reduce) { drawPilot(1.2); }
    requestAnimationFrame(frame);
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
