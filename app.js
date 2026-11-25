/* Signals dashboard: renders the laptop's snapshot.json (app/dashboard.py) for the phone.
   Data source: window.DASH_CONFIG.dataUrl (the watchdog gist's raw snapshot.json), or
   ?src=<url> for a local preview. Read-only: nothing here can trade. */
(function () {
  "use strict";
  var cfg = window.DASH_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var DATA_URL = params.get("src") || cfg.dataUrl || "snapshot.json";
  var REFRESH_MS = (cfg.refreshSec || 30) * 1000;
  var LIVE_S = 180, STALE_S = 1200;          // snapshot age: < 3 min live, < 20 min stale, else offline
  var snap = null, timer = null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmtUsd = function (v, signed) {
    if (v == null || isNaN(v)) return "—";
    var s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? "−$" : (signed && v > 0 ? "+$" : "$")) + s;
  };
  var fmtUsd0 = function (v, signed) {
    if (v == null || isNaN(v)) return "—";
    var s = Math.abs(Math.round(v)).toLocaleString("en-US");
    return (v < 0 ? "−$" : (signed && v > 0 ? "+$" : "$")) + s;
  };
  var fmtPx = function (v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var tone = function (v) { return v > 0 ? "up" : v < 0 ? "down" : ""; };
  var ct = function (ts, withDay) {
    if (!ts) return "—";
    var o = { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false };
    if (withDay) { o.weekday = "short"; o.month = "numeric"; o.day = "numeric"; }
    return new Date(ts * 1000).toLocaleString("en-US", o) + (withDay ? "" : " CT");
  };
  var ago = function (s) {
    if (s < 60) return Math.max(0, Math.round(s)) + "s ago";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  };
  var dur = function (min) {
    if (min == null) return "";
    if (min < 60) return Math.round(min) + "m";
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return h + "h" + (m ? " " + m + "m" : "");
  };

  function setStatus() {
    var el = $("status"), txt = $("status-text");
    if (!snap) { el.className = "status"; txt.textContent = "Loading"; return; }
    var age = Date.now() / 1000 - snap.generated_at;
    var cls = age < LIVE_S ? "live" : age < STALE_S ? "stale" : "offline";
    el.className = "status " + cls;
    txt.textContent = cls === "live" ? "Live" : cls === "stale" ? "Delayed · " + ago(age) : "Offline · " + ago(age);
    $("updated").textContent = "Laptop snapshot " + ago(age) + " · " + ct(snap.generated_at, true);
  }

  function hero(s) {
    var p = s.position, m = s.market || {};
    if (p) {
      var d = p.direction, u = p.unrealized;
      var railHtml = "";
      if (p.stop != null && p.target != null && p.price != null) {
        var lo = Math.min(p.stop, p.target), hi = Math.max(p.stop, p.target);
        var pos = function (v) { return Math.min(100, Math.max(0, (v - lo) / (hi - lo) * 100)); };
        var stopLeft = p.stop < p.target;            // long: stop on the left
        railHtml =
          '<div class="rail" style="background:linear-gradient(90deg,' + (stopLeft ? "var(--down-soft),var(--card-2) 45%,var(--card-2) 55%,var(--up-soft)" : "var(--up-soft),var(--card-2) 45%,var(--card-2) 55%,var(--down-soft)") + ')">' +
          '<span class="mark" style="left:' + pos(p.avg_price) + '%"></span>' +
          '<span class="now" style="left:' + pos(p.price) + '%"></span></div>' +
          '<div class="rail-labels">' +
          '<span class="' + (stopLeft ? "down" : "up") + '">' + (stopLeft ? "Stop" : "Target") + '<b>' + fmtPx(stopLeft ? p.stop : p.target) + "</b></span>" +
          '<span class="muted" style="text-align:center">Entry<b style="color:var(--text)">' + fmtPx(p.avg_price) + "</b></span>" +
          '<span class="' + (stopLeft ? "up" : "down") + '" style="text-align:right">' + (stopLeft ? "Target" : "Stop") + '<b>' + fmtPx(stopLeft ? p.target : p.stop) + "</b></span></div>";
      } else if (p.stop != null) {
        railHtml = '<div class="rail-labels" style="margin-top:14px"><span class="down">Stop<b>' + fmtPx(p.stop) + '</b></span><span class="muted" style="text-align:right">Exit<b style="color:var(--text)">EMA20 ride</b></span></div>';
      }
      return '<div class="label"><span class="pill ' + d + '">' + d.toUpperCase() + "</span>" +
        "<span>" + esc(p.size) + " " + esc(p.symbol) + " · " + esc(p.strategy) + "</span></div>" +
        '<div class="big ' + tone(u) + '">' + fmtUsd(u, true) + "</div>" +
        '<div class="meta"><span>Now ' + fmtPx(p.price) + " · in " + (p.opened ? dur((Date.now() / 1000 - p.opened) / 60) : "—") + "</span>" +
        "<span>" + (p.risk_to_stop != null ? '<span class="down">' + fmtUsd0(p.risk_to_stop, true) + "</span>" : "") +
        (p.reward_to_target != null ? ' / <span class="up">' + fmtUsd0(p.reward_to_target, true) + "</span>" : "") + "</span></div>" + railHtml;
    }
    var allowed = (m.direction_allowed || "none");
    var pill = allowed === "long" ? '<span class="pill long">LONGS ONLY</span>' : allowed === "short" ? '<span class="pill short">SHORTS ONLY</span>' : '<span class="pill flat">NO TRADE ZONE</span>';
    var last = (s.trades || [])[0];
    return '<div class="label"><span class="pill flat">FLAT</span><span>Waiting for a setup</span></div>' +
      '<div class="big">' + (m.price != null ? fmtPx(m.price) : "—") + '<span class="muted" style="font-size:15px;font-weight:600;letter-spacing:0"> ' + esc(m.contract || "NQ") + "</span></div>" +
      '<div class="meta"><span>' + pill + "</span><span>" + esc((m.allowed_reason || "").replace(/ — .*/, "")) + "</span></div>" +
      (last ? '<div class="meta" style="margin-top:12px"><span>Last trade ' + ct(last.closed, true) + '</span><span class="' + tone(last.net) + '">' + fmtUsd(last.net, true) + "</span></div>" : "");
  }

  function today(s) {
    var t = s.today || {}, a = s.account || {};
    return '<div><div class="muted">Today (since 17:00 CT)</div><div class="v ' + tone(t.net) + '">' + fmtUsd(t.net, true) + "</div>" +
      '<div class="muted">' + (t.trades || 0) + " trade" + (t.trades === 1 ? "" : "s") + "</div></div>" +
      '<div style="text-align:right"><div class="muted">Balance</div><div class="v">' + fmtUsd0(a.balance) + "</div>" +
      '<div class="muted">' + esc(a.name ? "…" + String(a.name).slice(-4) : "") + "</div></div>";
  }

  function kpi(k, v, sub, cls, extra) {
    return '<div class="kpi' + (extra || "") + '"><div class="k">' + k + '</div><div class="v ' + (cls || "") + '">' + v + "</div>" + (sub ? '<div class="s">' + sub + "</div>" : "") + "</div>";
  }

  function kpis(s) {
    var m = s.metrics;
    if (!m || !m.trades) return kpi("Total P&L", "—", "no closed trades yet", "", " wide");
    var room = m.room_to_limit, lim = m.loss_limit || 4500, pct = Math.max(0, Math.min(100, room / lim * 100));
    var barColor = pct > 50 ? "var(--up)" : pct > 25 ? "var(--warn)" : "var(--down)";
    var streak = m.streak ? m.streak.count + " " + (m.streak.kind === "win" ? "win" : "loss") + (m.streak.count > 1 ? (m.streak.kind === "win" ? "s" : "es") : "") : "";
    return kpi("Total P&L", fmtUsd0(m.net, true), m.trades + " trades · fees " + fmtUsd0(m.fees), tone(m.net)) +
      kpi("Win rate", m.win_rate + "%", m.wins + "W · " + m.losses + "L" + (streak ? " · streak: " + streak : "")) +
      kpi("Profit factor", m.profit_factor == null ? "—" : m.profit_factor, "expectancy " + fmtUsd0(m.expectancy, true)) +
      kpi("Avg win / loss", '<span class="up">' + fmtUsd0(m.avg_win, true) + '</span><br><span class="down">' + fmtUsd0(m.avg_loss, true) + "</span>", "best " + fmtUsd0(m.best, true) + " · worst " + fmtUsd0(m.worst, true), "stack") +
      kpi("Room to max loss", fmtUsd0(room), "drawdown now " + fmtUsd0(m.drawdown_now) + " · worst " + fmtUsd0(m.max_drawdown) +
        '<div class="bar"><i style="width:' + pct + "%;background:" + barColor + '"></i></div>', pct > 25 ? "" : "down", " wide");
  }

  function equity(s) {
    var pts = (s.metrics && s.metrics.equity) || [];
    if (pts.length < 2) return '<div class="empty">The curve starts after the first two closed trades.</div>';
    var W = 600, H = 170, P = 6;
    var vals = [0].concat(pts.map(function (p) { return p[1]; }));
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var x = function (i) { return P + i * (W - 2 * P) / (vals.length - 1); };
    var y = function (v) { return P + (max - v) * (H - 2 * P) / (max - min); };
    var line = vals.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
    var last = vals[vals.length - 1], col = last >= 0 ? "var(--up)" : "var(--down)";
    $("equity-range").textContent = fmtUsd0(min) + " → " + fmtUsd0(max);
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="Equity curve, now ' + fmtUsd0(last, true) + '">' +
      '<defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".28"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--line)" stroke-dasharray="4 4"/>' +
      '<path d="' + line + " L" + x(vals.length - 1) + " " + (H - P) + " L" + x(0) + " " + (H - P) + ' Z" fill="url(#eg)"/>' +
      '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<circle cx="' + x(vals.length - 1) + '" cy="' + y(last) + '" r="4" fill="' + col + '"/></svg>';
  }

  function strategies(s) {
    var rows = s.by_strategy || [];
    if (!rows.length) return '<div class="empty">No closed trades yet.</div>';
    return rows.map(function (r) {
      return '<div class="row"><div><div class="name">' + esc(r.strategy) + '</div><div class="sub2">' + r.trades + " trades · " +
        (r.win_rate == null ? "—" : r.win_rate + "% win") + " · PF " + (r.profit_factor == null ? "—" : r.profit_factor) + "</div></div>" +
        '<div class="amt ' + tone(r.net) + '">' + fmtUsd0(r.net, true) + "</div></div>";
    }).join("");
  }

  function trades(s) {
    var ts = s.trades || [];
    $("trades-count").textContent = ts.length ? ts.length + " latest" : "";
    if (!ts.length) return '<li class="empty" style="display:block">No closed trades yet. They appear here as the auto-trader closes them.</li>';
    return ts.map(function (t) {
      return '<li><span class="ico ' + t.direction + '">' + (t.direction === "long" ? "L" : "S") + "</span>" +
        '<div><div class="name">' + esc(t.size) + " " + esc(t.symbol) + ' <span class="muted">· ' + esc(t.strategy) + "</span></div>" +
        '<div class="sub2">' + ct(t.opened, true) + " · " + dur(t.minutes) + " · " + fmtPx(t.entry_price) + " → " + fmtPx(t.exit_price) + "</div></div>" +
        '<div class="amt ' + tone(t.net) + '">' + fmtUsd(t.net, true) + "</div></li>";
    }).join("");
  }

  function bot(s) {
    var a = s.autotrader || {};
    var on = a.overnight || {};
    $("bot-summary").textContent = (a.state || "—") + (a.account ? " · …" + String(a.account).slice(-4) : "");
    var head = '<div class="row"><div><div class="name">State</div><div class="sub2">' + esc(a.reason || "running") + '</div></div><div class="amt ' +
      (a.state === "connected" ? "up" : a.state === "halted" ? "down" : "warn") + '">' + esc(a.state || "—") + "</div></div>" +
      '<div class="row"><div><div class="name">Day trades today</div><div class="sub2">15m / 1h, $500 risk</div></div><div class="amt">' + (a.trades_today != null ? a.trades_today - (on.trades_today || 0) : "—") + " / " + (a.max_trades_per_day || "—") + "</div></div>" +
      '<div class="row"><div><div class="name">Overnight lane</div><div class="sub2">' + (on.on ? "on · $" + on.risk_usd + " risk" : "off") + '</div></div><div class="amt">' + (on.trades_today || 0) + " / " + (on.max_per_day || "—") + "</div></div>";
    var keep = { trade: 1, closed: 1, halt: 1, flatten: 1, pause: 1, resume: 1, skip: 1 };
    var ev = (a.events || []).filter(function (e) { return keep[e.kind]; }).slice().reverse().map(function (e) {
      return '<div class="event"><b>' + esc(e.kind) + "</b> · " + ct(e.t, true) + "<br>" + esc(e.msg) + "</div>";
    }).join("");
    return head + (ev ? '<div style="margin-top:10px">' + ev + "</div>" : "");
  }

  function books(s) {
    var rows = (s.books || []).filter(function (b) { return !b.error && b.n; });
    if (!rows.length) return '<div class="empty">No paper trades recorded yet.</div>';
    return rows.sort(function (a, b) { return b.total_r - a.total_r; }).map(function (b) {
      var st = b.status === "pass" ? "up" : b.status === "fail" ? "down" : "muted";
      return '<div class="row"><div><div class="name">' + esc(b.strategy.replace(/ \((NQ|GC), paper\)| \(paper\)/, "")) + '</div><div class="sub2">' + b.n + " trades · " +
        (b.win_rate == null ? "—" : Math.round(b.win_rate * 100) + "% win") + ' · <span class="' + st + '">' + esc(b.status) + "</span></div></div>" +
        '<div class="amt ' + tone(b.total_r) + '">' + (b.total_r > 0 ? "+" : "") + Number(b.total_r).toFixed(1) + "R</div></div>";
    }).join("");
  }

  function render() {
    var s = snap;
    $("acct").textContent = s.account && s.account.name ? "NQ auto-trader · …" + String(s.account.name).slice(-4) : "NQ auto-trader";
    $("hero").innerHTML = hero(s);
    $("today").innerHTML = today(s);
    $("kpis").innerHTML = kpis(s);
    $("equity").innerHTML = equity(s);
    $("strategies").innerHTML = strategies(s);
    $("trades").innerHTML = trades(s);
    $("bot").innerHTML = bot(s);
    $("books").innerHTML = books(s);
    $("app").setAttribute("aria-busy", "false");
    setStatus();
  }

  // The gist's raw link is free to poll but GitHub refreshes it only about once a minute; the
  // gist API always has the newest upload but allows ~60 unauthenticated calls an hour per
  // device. So: raw on every refresh, the API at most once a minute (and only while it is not
  // rate-limited), and whichever snapshot is newer wins.
  var gistMatch = DATA_URL.match(/gist\.githubusercontent\.com\/[^/]+\/([0-9a-f]+)\//);
  var API_URL = gistMatch ? "https://api.github.com/gists/" + gistMatch[1] : null;
  var apiNextAt = 0;
  function fromApi() {
    if (!API_URL || Date.now() < apiNextAt) return Promise.resolve(null);
    apiNextAt = Date.now() + 62000;
    return fetch(API_URL, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) {
        if (r.status === 403 || r.status === 429) { apiNextAt = Date.now() + 15 * 60000; return null; }   // rate-limited: raw only for a while
        return r.ok ? r.json() : null;
      })
      .then(function (g) {
        var f = g && g.files && g.files["snapshot.json"];
        return f && !f.truncated ? JSON.parse(f.content) : null;
      })
      .catch(function () { return null; });
  }
  function fromRaw() {
    var url = DATA_URL + (DATA_URL.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  function load() {
    return Promise.all([fromRaw().catch(function (e) { return { _err: e }; }), fromApi()])
      .then(function (res) {
        var raw = res[0] && !res[0]._err ? res[0] : null, api = res[1];
        var j = [raw, api, snap].filter(function (x) { return x && x.generated_at; })
          .sort(function (a, b) { return b.generated_at - a.generated_at; })[0];
        if (!j) throw (res[0] && res[0]._err) || new Error("no snapshot yet");
        if (!raw && !api) throw (res[0] && res[0]._err) || new Error("no new data");
        snap = j; $("error").hidden = true; render();
      })
      .catch(function (e) {
        $("error").hidden = false;
        $("error").textContent = "Couldn't load the latest data (" + e.message + "). Showing the last copy; retrying.";
        setStatus();
      });
  }

  function schedule() { clearInterval(timer); timer = setInterval(load, REFRESH_MS); }
  $("status").addEventListener("click", load);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { load(); schedule(); } });
  setInterval(setStatus, 15000);
  load(); schedule();
})();
