/* ============================================================
   DEXTER v2 — Chrome (sidebar + top bar) + New Pages + Biometric loop
   Additive. Loaded LAST so it can layer over existing app.js UI.
   ============================================================ */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rand = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  const fmt = (n, d = 2) => (n == null || !isFinite(n) ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));

  // ---------- ICON SET (currentColor SVGs) ----------
  const ico = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    portfolio: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 7h18M6 7v13h12V7M9 7V4h6v3"/></svg>',
    forecaster: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    earnings: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>',
    sip: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    ipo: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 21V3M5 10l7-7 7 7"/></svg>',
    heatmap: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 5v3m0 0a7 7 0 1 1-4.95 2.05"/><path d="M12 8L8 5m4 3L8 11"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
    narrator: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h16"/></svg>',
    cohort: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s3 1.5 3 3.5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.5-2.4.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 0 0-2.1 1.2l-2.4-.9-2 3.5 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.5 2.4-.9c.6.5 1.4.9 2.1 1.2L10 21h4l.4-2.4c.7-.3 1.5-.7 2.1-1.2l2.4.9 2-3.5-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M7 9h6M7 13h10M7 17h10"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 12l5 5 9-11"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
  };

  // ---------- SIDEBAR ----------
  const SIDEBAR_ITEMS = [
    { section: "Trading" },
    { key: "dashboard",   label: "Dashboard",          icon: ico.dashboard,  tab: "dashboard" },
    { key: "portfolio",   label: "Portfolio (Shadow)", icon: ico.portfolio,  tab: "shadow" },
    { key: "forecaster",  label: "Forecaster",         icon: ico.forecaster, tab: "forecasting" },
    { key: "market",      label: "Market Scanner",     icon: ico.heatmap,    tab: "market" },
    { key: "heatmap",     label: "Market Heatmap",     icon: ico.heatmap,    tab: "v2-heatmap",   isNew: true },
    { section: "Discovery" },
    { key: "equity",      label: "Equity Screener",    icon: ico.portfolio,  tab: "equity" },
    { key: "mf",          label: "Mutual Funds",       icon: ico.portfolio,  tab: "mutualfunds" },
    { key: "earnings",    label: "Earnings Calendar",  icon: ico.earnings,   tab: "v2-earnings",  isNew: true },
    { key: "ipo",         label: "IPO Watch",          icon: ico.ipo,        tab: "v2-ipo",       isNew: true },
    { key: "sip",         label: "SIP / Goal Planner", icon: ico.sip,        tab: "v2-sip",       isNew: true },
    { section: "Cognitive Layer" },
    { key: "replay",      label: "Biometric Replay",   icon: ico.replay,     tab: "v2-replay",    isNew: true },
    { key: "calendar",    label: "Cognitive Load Cal", icon: ico.calendar,   tab: "v2-cload",     isNew: true },
    { key: "narrator",    label: "Regime Narrator",    icon: ico.narrator,   tab: "v2-narrator",  isNew: true },
    { key: "cohort",      label: "Cohort Benchmark",   icon: ico.cohort,     tab: "v2-cohort",    isNew: true },
    { key: "behavioral",  label: "Behavioral Log",     icon: ico.narrator,   tab: "behavioral" },
    { key: "biometric",   label: "Biometrics",         icon: ico.replay,     tab: "biometric" },
    { section: "Other" },
    { key: "tracker",     label: "Daily Tracker",      icon: ico.dashboard,  tab: "tracker" },
    { key: "news",        label: "Market News",        icon: ico.news,       tab: "news" },
    { key: "demat",       label: "Broker Gateway",     icon: ico.settings,   tab: "demat" },
    { key: "settings",    label: "Settings",           icon: ico.settings,   tab: "v2-settings",  isNew: true },
  ];

  function buildSidebar() {
    const sb = document.createElement("aside");
    sb.id = "v2-sidebar";
    sb.innerHTML = `
      <div class="v2-brand">
        <div class="v2-brand-mark">D</div>
        <div class="v2-brand-name">Dexter</div>
      </div>
      <nav class="v2-sb-nav">
        ${SIDEBAR_ITEMS.map(it => it.section
          ? `<div class="v2-sb-section">${esc(it.section)}</div>`
          : `<button class="v2-sb-btn" data-tab="${esc(it.tab)}" title="${esc(it.label)}">
               ${it.icon}<span class="v2-sb-label">${esc(it.label)}</span>
             </button>`
        ).join("")}
      </nav>
      <div class="v2-sb-foot">
        <button id="v2-sidebar-toggle" title="Collapse sidebar" aria-label="Toggle sidebar">‹</button>
        <span class="v2-sb-label" style="font-size:11px;color:var(--v2-text-mute);">v2.4 · terminal</span>
      </div>`;
    document.body.appendChild(sb);

    sb.addEventListener("click", (e) => {
      const btn = e.target.closest(".v2-sb-btn");
      if (!btn) return;
      selectTab(btn.dataset.tab);
    });
    $("#v2-sidebar-toggle").addEventListener("click", () => {
      sb.classList.toggle("collapsed");
      $("#v2-sidebar-toggle").textContent = sb.classList.contains("collapsed") ? "›" : "‹";
    });
  }

  // Route a sidebar click to existing tab machinery, or the new v2 tabs.
  function selectTab(tabKey) {
    // Mark sidebar active
    $$("#v2-sidebar .v2-sb-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabKey));

    if (tabKey.startsWith("v2-")) {
      // Hide all base panels & new v2 panels, show target v2 panel
      $$(".tab-panel").forEach(p => p.classList.remove("active"));
      const target = document.getElementById("panel-" + tabKey);
      if (target) target.classList.add("active");
      // Also deactivate original nav-tab buttons so nothing looks selected
      $$(".nav-tab").forEach(t => t.classList.remove("active"));
    } else {
      const t = document.getElementById("tab-" + tabKey);
      if (t) t.click();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- TOP BAR ----------
  function buildTopbar() {
    const bar = document.createElement("header");
    bar.id = "v2-topbar";
    bar.innerHTML = `
      <div class="v2-topbar-row-1">
        <div class="v2-lambda-gauge" id="v2-lambda-gauge" title="Bio-adjusted risk-aversion λ">
          <svg viewBox="0 0 44 44">
            <circle class="v2-lg-arc v2-lg-bg" cx="22" cy="22" r="18"/>
            <circle class="v2-lg-arc v2-lg-fg" id="v2-lg-fg" cx="22" cy="22" r="18"
              stroke-dasharray="113" stroke-dashoffset="45"
              stroke="var(--v2-calm)" transform="rotate(-90 22 22)"/>
          </svg>
          <div class="v2-lg-txt">
            <span class="v2-lg-val" id="v2-lg-val" data-num>0.63</span>
            <span class="v2-lg-lbl">λ · bio</span>
          </div>
        </div>

        <div class="v2-cb-chip" id="v2-cb-chip" data-state="calm" title="Circuit breaker status">
          <span class="v2-cb-dot"></span>
          <span id="v2-cb-txt">ARMED · CALM</span>
        </div>

        <div class="v2-topbar-spacer"></div>

        <div class="v2-topbar-actions">
          <button class="v2-btn v2-btn-keep" id="v2-connect-wearable">＋ Connect wearable</button>
          <button class="v2-btn" id="v2-open-pitch">Pitch Mode</button>
          <button class="v2-btn" id="v2-test-circuit">⚡ Test Circuit</button>
        </div>
      </div>
      <div class="v2-topbar-row-2">
        <div class="v2-ticker-track" id="v2-ticker-track"></div>
      </div>`;
    document.body.appendChild(bar);

    $("#v2-open-pitch")?.addEventListener("click", () => $("#pitch-deck-btn")?.click());
    $("#v2-test-circuit")?.addEventListener("click", () => $("#trigger-circuit-breaker-btn")?.click());
    $("#v2-connect-wearable")?.addEventListener("click", showWearableDialog);

    seedTicker();
    setInterval(updateTicker, 3800);
  }

  // ---------- TICKER ----------
  const TICKER_SYMBOLS = [
    { sym: "NIFTY 50",  px: 23290.15, chg: 0.85 },
    { sym: "SENSEX",    px: 76432.50, chg: 0.72 },
    { sym: "BANKNIFTY", px: 50142.30, chg: -0.24 },
    { sym: "NIFTY IT",  px: 41210.10, chg: 1.12 },
    { sym: "USD/INR",   px: 83.42,    chg: -0.06 },
    { sym: "GOLD ₹",    px: 74210.00, chg: 0.32 },
    { sym: "BRENT",     px: 78.10,    chg: -0.45 },
    { sym: "RELIANCE",  px: 2932.10,  chg: 0.55 },
    { sym: "TCS",       px: 4210.75,  chg: -0.18 },
    { sym: "HDFCBANK",  px: 1712.40,  chg: 0.24 },
    { sym: "INFY",      px: 1840.90,  chg: 0.98 },
  ];
  function tickerHTML(list) {
    return list.map(t => `
      <span class="v2-ticker-item">
        <span class="v2-t-sym">${esc(t.sym)}</span>
        <span class="v2-t-px">${fmt(t.px)}</span>
        <span class="v2-t-chg ${t.chg >= 0 ? "up" : "down"}">${t.chg >= 0 ? "▲" : "▼"} ${Math.abs(t.chg).toFixed(2)}%</span>
      </span>`).join("");
  }
  function seedTicker() {
    // Duplicate list for seamless loop
    $("#v2-ticker-track").innerHTML = tickerHTML(TICKER_SYMBOLS) + tickerHTML(TICKER_SYMBOLS);
  }
  function updateTicker() {
    TICKER_SYMBOLS.forEach(t => {
      const drift = (Math.random() - 0.5) * 0.15;
      t.chg = Math.max(-3, Math.min(3, t.chg + drift));
      t.px = +(t.px * (1 + drift / 100)).toFixed(2);
    });
    seedTicker();
  }

  // ---------- BIOMETRIC LOOP ----------
  const bio = {
    hrv: 72,     // ms — higher = calmer
    gsr: 3.2,    // µS — higher = more aroused
    lambda: 0.63,
    startedAt: Date.now(),
    stream: [], // {t, hrv, gsr, lambda}
  };

  function tickBiometrics() {
    // Random walk with regime pulls
    bio.hrv = Math.max(30, Math.min(120, bio.hrv + (Math.random() - 0.5) * 4));
    bio.gsr = Math.max(0.5, Math.min(15, bio.gsr + (Math.random() - 0.5) * 0.4));
    // λ ∝ arousal: low HRV + high GSR → higher λ (more risk-averse)
    const arousal = (1 - (bio.hrv - 30) / 90) * 0.55 + (bio.gsr / 15) * 0.45; // 0..1
    bio.lambda = +(0.4 + arousal * 0.85).toFixed(2); // 0.4..1.25
    bio.stream.push({ t: Date.now(), hrv: bio.hrv, gsr: bio.gsr, lambda: bio.lambda });
    if (bio.stream.length > 720) bio.stream.shift();
    paintTopbarBio(arousal);
  }

  function paintTopbarBio(arousal) {
    const val = $("#v2-lg-val");
    const fg = $("#v2-lg-fg");
    const chip = $("#v2-cb-chip");
    const chipTxt = $("#v2-cb-txt");
    if (!val || !fg) return;
    // λ 0.4..1.25 → arc offset (circumference 113)
    const pct = Math.min(1, Math.max(0, (bio.lambda - 0.4) / 0.85));
    fg.setAttribute("stroke-dashoffset", 113 * (1 - pct));
    let state = "calm", color = "var(--v2-calm)", label = "ARMED · CALM";
    if (arousal > 0.55) { state = "elevated"; color = "var(--v2-elevated)"; label = "ARMED · ELEVATED"; }
    if (arousal > 0.78) { state = "hot";      color = "var(--v2-hot)";      label = "TRIP-READY · HIGH"; }
    fg.setAttribute("stroke", color);
    chip.dataset.state = state;
    chipTxt.textContent = label;
    // Number count-up feel
    const prev = parseFloat(val.textContent) || 0;
    if (Math.abs(prev - bio.lambda) > 0.005) {
      val.textContent = bio.lambda.toFixed(2);
      val.classList.remove("v2-flash"); void val.offsetWidth; val.classList.add("v2-flash");
    }
  }

  // ---------- NEW PANELS ----------
  const V2_PANELS = [
    { id: "v2-replay",    title: "Biometric Replay",       sub: "Aligned price · biometric · order-event timeline for every closed trade.", render: renderReplayPanel },
    { id: "v2-cload",     title: "Cognitive Load Calendar", sub: "12-month discipline vs arousal heatmap. Click a day for the trade log.", render: renderCognitiveCalendar },
    { id: "v2-narrator",  title: "Regime Narrator",         sub: "Macro context cross-referenced with your λ spikes and Shadow-Portfolio behaviour.", render: renderNarratorPanel },
    { id: "v2-cohort",    title: "Cohort Benchmark",        sub: "Anonymised percentile bars vs peers matched on risk profile and portfolio size.", render: renderCohortPanel },
    { id: "v2-heatmap",   title: "Market Heatmap",          sub: "Sector-weighted intraday heatmap of NIFTY constituents.", render: renderHeatmapPanel },
    { id: "v2-earnings",  title: "Earnings Calendar",       sub: "Upcoming NSE earnings with consensus vs whispers.", render: renderEarningsPanel },
    { id: "v2-ipo",       title: "IPO Watch",               sub: "Live NSE/BSE IPO queue: subscription, GMP, listing outlook.", render: renderIpoPanel },
    { id: "v2-sip",       title: "SIP / Goal Planner",      sub: "Long-horizon goal solver with inflation-adjusted paths.", render: renderSipPanel },
    { id: "v2-settings",  title: "Settings",                sub: "Wearable connections, alert thresholds, cohort visibility.", render: renderSettingsPanel },
  ];

  function mountNewPanels() {
    const main = $(".main-content");
    if (!main) return;
    V2_PANELS.forEach(p => {
      const el = document.createElement("div");
      el.className = "tab-panel";
      el.id = "panel-" + p.id;
      el.innerHTML = `
        <div class="v2-page-hdr">
          <div>
            <h2>${esc(p.title)}</h2>
            <div class="v2-page-sub">${esc(p.sub)}</div>
          </div>
        </div>
        <div class="v2-page-body" data-page="${p.id}"></div>`;
      main.appendChild(el);
      try { p.render(el.querySelector(".v2-page-body")); }
      catch (e) { console.error("[v2] render failed for", p.id, e); }
    });
  }

  // ---------- BIOMETRIC REPLAY ----------
  const MOCK_TRADES = [
    { id: "T-2405", sym: "RELIANCE", entry: 2905, exit: 2932, ts: "2025-11-12 09:42", pnl: 27 },
    { id: "T-2404", sym: "HDFCBANK", entry: 1710, exit: 1698, ts: "2025-11-11 14:08", pnl: -12 },
    { id: "T-2403", sym: "INFY",     entry: 1810, exit: 1841, ts: "2025-11-10 10:15", pnl: 31 },
    { id: "T-2402", sym: "TCS",      entry: 4230, exit: 4211, ts: "2025-11-08 11:30", pnl: -19 },
  ];

  function makeReplaySeries(tradeId) {
    const N = 240; // 240 seconds
    const rows = [];
    let px = 100, hrv = 72, gsr = 3;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const drift = Math.sin(t * 6 + tradeId.length) * 0.4 + (Math.random() - 0.5) * 0.6;
      px += drift;
      // Arousal spike ~75% through
      const spikeShape = Math.exp(-Math.pow((t - 0.75) * 8, 2));
      hrv = 72 - spikeShape * 25 + (Math.random() - 0.5) * 2;
      gsr = 3 + spikeShape * 6 + (Math.random() - 0.5) * 0.4;
      rows.push({ i, px, hrv, gsr });
    }
    const events = [
      { i: 5,           kind: "entry" },
      { i: N * 0.55|0,  kind: "modify" },
      { i: N * 0.82|0,  kind: "exit" },
    ];
    return { rows, events };
  }

  function renderReplayPanel(body) {
    body.innerHTML = `
      <div class="card v2-flat" style="padding:14px;">
        <div class="card-label">SELECT A CLOSED TRADE</div>
        <div class="v2-trade-picker" id="v2-replay-picker" style="margin-top:10px;">
          ${MOCK_TRADES.map((t, i) => `
            <button class="v2-trade-chip ${i === 0 ? "active" : ""}" data-id="${esc(t.id)}">
              ${esc(t.sym)} · ${esc(t.id)} · <span style="color:${t.pnl >= 0 ? "var(--v2-calm)" : "var(--v2-hot)"};">${t.pnl >= 0 ? "+" : ""}${t.pnl}</span>
            </button>`).join("")}
        </div>
      </div>
      <div class="card" style="margin-top:14px;">
        <div class="card-label">SYNCED TIMELINE</div>
        <div class="v2-replay-timeline" id="v2-replay-timeline"></div>
        <input class="v2-replay-scrub" id="v2-replay-scrub" type="range" min="0" max="239" value="120" aria-label="Timeline scrubber"/>
        <div class="v2-replay-insight" id="v2-replay-insight"></div>
      </div>`;

    let currentId = MOCK_TRADES[0].id;
    let series = makeReplaySeries(currentId);
    let playhead = 120;

    function toPath(rows, key) {
      const min = Math.min(...rows.map(r => r[key]));
      const max = Math.max(...rows.map(r => r[key]));
      const range = max - min || 1;
      const W = 1000, H = 40;
      return rows.map((r, i) => `${i === 0 ? "M" : "L"}${(i / (rows.length - 1) * W).toFixed(1)},${(H - ((r[key] - min) / range) * H).toFixed(1)}`).join(" ");
    }

    function drawTimeline() {
      const tl = $("#v2-replay-timeline");
      const N = series.rows.length;
      const eventDots = series.events.map(e => {
        const x = (e.i / (N - 1)) * 100;
        const color = e.kind === "entry" ? "var(--v2-calm)" : e.kind === "exit" ? "var(--v2-hot)" : "var(--v2-elevated)";
        const label = e.kind[0].toUpperCase() + e.kind.slice(1);
        return `
          <div class="v2-evt-marker" title="${esc(label)}" style="left:${x}%;background:${color};">
            <span class="v2-evt-lbl">${esc(label)}</span>
          </div>`;
      }).join("");
      tl.innerHTML = `
        <div class="v2-replay-track">
          <span class="v2-track-label">Price</span>
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none"><path d="${toPath(series.rows,"px")}" stroke="var(--v2-accent)" fill="none" stroke-width="1.5"/></svg>
        </div>
        <div class="v2-replay-track">
          <span class="v2-track-label">HRV (ms)</span>
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none"><path d="${toPath(series.rows,"hrv")}" stroke="var(--v2-calm)" fill="none" stroke-width="1.5"/></svg>
        </div>
        <div class="v2-replay-track">
          <span class="v2-track-label">GSR (µS)</span>
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none"><path d="${toPath(series.rows,"gsr")}" stroke="var(--v2-elevated)" fill="none" stroke-width="1.5"/></svg>
        </div>
        <div class="v2-replay-track v2-replay-events-row">
          <span class="v2-track-label">Events</span>
          <div class="v2-replay-events-lane">${eventDots}</div>
        </div>
        <div class="v2-replay-playhead" id="v2-replay-playhead" style="left:${(playhead/(N-1))*100}%;"></div>`;
    }

    function updateInsight() {
      const exit = series.events.find(e => e.kind === "exit");
      const exitI = exit.i;
      const window = series.rows.slice(Math.max(0, exitI - 90), exitI);
      const preRow = series.rows[Math.max(0, exitI - 90)];
      const gsrPeak = Math.max(...window.map(r => r.gsr));
      const gsrDelta = ((gsrPeak - preRow.gsr) / preRow.gsr * 100).toFixed(0);
      const cur = series.rows[playhead];
      const flag = cur.gsr > 6 ? "elevated" : (cur.gsr > 4.5 ? "watch" : "calm");
      const sig = flag === "elevated"
        ? `<span class="v2-sig hot">${ico.warn} Arousal high</span>`
        : flag === "watch"
        ? `<span class="v2-sig elevated">${ico.warn} Watch</span>`
        : `<span class="v2-sig calm">${ico.check} Calm</span>`;
      $("#v2-replay-insight").innerHTML = `
        ${sig}
        <div style="margin-top:6px;">
          Arousal (GSR) spiked <strong>${gsrDelta}%</strong> in the 90&nbsp;seconds before you exited.
          Playhead t=${playhead}s → HRV ${cur.hrv.toFixed(1)}&nbsp;ms, GSR ${cur.gsr.toFixed(2)}&nbsp;µS.
        </div>`;
    }

    drawTimeline(); updateInsight();

    $("#v2-replay-picker").addEventListener("click", e => {
      const b = e.target.closest(".v2-trade-chip"); if (!b) return;
      $$("#v2-replay-picker .v2-trade-chip").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentId = b.dataset.id;
      series = makeReplaySeries(currentId);
      playhead = Math.min(playhead, series.rows.length - 1);
      $("#v2-replay-scrub").value = playhead;
      drawTimeline(); updateInsight();
    });
    $("#v2-replay-scrub").addEventListener("input", e => {
      playhead = +e.target.value;
      const ph = $("#v2-replay-playhead");
      if (ph) ph.style.left = (playhead / (series.rows.length - 1) * 100) + "%";
      updateInsight();
    });
  }

  // ---------- COGNITIVE LOAD CALENDAR ----------
  function renderCognitiveCalendar(body) {
    body.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div class="card-label">DISCIPLINE HEATMAP — LAST 52 WEEKS</div>
          <div class="v2-cal-legend">
            <span>Poor discipline</span>
            <span class="v2-cal-swatch" style="background:#4A0F1A"></span>
            <span class="v2-cal-swatch" style="background:#8A1E2A"></span>
            <span class="v2-cal-swatch" style="background:#1B1F27"></span>
            <span class="v2-cal-swatch" style="background:#12563A"></span>
            <span class="v2-cal-swatch" style="background:#00D084"></span>
            <span>High discipline</span>
          </div>
        </div>
        <div class="v2-cal-grid" id="v2-cal-grid" style="margin-top:14px;"></div>
        <div id="v2-cal-drill" style="margin-top:16px;"></div>
      </div>
      <div class="card" style="margin-top:14px;">
        <div class="card-label">BEST TRADING WINDOWS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px;">
          <div>
            <div style="font-size:12px;color:var(--v2-text-mute);margin-bottom:6px;">By day-of-week (avg Dexter Score)</div>
            <div id="v2-cal-dow"></div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--v2-text-mute);margin-bottom:6px;">By time-of-day (avg λ-adjusted P&L)</div>
            <div id="v2-cal-tod"></div>
          </div>
        </div>
      </div>`;

    const grid = $("#v2-cal-grid");
    const today = new Date();
    // Build 53 weeks × 7 days (rotated)
    const cells = [];
    const cols = [];
    for (let w = 52; w >= 0; w--) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const seed = date.getDate() * 31 + date.getMonth() * 7 + w;
        const score = Math.max(0, Math.min(100, 55 + Math.sin(seed) * 40 + (rand(seed) - 0.5) * 20));
        col.push({ date, score });
        cells.push({ date, score });
      }
      cols.push(col);
    }

    function colorFor(s) {
      if (s == null) return "#1B1F27";
      if (s < 25) return "#4A0F1A";
      if (s < 45) return "#8A1E2A";
      if (s < 60) return "#33302A";
      if (s < 78) return "#12563A";
      return "#00D084";
    }

    // Layout: first column = day labels, then 53 week columns
    const DOW = ["Mon","","Wed","","Fri","",""];
    let html = "";
    for (let d = 0; d < 7; d++) html += `<div class="v2-cal-daylabel" style="grid-row:${d+1};grid-column:1;">${DOW[d]}</div>`;
    cols.forEach((col, wi) => {
      col.forEach((cell, d) => {
        html += `<div class="v2-cal-cell" title="${cell.date.toDateString()} · score ${cell.score.toFixed(0)}"
                      style="background:${colorFor(cell.score)};grid-column:${wi+2};grid-row:${d+1};"
                      data-idx="${wi}-${d}"></div>`;
      });
    });
    grid.innerHTML = html;

    grid.addEventListener("click", e => {
      const c = e.target.closest(".v2-cal-cell"); if (!c) return;
      const [wi, d] = c.dataset.idx.split("-").map(Number);
      const cell = cols[wi][d];
      const drill = $("#v2-cal-drill");
      const trades = 1 + Math.floor(rand(cell.date.getTime()) * 5);
      const rows = Array.from({length: trades}, (_, i) => {
        const pnl = ((rand(cell.date.getTime() + i) - 0.4) * 800).toFixed(0);
        const arousal = (rand(cell.date.getTime() + i * 3) * 100).toFixed(0);
        return `<tr>
          <td>${cell.date.toDateString()} · ${9 + i}:${(15*(i+1)).toString().padStart(2,"0")}</td>
          <td>${["RELIANCE","INFY","HDFCBANK","TCS","ITC"][i%5]}</td>
          <td class="${pnl>=0?"positive":"negative"}">₹${pnl}</td>
          <td>${arousal}%</td>
        </tr>`;
      }).join("");
      drill.innerHTML = `
        <div class="card v2-flat" style="padding:14px;">
          <div class="card-label">${cell.date.toDateString().toUpperCase()} · Dexter score ${cell.score.toFixed(0)}</div>
          <table class="market-table" style="margin-top:10px;width:100%;">
            <thead><tr><th>TIME</th><th>SYMBOL</th><th>P&L</th><th>AROUSAL</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    });

    // Aggregates
    const dow = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const dowAvg = dow.map((_, i) => {
      const rel = cells.filter(c => (c.date.getDay() + 6) % 7 === i);
      return rel.reduce((s, x) => s + x.score, 0) / rel.length;
    });
    $("#v2-cal-dow").innerHTML = dow.map((d, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
        <span style="width:36px;font-family:var(--v2-mono);color:var(--v2-text-dim);font-size:12px;">${d}</span>
        <div style="flex:1;height:6px;border-radius:3px;background:#1B1F27;overflow:hidden;">
          <div style="width:${dowAvg[i].toFixed(0)}%;height:100%;background:linear-gradient(90deg,var(--v2-accent),var(--v2-calm));"></div>
        </div>
        <span style="font-family:var(--v2-mono);font-size:12px;color:var(--v2-text);width:36px;text-align:right;">${dowAvg[i].toFixed(0)}</span>
      </div>`).join("");

    const tods = ["9-10","10-11","11-12","12-1","1-2","2-3"];
    $("#v2-cal-tod").innerHTML = tods.map((t, i) => {
      const val = 30 + Math.sin(i*1.3) * 40 + rand(i*7)*15;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <span style="width:40px;font-family:var(--v2-mono);color:var(--v2-text-dim);font-size:12px;">${t}</span>
          <div style="flex:1;height:6px;border-radius:3px;background:#1B1F27;overflow:hidden;">
            <div style="width:${val.toFixed(0)}%;height:100%;background:linear-gradient(90deg,var(--v2-elevated),var(--v2-calm));"></div>
          </div>
          <span style="font-family:var(--v2-mono);font-size:12px;color:var(--v2-text);width:36px;text-align:right;">${val.toFixed(0)}</span>
        </div>`;
    }).join("");
  }

  // ---------- REGIME NARRATOR ----------
  function renderNarratorPanel(body) {
    body.innerHTML = `
      <div class="card v2-narrator-card">
        <div class="card-label">DAILY BRIEF · ${new Date().toDateString().toUpperCase()}</div>
        <div class="v2-narrator-brief" style="margin-top:10px;">
          RBI is on hold for the third consecutive policy meeting, keeping the repo rate at 6.50% while it watches
          sticky food CPI. Ten-year yields are drifting up ~4 bps into a weak auction, and FIIs booked ₹2,140 crore of
          equity yesterday against ₹1,880 crore of DII buying — the same DII cushion that absorbed the last two
          Fed-driven risk-offs.
          <br/><br/>
          Your λ spiked to 1.08 on the last two comparable RBI-on-hold days and Shadow Portfolio out-performed live by
          ~₹18k on both, because you tightened financials but held IT. The pattern is your friend today.
        </div>
        <div class="v2-narrator-take">
          <strong>Take:</strong> Let Dexter widen λ to ≥ 0.95 through the 11:00 MPC minutes. Do not override financials
          on green candles before 12:30 — that's when your two prior comparable-day drawdowns began.
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-label">MACRO CONTEXT MATRIX</div>
        <table class="market-table" style="margin-top:10px;width:100%;">
          <thead><tr><th>DRIVER</th><th>NOW</th><th>YOUR HISTORICAL λ</th><th>SHADOW EDGE</th></tr></thead>
          <tbody>
            <tr><td>RBI on hold</td><td>Repo 6.50%</td><td>1.08 (n=6)</td><td class="positive">+₹18k avg</td></tr>
            <tr><td>Fed dot-plot cut</td><td>Priced 25 bps Dec</td><td>0.71 (n=4)</td><td class="positive">+₹9k avg</td></tr>
            <tr><td>Crude &gt; $80</td><td>$78.10 (below)</td><td>0.82 (n=11)</td><td class="negative">−₹4k avg</td></tr>
            <tr><td>IN 10Y ≥ 7.30%</td><td>7.19% (below)</td><td>0.94 (n=3)</td><td class="positive">+₹6k avg</td></tr>
            <tr><td>FII sell-day</td><td>−₹2,140cr</td><td>1.02 (n=14)</td><td class="positive">+₹11k avg</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  // ---------- COHORT BENCHMARK ----------
  function renderCohortPanel(body) {
    body.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div class="card-label">COHORT · Moderate-risk · ₹5L–25L portfolio · n=1,284</div>
            <div style="color:var(--v2-text-mute);font-size:11px;margin-top:4px;">Anonymised percentile bars only. No peer identities or holdings are shown.</div>
          </div>
          <div class="v2-cohort-toggle" id="v2-cohort-toggle">
            <button class="active" data-mode="cohort">Vs Cohort</button>
            <button data-mode="self">Vs Past-Quarter Self</button>
          </div>
        </div>
        <div id="v2-cohort-body" style="margin-top:16px;"></div>
      </div>`;

    const METRICS = [
      { label: "Dexter Score",                      cohort: 72, self: 61, dir: "higher-better", sub: "Composite alpha discipline." },
      { label: "Discipline consistency",            cohort: 84, self: 78, dir: "higher-better", sub: "% of trades within λ-target band." },
      { label: "Circuit-breaker frequency",         cohort: 22, self: 34, dir: "lower-better",  sub: "Trips per 100 sessions." },
      { label: "Behavioral drag (bps/yr)",          cohort: 41, self: 55, dir: "lower-better",  sub: "Bleed vs Shadow portfolio." },
      { label: "Post-loss cooldown adherence",      cohort: 88, self: 71, dir: "higher-better", sub: "% of losses followed by 15-min hold." },
      { label: "Overnight-hold restraint",          cohort: 65, self: 60, dir: "higher-better", sub: "% closed intraday when λ > 0.9." },
    ];

    function paint(mode) {
      const body2 = $("#v2-cohort-body");
      body2.innerHTML = METRICS.map(m => {
        const pct = m[mode];
        const color = m.dir === "higher-better"
          ? (pct >= 70 ? "var(--v2-calm)" : pct >= 45 ? "var(--v2-elevated)" : "var(--v2-hot)")
          : (pct <= 30 ? "var(--v2-calm)" : pct <= 55 ? "var(--v2-elevated)" : "var(--v2-hot)");
        return `
          <div class="v2-cohort-row">
            <div class="v2-cohort-label">${esc(m.label)}<small>${esc(m.sub)}</small></div>
            <div class="v2-cohort-bar-wrap">
              <div class="v2-cohort-bar" style="width:${pct}%;background:${color};"></div>
            </div>
            <div class="v2-cohort-pct" data-num>${pct}<span style="font-size:10px;color:var(--v2-text-mute);"> pct</span></div>
          </div>`;
      }).join("");
    }
    paint("cohort");
    $("#v2-cohort-toggle").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#v2-cohort-toggle button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      paint(b.dataset.mode);
    });
  }

  // ---------- SUPPORTING NEW PANELS (light, empty-state-friendly) ----------
  function renderHeatmapPanel(body) {
    const cells = Array.from({ length: 60 }, (_, i) => {
      const p = (rand(i * 3.1) - 0.5) * 4;
      return { sym: ["REL","TCS","HDFB","INFY","ITC","LT","SBI","AXIS","BAJ","MRTI","WPRO","ONGC"][i % 12] + (i>11?"·"+((i/12|0)+1):""),
               px: 100 + p * 5, chg: p };
    });
    body.innerHTML = `
      <div class="card v2-flat" style="padding:14px;">
        <div class="card-label">NIFTY CONSTITUENTS · % change</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:4px;margin-top:12px;">
          ${cells.map(c => {
            const intensity = Math.min(1, Math.abs(c.chg) / 3);
            const bg = c.chg >= 0
              ? `rgba(0,208,132,${0.15 + intensity * 0.6})`
              : `rgba(255,59,92,${0.15 + intensity * 0.6})`;
            return `<div style="padding:10px 6px;border-radius:6px;background:${bg};text-align:center;">
                      <div style="font:600 11px var(--v2-sans);color:var(--v2-text);">${esc(c.sym)}</div>
                      <div style="font-family:var(--v2-mono);font-size:12px;color:var(--v2-text);margin-top:2px;">${c.chg >= 0 ? "+" : ""}${c.chg.toFixed(2)}%</div>
                    </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function renderEarningsPanel(body) {
    const list = [
      { d: "Tue", sym: "TCS",       cons: "₹12,240 cr", whisper: "₹12,450 cr" },
      { d: "Wed", sym: "HDFCBANK",  cons: "₹17,010 cr", whisper: "₹16,780 cr" },
      { d: "Thu", sym: "INFY",      cons: "₹6,320 cr",  whisper: "₹6,410 cr" },
      { d: "Fri", sym: "RELIANCE",  cons: "₹18,900 cr", whisper: "₹19,200 cr" },
    ];
    body.innerHTML = `
      <div class="card v2-flat" style="padding:0;">
        <table class="market-table" style="width:100%;">
          <thead><tr><th>DAY</th><th>SYMBOL</th><th>CONSENSUS EPS</th><th>WHISPER</th><th>DEXTER λ SUGGESTION</th></tr></thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td>${r.d}</td>
                <td style="font-weight:600;">${r.sym}</td>
                <td>${r.cons}</td>
                <td style="color:var(--v2-accent-2);">${r.whisper}</td>
                <td><span class="v2-sig elevated">${ico.warn} widen λ +0.10 T-2h</span></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderIpoPanel(body) {
    const list = [
      { sym: "SWIGGY",   price: "371–390", sub: "12.5x", gmp: "+₹18", close: "8 Nov" },
      { sym: "NIVA BUPA",price: "70–74",   sub: "1.8x",  gmp: "+₹2",  close: "11 Nov" },
      { sym: "ZINKA",    price: "259–273", sub: "35.2x", gmp: "+₹41", close: "12 Nov" },
    ];
    body.innerHTML = `
      <div class="card v2-flat" style="padding:0;">
        <table class="market-table" style="width:100%;">
          <thead><tr><th>SYMBOL</th><th>PRICE BAND</th><th>SUBSCRIPTION</th><th>GMP</th><th>CLOSE</th></tr></thead>
          <tbody>
            ${list.map(r => `<tr><td style="font-weight:600;">${r.sym}</td><td>${r.price}</td><td>${r.sub}</td><td class="positive">${r.gmp}</td><td>${r.close}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderSipPanel(body) {
    body.innerHTML = `
      <div class="card" style="padding:18px;max-width:640px;">
        <div class="card-label">GOAL SOLVER</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;">
          <label style="font-size:12px;color:var(--v2-text-dim);">Target corpus (₹)<input id="v2-sip-goal" type="number" value="10000000" style="width:100%;margin-top:4px;padding:8px;background:#0F1114;border:1px solid var(--v2-border-strong);border-radius:6px;color:var(--v2-text);font-family:var(--v2-mono);"/></label>
          <label style="font-size:12px;color:var(--v2-text-dim);">Horizon (years)<input id="v2-sip-years" type="number" value="15" style="width:100%;margin-top:4px;padding:8px;background:#0F1114;border:1px solid var(--v2-border-strong);border-radius:6px;color:var(--v2-text);font-family:var(--v2-mono);"/></label>
          <label style="font-size:12px;color:var(--v2-text-dim);">Expected CAGR (%)<input id="v2-sip-r" type="number" value="12" style="width:100%;margin-top:4px;padding:8px;background:#0F1114;border:1px solid var(--v2-border-strong);border-radius:6px;color:var(--v2-text);font-family:var(--v2-mono);"/></label>
          <label style="font-size:12px;color:var(--v2-text-dim);">Inflation (%)<input id="v2-sip-i" type="number" value="6" style="width:100%;margin-top:4px;padding:8px;background:#0F1114;border:1px solid var(--v2-border-strong);border-radius:6px;color:var(--v2-text);font-family:var(--v2-mono);"/></label>
        </div>
        <div id="v2-sip-out" style="margin-top:16px;padding:14px;border-radius:8px;background:rgba(61,139,255,0.08);border:1px solid var(--v2-accent);color:var(--v2-text);"></div>
      </div>`;
    function compute() {
      const g = +$("#v2-sip-goal").value;
      const y = +$("#v2-sip-years").value;
      const r = +$("#v2-sip-r").value / 100 / 12;
      const infl = +$("#v2-sip-i").value / 100;
      const gAdj = g * Math.pow(1 + infl, y);
      const n = y * 12;
      const sip = gAdj * r / (Math.pow(1 + r, n) - 1);
      $("#v2-sip-out").innerHTML = `
        <div style="font-size:12px;color:var(--v2-text-dim);">Inflation-adjusted target</div>
        <div style="font-family:var(--v2-mono);font-size:22px;margin-top:4px;">₹${fmt(gAdj, 0)}</div>
        <div style="font-size:12px;color:var(--v2-text-dim);margin-top:10px;">Required monthly SIP</div>
        <div style="font-family:var(--v2-mono);font-size:22px;color:var(--v2-accent-2);margin-top:4px;">₹${fmt(sip, 0)}</div>`;
    }
    body.addEventListener("input", compute);
    compute();
  }

  function renderSettingsPanel(body) {
    body.innerHTML = `
      <div class="card" style="padding:18px;">
        <div class="card-label">WEARABLE CONNECTIONS</div>
        <div class="v2-empty" style="margin-top:12px;">
          <h4>No wearable connected</h4>
          <p>Connect Whoop, Fitbit or Apple Health to power live λ, Biometric Replay, and the Cognitive Load Calendar.<br/>
             We currently show simulated biometric streams so you can preview the UX.</p>
          <button class="v2-btn-primary" id="v2-connect-2">＋ Connect wearable</button>
        </div>
      </div>
      <div class="card" style="padding:18px;margin-top:14px;">
        <div class="card-label">ALERT THRESHOLDS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px;">
          <div>λ tripwire<br/><input type="range" min="0.7" max="1.3" step="0.01" value="1.05" style="width:100%;"/></div>
          <div>Cooldown after loss (min)<br/><input type="range" min="1" max="30" value="15" style="width:100%;"/></div>
        </div>
      </div>`;
    $("#v2-connect-2")?.addEventListener("click", showWearableDialog);
  }

  function showWearableDialog() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:grid;place-items:center;padding:20px;";
    wrap.innerHTML = `
      <div style="background:var(--v2-panel-solid);border:1px solid var(--v2-border-strong);border-radius:14px;padding:24px;max-width:440px;width:100%;">
        <h3 style="margin:0 0 6px;">Connect a wearable</h3>
        <p style="color:var(--v2-text-dim);font-size:13px;margin:0 0 16px;">Live biometric integrations (Whoop / Fitbit / Terra) require OAuth credentials configured by the operator. Once wired, this dialog will hand off to the provider's consent screen.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="v2-btn">Whoop</button>
          <button class="v2-btn">Fitbit</button>
          <button class="v2-btn">Apple Health (via Terra)</button>
        </div>
        <div style="text-align:right;margin-top:16px;"><button class="v2-btn" id="v2-close-dlg">Close</button></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", e => {
      if (e.target === wrap || e.target.id === "v2-close-dlg") wrap.remove();
    });
  }

  // ---------- BOOT ----------
  function boot() {
    document.body.setAttribute("data-v2", "1");
    buildSidebar();
    buildTopbar();
    mountNewPanels();
    // Start with dashboard active in the sidebar
    const first = $('#v2-sidebar .v2-sb-btn[data-tab="dashboard"]');
    if (first) first.classList.add("active");

    // Biometric loop drives top-bar λ gauge
    tickBiometrics();
    setInterval(tickBiometrics, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
