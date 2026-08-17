// ==UserScript==
// @name         COMO - Early Task In Order With Timer & Batcher Dashboard
// @namespace    https://github.com/uny2-ops
// @version      23.9.74
// @description  Sorts tasks in order by earliest Batch Target + Time Left column + Batcher Timer Dashboard
// @author       Ibrahim
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/*
// @match        https://na.store-management.f3.amazon.dev/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      drive.corp.amazon.com
// @connect      como-sync-default-rtdb.firebaseio.com
// ==/UserScript==

(function () {
  'use strict';

  /* Hidden eligibility / Missing Package probes load real job-details pages
     in same-origin iframes. NEVER start a second copy of this full userscript
     inside those probe frames. The Amazon page inside the frame still loads
     normally, but duplicate timers, observers and polling are prevented. */
  if (window.top !== window.self &&
      /[?&](?:cbtAfaProbe|cbtMissingQrProbe)=1(?:&|$)/.test(window.location.search)) return;

  var STORE_ID  = (window.location.href.split('store/')[1] || '').split('/')[0];
  var DRIVE_URL = 'https://drive.corp.amazon.com/view/jsermar@/COMO_Dashboard_BatchRate_NA.json?download=true';
  var COMO_BASE = 'https://como-operations-dashboard-iad.iad.proxy.amazon.com';

  var style = document.createElement('style');
  style.textContent = `
    /* ═══════════════════════════════════════════════════
       COMO DASHBOARD — Unified Design System v21.7
       Palette: Navy chrome · White body · Blue accent
       Data: tabular-nums mono for all rates/times
    ═══════════════════════════════════════════════════ */

    /* ── Design tokens ── */
    :root {
      --cb-navy:      #0d1b2a;
      --cb-navy2:     #162236;
      --cb-navy3:     #1e2f45;
      --cb-blue:      #2979ff;
      --cb-blue-dim:  #1a56cc;
      --cb-green:     #00c853;
      --cb-amber:     #ffab00;
      --cb-red:       #ff3d3d;
      --cb-text:      #1a2332;
      --cb-text2:     #4a5568;
      --cb-text3:     #8896a8;
      --cb-border:    #e2e8f0;
      --cb-row-alt:   #f7fafd;
      --cb-surface:   #ffffff;
      --cb-radius:    10px;
      --cb-mono:      "SF Mono", "Fira Code", "Consolas", monospace;
      --cb-sans:      -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }

    /* ── Time Left column (task sorting) — ORIGINAL, untouched ── */
    .etf-timeleft {
      font-size: 22px; font-weight: 600;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: none !important; border: none !important;
      padding: 0 !important; border-radius: 0 !important; white-space: nowrap;
    }
    .etf-timeleft.overdue  { color: #f85149; font-weight: 700; }
    .etf-timeleft.critical { color: #e3b341; }
    .etf-timeleft.ok       { color: #3fb950; }
    .etf-col-header {
      font-size: 18px; font-weight: 400; color: #333;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      white-space: nowrap; text-align: center; width: 100%; display: block;
    }
    .etf-col-cell { display: flex; align-items: center; justify-content: center; text-align: center; }

    /* ══════════════════════════════════════
       BATCHER TIMER PANEL — main board
    ══════════════════════════════════════ */
    #cbt-panel {
      width: 100%; background: var(--cb-surface);
      border: 1px solid var(--cb-border);
      border-radius: var(--cb-radius);
      box-shadow: 0 4px 20px rgba(13,27,42,0.10), 0 1px 4px rgba(13,27,42,0.06);
      font-family: var(--cb-sans); color: var(--cb-text);
      margin-bottom: 16px; overflow: hidden;
    }
    #cbt-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      background: #f0f4f8;
      border-bottom: 1px solid var(--cb-border);
    }
    #cbt-title {
      font-weight: 800; font-size: 16px; color: var(--cb-navy);
      letter-spacing: 0.04em; text-transform: uppercase;
      display: flex; align-items: center; gap: 8px;
      white-space: nowrap;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }
    #cbt-title::before {
      content: ''; display: inline-block; width: 3px; height: 18px;
      background: var(--cb-blue); border-radius: 2px;
    }
    #cbt-controls { display: flex; gap: 10px; align-items: center; }
    #cbt-controls span {
      cursor: pointer; color: var(--cb-text2); font-size: 13px; font-weight: 700;
      padding: 3px 7px; border-radius: 5px; transition: all 0.15s;
      border: 1px solid var(--cb-border);
    }
    #cbt-controls span:hover { background: var(--cb-blue); color: #fff; border-color: var(--cb-blue); }

    /* ── Stats bar ── */
    #cbt-stats-bar {
      display: flex; justify-content: stretch; align-items: stretch;
      flex-wrap: nowrap;
      background: #e8eef5; border-bottom: 1px solid var(--cb-border);
    }
    .cbt-stat-card {
      flex: 1 1 0; min-width: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 12px 8px; border-right: 1px solid var(--cb-border);
      position: relative; overflow: hidden;
    }
    .cbt-stat-card:last-child { border-right: none; }
    .cbt-stat-card::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: var(--cb-blue); opacity: 0.7;
    }
    .cbt-stat-icon { font-size: 18px; line-height: 1; margin-bottom: 4px; }
    .cbt-stat-label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
      color: #3a5068; margin-bottom: 5px;
      white-space: nowrap; overflow: hidden; text-overflow: clip;
    }
    .cbt-stat-value {
      font-size: 28px; font-weight: 900; color: var(--cb-navy);
      font-family: var(--cb-mono); line-height: 1; letter-spacing: -0.02em;
      display: flex; align-items: center; gap: 6px;
      white-space: nowrap;
    }
    #cbt-stat-dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
      background: #aaa; flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
      transition: background 0.3s, box-shadow 0.3s;
    }
    #cbt-stat-delta {
      display: none;
      flex-shrink: 0;
      font-size: 28px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0;
      white-space: nowrap;
    }
    #cbt-stat-delta.need-more { display: inline-block; color: #ff3d3d; }
    #cbt-stat-delta.extra     { display: inline-block; color: #3fb950; }

    /* ── Tabs ── */
    #cbt-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
    }
    .cbt-tab {
      flex: 1; text-align: center; padding: 9px 0; font-size: 11px;
      font-weight: 700; color: var(--cb-text2); cursor: pointer;
      white-space: nowrap;
      text-transform: uppercase; letter-spacing: 0.1em;
      border-bottom: 2px solid transparent; transition: all 0.15s;
      position: relative;
    }
    .cbt-tab:hover { color: var(--cb-navy); }
    .cbt-tab.active { color: var(--cb-blue); border-bottom-color: var(--cb-blue); }

    /* ── Body / table ── */
    #cbt-body {
      padding: 0; height: 350px; max-height: 350px; min-height: 350px;
      overflow-y: auto; background: var(--cb-surface);
      scrollbar-width: thin; scrollbar-color: var(--cb-border) transparent;
    }
    #cbt-body::-webkit-scrollbar { width: 5px; }
    #cbt-body::-webkit-scrollbar-track { background: transparent; }
    #cbt-body::-webkit-scrollbar-thumb { background: var(--cb-border); border-radius: 3px; }

    #cbt-table, #cbt-hist-table, #cbt-weekly-table, #cbt-names-table {
      width: 100%; border-collapse: collapse;
    }
    #cbt-hist-table, #cbt-weekly-table { table-layout: fixed; }

    /* TODAY: lock all five columns so Latest Avg is always visible. */
    #cbt-hist-table th:nth-child(1), #cbt-hist-table td:nth-child(1) { width: 36%; }
    #cbt-hist-table th:nth-child(2), #cbt-hist-table td:nth-child(2) { width: 13%; }
    #cbt-hist-table th:nth-child(3), #cbt-hist-table td:nth-child(3) { width: 15%; }
    #cbt-hist-table th:nth-child(4), #cbt-hist-table td:nth-child(4) { width: 17%; }
    #cbt-hist-table th:nth-child(5), #cbt-hist-table td:nth-child(5) { width: 19%; }

    #cbt-weekly-table th:first-child, #cbt-weekly-table td:first-child { width: 30%; }
    #cbt-table thead tr, #cbt-hist-table thead tr,
    #cbt-weekly-table thead tr, #cbt-names-table thead tr {
      border-bottom: 2px solid var(--cb-border);
      background: #f8fafc; position: sticky; top: 0; z-index: 1;
    }
    #cbt-table th, #cbt-hist-table th, #cbt-weekly-table th, #cbt-names-table th {
      color: var(--cb-text2); font-weight: 700; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.1em;
      padding: 8px 10px; text-align: left;
      background: #f8fafc;
    }
    #cbt-table th:not(:first-child), #cbt-hist-table th:not(:first-child),
    #cbt-weekly-table th:not(:first-child) { text-align: center; }

    #cbt-table td, #cbt-hist-table td, #cbt-weekly-table td, #cbt-names-table td {
      padding: 9px 10px; border-bottom: 1px solid var(--cb-border);
      vertical-align: middle; text-align: center;
      font-size: 14px; color: var(--cb-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: background 0.1s;
    }
    #cbt-table td:first-child, #cbt-hist-table td:first-child,
    #cbt-weekly-table td:first-child, #cbt-names-table td:first-child { text-align: left; }
    #cbt-table tbody tr:last-child td, #cbt-hist-table tbody tr:last-child td,
    #cbt-weekly-table tbody tr:last-child td, #cbt-names-table tbody tr:last-child td { border-bottom: none; }
    #cbt-table tbody tr:nth-child(even) td,
    #cbt-hist-table tbody tr:nth-child(even) td,
    #cbt-weekly-table tbody tr:nth-child(even) td,
    #cbt-names-table tbody tr:nth-child(even) td { background: var(--cb-row-alt); }
    #cbt-table tbody tr:hover td, #cbt-hist-table tbody tr:hover td,
    #cbt-weekly-table tbody tr:hover td, #cbt-names-table tbody tr:hover td {
      background: #edf2fb !important;
    }

    /* ── Data cells ── */
    .cbt-name-cell {
      font-size: 13px; font-weight: 700; color: var(--cb-text); cursor: pointer;
      transition: color 0.15s;
    }
    .cbt-name-cell:hover { color: var(--cb-blue); }
    .cbt-assoc {
      /* Locked metrics: a LOW row's name must render identically to every
         other name. Without a fixed line-height the inline LOW badge
         changes the row's line box and the name shifts size/position. */
      font-size: 14px !important; font-weight: 700 !important;
      letter-spacing: normal !important; line-height: 1.3 !important;
      font-family: var(--cb-sans) !important;
      color: var(--cb-text); cursor: pointer;
      display: inline-block; vertical-align: middle;
      transition: color 0.15s;
    }
    .cbt-assoc:hover { color: var(--cb-blue); }
    .cbt-ref { display: block; font-size: 10px; color: var(--cb-text3); font-family: var(--cb-mono); margin-top: 1px; }
    .cbt-elapsed {
      font-family: var(--cb-mono); font-size: 14px; font-weight: 700;
      font-variant-numeric: tabular-nums; color: var(--cb-green);
      background: rgba(0,200,83,0.08); border-radius: 4px;

      /* ONE identical geometry for green / yellow / red.
         Color is the only thing that changes between states. */
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 58px !important;
      min-width: 58px !important;
      max-width: 58px !important;
      height: 22px !important;
      min-height: 22px !important;
      max-height: 22px !important;
      padding: 0 !important;
      margin: 0 auto !important;
      text-align: center !important;
      line-height: 22px !important;
      box-sizing: border-box !important;
      position: static !important;
      transform: none !important;
    }
    .cbt-elapsed.warn { color: var(--cb-amber); background: rgba(255,171,0,0.1); }
    .cbt-elapsed.alert { color: var(--cb-red); background: rgba(255,61,61,0.1); }
    .cbt-rate {
      font-family: var(--cb-mono); font-size: 15px; font-weight: 800;
      font-variant-numeric: tabular-nums; color: var(--cb-green);
      display: inline-block;
    }
    .cbt-rate.warn { color: var(--cb-amber); }
    .cbt-rate.alert { color: var(--cb-red); }
    .cbt-rate.pending { color: var(--cb-text3); font-style: italic; font-weight: 400; font-size: 13px; }
    .cbt-hist-rate {
      font-family: var(--cb-mono); font-size: 15px; font-weight: 800;
      font-variant-numeric: tabular-nums;
      /* Fixed badge geometry: every green/amber/red rate uses the exact same
         box, and flex centering keeps the digits optically centered at every
         dashboard zoom level. */
      width: 38px; min-width: 38px; height: 24px;
      padding: 0 !important; border-radius: 4px;
      display: inline-flex !important;
      align-items: center; justify-content: center;
      line-height: 1 !important; text-align: center;
      box-sizing: border-box; vertical-align: middle;
    }
    .cbt-hist-rate.good  { color: #0a6e2e; background: rgba(0,200,83,0.1); }
    .cbt-hist-rate.warn  { color: #7a4f00; background: rgba(255,171,0,0.12); }
    .cbt-hist-rate.alert { color: #8b0000; background: rgba(255,61,61,0.1); }

    /* All three rate states use ONE identical centering rule.  The alert/red
       state intentionally has no special padding, transform, line-height or
       positioning; only its color/background differ from green and amber. */
    #cbt-panel .cbt-hist-rate.good,
    #cbt-panel .cbt-hist-rate.warn,
    #cbt-panel .cbt-hist-rate.alert {
      width: 38px !important;
      min-width: 38px !important;
      height: 24px !important;
      padding: 0 !important;
      margin: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      line-height: 1 !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      transform: none !important;
      position: static !important;
    }
    .cbt-hist-meta { font-size: 14px; font-weight: 600; color: var(--cb-text); font-variant-numeric: tabular-nums; }

    /* ── Rank badges ── */
    .cbt-rank {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 50%;
      font-size: 10px; font-weight: 800; margin-right: 6px;
      background: #e8ecf0; color: var(--cb-text2);
    }
    .cbt-rank.gold   { background: linear-gradient(135deg,#f6d365,#d4a017); color: #5a3800; }
    .cbt-rank.silver { background: linear-gradient(135deg,#d0d8e0,#9aabb8); color: #2a3540; }
    .cbt-rank.bronze { background: linear-gradient(135deg,#e8b97a,#b87333); color: #4a2000; }

    /* ── Slow batcher alert ── */
    .cbt-slow-alert {
      /* Compact badge directly beside the associate name. The Live row itself
         stays fixed-height, so this never makes a red row taller than others. */
      width: 52px; height: 16px; padding: 0 !important; margin: 0 !important;
      display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; flex: 0 0 52px; overflow: hidden;
      background: var(--cb-red); color: #fff;
      font-size: 9px; font-weight: 800; line-height: 1 !important;
      border-radius: 6px; vertical-align: middle;
      letter-spacing: 0.04em; text-transform: uppercase;
      box-shadow: 0 0 8px rgba(255,61,61,0.45);
      animation: cbt-slow-pulse 1.2s infinite;
    }
    @keyframes cbt-slow-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

    /* ── Summary bars (Today / Weekly) ── */
    #cbt-weekly-summary, #cbt-hist-summary {
      display: flex; justify-content: space-around;
      padding: 10px 6px 12px;
      border-bottom: 1px solid var(--cb-border);
      background: linear-gradient(180deg, #f8fafc 0%, var(--cb-surface) 100%);
    }
    .cbt-ws-stat { text-align: center; }
    .cbt-ws-val {
      font-family: var(--cb-mono); font-size: 20px; font-weight: 900;
      color: var(--cb-navy); display: block; font-variant-numeric: tabular-nums;
    }
    .cbt-ws-label {
      font-size: 9px; color: var(--cb-text3); text-transform: uppercase;
      letter-spacing: 0.12em; font-weight: 700;
    }

    /* ── Search bars ── */
    #cbt-weekly-search, #cbt-hist-search, #cbt-live-search {
      padding: 8px 8px 4px; background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-search-input, #cbt-hist-search-input, #cbt-live-search-input {
      flex: 1; padding: 7px 12px 7px 32px; background-color: var(--cb-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 11px center;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      color: var(--cb-text); font-size: 13px; outline: none;
      font-family: var(--cb-sans);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #cbt-search-input:focus, #cbt-hist-search-input:focus,
    #cbt-live-search-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(41,121,255,0.14);
    }
    #cbt-live-search-clear, #cbt-hist-search-clear, #cbt-weekly-search-clear {
      font-size: 13px; border: none; background: none;
      cursor: pointer; color: var(--cb-text3);
      width: 24px; height: 24px; padding: 0; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    #cbt-live-search-clear:hover, #cbt-hist-search-clear:hover,
    #cbt-weekly-search-clear:hover { color: var(--cb-red); background: rgba(255,61,61,0.1); }

    #cbt-live-results { margin-top: 0; }
    #cbt-hof-search,
    #cbt-names-search {
      padding: 8px 8px 4px; background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-hof-search-input,
    #cbt-names-search-input {
      flex: 1; padding: 7px 12px 7px 32px; background-color: var(--cb-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 11px center;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      color: var(--cb-text); font-size: 13px; outline: none;
      font-family: var(--cb-sans);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #cbt-hof-search-input:focus,
    #cbt-names-search-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(41,121,255,0.14);
    }
    #cbt-hof-search-clear,
    #cbt-names-search-clear {
      font-size: 13px; border: none; background: none;
      cursor: pointer; color: var(--cb-text3);
      width: 24px; height: 24px; padding: 0; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    #cbt-hof-search-clear:hover,
    #cbt-names-search-clear:hover { color: var(--cb-red); background: rgba(255,61,61,0.1); }


    /* ── One shared associate-name search for every dashboard tab ── */
    #cbt-unified-search {
      width: 100%; height: 50px; box-sizing: border-box;
      padding: 7px 9px; background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
      display: flex; align-items: center;
    }
    #cbt-unified-search-box {
      position: relative; width: 100%; height: 36px;
      display: flex; align-items: center; box-sizing: border-box;
    }
    #cbt-unified-search-input {
      width: 100%; height: 36px; box-sizing: border-box;
      padding: 7px 94px 7px 34px;
      background-color: var(--cb-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 11px center;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      color: var(--cb-text); font-size: 13px; outline: none;
      font-family: var(--cb-sans);
      transition: border-color .15s, box-shadow .15s;
    }
    #cbt-unified-search-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(41,121,255,.14);
    }
    #cbt-unified-search-count {
      position: absolute; right: 35px; top: 50%; transform: translateY(-50%);
      display: none; max-width: 58px; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; pointer-events: none;
      color: var(--cb-text3); font-size: 10px; font-weight: 700;
      font-family: var(--cb-mono); font-variant-numeric: tabular-nums;
    }
    #cbt-unified-search-clear {
      position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
      width: 25px; height: 25px; padding: 0; border: none; border-radius: 50%;
      background: transparent; color: var(--cb-text3); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 13px; line-height: 1;
      transition: color .15s, background .15s;
    }
    #cbt-unified-search-clear:hover { color: var(--cb-red); background: rgba(255,61,61,.1); }

    /* ── Search result sections ── */
    .cbt-search-result-section {
      font-size: 9px; font-weight: 800; color: var(--cb-text2);
      text-transform: uppercase; letter-spacing: 0.12em;
      padding: 7px 12px 5px; border-top: 2px solid var(--cb-blue);
      border-bottom: 1px solid var(--cb-border);
      background: linear-gradient(180deg,#f0f4ff,#f8fafc);
    }
    .cbt-search-row {
      display: table; width: 100%; padding: 0;
      border-bottom: 1px solid var(--cb-border);
      margin: 0; box-sizing: border-box; height: 38px;
      transition: background 0.1s;
    }
    .cbt-search-row:hover { background: #edf2fb; }
    .cbt-search-row-name {
      display: table-cell; width: 35%; font-size: 13px; font-weight: 700;
      color: var(--cb-text); text-align: left; vertical-align: middle;
      padding: 5px 4px 5px 12px; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; cursor: pointer; transition: color 0.15s;
    }
    .cbt-search-row-name:hover { color: var(--cb-blue) !important; }
    .cbt-search-row-mid {
      display: table-cell; width: 40%; font-size: 12px; color: var(--cb-text3);
      text-align: center; vertical-align: middle; padding: 5px 4px;
      font-family: var(--cb-mono); font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .cbt-search-row-rate {
      display: table-cell; width: 25%; font-size: 14px; font-weight: 800;
      text-align: right; vertical-align: middle;
      padding: 5px 12px 5px 4px; font-family: var(--cb-mono);
    }
    .cbt-search-row .cbt-hist-rate {
      font-size: 14px !important;
      display: inline-flex !important;
      align-items: center; justify-content: center;
      width: 38px; min-width: 38px; height: 24px;
      padding: 0 !important; line-height: 1 !important;
      text-align: center;
    }

    /* ── Sort headers ── */
    .cbt-sortable, .cbt-sortable-live, .cbt-sortable-hist {
      cursor: pointer; user-select: none; transition: color 0.15s;
    }
    .cbt-sortable:hover, .cbt-sortable-live:hover,
    .cbt-sortable-hist:hover { color: var(--cb-blue); }

    /* ── Empty / updated states ── */
    #cbt-empty, #cbt-hist-empty, #cbt-weekly-empty {
      display: none; text-align: center; color: var(--cb-text3);
      padding: 9px 0; font-style: italic; font-size: 13px; line-height: 1.2;
    }
    #cbt-updated { text-align: right; color: var(--cb-text3); font-size: 10px; padding: 4px 10px 6px; }

    /* ── Resize handle ── */
    #cbt-drag-bottom {
      width: 100%; height: 9px;
      background-color: #e6ecf3;
      background-image: radial-gradient(circle, #9fb2c6 1.1px, transparent 1.3px);
      background-size: 9px 9px; background-position: center; background-repeat: repeat-x;
      cursor: ns-resize; border-radius: 0 0 var(--cb-radius) var(--cb-radius);
      transition: background-color 0.2s; user-select: none;
    }
    #cbt-drag-bottom:hover { background-color: var(--cb-blue); }

    /* ── Font size controls ── */
    #cbt-font-dec, #cbt-font-inc { font-size: 12px !important; }

    /* ══════════════════════════════════════
       HEADER — pure white in both themes
    ══════════════════════════════════════ */
    #cbt-header { background: #FFFFFF !important; }
    #cbt-panel.dark #cbt-header {
      background: #FFFFFF !important;
      border-bottom: 1px solid #d9e0e8 !important;
    }
    /* header contents stay dark-on-white whichever theme is active */
    #cbt-panel.dark #cbt-title { color: var(--cb-navy) !important; }
    #cbt-panel.dark #cbt-title::before { background: var(--cb-blue) !important; }
    #cbt-panel.dark #cbt-controls span { color: var(--cb-text2) !important; border-color: #dbe2ea !important; }
    #cbt-panel.dark #cbt-controls span:hover {
      background: var(--cb-blue) !important; color: #fff !important; border-color: var(--cb-blue) !important;
    }

    /* ══════════════════════════════════════
       FORCE ASSIGN BUTTON
    ══════════════════════════════════════ */
    /* ══════════════════════════════════════
       SCRIPT UI IS NOT SELECTABLE
       Stops dashboard text becoming a QR code, and stops stray highlights
       while clicking around. Editable fields are exempt below so typing,
       caret movement and text editing all behave normally.
    ══════════════════════════════════════ */
    #cbt-panel, #cbt-tp, #cbt-qr-overlay, #cbt-afa-overlay, #cbt-ac-drop {
      -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
    }
    #cbt-panel input, #cbt-panel textarea,
    #cbt-tp input, #cbt-tp textarea,
    #cbt-qr-overlay input, #cbt-qr-overlay textarea,
    #cbt-afa-overlay input, #cbt-afa-overlay textarea,
    #cbt-ac-drop input {
      -webkit-user-select: text !important; -moz-user-select: text !important;
      -ms-user-select: text !important; user-select: text !important;
    }

    /* ══════════════════════════════════════
       FORCE ASSIGN BUTTON — white label in every state
    ══════════════════════════════════════ */
    #cbt-afa-btn, #cbt-panel.dark #cbt-afa-btn {
      /* identical metrics to the A− / % / A+ / theme controls beside it:
         same font size, same vertical padding, same radius, same border */
      display: inline-flex !important; align-items: center; justify-content: center;
      font-size: 13px !important; line-height: 1.35 !important;
      padding: 3px 9px !important; border-radius: 5px !important;
      box-sizing: border-box; vertical-align: middle;
      background: linear-gradient(180deg, #3d87ff 0%, #2979ff 100%) !important;
      color: #FFFFFF !important; border: 1px solid #1f63d6 !important;
      font-weight: 700 !important; letter-spacing: .02em;
      white-space: nowrap; cursor: pointer;
      box-shadow: 0 1px 2px rgba(13,27,42,.16);
      transition: background .15s, box-shadow .15s, transform .1s;
    }
    #cbt-afa-btn:hover, #cbt-panel.dark #cbt-afa-btn:hover {
      background: linear-gradient(180deg, #2f7cf5 0%, #1f63d6 100%) !important;
      border-color: #1a54b8 !important; color: #FFFFFF !important;
      box-shadow: 0 3px 10px rgba(41,121,255,.38);
      transform: translateY(-1px);
    }
    #cbt-afa-btn:active, #cbt-panel.dark #cbt-afa-btn:active {
      transform: translateY(0); color: #FFFFFF !important;
      background: linear-gradient(180deg, #2569d8 0%, #1c58bd 100%) !important;
      box-shadow: 0 1px 2px rgba(13,27,42,.2);
    }
    /* running: deep amber so white stays legible on it */
    #cbt-afa-btn.busy, #cbt-panel.dark #cbt-afa-btn.busy,
    #cbt-afa-btn.busy:hover, #cbt-panel.dark #cbt-afa-btn.busy:hover {
      background: linear-gradient(180deg, #c8790a 0%, #a35c00 100%) !important;
      border-color: #8a4e00 !important; color: #FFFFFF !important;
    }
    /* finished cleanly */
    #cbt-afa-btn.ok, #cbt-panel.dark #cbt-afa-btn.ok {
      background: linear-gradient(180deg, #1f8f4a 0%, #16713a 100%) !important;
      border-color: #115c2f !important; color: #FFFFFF !important;
    }
    /* unavailable */
    #cbt-afa-btn.off, #cbt-panel.dark #cbt-afa-btn.off {
      background: linear-gradient(180deg, #8a97a6 0%, #6f7d8c 100%) !important;
      border-color: #5d6a78 !important; color: #FFFFFF !important;
      cursor: default; box-shadow: none; transform: none;
    }
    /* Nothing may fade or darken this label: covers every state, every
       descendant, inherited fills, opacity and text-shadow. */
    #cbt-afa-btn,
    #cbt-afa-btn *,
    #cbt-afa-btn:hover, #cbt-afa-btn:hover *,
    #cbt-afa-btn:active, #cbt-afa-btn:active *,
    #cbt-afa-btn:focus, #cbt-afa-btn:focus *,
    #cbt-afa-btn:focus-visible, #cbt-afa-btn:focus-visible *,
    #cbt-afa-btn:focus-within, #cbt-afa-btn:focus-within *,
    #cbt-afa-btn.busy, #cbt-afa-btn.busy *,
    #cbt-afa-btn.ok,   #cbt-afa-btn.ok *,
    #cbt-afa-btn.off,  #cbt-afa-btn.off *,
    #cbt-afa-btn[disabled], #cbt-afa-btn[disabled] *,
    #cbt-panel.dark #cbt-afa-btn, #cbt-panel.dark #cbt-afa-btn *,
    #cbt-panel.dark #cbt-afa-btn:hover, #cbt-panel.dark #cbt-afa-btn:hover *,
    #cbt-panel.dark #cbt-afa-btn:active, #cbt-panel.dark #cbt-afa-btn:active *,
    #cbt-panel.dark #cbt-afa-btn:focus, #cbt-panel.dark #cbt-afa-btn:focus *,
    #cbt-panel.dark #cbt-afa-btn.busy, #cbt-panel.dark #cbt-afa-btn.busy *,
    #cbt-panel.dark #cbt-afa-btn.ok,   #cbt-panel.dark #cbt-afa-btn.ok *,
    #cbt-panel.dark #cbt-afa-btn.off,  #cbt-panel.dark #cbt-afa-btn.off * {
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
      opacity: 1 !important;
      text-shadow: none !important;
      filter: none !important;
    }
    #cbt-afa-btn:focus-visible { outline: 2px solid #FFFFFF; outline-offset: 2px; }
    #cbt-afa-btn .cbt-afa-lbl { line-height: 1; }

    /* ══════════════════════════════════════
       NIGHT MODE — Force Assign popup
    ══════════════════════════════════════ */
    #cbt-afa-overlay.cbt-dark #cbt-afa-card {
      background: #0d1117; box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4);
    }
    #cbt-afa-overlay.cbt-dark #cbt-afa-head {
      background: linear-gradient(135deg,#0d1117,#161b22); border-bottom-color: #21262d;
    }
    #cbt-afa-overlay.cbt-dark #cbt-afa-title { color: #e6edf3; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-title::before { background: #58a6ff; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-x { color: #6e7b8d; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-x:hover { color: #f85149; background: rgba(248,81,73,.14); }
    #cbt-afa-overlay.cbt-dark #cbt-afa-body { color: #c9d1d9; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-lead b { color: #e6edf3; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-list { background: #161b22; border-color: #21262d; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-row { border-bottom-color: #21262d; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-ref { color: #e6edf3; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-msg { color: #8b99aa; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-row.ok   .cbt-afa-msg { color: #3fb950; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-row.bad  .cbt-afa-msg { color: #f85149; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-row.skip .cbt-afa-msg { color: #e3b341; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-warn {
      background: rgba(227,179,65,.12); border-color: rgba(227,179,65,.45); color: #e3b341;
    }
    #cbt-afa-overlay.cbt-dark #cbt-afa-bar { background: #21262d; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-fill { background: #58a6ff; }
    #cbt-afa-overlay.cbt-dark #cbt-afa-foot { background: #161b22; border-top-color: #21262d; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-act {
      background: #161b22; border-color: #30363d; color: #c9d1d9;
    }
    #cbt-afa-overlay.cbt-dark .cbt-afa-act:hover { background: #21262d; border-color: #3d444d; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-act.go {
      background: #1f6feb; border-color: #1f6feb; color: #fff;
    }
    #cbt-afa-overlay.cbt-dark .cbt-afa-act.go:hover { background: #388bfd; border-color: #388bfd; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-act.stop { background: #da3633; border-color: #da3633; color: #fff; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-action-block {
      background: #161b22; border-color: #30363d;
    }
    #cbt-afa-overlay.cbt-dark .cbt-afa-action-copy { color: #8b99aa; }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-tile {
      background: #161b22;
      border-color: #30363d;
    }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-kind,
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-summary { color: #8b99aa; }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-value {
      background: #0d1117;
      color: #e6edf3;
    }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-count { color: #e6edf3; }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-nav-btn {
      background: #161b22;
      border-color: #30363d;
      color: #e6edf3;
    }
    #cbt-afa-overlay.cbt-dark .cbt-missing-qr-nav-btn:hover {
      border-color: #58a6ff;
      color: #58a6ff;
      background: #0d1117;
    }
    #cbt-afa-overlay.cbt-dark .cbt-afa-opt {
      background: #161b22; border-color: #30363d; color: #c9d1d9;
    }
    #cbt-afa-overlay.cbt-dark .cbt-afa-opt:hover { background: #1c2333; border-color: #58a6ff; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-opt.off:hover { background: #161b22; border-color: #30363d; }
    #cbt-afa-overlay.cbt-dark .cbt-afa-note { color: #8b99aa; }

    /* ══════════════════════════════════════
       NIGHT MODE — Search by Name dropdown
    ══════════════════════════════════════ */
    #cbt-ac-drop.cbt-dark {
      background: #0d1117; border-color: #21262d;
      box-shadow: 0 12px 36px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4);
      scrollbar-color: #21262d transparent;
    }
    #cbt-ac-drop.cbt-dark::-webkit-scrollbar-thumb { background: #21262d; }
    #cbt-ac-drop.cbt-dark .cbt-ac-hd {
      background: linear-gradient(180deg,#1a2233,#161b22);
      border-bottom-color: #21262d; color: #8faac0;
    }
    #cbt-ac-drop.cbt-dark .cbt-ac-item { border-bottom-color: #21262d; }
    #cbt-ac-drop.cbt-dark .cbt-ac-item:hover,
    #cbt-ac-drop.cbt-dark .cbt-ac-item.on { background: #1c2333; box-shadow: inset 3px 0 0 #58a6ff; }
    #cbt-ac-drop.cbt-dark .cbt-ac-nm { color: #c9d1d9; }
    #cbt-ac-drop.cbt-dark .cbt-ac-nm mark { background: rgba(88,166,255,.22); color: #58a6ff; }
    #cbt-ac-drop.cbt-dark .cbt-ac-tag { color: #6e7b8d; }
    #cbt-ac-drop.cbt-dark .cbt-ac-none { color: #6e7b8d; }
    #cbt-ac-drop.cbt-dark .cbt-ac-foot {
      background: #161b22; border-top-color: #21262d; color: #6e7b8d;
    }

    /* QR popup stays plain white in both themes — never themed, never scaled */
    #cbt-qr-card { background: #FFFFFF !important; }
    #cbt-scale-reset {
      font-size: 11px !important; font-variant-numeric: tabular-nums;
      min-width: 40px; text-align: center;
    }

    /* Scaling safeguards: at larger sizes long values must wrap inside their
       box rather than push a panel out of shape. */
    #cbt-qr-card, #cbt-afa-card { max-width: 92vw; }
    #cbt-qr-input { word-break: break-all; }
    .cbt-afa-msg  { word-break: break-word; }
    .cbt-afa-ref  { word-break: break-all; }
    #cbt-afa-lead { word-break: break-word; }

    /* ══════════════════════════════════════
       DARK MODE — Batcher Timer
    ══════════════════════════════════════ */
    #cbt-panel.dark {
      background: #0d1117 !important; border-color: #21262d !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5) !important;
    }
    #cbt-panel.dark #cbt-header {
      background: linear-gradient(135deg,#0d1117,#161b22) !important;
      border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-title { color: #e6edf3 !important; }
    #cbt-panel.dark #cbt-title::before { background: #58a6ff !important; }
    #cbt-panel.dark #cbt-controls span { color: #6e7b8d !important; border-color: rgba(110,123,141,0.2) !important; }
    #cbt-panel.dark #cbt-controls span:hover { background: #58a6ff !important; color: #fff !important; border-color: #58a6ff !important; }
    #cbt-panel.dark #cbt-stats-bar { background: #161b22 !important; border-bottom-color: #21262d !important; }
    #cbt-panel.dark .cbt-stat-card { border-right-color: #21262d !important; }
    #cbt-panel.dark .cbt-stat-label { color: #c8d8ea !important; }
    #cbt-panel.dark .cbt-stat-value { color: #ffffff !important; text-shadow: 0 1px 4px rgba(0,0,0,0.4) !important; }
    #cbt-panel.dark #cbt-stat-dot { box-shadow: 0 0 0 3px rgba(255,255,255,0.08) !important; }
    #cbt-panel.dark #cbt-tabs { background: #0d1117 !important; border-bottom-color: #21262d !important; }
    #cbt-panel.dark .cbt-tab { color: #8b99aa !important; }
    #cbt-panel.dark .cbt-tab:hover { color: #c9d1d9 !important; }
    #cbt-panel.dark .cbt-tab.active { color: #58a6ff !important; border-bottom-color: #58a6ff !important; }
    #cbt-panel.dark #cbt-body { background: #0d1117 !important; scrollbar-color: #21262d transparent !important; }
    #cbt-panel.dark #cbt-table thead tr, #cbt-panel.dark #cbt-hist-table thead tr,
    #cbt-panel.dark #cbt-weekly-table thead tr, #cbt-panel.dark #cbt-names-table thead tr {
      background: #161b22 !important; border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-table th, #cbt-panel.dark #cbt-hist-table th,
    #cbt-panel.dark #cbt-weekly-table th, #cbt-panel.dark #cbt-names-table th {
      background: #161b22 !important; color: #8faac0 !important;
    }
    #cbt-panel.dark #cbt-table td, #cbt-panel.dark #cbt-hist-table td,
    #cbt-panel.dark #cbt-weekly-table td, #cbt-panel.dark #cbt-names-table td {
      color: #c9d1d9 !important; border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-table tbody tr:nth-child(even) td,
    #cbt-panel.dark #cbt-hist-table tbody tr:nth-child(even) td,
    #cbt-panel.dark #cbt-weekly-table tbody tr:nth-child(even) td,
    #cbt-panel.dark #cbt-names-table tbody tr:nth-child(even) td { background: #161b22 !important; }
    #cbt-panel.dark #cbt-table tbody tr:hover td, #cbt-panel.dark #cbt-hist-table tbody tr:hover td,
    #cbt-panel.dark #cbt-weekly-table tbody tr:hover td, #cbt-panel.dark #cbt-names-table tbody tr:hover td { background: #1c2333 !important; }
    #cbt-panel.dark .cbt-assoc { color: #c9d1d9 !important; }
    #cbt-panel.dark .cbt-assoc:hover { color: #58a6ff !important; }
    #cbt-panel.dark .cbt-name-cell { color: #c9d1d9 !important; }
    #cbt-panel.dark .cbt-name-cell:hover { color: #58a6ff !important; }
    #cbt-panel.dark .cbt-hist-meta { color: #c9d1d9 !important; }
    #cbt-panel.dark .cbt-elapsed { background: rgba(0,200,83,0.07) !important; }
    #cbt-panel.dark .cbt-elapsed.warn { background: rgba(255,171,0,0.07) !important; }
    #cbt-panel.dark .cbt-elapsed.alert { background: rgba(255,61,61,0.07) !important; }
    #cbt-panel.dark .cbt-hist-rate.good  { background: rgba(0,200,83,0.07) !important; color: #3fb950 !important; }
    #cbt-panel.dark .cbt-hist-rate.warn  { background: rgba(255,171,0,0.07) !important; color: #e3b341 !important; }
    #cbt-panel.dark .cbt-hist-rate.alert { background: rgba(255,61,61,0.07) !important; color: #f85149 !important; }
    #cbt-panel.dark .cbt-ws-val { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-ws-label { color: #8faac0 !important; }
    #cbt-panel.dark #cbt-weekly-summary, #cbt-panel.dark #cbt-hist-summary {
      background: linear-gradient(180deg,#161b22,#0d1117) !important;
      border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-weekly-search, #cbt-panel.dark #cbt-hist-search,
    #cbt-panel.dark #cbt-live-search, #cbt-panel.dark #cbt-names-search,
    #cbt-panel.dark #cbt-hof-search {
      background: #161b22 !important; border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-search-input, #cbt-panel.dark #cbt-hist-search-input,
    #cbt-panel.dark #cbt-live-search-input, #cbt-panel.dark #cbt-names-search-input,
    #cbt-panel.dark #cbt-hof-search-input {
      background-color: #0d1117 !important; border-color: #21262d !important; color: #c9d1d9 !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236e7b8d' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") !important;
    }
    #cbt-panel.dark #cbt-search-input:focus, #cbt-panel.dark #cbt-hist-search-input:focus,
    #cbt-panel.dark #cbt-live-search-input:focus, #cbt-panel.dark #cbt-names-search-input:focus,
    #cbt-panel.dark #cbt-hof-search-input:focus {
      border-color: #58a6ff !important;
      box-shadow: 0 0 0 3px rgba(88,166,255,0.14) !important;
    }
    #cbt-panel.dark #cbt-unified-search { background: #161b22 !important; border-bottom-color: #21262d !important; }
    #cbt-panel.dark #cbt-unified-search-input {
      background-color: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important;
    }
    #cbt-panel.dark #cbt-unified-search-input:focus {
      border-color: #58a6ff !important; box-shadow: 0 0 0 3px rgba(88,166,255,.14) !important;
    }
    #cbt-panel.dark #cbt-unified-search-count,
    #cbt-panel.dark #cbt-unified-search-clear { color: #7a8fa3 !important; }
    #cbt-panel.dark #cbt-unified-search-clear:hover { color: #f85149 !important; background: rgba(248,81,73,.1) !important; }
    #cbt-panel.dark .cbt-search-result-section {
      background: linear-gradient(180deg,#1a2233,#161b22) !important;
      border-top-color: #58a6ff !important; border-bottom-color: #21262d !important; color: #8faac0 !important;
    }
    #cbt-panel.dark .cbt-search-row { border-bottom-color: #21262d !important; }
    #cbt-panel.dark .cbt-search-row:hover { background: #1c2333 !important; }
    #cbt-panel.dark .cbt-search-row-name { color: #c9d1d9 !important; }
    #cbt-panel.dark .cbt-search-row-name:hover { color: #58a6ff !important; }
    #cbt-panel.dark .cbt-search-row-mid { color: #7a8fa3 !important; }
    #cbt-panel.dark #cbt-updated { color: #3a4456 !important; }
    #cbt-panel.dark #cbt-drag-bottom { background-color: #21262d !important; }
    #cbt-panel.dark #cbt-drag-bottom:hover { background-color: #58a6ff !important; }

    /* ══════════════════════════════════════
       ASSOCIATE SEARCH PANEL (task page)
    ══════════════════════════════════════ */
    #cbt-tp {
      position: fixed !important; top: 90px !important; right: 12px !important;
      width: 420px !important; z-index: 9999 !important;
      background: var(--cb-surface);
      border: 1px solid var(--cb-border);
      border-radius: var(--cb-radius);
      box-shadow: 0 8px 32px rgba(13,27,42,0.18), 0 2px 8px rgba(13,27,42,0.10);
      font-family: var(--cb-sans); color: var(--cb-text); overflow: hidden;
    }
    #cbt-tp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      background: #f0f4f8;
      border-bottom: 1px solid var(--cb-border);
      cursor: move; user-select: none;
    }
    #cbt-tp.cbt-tp-dragging { transition: none; }
    #cbt-tp.cbt-tp-dragging #cbt-tp-header { cursor: grabbing; }
    #cbt-tp-title {
      font-weight: 800; font-size: 12px; color: var(--cb-navy);
      letter-spacing: 0.06em; text-transform: uppercase;
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-tp-title::before {
      content: ''; display: inline-block; width: 2px; height: 14px;
      background: var(--cb-blue); border-radius: 2px;
    }
    #cbt-tp-controls { display: flex; gap: 8px; align-items: center; }
    #cbt-tp-font-dec, #cbt-tp-font-inc, #cbt-tp-collapse {
      font-size: 11px; font-weight: 800; cursor: pointer; user-select: none;
      color: var(--cb-text2); padding: 2px 6px; border-radius: 4px;
      border: 1px solid var(--cb-border); transition: all 0.15s;
    }
    #cbt-tp-font-dec:hover, #cbt-tp-font-inc:hover, #cbt-tp-collapse:hover {
      background: var(--cb-blue); color: #fff; border-color: var(--cb-blue);
    }
    /* Rolled up: header only, and the panel shrinks to fit it */
    #cbt-tp.cbt-tp-rolled #cbt-tp-body { display: none; }
    #cbt-tp-theme {
      font-size: 14px; cursor: pointer; padding: 2px 5px; border-radius: 4px;
      transition: all 0.15s;
    }
    #cbt-tp-theme:hover { background: var(--cb-border); }

    #cbt-tp-body {
      height: 220px; min-height: 220px; max-height: 220px;
      overflow-y: auto; background: var(--cb-surface);
      scrollbar-width: thin; scrollbar-color: var(--cb-border) transparent;
    }
    #cbt-tp-body::-webkit-scrollbar { width: 4px; }
    #cbt-tp-body::-webkit-scrollbar-thumb { background: var(--cb-border); border-radius: 3px; }

    /* search bar inside tp */
    #cbt-tp-body > div:first-child {
      padding: 8px 8px 4px; background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-tp-search-input {
      flex: 1; padding: 7px 12px 7px 32px; background-color: var(--cb-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 11px center;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      color: var(--cb-text); font-size: 13px; outline: none;
      font-family: var(--cb-sans);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #cbt-tp-search-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(41,121,255,0.14);
    }
    #cbt-tp-search-clear {
      font-size: 13px; border: none; background: none;
      cursor: pointer; color: var(--cb-text3);
      width: 24px; height: 24px; padding: 0; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    #cbt-tp-search-clear:hover { color: var(--cb-red); background: rgba(255,61,61,0.1); }

    #cbt-tp-results { }
    .cbt-tp-row {
      display: table; width: 100%;
      border-bottom: 1px solid var(--cb-border);
      height: 38px; margin: 0; box-sizing: border-box;
      transition: background 0.1s;
    }
    .cbt-tp-row:hover { background: #edf2fb; }
    .cbt-tp-row-name {
      display: table-cell; width: 55%; font-size: 13px; font-weight: 700;
      color: var(--cb-text); vertical-align: middle; padding: 3px 4px 3px 12px;
      cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      transition: color 0.15s;
    }
    .cbt-tp-row-name:hover { color: var(--cb-blue) !important; }
    .cbt-tp-row-mid {
      display: table-cell; width: 20%; font-size: 11px; color: var(--cb-text3);
      text-align: center; vertical-align: middle; font-family: var(--cb-mono);
    }
    .cbt-tp-row-rate {
      display: table-cell; width: 25%; font-size: 14px; font-weight: 800;
      text-align: right; vertical-align: middle; padding: 3px 12px 3px 4px;
      font-family: var(--cb-mono); font-variant-numeric: tabular-nums;
    }

    /* section headers in tp results */
    .cbt-search-result-section { }   /* already defined above */

    /* ── DARK MODE — Associate Search ── */
    #cbt-tp.dark {
      background: #0d1117 !important; border-color: #21262d !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
    }
    #cbt-tp.dark #cbt-tp-header {
      background: linear-gradient(135deg,#0d1117,#161b22) !important;
      border-bottom-color: #21262d !important;
    }
    #cbt-tp.dark #cbt-tp-title { color: #e6edf3 !important; }
    #cbt-tp.dark #cbt-tp-title::before { background: #58a6ff !important; }
    #cbt-tp.dark #cbt-tp-font-dec, #cbt-tp.dark #cbt-tp-font-inc, #cbt-tp.dark #cbt-tp-collapse {
      color: #6e7b8d !important; border-color: rgba(110,123,141,0.2) !important;
    }
    #cbt-tp.dark #cbt-tp-font-dec:hover, #cbt-tp.dark #cbt-tp-font-inc:hover, #cbt-tp.dark #cbt-tp-collapse:hover {
      background: #58a6ff !important; color: #fff !important; border-color: #58a6ff !important;
    }
    #cbt-tp.dark #cbt-tp-body {
      background: #0d1117 !important; scrollbar-color: #21262d transparent !important;
    }
    #cbt-tp.dark #cbt-tp-body > div:first-child {
      background: #161b22 !important; border-bottom-color: #21262d !important;
    }
    #cbt-tp.dark #cbt-tp-search-input {
      background-color: #0d1117 !important; border-color: #21262d !important; color: #c9d1d9 !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236e7b8d' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") !important;
    }
    #cbt-tp.dark #cbt-tp-search-input:focus {
      border-color: #58a6ff !important;
      box-shadow: 0 0 0 3px rgba(88,166,255,0.14) !important;
    }
    #cbt-tp.dark .cbt-tp-row { border-bottom-color: #21262d !important; }
    #cbt-tp.dark .cbt-tp-row:hover { background: #1c2333 !important; }
    #cbt-tp.dark .cbt-tp-row-name { color: #c9d1d9 !important; }
    #cbt-tp.dark .cbt-tp-row-name:hover { color: #58a6ff !important; }
    #cbt-tp.dark .cbt-tp-row-mid { color: #7a8fa3 !important; }
    #cbt-tp.dark .cbt-search-result-section {
      background: linear-gradient(180deg,#1a2233,#161b22) !important;
      border-top-color: #58a6ff !important; border-bottom-color: #21262d !important; color: #8faac0 !important;
    }
    #cbt-tp.dark .cbt-search-row { border-bottom-color: #21262d !important; }
    #cbt-tp.dark .cbt-search-row:hover { background: #1c2333 !important; }
    #cbt-tp.dark .cbt-search-row-name { color: #c9d1d9 !important; }
    #cbt-tp.dark .cbt-search-row-name:hover { color: #58a6ff !important; }
    #cbt-tp.dark .cbt-search-row-mid { color: #7a8fa3 !important; }
    #cbt-tp.dark .cbt-hist-rate.good  { color: #3fb950 !important; background: rgba(0,200,83,0.07) !important; }
    #cbt-tp.dark .cbt-hist-rate.warn  { color: #e3b341 !important; background: rgba(255,171,0,0.07) !important; }
    #cbt-tp.dark .cbt-hist-rate.alert { color: #f85149 !important; background: rgba(255,61,61,0.07) !important; }

    /* ── UI polish (v21.10) ── */
    @keyframes cbtFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    #cbt-panel, #cbt-tp { animation: cbtFadeIn 0.28s ease-out; }

    /* row hover: left accent bar, no layout shift */
    #cbt-table tbody tr:hover td:first-child, #cbt-hist-table tbody tr:hover td:first-child,
    #cbt-weekly-table tbody tr:hover td:first-child, #cbt-names-table tbody tr:hover td:first-child {
      box-shadow: inset 3px 0 0 var(--cb-blue);
    }
    #cbt-panel.dark #cbt-table tbody tr:hover td:first-child, #cbt-panel.dark #cbt-hist-table tbody tr:hover td:first-child,
    #cbt-panel.dark #cbt-weekly-table tbody tr:hover td:first-child, #cbt-panel.dark #cbt-names-table tbody tr:hover td:first-child {
      box-shadow: inset 3px 0 0 #58a6ff;
    }
    .cbt-search-row:hover .cbt-search-row-name, .cbt-tp-row:hover .cbt-tp-row-name {
      box-shadow: inset 3px 0 0 var(--cb-blue);
    }
    #cbt-panel.dark .cbt-search-row:hover .cbt-search-row-name,
    #cbt-tp.dark .cbt-search-row:hover .cbt-search-row-name,
    #cbt-tp.dark .cbt-tp-row:hover .cbt-tp-row-name {
      box-shadow: inset 3px 0 0 #58a6ff;
    }

    /* stat card hover tint */
    .cbt-stat-card { transition: background 0.15s; }
    .cbt-stat-card:hover { background: rgba(41,121,255,0.06); }
    #cbt-panel.dark .cbt-stat-card:hover { background: rgba(88,166,255,0.07) !important; }

    /* live pulse next to the updated timestamp */
    #cbt-updated::before {
      content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: var(--cb-green); margin-right: 5px; vertical-align: middle;
      animation: cbt-live-blink 2s infinite;
    }
    @keyframes cbt-live-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Inline copy confirmation: the clicked name turns green and a
       small "Copied" tag appears right beside it */
    .cbt-copied-name, .cbt-copied-name:hover { color: #0a9e43 !important; }
    #cbt-panel.dark .cbt-copied-name, #cbt-panel.dark .cbt-copied-name:hover,
    #cbt-tp.dark .cbt-copied-name, #cbt-tp.dark .cbt-copied-name:hover { color: #3fb950 !important; }
    .cbt-copied-tag {
      display: inline-block; margin-left: 6px; padding: 1px 7px;
      background: #00c853; color: #fff; font-size: 10px; font-weight: 800;
      border-radius: 5px; letter-spacing: .04em; text-transform: uppercase;
      vertical-align: middle; pointer-events: none;
      animation: cbt-tag-in .15s ease-out;
    }
    @keyframes cbt-tag-in { from { opacity: 0; transform: translateX(-3px); } to { opacity: 1; transform: none; } }

    /* ══════════════════════════════════════
       UNIFORM ROW GEOMETRY
       Live, Today, Weekly and Hall of Fame rows all share one fixed height,
       padding and vertical alignment. A SLOW row carries an extra inline
       badge, which previously grew the row; with the height fixed and the
       badge given line-height:1 it can no longer do that. Heights are in px
       inside the zoomed body, so they scale proportionally at every size.
    ══════════════════════════════════════ */
    #cbt-table tbody tr, #cbt-hist-table tbody tr,
    #cbt-weekly-table tbody tr, #cbt-hof-table tbody tr {
      height: 48px !important;
    }
    #cbt-table tbody td, #cbt-hist-table tbody td,
    #cbt-weekly-table tbody td, #cbt-hof-table tbody td {
      height: 48px !important; padding: 0 10px !important;
      vertical-align: middle !important; line-height: 1.3 !important;
      box-sizing: border-box; overflow: hidden;
    }
    /* A cell's height property is only a MINIMUM — content taller than it
       still grows the row, which is why the two-line Live cell stayed taller than
       the single-line Today / Weekly / Fastest cells. Every first cell now
       wraps its content in this fixed-height box instead, so all four tables
       resolve to exactly the same row geometry no matter what is inside. */
    .cbt-cw {
      display: flex; flex-direction: column; justify-content: center;
      width: 100%; min-width: 0;
      height: 40px; min-height: 40px; max-height: 40px;
      overflow: hidden; box-sizing: border-box;
    }

    /* ═══════════════════════════════════════════════════════════════
       LIVE TAB — HARD UNIFORM ROW GEOMETRY
       ---------------------------------------------------------------
       A native HTML table row can grow beyond its requested height when
       content needs more room. That is why SLOW rows could become taller than
       normal rows even though both requested 48px.

       Live now uses one strict 3-column grid for BOTH its header and every
       body row. Every body row is exactly 48px high and exactly 100% wide.
       Badge/color/text content is contained INSIDE that geometry and cannot
       resize the row.
    ═══════════════════════════════════════════════════════════════ */
    #cbt-table {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      box-sizing: border-box !important;
    }
    #cbt-table thead,
    #cbt-table tbody {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    #cbt-table thead tr,
    #cbt-table tbody tr {
      display: grid !important;
      grid-template-columns: minmax(0,40%) minmax(0,30%) minmax(0,30%) !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #cbt-table tbody tr {
      height: 48px !important;
      min-height: 48px !important;
      max-height: 48px !important;
      overflow: hidden !important;
    }
    #cbt-table thead th,
    #cbt-table tbody td {
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
      margin: 0 !important;
    }
    #cbt-table tbody td {
      height: 48px !important;
      min-height: 48px !important;
      max-height: 48px !important;
      padding: 0 10px !important;
      display: flex !important;
      align-items: center !important;
      overflow: hidden !important;
      line-height: 1.3 !important;
    }
    #cbt-table tbody td:first-child {
      justify-content: flex-start !important;
      text-align: left !important;
    }
    #cbt-table tbody td:nth-child(2),
    #cbt-table tbody td:nth-child(3) {
      justify-content: center !important;
      text-align: center !important;
    }
    #cbt-table tbody td:nth-child(2) {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
    }
    #cbt-table tbody td:nth-child(2) .cbt-elapsed,
    #cbt-table tbody td:nth-child(2) .cbt-elapsed.warn,
    #cbt-table tbody td:nth-child(2) .cbt-elapsed.alert {
      margin-left: auto !important;
      margin-right: auto !important;
      transform: none !important;
      left: auto !important;
      right: auto !important;
    }
    #cbt-table .cbt-cw {
      width: 100% !important;
      height: 40px !important;
      min-height: 40px !important;
      max-height: 40px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      flex: 0 1 auto !important;
    }
    #cbt-table .cbt-cw-top {
      width: 100% !important;
      height: 18px !important;
      min-height: 18px !important;
      max-height: 18px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    #cbt-table .cbt-live-status-slot {
      height: 16px !important;
      min-height: 16px !important;
      max-height: 16px !important;
      overflow: hidden !important;
      flex: 0 0 auto !important;
    }
    #cbt-table .cbt-slow-alert {
      height: 16px !important;
      min-height: 16px !important;
      max-height: 16px !important;
      line-height: 16px !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      transform: none !important;
      position: static !important;
    }
    #cbt-table .cbt-assoc,
    #cbt-table .cbt-ref,
    #cbt-table .cbt-rate {
      max-height: 18px !important;
      box-sizing: border-box !important;
    }
    #cbt-table .cbt-elapsed {
      width: 58px !important;
      min-width: 58px !important;
      max-width: 58px !important;
      height: 22px !important;
      min-height: 22px !important;
      max-height: 22px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      padding: 0 !important;
      line-height: 22px !important;
      box-sizing: border-box !important;
      transform: none !important;
    }

    /* Live first-column geometry is identical for every rate state.
       The SLOW badge sits immediately beside the associate name, but the
       fixed-height wrapper keeps red/yellow/green rows exactly the same size.
       Rows without a badge do not reserve a fake empty status column. */
    .cbt-cw-top {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 5px;
      width: 100%;
      min-width: 0;
      height: 18px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .cbt-cw-top .cbt-assoc {
      flex: 0 1 auto;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
    }
    .cbt-live-status-slot {
      flex: 0 0 auto;
      height: 18px;
      display: inline-flex; align-items: center; justify-content: flex-start;
      overflow: visible; box-sizing: border-box;
    }
    .cbt-cw .cbt-ref { display: block; margin-top: 1px !important; }
    /* consistent type sizing for every value in a row */
    #cbt-table tbody td .cbt-assoc, #cbt-hist-table tbody td .cbt-assoc,
    #cbt-weekly-table tbody td .cbt-assoc, #cbt-hof-table tbody td .cbt-assoc {
      font-size: 14px !important; font-weight: 700 !important; line-height: 1.3 !important;
    }
    #cbt-table tbody td .cbt-ref, #cbt-hof-table tbody td .cbt-ref {
      font-size: 10px !important; line-height: 1.2 !important; margin-top: 0 !important;
    }
    #cbt-table tbody td .cbt-elapsed, #cbt-table tbody td .cbt-rate,
    #cbt-hist-table tbody td .cbt-hist-meta, #cbt-hist-table tbody td .cbt-hist-rate,
    #cbt-weekly-table tbody td .cbt-hist-meta, #cbt-weekly-table tbody td .cbt-hist-rate,
    #cbt-hof-table tbody td .cbt-hist-meta, #cbt-hof-table tbody td .cbt-hist-rate {
      line-height: 1.3 !important; vertical-align: middle !important;
    }

    /* Search-result rows and Names use the same physical row height as the
       four data tables. This keeps a filtered/cross-tab result from looking
       shorter, taller or offset when it appears underneath the main table. */
    #cbt-names-table tbody tr, .cbt-search-row {
      height: 48px !important; min-height: 48px !important; box-sizing: border-box;
    }
    #cbt-names-table tbody td {
      height: 48px !important; padding: 0 10px !important;
      vertical-align: middle !important; line-height: 1.3 !important; box-sizing: border-box;
    }
    .cbt-search-row {
      display: grid !important; grid-template-columns: 40% 40% 20%;
      width: 100% !important; margin: 0 !important; padding: 0 !important;
      align-items: stretch; overflow: hidden;
    }
    .cbt-search-row-name, .cbt-search-row-mid, .cbt-search-row-rate {
      display: flex !important; align-items: center; height: 48px !important;
      box-sizing: border-box; min-width: 0; overflow: hidden;
    }
    .cbt-search-row-name { width: auto !important; padding: 0 10px !important; text-overflow: ellipsis; white-space: nowrap; }
    .cbt-search-row-mid  { width: auto !important; padding: 0 6px !important; justify-content: center; text-overflow: ellipsis; white-space: nowrap; }
    .cbt-search-row-rate {
      width: auto !important; padding: 0 10px !important;
      justify-content: center; white-space: nowrap;
      background: transparent !important; color: inherit;
    }
    .cbt-search-row-rate > .cbt-hist-rate {
      flex: 0 0 38px;
      width: 38px; min-width: 38px; height: 24px;
      display: inline-flex !important;
      align-items: center; justify-content: center;
      padding: 0 !important; line-height: 1 !important;
      text-align: center;
    }


    /* Stable column geometry on every summary table. Filtering now changes
       only which rows are visible; it cannot change column width or row width. */
    #cbt-hist-table, #cbt-weekly-table, #cbt-names-table { width: 100%; table-layout: fixed; }
    #cbt-hist-table th:nth-child(1), #cbt-hist-table td:nth-child(1) { width: 40%; }
    #cbt-hist-table th:nth-child(2), #cbt-hist-table td:nth-child(2) { width: 20%; }
    #cbt-hist-table th:nth-child(3), #cbt-hist-table td:nth-child(3) { width: 20%; }
    #cbt-hist-table th:nth-child(4), #cbt-hist-table td:nth-child(4) { width: 20%; }
    #cbt-weekly-table th:nth-child(1), #cbt-weekly-table td:nth-child(1) { width: 34%; }
    #cbt-weekly-table th:nth-child(2), #cbt-weekly-table td:nth-child(2) { width: 11%; }
    #cbt-weekly-table th:nth-child(3), #cbt-weekly-table td:nth-child(3) { width: 12%; }
    #cbt-weekly-table th:nth-child(4), #cbt-weekly-table td:nth-child(4) { width: 15%; }
    #cbt-weekly-table th:nth-child(5), #cbt-weekly-table td:nth-child(5) { width: 16%; }
    #cbt-weekly-table th:nth-child(6), #cbt-weekly-table td:nth-child(6) { width: 12%; }

    /* ══════════════════════════════════════
       HALL OF FAME
    ══════════════════════════════════════ */
    /* Every tab view is pinned to the panel's width so switching tabs can
       never widen, narrow or shift the dashboard. The Fastest table has the
       most columns, so it scrolls internally rather than pushing outward. */
    #cbt-live-view, #cbt-history-view, #cbt-weekly-view,
    #cbt-names-view, #cbt-hof-view {
      width: 100%; max-width: 100%; box-sizing: border-box;
    }
    #cbt-hof-view { overflow-x: auto; }
    #cbt-hof-table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; }
    #cbt-hof-table th:nth-child(1), #cbt-hof-table td:nth-child(1) { width: 31%; }
    #cbt-hof-table th:nth-child(2), #cbt-hof-table td:nth-child(2) { width: 11%; }
    #cbt-hof-table th:nth-child(3), #cbt-hof-table td:nth-child(3) { width: 12%; }
    #cbt-hof-table th:nth-child(4), #cbt-hof-table td:nth-child(4) { width: 15%; }
    #cbt-hof-table th:nth-child(5), #cbt-hof-table td:nth-child(5) { width: 15%; }
    #cbt-hof-table th:nth-child(6), #cbt-hof-table td:nth-child(6) { width: 16%; }
    #cbt-hof-table thead tr {
      border-bottom: 2px solid var(--cb-border); background: #f8fafc;
      position: sticky; top: 0; z-index: 1;
    }
    #cbt-hof-table th {
      color: var(--cb-text2); font-weight: 700; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 8px 6px; text-align: center; background: #f8fafc; white-space: nowrap;
      /* short titles plus clipping: at larger sizes a heading now truncates
         inside its own column instead of running into the next one */
      overflow: hidden; text-overflow: ellipsis; max-width: 0;
    }
    #cbt-hof-table th:first-child, #cbt-hof-table td:first-child { text-align: left; }
    #cbt-hof-table td {
      border-bottom: 1px solid var(--cb-border); text-align: center;
      font-size: 14px; color: var(--cb-text);
    }
    #cbt-hof-table tbody tr:last-child td { border-bottom: none; }
    #cbt-hof-table tbody tr:nth-child(even) td { background: var(--cb-row-alt); }
    #cbt-hof-table tbody tr:hover td { background: #edf2fb !important; }
    #cbt-hof-table tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 var(--cb-blue); }
    /* the podium */
    #cbt-hof-table tbody tr.cbt-hof-1 td { background: linear-gradient(90deg, rgba(212,160,23,.20), rgba(212,160,23,.02) 60%) !important; }
    #cbt-hof-table tbody tr.cbt-hof-2 td { background: linear-gradient(90deg, rgba(154,171,184,.20), rgba(154,171,184,.02) 60%) !important; }
    #cbt-hof-table tbody tr.cbt-hof-3 td { background: linear-gradient(90deg, rgba(184,115,51,.18), rgba(184,115,51,.02) 60%) !important; }
    #cbt-hof-table tbody tr.cbt-hof-1 .cbt-assoc,
    #cbt-hof-table tbody tr.cbt-hof-2 .cbt-assoc,
    #cbt-hof-table tbody tr.cbt-hof-3 .cbt-assoc { font-weight: 700 !important; }
    .cbt-hof-peak {
      font-family: var(--cb-mono); font-size: 15px; font-weight: 800;
      font-variant-numeric: tabular-nums; color: #0a6e2e;
      background: rgba(0,200,83,.10); padding: 2px 8px; border-radius: 4px; display: inline-block;
    }
    .cbt-hof-when { font-size: 11px; color: var(--cb-text3); font-variant-numeric: tabular-nums; white-space: nowrap; }
    #cbt-hof-empty {
      display: none; text-align: center; color: var(--cb-text3);
      padding: 16px 12px; font-style: italic; font-size: 13px; line-height: 1.5;
    }
    /* night mode */
    #cbt-panel.dark #cbt-hof-table thead tr { background: #161b22 !important; border-bottom-color: #21262d !important; }
    #cbt-panel.dark #cbt-hof-table th { background: #161b22 !important; color: #8faac0 !important; }
    #cbt-panel.dark #cbt-hof-table td { color: #c9d1d9 !important; border-bottom-color: #21262d !important; }
    #cbt-panel.dark #cbt-hof-table tbody tr:nth-child(even) td { background: #161b22 !important; }
    #cbt-panel.dark #cbt-hof-table tbody tr:hover td { background: #1c2333 !important; }
    #cbt-panel.dark #cbt-hof-table tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 #58a6ff; }
    #cbt-panel.dark #cbt-hof-table tbody tr.cbt-hof-1 td { background: linear-gradient(90deg, rgba(246,211,101,.18), rgba(246,211,101,.02) 60%) !important; }
    #cbt-panel.dark #cbt-hof-table tbody tr.cbt-hof-2 td { background: linear-gradient(90deg, rgba(208,216,224,.16), rgba(208,216,224,.02) 60%) !important; }
    #cbt-panel.dark #cbt-hof-table tbody tr.cbt-hof-3 td { background: linear-gradient(90deg, rgba(232,185,122,.16), rgba(232,185,122,.02) 60%) !important; }
    #cbt-panel.dark .cbt-hof-peak { color: #3fb950 !important; background: rgba(0,200,83,.07) !important; }
    #cbt-panel.dark .cbt-hof-when { color: #7a8fa3 !important; }
    #cbt-panel.dark #cbt-hof-empty { color: #6e7b8d !important; }


    /* ══════════════════════════════════════
       QR CODE FROM SELECTED TEXT
    ══════════════════════════════════════ */
    #cbt-qr-overlay {
      position: fixed; inset: 0; z-index: 2147483646;
      background: transparent !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 16px;
      box-sizing: border-box;
      font-family: var(--cb-sans);
      pointer-events: none;
    }

    /* QR popup can only snap along the bottom row.
       No free-floating coordinates are kept, which makes placement stable. */
    #cbt-qr-overlay[data-qr-pos="bottom-left"]   { align-items:flex-end; justify-content:flex-start; }
    #cbt-qr-overlay[data-qr-pos="bottom-center"] { align-items:flex-end; justify-content:center; }
    #cbt-qr-overlay[data-qr-pos="bottom-right"]  { align-items:flex-end; justify-content:flex-end; }
    #cbt-qr-card {
      pointer-events: auto;
      background: #ffffff !important;
      border: 1px solid #d8e0e8;
      border-radius: 10px;
      width: 340px;
      max-width: calc(100vw - 20px);
      box-shadow: 0 8px 24px rgba(13,27,42,0.18), 0 2px 7px rgba(13,27,42,0.10);
      overflow: hidden;
      animation: cbtQrCornerIn .12s ease-out;
    }
    @keyframes cbtQrCornerIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #cbt-qr-head {
      position: relative;
      display: flex; align-items: center; justify-content: space-between;
      min-height: 28px;
      padding: 9px 11px; background: #f7f9fb;
      border-bottom: 1px solid #e1e7ee;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    #cbt-qr-head:active { cursor: grabbing; }
    #cbt-qr-title {
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px; font-weight: 800; color: #0d1b2a;
      letter-spacing: .045em; text-transform: uppercase;
      display: flex; align-items: center; gap: 6px;
      white-space: nowrap;
      pointer-events: none;
    }
    #cbt-qr-left,
    #cbt-qr-right {
      cursor: pointer;
      border: none;
      background: transparent;
      color: #66788a;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      transition: color .12s, background .12s, opacity .12s;
    }
    #cbt-qr-left,
    #cbt-qr-right {
      font-size: 18px;
      font-weight: 900;
    }
    #cbt-qr-left:hover:not(:disabled),
    #cbt-qr-right:hover:not(:disabled) {
      color: var(--cb-blue);
      background: rgba(41,121,255,.08);
    }
    #cbt-qr-left:disabled,
    #cbt-qr-right:disabled {
      cursor: default;
      opacity: .28;
    }
    #cbt-qr-head-left,
    #cbt-qr-head-right {
      display: flex;
      align-items: center;
      z-index: 1;
    }
    #cbt-qr-canvas-wrap {
      display: flex; align-items: center; justify-content: center;
      padding: 14px 14px 9px;
      background: #ffffff;
    }
    #cbt-qr-svg {
      width: 260px;
      height: 260px;
      border-radius: 5px;
      display: block;
      background: #ffffff;
      overflow: hidden;
    }
    #cbt-qr-svg svg {
      display: block;
      width: 100%;
      height: 100%;
      background: #ffffff;
      shape-rendering: crispEdges;
    }
    #cbt-qr-err {
      display: none; color: var(--cb-red); font-size: 10px; font-weight: 700;
      text-align: center; padding: 0 10px 5px;
    }
    #cbt-qr-input {
      display: block; width: calc(100% - 24px); box-sizing: border-box;
      margin: 0 12px 14px; padding: 11px 12px;
      min-height: 44px;
      border: 1px solid #d8e0e8; border-radius: 7px;
      font-size: 16px; font-weight: 700; letter-spacing: .01em;
      font-family: var(--cb-mono); color: #152536;
      background: #ffffff;
      outline: none; text-align: center;
      transition: border-color .12s, box-shadow .12s;
    }
    #cbt-qr-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 2px rgba(41,121,255,.12);
    }
    @media (max-width: 560px) {
      #cbt-qr-overlay { padding: 6px; }
      #cbt-qr-card { width: 300px; }
      #cbt-qr-svg { width: 230px; height: 230px; }
    }

    /* ══════════════════════════════════════
       AUTO FORCE ASSIGN
    ══════════════════════════════════════ */
    #cbt-afa-btn {
      cursor: pointer; font-size: 11px !important; font-weight: 800;
      letter-spacing: .04em; padding: 3px 9px !important;
      color: #fff !important; background: var(--cb-blue);
      border: 1px solid var(--cb-blue) !important; border-radius: 5px;
      transition: all .15s; white-space: nowrap;
    }
    #cbt-afa-btn:hover { background: var(--cb-blue-dim); border-color: var(--cb-blue-dim) !important; }
    #cbt-afa-btn.busy { background: var(--cb-amber); border-color: var(--cb-amber) !important; color: #3a2600 !important; }

    #cbt-afa-overlay {
      position: fixed; inset: 0; z-index: 2147483645;
      background: rgba(13,27,42,.45);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--cb-sans); animation: cbtFadeIn .15s ease-out;
    }
    #cbt-afa-card {
      background: #fff; border-radius: 14px; width: 520px; max-width: 92vw;
      box-shadow: 0 20px 60px rgba(13,27,42,.35), 0 4px 16px rgba(13,27,42,.2);
      overflow: hidden; display: flex; flex-direction: column; max-height: 82vh;
    }
    #cbt-afa-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 18px; background: #f0f4f8; border-bottom: 1px solid var(--cb-border);
    }
    #cbt-afa-title {
      font-size: 13px; font-weight: 800; color: var(--cb-navy);
      letter-spacing: .05em; text-transform: uppercase;
      display: flex; align-items: center; gap: 8px;
    }
    #cbt-afa-title::before { content: ''; width: 3px; height: 14px; background: var(--cb-blue); border-radius: 2px; }
    #cbt-afa-x {
      cursor: pointer; border: none; background: none; color: var(--cb-text3);
      font-size: 15px; width: 26px; height: 26px; border-radius: 50%; padding: 0;
      display: flex; align-items: center; justify-content: center; transition: all .15s;
    }
    #cbt-afa-x:hover { color: var(--cb-red); background: rgba(255,61,61,.1); }
    #cbt-afa-body { padding: 16px 18px; overflow-y: auto; color: var(--cb-text); font-size: 13px; line-height: 1.6; }
    #cbt-afa-lead { font-size: 14px; margin-bottom: 12px; }
    #cbt-afa-lead b { color: var(--cb-navy); font-size: 17px; }
    .cbt-afa-list {
      border: 1px solid var(--cb-border); border-radius: 8px;
      max-height: 136px; overflow-y: auto; background: var(--cb-row-alt);
    }
    .cbt-afa-row {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 12px; border-bottom: 1px solid var(--cb-border);
      font-family: var(--cb-mono); font-size: 12px;
    }
    .cbt-afa-row:last-child { border-bottom: none; }
    .cbt-afa-ref { font-weight: 800; color: var(--cb-navy); min-width: 74px; }
    .cbt-afa-msg { color: var(--cb-text2); font-family: var(--cb-sans); flex: 1; }
    .cbt-afa-row.ok   .cbt-afa-msg { color: #0a6e2e; font-weight: 700; }
    .cbt-afa-row.bad  .cbt-afa-msg { color: #8b0000; font-weight: 700; }
    .cbt-afa-row.skip .cbt-afa-msg { color: #7a4f00; font-weight: 700; }
    .cbt-afa-warn {
      background: rgba(255,171,0,.12); border: 1px solid rgba(255,171,0,.5);
      color: #7a4f00; border-radius: 8px; padding: 9px 12px; margin-top: 12px;
      font-size: 12px; font-weight: 600;
    }
    #cbt-afa-bar {
      height: 8px; background: var(--cb-border); border-radius: 5px;
      overflow: hidden; margin: 6px 0 14px;
    }
    #cbt-afa-fill { height: 100%; width: 0%; background: var(--cb-blue); transition: width .25s ease-out; }
    #cbt-afa-foot {
      display: flex; justify-content: flex-end; gap: 9px;
      padding: 13px 18px; background: #f8fafc; border-top: 1px solid var(--cb-border);
    }
    .cbt-afa-act {
      cursor: pointer; font-size: 13px; font-weight: 700; padding: 8px 16px;
      border-radius: 8px; border: 1.5px solid var(--cb-border);
      background: #fff; color: var(--cb-text2); transition: all .15s;
    }
    .cbt-afa-act:hover { background: var(--cb-border); }
    .cbt-afa-act.go { background: var(--cb-blue); border-color: var(--cb-blue); color: #fff; }
    .cbt-afa-act.go:hover { background: var(--cb-blue-dim); border-color: var(--cb-blue-dim); }
    .cbt-afa-act.stop { background: var(--cb-red); border-color: var(--cb-red); color: #fff; }
    .cbt-afa-act.stop:hover { filter: brightness(.9); }
    .cbt-afa-act:disabled {
      opacity: .42; cursor: not-allowed; filter: grayscale(.15);
    }
    .cbt-afa-act:disabled:hover {
      background: inherit; border-color: inherit;
    }
    .cbt-afa-action-block {
      margin-top: 10px; padding: 11px 13px; border-radius: 8px;
      border: 1.5px solid var(--cb-border); background: var(--cb-row-alt);
      display: grid;
      grid-template-columns: 175px minmax(0, 1fr);
      align-items: center;
      column-gap: 10px;
    }
    .cbt-afa-action-block:first-of-type { margin-top: 12px; }
    .cbt-afa-action-block.off { opacity: .55; }
    .cbt-afa-action-btn {
      width: 175px !important;
      min-width: 175px !important;
      max-width: 175px !important;
      height: 40px !important;
      min-height: 40px !important;
      max-height: 40px !important;
      padding: 0 14px !important;
      margin: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      text-align: left !important;
      white-space: nowrap;
      flex-shrink: 0;
      box-sizing: border-box !important;
      line-height: 1 !important;
    }
    .cbt-afa-action-copy {
      min-width: 0;
      align-self: center;
      font-size: 12px; line-height: 1.45; color: var(--cb-text2);
      overflow-wrap: anywhere;
      word-break: normal;
    }

    /* Missing Package QR is a read-only helper inside the existing Run menu.
       It intentionally uses the same red alert language as the dashboard. */
    .cbt-afa-missing-btn {
      background: #d93025 !important;
      border-color: #d93025 !important;
      color: #ffffff !important;
      font-size: 12px !important;
      overflow: hidden !important;
      text-overflow: clip !important;
    }
    .cbt-afa-missing-btn:hover {
      background: #b3261e !important;
      border-color: #b3261e !important;
    }
    .cbt-afa-missing-triangle {
      display: inline-block;
      margin-right: 7px;
      color: #ffffff;
      font-size: 15px;
      line-height: 1;
      transform: translateY(-1px);
    }
    #cbt-afa-card.cbt-afa-missing-qr-card { width: 1180px; }
    .cbt-missing-qr-summary {
      margin-bottom: 10px;
      color: var(--cb-text2);
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
    }
    .cbt-missing-qr-nav {
      display: grid;
      grid-template-columns: 54px 1fr 54px;
      align-items: center;
      width: 100%;
      margin: 2px 0 14px;
      min-height: 38px;
    }
    .cbt-missing-qr-count {
      grid-column: 2;
      justify-self: center;
      font-family: var(--cb-mono);
      font-size: 17px;
      font-weight: 900;
      color: var(--cb-navy);
      white-space: nowrap;
    }
    .cbt-missing-qr-nav-btn {
      width: 42px;
      height: 34px;
      padding: 0;
      border: 1px solid var(--cb-border);
      border-radius: 7px;
      background: var(--cb-row-alt);
      color: var(--cb-navy);
      font-size: 23px;
      font-weight: 900;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cbt-missing-qr-nav-btn:hover {
      border-color: var(--cb-blue);
      color: var(--cb-blue);
      background: #edf2fb;
    }
    .cbt-missing-qr-prev { grid-column: 1; justify-self: start; }
    .cbt-missing-qr-next { grid-column: 3; justify-self: end; }
    .cbt-missing-qr-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 300px));
      justify-content: center;
      /* Keep the two scanner targets very far apart so aiming at one QR does
         not easily place the other QR inside the scanner's field of view. */
      column-gap: clamp(220px, 24vw, 360px);
      row-gap: 50px;
      align-items: start;
    }
    .cbt-missing-qr-grid.single {
      grid-template-columns: minmax(0, 330px);
      justify-content: center;
    }
    .cbt-missing-qr-tile {
      border: 1px solid var(--cb-border);
      border-radius: 10px;
      background: #ffffff;
      padding: 12px;
      min-width: 0;
    }
    .cbt-missing-qr-kind {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .055em;
      text-transform: uppercase;
      color: var(--cb-text2);
      margin-bottom: 7px;
      text-align: center;
      white-space: nowrap;
    }
    .cbt-missing-qr-svg {
      width: 270px;
      min-width: 270px;
      max-width: 270px;
      height: 270px;
      min-height: 270px;
      max-height: 270px;
      aspect-ratio: 1 / 1;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .cbt-missing-qr-svg svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .cbt-missing-qr-value {
      margin-top: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      background: var(--cb-row-alt);
      color: var(--cb-navy);
      font-family: var(--cb-mono);
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      word-break: break-all;
    }
    @media (max-width: 760px) {
      .cbt-missing-qr-grid,
      .cbt-missing-qr-grid.single {
        grid-template-columns: minmax(0, 330px);
        justify-content: center;
        row-gap: 50px;
      }
      #cbt-afa-card.cbt-afa-missing-qr-card { width: 94vw; }
    }
    .cbt-afa-opt {
      display: flex; align-items: flex-start; gap: 9px; cursor: pointer;
      margin-top: 14px; padding: 11px 13px; border-radius: 8px;
      border: 1.5px solid var(--cb-border); background: var(--cb-row-alt);
      font-size: 13px; line-height: 1.5; transition: border-color .15s, background .15s;
    }
    .cbt-afa-opt:hover { border-color: var(--cb-blue); background: #edf2fb; }
    .cbt-afa-opt.off { opacity: .55; cursor: default; }
    .cbt-afa-opt.off:hover { border-color: var(--cb-border); background: var(--cb-row-alt); }
    .cbt-afa-opt input { margin-top: 2px; width: 15px; height: 15px; cursor: pointer; flex-shrink: 0; }
    .cbt-afa-note {
      font-size: 12px; color: var(--cb-text2); line-height: 1.55;
      padding: 8px 13px 0; }

    /* ══════════════════════════════════════
       ASSOCIATE AUTOCOMPLETE (assignment fields)
    ══════════════════════════════════════ */
    #cbt-ac-drop {
      position: fixed; z-index: 2147483647;   /* above any site modal */
      background: #fff; border: 1px solid var(--cb-border); border-radius: 9px;
      box-shadow: 0 12px 36px rgba(13,27,42,.28), 0 2px 8px rgba(13,27,42,.16);
      font-family: var(--cb-sans); overflow: hidden;
      max-height: 268px; overflow-y: auto; min-width: 220px;
      scrollbar-width: thin; scrollbar-color: var(--cb-border) transparent;
    }
    #cbt-ac-drop::-webkit-scrollbar { width: 5px; }
    #cbt-ac-drop::-webkit-scrollbar-thumb { background: var(--cb-border); border-radius: 3px; }
    .cbt-ac-hd {
      font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
      color: var(--cb-text2); padding: 8px 12px 6px;
      background: linear-gradient(180deg,#f0f4ff,#f8fafc);
      border-bottom: 1px solid var(--cb-border); position: sticky; top: 0;
    }
    .cbt-ac-item {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--cb-border);
      transition: background .1s;
    }
    .cbt-ac-item:last-child { border-bottom: none; }
    .cbt-ac-item:hover, .cbt-ac-item.on { background: #edf2fb; box-shadow: inset 3px 0 0 var(--cb-blue); }
    .cbt-ac-nm {
      font-family: var(--cb-mono); font-size: 13px; font-weight: 700; color: var(--cb-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cbt-ac-nm mark { background: rgba(41,121,255,.18); color: var(--cb-blue-dim); border-radius: 2px; padding: 0 1px; }
    .cbt-ac-tag { font-size: 10px; font-weight: 700; color: var(--cb-text3); letter-spacing: .05em; text-transform: uppercase; flex-shrink: 0; }
    .cbt-ac-none { padding: 13px 14px; font-size: 13px; color: var(--cb-text3); font-style: italic; text-align: center; }
    .cbt-ac-foot {
      padding: 6px 12px; font-size: 10px; color: var(--cb-text3);
      background: #f8fafc; border-top: 1px solid var(--cb-border); text-align: center;
    }

  `

  /* ══════════════════════════════════════════
     PART 1 — EARLIEST TASK SORTING
  ══════════════════════════════════════════ */
  var _sorting = false, _sortObserver = null, _attached = null;

  /* Collapses a burst of MutationObserver callbacks into one call.
     Four observers watch the whole document; on this dashboard a single
     Angular render can fire hundreds of records, and each callback did a
     full DOM sweep. The work is identical, just done once per burst
     instead of once per mutation. Intervals still cover the same jobs, so
     nothing is lost if a burst is coalesced. */
  function coalesced(fn, ms) {
    var pending = null;
    return function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        try { fn(); } catch (e) {}
      }, ms);
    };
  }

  /* Run non-visual/background work when the browser has breathing room.
     The timeout guarantees the work still happens even on a constantly busy
     dashboard. This is used for duplicated passive API processing and startup
     background syncs, never for the visible Live clock itself. */
  function cbtIdle(fn, timeout) {
    timeout = timeout == null ? 700 : timeout;
    try {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function(){ try { fn(); } catch(e) {} }, { timeout: timeout });
        return;
      }
    } catch(e) {}
    setTimeout(function(){ try { fn(); } catch(e2) {} }, Math.min(timeout, 120));
  }

  /* Let COMO paint its own first frame before this userscript mounts the
     heavier dashboard UI. This removes the small "website freezes, then loads"
     feeling without removing or changing any feature. */
  function cbtAfterFirstPaint(fn, delay) {
    delay = delay == null ? 140 : delay;
    var raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : function(cb){ return setTimeout(cb, 16); };
    raf(function(){
      raf(function(){
        setTimeout(function(){ try { fn(); } catch(e) {} }, delay);
      });
    });
  }

  /* Same idea, but scheduled for the next animation frame instead of a
     timer. Used where a delay would be SEEN: the Time Left column is
     destroyed by the page's own re-render, and anything slower than a frame
     shows up as the value blinking out and back. */
  function coalescedFrame(fn) {
    var pending = false;
    var raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : function (cb) { return setTimeout(cb, 16); };
    return function () {
      if (pending) return;
      pending = true;
      raf(function () {
        pending = false;
        try { fn(); } catch (e) {}
      });
    };
  }

  /* Performance guard:
     Whole-page observers must ignore DOM mutations created by this userscript
     itself. Otherwise every timer/stat/table update can wake another observer,
     which creates needless feedback work on the Amazon page. */
  var CBT_OWN_UI_SELECTOR =
    '#cbt-panel,#cbt-tp,#cbt-qr-overlay,#cbt-afa-overlay,#cbt-ac-drop,.etf-col-cell,.cbt-missing-probe-frame';

  function cbtIsOwnUiNode(node) {
    if (!node) return false;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !el.matches) return false;
    try {
      if (el.matches(CBT_OWN_UI_SELECTOR)) return true;
      return !!(el.closest && el.closest(CBT_OWN_UI_SELECTOR));
    } catch(e) {
      return false;
    }
  }

  function cbtMutationIsOnlyOwnUi(mutation) {
    if (!mutation) return false;
    if (cbtIsOwnUiNode(mutation.target)) return true;

    if (mutation.type !== 'childList') return false;

    var touched = [];
    try {
      touched = touched.concat(Array.prototype.slice.call(mutation.addedNodes || []));
      touched = touched.concat(Array.prototype.slice.call(mutation.removedNodes || []));
    } catch(e) {}

    if (!touched.length) return false;
    for (var i = 0; i < touched.length; i++) {
      if (!cbtIsOwnUiNode(touched[i])) return false;
    }
    return true;
  }

  var _storeTimezoneCache = null;
  var _storeTimezoneCacheAt = 0;
  var _storeTimezoneCacheScope = '';
  var _parseTimeMemo = Object.create(null);
  var _parseTimeMemoDay = '';

  function getStoreTimezone() {
    var nowMs = Date.now();

    /* Scope the cache to the store currently present in the COMO URL. If the
       user switches stores through SPA navigation, the old store's timezone
       is discarded immediately rather than being retained for 10 minutes. */
    var scope = '';
    try {
      var sm = location.pathname.match(/\/store\/([^/]+)/i);
      scope = sm && sm[1] ? sm[1] : (location.host + location.pathname);
    } catch(e0) {
      scope = location.host || '';
    }

    if (_storeTimezoneCache && _storeTimezoneCacheScope === scope &&
        nowMs - _storeTimezoneCacheAt < 10 * 60 * 1000) {
      return _storeTimezoneCache;
    }

    if (_storeTimezoneCacheScope !== scope) {
      _storeTimezoneCache = null;
      _parseTimeMemo = Object.create(null);
      _parseTimeMemoDay = '';
    }

    var tz = null;
    var tzEl = document.querySelector('[class*="timezone"], [class*="time-zone"], .store-time, .current-time');
    if (tzEl) {
      var match = (tzEl.textContent || '').match(/([A-Za-z]+\/[A-Za-z_]+)/);
      if (match) tz = match[1];
    }

    /* This fallback used to serialize document.body.innerHTML once for EVERY
       row, on EVERY sort. On a large COMO dashboard that is expensive.
       Scan it at most once per cache window instead. */
    if (!tz) {
      var bodyText = document.body ? document.body.innerHTML : '';
      var tzMatch = bodyText.match(/America\/[A-Za-z_]+/);
      if (tzMatch) tz = tzMatch[0];
    }

    _storeTimezoneCache = tz || 'America/New_York';
    _storeTimezoneCacheAt = nowMs;
    _storeTimezoneCacheScope = scope;
    return _storeTimezoneCache;
  }

  function parseTime(raw) {
    if (!raw) return null;
    var str = raw.replace(/[^\d:APMapm\s]/g, '').trim();
    var m = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;

    var tz = getStoreTimezone();
    var now = new Date();
    var dateStr;
    try { dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); }
    catch(e0) { dateStr = now.toLocaleDateString('en-CA'); }

    if (_parseTimeMemoDay !== dateStr + '|' + tz) {
      _parseTimeMemoDay = dateStr + '|' + tz;
      _parseTimeMemo = Object.create(null);
    }

    var memoKey = str.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(_parseTimeMemo, memoKey)) {
      return _parseTimeMemo[memoKey];
    }

    var h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
    var ap = m[3] ? m[3].toUpperCase() : null;
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;

    var result = null;
    try {
      var fullStr = dateStr + 'T' + String(h).padStart(2,'0') + ':' + String(mn).padStart(2,'0') + ':00';
      result = new Date(fullStr + ' ' + Intl.DateTimeFormat('en-US', {
        timeZone: tz, timeZoneName: 'short'
      }).formatToParts(now).find(function(p){ return p.type === 'timeZoneName'; }).value).getTime();
      if (isNaN(result)) throw new Error('fallback');
      if (result > Date.now() + 8 * 3600000) result -= 86400000;
    } catch(e) {
      var d = new Date(); d.setHours(h, mn, 0, 0);
      if (d.getTime() > Date.now() + 8 * 3600000) d.setDate(d.getDate() - 1);
      result = d.getTime();
    }

    _parseTimeMemo[memoKey] = result;
    return result;
  }

  function getBatchTarget(card) {
    /* textContent does not force a layout flush; innerText can. */
    var text = card.textContent || '';
    var matches = text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/gi);
    if (!matches) return null;
    var times = matches.map(parseTime).filter(Boolean);
    return times.length ? Math.min.apply(null, times) : null;
  }

  function sortNow(container) {
    if (_sorting) return;
    var cards = Array.from(container.querySelectorAll(':scope > job-card'));
    if (cards.length < 2) return;
    var data = cards.map(function (card) { return { card: card, btMs: getBatchTarget(card) }; });
    data.sort(function (a, b) {
      var hasA = a.btMs != null, hasB = b.btMs != null;
      if (hasA && hasB) return a.btMs - b.btMs;
      if (hasA) return -1; if (hasB) return 1; return 0;
    });
    var current = Array.from(container.querySelectorAll(':scope > job-card'));
    if (data.every(function (item, i) { return item.card === current[i]; })) return;
    _sorting = true;
    var frag = document.createDocumentFragment();
    data.forEach(function (item) { frag.appendChild(item.card); });
    container.appendChild(frag);
    _sorting = false;
  }

  function attach(container) {
    if (_attached === container) return;
    if (_sortObserver) _sortObserver.disconnect();
    _attached = container;
    sortNow(container);
    _sortObserver = new MutationObserver(function (mutations) {
      if (_sorting) return;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'childList') { sortNow(container); return; }
      }
    });
    _sortObserver.observe(container, { childList: true });

    /* Once we have the actual job-card container, stop watching the entire
       Angular document. The local container observer above is sufficient. */
    try {
      if (bodyWatcher) bodyWatcher.disconnect();
      _bodyWatcherStarted = false;
    } catch(e) {}
  }

  function getContainer() {
    var c = document.querySelector('div.container-fluid.job-cards');
    if (c) return c;
    var first = document.querySelector('job-card');
    return first ? first.parentElement : null;
  }

  var _bodyWatcherStarted = false;
  var bodyWatcher = new MutationObserver(coalesced(function () {
    var c = getContainer();
    if (c) attach(c);
  }, 80));

  function ensureSortAttachment() {
    if (!isComoSite() || !isDashboardView()) {
      try { bodyWatcher.disconnect(); } catch(e) {}
      _bodyWatcherStarted = false;
      return;
    }

    var c = getContainer();
    if (c) {
      if (_attached !== c || !_attached || !_attached.isConnected) attach(c);
      return;
    }

    /* Only while the container does not exist do we need a document-wide
       observer. It disconnects itself as soon as attach() succeeds. */
    if (!_bodyWatcherStarted) {
      try {
        bodyWatcher.observe(document.documentElement, { childList: true, subtree: true });
        _bodyWatcherStarted = true;
      } catch(e2) {}
    }
  }

  /* ══════════════════════════════════════════
     PART 2 — TIME LEFT COLUMN
  ══════════════════════════════════════════ */
  function fmtTimeLeft(targetMs) {
    var diffMs  = targetMs - Date.now();
    var diffMin = Math.floor(Math.abs(diffMs) / 60000);
    var diffSec = Math.floor((Math.abs(diffMs) % 60000) / 1000);
    if (diffMs < 0) return { text: 'Overdue ' + diffMin + 'm', cls: 'overdue' };
    if (diffMin < 10) return { text: diffMin + ':' + String(diffSec).padStart(2,'0') + ' left', cls: 'critical' };
    return { text: diffMin + ' min left', cls: 'ok' };
  }

  function findBatchTargetCol(row) {
    var cols = row.querySelectorAll(':scope > div[class*="col-"]');
    for (var i = 0; i < cols.length; i++) {
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cols[i].textContent) ||
          /batch\s*target/i.test(cols[i].textContent)) {
        return { col: cols[i], idx: i };
      }
    }
    return null;
  }

  function injectRowTimer(row) {
    if (row.querySelector('.etf-col-cell')) return;
    var isHeader = row.classList.contains('job-card-header');
    var found = findBatchTargetCol(row);
    if (!found) return;
    var btCol  = found.col;
    var newCol = document.createElement('div');
    newCol.className = 'col-lg-2 etf-col-cell';
    newCol.style.cssText = 'padding-left:5px;padding-right:5px;';
    if (isHeader) {
      newCol.innerHTML = '<span class="etf-col-header">\u23F1 Time Left</span>';
    } else {
      var btRaw = btCol.textContent.replace(/[^\d:APMapm\s]/g, '').trim();
      var m2 = btRaw.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
      var btMs = m2 ? parseTime(m2[0]) : null;
      if (btMs) {
        var result = fmtTimeLeft(btMs);
        newCol.innerHTML = '<span class="etf-timeleft ' + result.cls + '" data-target="' + btMs + '">' + result.text + '</span>';
      } else {
        newCol.innerHTML = '<span class="etf-timeleft ok">\u2014</span>';
      }
    }
    btCol.parentNode.insertBefore(newCol, btCol.nextSibling);
  }

  /* Hoisted: this was a literal inside a doubly-nested loop that runs for
     every job card, every second. Same pattern, allocated once. */
  var EXCLUDED_SECTION_RE = /problem\s*solve|partially\s*batched|staged\s*for\s*pickup/i;

  function isInExcludedSection(el) {
    var node = el;
    while (node && node !== document.body) {
      var prev = node.previousElementSibling;
      while (prev) {
        if (EXCLUDED_SECTION_RE.test(prev.textContent || '')) return true;
        prev = prev.previousElementSibling;
      }
      if (node.parentElement) {
        var parentPrev = node.parentElement.previousElementSibling;
        if (parentPrev && EXCLUDED_SECTION_RE.test(parentPrev.textContent || '')) return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function injectAllTimers() {
    document.querySelectorAll('div.row.job-card-header, job-card').forEach(function(el) {
      if (isInExcludedSection(el)) {
        el.querySelectorAll('.etf-col-cell').forEach(function(col) { col.remove(); });
      }
    });
    document.querySelectorAll('div.row.job-card-header').forEach(function(row) {
      if (isInExcludedSection(row)) return;
      injectRowTimer(row);
    });
    document.querySelectorAll('job-card').forEach(function (card) {
      if (isInExcludedSection(card)) return;
      var row = card.querySelector('div.row');
      if (row) injectRowTimer(row);
    });
  }

  function tickTimers() {
    if (document.hidden || !isDashboardView()) return;
    document.querySelectorAll('.etf-timeleft[data-target]').forEach(function (el) {
      var targetMs = parseInt(el.dataset.target, 10);
      if (!targetMs) return;
      var result = fmtTimeLeft(targetMs);
      var nextClass = 'etf-timeleft ' + result.cls;
      if (el.textContent !== result.text) el.textContent = result.text;
      if (el.className !== nextClass) el.className = nextClass;
    });
  }

  var _timerMutationHosts = new Set();
  var _timerMutationPending = false;

  function queueTimerHost(node) {
    if (!node || node.nodeType !== 1) return;

    var host = null;
    try {
      if (node.matches && node.matches('job-card, div.row.job-card-header')) host = node;
      else if (node.closest) host = node.closest('job-card, div.row.job-card-header');
    } catch(e) {}
    if (host) _timerMutationHosts.add(host);

    try {
      node.querySelectorAll('job-card, div.row.job-card-header').forEach(function(h){
        _timerMutationHosts.add(h);
      });
    } catch(e2) {}
  }

  function refreshTimerHost(host) {
    if (!host || !host.isConnected) return;

    if (isInExcludedSection(host)) {
      try { host.querySelectorAll('.etf-col-cell').forEach(function(col){ col.remove(); }); } catch(e) {}
      return;
    }

    var row = null;
    if (host.matches && host.matches('div.row.job-card-header')) row = host;
    else {
      try { row = host.querySelector('div.row'); } catch(e2) {}
    }
    if (row) injectRowTimer(row);
  }

  function flushTimerMutationHosts() {
    _timerMutationPending = false;
    if (!isDashboardView()) { _timerMutationHosts.clear(); return; }

    var hosts = Array.from(_timerMutationHosts);
    _timerMutationHosts.clear();
    for (var i = 0; i < hosts.length; i++) refreshTimerHost(hosts[i]);
  }

  var timerWatcher = new MutationObserver(function(mutations) {
    if (!isDashboardView()) return;

    var foundRelevant = false;
    for (var i = 0; i < mutations.length; i++) {
      /* Do not react to our own Time Left/stat/table DOM writes. */
      if (cbtMutationIsOnlyOwnUi(mutations[i])) continue;

      foundRelevant = true;
      queueTimerHost(mutations[i].target);
      var added = mutations[i].addedNodes || [];
      for (var j = 0; j < added.length; j++) queueTimerHost(added[j]);
    }

    if (!foundRelevant || _timerMutationPending) return;
    _timerMutationPending = true;
    var raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : function(cb){ return setTimeout(cb, 16); };
    raf(flushTimerMutationHosts);
  });

  /* ══════════════════════════════════════════
     PART 3 — BATCHERS + REMAINING + HOURLY RECOMMEND
  ══════════════════════════════════════════ */

  /* Recommendation design
     ---------------------
     The old recommendation divided remaining PACKAGES by live batcher speed.
     That could recommend "1" even when many carts were due soon.

     v23.9.74 deliberately does NOT use individual associate speed/rate.

     It treats each open batching job/cart as one unit of work and asks:
       "How many concurrent batchers are needed to clear these carts before
        their deadlines / before the next :57 planning point?"

     The recommendation is stable:
       - :57 store time starts a new hourly planning cycle.
       - During a cycle the number may INCREASE when rush/new urgent carts
         arrive, but it never decreases.
       - :55 → :57 is the normal release window, so next-cycle carts do not
         make the old cycle spike for two minutes. Truly urgent/overdue carts
         can still raise the recommendation.
       - At the next :57 the recommendation is recalculated from scratch.

     CONSERVATIVE PLANNING ASSUMPTIONS:
       - EVERY batcher is treated as slow/unpredictable for staffing.
       - One cart consumes 20 planning-minutes of one batcher.
         This is a fixed WORST-CASE planning unit, NOT a measured worker speed.
       - A batcher is reusable: after finishing one cart, they can immediately
         take another. Capacity is therefore worker-minutes across the hour,
         not one permanently assigned batcher per cart.
       - Keep 5 minutes of deadline safety.
       - Reserve 12% extra cart capacity (1–4 carts) for mid-hour rush work.
       - Normal task waves begin around :55 and are finalized at :57.
       - Normal hourly waves run from 2:55 AM through the final 8:55 PM wave.
       - From 9:00 PM until 2:55 AM, no NORMAL hourly wave/reserve is assumed;
         only carts actually present are staffed. Unexpected real carts still count.
       - Overdue carts are treated as needing attention within 8 minutes.
  */

  var CBT_REC_RELEASE_MINUTE       = 57;
  var CBT_REC_RELEASE_FREEZE_START = 55;
  var CBT_REC_FIRST_DROP_HOUR      = 2;   /* 2:55 AM */
  var CBT_REC_LAST_DROP_HOUR       = 20;  /* 8:55 PM */
  var CBT_REC_QUIET_START_HOUR     = 21;  /* 9:00 PM */
  var CBT_REC_CART_MINUTES         = 20;
  var CBT_REC_DEADLINE_BUFFER_MIN  = 5;
  var CBT_REC_OVERDUE_WINDOW_MIN   = 8;
  var CBT_REC_RUSH_RATIO           = 0.12;
  var CBT_REC_RUSH_MIN             = 1;
  var CBT_REC_RUSH_MAX             = 4;
  var CBT_REC_MAX_BATCHERS         = 38;
  var CBT_REC_STATE_PREFIX         = 'cbt_hourly_recommend_v3_schedule_';

  /* Kept only because an older background Drive pull still assigns it.
     Recommendation no longer reads this value. */
  var batchRateCache = 120;

  function cbtRecStoreKey() {
    return String(STORE_ID || 'unknown').replace(/[.$#\[\]\/]/g, '_');
  }

  function cbtRecStateKey() {
    return CBT_REC_STATE_PREFIX + cbtRecStoreKey();
  }

  function cbtRecLoadState() {
    var key = cbtRecStateKey();
    var raw = gmGet(key, null);
    if (raw == null) {
      try { raw = localStorage.getItem(key); } catch(e) {}
    }
    if (!raw) return null;
    try {
      var s = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      return s && typeof s === 'object' ? s : null;
    } catch(e2) { return null; }
  }

  function cbtRecSaveState(state) {
    if (!state) return;
    var key = cbtRecStateKey();
    var json = JSON.stringify(state);
    gmSet(key, json);
    try { localStorage.setItem(key, json); } catch(e) {}
  }

  function cbtRecStoreClock(nowMs) {
    var now = new Date(nowMs || Date.now());
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: getStoreTimezone(),
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).formatToParts(now);

      var o = { year:0, month:0, day:0, hour:0, minute:0, second:0 };
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.type === 'year') o.year = parseInt(p.value,10)||0;
        else if (p.type === 'month') o.month = parseInt(p.value,10)||0;
        else if (p.type === 'day') o.day = parseInt(p.value,10)||0;
        else if (p.type === 'hour') o.hour = parseInt(p.value,10)||0;
        else if (p.type === 'minute') o.minute = parseInt(p.value,10)||0;
        else if (p.type === 'second') o.second = parseInt(p.value,10)||0;
      }
      if (o.hour === 24) o.hour = 0;
      return o;
    } catch(e) {
      return {
        year: now.getFullYear(), month: now.getMonth()+1, day: now.getDate(),
        hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds()
      };
    }
  }

  function cbtRecPad2(n) { return String(n).padStart(2, '0'); }

  function cbtRecIsScheduledDropHour(hour) {
    hour = Number(hour);
    return hour >= CBT_REC_FIRST_DROP_HOUR && hour <= CBT_REC_LAST_DROP_HOUR;
  }

  function cbtRecIsQuietHours(clock) {
    if (!clock) return false;
    var h = Number(clock.hour) || 0;
    var m = Number(clock.minute) || 0;

    /* Quiet period starts at 9:00 PM after the final 8:55 PM wave, and lasts
       until the next day's 2:55 AM wave begins loading. */
    if (h >= CBT_REC_QUIET_START_HOUR || h < CBT_REC_FIRST_DROP_HOUR) return true;
    if (h === CBT_REC_FIRST_DROP_HOUR && m < CBT_REC_RELEASE_FREEZE_START) return true;
    return false;
  }

  function cbtRecCycleInfo(nowMs) {
    var p = cbtRecStoreClock(nowMs);
    var releaseSerial = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0);

    /* Before :57, we are still inside the cycle that began at the PREVIOUS
       hour's :57. */
    if (p.minute < CBT_REC_RELEASE_MINUTE) releaseSerial -= 3600000;

    var rd = new Date(releaseSerial);
    var cycleKey =
      rd.getUTCFullYear() + '-' +
      cbtRecPad2(rd.getUTCMonth()+1) + '-' +
      cbtRecPad2(rd.getUTCDate()) + 'T' +
      cbtRecPad2(rd.getUTCHours()) + ':' +
      cbtRecPad2(CBT_REC_RELEASE_MINUTE);

    var minutesIntoCycle;
    if (p.minute >= CBT_REC_RELEASE_MINUTE) {
      minutesIntoCycle = (p.minute - CBT_REC_RELEASE_MINUTE) + p.second / 60;
    } else {
      minutesIntoCycle = (p.minute + (60 - CBT_REC_RELEASE_MINUTE)) + p.second / 60;
    }

    var toNextRelease = Math.max(0.25, 60 - minutesIntoCycle);
    var scheduledDropHour = cbtRecIsScheduledDropHour(p.hour);
    var quietHours = cbtRecIsQuietHours(p);

    /* :55–:57 is treated as a loading window ONLY during scheduled drop hours.
       At 9:55 PM, 10:55 PM, etc. there is no fake release window because no
       normal task wave is expected. */
    var inReleaseWindow =
      scheduledDropHour &&
      p.minute >= CBT_REC_RELEASE_FREEZE_START &&
      p.minute < CBT_REC_RELEASE_MINUTE;

    return {
      key: cycleKey,
      hour: p.hour,
      minute: p.minute,
      minutesInto: minutesIntoCycle,
      minutesToNextRelease: toNextRelease,
      scheduledDropHour: scheduledDropHour,
      quietHours: quietHours,
      inReleaseWindow: inReleaseWindow
    };
  }

  function cbtRecJobDeadlineMs(job) {
    if (!job || typeof job !== 'object') return null;
    var fields = [
      'jobBatchTarget', 'batchTarget', 'batchTargetTime',
      'targetTime', 'targetTimestamp', 'deadline'
    ];
    for (var i = 0; i < fields.length; i++) {
      var ms = cbtNormalizeEpochMs(job[fields[i]]);
      if (ms) return ms;
    }
    return null;
  }

  function cbtRecIsBatchingWork(job) {
    if (!job || typeof job !== 'object') return false;

    var state = String(job.operationState || job.state || '').toUpperCase();
    var open =
      state === 'IN_PROGRESS' ||
      state === 'NONE' ||
      state === 'BATCHING' ||
      state === 'NOT_STARTED' ||
      state === 'CREATED' ||
      state === 'ASSIGNABLE' ||
      state === 'UNASSIGNABLE';

    if (!open) return false;

    /* Do not staff the Batcher recommendation from Problem Solve / UNPACK
       records when those labels are explicitly present in the summary. */
    var typeText = [
      job.destinationType, job.jobType, job.taskType,
      job.operationType, job.workflowType
    ].filter(Boolean).join(' ').toUpperCase();

    if (typeText.indexOf('UNPACK') !== -1) return false;
    if (typeText.indexOf('PROBLEM') !== -1 && typeText.indexOf('SOLVE') !== -1) return false;

    return true;
  }

  function cbtRecRushReserve(openCount) {
    if (!(openCount > 0)) return 0;
    var r = Math.ceil(openCount * CBT_REC_RUSH_RATIO);
    r = Math.max(CBT_REC_RUSH_MIN, r);
    r = Math.min(CBT_REC_RUSH_MAX, r);
    return r;
  }

  function cbtRecNeedForCount(count, availableMinutes) {
    if (!(count > 0)) return 0;

    var mins = Number(availableMinutes);
    if (!isFinite(mins)) mins = CBT_REC_OVERDUE_WINDOW_MIN;

    /* Once a deadline is missed, the safest task-count-only instruction is
       effectively "one person per overdue cart" until the backlog is caught. */
    if (mins <= 0) mins = CBT_REC_OVERDUE_WINDOW_MIN;

    var effective = Math.max(1, mins - CBT_REC_DEADLINE_BUFFER_MIN);
    var need = Math.ceil((count * CBT_REC_CART_MINUTES) / effective);

    /* More batchers than carts cannot create more parallel cart work. */
    if (need > count) need = count;
    if (need < 1) need = 1;
    return need;
  }

  function cbtRecCalculate(data, nowMs) {
    nowMs = Number(nowMs) || Date.now();
    var cycle = cbtRecCycleInfo(nowMs);

    var jobs = Array.isArray(data)
      ? data.filter(cbtRecIsBatchingWork)
      : [];

    var openCount = jobs.length;
    if (!openCount) {
      return {
        raw: 0, urgentRaw: 0, openCount: 0, rushReserve: 0,
        overdue: 0, dueByNextRelease: 0, earliestMinutes: null,
        cycle: cycle
      };
    }

    var fallbackDeadline = nowMs + cycle.minutesToNextRelease * 60000;
    var rows = [];
    for (var i = 0; i < jobs.length; i++) {
      var dl = cbtRecJobDeadlineMs(jobs[i]) || fallbackDeadline;
      rows.push({ deadline: dl, job: jobs[i] });
    }
    rows.sort(function(a,b){ return a.deadline - b.deadline; });

    var maxNeed = 0;
    var urgentNeed = 0;
    var overdue = 0;
    var dueByNextRelease = 0;
    var nextReleaseMs = nowMs + cycle.minutesToNextRelease * 60000;
    /* Give the normal :57 → :00 handoff a tiny grace so 8:00 targets still
       belong to the ending 7:57 planning hour. */
    var urgentCutoff = nextReleaseMs + 3 * 60000;

    for (var r = 0; r < rows.length; r++) {
      var count = r + 1;
      var minutes = (rows[r].deadline - nowMs) / 60000;
      if (minutes <= 0) overdue++;

      var need = cbtRecNeedForCount(count, minutes);
      if (need > maxNeed) maxNeed = need;

      if (rows[r].deadline <= urgentCutoff) {
        dueByNextRelease = count;
        if (need > urgentNeed) urgentNeed = need;
      }
    }

    /* Rush reserve is used only while NORMAL hourly task waves are active.
       During the :55–:57 loading window, wait for the full wave before locking.
       From 9:00 PM until 2:55 AM, reserve is zero because no normal hourly wave
       is expected; any unexpected cart that actually appears still enters jobs[]
       immediately and can raise the recommendation from real workload. */
    var allowRushReserve = !cycle.inReleaseWindow && !cycle.quietHours;
    var rushReserve = allowRushReserve ? cbtRecRushReserve(openCount) : 0;
    if (allowRushReserve) {
      var plannedCount = openCount + rushReserve;
      var horizonNeed = cbtRecNeedForCount(plannedCount, cycle.minutesToNextRelease);
      if (horizonNeed > maxNeed) maxNeed = horizonNeed;
    }

    /* Final safety cap: never recommend more batchers than there are
       currently open carts on the dashboard. */
    var taskCap = Math.max(0, Math.min(CBT_REC_MAX_BATCHERS, openCount));
    maxNeed = Math.max(1, Math.min(taskCap, maxNeed));
    urgentNeed = Math.max(0, Math.min(taskCap, urgentNeed));

    return {
      raw: maxNeed,
      urgentRaw: urgentNeed,
      openCount: openCount,
      rushReserve: rushReserve,
      overdue: overdue,
      dueByNextRelease: dueByNextRelease,
      earliestMinutes: (rows[0].deadline - nowMs) / 60000,
      cycle: cycle
    };
  }

  function cbtRecLockedValue(calc) {
    if (!calc || !calc.cycle) return 0;

    var state = cbtRecLoadState();
    var cycleKey = calc.cycle.key;
    var taskCap = Math.max(0, Math.min(CBT_REC_MAX_BATCHERS, Number(calc.openCount) || 0));

    if (!state || state.cycleKey !== cycleKey) {
      /* New :57 cycle: create a fresh baseline from the workload that exists
         now. It can rise later, but it will not fall until the next :57. */
      var firstLocked = Math.max(0, Math.min(taskCap, Number(calc.raw) || 0));
      state = {
        cycleKey: cycleKey,
        locked: firstLocked,
        baseline: firstLocked,
        maxRaw: firstLocked,
        startedAt: Date.now(),
        updatedAt: Date.now()
      };
      cbtRecSaveState(state);
      return state.locked;
    }

    /* If open task count falls, the locked recommendation must also fall so
       it never exceeds the current task count visible on the dashboard. */
    var currentLocked = Math.max(0, Math.min(taskCap, Number(state.locked) || 0));
    if (currentLocked !== Number(state.locked)) {
      state.locked = currentLocked;
      state.updatedAt = Date.now();
      cbtRecSaveState(state);
    }

    /* During a SCHEDULED :55–:57 loading window, newly released next-hour
       carts should not make the old hour jump. Overnight :55 timestamps are
       not release windows and therefore do not trigger this rule. */
    var candidate = calc.cycle.inReleaseWindow ? calc.urgentRaw : calc.raw;
    candidate = Math.max(0, Math.min(taskCap, Number(candidate) || 0));

    if (candidate > (Number(state.locked) || 0)) {
      state.locked = candidate;
      state.maxRaw = Math.max(Number(state.maxRaw)||0, candidate);
      state.updatedAt = Date.now();
      cbtRecSaveState(state);
    }

    return Math.max(0, Math.min(taskCap, Number(state.locked) || 0));
  }

  function cbtRecTooltip(calc, recommended) {
    if (!calc) return '';
    var parts = [];

    parts.push('Locked hourly target: ' + recommended);
    parts.push('slow-plan: 20m/cart · batchers reuse capacity after each cart');
    parts.push(calc.openCount + ' open cart' + (calc.openCount === 1 ? '' : 's'));

    if (calc.overdue > 0) {
      parts.push(calc.overdue + ' overdue');
    } else if (calc.earliestMinutes != null && isFinite(calc.earliestMinutes)) {
      parts.push('earliest due in ' + Math.max(0, Math.round(calc.earliestMinutes)) + 'm');
    }

    if (calc.rushReserve > 0) parts.push('+' + calc.rushReserve + ' rush reserve');
    if (calc.cycle && calc.cycle.quietHours) parts.push('overnight: no normal hourly drop expected');
    parts.push('resets at next :57 store time');

    return parts.join(' · ');
  }

  var _statsDomCache = {
    inProgress: null,
    remaining: null,
    recommended: null,
    deltaText: null,
    deltaClass: null,
    dotColor: null,
    recTitle: null
  };

  function updateStats(inProgress, remaining, recommended, dotColor, recTitle) {
    var elIP    = document.getElementById('cbt-stat-ip');
    var elRem   = document.getElementById('cbt-stat-rem');
    var elRec   = document.getElementById('cbt-stat-rec');
    var elDot   = document.getElementById('cbt-stat-dot');
    var elDelta = document.getElementById('cbt-stat-delta');

    var recText = recommended != null ? String(recommended) : '—';

    /* +N = need N more batchers; -N = N extra batchers. */
    var actualNum = Number(inProgress);
    var recNum = Number(recommended);
    var deltaText = '';
    var deltaClass = '';
    var deltaTitle = '';

    if (isFinite(actualNum) && isFinite(recNum) && recNum >= 0) {
      var diff = recNum - actualNum;
      if (diff > 0) {
        deltaText = '+' + diff;
        deltaClass = 'need-more';
        deltaTitle = 'Need ' + diff + ' more batcher' + (diff === 1 ? '' : 's');
      } else if (diff < 0) {
        var extra = Math.abs(diff);
        deltaText = '-' + extra;
        deltaClass = 'extra';
        deltaTitle = extra + ' extra batcher' + (extra === 1 ? '' : 's');
      }
    }

    if (elIP && _statsDomCache.inProgress !== inProgress) {
      elIP.textContent = inProgress;
      _statsDomCache.inProgress = inProgress;
    }
    if (elRem && _statsDomCache.remaining !== remaining) {
      elRem.textContent = remaining;
      _statsDomCache.remaining = remaining;
    }
    if (elRec && _statsDomCache.recommended !== recText) {
      elRec.textContent = recText;
      _statsDomCache.recommended = recText;
    }
    if (elDelta &&
        (_statsDomCache.deltaText !== deltaText || _statsDomCache.deltaClass !== deltaClass)) {
      elDelta.textContent = deltaText;
      elDelta.className = deltaClass;
      elDelta.title = deltaTitle;
      _statsDomCache.deltaText = deltaText;
      _statsDomCache.deltaClass = deltaClass;
    }
    if (elRec && recTitle && _statsDomCache.recTitle !== recTitle) {
      elRec.title = recTitle;
      _statsDomCache.recTitle = recTitle;
    }
    if (elDot && dotColor && _statsDomCache.dotColor !== dotColor) {
      elDot.style.background = dotColor;
      elDot.style.boxShadow = '0 0 6px ' + dotColor;
      _statsDomCache.dotColor = dotColor;
    }

    var old = document.getElementById('etf-ps-stats');
    if (old) old.remove();
  }

  function removeFromHeader() {
    /* Direct ID lookup avoids re-querying/serializing the page header every
       stats refresh. This only removes the same legacy element as before. */
    var old = document.getElementById('etf-stats');
    if (old) old.remove();
  }

  var _statsFetchInFlight = false;
  function fetchAndUpdate() {
    if (_statsFetchInFlight || document.hidden) return;
    _statsFetchInFlight = true;
    removeFromHeader();

    /* Use the original fetch for this script-owned stats request so our global
       passive JSON interceptor does not parse/process the same payload twice. */
    _origFetch(COMO_BASE + '/api/store/' + STORE_ID + '/activeJobSummary?_cbt=' + Date.now(), {
      cache: 'no-store',
      credentials: 'include'
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data)) data = [];

        var staffingJobs = data.filter(cbtRecIsBatchingWork);
        var inProgress = staffingJobs.filter(function (j) {
          var st = String(j.operationState || j.state || '').toUpperCase();
          return st === 'IN_PROGRESS' || st === 'BATCHING';
        }).length;

        /* Remaining stays package-based because that stat is useful as a
           package backlog indicator. It is NOT used by Recommended anymore. */
        var expected  = staffingJobs.reduce(function (s, j) {
          return s + (Number(j.totalExpectedPackages) || 0);
        }, 0);
        var batched   = staffingJobs.reduce(function (s, j) {
          return s + (Number(j.packagesBatched) || 0);
        }, 0);
        var collected = staffingJobs.reduce(function (s, j) {
          return s + (Number(j.packagesCollected) || 0);
        }, 0);
        var remaining = Math.max(0, expected - (batched + collected));

        var calc = cbtRecCalculate(data, Date.now());
        var recommended = cbtRecLockedValue(calc);

        /* Recommended now means MINIMUM staffing target.
           Having more batchers than Recommended is not an error. */
        var dotColor = 'gray';
        if (recommended > 0) {
          if (inProgress >= recommended) {
            dotColor = '#3fb950';
          } else {
            var deficit = recommended - inProgress;
            var coverage = recommended > 0 ? inProgress / recommended : 1;
            dotColor = (deficit >= 3 || coverage < 0.75) ? '#f85149' : '#e3b341';
          }
        }

        updateStats(
          inProgress,
          remaining,
          recommended,
          dotColor,
          cbtRecTooltip(calc, recommended)
        );
        removeFromHeader();
      })
      .catch(function () {})
      .then(function(){ _statsFetchInFlight = false; });
  }

  /* ══════════════════════════════════════════
     PART 4 — BATCHER TIMER PANEL
  ══════════════════════════════════════════ */
  var POLL_MS = 2000, TICK_MS = 500;
  var WARN_ELAPSED_MIN = 15, ALERT_ELAPSED_MIN = 25;
  var WARN_RATE = 2.1, ALERT_RATE = 1.5;

  /* Trusted-rate guardrail.
     COMO packagesBatched is cumulative for the current job. A cumulative
     package count must never be divided by a newer/reset BATCHING sub-operation
     start. Rates above this ceiling are treated as invalid rather than shown
     or stored as real performance. */
  var CBT_MAX_VALID_RATE = 20;
  var CBT_OBS_RATE_MIN_WINDOW_MS = 30000;
  var _cbtObservedProgressByRef = Object.create(null);

  /* LIVE ELAPSED / CLOCK STABILITY
     --------------------------------
     Live time is derived from the CURRENT BATCHING operation returned by the
     authoritative active-jobs feed.  Passive page/API responses are still
     useful for names/package counts, but they are not allowed to choose or
     replace a live timer start.

     Important protections:
       - timestamps are normalized whether COMO sends seconds, milliseconds,
         microseconds, or an ISO timestamp;
       - when operationDetails contains more than one BATCHING operation,
         cumulative packages use the EARLIEST credible BATCHING start for that
         same job, preventing a newer sub-operation from resetting the timer;
       - the first authoritative start is locked, but the API may correct that
         lock BACKWARD if it later reveals an earlier credible start;
       - a reused cart/shortClientRef is recognized as a NEW job by job id,
         task id, created time, or a changed start after a missing-data gap;
       - removed carts keep their lock only briefly, not for hours;
       - when the response exposes an HTTP Date header, elapsed time runs from
         a monotonic server-calibrated clock, so a bad/changing workstation
         clock cannot make the timer jump or show the wrong duration. */
  var _cbtBackendLastOk = 0;
  var _cbtLiveStartByRef = Object.create(null);
  var _cbtMissingPollsByRef = Object.create(null);
  var CBT_MISSING_POLL_GRACE = 3;                 // ~6s at the 2s poll rate
  var CBT_START_RETAIN_AFTER_MISSING_MS = 30000;  // enough for a transient API gap
  var CBT_START_CACHE_TTL_MS = 15 * 60 * 1000;
  var CBT_MAX_LIVE_AGE_MS = 12 * 60 * 60 * 1000;

  var _cbtClockAnchorServerMs = null;
  var _cbtClockAnchorPerfMs = null;
  var _cbtClockLastNowMs = 0;

  function cbtPerfNow() {
    try {
      if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch(e) {}
    return Date.now();
  }

  function cbtNowMs() {
    var now;
    if (_cbtClockAnchorServerMs != null && _cbtClockAnchorPerfMs != null) {
      now = _cbtClockAnchorServerMs + (cbtPerfNow() - _cbtClockAnchorPerfMs);
    } else {
      now = Date.now();
    }
    if (!isFinite(now)) now = Date.now();
    /* A clock used for an elapsed timer must never go backwards, even if the
       device clock is corrected while the page is open. */
    if (now < _cbtClockLastNowMs) now = _cbtClockLastNowMs;
    else _cbtClockLastNowMs = now;
    return now;
  }

  function cbtCalibrateServerClock(response, requestPerfMs) {
    try {
      if (!response || !response.headers || typeof response.headers.get !== 'function') return;
      var raw = response.headers.get('date') || response.headers.get('Date');
      if (!raw) return;
      var serverMs = Date.parse(raw);
      if (!isFinite(serverMs)) return;
      var receivePerf = cbtPerfNow();
      var halfRtt = Math.max(0, Math.min(2000, (receivePerf - requestPerfMs) / 2));
      var candidateNow = serverMs + halfRtt;

      if (_cbtClockAnchorServerMs == null || _cbtClockAnchorPerfMs == null) {
        _cbtClockAnchorServerMs = candidateNow;
        _cbtClockAnchorPerfMs = receivePerf;
        _cbtClockLastNowMs = candidateNow;
        return;
      }

      /* HTTP Date is normally whole-second precision. Do not re-anchor for
         sub-second rounding noise. Only correct a material (>5s) drift, such
         as the workstation clock being changed while the page is open. */
      var anchoredNow = _cbtClockAnchorServerMs + (receivePerf - _cbtClockAnchorPerfMs);
      if (Math.abs(candidateNow - anchoredNow) > 5000) {
        _cbtClockAnchorServerMs = candidateNow;
        _cbtClockAnchorPerfMs = receivePerf;
        if (candidateNow > _cbtClockLastNowMs) _cbtClockLastNowMs = candidateNow;
      }
    } catch(e) {}
  }

  function cbtNormalizeEpochMs(value) {
    if (value == null || value === '') return null;

    if (typeof value === 'string' && !/^[-+]?\d+(?:\.\d+)?$/.test(value.trim())) {
      var parsed = Date.parse(value);
      return isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    var n = Number(value);
    if (!isFinite(n) || n <= 0) return null;

    /* Current epoch values are roughly:
         seconds      1.7e9
         milliseconds 1.7e12
         microseconds 1.7e15
         nanoseconds  1.7e18 */
    if (n >= 1e17) n = n / 1000000;
    else if (n >= 1e14) n = n / 1000;
    else if (n < 1e11) n = n * 1000;

    return isFinite(n) && n > 0 ? n : null;
  }

  function cbtTaskGeneration(data) {
    if (!data || typeof data !== 'object') return '';

    /* Prefer stable job/task identities. A generic `id` is still deliberately
       excluded because different COMO payload shapes can use it for unrelated
       objects that happen to describe the same cart. */
    var fields = ['jobId','jobID','taskId','taskID','jobUuid','jobUUID','taskUuid','taskUUID'];
    for (var i = 0; i < fields.length; i++) {
      var v = data[fields[i]];
      if (v != null && String(v).trim()) return 'job:' + String(v).trim();
    }

    /* Creation time is a stable fallback identity, but is NEVER used as the
       elapsed timer start. */
    var createdFields = ['created','createdAt','creationTime','createdTime'];
    for (var c = 0; c < createdFields.length; c++) {
      var createdMs = cbtNormalizeEpochMs(data[createdFields[c]]);
      if (createdMs) return 'created:' + Math.round(createdMs);
    }

    /* Last-resort identity only. Use the EARLIEST BATCHING start because the
       package counter is cumulative across BATCHING sub-operations. */
    var ops = Array.isArray(data.operationDetails) ? data.operationDetails : [];
    var earliest = Infinity;
    for (var j = 0; j < ops.length; j++) {
      var op = ops[j];
      if (!op || String(op.name || '').toUpperCase() !== 'BATCHING') continue;
      var ms = cbtNormalizeEpochMs(op.start);
      if (ms && ms < earliest) earliest = ms;
    }
    return isFinite(earliest) ? 'batch:' + Math.round(earliest) : '';
  }

  function cbtBatchingOpInfo(data, liveOnly) {
    if (!data || typeof data !== 'object') return null;
    var ops = Array.isArray(data.operationDetails) ? data.operationDetails : [];
    var wholeState = String(data.state || '').toUpperCase();
    var candidates = [];
    var hasLiveEvidence = wholeState === 'BATCHING';

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!op || String(op.name || '').toUpperCase() !== 'BATCHING') continue;

      var startMs = cbtNormalizeEpochMs(op.start);
      if (!startMs) continue;

      var endMs = cbtNormalizeEpochMs(op.end);
      var opState = String(op.state || op.operationState || '').toUpperCase();
      var explicitActive =
        opState === 'IN_PROGRESS' ||
        opState === 'STARTED' ||
        opState === 'ACTIVE';
      var explicitDone =
        opState === 'COMPLETED' ||
        opState === 'COMPLETE' ||
        opState === 'FINISHED' ||
        opState === 'DONE';

      if (explicitActive) hasLiveEvidence = true;

      var credible = true;
      if (liveOnly && _cbtClockAnchorServerMs != null) {
        var nowMs = cbtNowMs();
        if (startMs > nowMs + 5 * 60 * 1000) credible = false;
        if (startMs < nowMs - CBT_MAX_LIVE_AGE_MS) credible = false;
      }

      if (!credible) continue;
      candidates.push({
        op: op,
        startMs: startMs,
        endMs: endMs,
        explicitActive: explicitActive,
        explicitDone: explicitDone,
        state: opState
      });
    }

    if (!candidates.length) return null;
    if (liveOnly && !hasLiveEvidence) return null;

    /* packagesBatched is cumulative for the job. Therefore the matching time
       interval must begin at the EARLIEST credible BATCHING start, not at a
       later BATCHING sub-operation that may have appeared after packages were
       already counted. */
    var earliest = candidates[0];
    var latestEnd = null;
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j].startMs < earliest.startMs) earliest = candidates[j];
      if (candidates[j].endMs && (!latestEnd || candidates[j].endMs > latestEnd)) {
        latestEnd = candidates[j].endMs;
      }
    }

    return {
      op: earliest.op,
      startMs: earliest.startMs,
      endMs: latestEnd,
      live: !!liveOnly,
      state: earliest.state
    };
  }

  function cbtRawBatchingStartMs(data, liveOnly) {
    var info = cbtBatchingOpInfo(data, !!liveOnly);
    return info ? info.startMs : null;
  }

  function cbtIsLiveBatch(data) {
    if (!data || typeof data !== 'object') return false;
    if (String(data.state || '').toUpperCase() === 'BATCHING') return true;
    var ops = Array.isArray(data.operationDetails) ? data.operationDetails : [];
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!op || String(op.name || '').toUpperCase() !== 'BATCHING') continue;
      var st = String(op.state || op.operationState || '').toUpperCase();
      if (st === 'IN_PROGRESS' || st === 'STARTED' || st === 'ACTIVE') return true;
    }
    return false;
  }

  function cbtObserveAuthoritativeLive(data) {
    if (!cbtIsLiveBatch(data) || !data.shortClientRef) return null;
    var ref = String(data.shortClientRef);
    var info = cbtBatchingOpInfo(data, true);
    if (!info || !info.startMs) return null;

    var now = cbtNowMs();
    var generation = cbtTaskGeneration(data);
    var cur = _cbtLiveStartByRef[ref];
    var replace = !cur;

    if (cur) {
      var oldGen = String(cur.generation || '');
      var newGen = String(generation || '');
      var bothBatchFallbacks =
        oldGen.indexOf('batch:') === 0 &&
        newGen.indexOf('batch:') === 0;

      /* Strong/created identity change means a genuinely new job. For the
         unstable last-resort batch:start identity, do not call it a new job
         while the cart has remained continuously present; the API may simply
         have revealed an earlier operation. */
      if (generation && cur.generation && generation !== cur.generation) {
        if (!(bothBatchFallbacks && !cur.missingSince)) replace = true;
      }

      /* A cart that disappeared and later returns with a different real start
         is a new batch even if no strong identity was available. */
      if (!replace && cur.missingSince && Math.abs(info.startMs - cur.ms) > 1000) {
        replace = true;
      }
    }

    if (replace) {
      cur = _cbtLiveStartByRef[ref] = {
        ms: info.startMs,
        generation: generation,
        lastSeen: now,
        missingSince: 0,
        source: 'api-earliest'
      };
      delete _cbtObservedProgressByRef[ref];
    } else {
      /* Critical v23.9.74 fix: for the SAME job, an authoritative API update
         may correct the clock only BACKWARD. It can never shorten elapsed time
         by introducing a newer BATCHING sub-operation. */
      if (info.startMs < cur.ms - 1000) {
        cur.ms = info.startMs;
        cur.source = 'api-corrected-earlier';
      }
      if (!cur.generation && generation) cur.generation = generation;
      else if (generation && String(cur.generation || '').indexOf('batch:') === 0 &&
               String(generation).indexOf('batch:') === 0) {
        cur.generation = generation;
      }
      cur.lastSeen = now;
      cur.missingSince = 0;
    }
    return cur.ms;
  }

  function cbtStableLiveStartMs(data, isLive) {
    if (!data || typeof data !== 'object') return null;
    var ref = data.shortClientRef != null ? String(data.shortClientRef) : '';
    var generation = cbtTaskGeneration(data);
    var cur = ref ? _cbtLiveStartByRef[ref] : null;

    if (cur) {
      /* Missing identity on a partial response is NOT a reason to reject the
         existing lock. If an actual new job generation is present, wait for
         that new task's own BATCHING start instead of borrowing the old one. */
      if (!generation || !cur.generation || generation === cur.generation) return cur.ms;
    }

    if (isLive) {
      /* Important fallback: activeJobsWithSiteSummary does not always carry
         operationDetails in every deployment/response. If another current COMO
         response contains the real BATCHING operation, allow it to seed the
         clock ONCE. We never use `created` for a live timer and never replace a
         same-generation lock after it has been chosen. */
      var info = cbtBatchingOpInfo(data, true);
      if (info && info.startMs) {
        if (!ref) return info.startMs;

        var now = cbtNowMs();
        var fresh = {
          ms: info.startMs,
          generation: generation,
          lastSeen: now,
          missingSince: 0,
          source: 'observed-live'
        };

        /* Different generation = the cart has a new batch, so a new start is
           correct. Otherwise only fill a missing lock; do not twitch between
           multiple timestamps. */
        if (!cur || (generation && cur.generation && generation !== cur.generation)) {
          _cbtLiveStartByRef[ref] = fresh;
          return fresh.ms;
        }

        return cur.ms;
      }

      return null;
    }

    /* For a finished batch, use the latest BATCHING operation if the live lock
       is unavailable, then fall back to created so history is not discarded. */
    var opMs = cbtRawBatchingStartMs(data, false);
    if (opMs) return opMs;
    return cbtNormalizeEpochMs(data.created);
  }

  function cbtForgetLiveStart(ref) {
    if (ref == null) return;
    ref = String(ref);
    try { delete _cbtLiveStartByRef[ref]; } catch(e) {}
    try { delete _cbtMissingPollsByRef[ref]; } catch(e) {}
    try { delete _cbtObservedProgressByRef[ref]; } catch(e) {}
  }

  function cbtMarkLiveMissing(ref) {
    ref = String(ref);
    var cur = _cbtLiveStartByRef[ref];
    if (cur && !cur.missingSince) cur.missingSince = cbtNowMs();
  }

  function cbtPruneOldLiveStarts() {
    var now = cbtNowMs();
    Object.keys(_cbtLiveStartByRef).forEach(function(ref) {
      var e = _cbtLiveStartByRef[ref];
      var expiredMissing = e && e.missingSince && (now - e.missingSince > CBT_START_RETAIN_AFTER_MISSING_MS);
      var expiredIdle = !e || !e.lastSeen || (now - e.lastSeen > CBT_START_CACHE_TTL_MS);
      if (expiredMissing || expiredIdle) {
        try { delete _cbtLiveStartByRef[ref]; } catch(err) {}
        try { delete _cbtMissingPollsByRef[ref]; } catch(err2) {}
        try { delete _cbtObservedProgressByRef[ref]; } catch(err3) {}
      }
    });
  }

  var STORAGE_KEY = 'cbt_history', DATE_KEY = 'cbt_history_date';
  var WEEKLY_KEY = 'cbt_weekly_history', WEEKLY_DAYS = 7;
  var ALL_NAMES_KEY = 'cbt_all_names';
  var DEVICE_ID_KEY  = 'cbt_device_id';

  // Persistent device ID — generated once, lives in GM storage forever
  function getDeviceId() {
    var id = gmGet(DEVICE_ID_KEY, null);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      gmSet(DEVICE_ID_KEY, id);
    }
    return id;
  }
  var MY_DEVICE_ID = null; // set in start()

  // ── Firebase Realtime Database sync ──
  // All three syncs (names, today, weekly) use your Firebase project.
  // Names use PATCH — server-side merge means a push can never remove
  // another computer's names at the database level.
  // History and weekly use per-device PUT paths so each computer only
  // touches its own slice; pulls read the full tree and sum other devices.
  var FIREBASE_URL          = 'https://como-sync-default-rtdb.firebaseio.com';
  var FIREBASE_NAMES_PATH   = '/como_names.json';
  var FIREBASE_HISTORY_PATH = '/como_history_v2.json';
  var FIREBASE_WEEKLY_PATH  = '/como_weekly_v2.json';
  function syncEnabled()    { return true; }
  function syncUrl()        { return FIREBASE_URL + FIREBASE_NAMES_PATH; }
  function syncHistoryUrl() { return FIREBASE_URL + FIREBASE_HISTORY_PATH; }
  function syncWeeklyUrl()  { return FIREBASE_URL + FIREBASE_WEEKLY_PATH; }
  function syncHistoryDeviceUrl(devId) { return FIREBASE_URL + '/como_history_v2/devices/' + devId + '.json'; }
  function syncHistoryMetaUrl(devId)   { return FIREBASE_URL + '/como_history_v2/meta/' + devId + '.json'; }
  function syncWeeklyDeviceUrl(devId)  { return FIREBASE_URL + '/como_weekly_v2/devices/'  + devId + '.json'; }
  function syncWeeklyMetaUrl(devId)    { return FIREBASE_URL + '/como_weekly_v2/meta/' + devId + '.json'; }

  // ── Own vs Remote cache keys ──
  // OWN = only this device's recorded batches (pushed to Pantry)
  // REMOTE_CACHE = sum of all OTHER devices' slices (rebuilt on pull, never pushed)
  var OWN_WEEKLY_KEY            = 'cbt_own_weekly';
  var WEEKLY_PERIOD_KEY         = 'cbt_weekly_period_start';
  var REMOTE_HISTORY_KEY        = 'cbt_remote_history_cache';
  var REMOTE_HISTORY_DATE_KEY   = 'cbt_remote_history_date';
  var REMOTE_WEEKLY_KEY         = 'cbt_remote_weekly_cache';
  var REMOTE_WEEKLY_PERIOD_KEY  = 'cbt_remote_weekly_period_start';
  var HISTORY_SYNC_SCHEMA_KEY   = 'cbt_history_sync_schema_v2';
  var WEEKLY_SYNC_SCHEMA_KEY    = 'cbt_weekly_sync_schema_v2';

  var taskCache = new Map();
  var activeTab = 'live';

  var _liveRenderPending = false;
  function requestLiveRender() {
    /* Do not rebuild a hidden/non-mounted Live table. Data still updates in
       taskCache and renders immediately when Live becomes visible.

       The Live table body is #cbt-tbody. v23.9.24 accidentally checked a
       different/nonexistent ID, so taskCache filled but the first Live render
       was skipped until the user switched tabs. */
    if (activeTab !== 'live') return;
    if (!document.getElementById('cbt-tbody')) return;
    if (_liveRenderPending) return;

    _liveRenderPending = true;
    var raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : function(cb){ return setTimeout(cb, 16); };

    raf(function(){
      _liveRenderPending = false;
      if (activeTab === 'live' && document.getElementById('cbt-tbody')) {
        try { renderLive(); } catch(e) {}
      }
    });
  }
  var weeklySortKey = 'bestRate', weeklySortAsc = false, weeklySearchTerm = '';
  var liveSortKey = 'rate', liveSortAsc = false, liveSearchTerm = '';
  /* Set once the user actually clicks a Live column header. Until then the
     list keeps its default behaviour of floating LOW batchers to the top. */
  var liveSortUser = false;
  var historySortKey = 'bestRate', historySortAsc = false, historySearchTerm = '';
  var namesSearchTerm = '';
  var hofSearchTerm = '';
  /* One name-only search term is shared across every Batcher Timers tab.
     Switching tabs keeps the same associate query instead of clearing it. */
  var dashboardSearchTerm = '';
  var _allNamesCache = null;

  function todayStr() {
    /* Today is the STORE'S calendar day, not the workstation's timezone.
       This makes every computer roll Today at the same store midnight. */
    try {
      return new Date().toLocaleDateString('en-US', { timeZone: getStoreTimezone() });
    } catch(e) {
      return new Date().toLocaleDateString('en-US');
    }
  }

  function cbtDateKeyParts(dateKey) {
    var m = String(dateKey || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    var mo = parseInt(m[1], 10), d = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (!mo || !d || !y) return null;
    return { y:y, m:mo, d:d };
  }

  function cbtDateKeyEpoch(dateKey) {
    var p = cbtDateKeyParts(dateKey);
    return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN;
  }

  function cbtDateKeyFromEpoch(ms) {
    var d = new Date(ms);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + d.getUTCFullYear();
  }

  function cbtWeekStartForDateKey(dateKey) {
    var ms = cbtDateKeyEpoch(dateKey);
    if (!isFinite(ms)) return null;
    var dow = new Date(ms).getUTCDay(); /* Sunday = 0 */
    return cbtDateKeyFromEpoch(ms - dow * 86400000);
  }

  function currentWeekStartStr() {
    return cbtWeekStartForDateKey(todayStr()) || todayStr();
  }

  function cbtIsDateInCurrentWeek(dateKey) {
    var day = cbtDateKeyEpoch(dateKey);
    var start = cbtDateKeyEpoch(currentWeekStartStr());
    if (!isFinite(day) || !isFinite(start)) return false;
    return day >= start && day < start + 7 * 86400000;
  }

  function fmt(s) {
    if (s == null || isNaN(s) || s < 0) return '--:--';
    return String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(Math.floor(s % 60)).padStart(2,'0');
  }
  function fmtHours(s) {
    if (!s) return '0h';
    var h = s / 3600;
    return h >= 1 ? h.toFixed(1) + 'h' : Math.round(s / 60) + 'm';
  }

  // loadWeekly / saveWeekly — OWN batches only. Never stores remote data.
  // Weekly is a true calendar week: Sunday 12:00 AM through Saturday 11:59 PM.
  function loadWeekly() {
    var currentWeek = currentWeekStartStr();
    var storedPeriod = null;
    try { storedPeriod = gmGet(WEEKLY_PERIOD_KEY, null); } catch(e0) {}
    if (!storedPeriod) {
      try { storedPeriod = localStorage.getItem(WEEKLY_PERIOD_KEY); } catch(e1) {}
    }

    var result = {};
    try {
      var gm = gmGet(OWN_WEEKLY_KEY, null) || gmGet(WEEKLY_KEY, null);
      if (gm) result = (typeof gm === 'string') ? JSON.parse(gm) : gm;
    } catch(e2) {}
    try {
      var ls = JSON.parse(localStorage.getItem(OWN_WEEKLY_KEY) || localStorage.getItem(WEEKLY_KEY) || '{}');
      for (var dk in ls) {
        if (!result[dk]) result[dk] = {};
        for (var a in ls[dk]) { if (!result[dk][a]) result[dk][a] = ls[dk][a]; }
      }
    } catch(e3) {}

    /* First run after upgrading: keep only dates that belong to THIS week.
       A real week transition is handled by cbtResetTodayForNewDay(), which
       explicitly clears the local weekly slice before pushing it. */
    result = sanitizeWeekly(result || {});

    if (storedPeriod !== currentWeek) {
      gmSet(WEEKLY_PERIOD_KEY, currentWeek);
      try { localStorage.setItem(WEEKLY_PERIOD_KEY, currentWeek); } catch(e4) {}
    }

    return result;
  }

  function saveWeekly(w, skipPush, periodKey) {
    _dispWeekCache = null;
    var currentWeek = periodKey || currentWeekStartStr();
    var clean = sanitizeWeekly(w || {});
    var json = JSON.stringify(clean);
    gmSet(OWN_WEEKLY_KEY, json);
    gmSet(WEEKLY_PERIOD_KEY, currentWeek);
    try {
      localStorage.setItem(OWN_WEEKLY_KEY, json);
      localStorage.setItem(WEEKLY_PERIOD_KEY, currentWeek);
    } catch(e) {}
    if (!skipPush) {
      setTimeout(function(){ if (typeof syncWeeklyPush === 'function') syncWeeklyPush(); }, 0);
    }
  }

  // Remote weekly cache — other devices' data summed on pull, NEVER pushed.
  function loadRemoteWeekly() {
    var currentWeek = currentWeekStartStr();
    var period = null;
    try { period = gmGet(REMOTE_WEEKLY_PERIOD_KEY, null); } catch(e0) {}
    if (!period) {
      try { period = localStorage.getItem(REMOTE_WEEKLY_PERIOD_KEY); } catch(e1) {}
    }
    if (period !== currentWeek) return {};

    try {
      var gm = gmGet(REMOTE_WEEKLY_KEY, null);
      if (gm) return sanitizeWeekly((typeof gm === 'string') ? JSON.parse(gm) : gm);
    } catch(e2) {}
    try { return sanitizeWeekly(JSON.parse(localStorage.getItem(REMOTE_WEEKLY_KEY) || '{}')); }
    catch(e3) { return {}; }
  }

  function saveRemoteWeekly(w, periodKey) {
    _dispWeekCache = null;
    var currentWeek = periodKey || currentWeekStartStr();
    var clean = sanitizeWeekly(w || {});
    var json = JSON.stringify(clean);
    gmSet(REMOTE_WEEKLY_KEY, json);
    gmSet(REMOTE_WEEKLY_PERIOD_KEY, currentWeek);
    try {
      localStorage.setItem(REMOTE_WEEKLY_KEY, json);
      localStorage.setItem(REMOTE_WEEKLY_PERIOD_KEY, currentWeek);
    } catch(e) {}
    // Never push — this is display-only aggregated data
  }

  // Display caches — avoid re-parsing JSON from storage on every keystroke/render.
  // Short TTL keeps date-rollover working; saves invalidate immediately.
  var _dispWeekCache = null, _dispWeekTime = 0;
  var _dispHistCache = null, _dispHistTime = 0;

  function cbtMergeLatestFields(target, source) {
    if (!target || !source) return;
    var sourceRate = Number(source.lastRate);
    if (!(sourceRate > 0) || !isFinite(sourceRate)) return;

    var targetRate = Number(target.lastRate);
    var sourceAt = Number(source.lastAt) || 0;
    var targetAt = Number(target.lastAt) || 0;

    if (!(targetRate > 0) || sourceAt > targetAt || (sourceAt === targetAt && sourceAt === 0)) {
      target.lastRate = sourceRate;
      target.lastAt = sourceAt;
    }
  }

  function cbtMergeBestFields(target, source) {
    if (!target || !source) return;

    /* v23.9.74+ stores bestRate explicitly. For older cached rows, use the
       strongest recoverable value (bestRate -> lastRate -> avgRate). */
    var candidate = Math.max(
      Number(source.bestRate) || 0,
      Number(source.lastRate) || 0,
      Number(source.avgRate) || 0
    );

    if (!(candidate > 0) || !isFinite(candidate)) return;
    if (!(Number(target.bestRate) > 0) || candidate > Number(target.bestRate)) {
      target.bestRate = candidate;
    }
  }

  // Merge own + remote for display only.
  // The current day's Today report is overlaid as today's Weekly slice so a
  // batcher appears in Weekly immediately — not one day later at rollover.
  function getDisplayWeekly() {
    var _now = Date.now();
    if (_dispWeekCache && (_now - _dispWeekTime) < 1500) return _dispWeekCache;
    var own    = sanitizeWeekly(loadWeekly());
    var remote = sanitizeWeekly(loadRemoteWeekly());
    var out = {};

    function addSlice(slice) {
      for (var dk in slice) {
        if (!cbtIsDateInCurrentWeek(dk)) continue;
        if (!out[dk]) out[dk] = {};
        for (var a in slice[dk]) {
          var r = slice[dk][a];
          if (!out[dk][a]) {
            out[dk][a] = { totalPkgs: r.totalPkgs||0, totalSec: r.totalSec||0, runs: r.runs||0,
              totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0,
              bestRate: null, lastRate: null, lastAt: 0 };
            cbtMergeBestFields(out[dk][a], r);
            cbtMergeLatestFields(out[dk][a], r);
          } else {
            out[dk][a].totalPkgs    += r.totalPkgs    || 0;
            out[dk][a].totalSec     += r.totalSec     || 0;
            out[dk][a].runs         += r.runs         || 0;
            out[dk][a].totalMissing += r.totalMissing || 0;
            out[dk][a].totalExpected+= r.totalExpected|| 0;
            cbtMergeBestFields(out[dk][a], r);
            cbtMergeLatestFields(out[dk][a], r);
          }
        }
      }
    }

    addSlice(own);
    addSlice(remote);

    /* Today's source of truth is Today itself. Replace any stale/legacy
       current-day weekly slice instead of adding it and double-counting. */
    var td = todayStr();
    delete out[td];

    var today = sanitizeHistory(getDisplayHistory());
    var todayKeys = Object.keys(today);
    if (todayKeys.length) {
      out[td] = {};
      for (var i = 0; i < todayKeys.length; i++) {
        var assoc = todayKeys[i], r2 = today[assoc];
        out[td][assoc] = {
          totalPkgs: r2.totalPkgs||0,
          totalSec: r2.totalSec||0,
          runs: r2.runs||0,
          totalMissing: r2.totalMissing||0,
          totalExpected: r2.totalExpected||0,
          bestRate: Math.max(Number(r2.bestRate)||0, Number(r2.lastRate)||0, Number(r2.avgRate)||0) || null,
          lastRate: Number(r2.lastRate) > 0 ? Number(r2.lastRate) : null,
          lastAt: Number(r2.lastAt) || 0
        };
      }
    }

    _dispWeekCache = out; _dispWeekTime = _now;
    return out;
  }

  function gmGet(key, def) {
    try { if (typeof GM_getValue === 'function') { var v = GM_getValue(key); return (v===undefined||v===null) ? def : v; } } catch(e) {}
    return def;
  }
  function gmSet(key, val) {
    try { if (typeof GM_setValue === 'function') { GM_setValue(key, val); return true; } } catch(e) {}
    return false;
  }

  // ── Text size (zoom) for the main Batcher Timer panel ──
  /* ══════════════════════════════════════
     UI SCALE

     One scale for everything this script draws — board, popups, dropdowns
     and anything added later — so nothing is left behind at a fixed size.
     Applied with CSS zoom on each surface's root, which scales layout as
     well as text, so rows, columns, padding and icons all grow together
     and stay aligned instead of overlapping.

     It only ever touches elements this script created. The dashboard
     itself is never zoomed, and the browser's own zoom is untouched.
     Deliberately a NEW storage key, so everyone starts at a clean 100%.
  ══════════════════════════════════════ */
  var HEADER_FIXED_SCALE = 1.3;      /* header bar: constant, never scaled */
  var STATS_FIXED_SCALE  = 1.3;      /* Batchers / Recommended / Remaining: constant 130% */
  var MISSING_QR_FIXED_SCALE = 1.3;  /* Missing Package QR results: constant 130% */
  var UI_SCALE_KEY  = 'cbt_ui_scale';
  var UI_SCALE_MIN  = 0.7, UI_SCALE_MAX = 2.0, UI_SCALE_STEP = 0.1, UI_SCALE_DEFAULT = 1;
  var _uiScale = UI_SCALE_DEFAULT;

  function clampUiScale(v) {
    v = parseFloat(v);
    if (!v || isNaN(v)) v = UI_SCALE_DEFAULT;
    return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(v * 100) / 100));
  }
  function loadUiScale() {
    var raw = gmGet(UI_SCALE_KEY, null);
    if (raw == null) { try { raw = localStorage.getItem(UI_SCALE_KEY); } catch(e) {} }
    if (raw == null) return UI_SCALE_DEFAULT;          /* first run: 100% */
    return clampUiScale(raw);
  }
  function saveUiScale(v) {
    gmSet(UI_SCALE_KEY, String(v));
    try { localStorage.setItem(UI_SCALE_KEY, String(v)); } catch(e) {}
  }

  /* Every root this script owns. Popups are scaled on their inner card, not
     their full-screen backdrop, so the backdrop still covers the viewport
     exactly and the card stays centred at any size. */
  var _uiScaleLoaded = false;
  function applyUiScale() {
    /* Read the saved size the first time anything is drawn, so a panel that
       mounts before startup finishes still comes up at the chosen size
       instead of snapping back to 100%. */
    if (!_uiScaleLoaded) {
      _uiScaleLoaded = true;
      try { _uiScale = loadUiScale(); } catch(e) {}
    }
    var z = _uiScale;
    var panel = document.getElementById('cbt-panel');
    if (panel) {
      /* The header bar is pinned at 130% and deliberately ignores A- / A+,
         so it stays a constant anchor while the content below resizes. */
      var hdr = panel.querySelector('#cbt-header');
      if (hdr) hdr.style.zoom = HEADER_FIXED_SCALE;

      /* v23.9.74: pin the three-number stats row at the same 130% as the
         header. A- / A+ must never resize Batchers, Recommended This Hour,
         or Remaining. */
      var stats = panel.querySelector('#cbt-stats-bar');
      if (stats) stats.style.zoom = STATS_FIXED_SCALE;

      /* Only the tabs/search/table area below the fixed stats row follows
         the A- / A+ scale controls. */
      ['#cbt-tabs', '#cbt-unified-search', '#cbt-body', '#cbt-drag-bottom'].forEach(function(sel){
        var el = panel.querySelector(sel);
        if (el) el.style.zoom = z;
      });
    }
    var tp = document.getElementById('cbt-tp');
    if (tp) { tp.style.zoom = z; }

    /* The QR popup is intentionally left out: it keeps its own fixed size
       and its plain white styling in both day and night mode. */
    var afa = document.getElementById('cbt-afa-card');
    if (afa) {
      /* Only the Missing Package QR result view is pinned at 130%.
         A- / A+ can continue resizing the normal Cart Actions menu, but they
         can never resize the generated Missing/Cart QR codes. */
      var afaScale = afa.classList.contains('cbt-afa-missing-qr-card')
        ? MISSING_QR_FIXED_SCALE
        : z;

      afa.style.zoom = afaScale;
      afa.style.maxHeight = Math.round((window.innerHeight * 0.82) / afaScale) + 'px';
      afa.style.maxWidth  = Math.round((window.innerWidth  * 0.92) / afaScale) + 'px';
    }
    var drop = document.getElementById('cbt-ac-drop');
    if (drop) {
      drop.style.zoom = z;
      try { acPlace(); } catch(e) {}   /* re-anchor: zoom changes its metrics */
    }
    var label = document.getElementById('cbt-scale-reset');
    if (label) label.textContent = Math.round(z * 100) + '%';
  }

  /* Which theme is active right now. The board carries the truth once it
     exists; before that fall back to the stored preference. */
  function isDarkMode() {
    var p = document.getElementById('cbt-panel');
    if (p) return p.classList.contains('dark');
    try {
      var v = localStorage.getItem('cbt_dark');
      return v !== 'false' && v !== '0';
    } catch(e) { return true; }
  }

  /* Popups live on <body>, outside the board, so they cannot inherit its
     .dark class — they get their own marker instead. */
  function applyPopupTheme() {
    var dark = isDarkMode();
    ['cbt-afa-overlay', 'cbt-ac-drop'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.classList.toggle('cbt-dark', dark);
    });
  }

  function setUiScale(v, skipSave) {
    _uiScale = clampUiScale(v);
    if (!skipSave) saveUiScale(_uiScale);
    applyUiScale();
  }
  function stepUiScale(dir) { setUiScale(_uiScale + dir * UI_SCALE_STEP); }
  function resetUiScale()   { setUiScale(UI_SCALE_DEFAULT); }

  // ── Text size (zoom) for the Associate Search (task detail) panel ──
  var TP_FONT_SCALE_KEY = 'cbt_tp_font_scale';
  function loadTpFontScale() {
    var raw = gmGet(TP_FONT_SCALE_KEY, null);
    if (raw == null) { try { raw = localStorage.getItem(TP_FONT_SCALE_KEY); } catch(e) {} }
    var v = parseFloat(raw);
    if (!v || isNaN(v)) v = 1;
    return Math.min(2.0, Math.max(0.7, v));
  }
  function saveTpFontScale(v) {
    gmSet(TP_FONT_SCALE_KEY, String(v));
    try { localStorage.setItem(TP_FONT_SCALE_KEY, String(v)); } catch(e) {}
  }
  function applyTpFontScale(tp, scale) {
    if (!tp) return;
    var body = tp.querySelector('#cbt-tp-body');
    if (body) body.style.zoom = scale;
  }

  /* ══════════════════════════════════════
     BUILT-IN NAME ROSTER

     Baked into the script so a brand new install shows the full
     names list immediately, without waiting on a Pantry pull (and
     even if Pantry is down). Merged additively in loadAllNames:
     it only ever ADDS names, never removes captured ones. Also
     feeds the union push, so installing this script anywhere
     re-seeds the shared basket automatically.
  ══════════════════════════════════════ */
  var SEED_NAMES = [
    'aamarinp','abahmam','abbececi','abcam','abdldiop','abdouhdi','abdrayae','aboiguiw',
    'abrekenn','absoumao','adamjkev','adarpinc','aeltayea','afriksad','ajeffang','ajfofana',
    'alapasov','alayalst','alcisseo','alcmayor','aliceaed','alisonko','alphasoh','alpoliak',
    'alwnicho','alybalbe','amadoufb','amambald','amifmbow','aminpsan','amyreyei','andhjaim',
    'andijime','andricba','andruang','angecjos','angegerr','angelvif','angicohe','anrosalg',
    'anthrort','antwileo','antzeigl','anzaisma','aouantho','arafaabo','aramadia','aranerwi',
    'arlingma','arnolzie','ashbcruz','ashchhab','aspcompa','auberete','axevgali','baabdouy',
    'bagagnaz','baldemaq','bamamads','bamelony','barsoulj','basilsid','basnsyll','baspndao',
    'batomadi','bbarioua','bcissali','bdavtiff','bdawperr','bdialmam','bedhamed','bellocr',
    'benelomo','bengoce','benjxall','binsains','blasanay','bmadial','boikovik','bolivchr',
    'boubamba','boydgsad','boytanix','brandguk','briandih','bsamanca','bueqferm','burgwjay',
    'bushrbus','bvalleaa','cadamirt','camarmu','camuouma','candesem','cantesek','caquialv',
    'cardbjar','carllaca','carmfall','carrdiey','catmayor','cdiaousm','cespjohn','chaaceve',
    'chaplumm','charjff','chavjala','cheilcor','cheinkeb','cheisecd','chungsik','chxwashi',
    'chynnshu','cisibraa','cissuman','cixromer','cjolatee','clarzave','clauraym','clemenew',
    'clemityl','coasekou','coefiu','cofabias','conairol','condeib','conyyzza','cooppetc',
    'craipsta','cruanthr','cruengol','cuencjus','daantoia','dadoucou','dafodema','daireval',
    'dalomotn','daniupag','danniven','danuniql','danvallu','daquemur','davkrod','davoplea',
    'delbnash','dembasnd','denmit','dffries','dgmarie','dgodfrda','diadamad','diagnepa',
    'diahouss','dialamal','dialdaol','diallamq','diallokc','dialmaa','dialsism','dianmamo',
    'diaruism','dicaurm','diejocel','diithier','dinilvia','diokhaai','diomalto','diopras',
    'disouleg','divhario','djfbarry','djimrbas','dnadgill','dnivasq','dobsoshu','dozieni',
    'dracheim','dramgatt','dsofgino','dsukhcsi','dumamad','dvibrahi','eanrahma','ebrahbar',
    'ebrdeand','ecafriyi','edaodafa','ehhichez','ejwte','elaloada','elguerie','elhacezy',
    'elijmate','elmokhtr','eperlonj','erneqtor','espilorn','estjiord','evanjenr','evelagye',
    'famizama','faninima','fatalidu','fatimtoc','fatsanka','fbrissac','fcissmar','fcryvarg',
    'fezmerce','fgatlich','figuojef','fistoure','fmavanes','fmbirane','fortugre','freddzun',
    'galeangu','ganthoc','garcicaj','garcidmy','garyeria','gaskimch','gbalelha','gbeezoro',
    'gcomlanw','gcoredga','gdaiacal','genterre','gerrlale','gerushaw','ghoshhri','gilfoter',
    'gmakhou','gomeande','gomjoelh','gonzasle','goodmf','gosankan','grewmaha','grgojam',
    'gsteveje','guaringu','guendabd','guerxamy','guthjalm','guzanahi','haleemib','hannacob',
    'hatoumam','hcandici','helejon','henwsuar','heqxavie','herfalex','herrjonp','hhuekenn',
    'hibradia','hilliawj','hjoshuth','hkasal','hmamabar','holtdarn','hoytashl','hshawsmi',
    'hylyedim','hymjeavo','ibkamaga','ibrahdim','ibrahly','ibrahsyw','ibrahydr','ibrahyuf',
    'ibrsibdi','igargeov','iigordo','ijeudbea','iliacomp','imejerik','imjawara','imohtrao',
    'inrosann','iousanga','irvramio','isgconde','isialexs','isolkath','istaflor','jadcruzl',
    'jadrorti','jahbagol','jahkgres','jaitehmr','jamadeor','jambentw','jamelhic','jamzeron',
    'jasmoliu','javomccr','jaydelae','jaysatte','jcojorda','jddieppa','jeanjamd','jefhargr',
    'jehronhi','jelssycu','jenkantj','jeramirf','jersenlo','jezduran','jireespi','jjaquian',
    'jjoshun','jmicadol','joekamar','johlramo','johnbrim','jonattpe','josearab','joseekpo',
    'josupenc','juqxl','juscintr','justyjhe','juvalwda','kabaidre','kabmamay','kadiabag',
    'kadizbah','kaneybab','kaseebiw','kbaibrah','kdanvers','kecortew','kefimkab','keiraabo',
    'kellevyo','kemodouk','kensohen','kevicobo','kforjudi','khariop','kizilugu','knelskay',
    'krubf','ksebarom','kvictpen','lajacksa','lakjarea','lanctour','landioma','lansanca',
    'lantonit','laujdors','lazelled','lderobin','lebracks','lecheikh','leivdomi','lenmartj',
    'lesakati','levyaman','lismarro','litxmigu','lmadiall','lmajoh','lmedoune','lopmfran',
    'lpsm','lrosemal','lsiemitc','lthiedia','lucinago','luelizau','luihesca','luisdagu',
    'maantl','mabdelkz','mackmtra','madecast','mahamafp','mahpmoh','mamabab','mamabhau',
    'mamaksac','mambahi','mambaldn','marferny','marrgess','martikke','martimop','martnnlu',
    'martrabe','marudial','matalavg','mayxstev','mbeaubru','mbenguaq','mendujua','mendvicc',
    'merceaav','mesorana','meverth','michakpi','micheolo','micnathr','milvelez','minjesie',
    'mitjavan','mkaderab','mkevinri','mkkamag','mkmaimou','mlennalm','mmahsoum','mmentobu',
    'modysarr','mohabonk','mohamhor','mohhorma','molagran','montaldj','montjosl','moorleec',
    'morgewai','morrijup','morydiaw','motbab','mtejadda','muhaadno','mullingk','muscheqm',
    'mustahap','mveleant','naaskitc','naclearm','naquasr','natanthz','natvargv','nayabsan',
    'nazcruz','nelsisaa','netolent','nfjustin','nfrancie','ngibtale','nishabel','nisvkama',
    'njordawa','nkburgos','nkeid','nlonceni','nmousmoh','nolpjeme','nsecisse','nuhubila',
    'nundaisb','occeafre','ogaldeja','ogunkasz','ojamjade','olanaugu','olayatoh','omamaroa',
    'oraynaro','osarkaba','ouldmall','oumcherh','oumocomp','owilaniy','owusdkof','ozamoraa',
    'pablflox','pahmkabe','patrwdow','pceesarj','pearsoit','pemakond','penaroby','perejill',
    'persamil','perzpred','petteaur','pexjayde','pindatra','pmamfall','powequen','prakhyag',
    'prasiddg','pringmah','prjenish','qchamord','qcmayfie','qfeif','qgajohn','qostimot',
    'quameela','qugarciy','quilcarg','rabayube','rafrosab','raineyci','ralfpauw','ramorash',
    'ramstout','raymjonw','raymukta','rbfrandy','rdukomar','redominq','ridrisdi','rmamabal',
    'rmarlalm','robelijg','rodoetha','rodrzyes','rokurtis','romaryll','romasea','rooinnoc',
    'roscahli','rosjar','roventuq','royontho','rthokell','rudegou','rujoshux','ryohsant',
    'sackmamq','saidobay','sajnashg','salcpasc','samarmo','sambemag','sanolmou','sanyefru',
    'sappmalb','saseedia','savaneut','sawnain','sbrkaysh','scamaraa','scolliju','sdiallom',
    'sekofcam','sekouaxk','serralal','seymodqx','seynabgu','shadiebe','shamzabd','sharqalh',
    'shawnqch','shervini','sidibadd','sidqibra','silvelud','sirng','smihchr','smittril',
    'snfelici','soabdol','solinemm','solinoan','sotbilal','sozjohan','sramanw','stachone',
    'stesancn','stevmper','stnabreu','sybakart','syllmas','syzuriel','talondah','tamarmsm',
    'tamidmaj','tanguiju','taveaman','tazbtanz','tbowdent','tdialabo','tedariel','terelmun',
    'terrcgre','thcolliu','thiernes','thifdial','thsalter','thwamata','timotjco','tjohanze',
    'tkemoham','tmadial','topsebas','torcstac','toriilia','torluisv','touxmoha','traosaid',
    'tribthov','tsalybar','tsanchor','tvdiallo','tyasmi','ualtoure','ucalixte','uchambil',
    'uheamill','ulauretu','urearlyj','urenabee','ureroben','urgrisel','usaymahf','valdzand',
    'valnjes','varjesup','vcamajol','velezisn','verasjer','vicaira','viciisan','victoepe',
    'vincspai','vmamadb','vshanire','wabdiall','waldlyri','whlondyn','wilennsa','wiljosx',
    'willyalm','wilsalyk','wirashaj','wirpierr','wmamadd','wmamsidi','woodtame','woohblai',
    'wrigdiav','wsoashle','xalherna','xavieari','xcepanth','xdfrance','xfahadmu','xharlake',
    'xjaviere','yadieari','yanezsai','ybangour','ycasluis','yedelaro','yinetmor','ylopdavi',
    'youlahma','yousiahv','yzeidial','zbarrabd','zdialmam','zeloabig','zjeralyn','zjesluis',
    'zmahmodi'
  ];

  function loadAllNames() {
    if (_allNamesCache) return _allNamesCache;
    try {
      var raw = gmGet(ALL_NAMES_KEY, null);
      if (raw) { _allNamesCache = (typeof raw === 'string') ? JSON.parse(raw) : raw; }
    } catch(e) { _allNamesCache = null; }
    if (!_allNamesCache || typeof _allNamesCache !== 'object') _allNamesCache = {};
    try {
      var legacy = JSON.parse(localStorage.getItem(ALL_NAMES_KEY) || '{}');
      var merged = false;
      for (var lk in legacy) { if (!_allNamesCache[lk]) { _allNamesCache[lk] = legacy[lk]; merged = true; } }
      if (merged) gmSet(ALL_NAMES_KEY, JSON.stringify(_allNamesCache));
    } catch(e) {}
    // Fold in the built-in roster. Additive only: a name already stored
    // keeps its captured spelling, and nothing is ever removed.
    var seeded = false;
    for (var si = 0; si < SEED_NAMES.length; si++) {
      var sname = SEED_NAMES[si];
      var skey = sname.toLowerCase();
      if (!_allNamesCache[skey]) { _allNamesCache[skey] = sname; seeded = true; }
    }
    if (seeded) {
      var sjson = JSON.stringify(_allNamesCache);
      gmSet(ALL_NAMES_KEY, sjson);
      try { localStorage.setItem(ALL_NAMES_KEY, sjson); } catch(e) {}
    }
    return _allNamesCache;
  }
  var _namesSaveTimer = null;
  function persistAllNames() {
    if (_namesSaveTimer) return;
    _namesSaveTimer = setTimeout(function(){
      _namesSaveTimer = null;
      var json = JSON.stringify(_allNamesCache||{});
      gmSet(ALL_NAMES_KEY, json);
      try { localStorage.setItem(ALL_NAMES_KEY, json); } catch(e) {}
    }, 100);
  }

  // ── Names sync readiness gate ──
  // A push may not fire until the FIRST pull has completed (the Pantry
  // server answered), so a fresh install with an empty local list can
  // never clobber the shared basket. Pushes requested before that moment
  // are queued and flushed right after the first pull finishes.
  var _namesPulled = false;
  var _namesPushQueued = false;
  var _namesFirstPullRetry = null; // 5s retry loop until the first pull succeeds

  // Additive merge: absorb remote names into the local list. Never removes.
  function mergeRemoteNamesIntoLocal(remote) {
    var all = loadAllNames();
    var added = false;
    for (var k in remote) {
      if (!all[k] && typeof remote[k] === 'string') { all[k] = remote[k]; added = true; }
    }
    if (added) { persistAllNames(); if (activeTab === 'names') renderNames(); }
    return added;
  }

  // True when the local list holds names the basket does not — i.e. the
  // basket is behind (first-ever install, or basket data loss) and a
  // re-seeding push is needed to bring it back to the full union.
  function localNamesMissingFromRemote(remote) {
    var all = loadAllNames();
    for (var k in all) { if (!remote[k]) return true; }
    return false;
  }

  function syncPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          var added = false, localExtra = false;
          try {
            var remote = {};
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              remote = JSON.parse(res.responseText) || {};
            }
            // Firebase stores names flat: { "key": "Name", ... }
            added = mergeRemoteNamesIntoLocal(remote);
            localExtra = localNamesMissingFromRemote(remote);
          } catch(e) {}
          _namesPulled = true;
          if (_namesPushQueued || localExtra) {
            _namesPushQueued = false;
            syncPush();
          }
          if (cb) cb(added);
        },
        onerror: function(){
          if (!_namesPulled && !_namesFirstPullRetry) {
            _namesFirstPullRetry = setTimeout(function(){ _namesFirstPullRetry = null; syncPull(); }, 5000);
          }
          if (cb) cb(false);
        }
      });
    } catch(e) {
      if (!_namesPulled && !_namesFirstPullRetry) {
        _namesFirstPullRetry = setTimeout(function(){ _namesFirstPullRetry = null; syncPull(); }, 5000);
      }
      if (cb) cb(false);
    }
  }
  var _syncPushTimer = null;
  function syncPush() {
    if (!syncEnabled()) return;
    if (!_namesPulled) { _namesPushQueued = true; return; }
    if (_syncPushTimer) return;
    _syncPushTimer = setTimeout(function(){
      _syncPushTimer = null;
      try {
        var all = loadAllNames();
        // Firebase PATCH merges at the top level server-side — existing keys
        // are never removed. A push from any computer can only ADD names,
        // never shrink or overwrite the shared list. No read-before-write needed.
        GM_xmlhttpRequest({
          method: 'PATCH', url: syncUrl(),
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(all),
          onload: function(){},
          onerror: function(){ _namesPushQueued = true; }
        });
      } catch(e) {}
    }, 2500);
  }

  // ── History sync (push/pull) ──
  // Same readiness pattern as the names sync: pushes wait for the first
  // pull, failed pushes requeue instead of blind-posting, and the first
  // pull retries every 5s until Pantry answers. A blind POST on a failed
  // read used to replace the shared basket with ONLY this device's slice,
  // erasing every other device's data — that is what made each computer's
  // dashboard drift apart.
  var _histPulled = false;
  var _histPushQueued = false;
  var _histFirstPullRetry = null;
  var _weeklyPulled = false;
  var _weeklyPushQueued = false;
  var _weeklyFirstPullRetry = null;
  var _syncHistoryPushTimer = null;
  function syncHistoryPush() {
    if (!syncEnabled()) return;
    if (!_histPulled) { _histPushQueued = true; return; }
    if (_syncHistoryPushTimer) return;
    _syncHistoryPushTimer = setTimeout(function(){
      _syncHistoryPushTimer = null;
      try {
        var devId = MY_DEVICE_ID || getDeviceId();
        var mySlice = sanitizeHistory(loadHistory());
        // PUT to this device's own path — Firebase only updates this one
        // node, leaving every other device's slice completely untouched.
        GM_xmlhttpRequest({
          method: 'PUT', url: syncHistoryDeviceUrl(devId),
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(mySlice),
          onload: function(){
            /* Date metadata is a sibling node so old script versions can keep
               reading the flat device history without seeing fake associates. */
            try {
              GM_xmlhttpRequest({
                method: 'PUT', url: syncHistoryMetaUrl(devId),
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ date: todayStr(), updatedAt: Date.now(), schema: 2 }),
                onload: function(){ gmSet(HISTORY_SYNC_SCHEMA_KEY, '2'); },
                onerror: function(){ _histPushQueued = true; }
              });
            } catch(e2) { _histPushQueued = true; }
          },
          onerror: function(){ _histPushQueued = true; }
        });
      } catch(e) {}
    }, 2500);
  }
  var _histPullInFlight = false;
  var _lastHistoryPullAt = 0;

  function syncHistoryPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    if (_histPullInFlight) { if (cb) cb(false); return; }
    _histPullInFlight = true;

    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncHistoryUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          _histPullInFlight = false;
          _lastHistoryPullAt = Date.now();

          var changed = false;
          _histPulled = true;
          if (_histPushQueued) { _histPushQueued = false; syncHistoryPush(); }

          try {
            var remoteCache = {};
            var currentDay = todayStr();

            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              var basket = JSON.parse(res.responseText);
              if (basket && typeof basket === 'object') {
                var devId = MY_DEVICE_ID || getDeviceId();
                var devices = (basket.devices && typeof basket.devices === 'object') ? basket.devices : {};
                var meta = (basket.meta && typeof basket.meta === 'object') ? basket.meta : {};
                var anyModernMeta = Object.keys(meta).length > 0;

                for (var d in devices) {
                  if (d === devId) continue;

                  var md = meta[d];
                  var deviceDate = md && typeof md === 'object' ? md.date : null;

                  /* Modern slices are accepted ONLY for today's store date.
                     This is the key guarantee that yesterday cannot reappear
                     after midnight because another PC was asleep/offline. */
                  if (deviceDate && deviceDate !== currentDay) continue;

                  /* Legacy v23.9.31-and-older device nodes have no date
                     metadata. Keep them only while the Firebase basket has no
                     modern metadata at all, so an all-old installation still
                     migrates once. As soon as v23.9.74 devices are present,
                     undated stale nodes are not allowed into Today. */
                  if (!deviceDate && anyModernMeta) continue;

                  var slice = sanitizeHistory(devices[d] || {});
                  for (var a in slice) {
                    var r = slice[a];
                    if (!remoteCache[a]) {
                      remoteCache[a] = { assoc: r.assoc||a, totalPkgs: r.totalPkgs||0,
                        totalSec: r.totalSec||0, runs: r.runs||0,
                        totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0,
                        bestRate: null, lastRate: null, lastAt: 0 };
                      cbtMergeBestFields(remoteCache[a], r);
                      cbtMergeLatestFields(remoteCache[a], r);
                    } else {
                      remoteCache[a].totalPkgs     += r.totalPkgs     || 0;
                      remoteCache[a].totalSec      += r.totalSec      || 0;
                      remoteCache[a].runs          += r.runs          || 0;
                      remoteCache[a].totalMissing  += r.totalMissing  || 0;
                      remoteCache[a].totalExpected += r.totalExpected || 0;
                      cbtMergeBestFields(remoteCache[a], r);
                      cbtMergeLatestFields(remoteCache[a], r);
                    }
                  }
                }
              }
            }

            for (var a2 in remoteCache) {
              remoteCache[a2].avgRate = remoteCache[a2].totalSec > 0
                ? remoteCache[a2].totalPkgs / (remoteCache[a2].totalSec / 60) : 0;
            }

            var oldRemote = loadRemoteHistory();
            var oldJson = JSON.stringify(sanitizeHistory(oldRemote || {}));
            var newJson = JSON.stringify(sanitizeHistory(remoteCache || {}));

            if (oldJson !== newJson || gmGet(REMOTE_HISTORY_DATE_KEY, null) !== currentDay) {
              saveRemoteHistory(remoteCache, currentDay);
              changed = true;

              if (document.getElementById('cbt-hist-tbody')) {
                setTimeout(function(){ try { renderHistory(); } catch(e) {} }, 0);
              }
            }
          } catch(e) {}

          if (cb) cb(changed);
        },
        onerror: function(){
          _histPullInFlight = false;
          if (!_histPulled && !_histFirstPullRetry) {
            _histFirstPullRetry = setTimeout(function(){ _histFirstPullRetry = null; syncHistoryPull(); }, 5000);
          }
          if (cb) cb(false);
        }
      });
    } catch(e) {
      _histPullInFlight = false;
      if (!_histPulled && !_histFirstPullRetry) {
        _histFirstPullRetry = setTimeout(function(){ _histFirstPullRetry = null; syncHistoryPull(); }, 5000);
      }
      if (cb) cb(false);
    }
  }

  // ── Weekly sync (push/pull) ──
  var _syncWeeklyPushTimer = null;
  function syncWeeklyPush() {
    if (!syncEnabled()) return;
    if (!_weeklyPulled) { _weeklyPushQueued = true; return; }
    if (_syncWeeklyPushTimer) return;
    _syncWeeklyPushTimer = setTimeout(function(){
      _syncWeeklyPushTimer = null;
      try {
        var devId = MY_DEVICE_ID || getDeviceId();
        var mySlice = sanitizeWeekly(loadWeekly());
        // PUT to this device's own weekly path — only updates this device's slice
        GM_xmlhttpRequest({
          method: 'PUT', url: syncWeeklyDeviceUrl(devId),
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(mySlice),
          onload: function(){
            try {
              GM_xmlhttpRequest({
                method: 'PUT', url: syncWeeklyMetaUrl(devId),
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                  weekStart: currentWeekStartStr(),
                  updatedAt: Date.now(),
                  schema: 2
                }),
                onload: function(){ gmSet(WEEKLY_SYNC_SCHEMA_KEY, '2'); },
                onerror: function(){ _weeklyPushQueued = true; }
              });
            } catch(e2) { _weeklyPushQueued = true; }
          },
          onerror: function(){ _weeklyPushQueued = true; }
        });
      } catch(e) {}
    }, 2500);
  }
  var _weeklyPullInFlight = false;
  var _lastWeeklyPullAt = 0;

  function cbtAddWeeklySlice(target, slice) {
    slice = sanitizeWeekly(slice || {});
    for (var dk in slice) {
      if (!cbtIsDateInCurrentWeek(dk)) continue;
      if (!target[dk]) target[dk] = {};
      for (var a in slice[dk]) {
        var r = slice[dk][a];
        if (!target[dk][a]) {
          target[dk][a] = {
            totalPkgs: r.totalPkgs||0,
            totalSec: r.totalSec||0,
            runs: r.runs||0,
            totalMissing: r.totalMissing||0,
            totalExpected: r.totalExpected||0,
            bestRate: null,
            lastRate: null,
            lastAt: 0
          };
          cbtMergeBestFields(target[dk][a], r);
          cbtMergeLatestFields(target[dk][a], r);
        } else {
          target[dk][a].totalPkgs     += r.totalPkgs     || 0;
          target[dk][a].totalSec      += r.totalSec      || 0;
          target[dk][a].runs          += r.runs          || 0;
          target[dk][a].totalMissing  += r.totalMissing  || 0;
          target[dk][a].totalExpected += r.totalExpected || 0;
          cbtMergeBestFields(target[dk][a], r);
          cbtMergeLatestFields(target[dk][a], r);
        }
      }
    }
  }

  function cbtLooksLikeWeeklyRoot(obj) {
    if (!obj || typeof obj !== 'object') return false;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      /* Existing weekly keys are locale dates such as 8/12/2026. */
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(k) && obj[k] && typeof obj[k] === 'object') {
        return true;
      }
    }
    return false;
  }

  function syncWeeklyPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    if (_weeklyPullInFlight) { if (cb) cb(false); return; }
    _weeklyPullInFlight = true;

    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncWeeklyUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          _weeklyPullInFlight = false;
          _lastWeeklyPullAt = Date.now();

          var changed = false;
          _weeklyPulled = true;
          if (_weeklyPushQueued) { _weeklyPushQueued = false; syncWeeklyPush(); }

          try {
            var remoteCache = {};

            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              var basket = JSON.parse(res.responseText);
              if (basket && typeof basket === 'object') {
                var devId = MY_DEVICE_ID || getDeviceId();
                var currentWeek = currentWeekStartStr();
                var devices = (basket.devices && typeof basket.devices === 'object') ? basket.devices : {};
                var meta = (basket.meta && typeof basket.meta === 'object') ? basket.meta : {};
                var anyModernMeta = Object.keys(meta).length > 0;
                var deviceKeys = Object.keys(devices);
                var usedDeviceData = false;

                for (var i = 0; i < deviceKeys.length; i++) {
                  var d = deviceKeys[i];
                  if (d === devId) continue;

                  var md = meta[d];
                  var deviceWeek = md && typeof md === 'object' ? md.weekStart : null;

                  /* New-week guarantee: a sleeping/offline computer that still
                     has LAST week's slice cannot repopulate the new Weekly tab. */
                  if (deviceWeek && deviceWeek !== currentWeek) continue;

                  /* Once modern metadata exists, undated legacy device slices
                     are not allowed to leak an unknown/old period into Weekly. */
                  if (!deviceWeek && anyModernMeta) continue;

                  var node = devices[d];

                  /* Be tolerant if a future/experimental build wrapped weekly
                     data in {data:{...}}. Current versions remain flat. */
                  var slice = (node && node.data && cbtLooksLikeWeeklyRoot(node.data))
                    ? node.data
                    : node;

                  if (cbtLooksLikeWeeklyRoot(slice)) {
                    cbtAddWeeklySlice(remoteCache, slice);
                    usedDeviceData = true;
                  }
                }

                /* One-time legacy migration only while the Firebase weekly tree
                   contains no modern week metadata at all. sanitizeWeekly()
                   still limits that legacy map to this Sunday-Saturday week. */
                if (!usedDeviceData && !anyModernMeta && cbtLooksLikeWeeklyRoot(basket)) {
                  cbtAddWeeklySlice(remoteCache, basket);
                } else if (!usedDeviceData && !anyModernMeta && basket.shared && cbtLooksLikeWeeklyRoot(basket.shared)) {
                  cbtAddWeeklySlice(remoteCache, basket.shared);
                } else if (!usedDeviceData && !anyModernMeta && basket.data && cbtLooksLikeWeeklyRoot(basket.data)) {
                  cbtAddWeeklySlice(remoteCache, basket.data);
                }
              }
            }

            pruneWeeklyOlderThan(WEEKLY_DAYS);

            var currentWeek2 = currentWeekStartStr();
            var oldPeriod = null;
            try { oldPeriod = gmGet(REMOTE_WEEKLY_PERIOD_KEY, null); } catch(e0) {}
            if (!oldPeriod) {
              try { oldPeriod = localStorage.getItem(REMOTE_WEEKLY_PERIOD_KEY); } catch(e1) {}
            }

            var oldJson = JSON.stringify(sanitizeWeekly(loadRemoteWeekly() || {}));
            var newJson = JSON.stringify(sanitizeWeekly(remoteCache || {}));

            if (oldJson !== newJson || oldPeriod !== currentWeek2) {
              saveRemoteWeekly(remoteCache, currentWeek2);
              changed = true;

              if (document.getElementById('cbt-weekly-tbody')) {
                setTimeout(function(){ try { renderWeekly(); } catch(e) {} }, 0);
              }
            }
          } catch(e) {}

          if (cb) cb(changed);
        },
        onerror: function(){
          _weeklyPullInFlight = false;
          if (!_weeklyPulled && !_weeklyFirstPullRetry) {
            _weeklyFirstPullRetry = setTimeout(function(){ _weeklyFirstPullRetry = null; syncWeeklyPull(); }, 5000);
          }
          if (cb) cb(false);
        }
      });
    } catch(e) {
      _weeklyPullInFlight = false;
      if (!_weeklyPulled && !_weeklyFirstPullRetry) {
        _weeklyFirstPullRetry = setTimeout(function(){ _weeklyFirstPullRetry = null; syncWeeklyPull(); }, 5000);
      }
      if (cb) cb(false);
    }
  }

  function captureName(item) {
    if (!item || typeof item !== 'object') return false;
    var name = item.associateId || item.associate || item.driverAssignment;
    if (!name || typeof name !== 'string') return false;
    name = name.trim();
    if (!name || name.length > 60) return false;
    var key = name.toLowerCase();
    var all = loadAllNames();
    if (!all[key]) {
      all[key] = name;
      persistAllNames();
      syncPush();
      return true;
    }
    return false;
  }
  function _deepCaptureInner(obj, depth) {
    if (obj == null || depth > 6) return false;
    var added = false;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && i < 5000; i++) {
        if (_deepCaptureInner(obj[i], depth + 1)) added = true;
      }
    } else if (typeof obj === 'object') {
      if (captureName(obj)) added = true;
      for (var k in obj) {
        var v = obj[k];
        if (v && typeof v === 'object') {
          if (_deepCaptureInner(v, depth + 1)) added = true;
        }
      }
    }
    return added;
  }
  function deepCaptureNames(obj, depth) {
    var added = _deepCaptureInner(obj, depth || 0);
    if (added && activeTab === 'names') renderNames();
    return added;
  }

  function scanLocalStorageForNames() {
    var added = false;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        var val;
        try { val = localStorage.getItem(key); } catch(e) { continue; }
        if (!val || val.length < 2) continue;
        var ch = val.charAt(0);
        if (ch !== '{' && ch !== '[') continue;
        try {
          var parsed = JSON.parse(val);
          if (_deepCaptureInner(parsed, 0)) added = true;
        } catch(e) {}
      }
    } catch(e) {}
    if (added && activeTab === 'names') renderNames();
    if (added) syncPush();
    return added;
  }

  function addNameToAll(all, n) {
    if (!n || typeof n !== 'string') return false;
    n = n.trim();
    if (!n || n.length > 60) return false;
    var k = n.toLowerCase();
    if (!all[k]) { all[k] = n; return true; }
    return false;
  }
  function syncNamesFromAllTabs() {
    var all = loadAllNames();
    var added = false;
    taskCache.forEach(function(d){
      if (addNameToAll(all, d.associateId||d.associate||d.driverAssignment)) added = true;
    });
    try {
      var hist = loadHistory();
      Object.keys(hist).forEach(function(a){ if (addNameToAll(all, (hist[a]&&hist[a].assoc)||a)) added = true; });
    } catch(e) {}
    try {
      var weekly = loadWeekly();
      Object.keys(weekly).forEach(function(dk){
        Object.keys(weekly[dk]).forEach(function(a){ if (addNameToAll(all, (weekly[dk][a]&&weekly[dk][a].assoc)||a)) added = true; });
      });
    } catch(e) {}
    if (added) {
      persistAllNames();
      syncPush();
    }
    return added;
  }

  function pruneWeeklyOlderThan(days) {
    /* `days` is retained in the signature for compatibility with older calls.
       Weekly is now a calendar report, so only this Sunday-Saturday period is
       valid regardless of a rolling 7-day count. */
    var currentWeek = currentWeekStartStr();

    var w = loadWeekly();
    var changed = false;
    for (var dk of Object.keys(w)) {
      if (!cbtIsDateInCurrentWeek(dk)) { delete w[dk]; changed = true; }
    }
    if (changed) saveWeekly(w, true, currentWeek);

    var rc = loadRemoteWeekly();
    var rcChanged = false;
    for (var dk2 of Object.keys(rc)) {
      if (!cbtIsDateInCurrentWeek(dk2)) { delete rc[dk2]; rcChanged = true; }
    }
    if (rcChanged) saveRemoteWeekly(rc, currentWeek);
  }

  function rollDailyIntoWeekly() {
    try {
      // Read date from GM storage first (survives localStorage clears)
      var sd = gmGet(DATE_KEY, null) || localStorage.getItem(DATE_KEY);
      if (!sd) return;
      // Read history from GM storage first, fall back to localStorage
      var daily = {};
      try { var gmH = gmGet(STORAGE_KEY, null); if (gmH) daily = (typeof gmH === 'string') ? JSON.parse(gmH) : gmH; } catch(e) {}
      if (!Object.keys(daily).length) {
        try { daily = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) {}
      }
      if (!Object.keys(daily).length) return;
      daily = sanitizeHistory(daily);
      if (!Object.keys(daily).length) return;
      var w = loadWeekly(); if (!w[sd]) w[sd] = {};
      for (var a of Object.keys(daily)) {
        var d2 = daily[a];
        // Merge: take max totalPkgs so we never downgrade an existing entry
        if (!w[sd][a] || (d2.totalPkgs||0) > (w[sd][a].totalPkgs||0)) {
          w[sd][a] = { totalPkgs: d2.totalPkgs, totalSec: d2.totalSec, runs: d2.runs,
            avgRate: d2.avgRate, totalMissing: d2.totalMissing||0, totalExpected: d2.totalExpected||0,
            bestRate: Math.max(Number(d2.bestRate)||0, Number(d2.lastRate)||0, Number(d2.avgRate)||0) || null,
            lastRate: Number(d2.lastRate) > 0 ? Number(d2.lastRate) : null,
            lastAt: Number(d2.lastAt) || 0 };
        }
      }
      saveWeekly(w);
    } catch(e) {}
  }

  function sanitizeHistory(h) {
    var clean = {};
    for (var a in (h || {})) {
      var e = h[a];
      if (!e || typeof e !== 'object') continue;
      var pkgs = Number(e.totalPkgs) || 0;
      var runs = Number(e.runs) || 0;
      var sec  = Number(e.totalSec) || 0;
      if (pkgs > 50000 || runs > 300) continue;
      if (sec > 60 && (pkgs / (sec / 60)) > CBT_MAX_VALID_RATE) continue;

      var c = Object.assign({}, e);
      if (Number(c.bestRate) > CBT_MAX_VALID_RATE) c.bestRate = null;
      if (Number(c.lastRate) > CBT_MAX_VALID_RATE) {
        c.lastRate = null;
        c.lastAt = 0;
      }
      clean[a] = c;
    }
    return clean;
  }

  var _todayBoundaryTimer = null;
  var _lastStoreDay = null;

  function cbtStoreClockParts() {
    try {
      var tz = getStoreTimezone();
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).formatToParts(new Date());

      var out = { hour: 0, minute: 0, second: 0 };
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'hour') out.hour = parseInt(parts[i].value, 10) || 0;
        else if (parts[i].type === 'minute') out.minute = parseInt(parts[i].value, 10) || 0;
        else if (parts[i].type === 'second') out.second = parseInt(parts[i].value, 10) || 0;
      }
      if (out.hour === 24) out.hour = 0;
      return out;
    } catch(e) {
      var d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    }
  }

  function cbtResetTodayForNewDay() {
    var currentDay = todayStr();
    var currentWeek = currentWeekStartStr();
    var savedDay = null;
    try { savedDay = gmGet(DATE_KEY, null) || localStorage.getItem(DATE_KEY); } catch(e0) {}

    if (savedDay === currentDay) {
      _lastStoreDay = currentDay;

      /* Upgrade/migration safety: even without a day change, force local
         Weekly storage to the current Sunday period. */
      try { pruneWeeklyOlderThan(WEEKLY_DAYS); } catch(e1) {}
      return false;
    }

    var savedWeek = savedDay ? cbtWeekStartForDateKey(savedDay) : null;
    var crossedWeek = !!(savedDay && savedWeek && savedWeek !== currentWeek);

    if (savedDay && !crossedWeek) {
      /* Monday-Saturday midnight: yesterday belongs to the SAME current week,
         so preserve its Today report before clearing Today. */
      try { rollDailyIntoWeekly(); } catch(e2) {}
    }

    if (crossedWeek) {
      /* Sunday 12:00 AM (or returning after missing the Sunday boundary):
         start a completely new Weekly report. Saturday/old-week data is no
         longer part of the current report and must not survive locally. */
      saveWeekly({}, true, currentWeek);
      saveRemoteWeekly({}, currentWeek);
      _dispWeekCache = null;

      try {
        if (_weeklyPulled) syncWeeklyPush();
        else _weeklyPushQueued = true;
      } catch(e3) {}
    } else {
      try { pruneWeeklyOlderThan(WEEKLY_DAYS); } catch(e4) {}
    }

    /* Every store midnight starts a completely empty Today report. */
    try { localStorage.removeItem(STORAGE_KEY); } catch(e5) {}
    gmSet(STORAGE_KEY, '{}');

    try {
      localStorage.setItem(DATE_KEY, currentDay);
      localStorage.removeItem(REMOTE_HISTORY_KEY);
      localStorage.setItem(REMOTE_HISTORY_DATE_KEY, currentDay);
    } catch(e6) {}
    gmSet(DATE_KEY, currentDay);
    saveRemoteHistory({}, currentDay);

    _dispHistCache = null;
    _dispWeekCache = null;
    _lastStoreDay = currentDay;

    /* Publish an empty current-day slice immediately. */
    try { if (_histPulled) syncHistoryPush(); else _histPushQueued = true; } catch(e7) {}
    try { syncWeeklyPush(); } catch(e8) {}

    if (document.getElementById('cbt-hist-tbody')) {
      try { renderHistory(); } catch(e9) {}
    }
    if (document.getElementById('cbt-weekly-tbody')) {
      try { renderWeekly(); } catch(e10) {}
    }

    /* Pull current period data after clearing. Date/week metadata filters out
       stale data from computers still holding yesterday/last week's slices. */
    try { syncHistoryPull(); } catch(e11) {}
    try { syncWeeklyPull(); } catch(e12) {}
    return true;
  }

  function cbtScheduleTodayBoundary() {
    if (_todayBoundaryTimer) {
      try { clearTimeout(_todayBoundaryTimer); } catch(e0) {}
      _todayBoundaryTimer = null;
    }

    /* Wake near store midnight. Cap a single sleep at 6h so DST/timezone
       changes cannot leave the reset timer off by an hour. Four very cheap
       wakeups per day are far lighter than a permanent polling loop. */
    var p = cbtStoreClockParts();
    var seconds = (24 * 3600) - (p.hour * 3600 + p.minute * 60 + p.second);
    if (seconds <= 0) seconds = 1;
    var delay = Math.min(seconds * 1000 + 1200, 6 * 3600 * 1000);

    _todayBoundaryTimer = setTimeout(function() {
      _todayBoundaryTimer = null;
      try { cbtResetTodayForNewDay(); } catch(e1) {}
      cbtScheduleTodayBoundary();
    }, delay);
  }

  function cbtStartTodayBoundaryClock() {
    _lastStoreDay = todayStr();
    try { cbtResetTodayForNewDay(); } catch(e0) {}
    cbtScheduleTodayBoundary();

    /* If the browser slept through midnight, reset immediately when the tab
       becomes visible/focused again. */
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) return;
      try { cbtResetTodayForNewDay(); } catch(e1) {}
      cbtScheduleTodayBoundary();
    });
    window.addEventListener('focus', function() {
      try { cbtResetTodayForNewDay(); } catch(e2) {}
      cbtScheduleTodayBoundary();
    });
  }

  function loadHistory() {
    try {
      if (cbtResetTodayForNewDay()) return {};
      // Merge GM storage + localStorage so neither source beats the other
      var result = {};
      try { var gm = gmGet(STORAGE_KEY, null); if (gm) result = (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e) {}
      try {
        var ls = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        for (var a in ls) {
          if (!result[a]) result[a] = ls[a];
          else if ((ls[a].totalPkgs||0) > (result[a].totalPkgs||0)) result[a] = ls[a];
        }
      } catch(e) {}
      // Scrub any entries corrupted by old double-count bug
      return sanitizeHistory(result);
    } catch(e) { return {}; }
  }

  function saveHistory(h, skipPush) {
    // saveHistory only ever saves THIS device's own recorded batches
    _dispHistCache = null;
    _dispWeekCache = null; /* Weekly includes Today live */
    var json = JSON.stringify(h);
    localStorage.setItem(STORAGE_KEY, json); localStorage.setItem(DATE_KEY, todayStr());
    gmSet(STORAGE_KEY, json); gmSet(DATE_KEY, todayStr());
    if (!skipPush) { setTimeout(function(){ if (typeof syncHistoryPush === 'function') syncHistoryPush(); }, 0); }
  }
  // Remote history cache — other devices' data summed on pull, NEVER pushed
  function loadRemoteHistory() {
    /* A remote Today cache from yesterday must NEVER bleed into a new day. */
    var cacheDate = null;
    try { cacheDate = gmGet(REMOTE_HISTORY_DATE_KEY, null); } catch(e0) {}
    if (!cacheDate) {
      try { cacheDate = localStorage.getItem(REMOTE_HISTORY_DATE_KEY); } catch(e1) {}
    }
    if (cacheDate !== todayStr()) return {};

    try { var gm = gmGet(REMOTE_HISTORY_KEY, null); if (gm) return (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e2) {}
    try { return JSON.parse(localStorage.getItem(REMOTE_HISTORY_KEY) || '{}'); } catch(e3) { return {}; }
  }
  function saveRemoteHistory(h, dateKey) {
    _dispHistCache = null;
    _dispWeekCache = null; /* Weekly includes Today live */
    var json = JSON.stringify(h || {});
    var dk = dateKey || todayStr();
    gmSet(REMOTE_HISTORY_KEY, json);
    gmSet(REMOTE_HISTORY_DATE_KEY, dk);
    try {
      localStorage.setItem(REMOTE_HISTORY_KEY, json);
      localStorage.setItem(REMOTE_HISTORY_DATE_KEY, dk);
    } catch(e) {}
    // Never push — display-only
  }
  // Merge own + remote for display only
  function getDisplayHistory() {
    var _now = Date.now();
    if (_dispHistCache && (_now - _dispHistTime) < 1500) return _dispHistCache;
    var own    = sanitizeHistory(loadHistory());
    var remote = sanitizeHistory(loadRemoteHistory());
    var out = {};
    function addSlice(slice) {
      for (var a in slice) {
        var r = slice[a];
        if (!out[a]) {
          out[a] = { assoc: r.assoc||a, totalPkgs: r.totalPkgs||0, totalSec: r.totalSec||0,
            runs: r.runs||0, totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0,
            bestRate: null, lastRate: null, lastAt: 0 };
          cbtMergeBestFields(out[a], r);
          cbtMergeLatestFields(out[a], r);
        } else {
          out[a].totalPkgs    += r.totalPkgs    || 0;
          out[a].totalSec     += r.totalSec     || 0;
          out[a].runs         += r.runs         || 0;
          out[a].totalMissing += r.totalMissing || 0;
          out[a].totalExpected+= r.totalExpected|| 0;
          cbtMergeBestFields(out[a], r);
          cbtMergeLatestFields(out[a], r);
        }
      }
    }
    addSlice(own);
    addSlice(remote);
    // Recompute avgRate
    for (var a2 in out) {
      out[a2].avgRate = out[a2].totalSec > 0 ? out[a2].totalPkgs / (out[a2].totalSec / 60) : 0;
    }
    _dispHistCache = out; _dispHistTime = _now;
    return out;
  }

  /* ══════════════════════════════════════
     HALL OF FAME

     Top 30 all-time peak rates. Two kinds of data, stored differently for
     good reason:

       peaks  -> ONE shared record per associate at /como_hof_v2/peaks/{login}.
                 A device only writes when its value is strictly higher than
                 what the server currently holds, so a saved best can only
                 ever ratchet upward — a stale device can never lower it.

       totals -> per-device slices at /como_hof_v2/totals/devices/{deviceId},
                 summed for display. Same architecture as Today and Weekly:
                 each machine owns its own slice, so nobody overwrites or
                 double-counts anyone else's history.

     Firebase is the source of truth so every computer and browser shows the
     same records; GM storage is only a cache for instant paint and for
     riding out a brief outage. Rank is never stored — it is derived from
     the peak values at render time, so someone else beating a record moves
     positions without touching anyone's saved number.
  ══════════════════════════════════════ */
  var HOF_MIN_PKGS = 20;      /* a record needs a real batch behind it */
  var HOF_MIN_SEC  = 120;
  var HOF_MAX_RATE = CBT_MAX_VALID_RATE; /* shared trusted-rate ceiling */
  var HOF_TOP      = 30;

  /* v23.9.74 TRUSTED FASTEST RESET
     --------------------------------
     Legacy Fastest records were calculated before the full-span timing fix.
     They cannot be safely repaired because each historical record did not
     retain enough raw timing evidence. Rather than guessing, Fastest starts a
     clean generation here. Old Firebase/local records are left untouched but
     are no longer read by this version.

     Every updated computer now shares /como_hof_v2. */
  var HOF_SCHEMA          = 2;
  var HOF_FIREBASE_ROOT   = '/como_hof_v2';
  var HOF_PEAKS_KEY       = 'cbt_hof_v2_peaks';
  var HOF_LATEST_KEY      = 'cbt_hof_v2_latest';
  var HOF_OWN_KEY         = 'cbt_hof_v2_own_totals';
  var HOF_REMOTE_KEY      = 'cbt_hof_v2_remote_totals';

  function hofUrl(path)      { return FIREBASE_URL + path + '.json'; }
  function hofRootPath(path) {
    path = String(path || '');
    if (path && path.charAt(0) !== '/') path = '/' + path;
    return HOF_FIREBASE_ROOT + path;
  }
  function hofKey(assoc) {
    /* Firebase keys may not contain . $ # [ ] / */
    return String(assoc || '').trim().toLowerCase().replace(/[.$#\[\]\/]/g, '_');
  }

  function hofLoadJson(key) {
    try { var gm = gmGet(key, null); if (gm) return (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e) {}
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { return {}; }
  }
  function hofSaveJson(key, obj) {
    var json = JSON.stringify(obj || {});
    gmSet(key, json);
    try { localStorage.setItem(key, json); } catch(e) {}
  }
  function hofLoadPeaks()        { return hofLoadJson(HOF_PEAKS_KEY) || {}; }
  function hofSavePeaks(p)       { hofSaveJson(HOF_PEAKS_KEY, p); }
  function hofLoadLatest()       { return hofLoadJson(HOF_LATEST_KEY) || {}; }
  function hofSaveLatest(p)      { hofSaveJson(HOF_LATEST_KEY, p); }
  function hofLoadOwnTotals()    { return hofLoadJson(HOF_OWN_KEY) || {}; }
  function hofSaveOwnTotals(t)   { hofSaveJson(HOF_OWN_KEY, t); }
  function hofLoadRemoteTotals() { return hofLoadJson(HOF_REMOTE_KEY) || {}; }
  function hofSaveRemoteTotals(t){ hofSaveJson(HOF_REMOTE_KEY, t); }

  /* Latest is different from Peak: it ALWAYS follows the newest completed
     batch, even if that rate is lower than the associate's personal best. */
  function hofMergeLatest(key, rec) {
    if (!key || !rec) return false;
    var rate = Number(rec.rate), at = Number(rec.at) || 0;
    if (Number(rec.schema) !== HOF_SCHEMA) return false;
    if (!(Number(rec.pkgs) > 0) || Number(rec.elapsedSec) < 30) return false;
    if (!(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return false;

    var latest = hofLoadLatest();
    var cur = latest[key];
    var curAt = cur ? (Number(cur.at) || 0) : -1;

    if (cur && curAt > at) return false;
    if (cur && curAt === at && Number(cur.rate) === rate && (cur.assoc || '') === (rec.assoc || '')) return false;

    latest[key] = {
      assoc: rec.assoc || (cur && cur.assoc) || key,
      rate: rate,
      at: at,
      pkgs: Number(rec.pkgs) || 0,
      elapsedSec: Number(rec.elapsedSec) || 0,
      schema: Number(rec.schema) || HOF_SCHEMA,
      calc: rec.calc || 'packagesBatched/fullBatchingSpan'
    };
    hofSaveLatest(latest);
    return true;
  }

  function hofPushLatest(key, assoc, rate, ts, pkgs, elapsedSec) {
    rate = Number(rate);
    ts = Number(ts) || Date.now();
    pkgs = Number(pkgs) || 0;
    elapsedSec = Number(elapsedSec) || 0;
    if (!key || !(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return;
    if (!(elapsedSec >= 30) || !(pkgs > 0)) return;

    var rec = {
      assoc: assoc || key,
      rate: rate,
      at: ts,
      pkgs: pkgs,
      elapsedSec: elapsedSec,
      schema: HOF_SCHEMA,
      calc: 'packagesBatched/fullBatchingSpan'
    };
    hofMergeLatest(key, rec);

    if (!syncEnabled()) {
      if (activeTab === 'hof') renderHallOfFame();
      return;
    }

    /* Read-before-write prevents an older/slower computer from overwriting a
       newer latest rate that another computer already published. */
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: hofUrl(hofRootPath('/latest/' + key)),
        headers: { 'Content-Type': 'application/json' },
        onload: function(res) {
          var remote = null;
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              remote = JSON.parse(res.responseText);
            }
          } catch(e) {}

          if (remote && (Number(remote.at) || 0) > ts) {
            hofMergeLatest(key, remote);
            if (activeTab === 'hof') renderHallOfFame();
            return;
          }

          GM_xmlhttpRequest({
            method: 'PUT', url: hofUrl(hofRootPath('/latest/' + key)),
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(rec),
            onload: function() {
              hofMergeLatest(key, rec);
              if (activeTab === 'hof') renderHallOfFame();
            },
            onerror: function() {
              if (activeTab === 'hof') renderHallOfFame();
            }
          });
        },
        onerror: function() {
          if (activeTab === 'hof') renderHallOfFame();
        }
      });
    } catch(e) {}
  }

  /* Local cache only ever moves a peak upward. */
  function hofMergePeak(key, rec) {
    if (!key || !rec || typeof rec.rate !== 'number' || !(rec.rate > 0)) return false;
    if (Number(rec.schema) !== HOF_SCHEMA) return false;
    if (Number(rec.rate) > HOF_MAX_RATE) return false;
    if (Number(rec.pkgs) < HOF_MIN_PKGS || Number(rec.elapsedSec) < HOF_MIN_SEC) return false;
    var peaks = hofLoadPeaks();
    var cur = peaks[key];
    if (cur && typeof cur.rate === 'number' && cur.rate >= rec.rate) return false;
    peaks[key] = {
      assoc: rec.assoc || (cur && cur.assoc) || key,
      rate: rec.rate,
      at: rec.at || null,
      pkgs: Number(rec.pkgs) || 0,
      elapsedSec: Number(rec.elapsedSec) || 0,
      schema: Number(rec.schema) || HOF_SCHEMA,
      calc: rec.calc || 'packagesBatched/fullBatchingSpan'
    };
    hofSavePeaks(peaks);
    return true;
  }

  /* Read the server value, then write ONLY if ours is strictly higher. */
  function hofPushPeak(key, assoc, rate, ts, pkgs, elapsedSec) {
    rate = Number(rate);
    pkgs = Number(pkgs) || 0;
    elapsedSec = Number(elapsedSec) || 0;
    if (!(rate > 0) || !isFinite(rate) || rate > HOF_MAX_RATE) return;
    if (pkgs < HOF_MIN_PKGS || elapsedSec < HOF_MIN_SEC) return;
    if (!syncEnabled()) return;
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: hofUrl(hofRootPath('/peaks/' + key)),
        headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          var remote = null;
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              remote = JSON.parse(res.responseText);
            }
          } catch(e) {}
          if (remote && typeof remote.rate === 'number' && remote.rate >= rate) {
            hofMergePeak(key, remote);      /* server already holds a better one */
            if (activeTab === 'hof') renderHallOfFame();
            return;
          }
          var rec = {
            assoc: assoc,
            rate: rate,
            at: ts,
            pkgs: pkgs,
            elapsedSec: elapsedSec,
            schema: HOF_SCHEMA,
            calc: 'packagesBatched/fullBatchingSpan'
          };
          GM_xmlhttpRequest({
            method: 'PUT', url: hofUrl(hofRootPath('/peaks/' + key)),
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(rec),
            onload: function(){
              hofMergePeak(key, rec);
              if (activeTab === 'hof') renderHallOfFame();
            },
            onerror: function(){ hofMergePeak(key, rec); }   /* keep it locally, retry next record */
          });
        },
        onerror: function(){
          hofMergePeak(key, {
            assoc: assoc, rate: rate, at: ts,
            pkgs: pkgs, elapsedSec: elapsedSec,
            schema: HOF_SCHEMA,
            calc: 'packagesBatched/fullBatchingSpan'
          });
        }
      });
    } catch(e) {}
  }

  var _hofTotalsTimer = null;
  function hofPushTotals() {
    if (!syncEnabled()) return;
    if (_hofTotalsTimer) return;
    _hofTotalsTimer = setTimeout(function(){
      _hofTotalsTimer = null;
      try {
        var devId = MY_DEVICE_ID || getDeviceId();
        GM_xmlhttpRequest({
          method: 'PUT', url: hofUrl(hofRootPath('/totals/devices/' + devId)),
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(hofLoadOwnTotals()),
          onload: function(){}, onerror: function(){}
        });
      } catch(e) {}
    }, 2500);
  }

  var _hofPullInFlight = false;
  function hofPull(cb) {
    if (!syncEnabled()) { if (cb) cb(); return; }
    if (_hofPullInFlight) { if (cb) cb(); return; }
    _hofPullInFlight = true;
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: hofUrl(HOF_FIREBASE_ROOT),
        headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              var data = JSON.parse(res.responseText) || {};
              var changed = false;
              var peaks = data.peaks || {};
              for (var k in peaks) { if (hofMergePeak(k, peaks[k])) changed = true; }

              var latest = data.latest || {};
              for (var lk in latest) { if (hofMergeLatest(lk, latest[lk])) changed = true; }

              /* remote totals = every device except this one */
              var devId = MY_DEVICE_ID || getDeviceId();
              var devices = (data.totals && data.totals.devices) || {};
              var remote = {};
              for (var d in devices) {
                if (d === devId) continue;
                var slice = devices[d] || {};
                for (var a in slice) {
                  var r = slice[a] || {};
                  if (!remote[a]) remote[a] = { assoc: r.assoc || a, runs: 0, pkgs: 0 };
                  remote[a].runs += (r.runs || 0);
                  remote[a].pkgs += (r.pkgs || 0);
                  if (r.assoc) remote[a].assoc = r.assoc;
                }
              }
              hofSaveRemoteTotals(remote);
              if (activeTab === 'hof') renderHallOfFame();
            }
          } catch(e) {}
          _hofPullInFlight = false;
          if (cb) cb();
        },
        onerror: function(){ _hofPullInFlight = false; if (cb) cb(); }
      });
    } catch(e) { _hofPullInFlight = false; if (cb) cb(); }
  }

  /* Called for every completed batch. Totals always advance; the peak only
     moves when the batch is substantial enough to be a real record. */
  function hofRecordBatch(assoc, pkgs, elapsedSec, rate) {
    if (!assoc) return;
    var key = hofKey(assoc);
    if (!key) return;

    var own = hofLoadOwnTotals();
    if (!own[key]) own[key] = { assoc: assoc, runs: 0, pkgs: 0 };
    own[key].assoc = assoc;
    own[key].runs += 1;
    own[key].pkgs += (pkgs || 0);
    hofSaveOwnTotals(own);
    hofPushTotals();

    /* Latest records EVERY valid completed rate, regardless of whether it is
       higher/lower than Peak or whether the batch meets Fastest thresholds. */
    var latestTs = Date.now();
    if (Number(rate) > 0 && isFinite(Number(rate)) && Number(rate) <= CBT_MAX_VALID_RATE) {
      hofPushLatest(key, assoc, Number(rate), latestTs, pkgs, elapsedSec);
    }

    if ((pkgs || 0) < HOF_MIN_PKGS) return;          /* too few packages for Peak only */
    if ((elapsedSec || 0) < HOF_MIN_SEC) return;     /* too short */
    if (!(rate > 0) || rate > HOF_MAX_RATE) return;  /* missing or impossible */
    var peaks = hofLoadPeaks();
    var cur = peaks[key];
    if (cur && typeof cur.rate === 'number' && cur.rate >= rate) return;  /* never decreases */
    hofPushPeak(key, assoc, rate, Date.now(), pkgs, elapsedSec);
    if (activeTab === 'hof') renderHallOfFame();
  }

  function hofWhen(ts) {
    if (!ts) return '\u2014';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '\u2014';
      /* short date only, e.g. 08/06/26 */
      return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    } catch(e) { return '\u2014'; }
  }

  function renderHallOfFame() {
    var tbody = document.getElementById('cbt-hof-tbody');
    if (!tbody) return;
    var emptyEl = document.getElementById('cbt-hof-empty');
    var noteEl  = document.getElementById('cbt-hof-note');

    var peaks   = hofLoadPeaks();
    var latest  = hofLoadLatest();
    var own     = hofLoadOwnTotals();
    var remote  = hofLoadRemoteTotals();

    /* Fastest is no longer Peak-only. Keep Peak as the ranking metric, while
       also admitting associates who have a Latest rate but have not yet met
       the Peak qualification threshold. Those rows remain unranked (—). */
    var allKeys = Object.create(null);
    for (var pk in peaks) allKeys[pk] = true;
    for (var lk0 in latest) allKeys[lk0] = true;

    var rows = [];
    for (var k in allKeys) {
      var p = peaks[k] || null;
      var l = latest[k] || null;
      var o = own[k] || {}, r = remote[k] || {};
      var peakRate =
        p && Number(p.schema) === HOF_SCHEMA &&
        Number(p.rate) > 0 && Number(p.rate) <= CBT_MAX_VALID_RATE &&
        Number(p.pkgs) >= HOF_MIN_PKGS && Number(p.elapsedSec) >= HOF_MIN_SEC
          ? Number(p.rate) : null;
      var latestRate =
        l && Number(l.schema) === HOF_SCHEMA &&
        Number(l.rate) > 0 && Number(l.rate) <= CBT_MAX_VALID_RATE &&
        Number(l.pkgs) > 0 && Number(l.elapsedSec) >= 30
          ? Number(l.rate) : null;
      if (!(peakRate > 0) && !(latestRate > 0)) continue;

      rows.push({
        key: k,
        assoc: (p && p.assoc) || (l && l.assoc) || o.assoc || r.assoc || k,
        rate: peakRate,
        at: p && p.at ? p.at : null,
        latestRate: latestRate,
        latestAt: l && l.at ? l.at : null,
        runs: (o.runs || 0) + (r.runs || 0),
        pkgs: (o.pkgs || 0) + (r.pkgs || 0)
      });
    }

    /* Peak rows stay first and keep the existing Fastest ranking. Latest-only
       rows come afterward, newest completion first, and have rank "—". */
    rows.sort(function(a, b){
      var ap = Number(a.rate) > 0, bp = Number(b.rate) > 0;
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      if (ap && bp) {
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.pkgs !== a.pkgs) return b.pkgs - a.pkgs;
      } else {
        var ad = Number(a.latestAt) || 0, bd = Number(b.latestAt) || 0;
        if (bd !== ad) return bd - ad;
      }
      return a.assoc.toLowerCase().localeCompare(b.assoc.toLowerCase());
    });
    var total = rows.length;
    /* Rank is stamped from the FULL ordering before any filtering, so a
       searched associate keeps the position they actually hold on the board
       rather than being renumbered 1, 2, 3 within the results. */
    var peakRank = 0;
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].rank = Number(rows[ri].rate) > 0 ? (++peakRank) : null;
    }
    var hofTerm = (hofSearchTerm || '').toLowerCase().trim();
    if (hofTerm) {
      /* Fastest search must work like Today / Weekly: a person can be found
         even when they have never set a qualifying Fastest peak. Real Fastest
         ranks are stamped above from the complete peak board and are NEVER
         recomputed after filtering. Search-only people stay unranked (—). */
      var seenKey = Object.create(null), extraByKey = Object.create(null);
      for (var rk2 = 0; rk2 < rows.length; rk2++) seenKey[rows[rk2].key] = true;

      function addSearchOnly(key, assoc, runs, pkgs, priority) {
        key = key || hofKey(assoc || '');
        if (!key || seenKey[key]) return;
        var cur = extraByKey[key];
        if (!cur) {
          var lr = latest[key] || null;
          cur = extraByKey[key] = {
            key:key, assoc:assoc||key, rate:null, at:null, rank:null,
            latestRate:lr && Number(lr.schema)===HOF_SCHEMA &&
              Number(lr.rate)>0 && Number(lr.rate)<=CBT_MAX_VALID_RATE &&
              Number(lr.pkgs)>0 && Number(lr.elapsedSec)>=30 ? Number(lr.rate) : null,
            latestAt:lr && lr.at ? lr.at : null,
            runs:0, pkgs:0, _priority:-1
          };
        }
        if (assoc) cur.assoc = assoc;
        /* Prefer Hall-of-Fame totals, then Weekly, then Today, then a saved
           name with no numeric history. This avoids double-counting the same
           person's data across the different history stores. */
        if (priority > cur._priority) {
          cur._priority = priority;
          cur.runs = Number(runs) || 0;
          cur.pkgs = Number(pkgs) || 0;
        }
      }

      /* Native Fastest totals (best source when present). */
      var totalKeys = Object.create(null), kk;
      for (kk in own) totalKeys[kk] = true;
      for (kk in remote) totalKeys[kk] = true;
      for (kk in totalKeys) {
        var oo = own[kk] || {}, rr = remote[kk] || {};
        addSearchOnly(kk, oo.assoc || rr.assoc || kk,
          (oo.runs || 0) + (rr.runs || 0),
          (oo.pkgs || 0) + (rr.pkgs || 0), 3);
      }

      /* Weekly history catches associates who existed before Fastest totals
         began recording, or who have not met the peak threshold yet. */
      var weeklySearchData = sanitizeWeekly(getDisplayWeekly()), weeklyAgg = Object.create(null);
      for (var wday in weeklySearchData) {
        for (var wa in weeklySearchData[wday]) {
          var wd = weeklySearchData[wday][wa] || {};
          var wk = hofKey(wa);
          if (!wk) continue;
          if (!weeklyAgg[wk]) weeklyAgg[wk] = { assoc:wa, runs:0, pkgs:0 };
          weeklyAgg[wk].runs += Number(wd.runs) || 0;
          weeklyAgg[wk].pkgs += Number(wd.totalPkgs) || 0;
        }
      }
      for (kk in weeklyAgg) addSearchOnly(kk, weeklyAgg[kk].assoc, weeklyAgg[kk].runs, weeklyAgg[kk].pkgs, 2);

      /* Today's history is another fallback for a brand-new associate. */
      var todaySearchData = getDisplayHistory();
      for (kk in todaySearchData) {
        var td = todaySearchData[kk] || {};
        addSearchOnly(hofKey(td.assoc || kk), td.assoc || kk, td.runs, td.totalPkgs, 1);
      }

      /* Finally make every permanently saved name searchable, even with no
         batch data yet. */
      var savedSearchNames = loadAllNames();
      for (kk in savedSearchNames) {
        var sn = savedSearchNames[kk];
        addSearchOnly(hofKey(sn), sn, 0, 0, 0);
      }

      var extra = Object.keys(extraByKey).map(function(kx){ return extraByKey[kx]; });
      rows = rows.concat(extra).filter(function(x){
        return (x.assoc || '').toLowerCase().indexOf(hofTerm) !== -1;
      });
      rows = prioritizeNameMatches(rows, hofTerm, function(x){ return x.assoc; });
    }
    rows = rows.slice(0, HOF_TOP);

    if (!rows.length) {
      setHTML(tbody, '');
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.textContent = hofTerm
          ? ('No records match "' + hofSearchTerm + '"')
          : 'No records yet.';
      }
      if (noteEl) noteEl.textContent = '';
      requestUnifiedSearchCount();
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      var rk = (typeof e.rank === 'number') ? e.rank : null;   /* null = no peak yet */
      var rankTxt = rk ? rk : '\u2013';
      var rankCls = rk === 1 ? 'gold' : rk === 2 ? 'silver' : rk === 3 ? 'bronze' : '';
      var rowCls  = (rk && rk <= 3) ? (' class="cbt-hof-' + rk + '"') : '';
      html += '<tr' + rowCls + '>' +
        '<td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc">' +
          '<span class="cbt-rank ' + rankCls + '">' + rankTxt + '</span>' + e.assoc +
          '</span></span></span></td>' +
        '<td><span class="cbt-hist-meta">' + e.runs + '</span></td>' +
        '<td><span class="cbt-hist-meta">' + e.pkgs + '</span></td>' +
        '<td>' + (typeof e.rate === 'number'
          ? ('<span class="cbt-hof-peak">' + e.rate.toFixed(1) + '</span>')
          : '<span class="cbt-hist-meta">\u2014</span>') + '</td>' +
        '<td>' + (Number(e.latestRate) > 0
          ? ('<span class="cbt-hist-rate ' +
              (Number(e.latestRate)>=WARN_RATE?'good':Number(e.latestRate)>=ALERT_RATE?'warn':'alert') +
              '">' + Number(e.latestRate).toFixed(1) + '</span>')
          : '<span class="cbt-hist-meta">\u2014</span>') + '</td>' +
        '<td><span class="cbt-hof-when">' + hofWhen(e.at) + '</span></td>' +
      '</tr>';
    }
    setHTML(tbody, html);
    requestUnifiedSearchCount();
  }

  /* ══════════════════════════════════════
     COPY TO CLIPBOARD + VISUAL CONFIRMATION
  ══════════════════════════════════════ */
  /* execCommand fallback — navigator.clipboard needs a secure context and
     can reject, in which case the copy would silently do nothing. */
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var done = document.execCommand('copy');
      document.body.removeChild(ta);
      return done;
    } catch(e) { return false; }
  }

  function copyWithFeedback(el, text, ev) {
    if (!text) return;
    function confirmed() {
      /* Clear any previous inline confirmation first */
      document.querySelectorAll('.cbt-copied-tag').forEach(function(t){ if (t.parentNode) t.parentNode.removeChild(t); });
      document.querySelectorAll('.cbt-copied-name').forEach(function(n){ n.classList.remove('cbt-copied-name'); });
      if (!el) return;
      /* Highlight the copied name in green and show "Copied" beside it */
      el.classList.add('cbt-copied-name');
      var tag = document.createElement('span');
      tag.className = 'cbt-copied-tag';
      tag.textContent = 'Copied';
      el.appendChild(tag);
      clearTimeout(el._cbtCopyTimer);
      el._cbtCopyTimer = setTimeout(function(){
        el.classList.remove('cbt-copied-name');
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      }, 1400);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(confirmed, function(){
          if (legacyCopy(text)) confirmed();
        });
      } else if (legacyCopy(text)) confirmed();
    } catch(e) {
      if (legacyCopy(text)) confirmed();
    }
  }

  // Skip innerHTML assignment when markup is unchanged — avoids DOM thrash on
  // the 2s poll cycle and preserves user text selection mid-read.
  function setHTML(el, html) {
    if (el && el._cbtLastHTML !== html) { el._cbtLastHTML = html; el.innerHTML = html; }
  }

  function cbtObservedProgressRate(data, nowMs) {
    if (!data || data.shortClientRef == null) return null;

    var ref = String(data.shortClientRef);
    var generation = cbtTaskGeneration(data);
    var pkgs = Number(data.packagesBatched);
    if (!isFinite(pkgs) || pkgs < 0) return null;

    nowMs = Number(nowMs) || cbtNowMs();
    var cur = _cbtObservedProgressByRef[ref];

    /* New job / first observation / counter reset: establish a baseline.
       IMPORTANT: packages already present at this moment are NOT credited to
       the future observation window. */
    if (!cur || (generation && cur.generation && generation !== cur.generation) ||
        pkgs < cur.lastPkgs) {
      cur = _cbtObservedProgressByRef[ref] = {
        generation: generation,
        basePkgs: pkgs,
        baseAt: nowMs,
        lastPkgs: pkgs,
        lastAt: nowMs
      };
      return null;
    }

    if (!cur.generation && generation) cur.generation = generation;

    if (pkgs > cur.lastPkgs) {
      cur.lastPkgs = pkgs;
      cur.lastAt = nowMs;
    }

    var elapsedMs = nowMs - cur.baseAt;
    var deltaPkgs = pkgs - cur.basePkgs;
    if (elapsedMs < CBT_OBS_RATE_MIN_WINDOW_MS || deltaPkgs <= 0) return null;

    var rate = deltaPkgs / (elapsedMs / 60000);
    if (!(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return null;
    return rate;
  }

  function computeRow(data, forceFinished) {
    var inProg = forceFinished ? false : cbtIsLiveBatch(data);
    var info = cbtBatchingOpInfo(data, inProg);
    if (!info && !inProg) info = cbtBatchingOpInfo(data, false);

    var startMs = cbtStableLiveStartMs(data, inProg);
    var endMs = info && info.endMs ? info.endMs : null;
    var batchedN = Number(data.packagesBatched) || 0;
    var nowMs = cbtNowMs();

    /* Active batches always advance from the same monotonic/server-calibrated
       clock. For a completed batch, the latest BATCHING end is used. */
    var clockMs = (!inProg && endMs && startMs && endMs >= startMs) ? endMs : nowMs;
    var elapsedSec = startMs ? Math.max(0, (clockMs - startMs) / 1000) : null;

    var fullRate = (batchedN > 0 && elapsedSec > 30)
      ? batchedN / (elapsedSec / 60)
      : null;

    var scanRate = null;
    var rateSource = 'pending';

    /* Trust the API full-span calculation only when it is physically plausible
       under the dashboard's existing <=20 bags/min validity ceiling. */
    if (fullRate != null && isFinite(fullRate) && fullRate > 0 &&
        fullRate <= CBT_MAX_VALID_RATE) {
      scanRate = fullRate;
      rateSource = 'api-full-span';
    } else if (inProg) {
      /* If API timing is incomplete or mismatched, estimate from only the
         package INCREASE actually observed while this page has been watching.
         This prevents "35 existing packages / 30 seconds" fake spikes. */
      var observedRate = cbtObservedProgressRate(data, nowMs);
      if (observedRate != null) {
        scanRate = observedRate;
        rateSource = 'observed-delta';
      } else if (fullRate != null && fullRate > CBT_MAX_VALID_RATE) {
        rateSource = 'invalid-api-span';
      }
    } else if (fullRate != null && fullRate > CBT_MAX_VALID_RATE) {
      rateSource = 'invalid-api-span';
    }

    return {
      startMs: startMs,
      elapsedSec: elapsedSec,
      scanRate: scanRate,
      fullRate: fullRate,
      rateSource: rateSource,
      inProgress: inProg
    };
  }

  function ensureActiveAssociateInToday(data) {
    if (!data || !cbtIsLiveBatch(data)) return false;

    var assoc = data.associateId || data.associate || data.driverAssignment;
    if (typeof assoc !== 'string') return false;
    assoc = assoc.trim();
    if (!assoc || assoc.length > 80) return false;

    var history = loadHistory();
    if (history[assoc]) return false;

    /* Presence-only row. It is intentionally zeroed so we do not invent a
       completed rate/run. When the batch finishes, recordCompletedBatch()
       adds the real packages/time/runs to this same associate record. */
    history[assoc] = {
      assoc: assoc,
      totalPkgs: 0,
      totalSec: 0,
      runs: 0,
      avgRate: 0,
      bestRate: null,
      lastRate: null,
      lastAt: 0,
      totalMissing: 0,
      totalExpected: 0,
      activeSeen: true,
      firstSeenDate: todayStr()
    };

    captureName(data);
    saveHistory(history);

    if (activeTab === 'history') {
      try { renderHistory(); } catch(e0) {}
    }
    if (activeTab === 'weekly') {
      try { renderWeekly(); } catch(e1) {}
    }
    return true;
  }

  function recordCompletedBatch(data, elapsedSec) {
    if (!data.associateId&&!data.associate) return;
    var pkgs = Number(data.packagesBatched)||0;
    if (pkgs===0||!elapsedSec||elapsedSec<30) return;
    var assoc = data.associateId||data.associate;
    captureName(data);
    var rate = pkgs/(elapsedSec/60);

    /* Never let a timing mismatch contaminate Today / Weekly / Best /
       Latest Avg / Fastest history. Live can fall back to observed delta,
       but a completed batch is only stored when its complete API span itself
       produces a valid rate. */
    if (!(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return;
    var expected = data.totalExpectedPackages||0;
    var collected = data.packagesCollected||data.packagesBatched||0;
    var missing = expected>collected ? expected-collected : 0;
    var history = loadHistory();
    if (history[assoc]) {
      var e2=history[assoc], tp=e2.totalPkgs+pkgs, ts=e2.totalSec+elapsedSec;
      var priorBest = Math.max(Number(e2.bestRate)||0, Number(e2.lastRate)||0, Number(e2.avgRate)||0);
      history[assoc] = { assoc:assoc, totalPkgs:tp, totalSec:ts, runs:e2.runs+1,
        avgRate:tp/(ts/60), bestRate:Math.max(priorBest, rate),
        lastRate:rate, lastAt:Date.now(),
        totalMissing:(e2.totalMissing||0)+missing, totalExpected:(e2.totalExpected||0)+expected };
    } else {
      history[assoc] = { assoc:assoc, totalPkgs:pkgs, totalSec:elapsedSec, runs:1,
        avgRate:rate, bestRate:rate, lastRate:rate, lastAt:Date.now(),
        totalMissing:missing, totalExpected:expected };
    }
    saveHistory(history);
    try { hofRecordBatch(assoc, pkgs, elapsedSec, rate); } catch(e) {}
    if (activeTab==='history') renderHistory();
  }

  function ingestItem(item, authoritative) {
    if (!item || typeof item !== 'object' || item.shortClientRef == null) return false;
    var ref = String(item.shortClientRef);
    var incoming = Object.assign({}, item, { shortClientRef: ref });
    var existing = taskCache.get(ref);
    var incomingGen = cbtTaskGeneration(incoming);
    var existingGen = existing ? cbtTaskGeneration(existing) : '';

    /* The same CART_x reference can be reused by a later job. If the job/task
       identity changes, do not merge the new task with the old task's state. */
    if (existing && incomingGen && existingGen && incomingGen !== existingGen) {
      taskCache.delete(ref);
      cbtForgetLiveStart(ref);
      existing = null;
    }

    var incomingLive = cbtIsLiveBatch(incoming);
    if (authoritative && incomingLive) cbtObserveAuthoritativeLive(incoming);

    /* Never let an older/out-of-order response move package progress backward. */
    if (existing) {
      var oldB = Number(existing.packagesBatched) || 0, newB = Number(incoming.packagesBatched) || 0;
      var oldC = Number(existing.packagesCollected) || 0, newC = Number(incoming.packagesCollected) || 0;
      if (newB < oldB || newC < oldC) {
        if (newB < oldB) incoming.packagesBatched = oldB;
        if (newC < oldC) incoming.packagesCollected = oldC;
      }
    }

    /* Completion is recognized from an explicit non-BATCHING state. A partial
       response that merely omits operationDetails is not treated as finished. */
    if (existing && cbtIsLiveBatch(existing) && incoming.state !== undefined &&
        String(incoming.state).toUpperCase() !== 'BATCHING') {
      var mergedDone = Object.assign({}, existing, incoming);
      mergedDone.packagesBatched = Math.max(Number(existing.packagesBatched)||0, Number(incoming.packagesBatched)||0);
      mergedDone.packagesCollected = Math.max(Number(existing.packagesCollected)||0, Number(incoming.packagesCollected)||0);
      var finishedRow = computeRow(mergedDone, true);
      recordCompletedBatch(mergedDone, finishedRow.elapsedSec);
      taskCache.delete(ref);
      cbtForgetLiveStart(ref);
      return true;
    }

    /* Only actual BATCHING work belongs on the Live tab. Generic IN_PROGRESS
       jobs from another operation are intentionally ignored. */
    if (!incomingLive) return false;

    var merged = existing ? Object.assign({}, existing, incoming) : incoming;
    /* Some endpoints omit operationDetails on alternating responses. Preserve
       the last operation details for display metadata; the timer itself still
       comes only from the authoritative lock above. */
    if (existing && (!Array.isArray(incoming.operationDetails) || !incoming.operationDetails.length) &&
        Array.isArray(existing.operationDetails) && existing.operationDetails.length) {
      merged.operationDetails = existing.operationDetails;
    }
    merged.packagesBatched = Math.max(Number(existing && existing.packagesBatched)||0, Number(incoming.packagesBatched)||0);
    merged.packagesCollected = Math.max(Number(existing && existing.packagesCollected)||0, Number(incoming.packagesCollected)||0);
    if (!merged.associateId && !merged.associate && merged.driverAssignment) merged.associate = merged.driverAssignment;

    /* Today/Weekly name presence is event-driven from real BATCHING records.
       No new observer or polling loop is added. */
    try { ensureActiveAssociateInToday(merged); } catch(e) {}

    taskCache.set(ref, merged);
    return true;
  }

  function ingestData(d, authoritative) {
    if (!d) return;
    var changed = false;
    deepCaptureNames(d, 0);
    try { afaRecordJobs(d, 0); } catch(e) {}

    function take(i) { if (ingestItem(i, !!authoritative)) changed = true; }

    if (Array.isArray(d)) {
      d.forEach(take);
    } else if (d.shortClientRef != null) {
      take(d);
    } else {
      /* Do not stop at the first populated array. Some dashboard responses
         carry complementary records in summaries/tasks/results/items/jobs/data.
         Ingesting all of them prevents partial records from winning by accident. */
      ['summaries','tasks','results','items','jobs','data'].forEach(function(k) {
        if (Array.isArray(d[k])) d[k].forEach(take);
      });
    }

    if (changed && !authoritative) requestLiveRender();
  }

  var _origFetch = window.fetch;
  window.fetch = async function() {
    var resp;
    try { resp = await _origFetch.apply(this, arguments); }
    catch(e) { throw e; }

    try {
      if ((resp.headers.get('content-type') || '').includes('json')) {
        /* Text extraction is cheap; JSON.parse + deepCaptureNames can be
           expensive on large payloads. Do that duplicated passive work only
           when the main page has yielded. */
        resp.clone().text().then(function(raw){
          if (!raw) return;
          cbtIdle(function(){
            try { ingestData(JSON.parse(raw)); } catch(e2) {}
          }, 700);
        }).catch(function(){});
      }
    } catch(e3) {}
    return resp;
  };

  var _xhrOpen = XMLHttpRequest.prototype.open, _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._cbtUrl = url;
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function(){
      var xhr = this;
      try {
        if (!(xhr.getResponseHeader('content-type') || '').includes('json')) return;

        var payload;
        try {
          payload = xhr.responseType === 'json' ? xhr.response : xhr.responseText;
        } catch(e0) { return; }

        cbtIdle(function(){
          try {
            var d = (typeof payload === 'string') ? JSON.parse(payload) : payload;
            if (d) ingestData(d);
          } catch(e1) {}
        }, 700);
      } catch(e2) {}
    });
    return _xhrSend.apply(this, arguments);
  };

  var _cbtPollInFlight = false;
  async function pollActiveTasks() {
    if (_cbtPollInFlight || document.hidden) return;
    _cbtPollInFlight = true;
    try {
      var liveUrl = COMO_BASE + '/store/' + STORE_ID + '/activeJobsWithSiteSummary?_cbt=' + Date.now();
      var requestPerf = cbtPerfNow();
      var res = await _origFetch(liveUrl, {
        credentials:'include', cache:'no-store', headers:{Accept:'application/json'}
      });

      if (res.ok) {
        /* Use the server/proxy clock when available. This is specifically for
           elapsed-time correctness; the visible backend-updated timestamp below
           remains the user's local display time. */
        cbtCalibrateServerClock(res, requestPerf);

        var freshData = await res.json();
        _cbtBackendLastOk = Date.now();
        var activeRefs = new Set();
        var items = Array.isArray(freshData) ? freshData.slice() : [];
        ['summaries','tasks','results','items','jobs','data'].forEach(function(k) {
          if (freshData && Array.isArray(freshData[k])) items = items.concat(freshData[k]);
        });

        /* Select one authoritative timing record per cart. If multiple payload
           sections describe the same cart, prefer the record with the latest
           current BATCHING start rather than whichever array happened to appear
           first in the JSON. */
        var bestByRef = Object.create(null);
        items.forEach(function(d) {
          if (!d || d.shortClientRef == null || !cbtIsLiveBatch(d)) return;
          var ref = String(d.shortClientRef);
          activeRefs.add(ref);
          var info = cbtBatchingOpInfo(d, true);
          var score = info && info.startMs ? info.startMs : -1;
          var prev = bestByRef[ref];
          if (!prev || score > prev.score) bestByRef[ref] = { data:d, score:score };
        });

        Object.keys(bestByRef).forEach(function(ref) {
          cbtObserveAuthoritativeLive(bestByRef[ref].data);
        });

        activeRefs.forEach(function(ref) {
          _cbtMissingPollsByRef[ref] = 0;
          var locked = _cbtLiveStartByRef[ref];
          if (locked) {
            locked.lastSeen = cbtNowMs();
            locked.missingSince = 0;
          }
        });

        taskCache.forEach(function(val, key) {
          key = String(key);
          if (activeRefs.has(key)) {
            _cbtMissingPollsByRef[key] = 0;
            return;
          }

          cbtMarkLiveMissing(key);
          var misses = (_cbtMissingPollsByRef[key] || 0) + 1;
          _cbtMissingPollsByRef[key] = misses;
          if (misses >= CBT_MISSING_POLL_GRACE) {
            taskCache.delete(key);
            delete _cbtMissingPollsByRef[key];
          }
        });

        /* Ingest every complementary array, but suppress intermediate renders.
           Re-apply the canonical timer observation afterward in case a stale
           duplicate record for the same cart appeared in another payload array. */
        ingestData(freshData, true);
        Object.keys(bestByRef).forEach(function(ref) {
          /* Make the canonical current-job record the final cache merge too.
             This prevents a stale duplicate from another payload array from
             being the last writer for the same cart. */
          ingestItem(bestByRef[ref].data, true);
          cbtObserveAuthoritativeLive(bestByRef[ref].data);
        });

        cbtPruneOldLiveStarts();
      }
    } catch(e) {}
    finally {
      _cbtPollInFlight = false;
      requestLiveRender();
    }
  }

  function buildPanel() {
    var panel2 = document.createElement('div');
    panel2.id = 'cbt-panel';
    panel2.innerHTML =
      '<div id="cbt-header">' +
        '<span id="cbt-title">Batcher Timers</span>' +
        '<div id="cbt-controls">' +
          '<span id="cbt-font-dec" title="Smaller (A−)">A−</span>' +
          '<span id="cbt-scale-reset" title="Reset size to 100%">100%</span>' +
          '<span id="cbt-font-inc" title="Larger (A+)">A+</span>' +
          '<span id="cbt-theme-btn" title="Toggle Dark/Light">🌙</span>' +
          '<span id="cbt-afa-btn" title="Open cart actions">' +
            '<span class="cbt-afa-lbl">▶ Run</span>' +
          '</span>' +
          '<span id="cbt-collapse-btn" title="Collapse/Expand">🔼</span>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-stats-bar">' +
        '<div class="cbt-stat-card">' +
          '<div class="cbt-stat-icon">\uD83E\uDDBA</div>' +
          '<div class="cbt-stat-label">Batchers</div>' +
          '<div class="cbt-stat-value"><span id="cbt-stat-ip">\u2014</span><span id="cbt-stat-delta"></span></div>' +
        '</div>' +
        '<div class="cbt-stat-card">' +
          '<div class="cbt-stat-icon">\uD83D\uDCCA</div>' +
          '<div class="cbt-stat-label">Recommended This Hour</div>' +
          '<div class="cbt-stat-value"><span id="cbt-stat-rec">\u2014</span><span id="cbt-stat-dot"></span></div>' +
        '</div>' +
        '<div class="cbt-stat-card">' +
          '<div class="cbt-stat-icon">\uD83D\uDCE6</div>' +
          '<div class="cbt-stat-label">Remaining</div>' +
          '<div class="cbt-stat-value" id="cbt-stat-rem">\u2014</div>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-tabs">' +
        '<span class="cbt-tab active" data-tab="live">Live</span>' +
        '<span class="cbt-tab" data-tab="history">Today</span>' +
        '<span class="cbt-tab" data-tab="weekly">Weekly</span>' +
        '<span class="cbt-tab" data-tab="hof" title="Top 30 fastest batchers of all time">Fastest</span>' +
        '<span class="cbt-tab" data-tab="names">Names</span>' +
      '</div>' +
      '<div id="cbt-unified-search">' +
        '<div id="cbt-unified-search-box">' +
          '<input id="cbt-unified-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="Find associate by name..."/>' +
          '<span id="cbt-unified-search-count"></span>' +
          '<button id="cbt-unified-search-clear" type="button" title="Clear search">✕</button>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-body">' +
        '<div id="cbt-live-view">' +
          '<table id="cbt-table" style="table-layout:fixed;width:100%;"><thead><tr>' +
            '<th class="cbt-sortable-live" data-sort="assoc" style="width:40%;text-align:left;">Associate</th>' +
            '<th class="cbt-sortable-live" data-sort="elapsed" style="width:30%;text-align:center;">Elapsed</th>' +
            '<th class="cbt-sortable-live" data-sort="rate" style="width:30%;text-align:center;">Bags/min \u25BC</th>' +
          '</tr></thead><tbody id="cbt-tbody"></tbody></table>' +
          '<div id="cbt-empty">No active batching tasks</div>' +
          '<div id="cbt-live-results"></div>' +
        '</div>' +
        '<div id="cbt-history-view" style="display:none">' +
          '<div id="cbt-hist-summary"></div>' +
          '<table id="cbt-hist-table"><thead><tr>' +
            '<th class="cbt-sortable-hist" data-sort="assoc">Associate</th>' +
            '<th class="cbt-sortable-hist" data-sort="runs">Batch</th>' +
            '<th class="cbt-sortable-hist" data-sort="pkgs">Pkgs</th>' +
            '<th class="cbt-sortable-hist" data-sort="bestRate">Best \u25BC</th>' +
            '<th class="cbt-sortable-hist" data-sort="lastRate">Latest Avg</th>' +
          '</tr></thead><tbody id="cbt-hist-tbody"></tbody></table>' +
          '<div id="cbt-hist-empty">No history yet today</div>' +
          '<div id="cbt-hist-cross"></div>' +
        '</div>' +
        '<div id="cbt-weekly-view" style="display:none">' +
          '<div id="cbt-weekly-summary"></div>' +
          '<table id="cbt-weekly-table"><thead><tr>' +
            '<th class="cbt-sortable" data-sort="assoc">Associate</th>' +
            '<th class="cbt-sortable" data-sort="runs">Batch</th>' +
            '<th class="cbt-sortable" data-sort="pkgs">Pkgs</th>' +
            '<th class="cbt-sortable" data-sort="bestRate">Best \u25BC</th>' +
            '<th class="cbt-sortable" data-sort="lastRate">Last Avg</th>' +
            '<th class="cbt-sortable" data-sort="hrs">Hrs</th>' +
          '</tr></thead><tbody id="cbt-weekly-tbody"></tbody></table>' +
          '<div id="cbt-weekly-empty">No weekly data yet</div>' +
          '<div id="cbt-weekly-cross"></div>' +
        '</div>' +
        '<div id="cbt-names-view" style="display:none">' +
          '<div id="cbt-names-count" style="text-align:center;font-size:12px;color:#5a7a96;padding:2px 0 4px;font-weight:600;"></div>' +
          '<table id="cbt-names-table"><thead><tr>' +
            '<th style="text-align:left;">Associate</th>' +
          '</tr></thead><tbody id="cbt-names-tbody"></tbody></table>' +
          '<div id="cbt-names-empty" style="display:none;text-align:center;color:#aaa;padding:9px 0;font-size:13px;font-style:italic;line-height:1.2;">No names saved yet</div>' +
        '</div>' +
        '<div id="cbt-hof-view" style="display:none">' +
          '<table id="cbt-hof-table"><thead><tr>' +
            '<th>#\u2003Name</th>' +
            '<th>Batch</th>' +
            '<th>Pkgs</th>' +
            '<th>Peak</th>' +
            '<th>Last Avg</th>' +
            '<th>Date</th>' +
          '</tr></thead><tbody id="cbt-hof-tbody"></tbody></table>' +
          '<div id="cbt-hof-empty"></div>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-drag-bottom" title="Drag to resize"></div>';
    return panel2;
  }

  var _panel2Ref = null;

  /* ══════════════════════════════════════
     PANEL MOUNTING + SELF-HEAL

     The panel normally anchors to the <utilization> element. If that
     never renders (layout change, slow load, Angular re-render) the
     panel would silently never appear — so after a few failed tries
     we fall back to other stable anchors rather than giving up.
  ══════════════════════════════════════ */
  var PANEL_HEALTH_MS = 2000;
  var _mountFails = 0;
  /* While Date.now() is under this, the panel is checked every 400ms instead
     of every 2s. Set at startup and renewed on every route change, so
     returning to the dashboard re-mounts the board straight away rather than
     waiting for the next slow health tick. */
  var _fastMountUntil = 0;

  /* ── Auto-reload when the board never appears ──
     If the dashboard page loads but the board's anchor never renders,
     reload the page so it gets a fresh chance. The counter lives in
     sessionStorage: per tab, survives the reloads it causes, cleared
     the moment the board mounts (or when the tab closes), and capped
     so a broken page can never reload forever. Each attempt only
     fires after several failed 2s health checks, which is the delay
     between attempts. */
  var AUTO_RELOAD_MAX = 3;          /* hard cap on automatic reloads per tab */
  var AUTO_RELOAD_AFTER_FAILS = 5;  /* failed 2s health checks before reloading (about 10s) */
  var AUTO_RELOAD_KEY = 'cbt_auto_reload_count';

  function autoReloadCount() {
    try { return parseInt(sessionStorage.getItem(AUTO_RELOAD_KEY) || '0', 10) || 0; }
    catch(e) { return AUTO_RELOAD_MAX; } /* storage unusable: never auto-reload */
  }
  function clearAutoReloadCount() {
    try { sessionStorage.removeItem(AUTO_RELOAD_KEY); } catch(e) {}
  }
  function maybeAutoReload() {
    if (!isDashboardView()) return;                    /* NEVER reload task/cart/other pages */
    if (document.getElementById('cbt-panel')) return;  /* board is up, nothing to fix */
    if (_mountFails < AUTO_RELOAD_AFTER_FAILS) return; /* give normal mounting time first */
    var n = autoReloadCount();
    if (n >= AUTO_RELOAD_MAX) return;                  /* cap reached, stop trying */
    try { sessionStorage.setItem(AUTO_RELOAD_KEY, String(n + 1)); } catch(e) { return; }
    location.reload();
  }

  /* ── Which site are we on? ──
     The script runs on two different tools:
       COMO Operations Dashboard  -> task sorting, Time Left, Batcher Timers
                                     board, and Search Associate on cart pages
       Outbound Dashboard / HWMS  -> Search Associate panel + QR only
     Everything COMO-specific stays off the Outbound site, and the Batcher
     Timers board never appears there. Saved names/history come from
     Tampermonkey storage and Firebase, both of which work across domains. */
  function isComoSite() {
    return location.hostname.indexOf('como-operations-dashboard') !== -1;
  }
  function isOutboundSite() {
    return location.hostname === 'na.store-management.f3.amazon.dev';
  }
  /* The Search Associate panel belongs on COMO cart pages and on every
     Outbound Dashboard page. */
  /* The floating Search Associate panel has been retired: the autocomplete
     types straight into the site's own assignment fields, so there is no
     longer anything to copy out of a side panel. The panel's code is left
     intact — set this back to true to bring it back if it is ever needed. */
  var SHOW_SEARCH_PANEL = false;

  function shouldShowSearchPanel() {
    if (!SHOW_SEARCH_PANEL) return false;
    if (isOutboundSite()) return true;
    return isTaskDetailPage();
  }

  /* A cart/task detail page. Only the Associate Search panel belongs here —
     the Batcher Timers board is for the dashboard view.
     Checked by URL as well as by DOM: on a fresh reload the script runs
     before Angular has rendered div.job-details, and the URL is known
     immediately, so the panel can mount right away. */
  var TASK_DETAIL_RE = /\/(jobdetails|task)(\b|\/|\?|#|$)/i;
  function isTaskDetailPage() {
    if (document.querySelector('div.job-details')) return true;
    return TASK_DETAIL_RE.test(location.pathname);
  }

  /* Routes the board must never appear on. This app does client-side routing,
     so the script stays loaded when you click Packages / Orders / Labor /
     Layout — without this check the board follows you onto those pages. */
  var NON_DASHBOARD_RE = /\/(packages|orders|labor|layout|associates?)(\b|\/|\?|#|$)/i;

  /* The ONLY page the board belongs on: /store/{id}/dash, the main COMO
     Operations Dashboard. Allowlist instead of blocklist, so task pages,
     cart and job-detail pages, the tasks/jobs lists, and anything new
     the app adds are all excluded by default. */
  var DASHBOARD_PATH_RE = /^\/store\/[^\/]+\/dash\/?$/i;

  function isDashboardView() {
    if (!isComoSite()) return false;        /* board is COMO-only */
    if (isTaskDetailPage()) return false;
    if (!DASHBOARD_PATH_RE.test(location.pathname)) return false;
    if (NON_DASHBOARD_RE.test(location.hash)) return false;
    return true;
  }

  /* True when the board is showing somewhere it shouldn't be. */
  function boardIsMisplaced() {
    return !isDashboardView() && !!document.getElementById('cbt-panel');
  }

  /* Detach the Batcher Timers board but KEEP the cached node, so its state
     and event listeners survive and it re-mounts instantly on the dashboard. */
  function detachMainPanel() {
    var p = document.getElementById('cbt-panel');
    if (p) p.remove();
  }

  /* The board has exactly ONE valid home: immediately before the
     <utilization> block in the dashboard's right-hand column.

     Earlier versions guessed at fallback anchors (.ng-scope, main-content)
     when <utilization> was missing — that is what caused the board to
     appear on cart detail pages. If the real anchor isn't present we now
     simply don't mount: better absent than in the wrong place. */
  function findMountPoint() {
    if (!isDashboardView()) return null;
    var el = document.querySelector('utilization.dashboard-utilization') ||
             document.querySelector('utilization');
    if (el && el.parentNode) return { el: el, mode: 'before' };
    return null;
  }

  function injectPanel() {
    /* Only the dashboard view gets the board — not cart details,
       not Packages / Orders / Labor / Layout. */
    if (!isDashboardView()) { detachMainPanel(); return; }

    var existing = document.getElementById('cbt-panel');
    if (existing && existing.isConnected) return;

    if (!_panel2Ref) {
      _panel2Ref = buildPanel();
      attachPanelEvents(_panel2Ref);
    }

    var mount = findMountPoint();
    if (!mount) return;

    _panel2Ref.style.position = '';
    _panel2Ref.style.top = '';
    _panel2Ref.style.right = '';
    _panel2Ref.style.width = '';
    _panel2Ref.style.zIndex = '';

    try {
      var savedH = localStorage.getItem('cbt_body_h');
      var collapsed0 = localStorage.getItem('cbt_panel_collapsed') === '1';
      var body0  = _panel2Ref.querySelector('#cbt-body');
      var tabs0  = _panel2Ref.querySelector('#cbt-tabs');
      var search0 = _panel2Ref.querySelector('#cbt-unified-search');
      var drag0 = _panel2Ref.querySelector('#cbt-drag-bottom');
      var collapse0 = _panel2Ref.querySelector('#cbt-collapse-btn');
      if (savedH && body0) {
        var h0 = parseFloat(savedH);
        body0.style.height    = h0 + 'px';
        body0.style.maxHeight = h0 + 'px';
      }
      if (collapsed0) {
        if (body0) { body0.style.display = 'none'; body0.style.minHeight = '0'; }
        if (tabs0) tabs0.style.display = 'none';
        if (search0) search0.style.display = 'none';
        if (drag0) drag0.style.display = 'none';
        if (collapse0) collapse0.textContent = '🔽';
      } else {
        if (body0) { body0.style.display = ''; if (!body0.style.minHeight || body0.style.minHeight === '0px') body0.style.minHeight = (parseFloat(savedH) || 350) + 'px'; }
        if (tabs0) tabs0.style.display = '';
        if (search0) search0.style.display = '';
        if (drag0) drag0.style.display = '';
        if (collapse0) collapse0.textContent = '🔼';
      }
    } catch(ex) {}

    mount.el.parentNode.insertBefore(_panel2Ref, mount.el);

    _mountFails = 0;              /* mounted successfully */
    clearAutoReloadCount();       /* board is up — reset the reload budget */
    try { applyUiScale(); } catch(ex) {}   /* restore the saved size */

    /* Only render the tab the user can actually see. Hidden tabs keep their
       data in storage/cache and render normally the moment the user clicks
       them. This removes a large burst of unnecessary DOM creation at startup. */
    try { renderActiveSearchTab(); } catch(ex) { try { renderLive(); } catch(ex2) {} }

    /* If the backend answered during the short mount window, make sure the
       freshly mounted Live table receives that cached data immediately. */
    if (activeTab === 'live' && taskCache.size) requestLiveRender();
  }

  /* Runs on an interval: if the panel is gone or was detached by an
     Angular re-render, rebuild and re-mount it automatically. */
  function panelHealthCheck() {
    /* Anywhere but the dashboard view, the board stays hidden. */
    if (!isDashboardView()) { detachMainPanel(); _mountFails = 0; return; }

    var p = document.getElementById('cbt-panel');
    if (p && p.isConnected) { _mountFails = 0; return; }

    injectPanel();

    if (!document.getElementById('cbt-panel')) {
      /* Anchor not on screen yet (or not a dashboard view) — just wait.
         Rebuilding the node wouldn't help and would lose panel state. */
      if (_mountFails < 1000) _mountFails++;
      maybeAutoReload();
    }
  }

  /* Same idea for the Associate Search panel on task detail pages. */
  function taskPanelHealthCheck() {
    var onTaskPage = shouldShowSearchPanel();
    var tp = document.getElementById('cbt-tp');
    if (onTaskPage) {
      if (!tp || !tp.isConnected) { _tpRef = null; injectTaskPanel(); }
    } else if (tp) {
      tp.remove(); _tpRef = null;
    }
  }

  function setDashboardSearchTerm(value) {
    dashboardSearchTerm = value == null ? '' : String(value);
    liveSearchTerm = dashboardSearchTerm;
    historySearchTerm = dashboardSearchTerm;
    weeklySearchTerm = dashboardSearchTerm;
    namesSearchTerm = dashboardSearchTerm;
    hofSearchTerm = dashboardSearchTerm;
  }

  /* Name-only search: exact match first, then prefix matches, then contains.
     Rank badges are stamped before filtering and are never renumbered here. */
  function prioritizeNameMatches(list, term, getName) {
    term = (term || '').toLowerCase().trim();
    if (!term || !Array.isArray(list) || list.length < 2) return list;
    return list.map(function(item, idx){
      var name = String(getName(item) || '').toLowerCase();
      var score = name === term ? 0 : (name.indexOf(term) === 0 ? 1 : 2);
      return { item:item, idx:idx, score:score };
    }).sort(function(a,b){ return a.score - b.score || a.idx - b.idx; })
      .map(function(x){ return x.item; });
  }

  var _unifiedCountTimer = null;
  function requestUnifiedSearchCount() {
    clearTimeout(_unifiedCountTimer);
    _unifiedCountTimer = setTimeout(updateUnifiedSearchCount, 0);
  }

  function updateUnifiedSearchCount() {
    var badge = document.getElementById('cbt-unified-search-count');
    if (!badge) return;
    var term = (dashboardSearchTerm || '').trim();
    if (!term) { badge.textContent = ''; badge.style.display = 'none'; return; }
    var ids = { live:'cbt-live-view', history:'cbt-history-view', weekly:'cbt-weekly-view', hof:'cbt-hof-view', names:'cbt-names-view' };
    var view = document.getElementById(ids[activeTab] || 'cbt-live-view');
    if (!view) { badge.textContent = ''; badge.style.display = 'none'; return; }
    var seen = Object.create(null);
    var nodes = view.querySelectorAll('.cbt-assoc, .cbt-search-row-name, .cbt-name-cell');
    for (var i=0; i<nodes.length; i++) {
      var clone = nodes[i].cloneNode(true);
      var junk = clone.querySelectorAll('.cbt-rank, .cbt-slow-alert, .cbt-copied-tag');
      for (var j=0; j<junk.length; j++) junk[j].remove();
      var name = (clone.textContent || '').trim().toLowerCase();
      if (name && name !== '—') seen[name] = true;
    }
    var count = Object.keys(seen).length;
    badge.textContent = count + ' found';
    badge.style.display = 'block';
  }

  function renderActiveSearchTab() {
    if (activeTab === 'live') { renderLive(); renderLiveSearch(dashboardSearchTerm); }
    else if (activeTab === 'history') renderHistory();
    else if (activeTab === 'weekly') renderWeekly();
    else if (activeTab === 'names') renderNames();
    else if (activeTab === 'hof') renderHallOfFame();
    requestUnifiedSearchCount();
  }

  function attachPanelEvents(panel2) {
    var unifiedSearch = panel2.querySelector('#cbt-unified-search-input');
    if (unifiedSearch) unifiedSearch.value = dashboardSearchTerm;
    panel2.querySelectorAll('.cbt-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        panel2.querySelectorAll('.cbt-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        /* Keep the same associate query while switching tabs. */
        setDashboardSearchTerm(dashboardSearchTerm);
        document.getElementById('cbt-live-view').style.display    = activeTab==='live'    ? '' : 'none';
        document.getElementById('cbt-history-view').style.display = activeTab==='history' ? '' : 'none';
        document.getElementById('cbt-weekly-view').style.display  = activeTab==='weekly'  ? '' : 'none';
        document.getElementById('cbt-names-view').style.display   = activeTab==='names'   ? '' : 'none';
        var hofView = document.getElementById('cbt-hof-view');
        if (hofView) hofView.style.display = activeTab==='hof' ? '' : 'none';
        if (activeTab==='hof') { try { hofPull(); } catch(e) {} }
        renderActiveSearchTab();

        /* A new computer should never sit on an empty Weekly/Today view while
           waiting for the 10-second background sync. Render cache instantly,
           then refresh shared Firebase data in the background. */
        if (activeTab === 'weekly' && (Date.now() - _lastWeeklyPullAt > 2500)) {
          try { syncWeeklyPull(); } catch(e2) {}
        } else if (activeTab === 'history' && (Date.now() - _lastHistoryPullAt > 2500)) {
          try { syncHistoryPull(); } catch(e3) {}
        }
      });
    });

    var afaBtn = panel2.querySelector('#cbt-afa-btn');
    if (afaBtn) afaBtn.addEventListener('click', function(e){
      e.stopPropagation();

      /* Code-editor style Run / Stop control:
         idle    -> ▶ Run opens the independent Cart Actions menu
         running -> ⏹ Stop requests the current action to stop */
      if (_afaRunning) {
        _afaStop = true;
        afaSetBtn('⏹ Stopping…', true);

        var modalStop = document.querySelector('#cbt-afa-card [data-afa="stop"]');
        if (modalStop) {
          modalStop.textContent = '⏹ Stopping…';
          modalStop.disabled = true;
        }
        return;
      }

      try { afaConfirm(); } catch(err) {}
    });

    /* v23.9.74: restore the original VERTICAL dashboard length.
       Width stays exactly as before. The compact 240px default from older
       versions is migrated back to 350px once. If someone manually made the
       board taller than 350px, keep that larger custom height. */
    try {
      var restoreHeightKey = 'cbt_body_h_restore_v23944';
      if (!localStorage.getItem(restoreHeightKey)) {
        var savedBodyH = parseFloat(localStorage.getItem('cbt_body_h') || '350');
        if (!isFinite(savedBodyH) || savedBodyH <= 350) {
          localStorage.setItem('cbt_body_h', '350');
        }
        localStorage.setItem(restoreHeightKey, '1');
      }
    } catch(eRestore) {}

    /* v23.9.74: persist the dashboard's collapsed/open state across reloads. */
    var isCollapsed = false;
    try { isCollapsed = localStorage.getItem('cbt_panel_collapsed') === '1'; } catch(eCollapsedLoad) {}
    var collapseBtn = panel2.querySelector('#cbt-collapse-btn');

    function applyMainCollapseState() {
      var body = panel2.querySelector('#cbt-body');
      var tabs = panel2.querySelector('#cbt-tabs');
      var searchBar = panel2.querySelector('#cbt-unified-search');
      var drag = panel2.querySelector('#cbt-drag-bottom');
      var savedH = parseFloat(localStorage.getItem('cbt_body_h') || '350');
      if (!isFinite(savedH) || savedH < 350) savedH = 350;

      if (isCollapsed) {
        if (body) { body.style.display = 'none'; body.style.minHeight = '0'; }
        if (tabs) tabs.style.display = 'none';
        if (searchBar) searchBar.style.display = 'none';
        if (drag) drag.style.display = 'none';
        if (collapseBtn) collapseBtn.textContent = '🔽';
      } else {
        if (body) {
          body.style.display = '';
          body.style.height = savedH + 'px';
          body.style.maxHeight = savedH + 'px';
          body.style.minHeight = savedH + 'px';
        }
        if (tabs) tabs.style.display = '';
        if (searchBar) searchBar.style.display = '';
        if (drag) drag.style.display = '';
        if (collapseBtn) collapseBtn.textContent = '🔼';
      }
    }

    applyMainCollapseState();

    collapseBtn.addEventListener('click', function() {
      var savedH = parseFloat(localStorage.getItem('cbt_body_h') || '350');

      if (isCollapsed) {
        isCollapsed = false;
        try { localStorage.setItem('cbt_panel_collapsed', '0'); } catch(ex) {}
        applyMainCollapseState();
      } else if (savedH > 350) {
        /* Preserve the existing first-click behavior for a manually enlarged
           board: shrink it to the normal 350px height before fully collapsing. */
        try { localStorage.setItem('cbt_body_h', '350'); } catch(ex) {}
        applyMainCollapseState();
      } else {
        isCollapsed = true;
        try { localStorage.setItem('cbt_panel_collapsed', '1'); } catch(ex) {}
        applyMainCollapseState();
      }
    });

    var isDark = localStorage.getItem('cbt_dark') !== 'false';
    var themeBtn = panel2.querySelector('#cbt-theme-btn');
    function applyTheme() {
      if (isDark) { panel2.classList.add('dark'); themeBtn.textContent = '☀️'; }
      else { panel2.classList.remove('dark'); themeBtn.textContent = '🌙'; }
    }
    applyTheme();
    themeBtn.addEventListener('click', function() {
      isDark = !isDark;
      try { localStorage.setItem('cbt_dark', isDark); } catch(e) {}
      applyTheme();
      try { applyPopupTheme(); } catch(e) {}
    });

    applyUiScale();
    var fontIncBtn  = panel2.querySelector('#cbt-font-inc');
    var fontDecBtn  = panel2.querySelector('#cbt-font-dec');
    var scaleResetB = panel2.querySelector('#cbt-scale-reset');
    if (fontIncBtn)  fontIncBtn.addEventListener('click',  function(){ stepUiScale(1); });
    if (fontDecBtn)  fontDecBtn.addEventListener('click',  function(){ stepUiScale(-1); });
    if (scaleResetB) scaleResetB.addEventListener('click', function(){ resetUiScale(); });

    var isDragging = false, dragStartY = 0, dragStartH = 350;
    panel2.querySelector('#cbt-drag-bottom').addEventListener('mousedown', function(e) {
      isDragging = true;
      dragStartY = e.clientY;
      var body = panel2.querySelector('#cbt-body');
      dragStartH = body ? body.offsetHeight : 270;
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var body = panel2.querySelector('#cbt-body');
      var tabs = panel2.querySelector('#cbt-tabs');
      if (!body) return;
      var contentH = body.scrollHeight || 9999;
      var newH = Math.min(contentH, Math.max(350, dragStartH + (e.clientY - dragStartY)));
      body.style.height = newH + 'px';
      body.style.maxHeight = newH + 'px';
      body.style.minHeight = newH + 'px';
      if (tabs) tabs.style.display = '';
      var searchBar2 = panel2.querySelector('#cbt-unified-search');
      if (searchBar2) searchBar2.style.display = '';
      try { localStorage.setItem('cbt_body_h', newH); } catch(ex) {}
    });
    document.addEventListener('mouseup', function() { isDragging = false; });

    try {
      var savedH = localStorage.getItem('cbt_body_h');
      if (savedH) {
        var body = panel2.querySelector('#cbt-body');
        var h = parseFloat(savedH);
        if (body) { body.style.height = h + 'px'; body.style.maxHeight = h + 'px'; }
      }
      /* Height restoration must never override the persisted collapsed state. */
      applyMainCollapseState();
    } catch(ex) {}

    document.addEventListener('click', function(e) {
      var el = e.target.closest('.cbt-assoc');
      if (!el || !panel2.contains(el)) return;
      var oldTag = el.querySelector('.cbt-copied-tag');
      if (oldTag) oldTag.remove();
      var text = el.textContent.replace(/^\d+\s*/, '').replace(/[●•]/g, '').trim();
      copyWithFeedback(el, text, e);
    });

    document.addEventListener('click', function(e) {
      var el = e.target.closest('.cbt-search-row-name');
      if (!el || !panel2.contains(el)) return;
      var oldTag2 = el.querySelector('.cbt-copied-tag');
      if (oldTag2) oldTag2.remove();
      var text = el.textContent.trim();
      copyWithFeedback(el, text, e);
    });

    document.addEventListener('click', function(e) {
      if (e.target.id === 'cbt-unified-search-clear') {
        var inp = document.getElementById('cbt-unified-search-input');
        if (inp) inp.value = '';
        setDashboardSearchTerm('');
        renderActiveSearchTab();
        if (inp) inp.focus();
      }
      var nameCell = e.target.closest('.cbt-name-cell');
      if (nameCell) {
        var oldTag3 = nameCell.querySelector('.cbt-copied-tag');
        if (oldTag3) oldTag3.remove();
        var nm = nameCell.textContent.trim();
        copyWithFeedback(nameCell, nm, e);
      }
    });

    document.addEventListener('input', function(e) {
      if (e.target.id === 'cbt-unified-search-input') {
        setDashboardSearchTerm(e.target.value);
        renderActiveSearchTab();
      }
    });

    document.addEventListener('click', function(e) {
      var th = e.target.closest('.cbt-sortable');
      if (th && document.getElementById('cbt-weekly-table') && document.getElementById('cbt-weekly-table').contains(th)) {
        var key=th.dataset.sort;
        if(weeklySortKey===key){weeklySortAsc=!weeklySortAsc;}else{weeklySortKey=key;weeklySortAsc=false;}
        renderWeekly();
      }
      th = e.target.closest('.cbt-sortable-live');
      if (th && document.getElementById('cbt-table') && document.getElementById('cbt-table').contains(th)) {
        var key2=th.dataset.sort;
        /* liveSortKey starts as 'rate', so without the liveSortUser flag the
           very first Bags/min click fell into the "same key" branch and
           sorted ascending instead of descending. */
        if (liveSortUser && liveSortKey === key2) { liveSortAsc = !liveSortAsc; }
        else { liveSortKey = key2; liveSortAsc = false; liveSortUser = true; }
        renderLive();
      }
      th = e.target.closest('.cbt-sortable-hist');
      if (th && document.getElementById('cbt-hist-table') && document.getElementById('cbt-hist-table').contains(th)) {
        var key3=th.dataset.sort;
        if(historySortKey===key3){historySortAsc=!historySortAsc;}else{historySortKey=key3;historySortAsc=false;}
        renderHistory();
      }
    });
  }

  /* ── Live Search — searches across Today and Weekly ── */
  function renderLiveSearch(term) {
    var resultsEl = document.getElementById('cbt-live-results');
    if (!resultsEl) return;
    if (!term || term.trim() === '') { resultsEl.innerHTML = ''; requestUnifiedSearchCount(); return; }
    term = term.toLowerCase().trim();
    var html = '';
    var shown = new Set();

    var history = getDisplayHistory(), histEntries = Object.values(history).filter(function(e){ return e.assoc && e.assoc.toLowerCase().indexOf(term) !== -1; });
    histEntries = prioritizeNameMatches(histEntries, term, function(e){ return e.assoc; });
    if (histEntries.length > 0) {
      html += '<div class="cbt-search-result-section">TODAY</div>';
      histEntries.forEach(function(e) {
        shown.add(e.assoc.toLowerCase());
        var rateCls = e.avgRate >= WARN_RATE ? 'good' : e.avgRate >= ALERT_RATE ? 'warn' : 'alert';
        html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + e.assoc + '</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.runs + '</span> runs | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
        '<span class="cbt-search-row-rate"><span class="cbt-hist-rate ' + rateCls + '">' + e.avgRate.toFixed(1) + '</span></span></div>';
      });
    }

    var weekly = sanitizeWeekly(getDisplayWeekly()), agg = {};
    for (var dk of Object.keys(weekly)) {
      for (var a of Object.keys(weekly[dk])) {
        if (a.toLowerCase().indexOf(term) === -1) continue;
        if (!agg[a]) agg[a] = { assoc:a, totalPkgs:0, totalSec:0, runs:0, daysSet:new Set() };
        agg[a].totalPkgs += weekly[dk][a].totalPkgs;
        agg[a].totalSec  += weekly[dk][a].totalSec;
        agg[a].runs      += weekly[dk][a].runs;
        agg[a].daysSet.add(dk);
      }
    }
    var weeklyEntries = prioritizeNameMatches(Object.values(agg), term, function(e){ return e.assoc; });
    if (weeklyEntries.length > 0) {
      html += '<div class="cbt-search-result-section">WEEKLY</div>';
      weeklyEntries.forEach(function(e) {
        shown.add(e.assoc.toLowerCase());
        var avgRate = e.totalPkgs / (e.totalSec / 60);
        var rateCls = avgRate >= WARN_RATE ? 'good' : avgRate >= ALERT_RATE ? 'warn' : 'alert';
        html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + e.assoc + '</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.daysSet.size + '</span> days | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
        '<span class="cbt-search-row-rate"><span class="cbt-hist-rate ' + rateCls + '">' + avgRate.toFixed(1) + '</span></span></div>';
      });
    }

    html += savedNamesSearchHTML(term, shown);

    if (html === '') html = '<div style="text-align:center;color:#aaa;padding:10px;font-style:italic;font-size:14px;">No results found for "' + term + '"</div>';
    setHTML(resultsEl, html);
    requestUnifiedSearchCount();
  }

  /* The arrow was baked into the header markup and never moved. Redraw it
     on whichever column is active, pointing the way the list is ordered. */
  var LIVE_SORT_LABELS = { assoc: 'Associate', elapsed: 'Elapsed', rate: 'Bags/min' };
  function updateLiveSortHeaders() {
    var table = document.getElementById('cbt-table');
    if (!table) return;
    var ths = table.querySelectorAll('.cbt-sortable-live');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var k = th.dataset ? th.dataset.sort : th.getAttribute('data-sort');
      var base = LIVE_SORT_LABELS[k] ||
                 (th.textContent || '').replace(/[\u25B2\u25BC]/g, '').trim();
      var arrow = (k === liveSortKey) ? (liveSortAsc ? ' \u25B2' : ' \u25BC') : '';
      var next = base + arrow;
      if (th.textContent !== next) th.textContent = next;
    }
  }

  function lockLiveRowGeometry() {
    var table = document.getElementById('cbt-table');
    if (!table) return;

    var header = table.querySelector('thead tr');
    if (header) {
      header.style.setProperty('display', 'grid', 'important');
      header.style.setProperty('grid-template-columns',
        'minmax(0,40%) minmax(0,30%) minmax(0,30%)', 'important');
      header.style.setProperty('width', '100%', 'important');
      header.style.setProperty('max-width', '100%', 'important');
      header.style.setProperty('box-sizing', 'border-box', 'important');
    }

    var rows = table.querySelectorAll('tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];

      tr.style.setProperty('display', 'grid', 'important');
      tr.style.setProperty('grid-template-columns',
        'minmax(0,40%) minmax(0,30%) minmax(0,30%)', 'important');
      tr.style.setProperty('width', '100%', 'important');
      tr.style.setProperty('max-width', '100%', 'important');
      tr.style.setProperty('height', '48px', 'important');
      tr.style.setProperty('min-height', '48px', 'important');
      tr.style.setProperty('max-height', '48px', 'important');
      tr.style.setProperty('margin', '0', 'important');
      tr.style.setProperty('padding', '0', 'important');
      tr.style.setProperty('overflow', 'hidden', 'important');
      tr.style.setProperty('box-sizing', 'border-box', 'important');

      var cells = tr.children;
      for (var c = 0; c < cells.length; c++) {
        var td = cells[c];
        td.style.setProperty('width', 'auto', 'important');
        td.style.setProperty('min-width', '0', 'important');
        td.style.setProperty('height', '48px', 'important');
        td.style.setProperty('min-height', '48px', 'important');
        td.style.setProperty('max-height', '48px', 'important');
        td.style.setProperty('padding', '0 10px', 'important');
        td.style.setProperty('margin', '0', 'important');
        td.style.setProperty('display', 'flex', 'important');
        td.style.setProperty('align-items', 'center', 'important');
        td.style.setProperty('justify-content', c === 0 ? 'flex-start' : 'center', 'important');
        td.style.setProperty('overflow', 'hidden', 'important');
        td.style.setProperty('box-sizing', 'border-box', 'important');

        if (c === 1) {
          var elapsed = td.querySelector('.cbt-elapsed');
          if (elapsed) {
            elapsed.style.setProperty('display', 'inline-flex', 'important');
            elapsed.style.setProperty('align-items', 'center', 'important');
            elapsed.style.setProperty('justify-content', 'center', 'important');
            elapsed.style.setProperty('width', '58px', 'important');
            elapsed.style.setProperty('min-width', '58px', 'important');
            elapsed.style.setProperty('max-width', '58px', 'important');
            elapsed.style.setProperty('height', '22px', 'important');
            elapsed.style.setProperty('min-height', '22px', 'important');
            elapsed.style.setProperty('max-height', '22px', 'important');
            elapsed.style.setProperty('padding', '0', 'important');
            elapsed.style.setProperty('margin-left', 'auto', 'important');
            elapsed.style.setProperty('margin-right', 'auto', 'important');
            elapsed.style.setProperty('text-align', 'center', 'important');
            elapsed.style.setProperty('line-height', '22px', 'important');
            elapsed.style.setProperty('transform', 'none', 'important');
            elapsed.style.setProperty('box-sizing', 'border-box', 'important');
          }
        }
      }
    }
  }

  function renderLive() {
    var tbody=document.querySelector('#cbt-tbody'), empty=document.querySelector('#cbt-empty');
    if (!tbody||!empty) return;
    var lowerTerm = liveSearchTerm ? liveSearchTerm.toLowerCase() : '';
    // Compute each row's stats once — previously computeRow ran inside the sort
    // comparator (O(n log n) calls) and again in the render loop.
    var rows=[]; taskCache.forEach(function(d){
      if(cbtIsLiveBatch(d)) {
        if (lowerTerm) {
          var name = (d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'').toLowerCase();
          if (name.indexOf(lowerTerm) === -1) return;
        }
        rows.push({ d: d, r: computeRow(d) });
      }
    });
    /* While the user is explicitly sorting by Bags/min, the LOW-first
       grouping is suspended — otherwise LOW rows stayed pinned at the top in
       their own fixed order and clicking the column appeared to do nothing.
       Every other time, LOW batchers still float to the top as before. */
    var groupLowFirst = !(liveSortUser && liveSortKey === 'rate');
    rows.sort(function(A,B){
      var a=A.d, b=B.d, ra=A.r, rb=B.r;
      if (groupLowFirst) {
        var slowA = ra.scanRate && ra.scanRate < ALERT_RATE && (ra.elapsedSec||0) > 120;
        var slowB = rb.scanRate && rb.scanRate < ALERT_RATE && (rb.elapsedSec||0) > 120;
        if (slowA && !slowB) return -1;
        if (!slowA && slowB) return 1;
        if (slowA && slowB) return (ra.scanRate||0) - (rb.scanRate||0);
      }
      var va, vb;
      if(liveSortKey==='assoc'){va=(a.associateId||a.associate||'').toLowerCase();vb=(b.associateId||b.associate||'').toLowerCase();return liveSortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(liveSortKey==='rate'){
        /* rows with no rate yet always sink to the bottom, whichever
           direction is active, so they never disturb the ordering */
        var hasA = (ra.scanRate != null && !isNaN(ra.scanRate));
        var hasB = (rb.scanRate != null && !isNaN(rb.scanRate));
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) return 0;
        va = ra.scanRate; vb = rb.scanRate;      /* decimals compare fine */
      }
      else{va=ra.elapsedSec||0;vb=rb.elapsedSec||0;}
      return liveSortAsc?va-vb:vb-va;
    });
    updateLiveSortHeaders();
    if(rows.length===0){setHTML(tbody,'');empty.style.display='block';
      var body2=document.querySelector('#cbt-body');
      if(body2&&!body2.style.height){body2.style.height='350px';body2.style.maxHeight='350px';}
      return;}

    empty.style.display='none';
    var html='';
    for(var i=0;i<rows.length;i++){
      var data=rows[i].d,assoc=data.associateId||data.associate||data.driverAssignment||data.shortClientRef,shortRef=data.shortClientRef,r=rows[i].r;
      var elMin=r.elapsedSec!=null?r.elapsedSec/60:0;
      var elCls=r.elapsedSec!=null?(elMin>=ALERT_ELAPSED_MIN?'alert':elMin>=WARN_ELAPSED_MIN?'warn':''):'';
      var elTxt=r.elapsedSec!=null?fmt(r.elapsedSec):'--:--';
      var rateCls=r.scanRate!=null?(r.scanRate<ALERT_RATE?'alert':r.scanRate<WARN_RATE?'warn':''):'pending';
      var rateTxt=r.scanRate!=null?r.scanRate.toFixed(1):'\u2014';
      var rateTitle =
        r.rateSource==='api-full-span' ? 'Rate: packages batched / full BATCHING elapsed time' :
        r.rateSource==='observed-delta' ? 'Rate fallback: package increase observed by this dashboard' :
        r.rateSource==='invalid-api-span' ? 'Rate hidden: API timing/count combination produced an invalid spike' :
        'Rate pending until enough trusted timing/progress is available';
      var slowAlert=(r.scanRate!==null&&r.scanRate<ALERT_RATE&&r.elapsedSec>120)?'<span class="cbt-live-status-slot"><span class="cbt-slow-alert">⚠ SLOW</span></span>':'';
      html+='<tr><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc">'+assoc+'</span>'+slowAlert+'</span><span class="cbt-ref">'+shortRef+'</span></span></td>';
      html+='<td><span class="cbt-elapsed '+elCls+'" data-start="'+(r.startMs||'')+'" data-live="'+(r.inProgress?'1':'0')+'">'+elTxt+'</span></td>';
      html+='<td><span class="cbt-rate '+rateCls+'" title="'+rateTitle+'">'+rateTxt+'</span></td></tr>';
    }
    setHTML(tbody, html);
    lockLiveRowGeometry();
    requestUnifiedSearchCount();
  }

  function renderHistory() {
    var tbody=document.querySelector('#cbt-hist-tbody'),empty=document.querySelector('#cbt-hist-empty'),summary=document.querySelector('#cbt-hist-summary');
    if(!tbody||!empty) return;
    var history=getDisplayHistory(),entries=Object.values(history);
    if(entries.length===0){setHTML(tbody,'');empty.style.display='block';if(summary)summary.innerHTML='';
      if(historySearchTerm) renderHistoryCrossSearch(historySearchTerm);
      return;}
    empty.style.display='none';
    if(summary){
      var tA=entries.length,tS=entries.reduce(function(s,e){return s+e.totalSec;},0);
      var oR=tS>0?entries.reduce(function(s,e){return s+e.totalPkgs;},0)/(tS/60):0;
      var tMissing=entries.reduce(function(s,e){return s+(e.totalMissing||0);},0);
      var tExpected=entries.reduce(function(s,e){return s+(e.totalExpected||0);},0);
      var avgMissPct=tExpected>0?(tMissing/tExpected*100):0;
      summary.innerHTML='<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tA+'</span><span class="cbt-ws-label">Batchers</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+oR.toFixed(1)+'</span><span class="cbt-ws-label">Avg Rate</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+avgMissPct.toFixed(1)+'%</span><span class="cbt-ws-label">Avg Miss %</span></div>';
    }

    /* Sort the FULL Today list first and stamp each associate's real display
       position. Search is applied only after that, so searching one person can
       never renumber that person to #1 just because they are the only match. */
    var ranked=entries.slice();
    ranked.sort(function(a,b){
      var va,vb;
      if(historySortKey==='assoc'){va=a.assoc.toLowerCase();vb=b.assoc.toLowerCase();return historySortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(historySortKey==='runs'){va=a.runs;vb=b.runs;}
      else if(historySortKey==='pkgs'){va=a.totalPkgs;vb=b.totalPkgs;}
      else if(historySortKey==='lastRate'){va=Number(a.lastRate)||0;vb=Number(b.lastRate)||0;}
      else if(historySortKey==='bestRate'){va=Number(a.bestRate)||0;vb=Number(b.bestRate)||0;}
      else{va=Number(a.bestRate)||0;vb=Number(b.bestRate)||0;}
      return historySortAsc?va-vb:vb-va;
    });
    for(var ri=0;ri<ranked.length;ri++) ranked[ri]._displayRank=ri+1;

    var filtered=ranked;
    if(historySearchTerm){var term=historySearchTerm.toLowerCase();filtered=ranked.filter(function(e){return e.assoc.toLowerCase().indexOf(term)!==-1;});filtered=prioritizeNameMatches(filtered,term,function(e){return e.assoc;});}
    var html='';
    for(var i=0;i<filtered.length;i++){
      var e=filtered[i],bestRate=Number(e.bestRate)||0;
      var rateCls=bestRate>=WARN_RATE?'good':bestRate>=ALERT_RATE?'warn':'alert';
      var rk=e._displayRank||0;
      var rankCls=rk===1?'gold':rk===2?'silver':rk===3?'bronze':'';
      html+='<tr><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+rk+'</span>'+e.assoc+'</span></span></span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.runs+'</span></td><td><span class="cbt-hist-meta">'+e.totalPkgs+'</span></td>';
      html+='<td>'+(bestRate>0?'<span class="cbt-hist-rate '+rateCls+'">'+bestRate.toFixed(1)+'</span>':'<span class="cbt-hist-meta">—</span>')+'</td>';
      var latestRate=Number(e.lastRate), latestCls=latestRate>=WARN_RATE?'good':latestRate>=ALERT_RATE?'warn':'alert';
      html+='<td>'+(latestRate>0?'<span class="cbt-hist-rate '+latestCls+'">'+latestRate.toFixed(1)+'</span>':'<span class="cbt-hist-meta">—</span>')+'</td></tr>';
    }
    setHTML(tbody, html);

    if(historySearchTerm) renderHistoryCrossSearch(historySearchTerm);
    else {
      var cross = document.getElementById('cbt-hist-cross');
      if(cross) cross.innerHTML='';
    }
    requestUnifiedSearchCount();
  }

  function renderHistoryCrossSearch(term) {
    var crossEl = document.getElementById('cbt-hist-cross');
    if(!crossEl) return;
    if(!term){ crossEl.innerHTML=''; return; }
    term = term.toLowerCase();
    var weekly = sanitizeWeekly(getDisplayWeekly()), agg = {};
    for(var dk of Object.keys(weekly)){
      for(var a of Object.keys(weekly[dk])){
        if(a.toLowerCase().indexOf(term)===-1) continue;
        if(!agg[a]) agg[a]={assoc:a,totalPkgs:0,totalSec:0,runs:0,daysSet:new Set()};
        agg[a].totalPkgs+=weekly[dk][a].totalPkgs;
        agg[a].totalSec+=weekly[dk][a].totalSec;
        agg[a].runs+=weekly[dk][a].runs;
        agg[a].daysSet.add(dk);
      }
    }
    var entries = prioritizeNameMatches(Object.values(agg), term, function(e){ return e.assoc; });
    var shown = new Set();
    var todayHist = getDisplayHistory();
    Object.values(todayHist).forEach(function(e){ if(e.assoc.toLowerCase().indexOf(term)!==-1) shown.add(e.assoc.toLowerCase()); });
    var html='';
    if(entries.length>0){
      html+='<div class="cbt-search-result-section">WEEKLY</div>';
      entries.forEach(function(e){
        shown.add(e.assoc.toLowerCase());
        var avgRate=e.totalSec>0?e.totalPkgs/(e.totalSec/60):0;
        var rateCls=avgRate>=WARN_RATE?'good':avgRate>=ALERT_RATE?'warn':'alert';
        html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+e.assoc+'</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.daysSet.size+'</span> days | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>' +
        '<span class="cbt-search-row-rate"><span class="cbt-hist-rate '+rateCls+'">'+avgRate.toFixed(1)+'</span></span></div>';
      });
    }
    html += savedNamesSearchHTML(term, shown);
    setHTML(crossEl, html);
  }

  function sanitizeWeekly(w) {
    var clean = {};
    for (var dk in (w || {})) {
      /* Weekly is CURRENT WEEK ONLY: Sunday 12:00 AM through Saturday. */
      if (!cbtIsDateInCurrentWeek(dk)) continue;
      if (!w[dk] || typeof w[dk] !== 'object') continue;

      clean[dk] = {};
      for (var a in w[dk]) {
        var e = w[dk][a];
        if (!e || typeof e !== 'object') continue;
        if ((e.totalPkgs||0) > 50000 || (e.runs||0) > 300) continue;
        var sec = Number(e.totalSec) || 0;
        if (sec > 60 && (Number(e.totalPkgs)||0) / (sec / 60) > CBT_MAX_VALID_RATE) continue;

        var c = Object.assign({}, e);
        if (Number(c.bestRate) > CBT_MAX_VALID_RATE) c.bestRate = null;
        if (Number(c.lastRate) > CBT_MAX_VALID_RATE) {
          c.lastRate = null;
          c.lastAt = 0;
        }
        clean[dk][a] = c;
      }
      if (!Object.keys(clean[dk]).length) delete clean[dk];
    }
    return clean;
  }

  function renderWeekly() {
    var tbody=document.querySelector('#cbt-weekly-tbody'),empty=document.querySelector('#cbt-weekly-empty'),summary=document.querySelector('#cbt-weekly-summary');
    if(!tbody||!empty) return;
    var weekly=sanitizeWeekly(getDisplayWeekly()),agg={};
    for(var dayKey of Object.keys(weekly)){
      for(var assoc of Object.keys(weekly[dayKey])){
        var d3=weekly[dayKey][assoc];
        if(!agg[assoc])agg[assoc]={assoc:assoc,totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,daysSet:new Set(),bestRate:null,lastRate:null,lastAt:0};
        agg[assoc].totalPkgs+=d3.totalPkgs;agg[assoc].totalSec+=d3.totalSec;agg[assoc].runs+=d3.runs;
        agg[assoc].totalMissing+=(d3.totalMissing||0);agg[assoc].totalExpected+=(d3.totalExpected||0);agg[assoc].daysSet.add(dayKey);
        cbtMergeBestFields(agg[assoc], d3);
        cbtMergeLatestFields(agg[assoc], d3);
      }
    }
    var all=Object.values(agg).map(function(a){
      var pkgs = Math.min(a.totalPkgs, 100000);
      var sec  = Math.min(a.totalSec,  500*3600);
      var runs = Math.min(a.runs, 500);
      return{assoc:a.assoc,totalPkgs:pkgs,totalSec:sec,runs:runs,days:a.daysSet.size,avgRate:sec>0?pkgs/(sec/60):0,
        bestRate:Number(a.bestRate)>0?Number(a.bestRate):null,
        lastRate:Number(a.lastRate)>0?Number(a.lastRate):null,lastAt:Number(a.lastAt)||0,
        hrs:sec,missPct:a.totalExpected>0?(a.totalMissing/a.totalExpected*100):0};
    });
    if(all.length===0){setHTML(tbody,'');empty.style.display='block';if(summary)summary.innerHTML='';
      if(weeklySearchTerm) renderWeeklyCrossSearch(weeklySearchTerm);
      return;}
    empty.style.display='none';
    if(summary){
      var tA=all.length,tS=all.reduce(function(s,e){return s+e.totalSec;},0);
      var oR=tS>0?all.reduce(function(s,e){return s+e.totalPkgs;},0)/(tS/60):0;
      var tM=all.reduce(function(s,e){return s+e.missPct;},0)/tA;
      summary.innerHTML='<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tA+'</span><span class="cbt-ws-label">Batchers</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+oR.toFixed(1)+'</span><span class="cbt-ws-label">Avg Rate</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tM.toFixed(1)+'%</span><span class="cbt-ws-label">Avg Miss %</span></div>';
    }

    /* Same rule as Today: rank/position comes from the complete Weekly table,
       then search hides non-matches without changing anybody's true position. */
    var ranked=all.slice();
    ranked.sort(function(a,b){
      var va,vb;
      if(weeklySortKey==='assoc'){va=a.assoc.toLowerCase();vb=b.assoc.toLowerCase();return weeklySortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(weeklySortKey==='runs'){va=a.runs;vb=b.runs;}
      else if(weeklySortKey==='pkgs'){va=a.totalPkgs;vb=b.totalPkgs;}
      else if(weeklySortKey==='bestRate'){va=Number(a.bestRate)||0;vb=Number(b.bestRate)||0;}
      else if(weeklySortKey==='lastRate'){va=Number(a.lastRate)||0;vb=Number(b.lastRate)||0;}
      else if(weeklySortKey==='hrs'){va=a.hrs;vb=b.hrs;}else{va=Number(a.bestRate)||0;vb=Number(b.bestRate)||0;}
      return weeklySortAsc?va-vb:vb-va;
    });
    for(var ri=0;ri<ranked.length;ri++) ranked[ri]._displayRank=ri+1;

    var filtered=ranked;
    if(weeklySearchTerm){var term=weeklySearchTerm.toLowerCase();filtered=ranked.filter(function(e){return e.assoc.toLowerCase().indexOf(term)!==-1;});filtered=prioritizeNameMatches(filtered,term,function(e){return e.assoc;});}
    var html='';
    for(var i=0;i<filtered.length;i++){
      var e=filtered[i],bestRate=Number(e.bestRate)||0;
      var rateCls=bestRate>=WARN_RATE?'good':bestRate>=ALERT_RATE?'warn':'alert';
      var rk=e._displayRank||0;
      var rankCls=rk===1?'gold':rk===2?'silver':rk===3?'bronze':'';
      html+='<tr><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+rk+'</span>'+e.assoc+'</span></span></span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.runs+'</span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.totalPkgs+'</span></td>';
      html+='<td>'+(bestRate>0?'<span class="cbt-hist-rate '+rateCls+'">'+bestRate.toFixed(1)+'</span>':'<span class="cbt-hist-meta">—</span>')+'</td>';
      var latestRate=Number(e.lastRate), latestCls=latestRate>=WARN_RATE?'good':latestRate>=ALERT_RATE?'warn':'alert';
      html+='<td>'+(latestRate>0?'<span class="cbt-hist-rate '+latestCls+'">'+latestRate.toFixed(1)+'</span>':'<span class="cbt-hist-meta">—</span>')+'</td>';
      html+='<td><span class="cbt-hist-meta">'+fmtHours(e.totalSec)+'</span></td></tr>';
    }
    setHTML(tbody, html);

    if(weeklySearchTerm) renderWeeklyCrossSearch(weeklySearchTerm);
    else {
      var cross2 = document.getElementById('cbt-weekly-cross');
      if(cross2) cross2.innerHTML='';
    }
    requestUnifiedSearchCount();
  }

  function savedNamesSearchHTML(term, excludeSet) {
    term = (term||'').toLowerCase().trim();
    if (!term) return '';
    var all = loadAllNames();
    var matches = [];
    for (var k in all) {
      if (k.indexOf(term) !== -1 && (!excludeSet || !excludeSet.has(k))) matches.push(all[k]);
    }
    if (!matches.length) return '';
    matches.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });
    matches = prioritizeNameMatches(matches, term, function(n){ return n; });
    var html = '<div class="cbt-search-result-section">SAVED NAMES</div>';
    matches.slice(0, 50).forEach(function(n){
      html += '<div class="cbt-search-row"><span class="cbt-search-row-name cbt-name-cell">' + n + '</span>' +
        '<span class="cbt-search-row-mid"></span>' +
        '<span class="cbt-search-row-rate" style="color:#aaa;">—</span></div>';
    });
    if (matches.length > 50) html += '<div style="text-align:center;color:#888;padding:4px;font-size:11px;">+' + (matches.length-50) + ' more, refine search</div>';
    return html;
  }

  var _namesScanLast = 0;
  function renderNames() {
    var tbody = document.getElementById('cbt-names-tbody');
    if (!tbody) return;
    // Throttle the full localStorage scan — it parses every stored JSON blob,
    // which is wasteful on each search keystroke. Capture still happens via
    // API hooks and the 5s background interval.
    var _nowN = Date.now();
    if (_nowN - _namesScanLast > 5000) {
      _namesScanLast = _nowN;
      scanLocalStorageForNames();
      syncNamesFromAllTabs();
    }
    var all = loadAllNames();
    var totalCount = Object.keys(all).length;
    var names = Object.keys(all).map(function(k){ return all[k]; });
    names.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });

    var term = (namesSearchTerm||'').toLowerCase().trim();
    if (term) {
      names = names.filter(function(n){ return n.toLowerCase().indexOf(term) !== -1; });
      names = prioritizeNameMatches(names, term, function(n){ return n; });
    }

    var countEl = document.getElementById('cbt-names-count');
    if (countEl) {
      countEl.textContent = totalCount + ' names saved';
      // Respect dark mode
      var isDarkMode = document.getElementById('cbt-panel') && document.getElementById('cbt-panel').classList.contains('dark');
      countEl.style.color = isDarkMode ? '#8faac0' : '#5a7a96';
    }

    var emptyEl = document.getElementById('cbt-names-empty');
    if (!names.length) {
      setHTML(tbody, '');
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = term ? 'No names match "' + namesSearchTerm + '"' : 'No names saved yet'; }
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    names.forEach(function(n){
      html += '<tr><td style="text-align:left;"><span class="cbt-name-cell">' + n + '</span></td></tr>';
    });
    setHTML(tbody, html);
    requestUnifiedSearchCount();
  }

  function renderWeeklyCrossSearch(term) {
    var crossEl = document.getElementById('cbt-weekly-cross');
    if(!crossEl) return;
    if(!term){ crossEl.innerHTML=''; return; }
    term = term.toLowerCase();
    var history = loadHistory();
    var entries = Object.values(history).filter(function(e){ return e.assoc.toLowerCase().indexOf(term)!==-1; });
    entries = prioritizeNameMatches(entries, term, function(e){ return e.assoc; });
    var shown = new Set();
    pruneWeeklyOlderThan(WEEKLY_DAYS);        /* side effect kept as-is */
    /* This used to iterate pruneWeeklyOlderThan's return value, but that
       function returns nothing — Object.keys(undefined) threw and the
       cross-search below never rendered. Read the weekly data directly. */
    var weeklyData = sanitizeWeekly(getDisplayWeekly());
    for(var wdk of Object.keys(weeklyData)){
      for(var wa of Object.keys(weeklyData[wdk])){
        if(wa.toLowerCase().indexOf(term)!==-1) shown.add(wa.toLowerCase());
      }
    }
    var html='';
    if(entries.length>0){
      html+='<div class="cbt-search-result-section">TODAY</div>';
      entries.forEach(function(e){
        shown.add(e.assoc.toLowerCase());
        var rateCls=e.avgRate>=WARN_RATE?'good':e.avgRate>=ALERT_RATE?'warn':'alert';
        html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+e.assoc+'</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.runs+'</span> runs | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>' +
        '<span class="cbt-search-row-rate"><span class="cbt-hist-rate '+rateCls+'">'+e.avgRate.toFixed(1)+'</span></span></div>';
      });
    }
    html += savedNamesSearchHTML(term, shown);
    setHTML(crossEl, html);
  }

  function tickLive() {
    if (document.hidden || activeTab !== 'live') return;

    var tbody = document.getElementById('cbt-tbody');
    if (!tbody || !tbody.isConnected) return;

    var nowMs = cbtNowMs();
    tbody.querySelectorAll('.cbt-elapsed[data-live="1"]').forEach(function(el){
      var startMs = parseFloat(el.dataset.start);
      if (!startMs) return;

      var sec = Math.max(0, (nowMs - startMs) / 1000);
      var min = sec / 60;
      var nextClass = 'cbt-elapsed ' +
        (min >= ALERT_ELAPSED_MIN ? 'alert' : min >= WARN_ELAPSED_MIN ? 'warn' : '');
      var nextText = fmt(sec);

      if (el.className !== nextClass) el.className = nextClass;
      if (el.textContent !== nextText) el.textContent = nextText;
    });
  }


  /* ── Task Detail Panel ── */
  var _tpRef = null, _tpLiveTerm = '';

  function buildTaskPanel() {
    var p = document.createElement('div');
    p.id = 'cbt-tp';
    var isDark = localStorage.getItem('cbt_dark') !== '0';
    if (isDark) p.classList.add('dark');

    p.innerHTML =
      '<div id="cbt-tp-header">' +
        '<span id="cbt-tp-title">Search Associate</span>' +
        '<div id="cbt-tp-controls">' +
          '<span id="cbt-tp-font-dec" title="Smaller text">A−</span>' +
          '<span id="cbt-tp-font-inc" title="Larger text">A+</span>' +
          '<span id="cbt-tp-theme" title="Toggle Dark/Light" style="font-size:16px;cursor:pointer;">' + (isDark?'☀️':'🌙') + '</span>' +
          '<span id="cbt-tp-collapse" title="Roll up/down">🔼</span>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-tp-body">' +
        '<div style="padding:6px 8px;display:flex;align-items:center;gap:6px;">' +
          '<input id="cbt-tp-search-input" type="text" placeholder="Search any associate..."/>' +
          '<button id="cbt-tp-search-clear">✕</button>' +
        '</div>' +
        '<div id="cbt-tp-results"></div>' +
      '</div>';

    return p;
  }

  function tpRenderSearch(term) {
    var el = document.getElementById('cbt-tp-results'); if (!el) return;
    if (!term || !term.trim()) { el.innerHTML = ''; return; }
    term = term.toLowerCase().trim();
    var html = '';
    var seen = new Set();

    taskCache.forEach(function(d){
      if (cbtIsLiveBatch(d)) {
        var name = (d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'').toLowerCase();
        if (name.indexOf(term) !== -1 && !seen.has(name)) {
          seen.add(name);
          var r = computeRow(d);
          var displayName = d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'—';
          var rc = !r.scanRate?'color:#aaa':r.scanRate>=WARN_RATE?'color:#2a9d2a':r.scanRate>=ALERT_RATE?'color:#e6a817':'color:#cc0000';
          html += '<div class="cbt-tp-row"><span class="cbt-tp-row-name">' + displayName + '</span><span class="cbt-tp-row-mid"></span><span class="cbt-tp-row-rate" style="' + rc + ';">' + (r.scanRate?r.scanRate.toFixed(1):'—') + '</span></div>';
        }
      }
    });

    var hist = loadHistory();
    Object.values(hist).forEach(function(e){
      if (e.assoc.toLowerCase().indexOf(term) !== -1 && !seen.has(e.assoc.toLowerCase())) {
        seen.add(e.assoc.toLowerCase());
        var rc = e.avgRate>=WARN_RATE?'color:#2a9d2a':e.avgRate>=ALERT_RATE?'color:#e6a817':'color:#cc0000';
        html += '<div class="cbt-tp-row"><span class="cbt-tp-row-name">' + e.assoc + '</span><span class="cbt-tp-row-mid"></span><span class="cbt-tp-row-rate" style="' + rc + ';">' + e.avgRate.toFixed(1) + '</span></div>';
      }
    });

    var weekly = sanitizeWeekly(getDisplayWeekly()), agg = {};
    for (var dk of Object.keys(weekly)) {
      for (var a of Object.keys(weekly[dk])) {
        if (a.toLowerCase().indexOf(term) === -1) continue;
        if (!agg[a]) agg[a] = {assoc:a,totalPkgs:0,totalSec:0};
        agg[a].totalPkgs+=weekly[dk][a].totalPkgs; agg[a].totalSec+=weekly[dk][a].totalSec;
      }
    }
    Object.values(agg).forEach(function(e){
      if (!seen.has(e.assoc.toLowerCase())) {
        seen.add(e.assoc.toLowerCase());
        var avg = e.totalPkgs/(e.totalSec/60);
        var rc = avg>=WARN_RATE?'color:#2a9d2a':avg>=ALERT_RATE?'color:#e6a817':'color:#cc0000';
        html += '<div class="cbt-tp-row"><span class="cbt-tp-row-name">' + e.assoc + '</span><span class="cbt-tp-row-mid"></span><span class="cbt-tp-row-rate" style="' + rc + ';">' + avg.toFixed(1) + '</span></div>';
      }
    });

    // Saved names — anyone captured from localStorage/sync who isn't already shown above
    var savedHtml = savedNamesSearchHTML(term, seen);
    if (savedHtml) html += savedHtml;

    if (!html) html = '<div style="text-align:center;color:#aaa;padding:10px;font-size:13px;font-style:italic;">No results for "' + term + '"</div>';
    setHTML(el, html);
  }

  /* ── Search Associate panel: drag to move, position remembered ── */
  var TP_POS_KEY = 'cbt_tp_pos';

  function loadTpPos() {
    var raw = gmGet(TP_POS_KEY, null);
    if (raw == null) { try { raw = localStorage.getItem(TP_POS_KEY); } catch(e) {} }
    if (!raw) return null;
    try {
      var p = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      if (p && typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch(e) {}
    return null;
  }
  function saveTpPos(left, top) {
    var json = JSON.stringify({ left: left, top: top });
    gmSet(TP_POS_KEY, json);
    try { localStorage.setItem(TP_POS_KEY, json); } catch(e) {}
  }
  /* Keep the panel reachable rather than boxed in: it may hang off any edge
     as long as a grabbable strip of the header stays on screen, so you can
     park it literally anywhere and still drag it back. */
  function clampTpPos(tp, left, top) {
    var w = tp.offsetWidth  || 420;
    var h = tp.offsetHeight || 300;
    var KEEP = 90;                                  /* visible strip, px */
    var minLeft = -(w - KEEP);
    var maxLeft = window.innerWidth - KEEP;
    var minTop  = 0;                                /* header never above the top */
    var maxTop  = Math.max(0, window.innerHeight - 44);
    return {
      left: Math.min(Math.max(minLeft, left), maxLeft),
      top:  Math.min(Math.max(minTop,  top),  maxTop)
    };
  }
  /* The panel's own CSS declares `top: 90px !important; right: 12px !important`.
     A plain inline style loses to !important, which pinned the panel
     vertically at 90px — horizontal drags worked, vertical ones did nothing.
     Setting the position with matching priority frees it to go anywhere. */
  function tpSetPos(tp, left, top) {
    tp.style.setProperty('left',   left + 'px', 'important');
    tp.style.setProperty('top',    top  + 'px', 'important');
    tp.style.setProperty('right',  'auto',      'important');
    tp.style.setProperty('bottom', 'auto',      'important');
  }
  /* Read the position from the box itself, not from inline styles. */
  function tpCurrentPos(tp) {
    var r = tp.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }

  function applyTpPos(tp) {
    var p = loadTpPos();
    if (!p) return;                 /* never moved — keep the default corner */
    var c = clampTpPos(tp, p.left, p.top);
    tpSetPos(tp, c.left, c.top);
  }
  function tpAttachDrag(tp) {
    var header = tp.querySelector('#cbt-tp-header');
    if (!header) return;
    var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

    header.addEventListener('mousedown', function(e){
      /* the +/-, theme and roll buttons must stay clickable */
      if (e.target.closest('#cbt-tp-controls')) return;
      if (e.button !== 0) return;
      var r = tp.getBoundingClientRect();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = r.left;  startTop = r.top;
      /* pin to left/top so dragging works regardless of the right-anchored default */
      tpSetPos(tp, r.left, r.top);
      tp.classList.add('cbt-tp-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e){
      if (!dragging) return;
      var c = clampTpPos(tp, startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
      tpSetPos(tp, c.left, c.top);
    });

    document.addEventListener('mouseup', function(){
      if (!dragging) return;
      dragging = false;
      tp.classList.remove('cbt-tp-dragging');
      var p = tpCurrentPos(tp);
      saveTpPos(p.left, p.top);
    });

    /* if the window shrinks, pull the panel back into view */
    window.addEventListener('resize', function(){
      if (!tp.isConnected || !loadTpPos()) return;
      var p = tpCurrentPos(tp);
      var c = clampTpPos(tp, p.left, p.top);
      tpSetPos(tp, c.left, c.top);
      saveTpPos(c.left, c.top);
    });
  }

  /* ── Roll the Search Associate panel up/down; state is remembered ── */
  var TP_ROLLED_KEY = 'cbt_tp_rolled';
  function loadTpRolled() {
    var raw = gmGet(TP_ROLLED_KEY, null);
    if (raw == null) { try { raw = localStorage.getItem(TP_ROLLED_KEY); } catch(e) {} }
    return raw === '1' || raw === true;
  }
  function saveTpRolled(rolled) {
    var v = rolled ? '1' : '0';
    gmSet(TP_ROLLED_KEY, v);
    try { localStorage.setItem(TP_ROLLED_KEY, v); } catch(e) {}
  }
  function applyTpRolled(tp, rolled) {
    if (rolled) tp.classList.add('cbt-tp-rolled');
    else tp.classList.remove('cbt-tp-rolled');
    var btn = tp.querySelector('#cbt-tp-collapse');
    if (btn) btn.textContent = rolled ? '🔽' : '🔼';
  }

  function tpAttachEvents(tp) {
    /* ── roll up / down ── */
    var _tpRolled = loadTpRolled();
    applyTpRolled(tp, _tpRolled);
    var rollBtn = tp.querySelector('#cbt-tp-collapse');
    if (rollBtn) rollBtn.addEventListener('click', function(){
      _tpRolled = !_tpRolled;
      applyTpRolled(tp, _tpRolled);
      saveTpRolled(_tpRolled);
      /* rolled up the panel is short — make sure it is still on screen */
      if (loadTpPos()) {
        var p = tpCurrentPos(tp);
        var c = clampTpPos(tp, p.left, p.top);
        tpSetPos(tp, c.left, c.top);
      }
    });

    // ── theme toggle ──
    var themeBtn = tp.querySelector('#cbt-tp-theme');
    if (themeBtn) themeBtn.addEventListener('click', function(){
      var isDark = tp.classList.toggle('dark');
      localStorage.setItem('cbt_dark', isDark ? '1' : '0');
      themeBtn.textContent = isDark ? '☀️' : '🌙';
    });

    // ── font size +/- ──
    var _tpFontScale = loadTpFontScale();
    applyTpFontScale(tp, _tpFontScale);

    var fontIncBtn = tp.querySelector('#cbt-tp-font-inc');
    var fontDecBtn = tp.querySelector('#cbt-tp-font-dec');
    if (fontIncBtn) fontIncBtn.addEventListener('click', function() {
      _tpFontScale = Math.min(2.0, Math.round((_tpFontScale + 0.1) * 10) / 10);
      saveTpFontScale(_tpFontScale);
      applyTpFontScale(tp, _tpFontScale);
    });
    if (fontDecBtn) fontDecBtn.addEventListener('click', function() {
      _tpFontScale = Math.max(0.7, Math.round((_tpFontScale - 0.1) * 10) / 10);
      saveTpFontScale(_tpFontScale);
      applyTpFontScale(tp, _tpFontScale);
    });

    // ── search input ──
    tp.addEventListener('input', function(e){
      if (e.target.id === 'cbt-tp-search-input') {
        _tpLiveTerm = e.target.value;
        tpRenderSearch(_tpLiveTerm);
      }
    });

    // ── clear + click-to-copy ──
    tp.addEventListener('click', function(e){
      if (e.target.id === 'cbt-tp-search-clear') {
        var i = tp.querySelector('#cbt-tp-search-input');
        if (i) { i.value = ''; _tpLiveTerm = ''; tpRenderSearch(''); }
      }
      var nameEl = e.target.closest('.cbt-tp-row-name');
      if (nameEl && tp.contains(nameEl)) {
        var oldTag4 = nameEl.querySelector('.cbt-copied-tag');
        if (oldTag4) oldTag4.remove();
        var text = nameEl.textContent.trim();
        copyWithFeedback(nameEl, text, e);
      }
    });
  }

  function injectTaskPanel() {
    var existingTp = document.getElementById('cbt-tp');
    if (existingTp && existingTp.isConnected) return;
    if (!shouldShowSearchPanel()) return;

    /* COMO's cart page clips fixed-position children, so ancestors get
       overflow:visible. The Outbound site needs none of that. */
    if (document.querySelector('div.job-details')) {
      var mainContent = document.querySelector('div.container.main-content') || document.querySelector('.container.main-content');
      if (mainContent) mainContent.style.overflow = 'visible';
      var body = document.querySelector('body');
      if (body) body.style.overflow = 'visible';
      var ngScope = document.querySelector('.ng-scope');
      if (ngScope) ngScope.style.overflow = 'visible';
      var el = document.querySelector('div.job-details');
      while (el && el !== document.body) {
        var s = window.getComputedStyle(el).overflow;
        if (s === 'hidden' || s === 'auto' || s === 'scroll') el.style.overflow = 'visible';
        el = el.parentElement;
      }
    }

    _tpRef = buildTaskPanel();
    document.body.appendChild(_tpRef);
    applyTpPos(_tpRef);
    tpAttachDrag(_tpRef);
    tpAttachEvents(_tpRef);
  }

  /* Exactly one panel per page type:
       cart/task detail page -> Associate Search only
       dashboard view        -> Batcher Timers only                */
  var _panelMutationRun = coalesced(function() {
    try { ensureSortAttachment(); } catch(e0) {}
    if (shouldShowSearchPanel()) {
      /* cart/task detail, or any Outbound page -> Associate Search only */
      detachMainPanel();
      var tp = document.getElementById('cbt-tp');
      if (!tp || !tp.isConnected) injectTaskPanel();
      return;
    }
    /* nowhere the search panel belongs -> make sure it is gone */
    var tpOff = document.getElementById('cbt-tp');
    if (tpOff) { tpOff.remove(); _tpRef = null; }

    if (!isDashboardView()) { detachMainPanel(); return; }  /* Packages/Orders/etc */

    var mp = document.getElementById('cbt-panel');
    if (!mp || !mp.isConnected) injectPanel();
  }, 50);

  var panelWatcher = new MutationObserver(function(mutations) {
    /* Our own Live clock, stats, QR, autocomplete, Time Left and modal updates
       must not cause a whole-page health/mount pass. */
    for (var i = 0; i < mutations.length; i++) {
      if (!cbtMutationIsOnlyOwnUi(mutations[i])) {
        _panelMutationRun();
        return;
      }
    }
  });

  /* ══════════════════════════════════════
     QR CODE FROM SELECTED TEXT
     Highlight any text on the page and a centered QR popup appears
     encoding it. The text field below the code is editable and the
     QR redraws live as you type. Click outside the card (or press
     Esc, or the ✕) to close. The encoder library is embedded, so QR
     generation is instant, offline, and needs no external requests.
     qrcode-generator (MIT, Kazuhiko Arase) embedded below.
  ══════════════════════════════════════ */
  var qrcode = (function(){
    var module = { exports: {} }, exports = module.exports, define;
    var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1})},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(o*r,n*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});
    return module.exports;
  })();

  var _qrOverlay = null;
  var _qrSuppressNextMouseup = false;
  var _qrRenderRAF = 0;
  var _qrLastOpenedText = '';
  var _qrOutsideHandler = null;
  var _qrSelectionTimer = 0;
  var _qrAutoCloseTimer = 0;
  var _qrDragCleanup = null;
  var QR_POSITION_KEY = 'cbt_qr_snap_position_v23953';
  var QR_DEFAULT_POSITION = 'bottom-right';
  var QR_ALLOWED_POSITIONS = {
    'bottom-left': 1,
    'bottom-center': 1,
    'bottom-right': 1
  };

  /* Every surface this script draws. Text inside these is not selectable and
     never becomes a QR code — the feature is for the page's own content. */
  var QR_UI_IDS = ['cbt-panel', 'cbt-tp', 'cbt-qr-overlay', 'cbt-afa-overlay', 'cbt-ac-drop'];

  function qrNormalizePosition(pos) {
    pos = String(pos || '');
    if (pos === 'middle-left') return 'bottom-left';
    if (pos === 'middle-center') return 'bottom-center';
    if (pos === 'middle-right') return 'bottom-right';
    return QR_ALLOWED_POSITIONS[pos] ? pos : QR_DEFAULT_POSITION;
  }

  function qrLoadPosition() {
    try {
      var saved = qrNormalizePosition(localStorage.getItem(QR_POSITION_KEY) || '');
      return saved;
    } catch(e) {}
    return QR_DEFAULT_POSITION;
  }

  function qrSavePosition(pos) {
    pos = qrNormalizePosition(pos);
    try { localStorage.setItem(QR_POSITION_KEY, pos); } catch(e) {}
    return pos;
  }

  function qrApplyPosition(pos) {
    if (!_qrOverlay) return;
    pos = qrNormalizePosition(pos);
    _qrOverlay.setAttribute('data-qr-pos', pos);
    qrRefreshArrowState();
  }

  function qrRefreshArrowState() {
    if (!_qrOverlay) return;

    var leftBtn = _qrOverlay.querySelector('#cbt-qr-left');
    var rightBtn = _qrOverlay.querySelector('#cbt-qr-right');
    if (!leftBtn || !rightBtn) return;

    var pos = _qrOverlay.getAttribute('data-qr-pos') || qrLoadPosition();
    var col = String(pos).split('-').pop();

    leftBtn.disabled = col === 'left';
    rightBtn.disabled = col === 'right';

    leftBtn.title = 'Move QR left';
    rightBtn.title = 'Move QR right';
  }

  function qrMoveHorizontal(direction) {
    if (!_qrOverlay) return;

    direction = direction < 0 ? -1 : 1;

    var current = _qrOverlay.getAttribute('data-qr-pos') || qrLoadPosition();
    var parts = String(current).split('-');
    var row = 'bottom';
    var cols = ['left', 'center', 'right'];
    var idx = cols.indexOf(parts[1]);
    if (idx < 0) idx = 2;

    var nextIdx = Math.max(0, Math.min(2, idx + direction));
    if (nextIdx === idx) {
      qrRefreshArrowState();
      return;
    }

    var nextPos = qrSavePosition(row + '-' + cols[nextIdx]);
    qrApplyPosition(nextPos);

    /* Moving the QR by arrow gives a fresh full 60 seconds. */
    qrStartAutoClose();

  }

  /* Snap a dragged QR card only along the bottom row:
     bottom-left / bottom-center / bottom-right. */
  function qrSnapPositionFromPoint(clientX, clientY) {
    var vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);

    var col = clientX < vw / 3
      ? 'left'
      : clientX > (vw * 2 / 3)
        ? 'right'
        : 'center';

    /* Dragging upward never moves the QR upward. It always stays on bottom. */
    return 'bottom-' + col;
  }

  function qrStartAutoClose() {
    if (_qrAutoCloseTimer) clearTimeout(_qrAutoCloseTimer);
    _qrAutoCloseTimer = setTimeout(function(){
      _qrAutoCloseTimer = 0;
      if (_qrOverlay && _qrOverlay.isConnected) qrClose();
    }, 60000);
  }

  function qrEnableSnapDrag(card) {
    if (!card) return;
    var head = card.querySelector('#cbt-qr-head');
    if (!head) return;

    var dragging = false;
    var pointerId = null;
    var lastX = 0;
    var lastY = 0;

    function onMove(e) {
      if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
      lastX = e.clientX;
      lastY = e.clientY;
      try { e.preventDefault(); } catch(ignore) {}
    }

    function finish(e) {
      if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
      dragging = false;

      if (isFinite(e.clientX)) lastX = e.clientX;
      if (isFinite(e.clientY)) lastY = e.clientY;

      var pos = qrSavePosition(qrSnapPositionFromPoint(lastX, lastY));
      qrApplyPosition(pos);

      /* A manual drag counts as activity: restart the full 60-second timer
         from the moment the QR is dropped into its new snap position. */
      qrStartAutoClose();

      try {
        if (pointerId !== null && head.releasePointerCapture) {
          head.releasePointerCapture(pointerId);
        }
      } catch(ignore) {}
      pointerId = null;
      try { e.preventDefault(); } catch(ignore2) {}
    }

    function onDown(e) {
      /* Header controls keep their own click behavior and never start drag. */
      if (e.target && e.target.closest &&
          e.target.closest('#cbt-qr-left,#cbt-qr-right')) return;

      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;

      try {
        if (head.setPointerCapture) head.setPointerCapture(pointerId);
      } catch(ignore) {}
      try { e.preventDefault(); } catch(ignore2) {}
    }

    head.addEventListener('pointerdown', onDown);
    head.addEventListener('pointermove', onMove);
    head.addEventListener('pointerup', finish);
    head.addEventListener('pointercancel', finish);

    _qrDragCleanup = function(){
      try { head.removeEventListener('pointerdown', onDown); } catch(e0) {}
      try { head.removeEventListener('pointermove', onMove); } catch(e1) {}
      try { head.removeEventListener('pointerup', finish); } catch(e2) {}
      try { head.removeEventListener('pointercancel', finish); } catch(e3) {}
      dragging = false;
      pointerId = null;
    };
  }

  /* Walks up through shadow roots as well as normal parents. */
  function qrInScriptUI(node) {
    var n = node, guard = 0;
    while (n && guard++ < 200) {
      if (n.nodeType === 1 && n.id && QR_UI_IDS.indexOf(n.id) !== -1) return true;
      if (n.nodeType === 11 && n.host) { n = n.host; continue; }   /* shadow root */
      n = n.parentNode;
    }
    return false;
  }

  function qrRender(text) {
    var host = document.getElementById('cbt-qr-svg');
    var err = document.getElementById('cbt-qr-err');
    if (!host) return;

    text = String(text || '');
    if (!text.trim()) {
      host.innerHTML = '';
      if (err) err.style.display = 'none';
      return;
    }

    try {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();

      var n = qr.getModuleCount();
      var quiet = 4;
      var size = n + quiet * 2;
      var path = '';

      /* One SVG path is substantially cheaper than hundreds of DOM nodes and
         does not depend on Canvas APIs, which some browser privacy extensions
         can restrict. */
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (!qr.isDark(r, c)) continue;
          var x = c + quiet;
          var y = r + quiet;
          path += 'M' + x + ' ' + y + 'h1v1h-1z';
        }
      }

      host.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
             'viewBox="0 0 ' + size + ' ' + size + '" ' +
             'preserveAspectRatio="xMidYMid meet" ' +
             'role="img" aria-label="Generated QR code">' +
          '<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
          '<path d="' + path + '" fill="#000000"/>' +
        '</svg>';

      if (err) {
        err.textContent = '';
        err.style.display = 'none';
      }
    } catch(e) {
      host.innerHTML = '';
      if (err) {
        err.textContent = 'Could not generate QR code';
        err.style.display = 'block';
      }
      try { console.warn('[CBT QR] QR generation failed:', e); } catch(ignore) {}
    }
  }

  function qrScheduleRender(text) {
    if (_qrRenderRAF) {
      try { cancelAnimationFrame(_qrRenderRAF); } catch(e) {}
    }
    var raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : function(cb){ return setTimeout(cb, 16); };

    _qrRenderRAF = raf(function(){
      _qrRenderRAF = 0;
      qrRender(text);
    });
  }

  function qrTeardown() {
    if (_qrAutoCloseTimer) {
      clearTimeout(_qrAutoCloseTimer);
      _qrAutoCloseTimer = 0;
    }
    if (_qrDragCleanup) {
      try { _qrDragCleanup(); } catch(eDrag) {}
      _qrDragCleanup = null;
    }
    if (_qrSelectionTimer) {
      clearTimeout(_qrSelectionTimer);
      _qrSelectionTimer = 0;
    }
    if (_qrRenderRAF) {
      try { cancelAnimationFrame(_qrRenderRAF); } catch(e0) {}
      _qrRenderRAF = 0;
    }
    if (_qrOutsideHandler) {
      try { document.removeEventListener('mousedown', _qrOutsideHandler, true); } catch(e1) {}
      _qrOutsideHandler = null;
    }
    if (_qrOverlay && _qrOverlay.parentNode) _qrOverlay.parentNode.removeChild(_qrOverlay);
    _qrOverlay = null;
    _qrLastOpenedText = '';
  }

  function qrClose() {
    qrTeardown();
    /* The page text stays highlighted behind the popup. Left alone, a later
       mouseup would read that same selection and reopen the popup on its
       own. Dropping the selection means closed stays closed until a NEW
       highlight is made. */
    try {
      var s = window.getSelection();
      if (s && s.removeAllRanges) s.removeAllRanges();
    } catch(e) {}
  }

  function qrOpen(text) {
    text = String(text || '').trim();
    if (!text) return;

    /* Same text + already open = no DOM rebuild and no QR re-encode. */
    if (_qrOverlay && _qrOverlay.isConnected && _qrLastOpenedText === text) return;

    qrTeardown();
    _qrLastOpenedText = text;

    _qrOverlay = document.createElement('div');
    _qrOverlay.id = 'cbt-qr-overlay';
    _qrOverlay.innerHTML =
      '<div id="cbt-qr-card" role="dialog" aria-label="QR Code">' +
        '<div id="cbt-qr-head">' +
          '<span id="cbt-qr-head-left">' +
            '<button id="cbt-qr-left" type="button" title="Move QR left" aria-label="Move QR left">←</button>' +
          '</span>' +
          '<span id="cbt-qr-title">QR Code</span>' +
          '<span id="cbt-qr-head-right">' +
            '<button id="cbt-qr-right" type="button" title="Move QR right" aria-label="Move QR right">→</button>' +
          '</span>' +
        '</div>' +
        '<div id="cbt-qr-canvas-wrap"><div id="cbt-qr-svg" aria-live="polite"></div></div>' +
        '<div id="cbt-qr-err"></div>' +
        '<input id="cbt-qr-input" type="text" spellcheck="false" autocomplete="off" aria-label="QR value" placeholder="Text to encode..."/>' +
      '</div>';

    document.body.appendChild(_qrOverlay);

    /* Position survives close/reopen and every new text highlight. */
    qrApplyPosition(qrLoadPosition());

    var card = _qrOverlay.querySelector('#cbt-qr-card');
    var input = _qrOverlay.querySelector('#cbt-qr-input');
    input.value = text;

    var qrLeftBtn = _qrOverlay.querySelector('#cbt-qr-left');
    var qrRightBtn = _qrOverlay.querySelector('#cbt-qr-right');

    if (qrLeftBtn) {
      qrLeftBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        qrMoveHorizontal(-1);
      });
    }
    if (qrRightBtn) {
      qrRightBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        qrMoveHorizontal(1);
      });
    }

    qrRefreshArrowState();
    qrEnableSnapDrag(card);

    /* Re-render at most once per animation frame while editing. */
    input.addEventListener('input', function(){
      qrScheduleRender(input.value);
    });

    /* The page stays completely clear/clickable. A temporary document listener
       exists ONLY while the small QR card is open and only checks one contains()
       call. Clicking elsewhere closes the card without blocking COMO. */
    _qrOutsideHandler = function(e) {
      if (!_qrOverlay || !card || card.contains(e.target)) return;

      /* Do not destroy the QR at the start of a possible new text highlight.
         The selection handler can replace its contents afterward while the
         saved snap position stays unchanged. Normal outside clicks still
         close after a very short selection check. */
      setTimeout(function(){
        if (!_qrOverlay || !card || !card.isConnected) return;
        var selected = '';
        try {
          var s = window.getSelection();
          selected = s && !s.isCollapsed ? qrCleanSelectedText(s.toString()) : '';
        } catch(ignore) {}

        if (!selected) qrClose();
      }, 80);
    };
    document.addEventListener('mousedown', _qrOutsideHandler, true);

    qrRender(text);
    qrStartAutoClose();
  }

  function qrCleanSelectedText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function qrControlSelection(target) {
    if (!target || target.nodeType !== 1) return '';
    if (qrInScriptUI(target)) return '';

    var tag = String(target.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') return '';

    try {
      var start = Number(target.selectionStart);
      var end = Number(target.selectionEnd);
      if (!isFinite(start) || !isFinite(end) || end <= start) return '';
      return qrCleanSelectedText(String(target.value || '').slice(start, end));
    } catch(e) {
      return '';
    }
  }

  function qrSelectionFromObject(sel) {
    if (!sel || sel.isCollapsed || !sel.rangeCount) return '';

    var text = qrCleanSelectedText(sel.toString());
    if (!text) return '';

    try {
      if (qrInScriptUI(sel.anchorNode) || qrInScriptUI(sel.focusNode)) return '';
      var common = sel.getRangeAt(0).commonAncestorContainer;
      if (qrInScriptUI(common)) return '';
    } catch(e) {}

    return text;
  }

  function qrSelectionText(event) {
    /* Inputs/textareas have their own selectionStart/selectionEnd API and do
       not always appear in window.getSelection(). */
    var direct = qrControlSelection(event && event.target);
    if (direct) return direct;

    var candidates = [];

    function addSelection(sel) {
      if (!sel) return;
      if (candidates.indexOf(sel) === -1) candidates.push(sel);
    }

    try { addSelection(window.getSelection()); } catch(e0) {}
    try { addSelection(document.getSelection()); } catch(e1) {}

    /* COMO uses KAT/web components. If the highlight lives in an open shadow
       root, use that root's selection API when the browser exposes it. */
    try {
      var path = event && typeof event.composedPath === 'function'
        ? event.composedPath()
        : [];

      for (var i = 0; i < path.length; i++) {
        var node = path[i];
        if (!node) continue;

        var root = null;
        try {
          if (node.nodeType === 11) root = node;
          else if (node.getRootNode) root = node.getRootNode();
        } catch(e2) {}

        if (root && typeof root.getSelection === 'function') {
          try { addSelection(root.getSelection()); } catch(e3) {}
        }
      }
    } catch(e4) {}

    var best = '';
    for (var j = 0; j < candidates.length; j++) {
      var value = qrSelectionFromObject(candidates[j]);
      if (value && value.length > best.length) best = value;
    }
    return best;
  }

  function qrOpenCurrentSelection(event) {
    if (_qrSuppressNextMouseup) {
      _qrSuppressNextMouseup = false;
      return;
    }

    var selected = qrSelectionText(event);
    if (!selected) return;
    qrOpen(selected);
  }

  function qrQueueSelectionOpen(event) {
    if (event && qrInScriptUI(event.target)) return;

    if (_qrSelectionTimer) {
      clearTimeout(_qrSelectionTimer);
      _qrSelectionTimer = 0;
    }

    /* Capture the useful event fields before the browser/event object is
       recycled. composedPath() is captured now for shadow-root support. */
    var snapshot = {
      target: event ? event.target : null,
      path: []
    };
    try {
      if (event && typeof event.composedPath === 'function') {
        snapshot.path = event.composedPath();
      }
    } catch(e) {}

    snapshot.composedPath = function(){ return snapshot.path || []; };

    /* Selection finalization happens after pointer/mouse up. One zero-delay
       task is enough; no repeated checking is needed. */
    _qrSelectionTimer = setTimeout(function(){
      _qrSelectionTimer = 0;
      qrOpenCurrentSelection(snapshot);
    }, 0);
  }

  /* Restored QR feature. Capture phase is intentional: some COMO/KAT
     components stop mouse/pointer events before they bubble to document.
     Capture lets the QR feature see the completed selection without adding
     any observer, interval, polling, or network request. */
  if (typeof PointerEvent !== 'undefined') {
    document.addEventListener('pointerup', qrQueueSelectionOpen, true);
  } else {
    document.addEventListener('mouseup', qrQueueSelectionOpen, true);
  }

  /* Keyboard text selection remains supported. */
  document.addEventListener('keyup', function(e) {
    if (!e || !e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' && e.key !== 'ArrowDown' &&
        e.key !== 'Home' && e.key !== 'End') return;
    qrQueueSelectionOpen(e);
  }, true);

  document.addEventListener('keydown', function(e) {
    if (e && e.key === 'Escape' && _qrOverlay) qrClose();
  }, true);

  /* ══════════════════════════════════════
     AUTO FORCE ASSIGN

     Does exactly what doing it by hand does, just without opening each
     cart: POST /api/store/{storeId}/job/{jobId}/forceAssignable with
     {"ignoreProblemSolve": false}, on the page's own logged-in session.
     No auth, permission or CSRF handling is touched — the browser attaches
     the same session it uses for every other click, and nothing is
     requested that the account cannot already do by hand.

     Carts are read off the dashboard you are looking at: only rows whose
     status reads UNASSIGNABLE are eligible. Full job IDs come from the
     row's own link, falling back to the dashboard API responses the
     script already sees. One cart at a time, re-checked immediately
     before each request, never the same cart twice.
  ══════════════════════════════════════ */
  var AFA_DELAY_MS   = 900;    /* pause between carts */
  var AFA_TIMEOUT_MS = 15000;  /* give up on a single request after this */
  var _afaJobIndex = Object.create(null);  /* shortRef -> full job id */
  var _afaJobInfo  = Object.create(null);  /* job id -> { assignability, ref } */
  /* Duplicate prevention is scoped to ONE run: it is emptied when a run
     starts and again when it ends. A cart that failed, or that the request
     did not shift out of Partially Batched, therefore stays eligible for
     the next press of Force Assign instead of being locked out for the
     rest of the session. */
  var _afaDone     = Object.create(null);  /* job id -> claimed during THIS run */
  var _afaRunning  = false, _afaStop = false, _afaOverlay = null;

  /* Missing QR availability is verified only when ▶ Run opens.
     The button remains disabled unless a real MISSING package is confirmed. */
  var _afaMissingMenuInfo = null;
  var _afaMissingMenuCheckSeq = 0;

  /* Job ids look like {storeId}_CHECKIN_SERVICE_PUP-C-{uuid} */
  function afaLooksLikeJobId(v) {
    if (typeof v !== 'string' || v.length < 30 || v.indexOf('_') === -1) return false;
    return STORE_ID ? v.indexOf(STORE_ID) === 0 : true;
  }

  /* Harvest shortRef -> full id from whatever JSON the dashboard fetches,
     so a row's short id can be resolved even if its link carries no href. */
  function afaRecordJobs(obj, depth) {
    if (obj == null || depth > 6) return;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && i < 5000; i++) afaRecordJobs(obj[i], depth + 1);
      return;
    }
    if (typeof obj !== 'object') return;
    var ref = obj.shortClientRef;
    if (typeof ref === 'string' && ref) {
      var id = null, named = ['id','jobId','jobID','taskId'];
      for (var n = 0; n < named.length; n++) { if (afaLooksLikeJobId(obj[named[n]])) { id = obj[named[n]]; break; } }
      if (!id) { for (var k in obj) { if (afaLooksLikeJobId(obj[k])) { id = obj[k]; break; } } }
      if (id) {
        _afaJobIndex[ref] = id;
        var asg = afaAssignabilityFrom(obj);
        if (!_afaJobInfo[id]) _afaJobInfo[id] = { ref: ref, assignability: null };
        _afaJobInfo[id].ref = ref;
        if (asg) _afaJobInfo[id].assignability = asg;
      }
    }
    for (var k2 in obj) { var v = obj[k2]; if (v && typeof v === 'object') afaRecordJobs(v, depth + 1); }
  }

  /* Every dashboard row whose status reads UNASSIGNABLE.
     'ASSIGNABLE' rows are NOT matched: the test is for the whole word
     UNASSIGNABLE, and rows in the Partially Batched / Staged for Pickup
     sections are excluded exactly like the Time Left column excludes them. */
  /* Pull an ASSIGNABLE / UNASSIGNABLE verdict out of a job record.
     Field names are not assumed: any property whose name mentions
     "assign" and whose value is one of those two words counts. Falls back
     to a whole-object scan so a renamed field still resolves. */
  function afaAssignabilityFrom(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var k, v;
    for (k in obj) {
      v = obj[k];
      if (typeof v !== 'string') continue;
      if (!/assign/i.test(k)) continue;
      if (/^UNASSIGNABLE$/i.test(v.trim())) return 'UNASSIGNABLE';
      if (/^ASSIGNABLE$/i.test(v.trim()))   return 'ASSIGNABLE';
    }
    for (k in obj) {
      v = obj[k];
      if (typeof v !== 'string') continue;
      if (/^UNASSIGNABLE$/i.test(v.trim())) return 'UNASSIGNABLE';
      if (/^ASSIGNABLE$/i.test(v.trim()))   return 'ASSIGNABLE';
    }
    return null;
  }

  /* Ask the server directly for one job's details. Read-only GET; if the
     endpoint is not there it simply fails and the caller falls back to the
     dashboard data the script already holds. */
  function afaFetchJobInfo(jobId) {
    var url = COMO_BASE + '/api/store/' + STORE_ID + '/job/' + encodeURIComponent(jobId);
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, AFA_TIMEOUT_MS);
    var opts = { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } };
    if (ctrl) opts.signal = ctrl.signal;
    return _origFetch(url, opts).then(function(res){
      clearTimeout(timer);
      if (!res.ok) return null;
      return res.json().then(function(j){ return j; }, function(){ return null; });
    }, function(){ clearTimeout(timer); return null; });
  }

  /* Deep-scan a fetched job payload for its assignability. */
  function afaAssignabilityDeep(obj, depth) {
    if (obj == null || depth > 6) return null;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && i < 500; i++) {
        var r = afaAssignabilityDeep(obj[i], depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof obj !== 'object') return null;
    var direct = afaAssignabilityFrom(obj);
    if (direct) return direct;
    for (var k in obj) {
      var v = obj[k];
      if (v && typeof v === 'object') {
        var r2 = afaAssignabilityDeep(v, depth + 1);
        if (r2) return r2;
      }
    }
    return null;
  }

  /* Decide whether one Partially Batched cart may be force-assigned.
     Nothing is sent unless the cart is positively confirmed UNASSIGNABLE.
     Unknown status is treated as "do not touch", never as permission. */
  function afaVerifyForcible(item) {
    var cached = _afaJobInfo[item.id];
    if (cached && cached.assignability === 'ASSIGNABLE') {
      return Promise.resolve({ eligible: false, reason: 'already assignable' });
    }
    if (cached && cached.assignability === 'UNASSIGNABLE') {
      return Promise.resolve({ eligible: true, reason: 'unassignable (dashboard data)' });
    }
    return afaFetchJobInfo(item.id).then(function(info){
      var asg = info ? afaAssignabilityDeep(info, 0) : null;
      if (asg === 'ASSIGNABLE')   return { eligible: false, reason: 'already assignable' };
      if (asg === 'UNASSIGNABLE') return { eligible: true,  reason: 'unassignable (verified)' };
      return { eligible: false, reason: 'could not verify status \u2014 skipped' };
    });
  }

  /* Anchors sitting between one section heading and the next.
     Used to read the Partially Batched table without ever reaching into
     Staged for Pickup or Problem Solve. */
  function afaSectionAnchors(startRe, stopRes) {
    var all;
    try { all = Array.prototype.slice.call(document.body.querySelectorAll('*')); } catch(e) { return []; }
    var startIdx = -1, i, t;
    for (i = 0; i < all.length; i++) {
      t = (all[i].textContent || '').trim();
      if (t.length < 60 && startRe.test(t)) { startIdx = i; break; }
    }
    if (startIdx === -1) return [];
    var stopIdx = all.length;
    for (i = startIdx + 1; i < all.length; i++) {
      t = (all[i].textContent || '').trim();
      if (t.length >= 60) continue;
      for (var j = 0; j < stopRes.length; j++) {
        if (stopRes[j].test(t)) { stopIdx = i; break; }
      }
      if (stopIdx !== all.length) break;
    }
    var out = [];
    for (i = startIdx; i < stopIdx; i++) if (all[i].tagName === 'A') out.push(all[i]);
    return out;
  }

  /* Carts listed under Partially Batched. This section shows no
     assignability column, so every row is only a CANDIDATE here — each one
     is verified individually before anything is sent. Problem Solve and
     Staged for Pickup act as hard stops for the scan. */
  /* The count the dashboard shows next to a section heading. Used as the
     authority the popup must agree with. */
  function afaSectionCount(labelRe) {
    var all;
    try { all = document.body.querySelectorAll('*'); } catch(e) { return null; }
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || '').trim();
      if (t.length >= 60 || !labelRe.test(t)) continue;
      var m = t.match(/\((\d+)\)/);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  /* Pull the dashboard's current job list straight from the API and feed it
     through the recorder, so job IDs are up to date the moment the popup
     opens instead of relying on whatever happened to be intercepted
     earlier. Read-only; same session as every other call. */
  function afaRefreshJobData() {
    return new Promise(function(resolve){
      try {
        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, 6000);
        var opts = { credentials: 'include', headers: { Accept: 'application/json' } };
        if (ctrl) opts.signal = ctrl.signal;
        _origFetch(COMO_BASE + '/store/' + STORE_ID + '/activeJobsWithSiteSummary', opts)
          .then(function(r){ clearTimeout(timer); return r.ok ? r.json() : null; })
          .then(function(j){
            if (j) { try { afaRecordJobs(j, 0); } catch(e) {} }
            resolve();
          }, function(){ clearTimeout(timer); resolve(); });
      } catch(e) { resolve(); }
    });
  }

  function afaScanPartiallyBatched() {
    var stops = [/^Staged\s+for\s+Pickup/i, /^Problem\s+Solve/i, /^Unassigned/i, /^Assigned/i];
    var anchors = afaSectionAnchors(/^Partially\s+Batched(\s*\(\d+\))?$/i, stops);
    var found = [], seen = Object.create(null);
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var ref = (a.textContent || '').trim();
      if (!ref || ref.length > 24) continue;
      var id = null;
      var href = a.getAttribute('href') || '';
      var m = href.match(/jobId=([^&#]+)/i);
      if (m) { try { id = decodeURIComponent(m[1]); } catch(e) { id = m[1]; } }
      if (!id && _afaJobIndex[ref]) id = _afaJobIndex[ref];
      /* keyed on identity, never on position, so the same cart appearing
         twice in the markup is counted once */
      var key = id || ('ref:' + ref);
      if (seen[key]) continue;
      seen[key] = true;
      found.push({ ref: ref, id: id, partial: true });
    }
    return found;
  }

  function afaScanDashboard() {
    var found = [], seen = Object.create(null);
    var cards = document.querySelectorAll('job-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      try { if (isInExcludedSection(card)) continue; } catch(e) {}
      var txt = card.innerText || card.textContent || '';
      if (!/UNASSIGNABLE/i.test(txt)) continue;
      var a = card.querySelector('a');
      var ref = a ? (a.textContent || '').trim() : '';
      var id = null;
      if (a) {
        var href = a.getAttribute('href') || '';
        var m = href.match(/jobId=([^&#]+)/i);
        if (m) { try { id = decodeURIComponent(m[1]); } catch(e2) { id = m[1]; } }
      }
      if (!id && ref && _afaJobIndex[ref]) id = _afaJobIndex[ref];
      var key = id || ('ref:' + ref + ':' + i);
      if (seen[key]) continue;
      seen[key] = true;
      found.push({ ref: ref || '(unknown)', id: id, unassignable: true });
    }
    return found;
  }

  /* ── Missing Package QR — READ ONLY ──
     This helper runs only after the user deliberately clicks the red action
     in ▶ Run. It checks the normal Tasks list PLUS Problem Solve and
     Partially Batched, then finds the first job whose details contain a
     package with Status = MISSING.

     QR #1 = the Scannable Id from the SAME MISSING package row.
     QR #2 = the first CART_... Last Known Location found in that job.
     If the job has no CART_... value, only QR #1 is generated.

     Discovery checks only alert-looking rows in the main Tasks list for
     performance, but checks EVERY readable row in Problem Solve and Partially
     Batched because missing packages can move there without the same warning
     marker. No writes, assignment changes, completion calls, or background
     observers are added by this feature. */

  function afaMissingText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function afaMissingCartValue(v) {
    var s = afaMissingText(v);
    var m = s.match(/\bCART_[A-Z0-9][A-Z0-9_-]*\b/i);
    return m ? m[0] : '';
  }

  function afaMissingScannableFromObject(obj) {
    if (!obj || typeof obj !== 'object') return '';

    var preferred = [
      'scannableId', 'scannableID', 'scannable_id',
      'packageScannableId', 'packageScannableID',
      'bagScannableId', 'bagScannableID'
    ];

    for (var i = 0; i < preferred.length; i++) {
      var v = obj[preferred[i]];
      if (typeof v === 'string' && afaMissingText(v)) return afaMissingText(v);
    }

    for (var k in obj) {
      if (!/scannable.*id/i.test(k)) continue;
      var v2 = obj[k];
      if (typeof v2 === 'string' && afaMissingText(v2)) return afaMissingText(v2);
    }
    return '';
  }

  function afaMissingStatusFromObject(obj) {
    if (!obj || typeof obj !== 'object') return '';
    for (var k in obj) {
      if (!/status/i.test(k)) continue;
      var v = obj[k];
      if (typeof v === 'string' && /^MISSING$/i.test(v.trim())) return 'MISSING';
    }
    return '';
  }

  function afaMissingInfoFromJson(root) {
    var missingIds = [];
    var cart = '';
    var sawPackageSignals = false;
    var seenMissing = Object.create(null);

    function walk(obj, depth) {
      if (obj == null || depth > 8) return;

      if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length && i < 3000; i++) walk(obj[i], depth + 1);
        return;
      }
      if (typeof obj !== 'object') return;

      var hasStatusKey = false;
      var hasScannableKey = false;
      for (var k in obj) {
        if (/status/i.test(k)) hasStatusKey = true;
        if (/scannable.*id/i.test(k)) hasScannableKey = true;

        if (!cart && typeof obj[k] === 'string') {
          var cv = afaMissingCartValue(obj[k]);
          if (cv) cart = cv;
        }
      }

      if (hasStatusKey || hasScannableKey) sawPackageSignals = true;

      if (afaMissingStatusFromObject(obj) === 'MISSING') {
        var sid = afaMissingScannableFromObject(obj);
        if (sid && !seenMissing[sid]) {
          seenMissing[sid] = true;
          missingIds.push(sid);
        }
      }

      for (var k2 in obj) {
        var child = obj[k2];
        if (child && typeof child === 'object') walk(child, depth + 1);
      }
    }

    walk(root, 0);
    return {
      missingIds: missingIds,
      cart: cart,
      sawPackageSignals: sawPackageSignals
    };
  }

  function afaMissingInfoFromDocument(doc) {
    if (!doc) return { missingIds: [], cart: '' };

    var missingIds = [];
    var cart = '';
    var seen = Object.create(null);
    var rows = [];

    try { rows = Array.prototype.slice.call(doc.querySelectorAll('tr')); } catch(e) {}

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cells = [];
      try { cells = Array.prototype.slice.call(row.querySelectorAll('td')); } catch(e2) {}
      if (!cells.length) continue;

      for (var c = 0; c < cells.length; c++) {
        if (!cart) {
          var cv = afaMissingCartValue(cells[c].textContent || '');
          if (cv) cart = cv;
        }
      }

      var statusIdx = -1;
      for (var s = 0; s < cells.length; s++) {
        var cellText = afaMissingText(cells[s].textContent || '');
        if (/^MISSING$/i.test(cellText)) {
          statusIdx = s;
          break;
        }
      }
      if (statusIdx < 0) continue;

      /* The inspected COMO markup places Scannable Id immediately after the
         MISSING status cell. Prefer that exact relationship. */
      var sid = '';
      if (cells[statusIdx + 1]) sid = afaMissingText(cells[statusIdx + 1].textContent || '');

      /* Fallback to the known Scannable Id class if table order ever shifts. */
      if (!sid) {
        try {
          var statusCell = row.querySelector('.jobdetails-package-status');
          if (statusCell && statusCell.nextElementSibling) {
            sid = afaMissingText(statusCell.nextElementSibling.textContent || '');
          }
        } catch(e3) {}
      }

      if (sid && !seen[sid]) {
        seen[sid] = true;
        missingIds.push(sid);
      }
    }

    return { missingIds: missingIds, cart: cart };
  }

  function afaMissingCandidateFromAnchor(a, section, order, baseScore) {
    if (!a) return null;

    var ref = afaMissingText(a.textContent || '');
    if (!ref || ref.length > 40) return null;

    var id = null;
    var href = a.getAttribute('href') || '';
    var m = href.match(/jobId=([^&#]+)/i);
    if (m) {
      try { id = decodeURIComponent(m[1]); }
      catch(e) { id = m[1]; }
    }
    if (!id && ref && _afaJobIndex[ref]) id = _afaJobIndex[ref];
    if (!id) return null;

    return {
      ref: ref,
      id: id,
      section: section || 'Tasks',
      alertScore: Number(baseScore) || 0,
      domOrder: Number(order) || 0
    };
  }

  function afaHasMissingPackageSignal(node) {
    if (!node) return false;

    var txt = '';
    try { txt = afaMissingText(node.innerText || node.textContent || ''); } catch(e) {}

    /* Explicit package status if the dashboard ever renders it directly. */
    if (/\bMISSING\b/i.test(txt)) return true;

    /* Current COMO alert badge can render as a warning triangle + count
       (for example ▲1 / ⚠1) rather than the literal characters A1. */
    if (/(?:▲|⚠|❗|⛔)\s*\d*/.test(txt)) return true;

    /* Keep backward compatibility with deployments that expose A1/A2 text. */
    if (/\bA\d+\b/i.test(txt)) return true;

    /* Icon fonts often render no useful textContent at all. Check only a
       handful of alert-ish class names inside THIS task row. This is cheap and
       does not open any job page or start any observer. */
    try {
      if (node.querySelector(
        '[class*="warning-sign"],[class*="warning"],' +
        '[class*="exclamation"],[class*="triangle"],' +
        '[class*="danger"],[class*="alert"]'
      )) {
        return true;
      }
    } catch(e2) {}

    /* Last cheap fallback for Bootstrap / FontAwesome warning icons. */
    try {
      var html = String(node.innerHTML || '');
      if (/glyphicon-(?:warning-sign|exclamation-sign)|fa-(?:exclamation|triangle-exclamation|exclamation-triangle)|warning-sign|exclamation-triangle/i.test(html)) {
        return true;
      }
    } catch(e3) {}

    return false;
  }

  function afaScanMissingCandidates() {
    var found = [], seen = Object.create(null);
    var cards = document.querySelectorAll('job-card');

    function pushCandidate(item) {
      if (!item || !item.id) return;
      var key = String(item.id);
      if (seen[key]) return;
      seen[key] = true;
      found.push(item);
    }

    /* 1) Normal Tasks list.
       Keep the existing Time Left exclusions untouched elsewhere; Missing QR
       has its own read-only scan and intentionally does not use those rules. */
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];

      /* job-card rows under Problem Solve / Partially Batched, if a page
         version renders them that way, are handled by the explicit section
         scans below so section labeling stays correct. */
      try {
        if (isInExcludedSection(card)) continue;
      } catch(e) {}

      var a = card.querySelector('a');
      var item = afaMissingCandidateFromAnchor(a, 'Tasks', i, 0);
      if (!item) continue;

      var txt = afaMissingText(card.innerText || card.textContent || '');

      /* Do not open every task's job-details page. Only rows with the actual
         dashboard warning signal are deep-checked, then Status=MISSING is
         still verified from the job details before the button enables. */
      if (!afaHasMissingPackageSignal(card)) continue;

      item.alertScore += 20;
      if (/\bMISSING\b/i.test(txt)) item.alertScore += 30;

      pushCandidate(item);
    }

    /* 2) Problem Solve.
       Completed carts with an unstaged missing package can move here, so this
       section MUST be searched even though normal Time Left/Force actions
       intentionally exclude it. This remains read-only. */
    var psStops = [
      /^Partially\s+Batched/i,
      /^Staged\s+for\s+Pickup/i,
      /^Unassigned/i,
      /^Assigned/i,
      /^Utilization/i,
      /^Late\s+Batch/i
    ];
    var psAnchors = afaSectionAnchors(/^Problem\s+Solve(\s*\(\d+\))?$/i, psStops);
    for (var p = 0; p < psAnchors.length; p++) {
      /* Check EVERY readable Problem Solve job. A finished cart with an
         unstaged missing package can move here even if the row's alert icon
         is rendered differently or is temporarily absent. */
      pushCandidate(afaMissingCandidateFromAnchor(
        psAnchors[p],
        'Problem Solve',
        10000 + p,
        15
      ));
    }

    /* 3) Partially Batched.
       A completed/partially-finished cart can also land here before staging,
       so Missing Package QR checks it too. Staged for Pickup remains excluded
       because the user only requested Problem Solve + Partially Batched. */
    var partialStops = [
      /^Staged\s+for\s+Pickup/i,
      /^Problem\s+Solve/i,
      /^Unassigned/i,
      /^Assigned/i,
      /^Utilization/i,
      /^Late\s+Batch/i
    ];
    var partialAnchors = afaSectionAnchors(
      /^Partially\s+Batched(\s*\(\d+\))?$/i,
      partialStops
    );
    for (var q = 0; q < partialAnchors.length; q++) {
      /* Check EVERY readable Partially Batched job. Missing-package rows in
         this section do not always carry the same red warning triangle because
         the whole cart itself may simply not be ready yet. */
      pushCandidate(afaMissingCandidateFromAnchor(
        partialAnchors[q],
        'Partially Batched',
        20000 + q,
        10
      ));
    }

    found.sort(function(a, b){
      if (b.alertScore !== a.alertScore) return b.alertScore - a.alertScore;
      return a.domOrder - b.domOrder;
    });

    return found;
  }

  function afaProbeMissingJobPage(item) {
    return new Promise(function(resolve){
      if (!item || !item.id || !document.body) {
        resolve(null);
        return;
      }

      var frame = document.createElement('iframe');
      var done = false;
      var started = Date.now();

      frame.setAttribute('aria-hidden', 'true');
      frame.className = 'cbt-missing-probe-frame';
      frame.tabIndex = -1;
      frame.style.cssText =
        'position:fixed!important;left:-10000px!important;top:-10000px!important;' +
        'width:1px!important;height:1px!important;opacity:0!important;' +
        'pointer-events:none!important;border:0!important;';

      function finish(result) {
        if (done) return;
        done = true;
        try { frame.remove(); }
        catch(e) {
          try { frame.parentNode && frame.parentNode.removeChild(frame); } catch(e2) {}
        }
        resolve(result);
      }

      function poll() {
        if (done) return;
        if (Date.now() - started > 5500) {
          finish(null);
          return;
        }

        var doc = null;
        try { doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); }
        catch(e) {}

        if (doc) {
          var info = afaMissingInfoFromDocument(doc);
          if (info.missingIds.length) {
            info.ref = item.ref;
            info.id = item.id;
            info.section = item.section || 'Tasks';
            info.source = 'job-details-page';
            finish(info);
            return;
          }

          /* If the package table has clearly rendered and contains rows but no
             MISSING status, there is no need to wait the full timeout. */
          try {
            var renderedRows = doc.querySelectorAll('tr.ng-scope, tr');
            var renderedText = afaMissingText(doc.body && doc.body.textContent || '');
            if (renderedRows.length >= 2 &&
                /Scannable\s*Id/i.test(renderedText) &&
                /Packages/i.test(renderedText) &&
                Date.now() - started > 900) {
              finish(null);
              return;
            }
          } catch(e2) {}
        }
        setTimeout(poll, 140);
      }

      frame.src = COMO_BASE + '/store/' + encodeURIComponent(STORE_ID) +
        '/jobdetails?jobId=' + encodeURIComponent(item.id) + '&cbtMissingQrProbe=1';
      document.body.appendChild(frame);
      setTimeout(poll, 140);
    });
  }

  function afaProbeMissingJob(item) {
    return afaFetchJobInfo(item.id).then(function(info){
      if (info) {
        var parsed = afaMissingInfoFromJson(info);
        if (parsed.missingIds.length) {
          parsed.ref = item.ref;
          parsed.id = item.id;
          parsed.section = item.section || 'Tasks';
          parsed.source = 'job-json';
          return parsed;
        }

        /* If this JSON clearly contained package/status data and none was
           MISSING, trust it and skip the heavier page probe. */
        if (parsed.sawPackageSignals) return null;
      }

      /* Some deployments keep package rows in the Angular job-details page
         rather than the JSON endpoint. Fall back to a short hidden same-origin
         page probe only for this explicit user action. */
      return afaProbeMissingJobPage(item);
    }, function(){
      return afaProbeMissingJobPage(item);
    });
  }

  function afaFindFirstMissingJob(candidates, onProgress) {
    candidates = candidates || [];
    var idx = 0;

    function next() {
      if (idx >= candidates.length) return Promise.resolve(null);
      var item = candidates[idx++];

      if (typeof onProgress === 'function') {
        try { onProgress(idx, candidates.length, item); } catch(e) {}
      }

      return afaProbeMissingJob(item).then(function(info){
        if (info && info.missingIds && info.missingIds.length) return info;
        return next();
      });
    }

    return next();
  }

  /* Collect every verified missing-package ID across every requested section.
     Each entry keeps its own task/cart context so the carousel can show one
     missing package at a time without mixing carts between jobs. */
  function afaFindAllMissingJobs(candidates, onProgress) {
    candidates = candidates || [];
    var idx = 0;
    var entries = [];
    var seen = Object.create(null);

    function next() {
      if (idx >= candidates.length) {
        return Promise.resolve({ entries: entries });
      }

      var item = candidates[idx++];

      if (typeof onProgress === 'function') {
        try { onProgress(idx, candidates.length, item); } catch(e) {}
      }

      return afaProbeMissingJob(item).then(function(info){
        if (info && info.missingIds && info.missingIds.length) {
          for (var i = 0; i < info.missingIds.length; i++) {
            var sid = afaMissingText(info.missingIds[i]);
            if (!sid) continue;

            var key = String(info.id || item.id || '') + '|' + sid;
            if (seen[key]) continue;
            seen[key] = true;

            entries.push({
              missingId: sid,
              cart: info.cart || '',
              ref: info.ref || item.ref || '',
              id: info.id || item.id || '',
              section: info.section || item.section || 'Tasks'
            });
          }
        }
        return new Promise(function(resolveNext){
          setTimeout(function(){ resolveNext(next()); }, 35);
        });
      }, function(){
        return new Promise(function(resolveNext){
          setTimeout(function(){ resolveNext(next()); }, 35);
        });
      });
    }

    return next();
  }

  function afaMissingQrEntries(info) {
    if (!info) return [];

    if (Array.isArray(info.entries)) {
      return info.entries.filter(function(entry){
        return entry && afaMissingText(entry.missingId);
      });
    }

    var out = [];
    var ids = Array.isArray(info.missingIds) ? info.missingIds : [];
    for (var i = 0; i < ids.length; i++) {
      var sid = afaMissingText(ids[i]);
      if (!sid) continue;
      out.push({
        missingId: sid,
        cart: info.cart || '',
        ref: info.ref || '',
        id: info.id || '',
        section: info.section || 'Tasks'
      });
    }
    return out;
  }

  function afaQrSvgMarkup(value) {
    value = String(value == null ? '' : value);
    if (!value.trim()) return '';

    try {
      var qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();

      var n = qr.getModuleCount();
      var quiet = 4;
      var size = n + quiet * 2;
      var path = '';

      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (!qr.isDark(r, c)) continue;
          var x = c + quiet;
          var y = r + quiet;
          path += 'M' + x + ' ' + y + 'h1v1h-1z';
        }
      }

      return '<svg xmlns="http://www.w3.org/2000/svg" ' +
               'viewBox="0 0 ' + size + ' ' + size + '" ' +
               'preserveAspectRatio="xMidYMid meet" role="img" aria-label="Generated QR code">' +
               '<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
               '<path d="' + path + '" fill="#000000"/>' +
             '</svg>';
    } catch(e) {
      return '';
    }
  }

  function afaMissingQrTile(kind, value) {
    var svg = afaQrSvgMarkup(value);
    if (!svg) return '';

    return '<div class="cbt-missing-qr-tile">' +
      '<div class="cbt-missing-qr-kind">' + afaEsc(kind) + '</div>' +
      '<div class="cbt-missing-qr-svg">' + svg + '</div>' +
      '<div class="cbt-missing-qr-value">' + afaEsc(value) + '</div>' +
    '</div>';
  }

  function afaMissingQrResult(info) {
    var entries = afaMissingQrEntries(info);

    if (!entries.length) {
      afaShell(
        'Missing Package QR',
        '<div id="cbt-afa-lead">No MISSING package was found in Tasks, Problem Solve, or Partially Batched.</div>' +
        '<div class="cbt-afa-note">Nothing was changed. This action is read-only.</div>',
        '<button class="cbt-afa-act" data-afa="back">Back</button>'
      );

      var emptyCard = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
      if (emptyCard) {
        emptyCard.addEventListener('click', function(e){
          var b = e.target.closest('[data-afa="back"]');
          if (b) afaConfirm();
        });
      }
      return;
    }

    var currentIndex = 0;

    afaShell(
      'Missing Package QR',
      '<div id="cbt-missing-qr-stage"></div>',
      '<button class="cbt-afa-act" data-afa="back">Back</button>' +
      '<button class="cbt-afa-act go" data-afa="close">Done</button>'
    );

    var card = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
    if (!card) return;
    card.classList.add('cbt-afa-missing-qr-card');

    /* afaShell creates/scales the card before this result class exists.
       Re-apply once here so the very first QR frame is already fixed at 130%. */
    try { applyUiScale(); } catch(eScale) {}

    function renderCurrent() {
      if (!_afaOverlay || !card.isConnected) return;

      var stage = card.querySelector('#cbt-missing-qr-stage');
      if (!stage) return;

      var entry = entries[currentIndex];
      var total = entries.length;
      var hasPrev = currentIndex > 0;
      var hasNext = currentIndex < total - 1;

      /* Only render an arrow when there is actually somewhere to go.
         The empty grid cell is just spacing; no hidden/disabled arrow exists. */
      var nav =
        '<div class="cbt-missing-qr-nav">' +
          (hasPrev
            ? '<button type="button" class="cbt-missing-qr-nav-btn cbt-missing-qr-prev" data-afa="missing-prev" aria-label="Previous missing package">←</button>'
            : '') +
          '<div class="cbt-missing-qr-count">' + (currentIndex + 1) + '/' + total + '</div>' +
          (hasNext
            ? '<button type="button" class="cbt-missing-qr-nav-btn cbt-missing-qr-next" data-afa="missing-next" aria-label="Next missing package">→</button>'
            : '') +
        '</div>';

      var tiles = afaMissingQrTile('Missing Package', entry.missingId);
      var hasCart = !!entry.cart;

      if (hasCart) {
        tiles += afaMissingQrTile('Cart', entry.cart);
      }

      var note = hasCart
        ? 'Missing package QR + cart QR.'
        : 'No CART_ location was found, so only the missing package QR is shown.';

      stage.innerHTML =
        '<div class="cbt-missing-qr-summary">' +
          afaEsc(entry.section || 'Tasks') + ' · Task <b>' +
          afaEsc(entry.ref || '') + '</b> · ' + afaEsc(note) +
        '</div>' +
        nav +
        '<div class="cbt-missing-qr-grid' + (hasCart ? '' : ' single') + '">' +
          tiles +
        '</div>';
    }

    renderCurrent();

    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-afa]');
      if (!b) return;

      var action = b.getAttribute('data-afa');

      if (action === 'missing-prev') {
        if (currentIndex > 0) {
          currentIndex--;
          renderCurrent();
        }
        return;
      }

      if (action === 'missing-next') {
        if (currentIndex < entries.length - 1) {
          currentIndex++;
          renderCurrent();
        }
        return;
      }

      if (action === 'close') {
        afaClose();
      } else if (action === 'back') {
        afaConfirm();
      }
    });
  }

  function afaMissingQrChecking() {
    afaShell(
      'Missing Package QR',
      '<div id="cbt-afa-lead">Finding the MISSING package…</div>' +
      '<div id="cbt-afa-bar"><div id="cbt-afa-fill"></div></div>' +
      '<div id="cbt-afa-live" style="color:var(--cb-text2);font-size:12px;">Checking Tasks alerts + all Problem Solve + all Partially Batched.</div>',
      '<button class="cbt-afa-act" data-afa="close">Cancel</button>'
    );

    var card = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
    if (!card) return;
    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-afa="close"]');
      if (b) afaClose();
    });
  }

  function afaRunMissingQr() {
    if (_afaRunning) return;

    var candidates = afaScanMissingCandidates();
    if (!candidates.length) {
      afaMissingQrResult(null);
      return;
    }

    afaMissingQrChecking();

    afaRefreshJobData().then(function(){
      if (!_afaOverlay) return;

      /* Re-scan after the fresh dashboard response so job IDs are current. */
      var freshCandidates = afaScanMissingCandidates();
      if (freshCandidates.length) candidates = freshCandidates;

      return afaFindAllMissingJobs(candidates, function(done, total, item){
        if (!_afaOverlay) return;
        var lead = document.getElementById('cbt-afa-lead');
        var fill = document.getElementById('cbt-afa-fill');
        var live = document.getElementById('cbt-afa-live');

        if (lead) lead.innerHTML =
          'Finding the MISSING package… <b>' + done + '</b> of <b>' + total + '</b>';
        if (fill) fill.style.width = Math.round((done / Math.max(1, total)) * 100) + '%';
        if (live) {
          live.textContent = 'Checking ' + (item.section || 'Tasks') +
            ' · task ' + (item.ref || '');
        }
      });
    }).then(function(info){
      if (!_afaOverlay) return;
      afaMissingQrResult(info || null);
    }).catch(function(){
      if (!_afaOverlay) return;
      afaShell(
        'Missing Package QR',
        '<div id="cbt-afa-lead">Could not read the package details right now.</div>' +
        '<div class="cbt-afa-note">Nothing was changed. Try again after the dashboard finishes loading.</div>',
        '<button class="cbt-afa-act" data-afa="back">Back</button>'
      );
      var card = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
      if (card) {
        card.addEventListener('click', function(e){
          if (e.target.closest('[data-afa="back"]')) afaConfirm();
        });
      }
    });
  }

  /* ── Complete Task eligibility — NO time rule ──
     The old AM/PM / Batch Target heuristic is intentionally gone. When Auto
     Complete is enabled, the script asks the site itself whether Complete Task
     is available for that cart by loading the real job-details route in a
     hidden same-origin iframe and reading the actual Complete Task button state.

     This is read-only. No completeJob POST is sent unless the site's own button
     has settled into an enabled state. If the site cannot be checked, the cart
     is skipped for completion rather than guessed. */
  var AFA_COMPLETE_PROBE_TIMEOUT_MS = 7000;

  function afaFindCompleteButton(doc) {
    if (!doc) return null;
    var buttons;
    try { buttons = doc.querySelectorAll('button'); } catch(e) { return null; }
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var label = ((b.getAttribute('title') || '') + ' ' + (b.textContent || '')).replace(/\s+/g, ' ').trim();
      if (/complete\s*task/i.test(label)) return b;
    }
    return null;
  }

  /* If the job-details JSON exposes a clearly named boolean capability flag,
     trust that first. This is deliberately strict: unrelated "complete"
     counters/statuses are ignored, and only boolean keys that explicitly mean
     can/enable/allow/eligible/completable are accepted. */
  function afaCompleteCapabilityFlag(obj, depth) {
    if (obj == null || depth > 7) return null;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && i < 600; i++) {
        var ar = afaCompleteCapabilityFlag(obj[i], depth + 1);
        if (ar !== null) return ar;
      }
      return null;
    }
    if (typeof obj !== 'object') return null;
    for (var k in obj) {
      var v = obj[k];
      if (typeof v !== 'boolean') continue;
      var key = String(k).replace(/[_\-\s]/g, '').toLowerCase();
      var explicit =
        /^(can|should|is)?(enable|enabled|allow|allowed|eligible|completable).*complete/.test(key) ||
        /^complete.*(enable|enabled|allow|allowed|eligible|completable)$/.test(key) ||
        /^(can|should)complete(job|task)?$/.test(key) ||
        /^(is)?completable(job|task)?$/.test(key);
      if (explicit) return v;
    }
    for (var k2 in obj) {
      var child = obj[k2];
      if (child && typeof child === 'object') {
        var r = afaCompleteCapabilityFlag(child, depth + 1);
        if (r !== null) return r;
      }
    }
    return null;
  }

  function afaProbeCompleteButtonState(jobId) {
    return new Promise(function(resolve){
      if (!jobId || !document.body) {
        resolve({ eligible: false, verified: false, reason: 'Complete Task eligibility could not be checked' });
        return;
      }

      var frame = document.createElement('iframe');
      var done = false, started = Date.now(), firstSeen = 0;
      var lastDisabled = null, stable = 0;
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed!important;left:-10000px!important;top:-10000px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;border:0!important;';

      function finish(result) {
        if (done) return;
        done = true;
        try { frame.remove(); } catch(e) { try { frame.parentNode && frame.parentNode.removeChild(frame); } catch(e2) {} }
        resolve(result);
      }

      function poll() {
        if (done) return;
        if (Date.now() - started > AFA_COMPLETE_PROBE_TIMEOUT_MS) {
          finish({ eligible: false, verified: false, reason: 'Complete Task eligibility could not be verified' });
          return;
        }

        var doc = null, btn = null;
        try { doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); } catch(e) {}
        try { btn = afaFindCompleteButton(doc); } catch(e2) {}

        if (btn) {
          if (!firstSeen) firstSeen = Date.now();
          var aria = String(btn.getAttribute('aria-disabled') || '').toLowerCase();
          var disabled = !!btn.disabled || btn.hasAttribute('disabled') || aria === 'true' || btn.classList.contains('disabled');
          if (disabled === lastDisabled) stable++; else { lastDisabled = disabled; stable = 1; }

          /* Wait long enough for Angular's ng-disabled expression to settle.
             Enabled gets the longer dwell because a button can briefly render
             enabled before the controller finishes applying its state. */
          var dwell = disabled ? 400 : 900;
          if (stable >= 3 && Date.now() - firstSeen >= dwell) {
            finish({
              eligible: !disabled,
              verified: true,
              reason: disabled ? 'Complete Task is disabled by the site' : 'Complete Task is enabled by the site'
            });
            return;
          }
        }
        setTimeout(poll, 120);
      }

      var src = COMO_BASE + '/store/' + encodeURIComponent(STORE_ID) + '/jobdetails?jobId=' + encodeURIComponent(jobId) + '&cbtAfaProbe=1';
      frame.src = src;
      document.body.appendChild(frame);
      setTimeout(poll, 120);
    });
  }

  function afaProbeCompletable(jobId) {
    return afaFetchJobInfo(jobId).then(function(info){
      var flag = info ? afaCompleteCapabilityFlag(info, 0) : null;
      if (flag !== null) {
        return {
          eligible: !!flag,
          verified: true,
          reason: flag ? 'Complete Task is enabled by job data' : 'Complete Task is disabled by job data'
        };
      }
      /* No explicit capability flag in the JSON: fall back to the exact UI
         control that the user would see on the real job-details page. */
      return afaProbeCompleteButtonState(jobId);
    }, function(){
      return afaProbeCompleteButtonState(jobId);
    });
  }

  /* Every regular task on the main dashboard is only a completion CANDIDATE.
     No write is made from this scan. The hidden probe above decides whether
     the site's own Complete Task control is actually enabled. Problem rows and
     the side sections are deliberately excluded. */
  function afaScanCompletionCandidates() {
    var found = [], seen = Object.create(null);
    var cards = document.querySelectorAll('job-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      try { if (isInExcludedSection(card)) continue; } catch(e) {}
      var txt = card.innerText || card.textContent || '';
      if (/problem\s*solve|\bproblem\b/i.test(txt)) continue;
      var a = card.querySelector('a');
      var ref = a ? (a.textContent || '').trim() : '';
      var id = null;
      if (a) {
        var href = a.getAttribute('href') || '';
        var m = href.match(/jobId=([^&#]+)/i);
        if (m) { try { id = decodeURIComponent(m[1]); } catch(e2) { id = m[1]; } }
      }
      if (!id && ref && _afaJobIndex[ref]) id = _afaJobIndex[ref];
      var key = id || ('ref:' + ref + ':' + i);
      if (seen[key]) continue;
      seen[key] = true;
      found.push({ ref: ref || '(unknown)', id: id, completeCandidate: true });
    }
    return found;
  }

  /* Merge candidate sources by cart identity. Flags are preserved because
     the Force Assign and Auto Complete modes build separate queues from the
     same dashboard data; Auto Complete never falls back to Force Assign. */
  function afaMergeQueue(base, extra) {
    var out = [];
    function same(a, b) {
      if (a.id && b.id && a.id === b.id) return true;
      return !!(a.ref && b.ref && a.ref === b.ref);
    }
    function add(it) {
      if (!it) return;
      var hit = null;
      for (var i = 0; i < out.length; i++) { if (same(out[i], it)) { hit = out[i]; break; } }
      if (!hit) {
        out.push({
          ref: it.ref, id: it.id,
          partial: !!it.partial,
          unassignable: !!it.unassignable,
          completeCandidate: !!it.completeCandidate
        });
        return;
      }
      if (!hit.id && it.id) hit.id = it.id;
      hit.partial = hit.partial || !!it.partial;
      hit.unassignable = hit.unassignable || !!it.unassignable;
      hit.completeCandidate = hit.completeCandidate || !!it.completeCandidate;
    }
    (base || []).forEach(add);
    (extra || []).forEach(add);
    return out;
  }

  /* Complete Task — the same call the site's own Complete Task button makes,
     captured from DevTools: POST with an empty JSON body, answering 200 with
     the literal `true`. Store and job ids are substituted per cart, and the
     browser attaches the existing session exactly as it does for a manual
     click. Nothing here is requested that the account cannot already do. */
  var AFA_COMPLETE_PATH = '/api/store/{storeId}/job/{jobId}/completeJob';
  var AFA_COMPLETE_BODY = {};

  /* The server answers a real completion with the literal `true`. A 200
     carrying anything else is NOT treated as success — better to report the
     odd response than to claim a cart was completed when it may not be. */
  function afaCompletedOk(r) {
    if (!r || !r.ok) return false;
    var body = String(r.body == null ? '' : r.body).trim().replace(/^"|"$/g, '');
    return /^true$/i.test(body);
  }

  function afaCompleteTask(jobId) {
    if (!AFA_COMPLETE_PATH) {
      return Promise.resolve({ ok: false, status: 0, body: 'Complete Task endpoint not configured' });
    }
    var url = COMO_BASE + AFA_COMPLETE_PATH
      .replace('{storeId}', encodeURIComponent(STORE_ID))
      .replace('{jobId}', encodeURIComponent(jobId));
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, AFA_TIMEOUT_MS);
    var opts = {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(AFA_COMPLETE_BODY)
    };
    if (ctrl) opts.signal = ctrl.signal;
    return _origFetch(url, opts).then(function(res){
      clearTimeout(timer);
      return res.text().then(
        function(t){ return { ok: res.ok, status: res.status, body: t }; },
        function(){  return { ok: res.ok, status: res.status, body: '' }; }
      );
    }, function(err){
      clearTimeout(timer);
      return { ok: false, status: 0, body: (err && err.message) ? String(err.message) : 'network error' };
    });
  }

  /* The one write this feature makes — the same call the Yes button makes. */
  function afaForceAssign(jobId) {
    var url = COMO_BASE + '/api/store/' + STORE_ID + '/job/' + encodeURIComponent(jobId) + '/forceAssignable';
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, AFA_TIMEOUT_MS);
    var opts = {
      method: 'POST',
      credentials: 'include',          /* the page's existing session, nothing added */
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ ignoreProblemSolve: false })
    };
    if (ctrl) opts.signal = ctrl.signal;
    return _origFetch(url, opts).then(function(res){
      clearTimeout(timer);
      return res.text().then(
        function(t){ return { ok: res.ok, status: res.status, body: t }; },
        function(){  return { ok: res.ok, status: res.status, body: '' }; }
      );
    }, function(err){
      clearTimeout(timer);
      return { ok: false, status: 0, body: (err && err.message) ? String(err.message) : 'network error' };
    });
  }

  /* ── modal ── */
  /* Keeps the icon and label as separate elements so they stay aligned. */
  function afaSetBtn(text, busy) {
    var b = document.getElementById('cbt-afa-btn');
    if (!b) return;
    b.innerHTML = '<span class="cbt-afa-lbl">' + text + '</span>';
    if (busy) b.classList.add('busy'); else b.classList.remove('busy');
  }

  function afaClose() {
    if (_afaRunning) return;                    /* never vanish mid-run */
    _afaMissingMenuInfo = null;
    _afaMissingMenuCheckSeq++;
    if (_afaOverlay && _afaOverlay.parentNode) _afaOverlay.parentNode.removeChild(_afaOverlay);
    _afaOverlay = null;
    afaSetBtn('▶ Run', false);
  }
  function afaShell(title, bodyHtml, footHtml) {
    if (!_afaOverlay) {
      _afaOverlay = document.createElement('div');
      _afaOverlay.id = 'cbt-afa-overlay';
      document.body.appendChild(_afaOverlay);
      _afaOverlay.addEventListener('mousedown', function(e){ if (e.target === _afaOverlay) afaClose(); });
    }
    _afaOverlay.innerHTML =
      '<div id="cbt-afa-card">' +
        '<div id="cbt-afa-head"><span id="cbt-afa-title">' + title + '</span>' +
        '<button id="cbt-afa-x" title="Close">\u2715</button></div>' +
        '<div id="cbt-afa-body">' + bodyHtml + '</div>' +
        '<div id="cbt-afa-foot">' + footHtml + '</div>' +
      '</div>';
    var x = _afaOverlay.querySelector('#cbt-afa-x');
    if (x) x.addEventListener('click', afaClose);
    try { applyPopupTheme(); } catch(e) {}
    try { applyUiScale(); } catch(e) {}
  }
  function afaEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function afaRowsHtml(items) {
    return '<div class="cbt-afa-list">' + items.map(function(it){
      var cls = it.ok === true ? 'ok' : (it.skip ? 'skip' : (it.ok === false ? 'bad' : ''));
      return '<div class="cbt-afa-row ' + cls + '">' +
             '<span class="cbt-afa-ref">' + afaEsc(it.ref) + '</span>' +
             '<span class="cbt-afa-msg">' + afaEsc(it.msg || (it.id ? 'ready' : 'task ID not found')) + '</span>' +
             '</div>';
    }).join('') + '</div>';
  }

  /* Step 1: show what would be touched and wait for a deliberate go-ahead. */
  /* Opens with a short "checking" state, refreshes the job data, then waits
     until the resolved list agrees with the count the dashboard prints
     (or gives up after a couple of seconds and reports what it has).
     This is what stopped the popup showing a stale 5-of-9. */
  function afaConfirm() {
    if (_afaRunning) { afaProgressView(); return; }

    /* Opening ▶ Run must be instant. Do NOT show the old animated
       "Checking the dashboard..." screen. Render the current action menu from
       the DOM immediately. Each individual action performs a fresh backend
       refresh right before execution, so removing this opening loader does not
       make Force Assign / Partial / Auto Complete stale. */
    var pbNow = afaScanPartiallyBatched();
    var expected = afaSectionCount(/^Partially\s+Batched(\s*\(\d+\))?$/i);
    afaConfirmRender(afaScanDashboard(), pbNow, expected);
  }

  function afaConfirmRender(list, pbAll, pbExpected, suppress) {
    /* Three completely independent actions:
         1) Force Assign         -> UNASSIGNABLE only
         2) Partially Batched    -> Partially Batched only
         3) Auto Complete        -> regular completion candidates only
       No checkbox can mix one queue into another. */

    suppress = suppress || {
      force: Object.create(null),
      partial: Object.create(null),
      complete: Object.create(null)
    };

    function isSuppressed(action, item) {
      var bucket = suppress[action];
      if (!bucket || !item) return false;
      if (item.id && bucket['id:' + String(item.id)]) return true;
      if (item.ref && bucket['ref:' + String(item.ref)]) return true;
      return false;
    }

    /* The page's own DOM can lag behind a successful Force Assign/Complete
       request. When returning with Back, hide tasks that THIS run already
       succeeded on so the menu immediately reflects the completed action
       instead of offering the same cart again. */
    list = (list || []).filter(function(x){ return !isSuppressed('force', x); });
    pbAll = (pbAll || []).filter(function(x){ return !isSuppressed('partial', x); });

    var ready = list.filter(function(x){ return x.id; });
    var noId  = list.filter(function(x){ return !x.id; });

    var pbReady = pbAll.filter(function(x){ return x.id; });
    var pbFound = (pbExpected != null) ? Math.max(pbExpected, pbAll.length) : pbAll.length;
    var pbUnresolved = Math.max(0, pbFound - pbReady.length);

    var completionCandidates = afaScanCompletionCandidates()
      .filter(function(x){ return !isSuppressed('complete', x); });
    var completeReady = completionCandidates.filter(function(x){ return x.id; });

    var forceDisabled   = ready.length === 0;
    var partialDisabled = pbReady.length === 0;
    var completeDisabled = !AFA_COMPLETE_PATH || completeReady.length === 0;

    function actionBlock(action, label, count, disabled, copy) {
      return '<div class="cbt-afa-action-block' + (disabled ? ' off' : '') + '">' +
        '<button type="button" class="cbt-afa-act go cbt-afa-action-btn" data-afa="' + action + '"' +
          (disabled ? ' disabled' : '') + '>' +
          label + (count != null ? ' (' + count + ')' : '') +
        '</button>' +
        '<span class="cbt-afa-action-copy">' + copy + '</span>' +
      '</div>';
    }

    var forceBlock = actionBlock(
      'force',
      '▶ Force Assign',
      ready.length,
      forceDisabled,
      forceDisabled
        ? 'No UNASSIGNABLE carts are available right now.'
        : 'Runs only the UNASSIGNABLE carts. Partially Batched is not included.'
    );

    var partialBlock = actionBlock(
      'partial',
      '▶ Partially Batched',
      pbReady.length,
      partialDisabled,
      partialDisabled
        ? (pbFound
            ? 'No Partially Batched cart has a readable task ID yet.'
            : 'No Partially Batched carts are available right now.')
        : 'Runs only Partially Batched carts. Each one is verified before Force Assign.'
    );

    var completeBlock = actionBlock(
      'complete',
      '▶ Auto Complete',
      completeReady.length,
      completeDisabled,
      !AFA_COMPLETE_PATH
        ? 'Unavailable: the Complete Task request is not configured.'
        : (completeDisabled
            ? 'No regular tasks are available to Auto Complete right now.'
            : 'Runs Complete Task only. It never Force Assigns and never includes Partially Batched.')
    );

    var missingCandidates = afaScanMissingCandidates();
    _afaMissingMenuInfo = null;

    var missingBlock =
      '<div class="cbt-afa-action-block off" id="cbt-afa-missing-block">' +
        '<button type="button" class="cbt-afa-act cbt-afa-action-btn cbt-afa-missing-btn" ' +
          'id="cbt-afa-missing-btn" data-afa="missingqr" disabled>' +
          '<span class="cbt-afa-missing-triangle">▲</span>' +
          (missingCandidates.length ? 'Checking…' : 'No Missing Package') +
        '</button>' +
        '<span class="cbt-afa-action-copy" id="cbt-afa-missing-copy">' +
          (missingCandidates.length
            ? 'Checking warning rows in Tasks plus every Problem Solve and Partially Batched row. The button enables only if a real MISSING package is found.'
            : 'No readable task IDs are available in Tasks, Problem Solve, or Partially Batched right now. This button is disabled.') +
        '</span>' +
      '</div>';

    var warnings = '';
    if (noId.length) {
      warnings += '<div class="cbt-afa-warn">' + noId.length +
        ' UNASSIGNABLE cart(s) have no readable task ID yet and are not included.</div>';
    }
    if (pbUnresolved) {
      warnings += '<div class="cbt-afa-warn">' + pbUnresolved +
        ' Partially Batched cart(s) have no readable task ID yet and are not included.</div>';
    }

    var listHtml = '';
    if (list.length) {
      listHtml =
        '<div style="margin-top:12px;color:var(--cb-text2);font-size:12px;font-weight:700;">UNASSIGNABLE CARTS</div>' +
        afaRowsHtml(list);
    }

    afaShell(
      'Cart Actions',
      '<div id="cbt-afa-lead">Choose an action. Each button performs <b>only the action shown</b>.</div>' +
      forceBlock +
      partialBlock +
      completeBlock +
      missingBlock +
      warnings +
      listHtml +
      '<div class="cbt-afa-note">Each action only affects its own cart group. Problem Solve is never touched. Missing Package QR is read-only.</div>',
      '<button class="cbt-afa-act" data-afa="close">Close</button>'
    );

    var card = _afaOverlay.querySelector('#cbt-afa-card');
    if (!card) return;

    /* Confirm an actual MISSING package before enabling this action.
       This runs only when ▶ Run is opened, not in the background. */
    var missingCheckSeq = ++_afaMissingMenuCheckSeq;
    var missingOverlay = _afaOverlay;

    function setMissingMenuState(info, finished) {
      if (!_afaOverlay || _afaOverlay !== missingOverlay ||
          missingCheckSeq !== _afaMissingMenuCheckSeq) return;

      var btn = document.getElementById('cbt-afa-missing-btn');
      var block = document.getElementById('cbt-afa-missing-block');
      var copy = document.getElementById('cbt-afa-missing-copy');
      if (!btn || !block || !copy) return;

      var verifiedEntries = afaMissingQrEntries(info);

      if (verifiedEntries.length) {
        _afaMissingMenuInfo = info;
        btn.disabled = false;
        btn.innerHTML = '<span class="cbt-afa-missing-triangle">▲</span>Missing Package QR';
        block.classList.remove('off');
        copy.textContent =
          verifiedEntries.length + ' MISSING package' +
          (verifiedEntries.length === 1 ? '' : 's') +
          ' found. Click to open QR' +
          (verifiedEntries.length === 1 ? '' : 's') +
          (verifiedEntries.length > 1 ? ' with left/right navigation.' : '.');
        return;
      }

      _afaMissingMenuInfo = null;
      btn.disabled = true;
      block.classList.add('off');

      if (finished) {
        btn.innerHTML = '<span class="cbt-afa-missing-triangle">▲</span>No Missing Package';
        copy.textContent =
          'No MISSING package was found in Tasks, Problem Solve, or Partially Batched. This button is disabled.';
      }
    }

    if (missingCandidates.length) {
      cbtAfterFirstPaint(function(){
        cbtIdle(function(){
          if (!_afaOverlay || _afaOverlay !== missingOverlay ||
              missingCheckSeq !== _afaMissingMenuCheckSeq) return;

          afaFindAllMissingJobs(missingCandidates, function(done, total, item){
            if (!_afaOverlay || _afaOverlay !== missingOverlay ||
                missingCheckSeq !== _afaMissingMenuCheckSeq) return;

            var copy = document.getElementById('cbt-afa-missing-copy');
            if (copy) {
              copy.textContent = 'Checking ' + (item.section || 'Tasks') +
                ' · ' + done + ' of ' + total + '…';
            }
          }).then(function(info){
            setMissingMenuState(info || null, true);
          }).catch(function(){
            setMissingMenuState(null, true);
          });
        }, 350);
      }, 30);
    } else {
      setMissingMenuState(null, true);
    }

    /* Refresh immediately before every run. This avoids stale closures after
       changing Live/Today/Weekly/Fastest/Names tabs or leaving the popup open
       while the dashboard itself changes. */
    function runFresh(action, button) {
      if (!button || button.disabled || _afaRunning) return;

      var original = button.textContent;
      button.disabled = true;

      /* Refresh silently. The old visible "Checking..." state looked like a
         second loader after the user had already chosen an action. */
      afaRefreshJobData().then(function(){
        if (!_afaOverlay || _afaRunning) return;

        var queue = [];
        var opts = {};

        if (action === 'force') {
          queue = afaScanDashboard()
            .filter(function(x){ return x.id && !isSuppressed('force', x); });
          opts = { mode: 'force', autoComplete: false, completeOnly: false };
        } else if (action === 'partial') {
          queue = afaScanPartiallyBatched()
            .filter(function(x){ return x.id && !isSuppressed('partial', x); });
          opts = { mode: 'partial', autoComplete: false, completeOnly: false };
        } else if (action === 'complete') {
          queue = afaScanCompletionCandidates()
            .filter(function(x){ return x.id && !isSuppressed('complete', x); });
          opts = { mode: 'complete', autoComplete: true, completeOnly: true };
        }

        if (!queue.length) {
          /* State changed while the menu was open. Rebuild instantly with no
             loading screen so the now-empty action becomes disabled. */
          var pbNow2 = afaScanPartiallyBatched();
          var expected2 = afaSectionCount(/^Partially\s+Batched(\s*\(\d+\))?$/i);
          afaConfirmRender(afaScanDashboard(), pbNow2, expected2, suppress);
          return;
        }

        afaRun(queue, opts);
      }).catch(function(){
        if (!_afaOverlay) return;
        button.disabled = false;
        button.textContent = original;
      });
    }

    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-afa]');
      if (!b) return;
      var action = b.getAttribute('data-afa');

      if (action === 'close') {
        afaClose();
        return;
      }

      if (action === 'missingqr') {
        if (b.disabled || !afaMissingQrEntries(_afaMissingMenuInfo).length) {
          return;
        }

        /* The action only works after one or more real MISSING packages were
           verified. The result view shows one missing package at a time. */
        afaMissingQrResult(_afaMissingMenuInfo);
        return;
      }

      if (action === 'force' || action === 'partial' || action === 'complete') {
        runFresh(action, b);
      }
    });
  }

  function afaProgressView(mode) {
    var isComplete = mode === 'complete';
    var isPartial = mode === 'partial';
    var title = isComplete ? 'Auto Complete' : (isPartial ? 'Partially Batched' : 'Force Assign');
    afaShell(title + ' \u2014 running',
      '<div id="cbt-afa-lead"><span id="cbt-afa-count">Starting\u2026</span></div>' +
      '<div id="cbt-afa-bar"><div id="cbt-afa-fill"></div></div>' +
      '<div id="cbt-afa-live"></div>',
      '<button class="cbt-afa-act stop" data-afa="stop">⏹ Stop</button>');
    var card = _afaOverlay.querySelector('#cbt-afa-card');
    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-afa]');
      if (b && b.getAttribute('data-afa') === 'stop') {
        _afaStop = true;
        b.textContent = '⏹ Stopping\u2026';
        b.disabled = true;
      }
    });
  }
  function afaProgress(done, total, ref, results) {
    var c = document.getElementById('cbt-afa-count');
    if (c) c.innerHTML = 'Processing <b>' + done + '</b> of <b>' + total + '</b>' + (ref ? ' \u2014 cart ' + afaEsc(ref) : '');
    var f = document.getElementById('cbt-afa-fill');
    if (f) f.style.width = Math.round((done / Math.max(1, total)) * 100) + '%';
    var live = document.getElementById('cbt-afa-live');
    if (live && results.length) live.innerHTML = afaRowsHtml(results.slice(-6));
  }

  function afaSummary(results, stopped, retryable, mode) {
    var isComplete = mode === 'complete';
    var isPartial = mode === 'partial';
    var title = isComplete ? 'Auto Complete' : (isPartial ? 'Partially Batched' : 'Force Assign');
    var okN   = results.filter(function(r){ return r.ok === true; }).length;
    var skipN = results.filter(function(r){ return r.skip; }).length;
    var badN  = results.filter(function(r){ return r.ok === false && !r.skip; }).length;
    afaShell(title + ' \u2014 finished',
      '<div id="cbt-afa-lead">' + (stopped ? 'Stopped early. ' : '') +
      '<b>' + okN + '</b> ' + (isComplete ? 'completed' : 'assigned') +
      (skipN ? ', <b>' + skipN + '</b> skipped' : '') +
      (badN  ? ', <b>' + badN  + '</b> failed'  : '') + '.</div>' +
      (isPartial && retryable
        ? '<div class="cbt-afa-warn">' + retryable + ' cart(s) are still listed under Partially Batched. Press the Partially Batched button again to retry them.</div>'
        : '') +
      (results.length ? afaRowsHtml(results) : '<div style="color:var(--cb-text2)">Nothing was processed.</div>'),
      '<button class="cbt-afa-act" data-afa="back">Back</button>' +
      '<button class="cbt-afa-act go" data-afa="close">Done</button>');
    var card = _afaOverlay.querySelector('#cbt-afa-card');
    card.addEventListener('click', function(e){
      var b = e.target.closest('[data-afa]');
      if (!b) return;

      var action = b.getAttribute('data-afa');
      if (action === 'close') {
        afaClose();
        return;
      }

      if (action === 'back') {
        /* The dashboard DOM can take a few seconds to visually remove a cart
           after a successful write. Build a suppression map from the exact
           successful results of THIS run, then return instantly to Cart
           Actions. This makes counts/buttons correct immediately without any
           loading animation and prevents the same successful cart from being
           run again while the page catches up. */
        var suppress = {
          force: Object.create(null),
          partial: Object.create(null),
          complete: Object.create(null)
        };

        var bucketName = mode === 'complete'
          ? 'complete'
          : (mode === 'partial' ? 'partial' : 'force');

        results.forEach(function(r){
          if (!r || r.ok !== true) return;
          if (r.id) suppress[bucketName]['id:' + String(r.id)] = true;
          if (r.ref) suppress[bucketName]['ref:' + String(r.ref)] = true;
        });

        var pbNow = afaScanPartiallyBatched();
        var expected = afaSectionCount(/^Partially\s+Batched(\s*\(\d+\))?$/i);

        afaConfirmRender(afaScanDashboard(), pbNow, expected, suppress);

        /* Refresh job IDs silently in the background. There is deliberately no
           visible loader here. */
        try { afaRefreshJobData(); } catch(e) {}
        return;
      }
    });
  }

  /* Step 2: one cart at a time, re-checked immediately before each send. */
  function afaRun(list, opts) {
    opts = opts || {};
    var runMode = opts.mode || (opts.autoComplete ? 'complete' : 'force');
    var autoComplete = runMode === 'complete' || !!opts.autoComplete;
    var completeOnly = runMode === 'complete' || !!opts.completeOnly || autoComplete;
    _afaRunning = true; _afaStop = false;
    _afaDone = Object.create(null);        /* fresh claim map for this run only */
    var partialRefs = Object.create(null);
    list.forEach(function(it){ if (it.partial) partialRefs[it.ref] = true; });
    var btn = document.getElementById('cbt-afa-btn');
    /* The dashboard header behaves like a coding playground:
       ▶ Run while idle, ⏹ Stop while an action is executing. */
    afaSetBtn('⏹ Stop', true);
    afaProgressView(runMode);
    var results = [], i = 0;

    function finish() {
      _afaRunning = false;
      afaSetBtn('▶ Run', false);
      var stopped = _afaStop;
      /* Re-read the dashboard: any cart still sitting under Partially
         Batched can simply be run again next time. */
      afaRefreshJobData().then(function(){
        var stillThere = Object.create(null), retryable = 0;
        try {
          afaScanPartiallyBatched().forEach(function(x){
            stillThere[x.ref] = true;
            if (x.id) stillThere[x.id] = true;
          });
        } catch(e) {}
        results.forEach(function(r){
          if (partialRefs[r.ref] && stillThere[r.ref]) { r.retry = true; retryable++; }
        });
        _afaDone = Object.create(null);     /* nothing carries into the next run */
        afaSummary(results, stopped, retryable, runMode);
      });
    }
    function next(delay) { i++; setTimeout(step, delay); }

    function step() {
      if (_afaStop || i >= list.length) return finish();
      var item = list[i];
      afaProgress(i + 1, list.length, item.ref, results);

      if (!item.id) { results.push({ ref: item.ref, ok: false, msg: 'task ID not found' }); return next(60); }
      if (_afaDone[item.id]) { results.push({ ref: item.ref, skip: true, ok: false, msg: 'already handled in this run' }); return next(60); }

      function doneResult(row, delay) {
        results.push(row);
        afaProgress(i + 1, list.length, item.ref, results);
        next(delay == null ? AFA_DELAY_MS : delay);
      }

      function completeNow() {
        _afaDone[item.id] = true;   /* claim before the write: never twice in one run */
        return afaCompleteTask(item.id).then(function(r){
          if (afaCompletedOk(r)) {
            doneResult({ ref: item.ref, ok: true, msg: 'Completed \u2014 Complete Task enabled by site' });
          } else {
            var w = r.status ? ('HTTP ' + r.status) : (r.body || 'no response');
            if (r.ok && r.body) w += ' \u2014 unexpected response: ' + String(r.body).replace(/\s+/g, ' ').slice(0, 60);
            doneResult({ ref: item.ref, skip: !r.status, ok: false, msg: 'Complete Task failed \u2014 ' + w });
          }
        });
      }

      function forceNow(noteWhy) {
        _afaDone[item.id] = true;
        return afaForceAssign(item.id).then(function(r){
          if (r.ok) {
            doneResult({ ref: item.ref, id: item.id, ok: true, msg: 'Force Assigned (HTTP ' + r.status + ')' + (noteWhy ? ' \u2014 ' + noteWhy : '') });
          } else {
            var why = r.status ? ('HTTP ' + r.status) : 'no response';
            if (r.body) why += ' \u2014 ' + String(r.body).replace(/\s+/g, ' ').slice(0, 90);
            doneResult({ ref: item.ref, ok: false, msg: why });
          }
        });
      }

      function continueWithoutCompletion(probeReason) {
        /* Partially Batched carries no assignability column, so preserve its
           existing verify-before-force behavior. */
        if (item.partial) {
          afaVerifyForcible(item).then(function(v){
            if (!v.eligible) {
              doneResult({ ref: item.ref, skip: true, ok: false, msg: 'partially batched \u2014 ' + v.reason }, 120);
              return;
            }
            forceNow('partially batched' + (probeReason ? '; ' + probeReason : ''));
          });
          return;
        }

        /* A completion-only row was added solely because Auto Complete is on.
           If the site's own button is not enabled, never turn it into a Force
           Assign action. */
        if (item.completeCandidate && !item.unassignable) {
          doneResult({ ref: item.ref, skip: true, ok: false, msg: probeReason || 'Complete Task not available' }, 80);
          return;
        }

        /* Ordinary Force Assign rows must still be UNASSIGNABLE right now. */
        var live = afaScanDashboard();
        var still = live.some(function(x){ return x.id ? x.id === item.id : x.ref === item.ref; });
        if (!still) {
          doneResult({ ref: item.ref, skip: true, ok: false, msg: 'no longer unassignable \u2014 skipped' }, 60);
          return;
        }
        forceNow(probeReason || '');
      }

      /* Independent Partially Batched mode: never let a regular
         UNASSIGNABLE/completion candidate leak into this run. */
      if (runMode === 'partial' && !item.partial) {
        doneResult({ ref: item.ref, skip: true, ok: false, msg: 'Skipped \u2014 not a Partially Batched cart' }, 60);
        return;
      }

      /* Independent Force Assign mode: never process a Partially Batched row.
         Partial carts have their own button and their own run. */
      if (runMode === 'force' && item.partial) {
        doneResult({ ref: item.ref, skip: true, ok: false, msg: 'Skipped \u2014 use Partially Batched button' }, 60);
        return;
      }

      /* Auto Complete is deliberately COMPLETE-ONLY.
         It never calls Force Assign, even when the same cart is UNASSIGNABLE.
         The server remains the eligibility gate: literal true means completed;
         a normal rejection is skipped; network/auth/server errors are reported.
         Partially Batched is excluded from this mode entirely. */
      if (autoComplete || completeOnly) {
        if (item.partial) {
          doneResult({ ref: item.ref, skip: true, ok: false, msg: 'Skipped \u2014 Partially Batched is Force Assign only' }, 80);
          return;
        }

        _afaDone[item.id] = true;
        afaCompleteTask(item.id).then(function(r){
          if (_afaStop) return finish();

          if (afaCompletedOk(r)) {
            doneResult({ ref: item.ref, id: item.id, ok: true, msg: 'Completed \u2014 server allowed Complete Task' });
            return;
          }

          if (!r || !r.status || r.status === 401 || r.status === 403 || r.status >= 500) {
            var hardWhy = (!r || !r.status)
              ? ((r && r.body) ? String(r.body) : 'no response')
              : ('HTTP ' + r.status + (r.body ? ' \u2014 ' + String(r.body).replace(/\s+/g, ' ').slice(0, 80) : ''));
            doneResult({ ref: item.ref, ok: false, msg: 'Complete Task check failed \u2014 ' + hardWhy });
            return;
          }

          var rejectWhy = 'Skipped \u2014 Complete Task not allowed';
          if (r.status) rejectWhy += ' (HTTP ' + r.status + ')';
          if (r.ok && r.body) rejectWhy += ' \u2014 response ' + String(r.body).replace(/\s+/g, ' ').slice(0, 50);
          doneResult({ ref: item.ref, skip: true, ok: false, msg: rejectWhy }, 80);
        });
        return;
      }

      continueWithoutCompletion('');
    }
    step();
  }

  /* ══════════════════════════════════════
     ASSOCIATE AUTOCOMPLETE

     Types ahead inside the site's own assignment fields — the Manager
     Action "Assign to Associate" box on COMO, and "Enter associate ID" in
     the Outbound "Assign procurement lists" window — so there is no more
     copying out of a side panel.

     It only ever inserts a login that already exists in the saved
     associate list (the same list the Names tab and the old search panel
     use). Nothing is derived, transformed or invented from a typed name,
     so an ID can never be guessed. Selecting somebody fills the field and
     stops there: submitting stays a deliberate click on Assign / Confirm.
  ══════════════════════════════════════ */
  var AC_MIN_CHARS = 2;     /* start suggesting from the 2nd character */
  var AC_MAX_ROWS  = 12;
  var _acDrop = null, _acInput = null, _acItems = [], _acIdx = -1;
  var _acHost = null;              /* the <kat-input> custom element, when there is one */
  var _acWatch = null, _acRect = '';

  /* Our own inputs must never get a second autocomplete on top. */
  /* Events crossing a shadow boundary are retargeted: at document level
     e.target is the outermost shadow HOST, not the field inside it. The
     composed path still starts at the true element, so read it from there.
     This is what stopped the Outbound field from ever being recognised. */
  function acRealTarget(e) {
    try {
      if (typeof e.composedPath === 'function') {
        var path = e.composedPath();
        if (path && path.length) return path[0];
      }
    } catch(err) {}
    return e.target;
  }

  /* The Outbound modal's field, reached through its nested open shadow roots:
       kat-modal[data-testid="assign-modal"]
         kat-input-group.assign-searchbar        -> shadowRoot
           kat-input[data-testid="assign-searchbar-input"] -> shadowRoot
             input[part="input"]
     Each hop tolerates the element being in light DOM instead, so a markup
     change on one level does not break the whole lookup. */
  function acFindKatInput(scope) {
    /* Confirmed structure (verified in DevTools):
         kat-modal[data-testid="assign-modal"]
           kat-input-group.assign-searchbar            <- light DOM
             kat-input[data-testid="assign-searchbar-input"]   <- LIGHT DOM child
               #shadow-root (open)
                 input[part="input"][placeholder="Enter associate ID"]
       The kat-input is NOT inside inputGroup.shadowRoot, so light DOM is
       tried first at that level; the shadow lookups remain as fallbacks in
       case a future build nests it differently. The katal-id is never used
       because it changes between renders. */
    var modal = scope ||
                document.querySelector('kat-modal[data-testid="assign-modal"]') ||
                document.querySelector('kat-modal');
    if (!modal) return null;
    var group = modal.querySelector('kat-input-group.assign-searchbar') ||
                (modal.shadowRoot && modal.shadowRoot.querySelector('kat-input-group.assign-searchbar')) ||
                modal.querySelector('kat-input-group') ||
                (modal.shadowRoot && modal.shadowRoot.querySelector('kat-input-group'));
    if (!group) return null;
    var host = group.querySelector('kat-input[data-testid="assign-searchbar-input"]') ||
               (group.shadowRoot && group.shadowRoot.querySelector('kat-input[data-testid="assign-searchbar-input"]')) ||
               group.querySelector('kat-input') ||
               (group.shadowRoot && group.shadowRoot.querySelector('kat-input'));
    if (!host) return null;
    var input = (host.shadowRoot && host.shadowRoot.querySelector('input[part="input"][placeholder="Enter associate ID"]')) ||
                (host.shadowRoot && host.shadowRoot.querySelector('input[part="input"]')) ||
                (host.shadowRoot && host.shadowRoot.querySelector('input')) ||
                host.querySelector('input');
    if (!input) return null;
    return { host: host, input: input };
  }

  /* Last-resort sweep: walk every open shadow root looking for an
     associate-ish input, in case the testids or class names change. */
  function acDeepFindInput(root, depth) {
    if (!root || depth > 6) return null;
    var nodes;
    try { nodes = root.querySelectorAll('*'); } catch(e) { return null; }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.tagName === 'INPUT' && acIsAssociateField(n)) return { host: n.getRootNode && n.getRootNode().host || null, input: n };
      if (n.shadowRoot) {
        var found = acDeepFindInput(n.shadowRoot, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function acIsOurs(el) {
    if (!el || !el.id) return false;
    return el.id.indexOf('cbt-') === 0;
  }

  /* Label text sitting near a field, used to recognise it. */
  function acContextText(el) {
    var bits = [];
    try {
      if (el.id) {
        var lab = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
        if (lab) bits.push(lab.textContent || '');
      }
      var wrapLab = el.closest ? el.closest('label') : null;
      if (wrapLab) bits.push(wrapLab.textContent || '');
      var p = el.parentElement;
      for (var i = 0; i < 3 && p; i++) { bits.push(p.textContent || ''); p = p.parentElement; }
    } catch(e) {}
    return bits.join(' ').slice(0, 400);
  }

  /* Is this the associate / user-id box of an assignment dialog?
     Matched on wording rather than on class names, which are generated
     and change between deployments. */
  /* The ONLY two places associate suggestions may appear:
       COMO     -> the Manager Action dialog behind "Assign to Associate"
       Outbound -> kat-modal[data-testid="assign-modal"] ("Assign
                   procurement lists" -> "Enter associate ID")
     Anything not inside one of those containers is rejected outright. This
     is what previously let the dropdown attach to Search Historical, Search
     and Resolve and other page-level search boxes: those fields merely
     mention "associate ID" in their placeholder, and the old test looked at
     wording alone with no container requirement. */
  /* Search and Resolve exception
     ----------------------------
     This field was intentionally excluded before because generic page search
     boxes could accidentally receive associate suggestions. The user now
     wants the name/login popup back ONLY on Outbound -> Search and Resolve.

     Detection is deliberately strict:
       - Outbound site only
       - the page heading/tab must identify Search and Resolve, OR the search
         input must carry the known multi-ID Search and Resolve placeholder
       - the field must be the page's main search input
       - when a search-type selector is present, it must be set to Associate ID

     This is checked only when the user focuses/types in a field, so it adds no
     background polling and no continuous DOM work. */
  function acIsSearchResolvePage() {
    if (!isOutboundSite()) return false;

    var path = (location.pathname || '').toLowerCase();
    if (/search[^a-z0-9]*and[^a-z0-9]*resolve|search[^a-z0-9]*resolve/.test(path)) return true;

    try {
      var heads = document.querySelectorAll('h1,h2,h3,[role="heading"]');
      for (var i = 0; i < heads.length; i++) {
        var t = (heads[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (t === 'search and resolve') return true;
      }
    } catch(e) {}

    return false;
  }

  function acSearchResolveModeIsAssociate(input) {
    var scope = null;
    try {
      scope = input.closest('form') ||
              input.closest('[class*="search"]') ||
              input.parentElement;
    } catch(e) {
      scope = input.parentElement;
    }

    /* Native select used by the current Search and Resolve page. */
    try {
      var selects = (scope || document).querySelectorAll('select');
      for (var i = 0; i < selects.length; i++) {
        var s = selects[i];
        var txt = '';
        try {
          txt = ((s.options && s.selectedIndex >= 0 && s.options[s.selectedIndex])
                   ? s.options[s.selectedIndex].textContent
                   : s.value) || '';
        } catch(e2) { txt = s.value || ''; }
        txt = txt.replace(/\s+/g, ' ').trim().toLowerCase();
        if (/associate\s*id|associate/.test(txt)) return true;
      }
    } catch(e3) {}

    /* Katal/custom select fallback. Keep the search local first. */
    try {
      var root = scope || document;
      var custom = root.querySelectorAll('kat-select,[role="combobox"],button,[aria-haspopup="listbox"]');
      for (var j = 0; j < custom.length; j++) {
        var ct = (custom[j].textContent || custom[j].getAttribute('value') || custom[j].getAttribute('aria-label') || '')
          .replace(/\s+/g, ' ').trim().toLowerCase();
        if (/^associate\s*id$|associate\s*id/.test(ct)) return true;
      }
    } catch(e4) {}

    /* If no selector can be read, only accept the exact known Search and
       Resolve search box when its own metadata explicitly references
       Associate ID. This keeps Search Historical and unrelated search fields
       excluded. */
    var own = [
      input.getAttribute('placeholder'),
      input.getAttribute('aria-label'),
      input.getAttribute('name'),
      input.getAttribute('id')
    ].filter(Boolean).join(' ').toLowerCase();

    return /associate\s*id/.test(own) &&
           (/procurement\s*list\s*id/.test(own) || /order\s*id/.test(own) || /status/.test(own));
  }

  function acIsSearchResolveAssociateField(el) {
    if (!el || el.tagName !== 'INPUT' || acIsOurs(el)) return false;
    if (!isOutboundSite()) return false;

    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type !== 'text' && type !== 'search' && type !== '') return false;
    if (el.disabled || el.readOnly) return false;

    var own = [
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('name'),
      el.getAttribute('id')
    ].filter(Boolean).join(' ').toLowerCase();

    /* The screenshot/current page uses one broad search input whose
       placeholder mentions status, zone, order ID, procurement list ID and
       associate ID. That signature is strong enough even if the SPA URL
       itself is generic. */
    var knownSearchBox =
      /associate\s*id/.test(own) &&
      (/procurement\s*list\s*id/.test(own) || (/status/.test(own) && /zone/.test(own)));

    if (!knownSearchBox && !acIsSearchResolvePage()) return false;
    return acSearchResolveModeIsAssociate(el);
  }

  function acInAssignmentContainer(el) {
    var n = el, guard = 0;
    while (n && guard++ < 200) {
      if (n.nodeType === 1) {
        var tag = (n.tagName || '').toLowerCase();
        if (tag === 'kat-modal') {
          var tid = n.getAttribute ? (n.getAttribute('data-testid') || '') : '';
          return /assign/i.test(tid);        /* only the assign modal */
        }
        var role = n.getAttribute ? (n.getAttribute('role') || '') : '';
        var cls  = (typeof n.className === 'string') ? n.className : '';
        if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog' ||
            /(^|\s|-)(modal|dialog)(\s|-|$)/i.test(cls)) {
          /* a dialog qualifies only if it is an assignment dialog */
          var txt = '';
          try { txt = (n.textContent || '').slice(0, 800); } catch(e) {}
          return /assign/i.test(txt);
        }
      }
      if (n.nodeType === 11 && n.host) { n = n.host; continue; }   /* shadow root */
      n = n.parentNode;
    }
    return false;                                /* not in a dialog at all */
  }

  function acIsAssociateField(el) {
    if (!el || el.tagName !== 'INPUT' || acIsOurs(el)) return false;

    /* The one page-level exception: Outbound -> Search and Resolve with
       Associate ID selected. All other page-level searches remain excluded. */
    if (acIsSearchResolveAssociateField(el)) return true;

    if (!acInAssignmentContainer(el)) return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type !== 'text' && type !== 'search' && type !== '') return false;
    if (el.disabled || el.readOnly) return false;
    var own = [el.getAttribute('placeholder'), el.getAttribute('name'), el.getAttribute('id'),
               el.getAttribute('aria-label'), el.getAttribute('ng-model'), el.getAttribute('formcontrolname')]
              .filter(Boolean).join(' ');
    var hay = (own + ' ' + acContextText(el)).toLowerCase();
    if (/associate|assoc\b|\blogin\b|user\s*id|userid|employee|\bassign/.test(hay)) return true;
    return false;
  }

  /* Rank matches: whole-word/prefix hits first, then anything containing
     the term, alphabetical inside each group. */
  function acSearch(term) {
    term = (term || '').toLowerCase().trim();
    if (term.length < AC_MIN_CHARS) return [];
    var all = loadAllNames(), pre = [], mid = [];
    for (var k in all) {
      var idx = k.indexOf(term);
      if (idx === 0) pre.push(all[k]);
      else if (idx > 0) mid.push(all[k]);
      if (pre.length + mid.length > 400) break;
    }
    function byName(a, b){ return a.toLowerCase().localeCompare(b.toLowerCase()); }
    pre.sort(byName); mid.sort(byName);
    return { rows: pre.concat(mid).slice(0, AC_MAX_ROWS), total: pre.length + mid.length };
  }

  function acEsc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function acHighlight(name, term) {
    var i = name.toLowerCase().indexOf(term.toLowerCase());
    if (i === -1 || !term) return acEsc(name);
    return acEsc(name.slice(0, i)) + '<mark>' + acEsc(name.slice(i, i + term.length)) +
           '</mark>' + acEsc(name.slice(i + term.length));
  }

  function acClose() {
    if (_acDrop && _acDrop.parentNode) _acDrop.parentNode.removeChild(_acDrop);
    _acDrop = null; _acItems = []; _acIdx = -1;
  }

  function acPlace() {
    if (!_acDrop || !_acInput) return;
    /* The dropdown carries the UI zoom, and zoom multiplies the used value
       of left/top/width — so divide by it to land on the real viewport
       pixels of the field. Without this the list drifts off the input as
       soon as the size is changed. */
    var z = (typeof _uiScale === 'number' && _uiScale > 0) ? _uiScale : 1;
    var r = _acInput.getBoundingClientRect();
    var w = Math.max(r.width, 240);
    var left = Math.min(r.left, window.innerWidth - w - 8);
    _acDrop.style.width = (w / z) + 'px';
    _acDrop.style.left  = (Math.max(8, left) / z) + 'px';
    /* flip above the field when there is no room below */
    var below = window.innerHeight - r.bottom;
    if (below < 180 && r.top > below) {
      _acDrop.style.top = 'auto';
      _acDrop.style.bottom = ((window.innerHeight - r.top + 4) / z) + 'px';
      _acDrop.style.maxHeight = (Math.max(120, r.top - 12) / z) + 'px';
    } else {
      _acDrop.style.bottom = 'auto';
      _acDrop.style.top = ((r.bottom + 4) / z) + 'px';
      _acDrop.style.maxHeight = (Math.max(120, below - 12) / z) + 'px';
    }
  }

  function acRender(term) {
    if (!_acInput) return;
    var res = acSearch(term);
    var rows = res.rows || [], total = res.total || 0;
    if (!_acDrop) {
      _acDrop = document.createElement('div');
      _acDrop.id = 'cbt-ac-drop';
      document.body.appendChild(_acDrop);
      try { _acDrop.style.zoom = _uiScale; } catch(e) {}
      try { applyPopupTheme(); } catch(e) {}
      /* mousedown, not click: fires before the field loses focus */
      _acDrop.addEventListener('mousedown', function(e){
        var row = e.target.closest('.cbt-ac-item');
        if (!row) return;
        e.preventDefault(); e.stopPropagation();
        acPick(row.getAttribute('data-name'));
      });
    }
    _acItems = rows;
    _acIdx = rows.length ? 0 : -1;
    var html = '<div class="cbt-ac-hd">Associates</div>';
    if (!rows.length) {
      html += '<div class="cbt-ac-none">No matches found</div>';
    } else {
      html += rows.map(function(n, i){
        return '<div class="cbt-ac-item' + (i === 0 ? ' on' : '') + '" data-name="' + acEsc(n) + '">' +
                 '<span class="cbt-ac-nm">' + acHighlight(n, term) + '</span>' +
                 '<span class="cbt-ac-tag">login</span>' +
               '</div>';
      }).join('');
      if (total > rows.length) {
        html += '<div class="cbt-ac-foot">' + (total - rows.length) + ' more \u2014 keep typing to narrow</div>';
      }
    }
    _acDrop.innerHTML = html;
    acPlace();
  }

  function acMove(step) {
    if (!_acDrop || !_acItems.length) return;
    _acIdx = (_acIdx + step + _acItems.length) % _acItems.length;
    var nodes = _acDrop.querySelectorAll('.cbt-ac-item');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('on', i === _acIdx);
    if (nodes[_acIdx] && nodes[_acIdx].scrollIntoView) nodes[_acIdx].scrollIntoView({ block: 'nearest' });
  }

  /* Write the chosen login into the site's own field.
     Uses the native value setter plus input/change events so frameworks
     (AngularJS on COMO, React on Outbound) register the change as if it
     had been typed. Nothing is submitted. */
  function acFire(el) {
    /* composed:true so the event escapes the shadow root and the app's own
       listeners (and any framework value tracker) actually see it */
    try { el.dispatchEvent(new Event('input',  { bubbles: true, composed: true })); } catch(e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true, composed: true })); } catch(e) {}
    try { el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true })); } catch(e) {}
  }

  function acSetValue(el, value, host) {
    try {
      var proto = (el instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    } catch(e) { el.value = value; }
    acFire(el);
    /* Mirror onto the custom element itself: Katal components hold their own
       value property, and Confirm stays disabled until that one is set. */
    if (host && host !== el) {
      try { host.value = value; } catch(e) {}
      try { if (host.setAttribute) host.setAttribute('value', value); } catch(e) {}
      acFire(host);
    }
  }

  function acPick(name) {
    if (!name || !_acInput) return;
    var el = _acInput;
    acSetValue(el, name, _acHost); /* exact stored login — never derived */
    acClose();
    try { el.focus(); if (el.setSelectionRange) el.setSelectionRange(name.length, name.length); } catch(e) {}
  }

  /* ── wiring: delegated, so dialogs created later are covered ── */
  document.addEventListener('focusin', function(e){
    var el = acRealTarget(e);
    if (!acIsAssociateField(el)) return;
    acBind(el, null);
    _acInput = el;
    if ((el.value || '').trim().length >= AC_MIN_CHARS) acRender(el.value);
  }, true);

  document.addEventListener('input', function(e){
    var t = acRealTarget(e);

    /* Search and Resolve can change its search type while the text box remains
       focused. Bind lazily on the first keystroke once Associate ID is active. */
    if (t !== _acInput && acIsSearchResolveAssociateField(t)) {
      acBind(t, null);
      _acInput = t;
      _acHost = null;
    }

    if (t !== _acInput) return;
    var v = t.value || '';
    if (v.trim().length < AC_MIN_CHARS) { acClose(); return; }
    acRender(v);
  }, true);

  document.addEventListener('keydown', function(e){
    if (!_acDrop || acRealTarget(e) !== _acInput) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); acMove(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); acMove(-1); }
    else if (e.key === 'Enter')     {
      if (_acIdx >= 0 && _acItems[_acIdx]) { e.preventDefault(); e.stopPropagation(); acPick(_acItems[_acIdx]); }
    }
    else if (e.key === 'Escape')    { e.preventDefault(); e.stopPropagation(); acClose(); }
    else if (e.key === 'Tab')       { acClose(); }
  }, true);

  document.addEventListener('mousedown', function(e){
    if (!_acDrop) return;
    var t = acRealTarget(e);
    if (_acDrop.contains(t) || _acDrop.contains(e.target) || t === _acInput) return;
    acClose();
  }, true);

  /* Bind directly to a native input living inside a shadow root. Delegated
     document listeners do reach it, but binding on the element itself is
     immune to any stopPropagation the component does internally. */
  /* True when the field sits inside a dialog, so page-level search boxes
     never get focus stolen on load — only fields in a popup do. */
  function acInModal(el) {
    var n = el, guard = 0;
    while (n && guard++ < 200) {
      if (n.nodeType === 1) {
        var tag = (n.tagName || '').toLowerCase();
        if (tag === 'kat-modal' || tag === 'dialog') return true;
        if (n.getAttribute) {
          var role = n.getAttribute('role');
          if (role === 'dialog' || role === 'alertdialog') return true;
        }
        var cls = (typeof n.className === 'string') ? n.className : '';
        if (/(^|\s|-)(modal|dialog|popup)(\s|-|$)/i.test(cls)) return true;
      }
      if (n.nodeType === 11 && n.host) { n = n.host; continue; }
      n = n.parentNode;
    }
    return false;
  }

  /* Put the caret in the field as soon as its popup appears, exactly once,
     so typing can start immediately. Waits for the input to actually be
     laid out, and backs off if focus is already in some other field. */
  /* document.activeElement only reports the outermost host when focus is
     inside a shadow root — descend to find what is really focused. */
  function acDeepActive() {
    var a = null;
    try { a = document.activeElement; } catch(e) { return null; }
    var guard = 0;
    while (a && a.shadowRoot && a.shadowRoot.activeElement && guard++ < 12) {
      a = a.shadowRoot.activeElement;
    }
    return a;
  }

  /* Focus the field once its popup is really on screen, then confirm it
     actually took — Katal builds the modal in stages and can move focus
     after our first attempt, which is why a single focus() call did not
     stick on the Outbound dialog. Retries only until it lands, and stops
     immediately if the user has clicked into something else. */
  function acAutoFocus(input) {
    if (!input || input._cbtAcFocused) return;
    input._cbtAcFocused = true;
    var tries = 0, MAX = 40;              /* ~4s of settling at most */

    function userIsElsewhere() {
      var a = acDeepActive();
      return !!(a && a !== input && a !== document.body &&
                (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
    }

    function again(delay) {
      if (typeof requestAnimationFrame === 'function' && delay <= 16) requestAnimationFrame(attempt);
      else setTimeout(attempt, delay);
    }

    function attempt(){
      if (++tries > MAX || !input.isConnected) return;
      var r;
      try { r = input.getBoundingClientRect(); } catch(e) { return; }
      if (!r || (!r.width && !r.height)) { again(100); return; }   /* not laid out yet */
      if (acDeepActive() === input) return;          /* focus landed: stop */
      if (userIsElsewhere()) return;                 /* user moved on: stop */
      /* focus the native input itself — focusing the custom element does
         nothing, which is why the attribute alone was unreliable */
      try { input.focus({ preventScroll: true }); } catch(e) { try { input.focus(); } catch(e2) {} }
      /* verify next frame, then again shortly after the modal animation */
      again(tries < 6 ? 16 : 120);
    }
    attempt();
  }

  function acBind(input, host) {
    if (!input || input._cbtAcBound) { if (host && input) input._cbtAcHost = host; return; }
    input._cbtAcBound = true;
    if (host) input._cbtAcHost = host;
    /* Only auto-focus a field that is actually on screen. A hidden modal's
       input would otherwise consume the single focus attempt at page load. */
    if (acInModal(input)) {
      var br;
      try { br = input.getBoundingClientRect(); } catch(e) { br = null; }
      if (br && (br.width || br.height)) acAutoFocus(input);
    }
    input.addEventListener('focus', function(){
      _acInput = input; _acHost = input._cbtAcHost || null;
      if ((input.value || '').trim().length >= AC_MIN_CHARS) acRender(input.value);
    });
    input.addEventListener('input', function(){
      _acInput = input; _acHost = input._cbtAcHost || null;
      var v = input.value || '';
      if (v.trim().length < AC_MIN_CHARS) { acClose(); return; }
      acRender(v);
    });
    input.addEventListener('keydown', function(e){
      if (!_acDrop || _acInput !== input) return;
      if (e.key === 'ArrowDown')    { e.preventDefault(); acMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); }
      else if (e.key === 'Enter')   { if (_acIdx >= 0 && _acItems[_acIdx]) { e.preventDefault(); e.stopPropagation(); acPick(_acItems[_acIdx]); } }
      else if (e.key === 'Escape')  { e.preventDefault(); e.stopPropagation(); acClose(); }
      else if (e.key === 'Tab')     { acClose(); }
    });
  }

  /* ── Assignment modal watcher ──
     Fires once per opening. The modal, both shadow roots and the native
     input all appear at different moments, and the component moves focus
     while it finishes animating — so this waits for the real input to
     exist, focuses THAT (not the custom element), then verifies. */
  var _acModalSeen = null;

  /* "Open" means the modal is really on screen — not merely present in the
     DOM. Katal keeps the modal mounted and toggles visible, so matching it
     while hidden made the watcher mark the opening as handled at page load
     and skip the real one. That single fallback selector is what defeated
     every earlier focus attempt. */
  function acModalIsOpen(m) {
    if (!m) return false;
    var v = m.getAttribute && m.getAttribute('visible');
    if (v === 'false') return false;
    var r;
    try { r = m.getBoundingClientRect(); } catch(e) { return false; }
    return !!(r && (r.width || r.height));
  }

  function acAssignModalEl() {
    var all;
    try { all = document.querySelectorAll('kat-modal'); } catch(e) { return null; }
    var fallback = null;
    for (var i = 0; i < all.length; i++) {
      if (!acModalIsOpen(all[i])) continue;
      if (all[i].getAttribute('data-testid') === 'assign-modal') return all[i];
      if (!fallback) fallback = all[i];
    }
    return fallback;
  }

  /* Any other dialog holding an associate field (COMO's Manager Action). */
  function acGenericModalEl() {
    var sels = ['[role="dialog"]', '[role="alertdialog"]', 'dialog[open]', '.modal.in', '.modal'];
    for (var s = 0; s < sels.length; s++) {
      var nodes;
      try { nodes = document.querySelectorAll(sels[s]); } catch(e) { continue; }
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var r;
        try { r = n.getBoundingClientRect(); } catch(e) { continue; }
        if (!r.width && !r.height) continue;                 /* not visible */
        try {
          var ins = n.querySelectorAll('input');
          for (var k = 0; k < ins.length; k++) if (acIsAssociateField(ins[k])) return n;
        } catch(e) {}
      }
    }
    return null;
  }

  function acWatchAssignModal() {
    var modal = acAssignModalEl() || acGenericModalEl();
    if (!modal) { _acModalSeen = null; return; }   /* closed: arm for next time */
    if (_acModalSeen === modal) return;            /* this opening already handled */

    /* find the REAL native input; if the shadow roots are not built yet,
       bail out and let the next tick try again */
    var found = acFindKatInput(modal) || acFindKatInput();
    if (!found) {
      var deep = acDeepFindInput(modal, 0) || acDeepFindInput(document, 0);
      if (!deep) return;
      found = deep;
    }
    /* the input must be laid out before focusing is meaningful */
    var rr;
    try { rr = found.input.getBoundingClientRect(); } catch(e) { rr = null; }
    if (!rr || (!rr.width && !rr.height)) return;   /* still animating: try next tick */
    _acModalSeen = modal;
    acBind(found.input, found.host);
    found.input._cbtAcFocused = false;             /* allow one focus per opening */
    acAutoFocus(found.input);
  }

  /* The assign modal is created on demand and its shadow roots appear with
     it, so poll for the field rather than assuming it exists at load. */
  function acScanForFields() {
    try { acWatchAssignModal(); } catch(e) {}
    var found = acFindKatInput();
    if (found) { acBind(found.input, found.host); return; }
    /* light-DOM assignment fields (COMO's Manager Action dialog) */
    try {
      var plain = document.querySelectorAll('input');
      for (var i = 0; i < plain.length; i++) {
        if (!plain[i]._cbtAcBound && acIsAssociateField(plain[i])) acBind(plain[i], null);
      }
    } catch(e) {}
    /* fall back to a deep sweep only while a modal is actually open */
    if (document.querySelector('kat-modal, [role="dialog"], .modal')) {
      var deep = acDeepFindInput(document, 0);
      if (deep) acBind(deep.input, deep.host);
    }
  }

  /* Keep the portal glued to the field: the modal body scrolls, and scroll
     events inside a shadow root do not reach document listeners. Also
     closes the dropdown the moment the field goes away with the modal. */
  function acTick() {
    if (!_acDrop) return;
    if (!_acInput || !_acInput.isConnected) { acClose(); return; }
    var r = _acInput.getBoundingClientRect();
    if (!r.width && !r.height) { acClose(); return; }   /* modal closed / field hidden */
    var sig = Math.round(r.left) + ':' + Math.round(r.top) + ':' + Math.round(r.width);
    if (sig !== _acRect) { _acRect = sig; acPlace(); }
  }

  window.addEventListener('resize', function(){ try { applyUiScale(); } catch(e) {} });
  window.addEventListener('resize', function(){ if (_acDrop) acPlace(); });
  window.addEventListener('scroll', function(){ if (_acDrop) acPlace(); }, true);
  var _acObserver = null;

  function acWatchRelevant() {
    if (isOutboundSite() || isTaskDetailPage()) return true;
    return !!document.querySelector('kat-modal, [role="dialog"], .modal');
  }

  function startAutocompleteWatch() {
    if (_acObserver || _acWatch) return;

    try {
      var acMutationRun = coalesced(function(){
        if (!acWatchRelevant() && !_acDrop) return;
        acScanForFields();
      }, 140);

      _acObserver = new MutationObserver(function(mutations){
        for (var i = 0; i < mutations.length; i++) {
          if (!cbtMutationIsOnlyOwnUi(mutations[i])) {
            acMutationRun();
            return;
          }
        }
      });
      _acObserver.observe(document.documentElement, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['visible', 'aria-hidden', 'open', 'class', 'style']
      });
    } catch(e) {}

    _acWatch = setInterval(function(){
      try {
        if (_acDrop) acTick();
        if (!document.hidden && acWatchRelevant()) acScanForFields();
      } catch(e2) {}
    }, 450);

    try { if (acWatchRelevant()) acScanForFields(); } catch(e3) {}
  }

  var _cbtStartupDone = false;

  function cbtResetTodayWeeklyV2() {
    var RESET_KEY = 'cbt_today_weekly_reset_v23948';
    try {
      if (gmGet(RESET_KEY, null) || localStorage.getItem(RESET_KEY)) return;
    } catch(e0) {}

    var today = todayStr();
    var week = currentWeekStartStr();
    var empty = '{}';

    /* Reset TODAY on this computer. */
    try { gmSet(STORAGE_KEY, empty); } catch(e1) {}
    try { gmSet(DATE_KEY, today); } catch(e2) {}
    try { localStorage.setItem(STORAGE_KEY, empty); } catch(e3) {}
    try { localStorage.setItem(DATE_KEY, today); } catch(e4) {}

    /* Reset TODAY remote-display cache. */
    try { gmSet(REMOTE_HISTORY_KEY, empty); } catch(e5) {}
    try { gmSet(REMOTE_HISTORY_DATE_KEY, today); } catch(e6) {}
    try { localStorage.setItem(REMOTE_HISTORY_KEY, empty); } catch(e7) {}
    try { localStorage.setItem(REMOTE_HISTORY_DATE_KEY, today); } catch(e8) {}

    /* Reset WEEKLY on this computer, including the legacy fallback key so it
       cannot be re-imported by loadWeekly(). */
    try { gmSet(OWN_WEEKLY_KEY, empty); } catch(e9) {}
    try { gmSet(WEEKLY_KEY, empty); } catch(e10) {}
    try { gmSet(WEEKLY_PERIOD_KEY, week); } catch(e11) {}
    try { localStorage.setItem(OWN_WEEKLY_KEY, empty); } catch(e12) {}
    try { localStorage.setItem(WEEKLY_KEY, empty); } catch(e13) {}
    try { localStorage.setItem(WEEKLY_PERIOD_KEY, week); } catch(e14) {}

    /* Reset WEEKLY remote-display cache. */
    try { gmSet(REMOTE_WEEKLY_KEY, empty); } catch(e15) {}
    try { gmSet(REMOTE_WEEKLY_PERIOD_KEY, week); } catch(e16) {}
    try { localStorage.setItem(REMOTE_WEEKLY_KEY, empty); } catch(e17) {}
    try { localStorage.setItem(REMOTE_WEEKLY_PERIOD_KEY, week); } catch(e18) {}

    _dispHistCache = null;
    _dispWeekCache = null;

    gmSet(RESET_KEY, '1');
    try { localStorage.setItem(RESET_KEY, '1'); } catch(e19) {}
  }

  function cbtTrustedRateMigration() {
    var KEY = 'cbt_trusted_rate_migration_v23940';
    try {
      if (gmGet(KEY, null) || localStorage.getItem(KEY)) return;
    } catch(e0) {}

    /* Re-save local Today through the new sanitizer. */
    try {
      var h = null;
      var gh = gmGet(STORAGE_KEY, null);
      if (gh) h = typeof gh === 'string' ? JSON.parse(gh) : gh;
      if (!h) h = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (h && typeof h === 'object') {
        var cleanH = sanitizeHistory(h);
        var hJson = JSON.stringify(cleanH);
        gmSet(STORAGE_KEY, hJson);
        localStorage.setItem(STORAGE_KEY, hJson);
      }
    } catch(e1) {}

    /* Re-save local Weekly through the new sanitizer. */
    try {
      var wk = null;
      var gw = gmGet(OWN_WEEKLY_KEY, null);
      if (gw) wk = typeof gw === 'string' ? JSON.parse(gw) : gw;
      if (!wk) wk = JSON.parse(localStorage.getItem(OWN_WEEKLY_KEY) || '{}');
      if (wk && typeof wk === 'object') {
        var cleanW = sanitizeWeekly(wk);
        var wJson = JSON.stringify(cleanW);
        gmSet(OWN_WEEKLY_KEY, wJson);
        localStorage.setItem(OWN_WEEKLY_KEY, wJson);
      }
    } catch(e2) {}

    /* Legacy Fastest cleanup is retained only for backward compatibility.
       v23.9.74 reads the clean v2 Fastest namespace instead. */
    try {
      var peaks = hofLoadPeaks(), cleanP = {};
      for (var pk in peaks) {
        if (Number(peaks[pk] && peaks[pk].rate) > 0 &&
            Number(peaks[pk].rate) <= CBT_MAX_VALID_RATE) cleanP[pk] = peaks[pk];
      }
      hofSavePeaks(cleanP);

      var latest = hofLoadLatest(), cleanL = {};
      for (var lk in latest) {
        if (Number(latest[lk] && latest[lk].rate) > 0 &&
            Number(latest[lk].rate) <= CBT_MAX_VALID_RATE) cleanL[lk] = latest[lk];
      }
      hofSaveLatest(cleanL);
    } catch(e3) {}

    _dispHistCache = null;
    _dispWeekCache = null;

    gmSet(KEY, '1');
    try { localStorage.setItem(KEY, '1'); } catch(e4) {}
  }

  function runLegacyDataMigration() {
    /* v23.9.74 intentionally starts Today + Weekly clean. Do not import any
       pre-reset local history into the new shared generation. */
    if (gmGet('cbt_today_weekly_reset_v23948', null)) return;

    /* One-time migration kept exactly for compatibility with older installs. */
    var CLEAN_KEY = 'cbt_cleaned_v21_9';
    if (gmGet(CLEAN_KEY, null)) return;

    try {
      var oldWeekly = null;
      try {
        var gv = gmGet(WEEKLY_KEY, null);
        if (gv) oldWeekly = (typeof gv === 'string') ? JSON.parse(gv) : gv;
      } catch(e) {}
      if (!oldWeekly) {
        try { oldWeekly = JSON.parse(localStorage.getItem(WEEKLY_KEY) || '{}'); } catch(e2) {}
      }
      if (oldWeekly && Object.keys(oldWeekly).length > 0) {
        var cleanedOld = sanitizeWeekly(oldWeekly);
        if (Object.keys(cleanedOld).length > 0) {
          var json = JSON.stringify(cleanedOld);
          gmSet(OWN_WEEKLY_KEY, json);
          gmSet(WEEKLY_PERIOD_KEY, currentWeekStartStr());
          try {
            localStorage.setItem(OWN_WEEKLY_KEY, json);
            localStorage.setItem(WEEKLY_PERIOD_KEY, currentWeekStartStr());
          } catch(e3) {}
        }
      }
    } catch(e4) {}

    try {
      var oldHistory = null;
      try {
        var ghv = gmGet(STORAGE_KEY, null);
        if (ghv) oldHistory = (typeof ghv === 'string') ? JSON.parse(ghv) : ghv;
      } catch(e5) {}
      if (!oldHistory) {
        try { oldHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e6) {}
      }
      if (oldHistory && Object.keys(oldHistory).length > 0) {
        var cleanedHist = sanitizeHistory(oldHistory);
        if (Object.keys(cleanedHist).length > 0) {
          var hjson = JSON.stringify(cleanedHist);
          gmSet(STORAGE_KEY, hjson);
          try { localStorage.setItem(STORAGE_KEY, hjson); } catch(e7) {}
        }
      }
    } catch(e8) {}

    saveRemoteHistory({}, todayStr());
    saveRemoteWeekly({});
    gmSet(CLEAN_KEY, '1');
  }

  function installRouteHealth() {
    /* React immediately to real SPA route changes. Polling below is only a
       slower safety net for unusual route transitions the History patch misses. */
    function onRoute() {
      if (!isDashboardView()) detachMainPanel();
      _fastMountUntil = Date.now() + 15000;
      try { ensureSortAttachment(); } catch(e0) {}
      panelHealthCheck();
      taskPanelHealthCheck();
    }

    var _push = history.pushState, _repl = history.replaceState;
    history.pushState = function () {
      var r = _push.apply(this, arguments);
      onRoute();
      return r;
    };
    history.replaceState = function () {
      var r = _repl.apply(this, arguments);
      onRoute();
      return r;
    };

    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);

    var lastPath = location.pathname + location.hash;
    setInterval(function () {
      var now = location.pathname + location.hash;
      if (now !== lastPath) {
        lastPath = now;
        onRoute();
      }
    }, 500);

    setInterval(function () {
      if (document.hidden) return;
      if (boardIsMisplaced()) detachMainPanel();
    }, 1000);
  }

  function startCoreFeatures() {
    /* Style + visible UI mount happen together AFTER COMO has had a chance to
       paint its own page, so there is no unstyled flash and less competition
       with Angular's initial render. */
    try {
      if (!style.isConnected) document.head.appendChild(style);
    } catch(e) {}

    try {
      _uiScale = loadUiScale();
      _uiScaleLoaded = true;
    } catch(e2) {
      _uiScale = UI_SCALE_DEFAULT;
    }

    setInterval(panelHealthCheck, PANEL_HEALTH_MS);
    setInterval(taskPanelHealthCheck, PANEL_HEALTH_MS);

    _fastMountUntil = Date.now() + 60000;
    setInterval(function(){
      if (Date.now() > _fastMountUntil || document.hidden) return;

      /* Once the correct UI for the current page is mounted, the normal
         observers/2s health check are enough. Avoid duplicate 500ms scans. */
      if (isDashboardView()) {
        var mp = document.getElementById('cbt-panel');
        if (mp && mp.isConnected) return;
      } else if (shouldShowSearchPanel()) {
        var tp = document.getElementById('cbt-tp');
        if (tp && tp.isConnected) return;
      }

      try { panelHealthCheck(); taskPanelHealthCheck(); } catch(e3) {}
    }, 500);

    window.addEventListener('load', function(){
      try { panelHealthCheck(); taskPanelHealthCheck(); } catch(e4) {}
    });

    try {
      panelWatcher.observe(document.documentElement, { childList: true, subtree: true });
    } catch(e5) {}

    try { ensureSortAttachment(); } catch(e6) {}
    try { if (isDashboardView()) injectPanel(); } catch(e7) {}
    try { injectTaskPanel(); } catch(e8) {}
    installRouteHealth();

    /* Start associate-field autocomplete only after the main page has painted. */
    try { startAutocompleteWatch(); } catch(e9) {}

    /* Store-midnight Today reset is one scheduled timer, not a polling loop. */
    try { cbtStartTodayBoundaryClock(); } catch(e10) {}

    if (isComoSite()) {
      try {
        timerWatcher.observe(document.documentElement, { childList: true, subtree: true });
        injectAllTimers();

        /* Visible Time Left values still tick every second. The expensive
           whole-page safety scan is only every 5s; mutations are handled
           immediately and locally by timerWatcher above. */
        setInterval(function(){ try { tickTimers(); } catch(e10) {} }, 1000);
        setInterval(function(){
          if (document.hidden || !isDashboardView()) return;
          try { injectAllTimers(); } catch(e11) {}
        }, 5000);
      } catch(e12) {}

      /* Authoritative Live data + stats keep the same refresh cadence. */
      pollActiveTasks();
      fetchAndUpdate();
      setInterval(pollActiveTasks, POLL_MS);
      setInterval(tickLive, TICK_MS);
      setInterval(fetchAndUpdate, 1000);
    }
  }

  function startBackgroundFeatures() {
    /* These are important, but none of them needs to compete with the website's
       first paint. They are started after the visible board is already usable. */
    try { cbtResetTodayWeeklyV2(); } catch(eReset) {}
    try { cbtTrustedRateMigration(); } catch(e0) {}
    try { runLegacyDataMigration(); } catch(e) {}

    try { syncPull(function(){ syncPush(); }); } catch(e2) {}

    try { syncNamesFromAllTabs(); } catch(e3) {}
    try { scanLocalStorageForNames(); } catch(e4) {}

    setInterval(function(){
      if (document.hidden) return;
      cbtIdle(function(){
        if (document.hidden) return;
        if (syncNamesFromAllTabs() && activeTab === 'names') renderNames();
      }, 700);
    }, 5000);

    try { syncHistoryPull(function(){ syncHistoryPush(); }); } catch(e5) {}
    try { syncWeeklyPull(function(){ syncWeeklyPush(); }); } catch(e6) {}
    try { hofPull(); } catch(e7) {}

    setInterval(function(){ if (!document.hidden) syncPull(); }, 30000);
    setInterval(function(){ if (!document.hidden) syncHistoryPull(); }, 10000);
    setInterval(function(){ if (!document.hidden) syncWeeklyPull(); }, 10000);
    setInterval(function(){ if (!document.hidden) { try { hofPull(); } catch(e8) {} } }, 15000);

    /* When returning to the tab, refresh shared Today/Weekly immediately.
       Network work is asynchronous and the pull functions only touch the DOM
       when data actually changed. */
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) return;
      try { syncHistoryPull(); } catch(e9a) {}
      try { syncWeeklyPull(); } catch(e9b) {}
      try { syncPull(); } catch(e9c) {}
    });

    if (isComoSite()) {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: DRIVE_URL + '&_=' + Date.now(),
          responseType: 'json',
          onload: function(res) {
            if (res.status >= 200 && res.status < 300 && res.response) {
              batchRateCache = res.response[STORE_ID] || 200;
            }
            fetchAndUpdate();
          },
          onerror: function(){}
        });
      } catch(e9) {}
    }
  }

  function start() {
    if (_cbtStartupDone) return;
    _cbtStartupDone = true;
    MY_DEVICE_ID = getDeviceId();

    /* Core UI comes in just after the first two browser paints. */
    cbtAfterFirstPaint(startCoreFeatures, 120);

    /* Remote sync/storage scans are deliberately later and idle-scheduled. */
    cbtAfterFirstPaint(function(){
      cbtIdle(startBackgroundFeatures, 900);
    }, 650);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
