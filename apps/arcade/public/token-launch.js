/* Landing: $FORGE launch layer. Adds the Buy CTAs (header, hero, finale), a contract strip under the hero
   and the #launch section. Everything reads window.FORGE_TOKEN (token-config.js): with no buy link yet the
   CTAs lead to the launch section; once status is "live" and buyUrl is set they open the real link. */
(function () {
  "use strict";
  var T = window.FORGE_TOKEN || {}; T.links = T.links || {};
  var lang = function () { try { return localStorage.getItem("signal-language") === "zh" ? "zh" : "en"; } catch (e) { return "en"; } };
  var L = function (en, zh) { return lang() === "zh" ? zh : en; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var live = T.status === "live" && !!T.buyUrl, chain = T.chain || "Solana", sym = T.symbol || "$FORGE";
  var launchAt = T.launchDate ? Date.parse(T.launchDate) : NaN;

  function buyBtn(extra) {
    return live
      ? '<a class="btn sol-cta ' + (extra || "") + '" href="' + esc(T.buyUrl) + '" target="_blank" rel="noopener"><span>' + L("Buy " + sym, "购买 " + sym) + '</span><span class="arr">↗</span></a>'
      : '<a class="btn sol-cta ' + (extra || "") + '" href="#launch" data-soon="buy"><span>' + L("Buy " + sym, "购买 " + sym) + "</span></a>";
  }
  function caValue() { return T.contract ? '<code class="ca-code">' + esc(T.contract) + "</code>" : '<span class="ca-tba">' + L("Announced at launch", "上线时公布") + "</span>"; }
  function caCopy() { return T.contract ? '<button class="ca-copy" type="button" data-copy-ca>' + L("Copy", "复制") + "</button>" : ""; }

  // ---------------------------------------------------------------- header, nav, hero, finale
  function header() {
    var actions = document.querySelector(".top-actions"), play = actions && actions.querySelector(".play"); if (!play) return;
    var old = actions.querySelector(".hdr-buy"); if (old) old.remove();
    var a = document.createElement("a"); a.className = "top-link hdr-buy";
    if (live) { a.href = T.buyUrl; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = "<span>" + L("Buy " + sym, "购买 " + sym) + '</span><span class="arr">↗</span>'; }
    else { a.href = "#launch"; a.dataset.soon = "buy"; a.innerHTML = "<span>" + L("Buy " + sym, "购买 " + sym) + "</span>"; }
    play.before(a);
    // sub-bar under the nav: contract + official links, like a ticker line
    var sub = document.getElementById("topSub"); if (!sub) return;
    var link = function (label, url, kind) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + label + " ↗</a>" : '<a href="#launch" data-soon="' + kind + '">' + label + "</a>"; };
    sub.innerHTML = '<span class="sub-ca"><b>CA</b> ' + (T.contract ? '<button type="button" class="sub-copy" data-copy-ca title="' + L("Copy contract", "复制合约") + '">' + esc(T.contract.slice(0, 4) + "…" + T.contract.slice(-5)) + "</button>" : '<span class="sub-tba">' + L("Announced at launch", "上线时公布") + "</span>") + '</span><span class="sub-chain">' + esc(chain) + '</span><span class="sub-sep"></span><span class="sub-links">' +
      link(live ? L("Buy", "购买") : L("Buy", "购买"), live ? T.buyUrl : "", "buy") + link(L("Chart", "行情"), T.chartUrl, "chart") + (T.links.x ? link("X", T.links.x) : "") + (T.links.telegram ? link("Telegram", T.links.telegram) : "") + "</span>";
  }
  function hero() {
    var cta = document.querySelector(".hero .cta"); if (!cta) return;
    var ghost = cta.querySelector('a.btn.ghost[href="#token"]'); if (ghost) ghost.remove();
    var old = cta.querySelector(".sol-cta"); if (old) old.remove();
    var tmp = document.createElement("div"); tmp.innerHTML = buyBtn(""); cta.appendChild(tmp.firstChild);
  }
  function finale() {
    var row = document.querySelector(".finale .row"); if (!row) return;
    var box = row.querySelector(".finale-ctas"); if (!box) { var launch = row.querySelector("a.btn"); box = document.createElement("div"); box.className = "finale-ctas"; if (launch) { launch.before(box); box.appendChild(launch); } else row.appendChild(box); }
    var old = box.querySelector(".sol-cta"); if (old) old.remove();
    var tmp = document.createElement("div"); tmp.innerHTML = buyBtn(""); box.appendChild(tmp.firstChild);
  }

  // ---------------------------------------------------------------- #launch section
  function section() {
    var sec = document.getElementById("launch");
    if (!sec) { sec = document.createElement("section"); sec.className = "sec launch stage-auto"; sec.id = "launch"; var after = document.getElementById("ecosystem") || document.getElementById("token"); if (after) after.after(sec); else document.querySelector("main").appendChild(sec); }
    var btn = function (kind, label, url, icon) {
      if (url) return '<a class="btn ghost" href="' + esc(url) + '" target="_blank" rel="noopener"><span>' + label + '</span><span class="arr">' + (icon || "↗") + "</span></a>";
      return '<a class="btn ghost is-soon" href="#launch" data-soon="' + kind + '"><span>' + label + "</span></a>";
    };
    var social = (T.links.x ? btn("x", "X", T.links.x) : "") + (T.links.telegram ? btn("tg", "Telegram", T.links.telegram) : "");
    var steps = [
      [L("Set up a wallet", "准备钱包"), L("Use any wallet that supports " + chain + ". Keep your recovery phrase offline.", "使用任意支持 " + chain + " 的钱包，并离线保管助记词。")],
      [L("Get " + sym, "获取 " + sym), L("Buy only through the official link on this page once trading opens, and check the contract address every time.", "交易开放后，请仅通过本页官方链接购买，并每次核对合约地址。")],
      [L("Play with it", "在游戏中使用"), (T.walletConnect ? L("Connect the wallet in the TOKEN tab to use " + sym + " for skins, raids, tournaments and season passes.", "在 TOKEN 页连接钱包，即可用 " + sym + " 购买外观、参加突袭与锦标赛、开通赛季通行证。") : L("Wallet connection opens in the TOKEN tab at launch — then " + sym + " pays for skins, raids, tournaments and passes. Until then your progress stays on this device.", "上线时可在 TOKEN 页连接钱包，用 " + sym + " 购买外观、参加突袭与锦标赛、开通通行证。在此之前，进度保存在本设备。"))]
    ];
    sec.innerHTML = '<div class="wrap">' +
      '<div class="launch-grid">' +
        '<div class="launch-intro"><span class="label idx red rv">' + sym + " · " + L("LAUNCH", "上线") + '</span><h2 class="rv" style="--d:.08s">' + L('The game goes live <span class="sol-text">with the token.</span>', '游戏与<span class="sol-text">代币</span>同步上线。') + '</h2><p class="rv launch-lede" style="--d:.16s">' +
        (live ? L("Starforge is built around " + sym + ": skins, raids, tournaments, season passes and the daily buyback plan all run on the token. Trading is open — use only the official contract below.", "Starforge 围绕 " + sym + " 构建：外观、突袭、锦标赛、赛季通行证与每日回购计划都基于代币运行。交易已开放——请只使用下方官方合约。") : L("Starforge is built around " + sym + " from day one: skins, raids, tournaments, season passes and the daily buyback plan all run on the token. Until trading opens, everything is playable with an in-game balance.", "Starforge 从第一天起围绕 " + sym + " 构建：外观、突袭、锦标赛、赛季通行证与每日回购计划都基于代币运行。交易开放前，可使用游戏内余额体验全部内容。")) + "</p>" +
          '<div class="launch-steps">' + steps.map(function (s, i) { return '<article class="launch-step rv" style="--d:' + (.08 + i * .08) + 's"><span class="mono">0' + (i + 1) + "</span><div><h4>" + s[0] + "</h4><p>" + s[1] + "</p></div></article>"; }).join("") + "</div>" +
        "</div>" +
        '<div class="launch-card rv" id="launchCard">' +
          '<div class="launch-top"><span class="launch-pill ' + (live ? "is-live" : "") + '"><i></i>' + (live ? L("TRADING LIVE", "交易已开放") : L("PRE-LAUNCH", "上线前")) + '</span><span class="chain-badge"><i></i>' + esc(chain.toUpperCase()) + "</span></div>" +
          '<h3 class="launch-h">' + (live ? L(sym + " is live.", sym + " 已上线。") : L(sym + " launches on " + chain + ".", sym + " 将在 " + chain + " 上线。")) + "</h3>" +
          (!isNaN(launchAt) && launchAt > Date.now() ? '<div class="launch-count" id="launchCount">' + ["d", "h", "m", "s"].map(function (u) { return '<div><b data-u="' + u + '">00</b><span class="mono">' + L({ d: "Days", h: "Hours", m: "Min", s: "Sec" }[u], { d: "天", h: "时", m: "分", s: "秒" }[u]) + "</span></div>"; }).join("") + "</div>" : "") +
          '<div class="launch-ca"><span class="mono">' + L("Official contract", "官方合约地址") + '</span><div class="launch-ca-row">' + caValue() + caCopy() + "</div></div>" +
          '<div class="launch-btns">' + buyBtn("") + btn("chart", L("Chart", "行情"), T.chartUrl) + social + '<a class="btn ghost" href="game.html#token"><span>' + L("Play now", "立即游玩") + '</span><span class="arr">→</span></a></div>' +
          '<p class="launch-msg mono" id="launchMsg" aria-live="polite"></p>' +
        "</div>" +
      "</div>" +
      '<p class="utility-note launch-risk">' + L("Crypto assets are volatile and can lose value. Nothing on this site is financial advice. Only trust the contract address published here and in official channels.", "加密资产波动较大，可能贬值。本网站内容不构成任何投资建议。请仅信任本页及官方渠道公布的合约地址。") + "</p>" +
      "</div>";
    countdown();
  }
  var cdTimer = null;
  function countdown() {
    clearInterval(cdTimer); var box = document.getElementById("launchCount"); if (!box) return;
    var tick = function () { var ms = Math.max(0, launchAt - Date.now()), v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 }; box.querySelectorAll("[data-u]").forEach(function (b) { b.textContent = String(v[b.dataset.u]).padStart(2, "0"); }); };
    tick(); cdTimer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- behaviour
  function say(text) { var m = document.getElementById("launchMsg"), card = document.getElementById("launchCard"); if (m) { m.textContent = text; } if (card) { card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); } }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-soon],[data-copy-ca]"); if (!t) return;
    if (t.hasAttribute("data-copy-ca")) {
      e.preventDefault(); var prev = t.textContent, done = function () { t.textContent = L("Copied", "已复制"); setTimeout(function () { t.textContent = prev; }, 1400); };
      try { navigator.clipboard.writeText(T.contract).then(done, done); } catch (err) { done(); } return;
    }
    e.preventDefault(); var kind = t.dataset.soon, sec = document.getElementById("launch");
    if (sec) { var r = sec.getBoundingClientRect(); if (r.top > innerHeight || r.bottom < 0) sec.scrollIntoView({ block: "start" }); }
    setTimeout(function () {
      say(kind === "chart" ? L("The price chart goes up with the first trade.", "首笔交易后将开放行情图表。")
        : L("Trading opens at launch. The official contract and buy link will appear right here.", "交易将在上线时开放。官方合约与购买链接会显示在这里。"));
    }, 450);
  });
  function render() { header(); hero(); finale(); section(); }
  render();
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-lang]")) setTimeout(function () { render(); document.querySelectorAll("#launch .rv, .hero .cta .sol-cta").forEach(function (n) { n.classList.add("in"); }); }, 40); });
})();
