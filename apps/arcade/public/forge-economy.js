/* $FORGE token layer — core state.
   PROTOTYPE: every balance, purchase and reward here is SIMULATED and stored only in this browser.
   Nothing is sent to a blockchain. The `provider` interface below is the seam where a real wallet,
   backend API or smart-contract adapter can be plugged in later without touching the UI. */
(function (global) {
  "use strict";
  if (global.FORGE_ECOSYSTEM === false) return; // kill-switch: set in ecosystem-config.js to ship the classic build
  var KEY = "forge-economy-v1", START = 2500, DAY = 864e5;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ------------------------------------------------------------------ catalog
  var CATALOG = {
    skins: [
      { id: "sk-obsidian", name: "Obsidian Halo", zh: "黑曜光环", hull: 1, finish: "obsidian", rarity: "rare", price: 450, art: "assets/3d/premium/skin-obsidian.webp", note: "Smoked black lacquer with white seam lines." },
      { id: "sk-arctic", name: "Arctic Ceramic", zh: "极地陶瓷", hull: 8, finish: "arctic", rarity: "rare", price: 420, art: "assets/3d/premium/skin-arctic.webp", note: "Matte ceramic hull, ice-blue livery." },
      { id: "sk-crimson", name: "Signal Crimson", zh: "信号绯红", hull: 15, finish: "crimson", rarity: "epic", price: 780, art: "assets/3d/premium/skin-crimson.webp", animated: true, note: "Deep red lacquer, pulsing seams." },
      { id: "sk-prism", name: "Prism Shift", zh: "棱镜流转", hull: 3, finish: "prism", rarity: "epic", price: 900, art: "assets/3d/premium/skin-prism.webp", animated: true, note: "Iridescent shell, seams cycle through the spectrum." },
      { id: "sk-gold", name: "Forge Gold", zh: "熔炉黄金", hull: 22, finish: "gold", rarity: "legendary", price: 1400, art: "assets/3d/premium/skin-gold.webp", note: "Polished gold hull with amber drive flames." },
      { id: "sk-phantom", name: "Mint Phantom", zh: "薄荷幻影", hull: 12, finish: "phantom", rarity: "legendary", price: 1600, art: "assets/3d/premium/skin-phantom.webp", animated: true, note: "Translucent glass hull lit from within." },
      { id: "sk-ignition", name: "Ignition · Season I", zh: "点火 · 第一季", hull: 20, finish: "ignition", rarity: "season", price: null, art: "assets/3d/premium/skin-ignition.webp", animated: true, note: "Season I premium track reward." },
    ],
    outfits: [
      { id: "of-ghost", name: "Ghost Grey", zh: "幽灵灰", color: "#a9adb5", rarity: "common", price: 180, note: "Desaturated field kit." },
      { id: "of-mint", name: "Mint Ops", zh: "薄荷特勤", color: "#9ff2c4", rarity: "rare", price: 320, note: "Recon suit in reward mint." },
      { id: "of-violet", name: "Void Violet", zh: "虚空紫", color: "#b79cff", rarity: "rare", price: 340, note: "Night-ops plating." },
      { id: "of-signal", name: "Signal Red", zh: "信号红", color: "#ff4a2e", rarity: "epic", price: 520, note: "High-visibility strike armour." },
      { id: "of-gold", name: "Gold Leaf", zh: "金箔", color: "#ffc46b", rarity: "legendary", price: 880, note: "Ceremonial forge armour." },
      { id: "of-ignition", name: "Ignition Suit", zh: "点火战衣", color: "#ff7a3d", rarity: "season", price: null, note: "Season I premium track reward." },
    ],
    fx: [
      { id: "fx-signal", name: "Signal Burst", zh: "信号爆发", color: "#ff4a2e", rarity: "rare", price: 260, note: "Red-hot bolts with ember trails." },
      { id: "fx-mint", name: "Mint Lattice", zh: "薄荷晶格", color: "#9ff2c4", rarity: "rare", price: 260, note: "Cool mint rounds." },
      { id: "fx-gold", name: "Solar Gold", zh: "太阳金", color: "#ffc46b", rarity: "epic", price: 480, note: "Gold tracers with a long tail." },
      { id: "fx-violet", name: "Violet Rift", zh: "紫色裂隙", color: "#b79cff", rarity: "epic", price: 480, note: "Rift-violet energy." },
      { id: "fx-prism", name: "Prism Cascade", zh: "棱镜瀑流", color: "prism", rarity: "legendary", price: 950, animated: true, note: "Every bolt cycles the spectrum." },
      { id: "fx-ignition", name: "Ignition Trail", zh: "点火尾迹", color: "#ff7a3d", rarity: "season", price: null, note: "Season I premium track reward." },
    ],
    maps: [
      { id: "mp-neon", name: "Neon Gardens Pass", zh: "霓虹花园通行证", map: "neon", rarity: "rare", price: 300, art: "assets/3d/maps/neon.webp", note: "Open the Neon Gardens sector now instead of at level 2." },
      { id: "mp-abyss", name: "Abyss Reactor Pass", zh: "深渊反应堆通行证", map: "abyss", rarity: "epic", price: 500, art: "assets/3d/maps/abyss.webp", note: "Open the Abyss Reactor sector without reaching level 4." },
      { id: "mp-orbit", name: "Orbit of Silence Pass", zh: "寂静轨道通行证", map: "orbit", rarity: "legendary", price: 800, art: "assets/3d/maps/orbit.webp", note: "Open the gravity sector without reaching level 7." },
      { id: "mp-vault", name: "Prism Vault · World 09", zh: "棱镜宝库 · 世界 09", pilot: 81, rarity: "epic", price: 650, art: "assets/3d/guardians/guardian-2-0.webp", note: "Pilot campaign: unlock world 09 missions immediately." },
    ],
  };
  var RARITY = { common: { label: "Common", zh: "普通" }, rare: { label: "Rare", zh: "稀有" }, epic: { label: "Epic", zh: "史诗" }, legendary: { label: "Legendary", zh: "传奇" }, season: { label: "Season I", zh: "第一季" } };

  var RAIDS = [
    { id: "raid-anvil", boss: 0, name: "Anvil Ray", zh: "铁砧鳐", tier: "Normal", tierZh: "普通", bossLevel: 2, entry: 120, win: 380, partial: 40, accent: "#ff7a3d", brief: "Fanned volleys and a bolt ring with a single gap.", briefZh: "扇形齐射与只留一个缺口的弹环。" },
    { id: "raid-hammer", boss: 1, name: "Twin Hammer Siege", zh: "双锤围城", tier: "Hard", tierZh: "困难", bossLevel: 6, entry: 200, win: 720, partial: 60, accent: "#4aa8ff", brief: "Two hammers, telegraphed lane charges. Starts at level 6.", briefZh: "双锤登场，预警直线冲撞。从等级 6 开始。" },
    { id: "raid-bellows", boss: 2, name: "Bellows Abyss", zh: "风箱深渊", tier: "Extreme", tierZh: "极限", bossLevel: 7, entry: 320, win: 1150, partial: 90, accent: "#3fe0c5", brief: "Twin Bellows breathe Leech swarms. Starts at level 7.", briefZh: "双风箱喷出水蛭群。从等级 7 开始。" },
  ];
  var TOURNAMENTS = [
    { id: "cup-weekly", name: "Forge Cup", zh: "熔炉杯", cadence: "weekly", entry: 100, pool: 25000, field: 32, mode: null, scale: 30000, desc: "Best single arena score of the week.", descZh: "本周单局竞技场最高分。" },
    { id: "cup-rush", name: "Boss Rush Daily", zh: "首领冲刺日赛", cadence: "daily", entry: 40, pool: 4000, field: 24, mode: "bossrush", scale: 14000, desc: "Best Boss Rush score of the day. Requires the Boss Rush mode.", descZh: "当日首领冲刺模式最高分。需解锁首领冲刺模式。" },
  ];
  var PAYOUT = [.3, .18, .12, .08, .07, .06, .055, .05, .045, .04];
  var MISSIONS = [
    { id: "m-overclock", name: "Overclocked", zh: "超频", cost: 90, target: 8000, unit: "pts", reward: 260, xp: 400, desc: "Score 8,000 in a single arena run.", descZh: "单局竞技场得分 8,000。", art: "assets/3d/modules/module-03.webp", track: function (r) { return r.score; }, best: true },
    { id: "m-crown", name: "Triple Crown", zh: "三冠", cost: 120, target: 3, unit: "bosses", reward: 340, xp: 500, desc: "Defeat 3 bosses in one run.", descZh: "单局击败 3 个首领。", art: "assets/3d/guardians/guardian-0-0.webp", track: function (r) { return r.bosses; }, best: true },
    { id: "m-iron", name: "Iron Hull", zh: "铁壁", cost: 80, target: 180, unit: "sec", reward: 220, xp: 350, desc: "Survive 180 seconds in one run.", descZh: "单局生存 180 秒。", art: "assets/3d/modules/module-02.webp", track: function (r) { return r.seconds; }, best: true },
    { id: "m-combo", name: "Combo Artist", zh: "连击艺术家", cost: 100, target: 30, unit: "×", reward: 280, xp: 400, desc: "Reach a ×30 kill streak in one run.", descZh: "单局达到 ×30 连击。", art: "assets/3d/modules/module-08.webp", track: function (r) { return r.combo; }, best: true },
    { id: "m-raid", name: "Raid Breaker", zh: "突袭破坏者", cost: 150, target: 1, unit: "raid", reward: 450, xp: 600, desc: "Win any boss raid.", descZh: "赢得任意一场首领突袭。", art: "assets/3d/guardians/guardian-1-0.webp", event: "raid-win" },
    { id: "m-pilot", name: "Pilot Sprint", zh: "飞行员冲刺", cost: 90, target: 3, unit: "missions", reward: 240, xp: 450, desc: "Clear 3 pilot campaign missions.", descZh: "通关 3 个飞行员战役任务。", art: "assets/3d/pilot-a/p-17.webp", event: "pilot-clear" },
  ];
  var MODES = [
    { id: "bossrush", name: "Boss Rush", zh: "首领冲刺", cost: 400, desc: "A new boss every 22 seconds instead of 40.", descZh: "每 22 秒出现新首领（原为 40 秒）。", art: "assets/3d/guardians/guardian-0-2.webp" },
    { id: "hardcore", name: "Hardcore", zh: "硬核", cost: 300, desc: "One hull point. Every point scores double.", descZh: "仅 1 点装甲，所有得分翻倍。", art: "assets/3d/premium/skin-obsidian.webp" },
  ];
  var EVENTS = [
    { id: "ev-storm", name: "Signal Storm", zh: "信号风暴", cost: 150, effect: "xp2", desc: "Double Season XP from every run while the storm is active.", descZh: "风暴期间每局赛季经验翻倍。", window: function (t) { var d = Math.floor(t / DAY), start = (d - d % 3) * DAY; return { start: start, end: start + 2 * DAY }; } },
    { id: "ev-eclipse", name: "Eclipse Weekend", zh: "日蚀周末", cost: 200, effect: "reward15", desc: "Arena run rewards ×1.5 from Friday 18:00 to Monday 06:00.", descZh: "周五 18:00 至周一 06:00 竞技场奖励 ×1.5。", window: function (t) { var d = new Date(t), day = d.getDay(), fri = new Date(d); fri.setHours(18, 0, 0, 0); fri.setDate(d.getDate() - ((day + 2) % 7)); var s = fri.getTime(), e = s + 2.5 * DAY; if (t > e) { s += 7 * DAY; e += 7 * DAY; } return { start: s, end: e }; } },
  ];
  var SEASON = { name: "Season I · Ignition", zh: "第一季 · 点火", tierXp: 600, tiers: 20, premiumCost: 900 };
  function seasonReward(tier, premium) {
    if (premium) { if (tier === 5) return { kind: "item", cat: "outfits", id: "of-ignition" }; if (tier === 10) return { kind: "item", cat: "fx", id: "fx-ignition" }; if (tier === 20) return { kind: "item", cat: "skins", id: "sk-ignition" }; return { kind: "tokens", amount: 60 + tier * 6 }; }
    if (tier % 5 === 0) return { kind: "tokens", amount: 120 }; return { kind: "tokens", amount: 25 + tier * 2 };
  }

  // ------------------------------------------------------------------ provider (swap for a real wallet adapter later)
  var DemoProvider = {
    id: "local", name: "In-game wallet", simulated: true,
    // A real adapter would request a signature / call an API here and resolve with the receipt.
    transfer: function (req) { return new Promise(function (res) { setTimeout(function () { res({ ok: true, simulated: true, txId: "IG-" + Math.random().toString(36).slice(2, 8).toUpperCase() + "-" + Date.now().toString(36).slice(-4).toUpperCase(), amount: req.amount, memo: req.memo }); }, 650 + Math.random() * 450); }); },
  };

  // ------------------------------------------------------------------ state
  function fresh() { return { v: 1, balance: START, history: [{ id: "g0", t: Date.now(), type: "grant", amount: START, memo: "Starter balance", txId: "IG-GENESIS" }], owned: { skins: [], outfits: [], fx: [], maps: [] }, equipped: { skins: null, outfits: null, fx: null }, pending: [], dailyAt: 0, raids: [], cups: { entries: {}, results: [] }, season: { xp: 0, premium: false, claimed: { free: [], prem: [] } }, missions: { unlocked: [], progress: {}, claimed: [], pilotClears: 0 }, modes: [], events: [] }; }
  var S; try { S = JSON.parse(store.get(KEY) || "null"); } catch (e) { S = null; } if (!S || S.v !== 1) S = fresh();
  var listeners = [];
  function save() { store.set(KEY, JSON.stringify(S)); listeners.forEach(function (f) { try { f(S); } catch (e) {} }); try { global.dispatchEvent(new CustomEvent("forge-economy", { detail: S })); } catch (e) {} }
  function log(type, amount, memo, txId) { S.history.unshift({ id: Math.random().toString(36).slice(2), t: Date.now(), type: type, amount: amount, memo: memo, txId: txId || null }); S.history = S.history.slice(0, 120); }
  function find(cat, id) { return (CATALOG[cat] || []).find(function (i) { return i.id === id; }) || null; }
  function lang() { try { return store.get("signal-language") === "zh" ? "zh" : "en"; } catch (e) { return "en"; } }
  function name(o) { return lang() === "zh" && o.zh ? o.zh : o.name; }

  function spend(amount, memo, type) {
    if (amount > S.balance) return Promise.reject(new Error("insufficient"));
    return API.provider.transfer({ amount: amount, memo: memo, direction: "out" }).then(function (r) { S.balance -= amount; log(type || "purchase", -amount, memo, r.txId); save(); return r; });
  }
  function credit(amount, memo, type) { amount = Math.round(amount); if (amount <= 0) return; S.balance += amount; log(type || "reward", amount, memo, "IG-" +Math.random().toString(36).slice(2, 7).toUpperCase()); save(); toastReward(amount, memo); }
  function addPending(amount, memo) { amount = Math.round(amount); if (amount <= 0) return; S.pending.push({ id: Math.random().toString(36).slice(2), amount: amount, memo: memo, t: Date.now() }); save(); toastReward(amount, memo, true); }
  function toastReward(amount, memo, pending) { try { global.dispatchEvent(new CustomEvent("forge-economy-reward", { detail: { amount: amount, memo: memo, pending: !!pending } })); } catch (e) {} }

  // ------------------------------------------------------------------ tournaments (seeded rival fields, demo only)
  function roundIndex(c, t) { t = t || Date.now(); if (c.cadence === "daily") { var d = new Date(t); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / DAY); } var w = new Date(t), day = w.getDay(); w.setHours(18, 0, 0, 0); w.setDate(w.getDate() + ((7 - day) % 7)); if (w.getTime() <= t) w.setDate(w.getDate() + 7); return Math.floor(w.getTime() / (7 * DAY)); }
  function roundEnds(c, t) { t = t || Date.now(); if (c.cadence === "daily") { var d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); } var w = new Date(t), day = w.getDay(); w.setHours(18, 0, 0, 0); w.setDate(w.getDate() + ((7 - day) % 7)); if (w.getTime() <= t) w.setDate(w.getDate() + 7); return w.getTime(); }
  var CALLSIGNS = ["VANTA", "HALCYON", "NOVA_7", "KESTREL", "ORBITAL", "SABLE", "IRONWAKE", "QUILL", "MERIDIAN", "OKAMI", "PYRE", "LUMEN", "ZERO_G", "CINDER", "VEXA", "AURIC", "DRIFTER", "SOL_9", "NIGHTJAR", "RAZOR", "ECHO_44", "TALON", "FATHOM", "HELIX", "MONARCH", "KITE", "STATIC", "RIVEN", "BASALT", "ONYX", "WARDEN", "GLINT"];
  function seeded(n) { var s = (n * 2654435761) % 4294967296; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
  function rivals(c, round, progress) {
    var r = seeded(round * 31 + c.id.length * 7), out = [];
    for (var i = 0; i < c.field; i++) { var base = c.scale * Math.pow(r(), 1.8) * (.35 + r() * .9); out.push({ name: CALLSIGNS[(i + round) % CALLSIGNS.length] + (i > 31 ? i : ""), score: Math.round(base * (progress == null ? 1 : .25 + .75 * progress)) }); }
    return out;
  }
  function standings(c, opts) {
    var now = Date.now(), round = roundIndex(c, now), key = c.id + ":" + round, ends = roundEnds(c, now), span = c.cadence === "daily" ? DAY : 7 * DAY, progress = Math.max(0, Math.min(1, 1 - (ends - now) / span));
    var e = S.cups.entries[key], list = rivals(c, round, opts && opts.final ? 1 : progress);
    if (e) list.push({ name: "YOU", score: e.best, you: true });
    list.sort(function (a, b) { return b.score - a.score; }); list.forEach(function (x, i) { x.rank = i + 1; });
    return { key: key, round: round, ends: ends, entered: !!e, entry: e, list: list, progress: progress };
  }
  function finalizeCup(c, key, entry) {
    var round = Number(key.split(":")[1]), list = rivals(c, round, 1); list.push({ name: "YOU", score: entry.best, you: true }); list.sort(function (a, b) { return b.score - a.score; });
    var rank = list.findIndex(function (x) { return x.you; }) + 1, reward = rank <= PAYOUT.length ? Math.round(c.pool * PAYOUT[rank - 1]) : 0;
    S.cups.results.unshift({ key: key, cup: c.id, name: c.name, rank: rank, of: list.length, score: entry.best, reward: reward, claimed: reward === 0, t: Date.now() }); delete S.cups.entries[key];
    return S.cups.results[0];
  }
  function settleCups() { var changed = false; Object.keys(S.cups.entries).forEach(function (key) { var c = TOURNAMENTS.find(function (x) { return key.indexOf(x.id + ":") === 0; }); if (!c) return; var round = Number(key.split(":")[1]); if (round < roundIndex(c)) { finalizeCup(c, key, S.cups.entries[key]); changed = true; } }); if (changed) save(); }

  // ------------------------------------------------------------------ events
  function eventState(ev, t) { t = t || Date.now(); var w = ev.window(t), active = t >= w.start && t < w.end; return { active: active, start: w.start, end: w.end, unlocked: S.events.indexOf(ev.id + ":" + w.start) >= 0 }; }
  function eventBoost(effect) { return EVENTS.some(function (ev) { if (ev.effect !== effect) return false; var st = eventState(ev); return st.active && st.unlocked; }); }

  // ------------------------------------------------------------------ gameplay hooks
  function seasonXp(xp, memo) { var mult = eventBoost("xp2") ? 2 : 1; S.season.xp += Math.round(xp * mult); }
  function missionEvent(kind, value) { MISSIONS.forEach(function (m) { if (S.missions.unlocked.indexOf(m.id) < 0 || S.missions.claimed.indexOf(m.id) >= 0) return; if (m.event === kind) S.missions.progress[m.id] = Math.min(m.target, (S.missions.progress[m.id] || 0) + (value || 1)); }); }
  global.addEventListener("forge-run-end", function (e) {
    var r = e.detail || {}; if (!r || typeof r.score !== "number") return;
    var mult = eventBoost("reward15") ? 1.5 : 1, base = Math.min(400, Math.floor(r.score / 300) + r.bosses * 15) * mult;
    if (r.mode && r.mode.mode === "raid") {
      var raid = RAIDS.find(function (x) { return x.id === r.mode.raid; }), won = r.bosses >= 1;
      if (raid) { S.raids.unshift({ id: raid.id, name: raid.name, won: won, score: r.score, t: Date.now(), reward: won ? raid.win : raid.partial }); S.raids = S.raids.slice(0, 30); addPending(won ? raid.win : raid.partial, (won ? "Raid cleared · " : "Raid attempt · ") + raid.name); if (won) missionEvent("raid-win", 1); }
    } else if (base > 0) addPending(base, "Arena run · " + r.score.toLocaleString() + " pts");
    MISSIONS.forEach(function (m) { if (!m.track || S.missions.unlocked.indexOf(m.id) < 0 || S.missions.claimed.indexOf(m.id) >= 0) return; S.missions.progress[m.id] = Math.min(m.target, Math.max(S.missions.progress[m.id] || 0, m.track(r) || 0)); });
    TOURNAMENTS.forEach(function (c) { var key = c.id + ":" + roundIndex(c), ent = S.cups.entries[key]; if (!ent) return; if (c.mode && !(r.mode && r.mode.mode === c.mode)) return; ent.runs++; ent.best = Math.max(ent.best, r.score); });
    seasonXp(Math.min(900, Math.floor(r.score / 40)) + r.bosses * 120 + Math.min(240, r.seconds));
    save();
  });
  global.addEventListener("forge-pilot-medal", function (e) { var d = e.detail || {}; seasonXp(60); addPending(8, "$FORGE medallion · M" + String(d.mission).padStart(2, "0") + " #" + ((d.idx || 0) + 1)); });
  global.addEventListener("forge-pilot-clear", function (e) { var d = e.detail || {}; S.missions.pilotClears++; missionEvent("pilot-clear", 1); seasonXp(d.isNew ? 220 : 80); if (d.isNew) addPending(30, "Pilot mission " + String(d.mission).padStart(2, "0") + " cleared"); save(); });

  // ------------------------------------------------------------------ public API
  var API = {
    provider: DemoProvider, catalog: CATALOG, rarity: RARITY, raids: RAIDS, tournaments: TOURNAMENTS, payout: PAYOUT, missions: MISSIONS, modes: MODES, events: EVENTS, season: SEASON, seasonReward: seasonReward,
    state: function () { return S; }, balance: function () { return S.balance; }, name: name, lang: lang, find: find,
    on: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
    owns: function (cat, id) { return S.owned[cat].indexOf(id) >= 0; },
    equipped: function (cat) { var id = S.equipped[cat]; return id ? find(cat, id) : null; },
    equip: function (cat, id) { if (id && !API.owns(cat, id)) return false; S.equipped[cat] = id || null; save(); return true; },
    ownedMapIds: function () { return S.owned.maps.map(function (id) { var m = find("maps", id); return m && m.map; }).filter(Boolean); },
    buy: function (cat, id) {
      var item = find(cat, id); if (!item || item.price == null) return Promise.reject(new Error("unavailable")); if (API.owns(cat, id)) return Promise.reject(new Error("owned"));
      return spend(item.price, "Market · " + item.name, "purchase").then(function (r) { S.owned[cat].push(id); if (cat !== "maps") S.equipped[cat] = id; if (item.map && global.ForgeGame) global.ForgeGame.refreshProfile(); if (item.pilot) global.dispatchEvent(new CustomEvent("forge-pilot-unlock", { detail: { maxLevel: item.pilot } })); save(); return r; });
    },
    claimDaily: function () { var left = API.dailyLeft(); if (left > 0) return false; S.dailyAt = Date.now(); credit(150, "Daily check-in", "claim"); return true; },
    dailyLeft: function () { return Math.max(0, S.dailyAt + 20 * 36e5 - Date.now()); },
    claimPending: function () { var total = S.pending.reduce(function (a, p) { return a + p.amount; }, 0); if (!total) return 0; S.pending.forEach(function (p) { S.balance += p.amount; log("reward", p.amount, p.memo, "IG-" + Math.random().toString(36).slice(2, 7).toUpperCase()); }); S.pending = []; save(); toastReward(total, "Rewards claimed"); return total; },
    // raids & tournaments
    enterRaid: function (id) { var raid = RAIDS.find(function (x) { return x.id === id; }); if (!raid) return Promise.reject(new Error("raid")); return spend(raid.entry, "Raid entry · " + raid.name, "entry").then(function (r) { if (global.ForgeGame) global.ForgeGame.startMode({ mode: "raid", raid: raid.id, bossLevel: raid.bossLevel, kicker: "BOSS RAID · " + raid.tier.toUpperCase(), title: raid.name.toUpperCase() }); return r; }); },
    standings: standings,
    enterCup: function (id) { var c = TOURNAMENTS.find(function (x) { return x.id === id; }); var st = standings(c); if (st.entered) return Promise.reject(new Error("entered")); return spend(c.entry, "Tournament entry · " + c.name, "entry").then(function (r) { S.cups.entries[st.key] = { best: 0, runs: 0, at: Date.now() }; save(); return r; }); },
    endCupNow: function (id) { var c = TOURNAMENTS.find(function (x) { return x.id === id; }); var st = standings(c); if (!st.entered) return null; var res = finalizeCup(c, st.key, st.entry); save(); return res; },
    claimCup: function (key) { var r = S.cups.results.find(function (x) { return x.key === key && !x.claimed; }); if (!r) return 0; r.claimed = true; credit(r.reward, "Prize · " + r.name + " #" + r.rank, "prize"); return r.reward; },
    // season, missions, modes, events
    seasonTier: function () { return Math.min(SEASON.tiers, Math.floor(S.season.xp / SEASON.tierXp)); },
    unlockPremiumSeason: function () { if (S.season.premium) return Promise.reject(new Error("owned")); return spend(SEASON.premiumCost, "Season I premium track", "unlock").then(function (r) { S.season.premium = true; save(); return r; }); },
    claimTier: function (tier, premium) { var lane = premium ? "prem" : "free"; if (tier > API.seasonTier() || S.season.claimed[lane].indexOf(tier) >= 0 || (premium && !S.season.premium)) return null; var rw = seasonReward(tier, premium); S.season.claimed[lane].push(tier); if (rw.kind === "tokens") credit(rw.amount, "Season I · tier " + tier, "claim"); else { if (!API.owns(rw.cat, rw.id)) S.owned[rw.cat].push(rw.id); log("claim", 0, "Season I · " + find(rw.cat, rw.id).name); save(); } return rw; },
    unlockMission: function (id) { var m = MISSIONS.find(function (x) { return x.id === id; }); if (S.missions.unlocked.indexOf(id) >= 0) return Promise.reject(new Error("owned")); return spend(m.cost, "Premium mission · " + m.name, "unlock").then(function (r) { S.missions.unlocked.push(id); S.missions.progress[id] = 0; save(); return r; }); },
    claimMission: function (id) { var m = MISSIONS.find(function (x) { return x.id === id; }); if ((S.missions.progress[id] || 0) < m.target || S.missions.claimed.indexOf(id) >= 0) return false; S.missions.claimed.push(id); seasonXp(m.xp); credit(m.reward, "Mission complete · " + m.name, "claim"); return true; },
    hasMode: function (id) { return S.modes.indexOf(id) >= 0; },
    unlockMode: function (id) { var m = MODES.find(function (x) { return x.id === id; }); if (API.hasMode(id)) return Promise.reject(new Error("owned")); return spend(m.cost, "Game mode · " + m.name, "unlock").then(function (r) { S.modes.push(id); save(); return r; }); },
    playMode: function (id) { if (!API.hasMode(id) || !global.ForgeGame) return false; var m = MODES.find(function (x) { return x.id === id; }); return global.ForgeGame.startMode({ mode: id, kicker: "UNLOCKED MODE", title: m.name.toUpperCase() }); },
    eventState: eventState,
    unlockEvent: function (id) { var ev = EVENTS.find(function (x) { return x.id === id; }), st = eventState(ev); if (st.unlocked) return Promise.reject(new Error("owned")); return spend(ev.cost, "Event pass · " + ev.name, "unlock").then(function (r) { S.events.push(ev.id + ":" + st.start); save(); return r; }); },
    reset: function () { S = fresh(); save(); },
    settle: settleCups,
  };
  settleCups();
  global.ForgeEconomy = API;
})(window);
