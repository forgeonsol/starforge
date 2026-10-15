/* $FORGE token layer — in-game interface. Builds the TOKEN hub page, header balance, wallet drawer,
   purchase / entry modals and reward toasts. Loaded before game.js so the hub joins the normal page router.
   All amounts are a SIMULATED demo balance (see forge-economy.js). */
(function () {
  "use strict";
  var E = window.ForgeEconomy; if (!E || window.FORGE_ECOSYSTEM === false) return;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var L = function (en, zh) { return E.lang() === "zh" ? zh : en; };
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var RCOL = { common: "#a9adb5", rare: "#7fc8ff", epic: "#a77bff", legendary: "#ffc46b", season: "#14f195" };
  var COIN = '<img class="tk-coin" src="logo.svg" alt="">';
  function dur(ms) { ms = Math.max(0, ms); var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60; return (d ? d + "d " : "") + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); }

  // ------------------------------------------------------------------ DOM scaffold (before game.js wires the router)
  var nav = $(".nav"), pilotBtn = nav && nav.querySelector('[data-page="campaign"]');
  if (nav) { var b = document.createElement("button"); b.dataset.page = "token"; b.className = "nav-token"; b.innerHTML = '<i class="tk-navdot"></i>TOKEN'; if (pilotBtn) pilotBtn.after(b); else nav.appendChild(b); }
  var account = $(".account"); if (account) { var pill = document.createElement("button"); pill.className = "tk-pill"; pill.id = "tkPill"; pill.type = "button"; pill.setAttribute("aria-label", "Open wallet"); pill.innerHTML = COIN + '<b id="tkBal">0</b><small>SOON</small><i class="tk-pend" id="tkPend" hidden></i>'; account.prepend(pill); }
  var page = document.createElement("section"); page.className = "page portal-page tk-page"; page.id = "page-token";
  var lastPage = $$(".page").pop(); (lastPage || $(".shell")).after ? lastPage.after(page) : $(".shell").appendChild(page);
  page.innerHTML =
    '<div class="tk-head">' +
      '<div class="tk-intro"><div class="eyebrow"><span class="tk-live"></span> <span data-tk="eyebrow"></span></div><h2 data-tk="title"></h2><p data-tk="sub"></p></div>' +
      '<div class="tk-bal-card"><div class="tk-bal-top"><span class="tk-coin-3d">' + COIN + '</span><div><small data-tk="balLabel"></small><b class="tk-bal-big" id="tkBalBig">0</b><span class="tk-unit">$FORGE · <em data-tk="demoTag"></em></span></div></div>' +
        '<div class="tk-bal-row"><button class="tk-btn" id="tkOpenWallet" data-tk="wallet"></button><button class="tk-btn ghost" id="tkDaily"></button></div>' +
        '<div class="tk-pending-row" id="tkPendRow" hidden><span id="tkPendText"></span><button class="tk-btn mint small" id="tkClaimAll" data-tk="claimAll"></button></div></div>' +
    '</div>' +
    '<div class="tk-launch" id="tkLaunch"></div>' +
    '<div class="tk-tabs" role="tablist">' + ["market", "raids", "cups", "season", "missions", "economy"].map(function (t) { return '<button role="tab" data-tab="' + t + '"></button>'; }).join("") + '</div>' +
    '<div class="tk-panels">' + ["market", "raids", "cups", "season", "missions", "economy"].map(function (t) { return '<div class="tk-panel" data-panel="' + t + '"></div>'; }).join("") + '</div>';
  var drawer = document.createElement("aside"); drawer.className = "tk-drawer"; drawer.id = "tkDrawer"; drawer.setAttribute("aria-hidden", "true"); document.body.appendChild(drawer);
  var modal = document.createElement("div"); modal.className = "tk-modal"; modal.id = "tkModal"; modal.setAttribute("aria-hidden", "true"); document.body.appendChild(modal);
  var toasts = document.createElement("div"); toasts.className = "tk-toasts"; document.body.appendChild(toasts);

  var TABS = { market: ["Market", "商店"], raids: ["Boss raids", "首领突袭"], cups: ["Tournaments", "锦标赛"], season: ["Season", "赛季"], missions: ["Missions & events", "任务与活动"], economy: ["Buybacks", "回购"] };
  var tab = "market";
  // ------------------------------------------------------------------ launch integration (token-config.js)
  var TK = window.FORGE_TOKEN || {}; TK.links = TK.links || {};
  var tokLive = TK.status === "live" && !!TK.buyUrl, chainName = TK.chain || "Solana";
  function launchButtons(small) {
    var sz = small ? " small" : "";
    var buy = tokLive ? '<a class="tk-btn tk-buy' + sz + '" href="' + esc(TK.buyUrl) + '" target="_blank" rel="noopener">' + L("Buy $FORGE ↗", "购买 $FORGE ↗") + "</a>"
      : '<a class="tk-btn tk-buy' + sz + '" href="index.html#launch">' + L("Buy $FORGE", "购买 $FORGE") + ' <em class="tk-soon">' + L("SOON", "即将") + "</em></a>";
    return buy + '<button class="tk-btn ghost' + sz + '" type="button" data-connect>' + L("Connect wallet", "连接钱包") + (TK.walletConnect ? "" : ' <em class="tk-soon">' + L("SOON", "即将") + "</em>") + "</button>";
  }
  function renderLaunch() {
    var el = $("#tkLaunch", page); if (!el) return;
    el.innerHTML = '<div class="tk-launch-l"><span class="tk-launch-pill' + (tokLive ? " live" : "") + '"><i></i>' + (tokLive ? L("TRADING LIVE", "交易已开放") : L("TOKEN LAUNCH · COMING SOON", "代币上线 · 即将开启")) + '</span><span class="tk-chain">' + esc(chainName.toUpperCase()) + "</span>" +
      '<p>' + (tokLive ? L("$FORGE is live. Wallet connection rolls into the game next — until then you play with your in-game balance.", "$FORGE 已上线。钱包连接即将接入游戏——在此之前使用游戏内余额。")
        : L("Everything here launches together with $FORGE on " + chainName + ". Until trading opens you play with an in-game balance on this device.", "这里的一切将与 " + chainName + " 上的 $FORGE 同步上线。交易开放前，你使用保存在本设备的游戏内余额。")) + "</p></div>" +
      '<div class="tk-launch-r">' + launchButtons(false) + "</div>";
    bindLaunch(el);
  }
  function bindLaunch(root) { $$("[data-connect]", root).forEach(function (b) { b.onclick = connectInfo; }); }
  function connectInfo() {
    modal.innerHTML = '<div class="tk-dialog tk-info" role="dialog" aria-modal="true"><button class="tk-x" aria-label="Close">×</button><div class="tk-dialog-art"><img class="tk-info-coin" src="logo.svg" alt=""></div><div class="tk-dialog-body"><span class="tk-mono">' + L("WALLET", "钱包") + " · " + esc(chainName.toUpperCase()) + "</span><h3>" + L("Wallet connection opens at launch.", "钱包连接将在上线时开放。") + "</h3><p>" +
      L("When $FORGE goes live you will connect a " + chainName + " wallet here and use the token for skins, raids, tournaments and season passes. Until then, keep playing — your in-game balance, items and progress stay on this device.", "$FORGE 上线后，你可以在这里连接 " + chainName + " 钱包，用代币购买外观、参加突袭与锦标赛、开通赛季通行证。在此之前请继续游玩——游戏内余额、物品与进度保存在本设备。") +
      '</p><div class="tk-dialog-actions"><a class="tk-btn" href="index.html#launch">' + L("Launch details", "上线详情") + '</a><button class="tk-btn ghost" data-x>' + L("Keep playing", "继续游玩") + "</button></div></div></div>";
    modal.classList.add("on"); modal.setAttribute("aria-hidden", "false");
    $(".tk-x", modal).onclick = closeModal; $("[data-x]", modal).onclick = closeModal;
  }
  function copy() {
    var T = { eyebrow: L("$FORGE TOKEN · COMING SOON", "$FORGE 代币 · 即将上线"), title: L("One token.<br>The whole forge.", "一枚代币，<br>贯通整座熔炉。"), sub: L("Spend it on cosmetics, enter raids and tournaments, unlock premium missions and follow the buyback plan. On-chain $FORGE is coming soon — until launch, your in-game balance is kept on this device.", "用于外观、参加突袭与锦标赛、解锁高级任务并了解回购计划。链上 $FORGE 即将上线——在此之前，游戏内余额保存在本设备。"),
      balLabel: L("IN-GAME BALANCE", "游戏内余额"), demoTag: L("coming soon", "即将上线"), wallet: L("Wallet & history", "钱包与记录"), claimAll: L("Claim", "领取") };
    $$("[data-tk]", page).forEach(function (n) { var v = T[n.dataset.tk]; if (v != null) n.innerHTML = v; });
    renderLaunch();
    $$(".tk-tabs button", page).forEach(function (b) { b.textContent = L(TABS[b.dataset.tab][0], TABS[b.dataset.tab][1]); b.classList.toggle("on", b.dataset.tab === tab); });
  }

  // ------------------------------------------------------------------ balance (animated), pending, daily
  var shown = E.balance(), target = shown, tweenT = 0;
  function tickBalance() { if (Math.abs(target - shown) < .5) { shown = target; } else shown += (target - shown) * .14; var v = fmt(shown); var a = $("#tkBal"), b2 = $("#tkBalBig"); if (a) a.textContent = v; if (b2) b2.textContent = v; if (shown !== target) requestAnimationFrame(tickBalance); }
  function syncTop() {
    var S = E.state(); if (target !== S.balance) { var up = S.balance > target; target = S.balance; requestAnimationFrame(tickBalance); var p = $("#tkPill"); if (p) { p.classList.remove("up", "down"); void p.offsetWidth; p.classList.add(up ? "up" : "down"); } }
    var pend = S.pending.reduce(function (a, x) { return a + x.amount; }, 0), pe = $("#tkPend"); if (pe) { pe.hidden = !pend; }
    var row = $("#tkPendRow"); if (row) { row.hidden = !pend; $("#tkPendText").innerHTML = L("Unclaimed rewards", "待领取奖励") + " · <b>+" + fmt(pend) + "</b>"; }
    var d = $("#tkDaily"), left = E.dailyLeft(); if (d) { d.disabled = left > 0; d.textContent = left > 0 ? L("Daily in ", "签到冷却 ") + dur(left) : L("Daily check-in · +150", "每日签到 · +150"); }
  }
  setInterval(syncTop, 1000);

  // ------------------------------------------------------------------ toasts
  window.addEventListener("forge-economy-reward", function (e) { var d = e.detail; toast('<span class="tk-toast-amt">+' + fmt(d.amount) + "</span><span>" + esc(d.memo) + "</span>" + (d.pending ? "<small>" + L("Claim it in the wallet", "可在钱包中领取") + "</small>" : ""), d.pending ? "pending" : "ok"); });
  function toast(html, kind) { var t = document.createElement("div"); t.className = "tk-toast " + (kind || ""); t.innerHTML = COIN + "<div>" + html + "</div>"; toasts.appendChild(t); requestAnimationFrame(function () { t.classList.add("in"); }); setTimeout(function () { t.classList.remove("in"); setTimeout(function () { t.remove(); }, 500); }, 3600); }

  // ------------------------------------------------------------------ live previews (pilot outfits, weapon fx) — one rAF loop, only visible canvases
  var previews = [], pilotFrames = [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { var im = new Image(); im.src = "assets/3d/pilot-a/p-0" + i + ".webp"; return im; });
  var tintCache = {};
  function tinted(im, col) { var k = im.src + col; if (tintCache[k]) return tintCache[k]; if (!im.complete || !im.naturalWidth) return null; var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; var g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return (tintCache[k] = c); }
  function drawPreview(p, t) {
    var c = p.cv, g = c.getContext("2d"), w = c.width, h = c.height; g.clearRect(0, 0, w, h);
    var bg = g.createRadialGradient(w / 2, h * .62, 0, w / 2, h * .62, w * .6); bg.addColorStop(0, "rgba(255,255,255,.07)"); bg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (p.kind === "outfits") {
      g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(0, h * .86, w, 1); g.strokeStyle = "rgba(255,255,255,.06)"; g.beginPath(); for (var x = -((t * 120) % 40); x < w; x += 40) { g.moveTo(x, h * .86); g.lineTo(x - 10, h); } g.stroke();
      var im = pilotFrames[Math.floor(t * 12) % 8]; if (im.complete && im.naturalWidth) { var ph = h * .78, pw = ph * .75, px = w / 2 - pw / 2, py = h * .86 - ph + 4; g.drawImage(im, px, py, pw, ph); var tc = tinted(im, p.item.color); if (tc) { g.globalCompositeOperation = "color"; g.globalAlpha = .9; g.drawImage(tc, px, py, pw, ph); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; } }
    } else if (p.kind === "fx") {
      var cy = h * .5; g.globalCompositeOperation = "lighter";
      for (var i = 0; i < 7; i++) { var ph2 = ((t * 1.3 + i / 7) % 1), bx = -40 + ph2 * (w + 80), col = p.item.color === "prism" ? ["#ff4a2e", "#ffc46b", "#9ff2c4", "#8fd3ff", "#b79cff"][(i + Math.floor(t * 3)) % 5] : p.item.color, yy = cy + Math.sin(i * 1.7) * h * .18;
        var gr = g.createLinearGradient(bx - 70, 0, bx, 0); gr.addColorStop(0, col + "00"); gr.addColorStop(1, col + "dd"); g.fillStyle = gr; g.fillRect(bx - 70, yy - 2, 70, 4); g.fillStyle = "#fff"; g.fillRect(bx - 14, yy - 1, 14, 2);
        var gl = g.createRadialGradient(bx, yy, 0, bx, yy, 16); gl.addColorStop(0, col + "aa"); gl.addColorStop(1, col + "00"); g.fillStyle = gl; g.fillRect(bx - 16, yy - 16, 32, 32); }
      var hx = w * .84, burst = (t * 1.3 * 7) % 1; g.strokeStyle = (p.item.color === "prism" ? "#ffffff" : p.item.color); g.globalAlpha = 1 - burst; g.beginPath(); g.arc(hx, cy, 6 + burst * 26, 0, 7); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(hx + 30, cy - h * .3, 2, h * .6);
    }
  }
  function previewLoop(now) { var t = now / 1000; previews.forEach(function (p) { if (p.cv.isConnected && p.vis) drawPreview(p, t); }); previews = previews.filter(function (p) { return p.cv.isConnected; }); requestAnimationFrame(previewLoop); }
  requestAnimationFrame(previewLoop);
  var pio = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { var p = previews.find(function (x) { return x.cv === e.target; }); if (p) p.vis = e.isIntersecting; }); }) : null;
  function mountPreviews(root) { $$("canvas[data-prev]", root).forEach(function (cv) { var r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(100, Math.round((r.width || 260) * dpr)); cv.height = Math.max(80, Math.round((r.height || 200) * dpr)); var p = { cv: cv, kind: cv.dataset.prev, item: E.find(cv.dataset.prev, cv.dataset.id), vis: !pio }; previews.push(p); if (pio) pio.observe(cv); }); }

  // ------------------------------------------------------------------ live 3D (skin preview in modal, raid bosses)
  var THREE = window.THREE, F = window.ForgeModels;
  function make3D(canvas, build, opts) {
    if (!THREE || !F) return null; var r; try { r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0, 0);
    var scene = new THREE.Scene(); scene.environment = F.studioEnvironment(r); var cam = new THREE.PerspectiveCamera(28, 1.4, 1, 3000); cam.position.set(0, opts.camY || 200, opts.camZ || 360); cam.lookAt(0, 0, 0);
    var key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(-200, 400, 260); scene.add(key); var rim = new THREE.DirectionalLight(0xcfe3ff, 1.4); rim.position.set(260, 80, -300); scene.add(rim);
    var lamp = new THREE.PointLight(opts.accent || 0xffffff, 2, 360); lamp.position.set(0, 50, 50); scene.add(lamp);
    var model = build(); scene.add(model);
    var ring = new THREE.Mesh(new THREE.RingGeometry(80, 81.4, 96), new THREE.MeshBasicMaterial({ color: opts.accent || 0xffffff, transparent: true, opacity: .35 })); ring.rotation.x = -Math.PI / 2; ring.position.y = opts.ringY || -40; scene.add(ring);
    var v = { r: r, scene: scene, cam: cam, model: model, lamp: lamp, ring: ring, yaw: opts.yaw || 0, vel: .5, drag: null, t: 0, hot: 0, anim: opts.anim, alive: true };
    function size() { var w = canvas.clientWidth || 300, h = canvas.clientHeight || 220; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    size(); v.size = size;
    canvas.addEventListener("pointerdown", function (e) { v.drag = { last: e.clientX, t: performance.now() }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener("pointermove", function (e) { if (!v.drag) return; var dx = e.clientX - v.drag.last, n = performance.now(); v.drag.last = e.clientX; v.yaw += dx * .012; v.vel = dx * .012 / Math.max(.008, (n - v.drag.t) / 1000); v.drag.t = n; });
    var up = function () { v.drag = null; v.vel = Math.max(-6, Math.min(6, v.vel)); }; canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    v.render = function (dt) { v.t += dt; if (!v.drag) { v.vel += ((.5 + v.hot * .9) - v.vel) * Math.min(1, dt * 1.6); v.yaw += v.vel * dt; } v.model.rotation.y = v.yaw; v.model.position.y = Math.sin(v.t * 1.4) * 4; v.ring.rotation.z += dt * .2; if (v.anim) v.anim(v, dt); r.render(scene, cam); };
    v.dispose = function () { v.alive = false; try { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } catch (e) {} };
    return v;
  }
  var views3d = [];
  function bossAnim(k) { return function (v, dt) { var P = v.model.userData.parts, c = v.t, pulse = 1 + .12 * Math.sin(c * (4 + v.hot * 6)); if (k === 0) { P.wings.forEach(function (w, i) { var s2 = i ? 1 : -1; w.rotation.z = s2 * (Math.sin(c * (2.2 + v.hot * 2)) * .22 + .08 + v.hot * .18); }); P.core.scale.setScalar(.12 * pulse); } else if (k === 1) { P.heads.forEach(function (h, i) { h.rotation.x = c * (1 + v.hot) * (i ? 1 : -1) * .6; }); P.core.scale.set(.12 * pulse, .2 * pulse, .12 * pulse); } else { var br = .08 * Math.sin(c * 1.8) + v.hot * .3; P.plates.forEach(function (pl, i) { pl.position.copy(pl.userData.home).addScaledVector(pl.userData.normal, br + .02 * Math.sin(c * 3 + i)); }); if (P.coreGlass) { P.coreGlass.rotation.x += dt * .6; P.coreGlass.rotation.y += dt * .9; } P.core.scale.setScalar(.16 * pulse); } }; }
  var last3d = 0;
  function loop3d(now) { var dt = Math.min(.05, (now - last3d) / 1000 || 0); last3d = now; if (page.classList.contains("active") || modal.classList.contains("on")) views3d.forEach(function (v) { if (v.alive && v.canvas.isConnected && v.vis !== false) v.render(dt); }); views3d = views3d.filter(function (v) { if (!v.canvas.isConnected) { v.dispose(); return false; } return true; }); requestAnimationFrame(loop3d); }
  requestAnimationFrame(loop3d);

  // ------------------------------------------------------------------ MARKET
  var mcat = "skins", CATS = { skins: ["Ship skins", "战舰外观"], outfits: ["Pilot outfits", "飞行员服装"], fx: ["Weapon effects", "武器特效"], maps: ["Map access", "地图通行"] };
  function rarityTag(r) { var R = E.rarity[r]; return '<span class="tk-rar r-' + r + '" style="--rc:' + RCOL[r] + '">' + L(R.label, R.zh) + "</span>"; }
  function itemArt(cat, it) {
    if (cat === "outfits" || cat === "fx") return '<canvas data-prev="' + cat + '" data-id="' + it.id + '"></canvas>';
    return '<img src="' + it.art + '" alt="" loading="lazy">';
  }
  function itemAction(cat, it) {
    var owned = E.owns(cat, it.id), eq = E.state().equipped[cat] === it.id;
    if (it.price == null && !owned) return '<span class="tk-lockline">' + L("Season I reward", "第一季奖励") + "</span>";
    if (cat === "maps") return owned ? '<span class="tk-ownedline">✓ ' + L("Unlocked", "已解锁") + "</span>" : '<button class="tk-btn small" data-buy="' + cat + ":" + it.id + '">' + L("Buy", "购买") + "</button>";
    if (eq) return '<button class="tk-btn small mint" data-unequip="' + cat + '">✓ ' + L("Equipped", "已装备") + "</button>";
    if (owned) return '<button class="tk-btn small ghost" data-equip="' + cat + ":" + it.id + '">' + L("Equip", "装备") + "</button>";
    return '<button class="tk-btn small" data-buy="' + cat + ":" + it.id + '">' + L("Buy", "购买") + "</button>";
  }
  function renderMarket() {
    var el = $('[data-panel="market"]', page), S = E.state();
    var eqStrip = ["skins", "outfits", "fx"].map(function (c) { var it = E.equipped(c); return '<div class="tk-eq"><small>' + L(CATS[c][0], CATS[c][1]) + "</small><b>" + (it ? esc(E.name(it)) : L("Default", "默认")) + "</b></div>"; }).join("");
    el.innerHTML = '<div class="tk-market-top"><div class="tk-chips">' + Object.keys(CATS).map(function (c) { return '<button data-cat="' + c + '" class="' + (c === mcat ? "on" : "") + '">' + L(CATS[c][0], CATS[c][1]) + " <i>" + E.catalog[c].length + "</i></button>"; }).join("") + '</div><div class="tk-eqstrip"><span class="tk-mono">' + L("LOADOUT", "当前配置") + "</span>" + eqStrip + "</div></div>" +
      '<div class="tk-grid">' + E.catalog[mcat].map(function (it, i) {
        return '<article class="tk-item r-' + it.rarity + '" style="--rc:' + RCOL[it.rarity] + ";--i:" + i + '"><div class="tk-art ' + mcat + '">' + itemArt(mcat, it) + (it.animated ? '<span class="tk-anim">' + L("ANIMATED", "动态") + "</span>" : "") + "</div>" +
          '<div class="tk-item-body"><div class="tk-item-top">' + rarityTag(it.rarity) + '<span class="tk-mono">' + (mcat === "skins" ? "HULL " + String(it.hull).padStart(2, "0") : mcat.toUpperCase()) + "</span></div><h4>" + esc(E.name(it)) + "</h4><p>" + esc(it.note) + '</p><div class="tk-item-foot"><span class="tk-price">' + (it.price != null ? COIN + "<b>" + fmt(it.price) + "</b>" : "—") + "</span>" + itemAction(mcat, it) + "</div></div></article>";
      }).join("") + "</div>" +
      '<p class="tk-note">' + L("Purchases use your in-game balance. Equipped skins and weapon effects appear in the 3D arena; outfits and weapon colours carry into the pilot campaign; map passes open sectors immediately.", "购买使用游戏内余额。已装备的外观与武器特效会出现在 3D 竞技场；服装与武器颜色同步到飞行员战役；地图通行证立即开放区域。") + "</p>";
    $$("[data-cat]", el).forEach(function (b) { b.onclick = function () { mcat = b.dataset.cat; renderMarket(); }; });
    $$("[data-buy]", el).forEach(function (b) { b.onclick = function () { var p = b.dataset.buy.split(":"); openPurchase(p[0], p[1]); }; });
    $$("[data-equip]", el).forEach(function (b) { b.onclick = function () { var p = b.dataset.equip.split(":"); E.equip(p[0], p[1]); toastPlain(L("Equipped", "已装备") + " · " + E.name(E.find(p[0], p[1]))); }; });
    $$("[data-unequip]", el).forEach(function (b) { b.onclick = function () { E.equip(b.dataset.unequip, null); }; });
    mountPreviews(el);
  }
  function toastPlain(text) { var t = document.createElement("div"); t.className = "tk-toast plain"; t.innerHTML = "<div>" + esc(text) + "</div>"; toasts.appendChild(t); requestAnimationFrame(function () { t.classList.add("in"); }); setTimeout(function () { t.classList.remove("in"); setTimeout(function () { t.remove(); }, 500); }, 2200); }

  // ------------------------------------------------------------------ modal: confirm → simulated signing → success
  function closeModal() { modal.classList.remove("on"); modal.setAttribute("aria-hidden", "true"); setTimeout(function () { if (!modal.classList.contains("on")) modal.innerHTML = ""; }, 400); }
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (modal.classList.contains("on")) closeModal(); else if (drawer.classList.contains("on")) toggleDrawer(false); } });
  function txFlow(opts) {
    // opts: { kicker, title, sub, art (html), price, confirm, run: () => Promise, onDone(result) , doneTitle, doneActions(html,bind) }
    var bal = E.balance(), after = bal - opts.price, can = after >= 0;
    modal.innerHTML = '<div class="tk-dialog" role="dialog" aria-modal="true"><button class="tk-x" aria-label="Close">×</button><div class="tk-dialog-art">' + (opts.art || "") + '</div><div class="tk-dialog-body"><span class="tk-mono">' + esc(opts.kicker) + "</span><h3>" + esc(opts.title) + "</h3><p>" + esc(opts.sub || "") + "</p>" +
      '<dl class="tk-ledger"><div><dt>' + L("Price", "价格") + "</dt><dd>" + COIN + fmt(opts.price) + "</dd></div><div><dt>" + L("Balance", "余额") + "</dt><dd>" + fmt(bal) + "</dd></div><div><dt>" + L("After", "交易后") + '</dt><dd class="' + (can ? "" : "neg") + '">' + fmt(after) + "</dd></div></dl>" +
      '<div class="tk-sim">' + L("In-game balance · on-chain $FORGE coming soon", "游戏内余额 · 链上 $FORGE 即将上线") + "</div>" +
      '<div class="tk-dialog-actions"><button class="tk-btn ghost" data-x>' + L("Cancel", "取消") + '</button><button class="tk-btn" data-go ' + (can ? "" : "disabled") + ">" + (can ? esc(opts.confirm) : L("Not enough $FORGE", "余额不足")) + "</button></div>" +
      '<div class="tk-steps"><i></i><span></span></div></div></div>';
    modal.classList.add("on"); modal.setAttribute("aria-hidden", "false");
    $(".tk-x", modal).onclick = closeModal; $("[data-x]", modal).onclick = closeModal;
    if (opts.mount) opts.mount($(".tk-dialog-art", modal));
    $("[data-go]", modal).onclick = function () {
      var dlg = $(".tk-dialog", modal); dlg.classList.add("busy"); var steps = $(".tk-steps span", modal), seq = [L("Preparing transaction…", "准备交易…"), L("Processing…", "处理中…"), L("Confirming…", "确认中…")], si = 0; steps.textContent = seq[0];
      var timer = setInterval(function () { si = Math.min(seq.length - 1, si + 1); steps.textContent = seq[si]; }, 330);
      opts.run().then(function (r) { clearInterval(timer); dlg.classList.remove("busy"); dlg.classList.add("done"); celebrate($(".tk-dialog-art", modal));
        $(".tk-dialog-body", modal).innerHTML = '<span class="tk-mono ok">✓ ' + L("CONFIRMED", "已确认") + "</span><h3>" + esc(opts.doneTitle || opts.title) + "</h3><p>" + L("Receipt", "凭证") + ' <code>' + esc(r.txId) + '</code></p><div class="tk-dialog-actions">' + (opts.doneActions || "") + '<button class="tk-btn ghost" data-x>' + L("Close", "关闭") + "</button></div>";
        $("[data-x]", modal).onclick = closeModal; if (opts.onDone) opts.onDone(r, modal);
      }).catch(function () { clearInterval(timer); dlg.classList.remove("busy"); steps.textContent = L("Transaction failed", "交易失败"); });
    };
  }
  function celebrate(host) {
    var c = document.createElement("canvas"); c.className = "tk-burst"; host.appendChild(c); var w = c.width = host.clientWidth * 2, h = c.height = host.clientHeight * 2, g = c.getContext("2d"), parts = [];
    for (var i = 0; i < 70; i++) { var a = Math.random() * 6.28, v = 4 + Math.random() * 12; parts.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, l: 1, c: ["#ffffff", "#14f195", "#9945ff", "#7b61ff"][i % 4], r: Math.random() * 6 }); }
    (function step() { g.clearRect(0, 0, w, h); var alive = false; parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .985; p.l -= .016; p.r += .2; if (p.l > 0) { alive = true; g.globalAlpha = p.l; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-5, -2, 10, 4); g.restore(); } }); g.globalAlpha = 1; if (alive) requestAnimationFrame(step); else c.remove(); })();
    var ring = document.createElement("i"); ring.className = "tk-ring"; host.appendChild(ring); setTimeout(function () { ring.remove(); }, 1000);
  }
  function openPurchase(cat, id) {
    var it = E.find(cat, id); if (!it) return;
    var art = cat === "skins" ? '<canvas class="tk-3d"></canvas><span class="tk-drag">' + L("DRAG TO ROTATE", "拖动旋转") + "</span>" : cat === "maps" ? '<img src="' + it.art + '" alt="">' : '<canvas data-prev="' + cat + '" data-id="' + id + '"></canvas>';
    txFlow({ kicker: L(CATS[cat][0], CATS[cat][1]).toUpperCase() + " · " + E.rarity[it.rarity].label.toUpperCase(), title: E.name(it), sub: it.note, art: art, price: it.price, confirm: L("Buy for ", "购买 · ") + fmt(it.price), run: function () { return E.buy(cat, id); },
      doneTitle: (cat === "maps" ? L("Unlocked: ", "已解锁：") : L("Equipped: ", "已装备：")) + E.name(it),
      doneActions: cat === "maps" ? '<button class="tk-btn" data-goto-page="' + (it.pilot ? "campaign" : "maps") + '">' + (it.pilot ? L("Open pilot campaign", "打开飞行员战役") : L("Open sectors", "打开区域")) + "</button>" : '<button class="tk-btn" data-goto-page="' + (cat === "outfits" ? "campaign" : "arena") + '">' + (cat === "outfits" ? L("Try it in the pilot campaign", "在飞行员战役中试用") : L("Fly it in the arena", "在竞技场中试飞")) + "</button>",
      onDone: function () { $$("[data-goto-page]", modal).forEach(function (b) { b.onclick = function () { closeModal(); var nb = document.querySelector('[data-page="' + b.dataset.gotoPage + '"]'); if (nb) nb.click(); }; }); },
      mount: function (host) { if (cat === "skins") { var cv = $("canvas.tk-3d", host); setTimeout(function () { var v = make3D(cv, function () { var s = F.ship(it.hull); F.applyFinish(s, it.finish); s.scale.setScalar(2.4); return s; }, { accent: RCOL[it.rarity] === "#ffc46b" ? 0xffc46b : 0xffffff, camY: 170, camZ: 330, ringY: -30, anim: function (v) { F.animateFinish && F.animateFinish(v.model, v.t); } }); if (v) { v.canvas = cv; views3d.push(v); } }, 30); } else mountPreviews(host); } });
  }

  // ------------------------------------------------------------------ RAIDS
  function renderRaids() {
    var el = $('[data-panel="raids"]', page), S = E.state();
    el.innerHTML = '<div class="tk-sec-head"><h3>' + L("Special boss raids", "特别首领突袭") + "</h3><p>" + L("Pay a token entry, fight a hand-picked boss from the first second. Defeat it to take the full reward; any attempt still earns a share.", "支付代币入场，开局即迎战指定首领。击败可获全额奖励，未击败也有参与奖励。") + "</p></div>" +
      '<div class="tk-raids">' + E.raids.map(function (r, i) {
        var pips = '<span class="tk-pips">' + [0, 1, 2].map(function (k) { return "<i" + (k <= i ? ' class="on"' : "") + "></i>"; }).join("") + "</span>";
        return '<article class="tk-raid" style="--ac:' + r.accent + '" data-raid="' + r.id + '"><div class="tk-raid-stage"><canvas></canvas><div class="tk-raid-grid"></div><span class="tk-mono tk-raid-tier">' + L(r.tier, r.tierZh).toUpperCase() + " " + pips + "</span></div>" +
          '<div class="tk-raid-body"><h4>' + esc(E.name(r)) + "</h4><p>" + esc(L(r.brief, r.briefZh)) + '</p><dl class="tk-raid-stats"><div><dt>' + L("Entry", "入场") + "</dt><dd>" + COIN + fmt(r.entry) + "</dd></div><div><dt>" + L("Win reward", "胜利奖励") + "</dt><dd>" + COIN + fmt(r.win) + "</dd></div><div><dt>" + L("Attempt", "参与") + "</dt><dd>" + COIN + fmt(r.partial) + '</dd></div></dl><button class="tk-btn wide" data-enter="' + r.id + '">' + L("Enter raid", "进入突袭") + " · " + fmt(r.entry) + "</button></div></article>";
      }).join("") + "</div>" +
      '<div class="tk-sec-head"><h3>' + L("Participation history", "参与记录") + "</h3></div>" +
      (S.raids.length ? '<div class="tk-table"><div class="tk-tr tk-th"><span>' + L("Raid", "突袭") + "</span><span>" + L("Result", "结果") + "</span><span>" + L("Score", "得分") + "</span><span>" + L("Reward", "奖励") + "</span><span>" + L("When", "时间") + "</span></div>" + S.raids.slice(0, 10).map(function (h) { return '<div class="tk-tr"><span>' + esc(h.name) + '</span><span class="' + (h.won ? "ok" : "") + '">' + (h.won ? L("Cleared", "已击破") : L("Attempt", "参与")) + "</span><span>" + fmt(h.score) + "</span><span>+" + fmt(h.reward) + "</span><span>" + new Date(h.t).toLocaleString() + "</span></div>"; }).join("") + "</div>" : '<div class="tk-empty">' + L("No raids yet. Enter one above — the run starts in the arena immediately.", "暂无突袭记录。进入上方任一突袭，竞技场会立即开局。") + "</div>");
    $$("[data-enter]", el).forEach(function (b) { b.onclick = function () { var r = E.raids.find(function (x) { return x.id === b.dataset.enter; }); txFlow({ kicker: L("BOSS RAID · ENTRY", "首领突袭 · 入场"), title: E.name(r), sub: L(r.brief, r.briefZh), art: '<img src="assets/3d/guardians/guardian-' + r.boss + '-0.webp" alt="">', price: r.entry, confirm: L("Pay entry & launch", "支付并出击"), run: function () { return E.enterRaid(r.id); }, doneTitle: L("Raid launched", "突袭已开始"), onDone: function () { setTimeout(closeModal, 700); } }); }; });
    $$(".tk-raid", el).forEach(function (card, i) { var r = E.raids[i], cv = $("canvas", card); var v = make3D(cv, function () { var m = F.boss(r.boss, parseInt(r.accent.slice(1), 16)); m.scale.setScalar(r.boss === 1 ? 64 : 70); return m; }, { accent: parseInt(r.accent.slice(1), 16), yaw: i * 1.3, anim: bossAnim(r.boss) }); if (v) { v.canvas = cv; views3d.push(v); card.onpointerenter = function () { v.hot = 1; }; card.onpointerleave = function () { v.hot = 0; }; } });
  }

  // ------------------------------------------------------------------ TOURNAMENTS
  var cupSel = "cup-weekly";
  function renderCups() {
    var el = $('[data-panel="cups"]', page), S = E.state(), c = E.tournaments.find(function (x) { return x.id === cupSel; }), st = E.standings(c), you = st.list.find(function (x) { return x.you; });
    var needsMode = c.mode && !E.hasMode(c.mode);
    var top = st.list.slice(0, 10), showYou = you && you.rank > 10;
    var maxScore = Math.max(1, st.list[0].score);
    el.innerHTML = '<div class="tk-cup-tabs">' + E.tournaments.map(function (x) { return '<button data-cup="' + x.id + '" class="' + (x.id === cupSel ? "on" : "") + '"><b>' + esc(E.name(x)) + "</b><small>" + (x.cadence === "daily" ? L("Daily", "每日") : L("Weekly", "每周")) + " · " + COIN + fmt(x.entry) + "</small></button>"; }).join("") + "</div>" +
      '<div class="tk-cup"><div class="tk-cup-hero"><div><span class="tk-mono">' + (c.cadence === "daily" ? L("DAILY CUP", "每日杯赛") : L("WEEKLY CUP", "周赛")) + " · " + L("ROUND", "轮次") + " " + st.round + "</span><h3>" + esc(E.name(c)) + "</h3><p>" + esc(L(c.desc, c.descZh)) + '</p></div><div class="tk-cup-stats"><div><small>' + L("Ends in", "剩余时间") + '</small><b class="tk-count" data-ends="' + st.ends + '">' + dur(st.ends - Date.now()) + "</b></div><div><small>" + L("Prize pool", "奖池") + "</small><b>" + COIN + fmt(c.pool) + "</b></div><div><small>" + L("Entry", "入场") + "</small><b>" + COIN + fmt(c.entry) + "</b></div><div><small>" + L("Your rank", "你的排名") + "</small><b>" + (st.entered ? "#" + you.rank : "—") + "</b></div></div>" +
      '<div class="tk-cup-actions">' + (st.entered ? '<span class="tk-badge ok">✓ ' + L("Entered · best", "已报名 · 最佳") + " " + fmt(st.entry.best) + "</span>" + (c.mode ? '<button class="tk-btn" data-play-mode="' + c.mode + '">' + L("Play Boss Rush", "开始首领冲刺") + "</button>" : '<button class="tk-btn" data-goto-page="arena">' + L("Play a run", "开始一局") + "</button>") + '<button class="tk-btn ghost" data-endnow>' + L("End round now", "立即结算") + "</button>" : needsMode ? '<button class="tk-btn" data-goto-tab="missions">' + L("Unlock Boss Rush first", "请先解锁首领冲刺") + "</button>" : '<button class="tk-btn" data-join>' + L("Enter tournament", "报名参赛") + " · " + fmt(c.entry) + "</button>") + "</div></div>" +
      '<div class="tk-cup-grid"><div class="tk-board"><div class="tk-podium">' + top.slice(0, 3).map(function (p, i) { return '<div class="tk-pod p' + (i + 1) + (p.you ? " you" : "") + '"><span>#' + (i + 1) + "</span><b>" + esc(p.name) + "</b><small>" + fmt(p.score) + "</small><i></i></div>"; }).join("") + "</div>" +
        '<div class="tk-rows">' + top.concat(showYou ? [you] : []).map(function (p) { return '<div class="tk-row' + (p.you ? " you" : "") + '"><span class="tk-rk">' + p.rank + '</span><span class="tk-av">' + esc(p.name.slice(0, 2)) + "</span><b>" + esc(p.name) + '</b><span class="tk-bar"><i style="width:' + Math.max(3, p.score / maxScore * 100).toFixed(1) + '%"></i></span><span class="tk-sc">' + fmt(p.score) + '</span><span class="tk-pz">' + (p.rank <= 10 ? "+" + fmt(c.pool * E.payout[p.rank - 1]) : "—") + "</span></div>"; }).join("") + "</div></div>" +
        '<div class="tk-payout"><h4>' + L("Reward distribution", "奖励分配") + "</h4>" + E.payout.map(function (p, i) { return '<div class="tk-pay"><span>#' + (i + 1) + '</span><span class="tk-bar"><i style="width:' + (p / E.payout[0] * 100) + '%"></i></span><b>' + Math.round(p * 1000) / 10 + "%</b><small>" + fmt(c.pool * p) + "</small></div>"; }).join("") + '<p class="tk-note">' + L("Prizes are paid to your in-game balance; rivals are AI pilots until launch. On-chain prize pools are coming soon.", "奖励发放至游戏内余额；上线前对手为 AI 飞行员。链上奖池即将上线。") + "</p></div></div>" +
      '<div class="tk-sec-head"><h3>' + L("Your results", "你的成绩") + "</h3></div>" + (S.cups.results.length ? '<div class="tk-table">' + S.cups.results.slice(0, 8).map(function (r) { return '<div class="tk-tr"><span>' + esc(r.name) + "</span><span>#" + r.rank + " / " + r.of + "</span><span>" + fmt(r.score) + "</span><span>" + (r.reward ? "+" + fmt(r.reward) : "—") + "</span><span>" + (r.reward && !r.claimed ? '<button class="tk-btn small mint" data-claimcup="' + r.key + '">' + L("Claim", "领取") + "</button>" : r.reward ? "✓ " + L("Claimed", "已领取") : L("Outside prizes", "未进奖励区")) + "</span></div>"; }).join("") + "</div>" : '<div class="tk-empty">' + L("Finish a round to see results here.", "结算一轮后成绩会显示在这里。") + "</div>") + "</div>";
    $$("[data-cup]", el).forEach(function (b) { b.onclick = function () { cupSel = b.dataset.cup; renderCups(); }; });
    var j = $("[data-join]", el); if (j) j.onclick = function () { txFlow({ kicker: L("TOURNAMENT ENTRY", "锦标赛报名"), title: E.name(c), sub: L(c.desc, c.descZh), art: '<img src="assets/3d/guardians/guardian-' + (c.mode ? 0 : 2) + '-1.webp" alt="">', price: c.entry, confirm: L("Pay entry", "支付报名费"), run: function () { return E.enterCup(c.id); }, doneTitle: L("You're in. Every run now counts.", "报名成功，接下来每局都计分。"), onDone: function () { renderCups(); } }); };
    var en = $("[data-endnow]", el); if (en) en.onclick = function () { var res = E.endCupNow(c.id); if (res) toastPlain(L("Round settled · rank #", "已结算 · 排名 #") + res.rank); renderCups(); };
    $$("[data-claimcup]", el).forEach(function (b) { b.onclick = function () { E.claimCup(b.dataset.claimcup); renderCups(); }; });
    bindCommon(el);
  }

  // ------------------------------------------------------------------ SEASON
  function rewardLabel(rw) { if (!rw) return ""; if (rw.kind === "tokens") return COIN + "<b>" + fmt(rw.amount) + "</b>"; var it = E.find(rw.cat, rw.id); return '<span class="tk-rw-item">' + (rw.cat === "skins" ? '<img src="' + it.art + '" alt="">' : '<i style="background:' + (it.color === "prism" ? "#fff" : it.color) + '"></i>') + "<b>" + esc(E.name(it)) + "</b></span>"; }
  function renderSeason() {
    var el = $('[data-panel="season"]', page), S = E.state(), tier = E.seasonTier(), xpIn = S.season.xp - tier * E.season.tierXp, pct = tier >= E.season.tiers ? 100 : xpIn / E.season.tierXp * 100;
    var cols = ""; for (var t = 1; t <= E.season.tiers; t++) {
      var fr = E.seasonReward(t, false), pr = E.seasonReward(t, true), reached = t <= tier, fc = S.season.claimed.free.indexOf(t) >= 0, pc = S.season.claimed.prem.indexOf(t) >= 0;
      var cell = function (rw, claimed, prem) { var cls = "tk-cell" + (prem ? " prem" : "") + (claimed ? " claimed" : reached && (!prem || S.season.premium) ? " ready" : "") + (prem && !S.season.premium ? " locked" : ""); return '<div class="' + cls + '">' + rewardLabel(rw) + (claimed ? '<span class="tk-mono">✓</span>' : reached && (!prem || S.season.premium) ? '<button class="tk-btn small mint" data-claimtier="' + t + ":" + (prem ? 1 : 0) + '">' + L("Claim", "领取") + "</button>" : '<span class="tk-mono">' + (prem && !S.season.premium ? "🔒" : "·") + "</span>") + "</div>"; };
      cols += '<div class="tk-col' + (reached ? " reached" : "") + (t === tier + 1 ? " next" : "") + '"><span class="tk-tier">' + String(t).padStart(2, "0") + "</span>" + cell(fr, fc, false) + cell(pr, pc, true) + "</div>";
    }
    el.innerHTML = '<div class="tk-season-head"><div><span class="tk-mono">' + L("SEASON PROGRESSION", "赛季进度") + "</span><h3>" + esc(L(E.season.name, E.season.zh)) + "</h3><p>" + L("Every arena run, boss and pilot mission earns Season XP. Claim free rewards on every tier; the premium track adds tokens and three exclusive Ignition cosmetics.", "每局竞技场、每个首领与飞行员任务都会获得赛季经验。每级可领取免费奖励；高级通道额外提供代币与三件点火系列限定外观。") + '</p></div><div class="tk-season-meter"><div class="tk-big-tier"><small>' + L("TIER", "等级") + "</small><b>" + String(tier).padStart(2, "0") + "</b><small>/ " + E.season.tiers + '</small></div><div class="tk-xp"><i style="width:' + pct.toFixed(1) + '%"></i></div><small class="tk-mono">' + fmt(xpIn) + " / " + fmt(E.season.tierXp) + " XP · " + L("total", "总计") + " " + fmt(S.season.xp) + "</small>" +
      (S.season.premium ? '<span class="tk-badge ok">✓ ' + L("Premium track active", "高级通道已开启") + "</span>" : '<button class="tk-btn" data-premium>' + L("Unlock premium track", "解锁高级通道") + " · " + fmt(E.season.premiumCost) + "</button>") + "</div></div>" +
      '<div class="tk-lanes"><div class="tk-lane-labels"><span></span><span>' + L("FREE", "免费") + "</span><span>" + L("PREMIUM", "高级") + '</span></div><div class="tk-track">' + cols + "</div></div>";
    $$("[data-claimtier]", el).forEach(function (b) { b.onclick = function () { var p = b.dataset.claimtier.split(":"); var rw = E.claimTier(+p[0], p[1] === "1"); if (rw && rw.kind === "item") toastPlain(L("Unlocked · ", "已解锁 · ") + E.name(E.find(rw.cat, rw.id))); renderSeason(); }; });
    var pb = $("[data-premium]", el); if (pb) pb.onclick = function () { txFlow({ kicker: L("SEASON I · PREMIUM TRACK", "第一季 · 高级通道"), title: L("Ignition premium track", "点火高级通道"), sub: L("Unlocks the premium lane: tokens on every tier plus the Ignition suit, trail and hull.", "解锁高级通道：每级代币，以及点火战衣、尾迹与战舰。"), art: '<img src="assets/3d/premium/skin-ignition.webp" alt="">', price: E.season.premiumCost, confirm: L("Unlock track", "解锁通道"), run: function () { return E.unlockPremiumSeason(); }, doneTitle: L("Premium track unlocked", "高级通道已解锁"), onDone: function () { renderSeason(); } }); };
    var tr = $(".tk-track", el), nx = $(".tk-col.next", el) || $(".tk-col.reached:last-of-type", el); if (tr && nx) tr.scrollLeft = Math.max(0, nx.offsetLeft - 120);
  }

  // ------------------------------------------------------------------ MISSIONS, EVENTS, MODES
  function renderMissions() {
    var el = $('[data-panel="missions"]', page), S = E.state(), now = Date.now();
    el.innerHTML = '<div class="tk-sec-head"><h3>' + L("Premium missions", "高级任务") + "</h3><p>" + L("Unlock a challenge with tokens, complete it in normal play, then claim tokens and Season XP.", "用代币解锁挑战，在正常游戏中完成，然后领取代币与赛季经验。") + '</p></div><div class="tk-missions">' + E.missions.map(function (m) {
        var un = S.missions.unlocked.indexOf(m.id) >= 0, done = S.missions.claimed.indexOf(m.id) >= 0, pr = S.missions.progress[m.id] || 0, pct = Math.min(100, pr / m.target * 100), ready = un && !done && pr >= m.target;
        return '<article class="tk-mission' + (un ? " open" : " locked") + (done ? " done" : "") + (ready ? " ready" : "") + '" data-m="' + m.id + '"><div class="tk-m-art"><img src="' + m.art + '" alt="" loading="lazy">' + (un ? "" : '<div class="tk-lock"><span>🔒</span><b>' + COIN + fmt(m.cost) + "</b></div>") + '</div><div class="tk-m-body"><h4>' + esc(E.name(m)) + "</h4><p>" + esc(L(m.desc, m.descZh)) + '</p><div class="tk-m-prog"><span class="tk-bar"><i style="width:' + pct + '%"></i></span><small>' + fmt(pr) + " / " + fmt(m.target) + " " + m.unit + '</small></div><div class="tk-m-foot"><span>' + COIN + "+" + fmt(m.reward) + " · +" + fmt(m.xp) + " XP</span>" +
          (done ? '<span class="tk-badge ok">✓ ' + L("Claimed", "已领取") + "</span>" : ready ? '<button class="tk-btn small mint" data-claimm="' + m.id + '">' + L("Claim", "领取") + "</button>" : un ? '<span class="tk-badge">' + L("In progress", "进行中") + "</span>" : '<button class="tk-btn small" data-unlockm="' + m.id + '">' + L("Unlock", "解锁") + "</button>") + "</div></div></article>";
      }).join("") + "</div>" +
      '<div class="tk-sec-head"><h3>' + L("Limited-time events", "限时活动") + '</h3></div><div class="tk-events">' + E.events.map(function (ev) { var st = E.eventState(ev, now), live = st.active; return '<article class="tk-event' + (live ? " live" : "") + '"><div class="tk-ev-top"><span class="tk-mono">' + (live ? '<i class="tk-live"></i> ' + L("LIVE · ends in", "进行中 · 剩余") : L("Starts in", "距开始")) + ' <b class="tk-count" data-ends="' + (live ? st.end : st.start) + '">' + dur((live ? st.end : st.start) - now) + "</b></span>" + (st.unlocked ? '<span class="tk-badge ok">✓ ' + L("Pass active", "通行证已激活") + "</span>" : "") + "</div><h4>" + esc(E.name(ev)) + "</h4><p>" + esc(L(ev.desc, ev.descZh)) + "</p>" + (st.unlocked ? "" : '<button class="tk-btn small" data-unlockev="' + ev.id + '">' + L("Get event pass", "获取活动通行证") + " · " + fmt(ev.cost) + "</button>") + "</article>"; }).join("") + "</div>" +
      '<div class="tk-sec-head"><h3>' + L("Unlockable game modes", "可解锁游戏模式") + '</h3></div><div class="tk-modes">' + E.modes.map(function (m) { var has = E.hasMode(m.id); return '<article class="tk-mode' + (has ? " open" : "") + '"><img src="' + m.art + '" alt="" loading="lazy"><div><h4>' + esc(E.name(m)) + "</h4><p>" + esc(L(m.desc, m.descZh)) + "</p>" + (has ? '<button class="tk-btn small mint" data-play-mode="' + m.id + '">' + L("Play", "开始") + "</button>" : '<button class="tk-btn small" data-unlockmode="' + m.id + '">' + L("Unlock", "解锁") + " · " + fmt(m.cost) + "</button>") + "</div></article>"; }).join("") + "</div>";
    $$("[data-unlockm]", el).forEach(function (b) { b.onclick = function () { var m = E.missions.find(function (x) { return x.id === b.dataset.unlockm; }); txFlow({ kicker: L("PREMIUM MISSION", "高级任务"), title: E.name(m), sub: L(m.desc, m.descZh), art: '<img src="' + m.art + '" alt="">', price: m.cost, confirm: L("Unlock mission", "解锁任务"), run: function () { return E.unlockMission(m.id); }, doneTitle: L("Mission unlocked", "任务已解锁"), onDone: function () { renderMissions(); var card = $('[data-m="' + m.id + '"]', page); if (card) card.classList.add("reveal"); } }); }; });
    $$("[data-claimm]", el).forEach(function (b) { b.onclick = function () { E.claimMission(b.dataset.claimm); renderMissions(); }; });
    $$("[data-unlockev]", el).forEach(function (b) { b.onclick = function () { var ev = E.events.find(function (x) { return x.id === b.dataset.unlockev; }); txFlow({ kicker: L("EVENT PASS", "活动通行证"), title: E.name(ev), sub: L(ev.desc, ev.descZh), art: '<img src="assets/3d/maps/' + (ev.effect === "xp2" ? "neon" : "orbit") + '.webp" alt="">', price: ev.cost, confirm: L("Get pass", "获取通行证"), run: function () { return E.unlockEvent(ev.id); }, doneTitle: L("Event pass active", "活动通行证已激活"), onDone: function () { renderMissions(); } }); }; });
    $$("[data-unlockmode]", el).forEach(function (b) { b.onclick = function () { var m = E.modes.find(function (x) { return x.id === b.dataset.unlockmode; }); txFlow({ kicker: L("GAME MODE", "游戏模式"), title: E.name(m), sub: L(m.desc, m.descZh), art: '<img src="' + m.art + '" alt="">', price: m.cost, confirm: L("Unlock mode", "解锁模式"), run: function () { return E.unlockMode(m.id); }, doneTitle: L("Mode unlocked", "模式已解锁"), doneActions: '<button class="tk-btn" data-play-mode="' + m.id + '">' + L("Play now", "立即开始") + "</button>", onDone: function () { renderMissions(); bindCommon(modal); } }); }; });
    bindCommon(el);
  }

  // ------------------------------------------------------------------ ECONOMY (buyback) — illustrative only
  var alloc = 20;
  function renderEconomy() {
    var el = $('[data-panel="economy"]', page);
    var next = new Date(); next.setUTCHours(24, 0, 0, 0);
    el.innerHTML = '<div class="tk-illus"><b>' + L("ILLUSTRATIVE", "示意") + "</b> " + L("This dashboard explains the planned mechanism with sample numbers. No buybacks have been executed, no treasury is live, and nothing here is a forecast or a promise of returns.", "本面板用示例数字说明计划中的机制。尚未执行任何回购，金库未上线，本页内容不构成预测或收益承诺。") + "</div>" +
      '<div class="tk-sec-head"><h3>' + L("Daily token buybacks", "每日代币回购") + "</h3><p>" + L("A portion of eligible game fees may be allocated to scheduled daily token buybacks, subject to treasury rules and available revenue.", "部分符合条件的游戏费用可能被分配用于定期的每日代币回购，具体受金库规则及可用收入约束。") + "</p></div>" +
      '<div class="tk-flow"><svg viewBox="0 0 980 200" class="tk-flow-svg" aria-label="Fees flow to treasury, a rule-based share is scheduled for buyback">' +
        '<defs><linearGradient id="tkf" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".1"/><stop offset=".5" stop-color="#9945ff" stop-opacity=".85"/><stop offset="1" stop-color="#14f195" stop-opacity=".9"/></linearGradient></defs>' +
        flowNode(6, L("Game fees", "游戏费用"), L("cosmetics · entries · passes", "外观 · 入场 · 通行证")) + flowNode(252, L("Treasury", "金库"), L("rules-based allocation", "按规则分配")) + flowNode(498, L("Buyback share", "回购份额"), L("eligible fees × allocation", "符合条件费用 × 分配比例")) + flowNode(744, L("Scheduled buyback", "定期回购"), L("daily window · if revenue allows", "每日窗口 · 视收入而定")) +
        '<path class="tk-flow-line" d="M230 100 H252 M476 100 H498 M722 100 H744" stroke="url(#tkf)" stroke-width="2" fill="none"/></svg></div>' +
      '<div class="tk-econ-grid"><div class="tk-econ-card"><h4>' + L("Treasury allocation (illustrative)", "金库分配（示意）") + '</h4><div class="tk-donut-wrap"><svg viewBox="0 0 120 120" class="tk-donut" id="tkDonut"></svg><div class="tk-donut-legend" id="tkLegend"></div></div><label class="tk-slider"><span>' + L("Buyback allocation", "回购分配比例") + ' <b id="tkAllocV">' + alloc + '%</b></span><input type="range" min="5" max="35" step="1" value="' + alloc + '" id="tkAlloc"></label></div>' +
        '<div class="tk-econ-card"><h4>' + L("Eligible revenue vs. buyback share — sample month", "符合条件收入与回购份额 — 示例月") + '</h4><svg viewBox="0 0 520 220" class="tk-area" id="tkArea"></svg><small class="tk-mono">' + L("SAMPLE DATA · NOT REAL ACTIVITY", "示例数据 · 非真实活动") + "</small></div></div>" +
      '<div class="tk-econ-grid three"><div class="tk-kpi"><small>' + L("Next scheduled window", "下次计划窗口") + '</small><b class="tk-count" data-ends="' + next.getTime() + '">' + dur(next - Date.now()) + "</b><span>" + L("00:00 UTC daily · schedule illustrative", "每日 00:00 UTC · 时间表为示意") + '</span></div><div class="tk-kpi"><small>' + L("Executed buybacks", "已执行回购") + "</small><b>0</b><span>" + L("Mechanism not live yet", "机制尚未上线") + '</span></div><div class="tk-kpi"><small>' + L("Sample month · buyback share", "示例月 · 回购份额") + '</small><b id="tkKpiShare">—</b><span>' + L("from the illustrative model above", "来自上方示意模型") + "</span></div></div>" +
      '<div class="tk-econ-grid"><div class="tk-econ-card"><h4>' + L("Historical activity", "历史记录") + '</h4><div class="tk-empty">' + L("No buyback has been executed. When the mechanism is live, each window will be listed here with its amount and an on-chain transaction link.", "尚未执行任何回购。机制上线后，每个窗口都会在此列出金额与链上交易链接。") + '</div></div><div class="tk-econ-card"><h4>' + L("Treasury rules", "金库规则") + '</h4><ol class="tk-rules"><li>' + L("Only eligible game fees count (cosmetic sales, raid & tournament entries, passes). Prize payouts are excluded.", "仅计入符合条件的游戏费用（外观销售、突袭与锦标赛入场、通行证），奖金发放除外。") + "</li><li>" + L("The buyback share is a fixed percentage set by treasury rules and published before it applies.", "回购份额为金库规则设定的固定比例，并在生效前公布。") + "</li><li>" + L("Buybacks run on a daily schedule and only when available revenue covers operating reserves.", "回购按每日计划执行，且仅在可用收入覆盖运营储备时进行。") + "</li><li>" + L("A window can be skipped or reduced if revenue is insufficient; nothing is guaranteed.", "收入不足时窗口可跳过或缩减，不作任何保证。") + "</li><li>" + L("Every executed buyback will be published with an on-chain reference.", "每次执行的回购都将附链上记录公布。") + "</li></ol></div></div>";
    var sl = $("#tkAlloc", el); sl.oninput = function () { alloc = +sl.value; $("#tkAllocV").textContent = alloc + "%"; drawEcon(); };
    drawEcon();
  }
  function flowNode(x, a, b) { return '<g class="tk-node" transform="translate(' + x + ',52)"><rect width="224" height="96" rx="18"/><text x="18" y="40" class="t1">' + esc(a) + '</text><text x="18" y="66" class="t2">' + esc(b) + "</text></g>"; }
  function drawEcon() {
    var parts = [{ k: L("Buyback", "回购"), v: alloc, c: "#9945ff" }, { k: L("Player rewards", "玩家奖励"), v: 35, c: "#14f195" }, { k: L("Operations", "运营"), v: 30, c: "#cfe3ff" }, { k: L("Reserve", "储备"), v: 35 - alloc, c: "#55575e" }], tot = parts.reduce(function (a, p) { return a + p.v; }, 0);
    var a0 = -Math.PI / 2, svg = "", r = 46, cx = 60, cy = 60; parts.forEach(function (p) { var a1 = a0 + p.v / tot * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0; svg += '<path d="M' + (cx + Math.cos(a0) * r) + " " + (cy + Math.sin(a0) * r) + " A" + r + " " + r + " 0 " + large + " 1 " + (cx + Math.cos(a1) * r) + " " + (cy + Math.sin(a1) * r) + '" stroke="' + p.c + '" stroke-width="12" fill="none"/>'; a0 = a1 + .02; });
    svg += '<text x="60" y="58" text-anchor="middle" class="d1">' + alloc + '%</text><text x="60" y="74" text-anchor="middle" class="d2">' + L("BUYBACK", "回购") + "</text>";
    $("#tkDonut").innerHTML = svg; $("#tkLegend").innerHTML = parts.map(function (p) { return '<div><i style="background:' + p.c + '"></i>' + esc(p.k) + "<b>" + Math.round(p.v / tot * 100) + "%</b></div>"; }).join("");
    // sample month: seeded eligible revenue, share = alloc %
    var s = 7, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, days = [], W = 520, H = 220, pad = 24;
    for (var i = 0; i < 30; i++) days.push(600 + Math.sin(i / 4) * 160 + rnd() * 240 + i * 9);
    var max = Math.max.apply(null, days) * 1.1, x = function (i) { return pad + i / 29 * (W - pad * 2); }, y = function (v) { return H - pad - v / max * (H - pad * 2); };
    var line = days.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" "), share = days.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v * alloc / 100).toFixed(1); }).join(" ");
    var grid = ""; for (var g = 0; g < 4; g++) { var gy = pad + g * (H - pad * 2) / 3; grid += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/>'; }
    $("#tkArea").innerHTML = grid + '<path d="' + line + " L" + x(29) + " " + (H - pad) + " L" + x(0) + " " + (H - pad) + ' Z" class="a1"/><path d="' + line + '" class="l1"/><path d="' + share + " L" + x(29) + " " + (H - pad) + " L" + x(0) + " " + (H - pad) + ' Z" class="a2"/><path d="' + share + '" class="l2"/><text x="' + pad + '" y="16" class="lg">— ' + L("eligible fees (sample)", "符合条件费用（示例）") + '</text><text x="' + (W / 2) + '" y="16" class="lg r">— ' + L("buyback share", "回购份额") + " " + alloc + "%</text>";
    var sum = days.reduce(function (a, v) { return a + v * alloc / 100; }, 0); var k = $("#tkKpiShare"); if (k) k.textContent = fmt(sum) + " " + L("sample units", "示例单位");
  }

  // ------------------------------------------------------------------ wallet drawer
  function toggleDrawer(on) { drawer.classList.toggle("on", on); drawer.setAttribute("aria-hidden", on ? "false" : "true"); if (on) renderDrawer(); }
  function renderDrawer() {
    var S = E.state(), pend = S.pending.reduce(function (a, p) { return a + p.amount; }, 0), ICON = { purchase: "↗", entry: "↗", unlock: "↗", reward: "↙", claim: "↙", prize: "★", grant: "◆" };
    var inv = ["skins", "outfits", "fx", "maps"].map(function (c) { return '<div><small>' + L(CATS[c][0], CATS[c][1]) + "</small><b>" + S.owned[c].length + "</b></div>"; }).join("");
    drawer.innerHTML = '<div class="tk-dr-head"><span class="tk-mono">' + L("WALLET", "钱包") + '</span><button class="tk-x" aria-label="Close">×</button></div>' +
      '<div class="tk-dr-bal">' + COIN + "<div><small>" + L("In-game balance", "游戏内余额") + "</small><b>" + fmt(S.balance) + ' <span>$FORGE</span></b></div></div><div class="tk-dr-prov"><i></i>' + L("Wallet connection coming soon · balance kept on this device", "钱包连接即将上线 · 余额保存在本设备") + '</div><div class="tk-dr-launch">' + launchButtons(true) + "</div>" +
      '<div class="tk-dr-sec"><h5>' + L("Rewards to claim", "待领取奖励") + "</h5>" + (S.pending.length ? S.pending.slice(0, 8).map(function (p) { return '<div class="tk-dr-row"><span>' + esc(p.memo) + "</span><b>+" + fmt(p.amount) + "</b></div>"; }).join("") + '<button class="tk-btn mint wide" data-claimall>' + L("Claim all", "全部领取") + " · +" + fmt(pend) + "</button>" : '<div class="tk-empty small">' + L("Play the arena, raids or pilot missions to earn rewards.", "游玩竞技场、突袭或飞行员任务以赚取奖励。") + "</div>") + "</div>" +
      '<div class="tk-dr-sec"><h5>' + L("Inventory", "物品") + '</h5><div class="tk-dr-inv">' + inv + "</div></div>" +
      '<div class="tk-dr-sec"><h5>' + L("Transaction history", "交易记录") + '</h5><div class="tk-dr-hist">' + S.history.slice(0, 40).map(function (h) { return '<div class="tk-dr-tx"><i class="' + (h.amount < 0 ? "out" : "in") + '">' + (ICON[h.type] || "·") + "</i><div><b>" + esc(h.memo) + "</b><small>" + new Date(h.t).toLocaleString() + (h.txId ? " · " + esc(h.txId) : "") + '</small></div><span class="' + (h.amount < 0 ? "neg" : "pos") + '">' + (h.amount > 0 ? "+" : "") + (h.amount ? fmt(h.amount) : "—") + "</span></div>"; }).join("") + "</div></div>" +
      '<div class="tk-dr-foot"><button class="tk-btn ghost small" data-reset>' + L("Reset progress", "重置进度") + "</button></div>";
    $(".tk-x", drawer).onclick = function () { toggleDrawer(false); }; bindLaunch(drawer);
    var ca = $("[data-claimall]", drawer); if (ca) ca.onclick = function () { E.claimPending(); renderDrawer(); };
    $("[data-reset]", drawer).onclick = function () { if (this.dataset.armed) { E.reset(); renderAll(); renderDrawer(); toastPlain(L("Progress reset", "进度已重置")); } else { this.dataset.armed = "1"; this.textContent = L("Tap again to confirm reset", "再次点击确认重置"); } };
  }

  // ------------------------------------------------------------------ shared bindings, routing, refresh
  function bindCommon(root) {
    $$("[data-play-mode]", root).forEach(function (b) { b.onclick = function () { closeModal(); if (!E.playMode(b.dataset.playMode)) toastPlain(L("Finish the current run first", "请先结束当前对局")); }; });
    $$("[data-goto-page]", root).forEach(function (b) { b.onclick = function () { closeModal(); var nb = document.querySelector('[data-page="' + b.dataset.gotoPage + '"]'); if (nb) nb.click(); }; });
    $$("[data-goto-tab]", root).forEach(function (b) { b.onclick = function () { setTab(b.dataset.gotoTab); }; });
  }
  var RENDER = { market: renderMarket, raids: renderRaids, cups: renderCups, season: renderSeason, missions: renderMissions, economy: renderEconomy };
  function setTab(t) { tab = t; $$(".tk-tabs button", page).forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); }); $$(".tk-panel", page).forEach(function (p) { p.classList.toggle("on", p.dataset.panel === t); }); RENDER[t](); try { history.replaceState(null, "", "#token/" + t); } catch (e) {} }
  function renderAll() { copy(); syncTop(); if (page.classList.contains("active")) RENDER[tab](); }
  $$(".tk-tabs button", page).forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
  E.on(function () { syncTop(); if (page.classList.contains("active") && tab !== "economy") { var y = window.scrollY; RENDER[tab](); window.scrollTo(0, y); } if (drawer.classList.contains("on")) renderDrawer(); });
  $("#tkPill").onclick = function () { toggleDrawer(!drawer.classList.contains("on")); };
  $("#tkOpenWallet").onclick = function () { toggleDrawer(true); };
  $("#tkDaily").onclick = function () { E.claimDaily(); syncTop(); };
  $("#tkClaimAll").onclick = function () { E.claimPending(); };
  // live countdowns
  setInterval(function () { $$(".tk-count[data-ends]").forEach(function (n) { n.textContent = dur(+n.dataset.ends - Date.now()); }); }, 1000);
  // activate when the TOKEN nav button is used (game.js toggles .active on the page)
  new MutationObserver(function () { if (page.classList.contains("active")) { E.settle(); copy(); setTab(tab); } }).observe(page, { attributes: true, attributeFilter: ["class"] });
  function fromHash() { var h = location.hash.slice(1); if (h.indexOf("token") === 0) { var t = h.split("/")[1]; if (t && RENDER[t]) tab = t; var nb = document.querySelector('[data-page="token"]'); if (nb && !page.classList.contains("active")) nb.click(); else if (page.classList.contains("active")) setTab(tab); } }
  window.addEventListener("hashchange", fromHash); window.addEventListener("load", function () { setTimeout(fromHash, 60); });
  window.addEventListener("signal-language", function () { renderAll(); });
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#langToggle")) setTimeout(renderAll, 50); });
  copy(); syncTop(); shown = target = E.balance(); tickBalance();
})();
