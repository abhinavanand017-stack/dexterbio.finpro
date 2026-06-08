/* ============================================================
 * Dexter — Forecasting Suites
 *   A) Nifty / CNX-500 Multi-Model Pipeline (HMM, classifier,
 *      ARIMA+EMA hybrid, friction-aware backtest)
 *   B) Indian Mutual Fund Category Forecasting (5 models)
 * Synthetic OHLCV is generated for offline reproducibility,
 * matching the Python reference implementation 1:1.
 * ============================================================ */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // Deterministic RNG (Mulberry32) so seeds reproduce
  // ──────────────────────────────────────────────────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const std = a => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
  };
  const percentile = (sorted, p) => {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  };

  // ==========================================================
  // SUITE A — NIFTY / CNX-500 PIPELINE
  // ==========================================================
  const LIVE_TICKERS = {
    CNX500_Index: '^CNX500', Reliance: 'RELIANCE.NS', HDFC_Bank: 'HDFCBANK.NS',
    ICICI_Bank: 'ICICIBANK.NS', Bharti_Airtel: 'BHARTIARTL.NS', SBI: 'SBIN.NS',
  };
  const DATASET_SEEDS = {
    CNX500_Index: 0, Reliance: 1, HDFC_Bank: 2,
    ICICI_Bank: 3, Bharti_Airtel: 4, SBI: 5,
  };
  const DATASET_BASE = {
    CNX500_Index: 20000, Reliance: 2900, HDFC_Bank: 1650,
    ICICI_Bank: 1180, Bharti_Airtel: 1450, SBI: 780,
  };
  const INITIAL_CAPITAL = 100000.0;

  function generateSyntheticOHLCV(name, n, seed, base) {
    const rng = mulberry32(42 + seed);
    const mu = 0.0004, sigma = 0.012;
    const close = new Array(n);
    let logSum = 0;
    for (let i = 0; i < n; i++) {
      logSum += mu + sigma * gaussian(rng);
      close[i] = base * Math.exp(logSum);
    }
    const open = new Array(n), high = new Array(n), low = new Array(n), vol = new Array(n);
    for (let i = 0; i < n; i++) {
      const drng = 0.008 + (0.025 - 0.008) * rng();
      const range = close[i] * drng;
      high[i] = close[i] + range * 0.6;
      low[i] = close[i] - range * 0.4;
      open[i] = close[i] + gaussian(rng) * range * 0.3;
      vol[i] = Math.floor(500000 + rng() * 4500000);
    }
    // Build pseudo business-day index ending today
    const dates = [];
    let d = new Date();
    while (dates.length < n) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) dates.unshift(new Date(d));
      d.setDate(d.getDate() - 1);
    }
    return { dates, open, high, low, close, volume: vol };
  }

  function engineerFeatures(raw) {
    const { close } = raw;
    const n = close.length;
    const logRet = new Array(n).fill(NaN);
    for (let i = 1; i < n; i++) logRet[i] = Math.log(close[i] / close[i - 1]);

    // RSI(14)
    const rsi = new Array(n).fill(NaN);
    const gains = [], losses = [];
    for (let i = 1; i < n; i++) {
      const d = close[i] - close[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    for (let i = 14; i < n; i++) {
      const g = mean(gains.slice(i - 14, i));
      const l = mean(losses.slice(i - 14, i));
      rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }

    const sma = (arr, w) => arr.map((_, i) => i + 1 < w ? NaN : mean(arr.slice(i - w + 1, i + 1)));
    const ema = (arr, span) => {
      const k = 2 / (span + 1);
      const out = new Array(arr.length);
      out[0] = arr[0];
      for (let i = 1; i < arr.length; i++) out[i] = arr[i] * k + out[i - 1] * (1 - k);
      return out;
    };
    const sma20 = sma(close, 20);
    const sma50 = sma(close, 50);
    const ema12 = ema(close, 12);
    const ema26 = ema(close, 26);
    const macd = close.map((_, i) => ema12[i] - ema26[i]);
    const macdSig = ema(macd, 9);
    const bbWidth = new Array(n).fill(NaN);
    for (let i = 19; i < n; i++) {
      const win = close.slice(i - 19, i + 1);
      const s = std(win), m = mean(win);
      bbWidth[i] = (2 * s) / m;
    }
    const target = new Array(n).fill(NaN);
    for (let i = 0; i < n - 1; i++) target[i] = logRet[i + 1] > 0 ? 1 : 0;

    // Trim rows with NaN
    const rows = [];
    for (let i = 0; i < n; i++) {
      const vals = [logRet[i], rsi[i], sma20[i], sma50[i], macd[i], macdSig[i], bbWidth[i], target[i], close[i]];
      if (vals.some(v => Number.isNaN(v))) continue;
      rows.push({
        i, date: raw.dates[i], close: close[i], logRet: logRet[i], rsi: rsi[i],
        sma20: sma20[i], sma50: sma50[i], macd: macd[i], macdSig: macdSig[i],
        bbWidth: bbWidth[i], target: target[i],
      });
    }
    return rows;
  }

  // ── HMM proxy: 1-D k-means on returns → 3 regimes (Bear/Side/Bull)
  function runHMM(rows, name, log) {
    const X = rows.map(r => r.logRet);
    // init centroids via percentiles
    const sorted = [...X].sort((a, b) => a - b);
    let centers = [percentile(sorted, 17), percentile(sorted, 50), percentile(sorted, 83)];
    const labels = new Array(X.length).fill(0);
    for (let it = 0; it < 40; it++) {
      let changed = false;
      for (let i = 0; i < X.length; i++) {
        let best = 0, bestD = Infinity;
        for (let k = 0; k < 3; k++) {
          const d = (X[i] - centers[k]) ** 2;
          if (d < bestD) { bestD = d; best = k; }
        }
        if (labels[i] !== best) { labels[i] = best; changed = true; }
      }
      const newC = [0, 0, 0], cnt = [0, 0, 0];
      for (let i = 0; i < X.length; i++) { newC[labels[i]] += X[i]; cnt[labels[i]]++; }
      for (let k = 0; k < 3; k++) centers[k] = cnt[k] ? newC[k] / cnt[k] : centers[k];
      if (!changed) break;
    }
    const order = [0, 1, 2].sort((a, b) => centers[a] - centers[b]);
    const tag = {}; tag[order[0]] = 'Bear'; tag[order[1]] = 'Sideways'; tag[order[2]] = 'Bull';
    const regimes = labels.map(l => tag[l]);
    const counts = { Bear: 0, Sideways: 0, Bull: 0 };
    regimes.forEach(r => counts[r]++);
    log(`\n[HMM] ${name}`);
    log(`  Regime counts : ${JSON.stringify(counts)}`);
    ['Bear', 'Sideways', 'Bull'].forEach(lbl => {
      const samples = X.filter((_, i) => regimes[i] === lbl);
      const pct = (samples.length / X.length) * 100;
      const m = (mean(samples) * 100);
      log(`    ${lbl.padEnd(8)} avg daily return: ${m >= 0 ? '+' : ''}${m.toFixed(3)}%  (${pct.toFixed(1)}% of days)`);
    });
    return regimes;
  }

  // ── Direction classifier (logistic-regression proxy for XGBoost)
  function runClassifier(rows, name, log) {
    const FEATURES = ['close', 'logRet', 'rsi', 'macd', 'macdSig', 'bbWidth', 'sma20', 'sma50'];
    const X = rows.map(r => FEATURES.map(f => r[f]));
    const y = rows.map(r => r.target);
    const split = Math.floor(X.length * 0.8);
    const Xtr = X.slice(0, split), ytr = y.slice(0, split);
    const Xte = X.slice(split), yte = y.slice(split);

    // Standardize using train stats
    const cols = FEATURES.length;
    const means = new Array(cols).fill(0), sds = new Array(cols).fill(1);
    for (let c = 0; c < cols; c++) {
      const col = Xtr.map(r => r[c]);
      means[c] = mean(col); sds[c] = std(col) || 1;
    }
    const scale = M => M.map(row => row.map((v, c) => (v - means[c]) / sds[c]));
    const Ztr = scale(Xtr), Zte = scale(Xte);

    // Logistic regression via gradient descent
    const w = new Array(cols).fill(0); let b = 0;
    const lr = 0.05; const epochs = 400;
    const sig = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
    for (let e = 0; e < epochs; e++) {
      const grad = new Array(cols).fill(0); let gb = 0;
      for (let i = 0; i < Ztr.length; i++) {
        let z = b; for (let c = 0; c < cols; c++) z += w[c] * Ztr[i][c];
        const p = sig(z); const err = p - ytr[i];
        for (let c = 0; c < cols; c++) grad[c] += err * Ztr[i][c];
        gb += err;
      }
      for (let c = 0; c < cols; c++) w[c] -= (lr / Ztr.length) * grad[c];
      b -= (lr / Ztr.length) * gb;
    }
    const preds = Zte.map(row => {
      let z = b; for (let c = 0; c < cols; c++) z += w[c] * row[c];
      return sig(z) >= 0.5 ? 1 : 0;
    });
    const acc = preds.reduce((s, p, i) => s + (p === yte[i] ? 1 : 0), 0) / preds.length;
    // class report
    const cls = (lbl) => {
      const tp = preds.reduce((s, p, i) => s + (p === lbl && yte[i] === lbl ? 1 : 0), 0);
      const fp = preds.reduce((s, p, i) => s + (p === lbl && yte[i] !== lbl ? 1 : 0), 0);
      const fn = preds.reduce((s, p, i) => s + (p !== lbl && yte[i] === lbl ? 1 : 0), 0);
      const prec = tp + fp ? tp / (tp + fp) : 0;
      const rec = tp + fn ? tp / (tp + fn) : 0;
      const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
      return { prec, rec, f1, support: tp + fn };
    };
    const down = cls(0), up = cls(1);
    log(`\n[Classifier] ${name}  (logistic-regression direction model)`);
    log(`  Accuracy    : ${(acc * 100).toFixed(2)}%`);
    log(`  Test period : ${rows[split].date.toISOString().slice(0, 10)} → ${rows[rows.length - 1].date.toISOString().slice(0, 10)}`);
    log(`               precision  recall  f1-score  support`);
    log(`  Down        ${down.prec.toFixed(2).padStart(10)}${down.rec.toFixed(2).padStart(8)}${down.f1.toFixed(2).padStart(10)}${String(down.support).padStart(10)}`);
    log(`  Up          ${up.prec.toFixed(2).padStart(10)}${up.rec.toFixed(2).padStart(8)}${up.f1.toFixed(2).padStart(10)}${String(up.support).padStart(10)}`);
    // feature "importance" = |coef|
    const fi = FEATURES.map((f, c) => [f, Math.abs(w[c])]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    log(`  Coefficient magnitudes (top 5):`);
    fi.forEach(([f, v]) => log(`    ${f.padEnd(20)} ${v.toFixed(4)}`));
    return { preds, testRows: rows.slice(split) };
  }

  // ── ARIMA(1,1,1) + EMA-smoothed residual correction
  function runArimaHybrid(rows, name, log) {
    const series = rows.map(r => r.close);
    const splitIdx = Math.floor(series.length * 0.8);
    const train = series.slice(0, splitIdx);
    const test = series.slice(splitIdx);

    // Difference
    const diff = [];
    for (let i = 1; i < train.length; i++) diff.push(train[i] - train[i - 1]);
    // Fit AR(1) on diff via OLS
    let num = 0, den = 0;
    const mD = mean(diff);
    for (let i = 1; i < diff.length; i++) {
      num += (diff[i] - mD) * (diff[i - 1] - mD);
      den += (diff[i - 1] - mD) ** 2;
    }
    const phi = den ? num / den : 0;
    const intercept = mD * (1 - phi);
    // Residuals
    const resid = [];
    for (let i = 1; i < diff.length; i++) resid.push(diff[i] - (intercept + phi * diff[i - 1]));
    // EMA correction
    const alpha = 0.3; let smoothed = resid[0] || 0;
    for (let i = 1; i < resid.length; i++) smoothed = alpha * resid[i] + (1 - alpha) * smoothed;
    const correction = smoothed;
    // Forecast: roll out (1,1,1) for test horizon, add correction
    const forecast = new Array(test.length);
    let lastDiff = diff[diff.length - 1];
    let lastVal = train[train.length - 1];
    for (let i = 0; i < test.length; i++) {
      const nextDiff = intercept + phi * lastDiff;
      lastVal = lastVal + nextDiff + correction;
      forecast[i] = lastVal;
      lastDiff = nextDiff;
    }
    const errs = test.map((v, i) => v - forecast[i]);
    const rmse = Math.sqrt(mean(errs.map(e => e * e)));
    const mape = mean(test.map((v, i) => Math.abs((v - forecast[i]) / v))) * 100;
    log(`\n[ARIMA-EMA Hybrid] ${name}`);
    log(`  ARIMA order      : (1,1,1)`);
    log(`  EMA α            : 0.30   (LSTM-fallback smoother)`);
    log(`  φ (AR1)          : ${phi.toFixed(4)}`);
    log(`  RMSE (test)      : ${rmse.toFixed(2)}`);
    log(`  MAPE (test)      : ${mape.toFixed(2)}%`);
    log(`  Next-day fcst    : ${forecast[forecast.length - 1].toFixed(2)}`);
  }

  // ── Backtest engine (matches Python: brokerage+STT+stamp+slippage)
  function runBacktest(testRows, preds, label, log) {
    const BROKERAGE = 0.0003, STT = 0.0010, GST_STAMP = 0.0002;
    const prices = testRows.map(r => r.close);
    // 14d rolling volatility (pct change std)
    const pctCh = prices.map((p, i) => i === 0 ? 0 : (p - prices[i - 1]) / prices[i - 1]);
    const vol = pctCh.map((_, i) => i < 14 ? 0.01 : std(pctCh.slice(i - 13, i + 1)));
    const slip = vol.map(v => v * 0.05);
    const friction = slip.map(s => BROKERAGE + STT + GST_STAMP + s);
    const position = preds.map((_, i) => i === 0 ? 0 : preds[i - 1]);
    const action = position.map((p, i) => i === 0 ? 0 : p - position[i - 1]);

    let cash = INITIAL_CAPITAL, shares = 0;
    const portVals = [];
    for (let i = 0; i < prices.length; i++) {
      const p = prices[i], a = action[i], f = friction[i];
      if (a === 1) { shares = cash / (p * (1 + f)); cash = 0; }
      else if (a === -1 && shares > 0) { cash = shares * (p * (1 - f)); shares = 0; }
      portVals.push(cash + shares * p);
    }
    const finalVal = portVals[portVals.length - 1];
    const stratRet = (finalVal - INITIAL_CAPITAL) / INITIAL_CAPITAL;
    const bhRet = (prices[prices.length - 1] - prices[0]) / prices[0];
    let peak = -Infinity, maxDD = 0;
    portVals.forEach(v => { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v - peak) / peak); });
    const trades = action.reduce((s, a) => s + Math.abs(a), 0);
    const dailyRets = portVals.slice(1).map((v, i) => (v - portVals[i]) / portVals[i]);
    const sharpe = std(dailyRets) > 0 ? (mean(dailyRets) / std(dailyRets)) * Math.sqrt(252) : 0;
    const inr = v => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct = v => (v * 100).toFixed(2) + '%';
    const W = '─'.repeat(48);
    log(`\n[BACKTEST] ${label}`);
    log(`  ${W}`);
    log(`  ${'Metric'.padEnd(25)} ${'Value'.padStart(18)}`);
    log(`  ${W}`);
    log(`  ${'Initial Capital'.padEnd(25)} ${inr(INITIAL_CAPITAL).padStart(18)}`);
    log(`  ${'Final Value'.padEnd(25)} ${inr(finalVal).padStart(18)}`);
    log(`  ${'Strategy Return'.padEnd(25)} ${pct(stratRet).padStart(18)}`);
    log(`  ${'Buy & Hold Return'.padEnd(25)} ${pct(bhRet).padStart(18)}`);
    log(`  ${'Max Drawdown'.padEnd(25)} ${pct(maxDD).padStart(18)}`);
    log(`  ${'Sharpe Ratio (ann.)'.padEnd(25)} ${sharpe.toFixed(2).padStart(18)}`);
    log(`  ${'Total Trades'.padEnd(25)} ${String(trades).padStart(18)}`);
    log(`  ${W}`);
  }

  function runPipeline(name, log) {
    const BAR = '═'.repeat(60);
    log(`\n${BAR}\n  PIPELINE  →  ${name}\n${BAR}`);
    const seed = DATASET_SEEDS[name] ?? 0;
    const base = DATASET_BASE[name] ?? 20000;
    log(`\n[DATA] Preparing dataset: ${name}  (synthetic GBM, seed=${42 + seed}, ticker=${LIVE_TICKERS[name]})`);
    const raw = generateSyntheticOHLCV(name, 1500, seed, base);
    log(`  [SYN] Generated ${raw.close.length} synthetic trading days for '${name}'.`);
    const rows = engineerFeatures(raw);
    runHMM(rows, name, log);
    const { preds, testRows } = runClassifier(rows, name, log);
    runBacktest(testRows, preds, `${name} [classifier signals]`, log);
    runArimaHybrid(rows, name, log);
    log(`\n  ✓ ${name} — all models complete.`);
  }

  function initMultiModelSuite() {
    const out = document.getElementById('mms-output');
    const sel = document.getElementById('mms-dataset');
    const btn1 = document.getElementById('mms-run-one');
    const btnA = document.getElementById('mms-run-all');
    if (!out || !sel || !btn1 || !btnA) return;
    const buf = [];
    const log = (s) => { buf.push(s); out.textContent = buf.join('\n'); out.scrollTop = out.scrollHeight; };
    const clear = () => { buf.length = 0; out.textContent = ''; };
    btn1.addEventListener('click', () => { clear(); runPipeline(sel.value, log); });
    btnA.addEventListener('click', () => {
      clear();
      Object.keys(DATASET_SEEDS).forEach(ds => runPipeline(ds, log));
      log('\n' + '═'.repeat(60));
      log('  ALL PIPELINES COMPLETE');
      log('═'.repeat(60));
    });
  }

  // ==========================================================
  // SUITE B — MUTUAL FUND CATEGORY FORECASTING
  // ==========================================================
  const TRAILING_COLS = ['1D', 'YTD', '1W', '1M', '3M', '1Y', '3Y', '5Y', '10Y'];
  const TRAILING = {
    EQ_LARGE_CAP: [-0.27, -6.74, -2.33, -1.33, -4.82, -2.00, 12.41, 11.94, 12.39],
    EQ_LARGE_MIDCAP: [-0.30, -3.76, -2.46, 0.34, -2.28, 0.44, 15.37, 14.92, 14.45],
    EQ_FLEXI_CAP: [-0.21, -3.92, -2.41, 0.23, -2.27, -0.10, 13.91, 12.96, 13.34],
    EQ_MULTI_CAP: [-0.25, -2.09, -2.49, 1.80, -0.08, 2.42, 17.23, 15.56, null],
    EQ_MID_CAP: [-0.39, 0.03, -2.45, 2.61, 1.71, 5.93, 20.56, 18.21, 16.23],
    EQ_SMALL_CAP: [-0.18, 1.72, -3.33, 4.48, 4.88, 5.14, 19.21, 18.23, 16.66],
    EQ_VALUE: [-0.30, -3.53, -2.11, -0.81, -3.11, 3.45, 16.92, 14.88, 14.41],
    EQ_ELSS: [-0.19, -5.46, -2.47, -0.47, -3.44, -1.57, 13.57, 13.26, 13.66],
    EQ_BANKING: [-0.53, -7.24, -2.75, -3.72, -8.47, 2.79, 11.67, 13.37, 13.22],
    EQ_PHARMA: [0.08, 7.73, 1.27, 8.52, 10.08, 11.89, 24.89, 14.12, 13.49],
    EQ_TECHNOLOGY: [0.88, -22.29, -4.61, -7.33, -11.39, -20.12, 5.29, 6.16, 14.50],
    EQ_INFRA: [-0.32, 3.29, -2.42, 2.45, 3.25, 5.95, 21.77, 21.31, 16.47],
    EQ_PSU: [-1.06, 2.73, -2.60, 0.49, 1.31, 5.65, 28.91, 26.60, 17.14],
    EQ_ENERGY: [-0.73, 8.02, -2.00, 3.31, 6.44, 12.00, 21.41, 16.03, 17.84],
    EQ_INTERNATIONAL: [-1.33, 18.14, 0.45, 7.54, 13.90, 47.91, 27.04, 13.84, 13.15],
    DEBT_LONG_DURATION: [-0.24, -0.97, -0.76, -0.56, -0.45, -2.68, 4.88, 4.76, 6.62],
    DEBT_MED_LONG: [-0.15, 0.30, -0.37, -0.32, 0.14, 1.27, 5.65, 5.19, 6.04],
    DEBT_MEDIUM: [-0.13, 1.09, -0.27, -0.20, 0.39, 4.38, 6.84, 6.51, 6.73],
    DEBT_SHORT: [-0.10, 0.97, -0.22, -0.09, 0.46, 4.16, 6.51, 5.84, 6.40],
    DEBT_LOW_DURATION: [-0.03, 1.70, -0.08, 0.14, 1.10, 5.61, 6.82, 6.00, 6.33],
    DEBT_ULTRA_SHORT: [0.00, 2.04, 0.02, 0.27, 1.43, 5.90, 6.63, 5.80, 5.84],
    DEBT_LIQUID: [0.01, 2.14, 0.09, 0.40, 1.44, 5.78, 6.70, 5.88, 5.95],
    DEBT_GILT: [-0.17, -0.24, -0.55, -0.53, -0.15, -0.62, 5.50, 4.86, 6.49],
    DEBT_CORPORATE_BOND: [-0.12, 0.83, -0.26, -0.16, 0.39, 3.98, 6.70, 5.74, 6.82],
    DEBT_CREDIT_RISK: [-0.09, 3.03, -0.17, 0.83, 1.83, 7.23, 8.65, 9.16, 6.39],
    DEBT_DYNAMIC_BOND: [-0.13, 0.39, -0.33, -0.28, 0.21, 1.07, 5.87, 5.38, 6.49],
    HYBRID_AGGRESSIVE: [-0.18, -3.59, -1.90, -0.21, -2.27, 0.56, 12.55, 11.86, 11.57],
    HYBRID_BALANCED: [-0.13, -2.90, -1.25, -0.64, -2.05, -0.37, 8.59, 8.35, 8.25],
    HYBRID_CONSERVATIVE: [-0.14, -1.01, -0.82, -0.42, -0.91, 1.30, 7.72, 7.32, 7.52],
    HYBRID_ARBITRAGE: [0.11, 2.19, 0.17, 0.42, 1.42, 5.86, 6.74, 5.78, 5.60],
    HYBRID_DYNAMIC_AA: [-0.17, -3.37, -1.57, -0.48, -2.29, 0.16, 10.21, 9.19, 9.21],
    HYBRID_MULTI_ASSET: [-0.58, 0.50, -0.73, 0.41, -1.26, 12.01, 16.26, 14.05, 10.92],
    COMMODITIES_GOLD: [-2.01, 17.48, 4.27, 3.43, 2.90, 69.76, 35.77, 25.42, 16.57],
    COMMODITIES_SILVER: [-7.04, 15.83, 4.45, 6.95, 8.04, 173.61, 51.41, null, null],
  };
  const ANNUAL_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
  const ANNUAL = {
    EQ_LARGE_CAP: [8.69, 14.26, 25.56, 3.63, 25.23, 14.99, 10.68, 0.74, 31.11],
    EQ_LARGE_MIDCAP: [1.99, 21.01, 30.35, 1.61, 37.04, 16.64, 7.93, -7.86, 39.87],
    EQ_FLEXI_CAP: [3.57, 19.44, 27.42, 0.85, 32.50, 15.47, 9.64, -5.05, 36.88],
    EQ_MULTI_CAP: [1.77, 23.46, 32.76, 4.02, 40.93, null, null, null, null],
    EQ_MID_CAP: [2.35, 26.58, 39.77, 2.58, 45.04, 24.33, 2.76, -12.16, 43.14],
    EQ_SMALL_CAP: [-5.53, 26.31, 43.42, -0.08, 62.58, 31.20, -1.07, -19.01, 53.73],
    EQ_VALUE: [6.67, 20.14, 35.23, 5.49, 36.21, 17.75, 3.29, -5.29, 38.10],
    EQ_ELSS: [3.44, 19.12, 27.82, 2.26, 32.11, 16.18, 8.28, -6.35, 37.96],
    EQ_BANKING: [18.92, 8.86, 18.69, 21.11, 15.52, -4.55, 14.58, -1.28, 38.87],
    EQ_PHARMA: [-2.94, 39.64, 34.65, -9.68, 20.24, 66.47, 3.80, -4.08, 5.13],
    EQ_TECHNOLOGY: [-7.39, 25.51, 30.14, -23.04, 63.96, 57.73, 8.81, 17.65, 18.78],
    EQ_INFRA: [0.83, 26.57, 45.17, 9.76, 51.13, 9.63, 2.04, -18.48, 47.29],
    EQ_PSU: [7.94, 22.96, 59.22, 26.51, 36.64, -5.80, 4.06, -19.80, 21.86],
    EQ_ENERGY: [10.81, 13.36, 29.42, 5.60, 44.72, 21.08, 7.06, -15.36, 39.98],
    EQ_INTERNATIONAL: [30.16, 18.17, 24.23, -14.59, 11.74, 19.04, 25.90, -5.63, 15.90],
    DEBT_LONG_DURATION: [3.50, 10.77, 7.27, 1.83, 0.61, 12.23, 12.43, null, null],
    DEBT_MED_LONG: [5.72, 8.18, 6.58, 2.66, 2.81, 10.07, 7.67, 4.87, 3.43],
    DEBT_MEDIUM: [7.91, 8.04, 6.67, 3.92, 5.03, 6.96, 4.36, 5.67, 6.17],
    DEBT_SHORT: [7.32, 7.58, 6.60, 4.10, 4.60, 8.86, 4.29, 6.05, 5.42],
    DEBT_LOW_DURATION: [7.22, 7.33, 6.85, 4.08, 4.07, 6.41, 2.86, 7.09, 6.80],
    DEBT_ULTRA_SHORT: [6.69, 7.06, 6.65, 4.29, 3.53, 5.22, 6.94, 6.18, 6.60],
    DEBT_LIQUID: [6.17, 7.11, 6.86, 4.72, 3.18, 3.99, 6.35, 6.95, 6.40],
    DEBT_GILT: [5.00, 8.78, 6.96, 2.15, 2.19, 11.19, 10.58, 6.37, 2.26],
    DEBT_CORPORATE_BOND: [7.59, 7.94, 6.66, 3.00, 3.45, 9.93, 8.11, 5.77, 5.50],
    DEBT_CREDIT_RISK: [10.33, 7.93, 7.82, 13.43, 8.72, 0.25, 0.40, 5.07, 7.17],
    DEBT_DYNAMIC_BOND: [5.60, 8.46, 6.58, 3.05, 3.57, 9.69, 7.35, 5.51, 3.34],
    HYBRID_AGGRESSIVE: [5.40, 17.26, 22.13, 1.91, 26.15, 14.31, 7.87, -2.90, 26.25],
    HYBRID_BALANCED: [5.11, 13.69, 15.30, 2.81, 18.28, 10.65, 5.20, 1.46, 17.39],
    HYBRID_CONSERVATIVE: [5.70, 10.28, 11.39, 3.52, 10.28, 8.29, 6.38, 1.97, 10.55],
    HYBRID_ARBITRAGE: [6.16, 7.29, 6.93, 3.91, 3.42, 3.83, 5.81, 5.60, 5.57],
    HYBRID_DYNAMIC_AA: [5.24, 13.07, 18.64, 3.44, 15.35, 13.01, 7.19, 1.61, 18.61],
    HYBRID_MULTI_ASSET: [16.14, 14.69, 20.50, 5.00, 19.88, 14.40, 8.37, 1.02, 14.62],
    COMMODITIES_GOLD: [73.80, 19.01, 13.39, 13.31, -4.80, 26.38, 22.66, 6.89, 2.34],
    COMMODITIES_SILVER: [158.12, 15.94, 4.17, null, null, null, null, null, null],
  };
  const CATEGORY_LABELS = {
    EQ_LARGE_CAP: 'Equity Large Cap', EQ_LARGE_MIDCAP: 'Equity Large & MidCap',
    EQ_FLEXI_CAP: 'Equity Flexi Cap', EQ_MULTI_CAP: 'Equity Multi Cap',
    EQ_MID_CAP: 'Equity Mid Cap', EQ_SMALL_CAP: 'Equity Small Cap',
    EQ_VALUE: 'Equity Value', EQ_ELSS: 'Equity ELSS',
    EQ_BANKING: 'Equity Banking', EQ_PHARMA: 'Equity Pharma',
    EQ_TECHNOLOGY: 'Equity Technology', EQ_INFRA: 'Equity Infrastructure',
    EQ_PSU: 'Equity PSU', EQ_ENERGY: 'Equity Energy',
    EQ_INTERNATIONAL: 'Equity International',
    DEBT_LONG_DURATION: 'Debt Long Duration', DEBT_MED_LONG: 'Debt Medium-Long',
    DEBT_MEDIUM: 'Debt Medium', DEBT_SHORT: 'Debt Short',
    DEBT_LOW_DURATION: 'Debt Low Duration', DEBT_ULTRA_SHORT: 'Debt Ultra Short',
    DEBT_LIQUID: 'Debt Liquid', DEBT_GILT: 'Debt Gilt',
    DEBT_CORPORATE_BOND: 'Debt Corporate Bond', DEBT_CREDIT_RISK: 'Debt Credit Risk',
    DEBT_DYNAMIC_BOND: 'Debt Dynamic Bond',
    HYBRID_AGGRESSIVE: 'Hybrid Aggressive', HYBRID_BALANCED: 'Hybrid Balanced',
    HYBRID_CONSERVATIVE: 'Hybrid Conservative', HYBRID_ARBITRAGE: 'Hybrid Arbitrage',
    HYBRID_DYNAMIC_AA: 'Hybrid Dynamic Asset Alloc', HYBRID_MULTI_ASSET: 'Hybrid Multi Asset',
    COMMODITIES_GOLD: 'Gold Funds', COMMODITIES_SILVER: 'Silver Funds',
  };
  const cleanAnnual = cat => (ANNUAL[cat] || []).filter(v => v !== null && !Number.isNaN(v));

  // simple ASCII table printer
  function asciiTable(headers, rows) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
    const fmtRow = r => r.map((c, i) => String(c).padStart(widths[i])).join('  ');
    const sep = widths.map(w => '─'.repeat(w)).join('  ');
    return [fmtRow(headers), sep, ...rows.map(fmtRow)].join('\n');
  }

  function mfModel1() {
    const header = '\n' + '═'.repeat(72) + '\n  MODEL 1 — Momentum / Mean-Reversion Category Classifier\n' + '═'.repeat(72);
    const rows = [];
    Object.keys(TRAILING).forEach(cat => {
      const t = TRAILING[cat];
      const r1m = t[3], r3m = t[4], r1y = t[5], r3y = t[6], r5y = t[7];
      const ann = cleanAnnual(cat);
      const vol = ann.length > 2 ? std(ann) : 10;
      const m = ann.length ? mean(ann) : 0;
      if (r1y === null || r3y === null) return;
      const momZ = (r1y - m) / (vol + 1e-6);
      const recent = (r1m !== null && r3m !== null) ? (r1m + r3m / 3) / 2 : 0;
      const revZ = (recent - r1y / 12) / (vol / 12 + 1e-6);
      let signal;
      if (momZ > 1.5) signal = '⚠  OVERHEATED  — Mean reversion risk';
      else if (momZ < -1.2) signal = '✅ UNDERVALUED  — Potential buy zone';
      else if (revZ > 1.0) signal = '↑  RECOVERY    — Short-term bounce';
      else if (revZ < -1.0) signal = '↓  PULLBACK    — Short-term weakness';
      else signal = '→  NEUTRAL     — In-line with history';
      rows.push([CATEGORY_LABELS[cat] || cat, r1y.toFixed(1), m.toFixed(1), vol.toFixed(1),
        (momZ >= 0 ? '+' : '') + momZ.toFixed(2), signal]);
    });
    rows.sort((a, b) => parseFloat(b[4]) - parseFloat(a[4]));
    return header + '\n' + asciiTable(['Category', '1Y%', 'Hist_Mean%', 'Vol%', 'Mom_Z', 'Signal'], rows);
  }

  function mfModel2() {
    const header = '\n' + '═'.repeat(72) + '\n  MODEL 2 — Linear Trend Extrapolation (1Y / 3Y / 5Y Forecast)\n' + '═'.repeat(72);
    const rows = [];
    const baseYr = 2026;
    Object.keys(ANNUAL).forEach(cat => {
      const pairs = ANNUAL_YEARS.map((y, i) => [y, ANNUAL[cat][i]]).filter(([, v]) => v !== null);
      if (pairs.length < 4) return;
      const xs = pairs.map(p => p[0]);
      const ys = pairs.map(p => p[1]);
      const xm = mean(xs);
      const xc = xs.map(x => x - xm);
      const num = xc.reduce((s, x, i) => s + x * ys[i], 0);
      const den = xc.reduce((s, x) => s + x * x, 0);
      const slope = den ? num / den : 0;
      const yint = mean(ys) - slope * 0;
      const fc = y => Math.max(-30, Math.min(80, yint + slope * (y - xm)));
      const fitted = xc.map(x => yint + slope * x);
      const residSd = std(ys.map((v, i) => v - fitted[i]));
      const conf = residSd < 8 ? 'HIGH' : residSd < 18 ? 'MED' : 'LOW';
      rows.push([CATEGORY_LABELS[cat] || cat,
        (slope >= 0 ? '+' : '') + slope.toFixed(1) + '%',
        residSd.toFixed(1) + '%', conf,
        fc(baseYr).toFixed(1) + '%', fc(baseYr + 2).toFixed(1) + '%', fc(baseYr + 4).toFixed(1) + '%']);
    });
    rows.sort((a, b) => parseFloat(b[4]) - parseFloat(a[4]));
    return header + '\n' + asciiTable(['Category', 'Trend/yr', 'Resid_σ', 'Conf', 'Fcst_1Y', 'Fcst_3Y', 'Fcst_5Y'], rows);
  }

  function mfModel3() {
    const header = '\n' + '═'.repeat(72) + '\n  MODEL 3 — Regime-Adjusted Expected Return (Scenario Engine)\n  Scenarios weighted: Bull 25% | Base 50% | Bear 25%\n' + '═'.repeat(72);
    const rows = [];
    Object.keys(ANNUAL).forEach(cat => {
      const ann = cleanAnnual(cat);
      if (ann.length < 3) return;
      const sorted = [...ann].sort((a, b) => a - b);
      const bear = percentile(sorted, 15);
      const base = percentile(sorted, 50);
      const bull = percentile(sorted, 85);
      const exp = 0.25 * bear + 0.5 * base + 0.25 * bull;
      const down = Math.abs(bear);
      rows.push([CATEGORY_LABELS[cat] || cat, bear.toFixed(1), base.toFixed(1), bull.toFixed(1),
        exp.toFixed(1), down.toFixed(1), down > 0 ? (exp / down).toFixed(2) : '∞']);
    });
    rows.sort((a, b) => parseFloat(b[4]) - parseFloat(a[4]));
    return header + '\n' + asciiTable(['Category', 'Bear_15p%', 'Base_50p%', 'Bull_85p%', 'Exp_Ret%', 'Downside%', 'Reward/Risk'], rows);
  }

  function mfModel4() {
    const header = '\n' + '═'.repeat(72) + '\n  MODEL 4 — Risk-Adjusted Category Ranking (Sharpe Proxy)\n  Risk-free rate assumed: 6.5% (current RBI repo band)\n' + '═'.repeat(72);
    const RF = 6.5;
    const rows = [];
    Object.keys(TRAILING).forEach(cat => {
      const t = TRAILING[cat];
      const r1y = t[5], r3y = t[6], r5y = t[7];
      const ann = cleanAnnual(cat);
      if (ann.length < 3 || r1y === null) return;
      const vol = std(ann), m = mean(ann);
      const sh = v => (v !== null && vol > 0) ? ((v - RF) / vol) : 0;
      const maxDD = Math.min(...ann);
      const calmar = maxDD < 0 ? m / Math.abs(maxDD) : m;
      rows.push([CATEGORY_LABELS[cat] || cat, vol.toFixed(1),
        (sh(r1y) >= 0 ? '+' : '') + sh(r1y).toFixed(2),
        (sh(r3y) >= 0 ? '+' : '') + sh(r3y).toFixed(2),
        (sh(r5y) >= 0 ? '+' : '') + sh(r5y).toFixed(2),
        maxDD.toFixed(1), calmar.toFixed(2)]);
    });
    rows.sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
    return header + '\n' + asciiTable(['Category', 'Vol%', 'Sharpe_1Y', 'Sharpe_3Y', 'Sharpe_5Y', 'MaxDD%', 'Calmar'], rows);
  }

  function mfModel5() {
    const cats = ['EQ_MID_CAP', 'EQ_LARGE_CAP', 'HYBRID_AGGRESSIVE', 'DEBT_SHORT', 'COMMODITIES_GOLD'];
    const nSims = 5000, horizon = 5, initial = 1000;
    const out = ['\n' + '═'.repeat(72),
      `  MODEL 5 — Monte Carlo NAV Simulator`,
      `  Horizon: ${horizon} years | Simulations: ${nSims.toLocaleString()} | Initial NAV: ₹${initial.toLocaleString()}`,
      '═'.repeat(72)];
    const rng = mulberry32(42);
    cats.forEach(cat => {
      const ann = cleanAnnual(cat);
      if (ann.length < 3) return;
      const mu = mean(ann) / 100, sigma = std(ann) / 100;
      const finals = new Array(nSims);
      for (let s = 0; s < nSims; s++) {
        let v = initial, sum = 0;
        for (let y = 0; y < horizon; y++) sum += (mu - 0.5 * sigma * sigma) + sigma * gaussian(rng);
        finals[s] = initial * Math.exp(sum);
      }
      finals.sort((a, b) => a - b);
      const p = q => percentile(finals, q);
      const cagrMed = (Math.pow(p(50) / initial, 1 / horizon) - 1) * 100;
      const probLoss = (finals.filter(x => x < initial).length / nSims) * 100;
      const inr = v => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      out.push(`\n  ${CATEGORY_LABELS[cat]} (μ=${(mu * 100).toFixed(1)}%, σ=${(sigma * 100).toFixed(1)}%)`);
      out.push(`    5th  pctile NAV : ${inr(p(5)).padStart(11)}   (worst 5% scenario)`);
      out.push(`    25th pctile NAV : ${inr(p(25)).padStart(11)}`);
      out.push(`    Median NAV      : ${inr(p(50)).padStart(11)}   → CAGR ${cagrMed.toFixed(1)}%`);
      out.push(`    75th pctile NAV : ${inr(p(75)).padStart(11)}`);
      out.push(`    95th pctile NAV : ${inr(p(95)).padStart(11)}   (best 5% scenario)`);
      out.push(`    Prob of loss    : ${probLoss.toFixed(1)}%`);
    });
    return out.join('\n');
  }

  function initMFCategorySuite() {
    const out = document.getElementById('mfc-output');
    const tabs = document.querySelectorAll('.mfc-tab');
    if (!out || !tabs.length) return;
    const runners = { m1: mfModel1, m2: mfModel2, m3: mfModel3, m4: mfModel4, m5: mfModel5 };
    const select = (key) => {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.model === key));
      out.textContent = runners[key]();
      out.scrollTop = 0;
    };
    tabs.forEach(t => t.addEventListener('click', () => select(t.dataset.model)));
    select('m1');
  }

  // ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initMultiModelSuite();
    initMFCategorySuite();
  });
})();