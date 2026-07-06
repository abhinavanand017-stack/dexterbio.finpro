/* Live market data — Angel One (REST poll 15s) + Finnhub (WebSocket) */
(function () {
  "use strict";

  var API_BASE = ""; // same origin as parent; iframe served from same host
  // If loaded inside iframe on same host, relative URLs work.

  var els = {
    niftyVal: document.getElementById("nifty-index-val"),
    niftyChg: document.getElementById("nifty-index-chg"),
    niftyStatus: document.getElementById("nifty-status-tag"),
    sensexVal: document.getElementById("sensex-index-val"),
    sensexChg: document.getElementById("sensex-index-chg"),
    sensexStatus: document.getElementById("sensex-status-tag"),
  };

  function fmt(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    var sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function paint(el, val, chg) {
    if (!el) return;
    if (el.valEl) el.valEl.textContent = fmt(val);
    if (el.chgEl) {
      el.chgEl.textContent = fmtPct(chg);
      el.chgEl.classList.remove("positive", "negative");
      el.chgEl.classList.add(chg >= 0 ? "positive" : "negative");
    }
  }

  function setStatus(el, ok) {
    if (!el) return;
    el.textContent = ok ? "LIVE • Angel One" : "OFFLINE";
    el.style.color = ok ? "#22c55e" : "#ef4444";
  }

  var NIFTY = { valEl: els.niftyVal, chgEl: els.niftyChg };
  var SENSEX = { valEl: els.sensexVal, chgEl: els.sensexChg };

  async function pollQuotes() {
    try {
      var r = await fetch(API_BASE + "/api/public/market/quotes", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var j = await r.json();
      if (!j.quotes) throw new Error(j.error || "no data");
      j.quotes.forEach(function (q) {
        if (q.token === "99926000") paint(NIFTY, q.ltp, q.percentChange);
        if (q.token === "99919000") paint(SENSEX, q.ltp, q.percentChange);
      });
      setStatus(els.niftyStatus, true);
      setStatus(els.sensexStatus, true);
      console.log("[live_market] quotes", j.quotes);
    } catch (e) {
      console.warn("[live_market] quote error:", e && e.message);
      setStatus(els.niftyStatus, false);
      setStatus(els.sensexStatus, false);
    }
  }

  // ---- Finnhub WebSocket -------------------------------------------------
  var ws = null;
  var wsRetry = 0;
  var wsSymbols = ["NSE:NIFTY50", "BSE:SENSEX"]; // note: free tier likely won't stream these

  async function openFinnhub() {
    try {
      var r = await fetch(API_BASE + "/api/public/market/finnhub-token", { cache: "no-store" });
      var j = await r.json();
      if (!j.token) throw new Error(j.error || "no token");
      ws = new WebSocket("wss://ws.finnhub.io?token=" + encodeURIComponent(j.token));
      ws.onopen = function () {
        wsRetry = 0;
        wsSymbols.forEach(function (s) {
          ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
        });
        console.log("[live_market] finnhub WS open");
      };
      ws.onmessage = function (ev) {
        try {
          var d = JSON.parse(ev.data);
          if (d.type !== "trade" || !Array.isArray(d.data)) return;
          d.data.forEach(function (t) {
            if (t.s === "NSE:NIFTY50" && NIFTY.valEl) NIFTY.valEl.textContent = fmt(t.p);
            if (t.s === "BSE:SENSEX" && SENSEX.valEl) SENSEX.valEl.textContent = fmt(t.p);
          });
        } catch (_) {}
      };
      ws.onerror = function (e) { console.warn("[live_market] finnhub WS error", e); };
      ws.onclose = function () {
        wsRetry++;
        var delay = Math.min(30000, 2000 * wsRetry);
        setTimeout(openFinnhub, delay);
      };
    } catch (e) {
      console.warn("[live_market] finnhub token error:", e && e.message);
    }
  }

  // Kick off
  pollQuotes();
  setInterval(pollQuotes, 15000);
  openFinnhub();
})();