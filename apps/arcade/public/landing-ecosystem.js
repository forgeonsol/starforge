/* Landing: token ecosystem section. Runs before landing.js so its reveal / tilt hooks pick these nodes up.
   With FORGE_ECOSYSTEM === false the original v11 token section is left untouched. */
(function () {
  "use strict";
  if (window.FORGE_ECOSYSTEM === false) return;
  var sec = document.getElementById("token"); if (!sec) return;
  var lang = function () { try { return localStorage.getItem("signal-language") === "zh" ? "zh" : "en"; } catch (e) { return "en"; } };
  var L = function (en, zh) { return lang() === "zh" ? zh : en; };
  var NODES = [
    { id: "market", angle: -135, art: "assets/3d/premium/skin-crimson.webp", status: "demo",
      t: ["In-game purchases", "游戏内购买"], d: ["Spend tokens on ship skins, pilot outfits, weapon effects, map access, and exclusive cosmetic upgrades.", "使用代币购买战舰外观、飞行员服装、武器特效、地图通行权及限定外观升级。"],
      flow: ["Buy a hull finish → it flies in the 3D arena. Outfits and weapon colours carry into the pilot campaign; map passes open sectors instantly.", "购买船体涂装 → 立即出现在 3D 竞技场。服装与武器颜色同步到飞行员战役；地图通行证立即开放区域。"], tags: [["Skins", "外观"], ["Outfits", "服装"], ["Weapon FX", "武器特效"], ["Map access", "地图通行"]] },
    { id: "raids", angle: -45, art: "assets/3d/guardians/guardian-0-1.webp", status: "demo",
      t: ["Competitive play", "竞技玩法"], d: ["Use tokens to enter special boss raids and tournaments, with rewards for top performers.", "使用代币参加特别首领突袭与锦标赛，表现最佳者可获得奖励。"],
      flow: ["Pay a raid entry → the arena opens straight into a chosen boss. Tournaments track your best score against the field and pay the top ten.", "支付突袭入场费 → 竞技场直接迎战指定首领。锦标赛记录你的最佳成绩，并向前十名发放奖励。"], tags: [["Boss raids", "首领突袭"], ["Tournaments", "锦标赛"], ["Leaderboards", "排行榜"]] },
    { id: "season", angle: 45, art: "assets/3d/premium/skin-ignition.webp", status: "demo",
      t: ["Progression & access", "进度与准入"], d: ["Unlock premium missions, limited-time events, and seasonal content.", "解锁高级任务、限时活动与赛季内容。"],
      flow: ["Every run earns Season XP. Tokens open the premium track, premium missions, event passes and new modes like Boss Rush and Hardcore.", "每局都获得赛季经验。代币可开启高级通道、高级任务、活动通行证以及首领冲刺、硬核等新模式。"], tags: [["Season pass", "赛季通行证"], ["Missions", "任务"], ["Events", "活动"], ["Modes", "模式"]] },
    { id: "economy", angle: 135, art: null, status: "planned",
      t: ["Daily buybacks", "每日回购"], d: ["A portion of eligible game fees is allocated to scheduled token buybacks, subject to treasury rules and available revenue.", "部分符合条件的游戏费用将分配用于定期代币回购，具体受金库规则及可用收入约束。"],
      flow: ["Fees from cosmetics, entries and passes reach the treasury; a rule-set share is scheduled for daily buybacks when revenue allows. Shown with illustrative data until live.", "外观、入场与通行证费用进入金库；在收入允许时，按规则设定的份额用于每日回购。上线前以示意数据展示。"], tags: [["Treasury rules", "金库规则"], ["Daily schedule", "每日计划"], ["Illustrative", "示意"]] },
  ];
  var active = 0, timer = null, held = 0;
  function chart() { var pts = [32, 40, 36, 48, 44, 56, 52, 64, 60, 70, 66, 78]; return '<svg viewBox="0 0 240 150" class="eco-chart" aria-hidden="true"><defs><linearGradient id="ecg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9945ff" stop-opacity=".45"/><stop offset="1" stop-color="#14f195" stop-opacity="0"/></linearGradient><linearGradient id="ecs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14f195"/><stop offset="1" stop-color="#9945ff"/></linearGradient></defs>' + pts.map(function (v, i) { return '<rect x="' + (14 + i * 18) + '" y="' + (130 - v * 1.4) + '" width="10" height="' + (v * 1.4) + '" rx="2" fill="' + (i === pts.length - 1 ? "url(#ecs)" : "rgba(255,255,255,.16)") + '" style="--i:' + i + '"/>'; }).join("") + '<path d="M19 ' + (130 - pts[0] * 1.4) + pts.map(function (v, i) { return " L" + (19 + i * 18) + " " + (130 - v * 1.4 - 8); }).join("") + '" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 4"/></svg>'; }
  function badge(s) { return '<span class="eco-badge ' + (s === "planned" ? "planned" : "demo") + '">' + L("COMING SOON", "即将上线") + "</span>"; }
  var hubSec = document.getElementById("ecosystem");
  if (!hubSec) { hubSec = document.createElement("section"); hubSec.className = "sec stage-fit"; hubSec.id = "ecosystem"; sec.after(hubSec); }
  function render() {
    sec.innerHTML = '<div class="wrap">' +
      '<div class="sec-head"><div><span class="label idx red rv">$FORGE · ' + L("TOKEN ECOSYSTEM", "代币生态") + '</span><h2 class="rv eco-title" style="--d:.08s">' + L("One token.<br>An entire <span class=\"sol-text\">gaming universe.</span>", "一枚代币，<br>一整个<span class=\"sol-text\">游戏宇宙</span>。") + '</h2></div><p class="rv" style="--d:.16s">' + L("Customize your experience, unlock new challenges, compete for rewards, and explore a connected gaming economy.", "定制你的体验，解锁新挑战，争夺奖励，探索互联的游戏经济。") + "</p></div>" +
      '<div class="utility eco-cards">' + NODES.map(function (n, i) {
        return '<article class="util rv eco-card' + (n.status === "planned" ? " hot" : "") + '" style="--d:' + (i * .08) + 's" data-node="' + i + '"><div class="eco-art">' + (n.art ? '<img src="' + n.art + '" alt="" loading="lazy">' : chart()) + '</div><div class="uhead"><span class="mono">0' + (i + 1) + "</span>" + badge(n.status) + "</div><h3>" + L(n.t[0], n.t[1]) + "</h3><p>" + L(n.d[0], n.d[1]) + '</p><div class="tags">' + n.tags.map(function (t) { return "<span>" + L(t[0], t[1]) + "</span>"; }).join("") + "</div></article>";
      }).join("") + "</div>" +
"</div>";
    hubSec.innerHTML = '<div class="wrap"><div class="sec-head"><div><span class="label idx rv">' + L("HOW IT CONNECTS", "运作方式") + '</span><h2 class="rv" style="--d:.08s">' + L("Four systems.<br>One core.", "四个系统，<br>一个核心。") + '</h2></div><p class="rv" style="--d:.16s">' + L("Tap a system to see how the token moves through it — then open it in the game.", "点击一个系统，查看代币如何在其中流转，并可直接在游戏中打开。") + "</p></div>" +
      '<div class="eco-hub rv fill" id="ecoHub"><div class="eco-stage"><canvas id="ecoCv" aria-hidden="true"></canvas><div class="eco-core"><img src="logo.svg" alt=""><span>$FORGE</span></div>' +
        NODES.map(function (n, i) { return '<button class="eco-node n' + i + (i === active ? " on" : "") + '" data-i="' + i + '" type="button"><i></i><b>' + L(n.t[0], n.t[1]) + "</b><small>" + L("Coming soon", "即将上线") + "</small></button>"; }).join("") +
        '<span class="eco-hint mono">' + L("INTERACTIVE · TAP A SYSTEM", "可交互 · 点击系统") + "</span></div>" +
        '<div class="eco-panel" id="ecoPanel"></div></div>' +
      '<p class="utility-note eco-note">' + L("$FORGE token integration is coming soon. Until launch, in-game balances, purchases, raids and tournaments run inside the game and nothing is on-chain yet. Buybacks are a planned mechanism shown with illustrative data only; no buyback has been executed and nothing here is a promise of returns.", "$FORGE 代币接入即将上线。上线前，游戏内余额、购买、突袭与锦标赛均在游戏内运行，尚未上链。回购为计划中的机制，仅以示意数据展示；尚未执行任何回购，本页内容不构成任何收益承诺。") + "</p></div>";
    panel(); bind();
  }
  function panel() {
    var n = NODES[active], p = document.getElementById("ecoPanel"); if (!p) return;
    p.innerHTML = '<span class="mono">' + L("SYSTEM", "系统") + " 0" + (active + 1) + " · " + (n.status === "planned" ? L("COMING SOON", "即将上线") : L("PREVIEW IN THE GAME · TOKEN COMING SOON", "游戏内可预览 · 代币即将上线")) + "</span><h3>" + L(n.t[0], n.t[1]) + "</h3><p>" + L(n.flow[0], n.flow[1]) + '</p><div class="eco-steps">' + steps(n.id).map(function (s, i) { return '<div style="--i:' + i + '"><b>0' + (i + 1) + "</b><span>" + s + "</span></div>"; }).join("") + '</div><a class="btn" href="game.html#token/' + n.id + '"><span>' + (n.status === "planned" ? L("See the buyback dashboard", "查看回购面板") : L("Open in the game", "在游戏中打开")) + '</span><span class="arr">→</span></a>';
  }
  function steps(id) {
    return { market: [L("Browse 4 categories", "浏览 4 个分类"), L("Confirm the purchase", "确认购买"), L("Equip — it's in the run", "装备 — 立即生效")],
      raids: [L("Pick a raid or cup", "选择突袭或杯赛"), L("Pay the token entry", "支付代币入场"), L("Climb the board, claim", "冲榜并领取奖励")],
      season: [L("Earn XP every run", "每局获得经验"), L("Unlock premium content", "解锁高级内容"), L("Claim tier rewards", "领取等级奖励")],
      economy: [L("Eligible fees", "符合条件费用"), L("Rule-based treasury share", "按规则的金库份额"), L("Scheduled daily window", "每日计划窗口")] }[id];
  }
  function setActive(i) { active = i; document.querySelectorAll(".eco-node").forEach(function (b) { b.classList.toggle("on", +b.dataset.i === i); }); document.querySelectorAll(".eco-card").forEach(function (c) { c.classList.toggle("lit", +c.dataset.node === i); }); var p = document.getElementById("ecoPanel"); if (p) { p.classList.remove("swap"); void p.offsetWidth; p.classList.add("swap"); } panel(); }
  function bind() {
    document.querySelectorAll(".eco-node").forEach(function (b) { b.addEventListener("click", function () { setActive(+b.dataset.i); held = Date.now(); }); });
    clearInterval(timer); timer = setInterval(function () { if (visible && Date.now() - held > 9000) setActive((active + 1) % NODES.length); }, 4200);
  }
  // flowing particles between the core and the four systems
  var visible = false, cv, g, W = 0, H = 0, dpr = 1, parts = [];
  function size() { cv = document.getElementById("ecoCv"); if (!cv) return; var r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g = cv.getContext("2d"); }
  function nodePos(i) { var el = document.querySelector(".eco-node.n" + i), st = document.querySelector(".eco-stage"); if (!el || !st) return { x: 0, y: 0 }; var a = el.getBoundingClientRect(), b = st.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 }; }
  function frame(now) {
    requestAnimationFrame(frame); if (!visible || !g) return; var t = now / 1000, cx = W / 2, cy = H / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (var k = 0; k < 3; k++) { g.strokeStyle = "rgba(255,255,255," + (.07 - k * .02) + ")"; g.beginPath(); g.ellipse(cx, cy, Math.min(W, H) * (.2 + k * .12), Math.min(W, H) * (.2 + k * .12) * .42, 0, 0, Math.PI * 2); g.stroke(); }
    for (var i = 0; i < NODES.length; i++) {
      var p = nodePos(i), on = i === active, planned = NODES[i].status === "planned";
      g.strokeStyle = on ? (planned ? "rgba(153,69,255,.6)" : "rgba(255,255,255,.45)") : "rgba(255,255,255,.1)"; g.lineWidth = on ? 1.4 : 1; g.setLineDash(planned ? [4, 6] : []); g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo((cx + p.x) / 2, (cy + p.y) / 2 - 40, p.x, p.y); g.stroke(); g.setLineDash([]);
      if (Math.random() < (on ? .5 : .12)) parts.push({ i: i, t: 0, sp: .35 + Math.random() * .4, out: i !== 3, c: planned ? "#9945ff" : on ? "#14f195" : "#ffffff" });
    }
    parts = parts.filter(function (q) { return q.t < 1; });
    parts.forEach(function (q) { q.t += q.sp / 60; var p = nodePos(q.i), u = q.out ? q.t : 1 - q.t, mx = (cx + p.x) / 2, my = (cy + p.y) / 2 - 40, x = (1 - u) * (1 - u) * cx + 2 * (1 - u) * u * mx + u * u * p.x, y = (1 - u) * (1 - u) * cy + 2 * (1 - u) * u * my + u * u * p.y; g.globalAlpha = Math.sin(q.t * Math.PI); g.fillStyle = q.c; g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
    var core = document.querySelector(".eco-core"); if (core) core.style.setProperty("--pulse", (1 + Math.sin(t * 2) * .03).toFixed(3));
  }
  render();
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) size(); }, { threshold: 0, rootMargin: "80px 0px" }).observe(hubSec); else visible = true;
  window.addEventListener("resize", size); requestAnimationFrame(frame);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-lang]")) setTimeout(function () { render(); size(); document.querySelectorAll("#token .rv, #ecosystem .rv").forEach(function (n) { n.classList.add("in"); }); }, 30); });
})();
