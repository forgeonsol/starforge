/* $FORGE leaderboard — one module for the landing stage (compact Top 10) and the game page (full board).
 *
 * Data:
 *  - real players come from GET /api/leaderboard (best server-verified arena run per player) and are
 *    refreshed every 20 s without reloading anything;
 *  - "this device" shows your own local best when you are not on the server board yet (or no server is reachable);
 *  - AI pilots fill open spots so the board is never empty. Each one carries an AI tag, and every real player
 *    takes the place of the AI pilot whose score is closest to theirs: with FILL real players there are none left.
 * Rendering: rows are absolutely positioned and moved with transform transitions (FLIP-style), only the
 * visible slice of the list is in the DOM, one rAF loop drives all number tweens.
 */
(function () {
  "use strict";
  var T = window.FORGE_TOKEN || {}, ONLINE = window.FORGE_ONLINE === true;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lang = function () { try { return localStorage.getItem("signal-language") === "zh" ? "zh" : "en"; } catch (e) { return "en"; } };
  var L = function (en, zh) { return lang() === "zh" ? zh : en; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };

  // seeded PRNG, used for the identicon avatars
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var entries = new Map(); // real players and this device only

  // ------------------------------------------------------------------ AI pilots: hold open spots until real pilots arrive
  var FILL = 60;
  var CALL = ["VANTA", "KESTREL", "HALCYON", "ORBIT", "EMBER", "NOVA", "ROOK", "ASTER", "CINDER", "DRIFT", "ECHO", "FLINT", "GALE", "HELIX", "ION", "JOLT", "LUMEN", "MYTH", "NYX", "ONYX", "PYRE", "QUILL", "RUNE", "SABLE", "TALON", "UMBRA", "VEX", "WISP", "ZEPHYR", "CORVID", "SOLACE", "AXIOM", "BRAMBLE", "CIPHER", "DYNAMO", "FERRO", "GRAVEL", "HALO", "INDIGO", "JACKAL"];
  var aiRand = rng(424242), aiUsed = {}, aiSeq = 0, bots = [];
  function aiPilot(score) {
    var name = "";
    for (var tries = 0; tries < 30; tries++) { name = CALL[Math.floor(aiRand() * CALL.length)] + "-" + String(1 + Math.floor(aiRand() * 98)).padStart(2, "0"); if (!aiUsed[name]) break; }
    aiUsed[name] = 1;
    return { id: "ai:" + (++aiSeq), name: name, score: score, kind: "ai", change: 0, joined: aiSeq };
  }
  for (var bi = 0; bi < FILL; bi++) {
    var be = aiPilot(Math.round(600 + Math.pow(aiRand(), 2.4) * 23000)), bc = aiRand();
    be.change = bc < .62 ? 0 : bc < .82 ? 1 + Math.floor(aiRand() * 3) : -(1 + Math.floor(aiRand() * 3));
    bots.push(be);
  }
  /** AI pilots still holding a spot: each real entry removes the remaining AI pilot closest to its score. */
  function seatedBots() {
    var pool = bots.slice();
    entries.forEach(function (h) {
      if (!pool.length) return;
      var best = 0, d = Infinity;
      for (var k = 0; k < pool.length; k++) { var x = Math.abs(pool[k].score - h.score); if (x < d) { d = x; best = k; } }
      pool.splice(best, 1);
    });
    return pool;
  }

  // ------------------------------------------------------------------ ranking
  var ranked = [], lastUpdate = Date.now(), liveState = ONLINE ? "connecting" : "device";
  function rerank(mark) {
    var prev = new Map(ranked.map(function (e, i) { return [e.id, i + 1]; }));
    ranked = Array.from(entries.values()).concat(seatedBots()).sort(function (a, b) { return b.score - a.score || a.joined - b.joined; });
    ranked.forEach(function (e, i) {
      var was = prev.get(e.id), now = i + 1; e.rank = now;
      if (mark && was && was !== now) { if (e.kind === "ai") e.change = was - now; e.flash = was > now ? "up" : "down"; }
      if (mark && !was && prev.size) e.flash = "new";
    });
    lastUpdate = Date.now(); boards.forEach(function (b) { b.render(); });
  }

  // real players
  function applyServer(body) {
    var seen = {};
    (body.rows || []).forEach(function (r) {
      var id = "p:" + r.key; seen[id] = 1; var e = entries.get(id) || { id: id, kind: "real", joined: -1e9 + r.rank };
      e.name = r.name; e.score = r.score; e.change = r.change; e.isNew = r.change == null; e.you = !!r.isYou; entries.set(id, e);
    });
    entries.forEach(function (e, id) { if (e.kind === "real" && !seen[id]) entries.delete(id); });
    liveState = "live"; localEntry(); rerank(true);
  }
  var pollTimer = null, failures = 0;
  function poll() {
    clearTimeout(pollTimer);
    if (!ONLINE) return;
    fetch("/api/leaderboard?limit=500", { headers: { Accept: "application/json" }, credentials: "same-origin" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (body) { failures = 0; applyServer(body); }, function () { failures++; liveState = "offline"; boards.forEach(function (b) { b.renderHead(); }); })
      .then(function () { pollTimer = setTimeout(poll, document.hidden ? 60000 : Math.min(120000, 20000 * Math.pow(2, failures))); });
  }
  // this device (static preview, or not yet signed in)
  function localEntry() {
    var onBoard = false; entries.forEach(function (e) { if (e.kind === "real" && e.you) onBoard = true; });
    if (onBoard) { entries.delete("local"); return; }
    var best = 0, name = "pilot"; try { var s = JSON.parse(localStorage.getItem("signal-protocol-save-v3") || "{}"); best = Number(s.best) || 0; name = String(s.callsign || "pilot").toLowerCase(); } catch (e) {}
    if (best > 0) entries.set("local", { id: "local", name: name, score: best, kind: "local", you: true, change: 0, joined: 1e9 }); else entries.delete("local");
  }

  // slow AI activity: a score change or two every 7–15 s, now and then a new AI pilot joins low on the board
  var aiTimer = null, visibleBoards = 0, nextNewcomer = Date.now() + 60000 + Math.random() * 60000;
  function aiTick() {
    clearTimeout(aiTimer);
    if (!document.hidden && visibleBoards > 0) {
      var seated = ranked.filter(function (e) { return e.kind === "ai"; }), n = Math.random() < .7 ? 1 : 2;
      for (var i = 0; i < n && seated.length; i++) {
        var e = seated[Math.floor(Math.pow(Math.random(), 3) * seated.length)];
        e.score += Math.round(80 + Math.random() * (e.rank < 20 ? 500 : 1100));
      }
      if (Date.now() > nextNewcomer && bots.length < FILL + 30) { bots.push(aiPilot(Math.round(800 + Math.random() * 3200))); nextNewcomer = Date.now() + 70000 + Math.random() * 80000; }
      rerank(true);
    }
    aiTimer = setTimeout(aiTick, 7000 + Math.random() * 8000);
  }

  // ------------------------------------------------------------------ avatars: symmetric 5×5 identicon from the id
  var avCache = new Map();
  function avatar(e) {
    var key = e.id; if (avCache.has(key)) return avCache.get(key);
    var h = 2166136261; for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    var r = rng(h), hue = Math.floor(r() * 360), hue2 = (hue + 60 + Math.floor(r() * 120)) % 360, cells = "";
    for (var y = 0; y < 5; y++) for (var x = 0; x < 3; x++) if (r() > .5) { cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; if (x < 2) cells += '<rect x="' + (4 - x) + '" y="' + y + '" width="1" height="1"/>'; }
    var svg = '<svg viewBox="-1 -1 7 7" aria-hidden="true"><defs><linearGradient id="g' + (h >>> 0) + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ' 70% 62%)"/><stop offset="1" stop-color="hsl(' + hue2 + ' 70% 52%)"/></linearGradient></defs><rect x="-1" y="-1" width="7" height="7" rx="1.6" fill="#141418"/><g fill="url(#g' + (h >>> 0) + ')">' + cells + "</g></svg>";
    avCache.set(key, svg); return svg;
  }

  // ------------------------------------------------------------------ number tweens (one rAF loop)
  var tweens = new Set(), rafOn = false;
  function tweenTo(el, from, to) {
    if (reduce || from === to) { el.textContent = fmt(to); el._v = to; return; }
    el._t = { from: from, to: to, t0: performance.now() }; tweens.add(el);
    if (!rafOn) { rafOn = true; requestAnimationFrame(step); }
  }
  function step(now) {
    tweens.forEach(function (el) { var k = Math.min(1, (now - el._t.t0) / 650), e = 1 - Math.pow(1 - k, 3), v = el._t.from + (el._t.to - el._t.from) * e; el.textContent = fmt(v); el._v = v; if (k >= 1) tweens.delete(el); });
    if (tweens.size) requestAnimationFrame(step); else rafOn = false;
  }

  // ------------------------------------------------------------------ board component
  var boards = [];
  function Board(root, opts) {
    this.root = root; this.opts = opts; this.compact = opts.mode === "compact"; this.tab = this.compact ? 10 : 50; this.q = ""; this.rows = new Map();
    this.ROW = this.compact ? 48 : 56;
    root.classList.add("lb", this.compact ? "lb-compact" : "lb-full");
    root.innerHTML = '<div class="lb-head"></div>' + (this.compact ? "" : '<div class="lb-tools"><div class="lb-tabs" role="tablist"></div><label class="lb-search"><input type="search" autocomplete="off" spellcheck="false"></label></div>') +
      '<div class="lb-cols mono"><span>#</span><span></span><span data-l="player"></span><span class="lb-c-score" data-l="score"></span><span class="lb-c-chg" data-l="change"></span></div>' +
      '<div class="lb-view"><div class="lb-list"></div><div class="lb-empty mono" hidden></div></div><div class="lb-foot mono"></div>';
    this.view = root.querySelector(".lb-view"); this.list = root.querySelector(".lb-list");
    var self = this;
    if (!this.compact) {
      root.querySelector(".lb-search input").addEventListener("input", function (ev) { self.q = ev.target.value.trim().toLowerCase(); self.view.scrollTop = 0; self.render(); });
      this.view.addEventListener("scroll", function () { self.renderRows(); }, { passive: true });
    }
    root.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-tab]"); if (!t) return;
      self.tab = t.dataset.tab === "all" ? Infinity : +t.dataset.tab; self.view.scrollTop = 0; self.render();
    });
    this.visible = false;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { var v = es[0].isIntersecting; if (v !== self.visible) { self.visible = v; visibleBoards = Math.max(0, visibleBoards + (v ? 1 : -1)); if (v) self.render(); } }, { rootMargin: "100px" }).observe(root);
    else { this.visible = true; visibleBoards++; }
    boards.push(this); this.render();
  }
  Board.prototype.data = function () {
    var list = ranked, q = this.q;
    if (this.compact) { var avail = this.view.clientHeight; this.tab = avail > this.ROW * 3 ? Math.max(3, Math.min(10, Math.floor(avail / this.ROW))) : (innerWidth < 760 ? 7 : 10); }
    if (q) list = list.filter(function (e) { return e.name.toLowerCase().indexOf(q) >= 0; });
    return isFinite(this.tab) ? list.slice(0, this.tab) : list;
  };
  Board.prototype.renderHead = function () {
    var head = this.root.querySelector(".lb-head"), state = liveState === "live" ? L("Live", "实时") : liveState === "offline" ? L("Reconnecting", "重新连接中") : liveState === "connecting" ? L("Connecting", "连接中") : L("This device", "本设备");
    head.innerHTML = '<div class="lb-status"><i class="lb-dot ' + liveState + '"></i><span class="mono">' + state + '</span><span class="mono lb-time">' + L("Updated ", "更新于 ") + new Date(lastUpdate).toLocaleTimeString(lang() === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "</span>" +
      (ranked.some(function (e) { return e.kind === "ai"; }) ? '<span class="mono lb-ai-note" title="' + esc(L("AI pilots hold open spots. Each real pilot takes the place of one.", "AI 飞行员占据空位，每位真实飞行员加入都会替换其中一位。")) + '">' + L("AI pilots fill open spots", "AI 飞行员填补空位") + "</span>" : "") + "</div>";
    if (!this.compact) {
      var tabs = [["10", "Top 10"], ["50", "Top 50"], ["all", L("All", "全部")]], cur = isFinite(this.tab) ? String(this.tab) : "all";
      this.root.querySelector(".lb-tabs").innerHTML = tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" class="' + (t[0] === cur ? "on" : "") + '">' + t[1] + "</button>"; }).join("");
      this.root.querySelector(".lb-search input").placeholder = L("Search a player", "搜索玩家");
    }
    this.root.querySelectorAll("[data-l]").forEach(function (n) { n.textContent = { player: L("Player", "玩家"), score: L("Best score", "最佳成绩"), change: L("Change", "变化") }[n.dataset.l]; });
    var real = ranked.filter(function (e) { return e.kind === "real"; }).length;
    this.root.querySelector(".lb-foot").textContent = (ONLINE ? L(real + " players with verified runs · ", real + " 位玩家有已验证成绩 · ") : L("Your best run on this device is included · ", "包含你在本设备上的最佳成绩 · ")) + L("Ranked by best arena run", "按最佳竞技场成绩排名");
  };
  Board.prototype.render = function () { if (!this.visible && this.rows.size) return; this.renderHead(); this.renderRows(); };
  Board.prototype.renderRows = function () {
    var data = this.data(), ROW = this.ROW, self = this, empty = this.root.querySelector(".lb-empty");
    this.list.style.height = data.length * ROW + "px";
    empty.hidden = data.length > 0;
    if (!data.length) empty.innerHTML = this.q ? esc(L("No player matches that search.", "没有匹配的玩家。"))
      : "<span>" + esc(L("No runs yet. Finish a run and take the first spot.", "暂无成绩。完成一局，拿下第一名。")) + "</span>" +
        (/game\.html$/.test(location.pathname) ? "" : '<a class="lb-empty-cta" href="game.html">' + esc(L("Launch a run", "开始一局")) + " →</a>");
    var top = this.compact ? 0 : this.view.scrollTop, h = this.compact ? data.length * ROW : (this.view.clientHeight || 600), from = Math.max(0, Math.floor(top / ROW) - 6), to = Math.min(data.length, Math.ceil((top + h) / ROW) + 6);
    var keep = new Set();
    for (var i = from; i < to; i++) {
      var e = data[i], row = this.rows.get(e.id), y = i * ROW; keep.add(e.id);
      if (!row) { row = this.makeRow(e); row.style.transform = "translateY(" + y + "px)"; if (e.flash === "new" && !reduce) row.classList.add("enter"); this.list.appendChild(row); this.rows.set(e.id, row); }
      this.fillRow(row, e, i);
      if (row._y !== y) { row._y = y; row.style.transform = "translateY(" + y + "px)"; }
    }
    this.rows.forEach(function (row, id) { if (!keep.has(id)) { row.remove(); self.rows.delete(id); } });
    data.forEach(function (e) { e.flash = null; });
  };
  Board.prototype.makeRow = function (e) {
    var row = document.createElement("div"); row.className = "lb-row"; row.style.height = this.ROW + "px";
    row.innerHTML = '<span class="lb-rank mono"></span><span class="lb-av"></span><span class="lb-name"><b></b><em></em></span><span class="lb-score mono"></span><span class="lb-chg mono"></span>';
    row.addEventListener("animationend", function () { row.classList.remove("up", "down", "enter"); });
    return row;
  };
  Board.prototype.fillRow = function (row, e, i) {
    var q = function (s) { return row.querySelector(s); };
    if (row._rank !== e.rank) { row._rank = e.rank; q(".lb-rank").textContent = "#" + String(e.rank).padStart(2, "0"); row.classList.toggle("podium", e.rank <= 3); }
    if (row._id !== e.id) { row._id = e.id; q(".lb-av").innerHTML = avatar(e); q(".lb-name b").textContent = e.name; }
    var tag = e.kind === "ai" ? '<span class="lb-tag ai" title="' + esc(L("AI pilot · holds this spot until a real pilot takes it", "AI 飞行员 · 在真实飞行员加入前占据此位")) + '">AI</span>' : e.kind === "local" ? '<span class="lb-tag you">' + L("YOU · THIS DEVICE", "你 · 本设备") + "</span>" : (e.you ? '<span class="lb-tag you">' + L("YOU", "你") + "</span>" : "") + '<span class="lb-tag ok" title="' + esc(L("Real player · run verified by the server", "真实玩家 · 成绩经服务器验证")) + '">✓</span>';
    if (row._tag !== tag) { row._tag = tag; q(".lb-name em").innerHTML = tag; }
    row.classList.toggle("is-you", !!e.you); row.classList.toggle("is-ai", e.kind === "ai");
    var sc = q(".lb-score"); if (sc._v === undefined) { sc._v = e.score; sc.textContent = fmt(e.score); } else if (Math.round(sc._v) !== e.score && (!sc._t || sc._t.to !== e.score)) tweenTo(sc, sc._v, e.score);
    var c = e.kind === "real" && e.isNew ? "new" : e.change || 0, ch = q(".lb-chg"), txt = c === "new" ? "NEW" : c > 0 ? "▲ " + c : c < 0 ? "▼ " + Math.abs(c) : "—";
    if (ch.textContent !== txt) { ch.textContent = txt; ch.className = "lb-chg mono " + (c === "new" ? "new" : c > 0 ? "pos" : c < 0 ? "neg" : ""); }
    if (e.flash === "up" || e.flash === "down") { row.classList.remove("up", "down"); void row.offsetWidth; if (!reduce) row.classList.add(e.flash); }
  };
  function refresh() { localEntry(); rerank(false); poll(); }


  // a finished run: the game posts it to /api/score itself; refresh the local row and the live board
  window.addEventListener("forge-run-end", function () { setTimeout(function () { localEntry(); rerank(true); if (ONLINE) setTimeout(poll, 1500); }, 400); });

  // ------------------------------------------------------------------ boot
  localEntry(); rerank(false);
  if (ONLINE) poll();
  aiTimer = setTimeout(aiTick, 6000 + Math.random() * 6000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && ONLINE) poll(); });
  function relabel() { setTimeout(function () { boards.forEach(function (b) { b.rows.forEach(function (r) { r._tag = null; }); b.render(); }); }, 60); }
  document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-lang], #langToggle")) relabel(); });
  window.addEventListener("signal-language", relabel);
  var rz = null; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { boards.forEach(function (b) { b.render(); }); }, 120); });
  window.ForgeBoard = { mount: function (el, opts) { return new Board(el, opts || {}); } };
  document.querySelectorAll("[data-forge-board]").forEach(function (el) { new Board(el, { mode: el.dataset.forgeBoard }); });
})();
