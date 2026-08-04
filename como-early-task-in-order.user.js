// ==UserScript==
// @name         COMO - Early Task In Order With Timer & Batcher Dashboard
// @namespace    https://github.com/uny2-ops
// @version      22.4.2
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
      background: #e8eef5; border-bottom: 1px solid var(--cb-border);
    }
    .cbt-stat-card {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
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
    }
    .cbt-stat-value {
      font-size: 28px; font-weight: 900; color: var(--cb-navy);
      font-family: var(--cb-mono); line-height: 1; letter-spacing: -0.02em;
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-stat-dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
      background: #aaa; flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
      transition: background 0.3s, box-shadow 0.3s;
    }

    /* ── Tabs ── */
    #cbt-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
    }
    .cbt-tab {
      flex: 1; text-align: center; padding: 9px 0; font-size: 11px;
      font-weight: 700; color: var(--cb-text2); cursor: pointer;
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
      font-size: 14px; font-weight: 700; color: var(--cb-text); cursor: pointer;
      transition: color 0.15s;
    }
    .cbt-assoc:hover { color: var(--cb-blue); }
    .cbt-ref { display: block; font-size: 10px; color: var(--cb-text3); font-family: var(--cb-mono); margin-top: 1px; }
    .cbt-elapsed {
      font-family: var(--cb-mono); font-size: 14px; font-weight: 700;
      font-variant-numeric: tabular-nums; color: var(--cb-green);
      background: rgba(0,200,83,0.08); padding: 2px 7px; border-radius: 4px;
      display: inline-block;
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
      padding: 2px 8px; border-radius: 4px; display: inline-block;
    }
    .cbt-hist-rate.good  { color: #0a6e2e; background: rgba(0,200,83,0.1); }
    .cbt-hist-rate.warn  { color: #7a4f00; background: rgba(255,171,0,0.12); }
    .cbt-hist-rate.alert { color: #8b0000; background: rgba(255,61,61,0.1); }
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
      display: inline-block; background: var(--cb-red); color: #fff;
      font-size: 9px; font-weight: 800; padding: 2px 6px;
      border-radius: 6px; margin-left: 6px; vertical-align: middle;
      letter-spacing: 0.06em; text-transform: uppercase;
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
    #cbt-names-search {
      padding: 8px 8px 4px; background: #f8fafc;
      border-bottom: 1px solid var(--cb-border);
      display: flex; align-items: center; gap: 6px;
    }
    #cbt-names-search-input {
      flex: 1; padding: 7px 12px 7px 32px; background-color: var(--cb-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 11px center;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      color: var(--cb-text); font-size: 13px; outline: none;
      font-family: var(--cb-sans);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #cbt-names-search-input:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(41,121,255,0.14);
    }
    #cbt-names-search-clear {
      font-size: 13px; border: none; background: none;
      cursor: pointer; color: var(--cb-text3);
      width: 24px; height: 24px; padding: 0; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    #cbt-names-search-clear:hover { color: var(--cb-red); background: rgba(255,61,61,0.1); }

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
    .cbt-search-row .cbt-hist-rate { font-size: 14px !important; display: inline; }

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
    #cbt-panel.dark #cbt-live-search, #cbt-panel.dark #cbt-names-search {
      background: #161b22 !important; border-bottom-color: #21262d !important;
    }
    #cbt-panel.dark #cbt-search-input, #cbt-panel.dark #cbt-hist-search-input,
    #cbt-panel.dark #cbt-live-search-input, #cbt-panel.dark #cbt-names-search-input {
      background-color: #0d1117 !important; border-color: #21262d !important; color: #c9d1d9 !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236e7b8d' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") !important;
    }
    #cbt-panel.dark #cbt-search-input:focus, #cbt-panel.dark #cbt-hist-search-input:focus,
    #cbt-panel.dark #cbt-live-search-input:focus, #cbt-panel.dark #cbt-names-search-input:focus {
      border-color: #58a6ff !important;
      box-shadow: 0 0 0 3px rgba(88,166,255,0.14) !important;
    }
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

    /* ── Copy confirmation ── */
    #cbt-copy-toast {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: linear-gradient(135deg,#00c853,#00a344); color: #fff;
      font: 800 13px/1 var(--cb-sans); letter-spacing: .02em;
      padding: 8px 13px; border-radius: 7px; white-space: nowrap;
      box-shadow: 0 5px 18px rgba(0,200,83,.45);
      opacity: 0; transform: translate(-50%, -4px);
      transition: opacity .16s ease-out, transform .16s ease-out;
    }
    #cbt-copy-toast.show { opacity: 1; transform: translate(-50%, -26px); }
    #cbt-copy-toast .cbt-ct-val {
      font-weight: 600; opacity: .85; margin-left: 6px;
      font-family: var(--cb-mono); font-size: 12px;
    }
    @keyframes cbt-copy-flash {
      0%   { background: rgba(0,200,83,.55); }
      60%  { background: rgba(0,200,83,.28); }
      100% { background: transparent; }
    }
    .cbt-copied-flash {
      animation: cbt-copy-flash .7s ease-out;
      border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,200,83,.4);
    }
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

    /* ── misc ── */
    .cbt-miss-dot { margin-left: 4px; font-size: 14px; vertical-align: middle; }
    .cbt-miss-dot.warn { color: var(--cb-amber); }
    .cbt-miss-dot.alert { color: var(--cb-red); }

    /* ══════════════════════════════════════
       QR CODE FROM SELECTED TEXT
    ══════════════════════════════════════ */
    #cbt-qr-overlay {
      position: fixed; inset: 0; z-index: 2147483646;
      background: rgba(13,27,42,0.45);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--cb-sans);
      animation: cbtFadeIn 0.15s ease-out;
    }
    #cbt-qr-card {
      background: #ffffff; border-radius: 14px; width: 400px;
      box-shadow: 0 20px 60px rgba(13,27,42,0.35), 0 4px 16px rgba(13,27,42,0.2);
      overflow: hidden;
    }
    #cbt-qr-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #f0f4f8;
      border-bottom: 1px solid var(--cb-border);
    }
    #cbt-qr-title {
      font-size: 13px; font-weight: 800; color: var(--cb-navy);
      letter-spacing: .05em; text-transform: uppercase;
      display: flex; align-items: center; gap: 8px;
    }
    #cbt-qr-title::before {
      content: ''; width: 3px; height: 14px;
      background: var(--cb-blue); border-radius: 2px;
    }
    #cbt-qr-close {
      cursor: pointer; border: none; background: none; color: var(--cb-text3);
      font-size: 15px; width: 26px; height: 26px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; padding: 0;
      transition: color .15s, background .15s;
    }
    #cbt-qr-close:hover { color: var(--cb-red); background: rgba(255,61,61,.1); }
    #cbt-qr-canvas-wrap { display: flex; align-items: center; justify-content: center; padding: 26px 26px 12px; }
    #cbt-qr-canvas { width: 324px; height: 324px; border-radius: 8px; }
    #cbt-qr-err { display: none; color: var(--cb-red); font-size: 12px; font-weight: 600; text-align: center; padding: 0 16px 8px; }
    #cbt-qr-input {
      display: block; width: calc(100% - 52px); box-sizing: border-box;
      margin: 0 26px 22px; padding: 15px 14px;
      border: 1.5px solid var(--cb-border); border-radius: 8px;
      font-size: 19px; font-weight: 700; letter-spacing: .02em;
      font-family: var(--cb-mono); color: var(--cb-text);
      outline: none; text-align: center;
      transition: border-color .15s, box-shadow .15s;
    }
    #cbt-qr-input:focus { border-color: var(--cb-blue); box-shadow: 0 0 0 3px rgba(41,121,255,.14); }

  `

  /* ══════════════════════════════════════════
     PART 1 — EARLIEST TASK SORTING
  ══════════════════════════════════════════ */
  var _sorting = false, _sortObserver = null, _attached = null;

  function getStoreTimezone() {
    var tzEl = document.querySelector('[class*="timezone"], [class*="time-zone"], .store-time, .current-time');
    if (tzEl) {
      var match = tzEl.textContent.match(/([A-Za-z]+\/[A-Za-z_]+)/);
      if (match) return match[1];
    }
    var bodyText = document.body ? document.body.innerHTML : '';
    var tzMatch = bodyText.match(/America\/[A-Za-z_]+/);
    if (tzMatch) return tzMatch[0];
    return 'America/New_York';
  }

  function parseTime(raw) {
    if (!raw) return null;
    var str = raw.replace(/[^\d:APMapm\s]/g, '').trim();
    var m = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    var h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
    var ap = m[3] ? m[3].toUpperCase() : null;
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    try {
      var tz = getStoreTimezone();
      var now = new Date();
      var dateStr = now.toLocaleDateString('en-CA', { timeZone: tz });
      var fullStr = dateStr + 'T' + String(h).padStart(2,'0') + ':' + String(mn).padStart(2,'0') + ':00';
      var result = new Date(fullStr + ' ' + Intl.DateTimeFormat('en-US', {
        timeZone: tz, timeZoneName: 'short'
      }).formatToParts(now).find(function(p){ return p.type === 'timeZoneName'; }).value).getTime();
      if (isNaN(result)) throw new Error('fallback');
      if (result > Date.now() + 8 * 3600000) result -= 86400000;
      return result;
    } catch(e) {
      var d = new Date(); d.setHours(h, mn, 0, 0);
      if (d.getTime() > Date.now() + 8 * 3600000) d.setDate(d.getDate() - 1);
      return d.getTime();
    }
  }

  function getBatchTarget(card) {
    var text = card.innerText || card.textContent || '';
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
  }

  function getContainer() {
    var c = document.querySelector('div.container-fluid.job-cards');
    if (c) return c;
    var first = document.querySelector('job-card');
    return first ? first.parentElement : null;
  }

  var bodyWatcher = new MutationObserver(function () {
    var c = getContainer(); if (c) attach(c);
  });
  /* Task sorting is COMO-only. isComoSite is hoisted, so it is safe here. */
  if (isComoSite()) {
    bodyWatcher.observe(document.documentElement, { childList: true, subtree: true });
    var c = getContainer(); if (c) attach(c);
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

  function isInExcludedSection(el) {
    var node = el;
    while (node && node !== document.body) {
      var prev = node.previousElementSibling;
      while (prev) {
        if (/partially\s*batched|staged\s*for\s*pickup/i.test(prev.textContent || '')) return true;
        prev = prev.previousElementSibling;
      }
      if (node.parentElement) {
        var parentPrev = node.parentElement.previousElementSibling;
        if (parentPrev && /partially\s*batched|staged\s*for\s*pickup/i.test(parentPrev.textContent || '')) return true;
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
    document.querySelectorAll('.etf-timeleft[data-target]').forEach(function (el) {
      var targetMs = parseInt(el.dataset.target, 10);
      if (!targetMs) return;
      var result = fmtTimeLeft(targetMs);
      el.textContent = result.text;
      el.className = 'etf-timeleft ' + result.cls;
    });
  }

  var timerWatcher = new MutationObserver(function () { injectAllTimers(); });

  /* ══════════════════════════════════════════
     PART 3 — BATCHERS + REMAINING PACKAGES
  ══════════════════════════════════════════ */
  var batchRateCache = 120;

  function updateStats(inProgress, remaining, recommended, dotColor) {
    var elIP  = document.getElementById('cbt-stat-ip');
    var elRem = document.getElementById('cbt-stat-rem');
    var elRec = document.getElementById('cbt-stat-rec');
    var elDot = document.getElementById('cbt-stat-dot');
    if (elIP)  elIP.textContent  = inProgress;
    if (elRem) elRem.textContent = remaining;
    if (elRec) elRec.textContent = recommended != null ? recommended : '—';
    if (elDot && dotColor) { elDot.style.background = dotColor; elDot.style.boxShadow = '0 0 6px ' + dotColor; }
    var old = document.getElementById('etf-ps-stats');
    if (old) old.remove();
  }

  function removeFromHeader() {
    var h1 = document.querySelector("h1[data-dtk-test-id='job-grid-title']");
    if (!h1) return;
    var old = h1.querySelector('#etf-stats');
    if (old) old.remove();
  }

  function fetchAndUpdate() {
    removeFromHeader();
    fetch(COMO_BASE + '/api/store/' + STORE_ID + '/activeJobSummary')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var inProgress = data.filter(function (j) { return j.operationState === 'IN_PROGRESS'; }).length;
        var activeJobs = data.filter(function (j) {
          return j.operationState === 'IN_PROGRESS' || j.operationState === 'NONE';
        });
        var expected  = activeJobs.reduce(function (s, j) { return s + (Number(j.totalExpectedPackages) || 0); }, 0);
        var batched   = activeJobs.reduce(function (s, j) { return s + (Number(j.packagesBatched) || 0); }, 0);
        var collected = activeJobs.reduce(function (s, j) { return s + (Number(j.packagesCollected) || 0); }, 0);
        var remaining = expected - (batched + collected);

        var latestTarget = Math.max.apply(null,
          data.filter(function(j){ return j.destinationType !== 'UNPACK'; })
              .map(function(j){ return Number(j.jobBatchTarget); })
              .filter(function(t){ return t > 0; })
        );
        var nowEpoch = Date.now() / 1000;
        var timeRemaining = (latestTarget - nowEpoch) / 3600;
        var adjustedTimeRemaining = timeRemaining;
        if (adjustedTimeRemaining <= 0) adjustedTimeRemaining = 0.5;

        var liveRates = [];
        taskCache.forEach(function(d) {
          if (d.state === 'BATCHING') {
            var r = computeRow(d);
            if (r.scanRate && r.scanRate > 0) liveRates.push(r.scanRate);
          }
        });
        var avgRatePerBatcher = liveRates.length > 0
          ? (liveRates.reduce(function(s,r){return s+r;},0) / liveRates.length) * 60
          : batchRateCache;
        if (avgRatePerBatcher < 60) avgRatePerBatcher = 120;

        var recommended = 0;
        if (remaining > 0 && avgRatePerBatcher > 0) {
          recommended = Math.ceil(remaining / (avgRatePerBatcher * adjustedTimeRemaining));
        }
        if (recommended < 0 || isNaN(recommended)) recommended = 0;
        if (recommended > 38) recommended = 38;

        var dotColor = 'gray';
        if (recommended >= 38)               dotColor = '#f85149';
        else if (inProgress === recommended) dotColor = '#3fb950';
        else if (inProgress < recommended)   dotColor = '#e3b341';
        else                                 dotColor = '#f85149';

        updateStats(inProgress, remaining, recommended, dotColor);
        removeFromHeader();
      }).catch(function () {});
  }

  /* ══════════════════════════════════════════
     PART 4 — BATCHER TIMER PANEL
  ══════════════════════════════════════════ */
  var POLL_MS = 2000, TICK_MS = 500;
  var WARN_ELAPSED_MIN = 15, ALERT_ELAPSED_MIN = 25;
  var WARN_RATE = 2.1, ALERT_RATE = 1.5;
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

  // ── Merge helper: sum per-device slices into a flat { assoc -> record } map ──
  // Basket format:  { devices: { devId: { assoc -> record }, ... }, legacy: { assoc -> record } }
  // "legacy" holds flat data pushed by older script versions (backward-compat)
  function mergeHistorySlices(basket) {
    var out = {};
    // Absorb legacy flat data first
    var legacy = (basket && basket.legacy) || {};
    for (var a in legacy) {
      var r = legacy[a];
      if (!out[a]) out[a] = { assoc: r.assoc||a, totalPkgs:0, totalSec:0, runs:0, totalMissing:0, totalExpected:0 };
      out[a].totalPkgs    += r.totalPkgs    || 0;
      out[a].totalSec     += r.totalSec     || 0;
      out[a].runs         += r.runs         || 0;
      out[a].totalMissing += r.totalMissing || 0;
      out[a].totalExpected+= r.totalExpected|| 0;
    }
    // Sum each device slice on top
    var devices = (basket && basket.devices) || {};
    for (var devId in devices) {
      var slice = devices[devId];
      for (var a2 in slice) {
        var r2 = slice[a2];
        if (!out[a2]) out[a2] = { assoc: r2.assoc||a2, totalPkgs:0, totalSec:0, runs:0, totalMissing:0, totalExpected:0 };
        out[a2].totalPkgs    += r2.totalPkgs    || 0;
        out[a2].totalSec     += r2.totalSec     || 0;
        out[a2].runs         += r2.runs         || 0;
        out[a2].totalMissing += r2.totalMissing || 0;
        out[a2].totalExpected+= r2.totalExpected|| 0;
      }
    }
    // Recompute avgRate from merged totals, cap corrupt values
    var cleanOut = {};
    for (var a3 in out) {
      var rec = out[a3];
      if ((rec.totalPkgs||0) > 50000 || (rec.runs||0) > 200) continue; // skip corrupted
      rec.avgRate = rec.totalSec > 0 ? rec.totalPkgs / (rec.totalSec / 60) : 0;
      if (rec.avgRate > 20) continue; // impossibly fast — corrupted
      cleanOut[a3] = rec;
    }
    return cleanOut;
  }

  function mergeWeeklySlices(basket) {
    // basket: { devices: { devId: { dayKey: { assoc -> record } } }, legacy: { dayKey: { assoc -> record } } }
    var out = {}; // dayKey -> { assoc -> record }
    var legacy = (basket && basket.legacy) || {};
    for (var dk in legacy) {
      if (!out[dk]) out[dk] = {};
      for (var a in legacy[dk]) {
        var r = legacy[dk][a];
        if (!out[dk][a]) out[dk][a] = { totalPkgs:0, totalSec:0, runs:0, totalMissing:0, totalExpected:0 };
        out[dk][a].totalPkgs    += r.totalPkgs    || 0;
        out[dk][a].totalSec     += r.totalSec     || 0;
        out[dk][a].runs         += r.runs         || 0;
        out[dk][a].totalMissing += r.totalMissing || 0;
        out[dk][a].totalExpected+= r.totalExpected|| 0;
      }
    }
    var devices = (basket && basket.devices) || {};
    for (var devId in devices) {
      var devData = devices[devId];
      for (var dk2 in devData) {
        if (!out[dk2]) out[dk2] = {};
        for (var a2 in devData[dk2]) {
          var r2 = devData[dk2][a2];
          if (!out[dk2][a2]) out[dk2][a2] = { totalPkgs:0, totalSec:0, runs:0, totalMissing:0, totalExpected:0 };
          out[dk2][a2].totalPkgs    += r2.totalPkgs    || 0;
          out[dk2][a2].totalSec     += r2.totalSec     || 0;
          out[dk2][a2].runs         += r2.runs         || 0;
          out[dk2][a2].totalMissing += r2.totalMissing || 0;
          out[dk2][a2].totalExpected+= r2.totalExpected|| 0;
        }
      }
    }
    return out;
  }

  // ── Firebase Realtime Database sync ──
  // All three syncs (names, today, weekly) use your Firebase project.
  // Names use PATCH — server-side merge means a push can never remove
  // another computer's names at the database level.
  // History and weekly use per-device PUT paths so each computer only
  // touches its own slice; pulls read the full tree and sum other devices.
  var FIREBASE_URL          = 'https://como-sync-default-rtdb.firebaseio.com';
  var FIREBASE_NAMES_PATH   = '/como_names.json';
  var FIREBASE_HISTORY_PATH = '/como_history.json';
  var FIREBASE_WEEKLY_PATH  = '/como_weekly.json';
  function syncEnabled()    { return true; }
  function syncUrl()        { return FIREBASE_URL + FIREBASE_NAMES_PATH; }
  function syncHistoryUrl() { return FIREBASE_URL + FIREBASE_HISTORY_PATH; }
  function syncWeeklyUrl()  { return FIREBASE_URL + FIREBASE_WEEKLY_PATH; }
  function syncHistoryDeviceUrl(devId) { return FIREBASE_URL + '/como_history/devices/' + devId + '.json'; }
  function syncWeeklyDeviceUrl(devId)  { return FIREBASE_URL + '/como_weekly/devices/'  + devId + '.json'; }

  // ── Own vs Remote cache keys ──
  // OWN = only this device's recorded batches (pushed to Pantry)
  // REMOTE_CACHE = sum of all OTHER devices' slices (rebuilt on pull, never pushed)
  var OWN_HISTORY_KEY      = 'cbt_own_history';
  var OWN_WEEKLY_KEY       = 'cbt_own_weekly';
  var REMOTE_HISTORY_KEY   = 'cbt_remote_history_cache';
  var REMOTE_WEEKLY_KEY    = 'cbt_remote_weekly_cache';

  var taskCache = new Map();
  var activeTab = 'live';
  var weeklySortKey = 'avgRate', weeklySortAsc = false, weeklySearchTerm = '';
  var liveSortKey = 'rate', liveSortAsc = false, liveSearchTerm = '';
  var historySortKey = 'avgRate', historySortAsc = false, historySearchTerm = '';
  var namesSearchTerm = '';
  var _allNamesCache = null;

  function todayStr() { return new Date().toLocaleDateString('en-US'); }
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
  function loadWeekly() {
    var result = {};
    try { var gm = gmGet(OWN_WEEKLY_KEY, null) || gmGet(WEEKLY_KEY, null); if (gm) result = (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e) {}
    try {
      var ls = JSON.parse(localStorage.getItem(OWN_WEEKLY_KEY) || localStorage.getItem(WEEKLY_KEY) || '{}');
      for (var dk in ls) {
        if (!result[dk]) result[dk] = {};
        for (var a in ls[dk]) { if (!result[dk][a]) result[dk][a] = ls[dk][a]; }
      }
    } catch(e) {}
    return result || {};
  }
  function saveWeekly(w, skipPush) {
    _dispWeekCache = null;
    var json = JSON.stringify(w);
    gmSet(OWN_WEEKLY_KEY, json);
    try { localStorage.setItem(OWN_WEEKLY_KEY, json); } catch(e) {}
    if (!skipPush) { setTimeout(function(){ if (typeof syncWeeklyPush === 'function') syncWeeklyPush(); }, 0); }
  }
  // Remote weekly cache — other devices' data summed on pull, NEVER pushed
  function loadRemoteWeekly() {
    try { var gm = gmGet(REMOTE_WEEKLY_KEY, null); if (gm) return (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e) {}
    try { return JSON.parse(localStorage.getItem(REMOTE_WEEKLY_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveRemoteWeekly(w) {
    _dispWeekCache = null;
    var json = JSON.stringify(w);
    gmSet(REMOTE_WEEKLY_KEY, json);
    try { localStorage.setItem(REMOTE_WEEKLY_KEY, json); } catch(e) {}
    // Never push — this is display-only aggregated data
  }
  // Display caches — avoid re-parsing JSON from storage on every keystroke/render.
  // Short TTL keeps date-rollover working; saves invalidate immediately.
  var _dispWeekCache = null, _dispWeekTime = 0;
  var _dispHistCache = null, _dispHistTime = 0;

  // Merge own + remote for display only
  function getDisplayWeekly() {
    var _now = Date.now();
    if (_dispWeekCache && (_now - _dispWeekTime) < 1500) return _dispWeekCache;
    var own    = sanitizeWeekly(loadWeekly());
    var remote = sanitizeWeekly(loadRemoteWeekly());
    var out = {};
    function addSlice(slice) {
      for (var dk in slice) {
        if (!out[dk]) out[dk] = {};
        for (var a in slice[dk]) {
          var r = slice[dk][a];
          if (!out[dk][a]) {
            out[dk][a] = { totalPkgs: r.totalPkgs||0, totalSec: r.totalSec||0, runs: r.runs||0,
              totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0 };
          } else {
            out[dk][a].totalPkgs    += r.totalPkgs    || 0;
            out[dk][a].totalSec     += r.totalSec     || 0;
            out[dk][a].runs         += r.runs         || 0;
            out[dk][a].totalMissing += r.totalMissing || 0;
            out[dk][a].totalExpected+= r.totalExpected|| 0;
          }
        }
      }
    }
    addSlice(own);
    addSlice(remote);
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
  var FONT_SCALE_KEY = 'cbt_font_scale';
  function loadFontScale() {
    var raw = gmGet(FONT_SCALE_KEY, null);
    if (raw == null) { try { raw = localStorage.getItem(FONT_SCALE_KEY); } catch(e) {} }
    var v = parseFloat(raw);
    if (!v || isNaN(v)) v = 1;
    return Math.min(2.0, Math.max(0.7, v));
  }
  function saveFontScale(v) {
    gmSet(FONT_SCALE_KEY, String(v));
    try { localStorage.setItem(FONT_SCALE_KEY, String(v)); } catch(e) {}
  }
  function applyFontScale(panel, scale) {
    if (!panel) return;
    ['#cbt-stats-bar', '#cbt-tabs', '#cbt-body'].forEach(function(sel){
      var el = panel.querySelector(sel);
      if (el) el.style.zoom = scale;
    });
  }

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
          onload: function(){},
          onerror: function(){ _histPushQueued = true; }
        });
      } catch(e) {}
    }, 2500);
  }
  function syncHistoryPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncHistoryUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          var changed = false;
          _histPulled = true;
          if (_histPushQueued) { _histPushQueued = false; syncHistoryPush(); }
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              var basket = JSON.parse(res.responseText);
              if (!basket || typeof basket !== 'object') return;
              var devId = MY_DEVICE_ID || getDeviceId();
              var devices = (basket.devices) || {};
              var remoteCache = {};
              for (var d in devices) {
                if (d === devId) continue;
                var slice = sanitizeHistory(devices[d]);
                for (var a in slice) {
                  var r = slice[a];
                  if (!remoteCache[a]) {
                    remoteCache[a] = { assoc: r.assoc||a, totalPkgs: r.totalPkgs||0,
                      totalSec: r.totalSec||0, runs: r.runs||0,
                      totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0 };
                  } else {
                    remoteCache[a].totalPkgs    += r.totalPkgs    || 0;
                    remoteCache[a].totalSec     += r.totalSec     || 0;
                    remoteCache[a].runs         += r.runs         || 0;
                    remoteCache[a].totalMissing += r.totalMissing || 0;
                    remoteCache[a].totalExpected+= r.totalExpected|| 0;
                  }
                }
              }
              for (var a2 in remoteCache) {
                remoteCache[a2].avgRate = remoteCache[a2].totalSec > 0
                  ? remoteCache[a2].totalPkgs / (remoteCache[a2].totalSec / 60) : 0;
              }
              saveRemoteHistory(remoteCache);
              changed = true;
              setTimeout(function(){ if (document.getElementById('cbt-hist-tbody')) renderHistory(); }, 200);
            }
          } catch(e) {}
          if (cb) cb(changed);
        },
        onerror: function(){
          if (!_histPulled && !_histFirstPullRetry) {
            _histFirstPullRetry = setTimeout(function(){ _histFirstPullRetry = null; syncHistoryPull(); }, 5000);
          }
          if (cb) cb(false);
        }
      });
    } catch(e) {
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
          onload: function(){},
          onerror: function(){ _weeklyPushQueued = true; }
        });
      } catch(e) {}
    }, 2500);
  }
  function syncWeeklyPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncWeeklyUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          var changed = false;
          _weeklyPulled = true;
          if (_weeklyPushQueued) { _weeklyPushQueued = false; syncWeeklyPush(); }
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
              var basket = JSON.parse(res.responseText);
              if (!basket || typeof basket !== 'object') return;
              var devId = MY_DEVICE_ID || getDeviceId();
              var devices = (basket.devices) || {};
              var remoteCache = {};
              for (var d in devices) {
                if (d === devId) continue;
                var slice = sanitizeWeekly(devices[d]);
                for (var dk in slice) {
                  if (!remoteCache[dk]) remoteCache[dk] = {};
                  for (var a in slice[dk]) {
                    var r = slice[dk][a];
                    if (!remoteCache[dk][a]) {
                      remoteCache[dk][a] = { totalPkgs: r.totalPkgs||0, totalSec: r.totalSec||0,
                        runs: r.runs||0, totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0 };
                    } else {
                      remoteCache[dk][a].totalPkgs    += r.totalPkgs    || 0;
                      remoteCache[dk][a].totalSec     += r.totalSec     || 0;
                      remoteCache[dk][a].runs         += r.runs         || 0;
                      remoteCache[dk][a].totalMissing += r.totalMissing || 0;
                      remoteCache[dk][a].totalExpected+= r.totalExpected|| 0;
                    }
                  }
                }
              }
              saveRemoteWeekly(remoteCache);
              changed = true;
              setTimeout(function(){ if (document.getElementById('cbt-weekly-tbody')) renderWeekly(); }, 200);
            }
          } catch(e) {}
          if (cb) cb(changed);
        },
        onerror: function(){
          if (!_weeklyPulled && !_weeklyFirstPullRetry) {
            _weeklyFirstPullRetry = setTimeout(function(){ _weeklyFirstPullRetry = null; syncWeeklyPull(); }, 5000);
          }
          if (cb) cb(false);
        }
      });
    } catch(e) {
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
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0,0,0,0);
    // Prune own store
    var w = loadWeekly();
    var changed = false;
    for (var dk of Object.keys(w)) {
      if (new Date(dk) < cutoff) { delete w[dk]; changed = true; }
    }
    if (changed) saveWeekly(w, true);
    // Prune remote cache
    var rc = loadRemoteWeekly();
    var rcChanged = false;
    for (var dk2 of Object.keys(rc)) {
      if (new Date(dk2) < cutoff) { delete rc[dk2]; rcChanged = true; }
    }
    if (rcChanged) saveRemoteWeekly(rc);
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
            avgRate: d2.avgRate, totalMissing: d2.totalMissing||0, totalExpected: d2.totalExpected||0 };
        }
      }
      saveWeekly(w);
    } catch(e) {}
  }

  function sanitizeHistory(h) {
    var clean = {};
    for (var a in h) {
      var e = h[a];
      var pkgs = e.totalPkgs || 0;
      var runs = e.runs || 0;
      var sec  = e.totalSec || 0;
      // Only reject clearly overflowed values — keep realistic ones
      if (pkgs > 50000 || runs > 300) continue;
      // Reject impossible rate (>20 bags/min) but only if we have meaningful time
      if (sec > 60 && (pkgs / (sec / 60)) > 20) continue;
      clean[a] = e;
    }
    return clean;
  }

  function loadHistory() {
    try {
      var sd = localStorage.getItem(DATE_KEY) || gmGet(DATE_KEY, null);
      if (sd !== todayStr()) {
        rollDailyIntoWeekly();
        localStorage.removeItem(STORAGE_KEY); gmSet(STORAGE_KEY, '{}');
        localStorage.setItem(DATE_KEY, todayStr()); gmSet(DATE_KEY, todayStr());
        return {};
      }
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
    var json = JSON.stringify(h);
    localStorage.setItem(STORAGE_KEY, json); localStorage.setItem(DATE_KEY, todayStr());
    gmSet(STORAGE_KEY, json); gmSet(DATE_KEY, todayStr());
    if (!skipPush) { setTimeout(function(){ if (typeof syncHistoryPush === 'function') syncHistoryPush(); }, 0); }
  }
  // Remote history cache — other devices' data summed on pull, NEVER pushed
  function loadRemoteHistory() {
    try { var gm = gmGet(REMOTE_HISTORY_KEY, null); if (gm) return (typeof gm === 'string') ? JSON.parse(gm) : gm; } catch(e) {}
    try { return JSON.parse(localStorage.getItem(REMOTE_HISTORY_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveRemoteHistory(h) {
    _dispHistCache = null;
    var json = JSON.stringify(h);
    gmSet(REMOTE_HISTORY_KEY, json);
    try { localStorage.setItem(REMOTE_HISTORY_KEY, json); } catch(e) {}
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
            runs: r.runs||0, totalMissing: r.totalMissing||0, totalExpected: r.totalExpected||0 };
        } else {
          out[a].totalPkgs    += r.totalPkgs    || 0;
          out[a].totalSec     += r.totalSec     || 0;
          out[a].runs         += r.runs         || 0;
          out[a].totalMissing += r.totalMissing || 0;
          out[a].totalExpected+= r.totalExpected|| 0;
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
     COPY TO CLIPBOARD + VISUAL CONFIRMATION
  ══════════════════════════════════════ */
  var _ctEl = null, _ctTimer = null;

  function showCopyToast(x, y, label) {
    if (!_ctEl) {
      _ctEl = document.createElement('div');
      _ctEl.id = 'cbt-copy-toast';
      document.body.appendChild(_ctEl);
    }
    var shown = label.length > 24 ? label.slice(0, 22) + '\u2026' : label;
    _ctEl.innerHTML = '\u2713 Copied<span class="cbt-ct-val">' + shown + '</span>';
    /* keep the toast on-screen near the click */
    var px = Math.max(70, Math.min(window.innerWidth - 70, x));
    var py = Math.max(30, y);
    _ctEl.style.left = px + 'px';
    _ctEl.style.top  = py + 'px';
    _ctEl.classList.remove('show');
    void _ctEl.offsetWidth;               /* restart the transition */
    _ctEl.classList.add('show');
    clearTimeout(_ctTimer);
    _ctTimer = setTimeout(function(){ if (_ctEl) _ctEl.classList.remove('show'); }, 1150);
  }

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

  function computeRow(data) {
    var op = (data.operationDetails||[]).find(function(o){return o.name==='BATCHING';});
    var startMs = op&&op.start ? op.start*1000 : data.created ? data.created*1000 : null;
    var inProg = (op&&op.state==='IN_PROGRESS')||data.state==='BATCHING';
    var batchedN = data.packagesBatched||0;
    var elapsedSec = startMs ? (Date.now()-startMs)/1000 : null;
    var scanRate = (batchedN>0&&elapsedSec>30) ? batchedN/(elapsedSec/60) : null;
    return { startMs:startMs, elapsedSec:elapsedSec, scanRate:scanRate, inProgress:inProg };
  }

  function recordCompletedBatch(data, elapsedSec) {
    if (!data.associateId&&!data.associate) return;
    var pkgs = data.packagesBatched||0;
    if (pkgs===0||!elapsedSec||elapsedSec<30) return;
    var assoc = data.associateId||data.associate;
    captureName(data);
    var rate = pkgs/(elapsedSec/60);
    var expected = data.totalExpectedPackages||0;
    var collected = data.packagesCollected||data.packagesBatched||0;
    var missing = expected>collected ? expected-collected : 0;
    var history = loadHistory();
    if (history[assoc]) {
      var e2=history[assoc], tp=e2.totalPkgs+pkgs, ts=e2.totalSec+elapsedSec;
      history[assoc] = { assoc:assoc, totalPkgs:tp, totalSec:ts, runs:e2.runs+1,
        avgRate:tp/(ts/60), lastRate:rate, totalMissing:(e2.totalMissing||0)+missing, totalExpected:(e2.totalExpected||0)+expected };
    } else {
      history[assoc] = { assoc:assoc, totalPkgs:pkgs, totalSec:elapsedSec, runs:1,
        avgRate:rate, lastRate:rate, totalMissing:missing, totalExpected:expected };
    }
    saveHistory(history);
    if (activeTab==='history') renderHistory();
  }

  function ingestItem(item) {
    if (!item||typeof item!=='object') return false;
    var ref = item.shortClientRef; if (!ref) return false;
    var existing = taskCache.get(ref);
    if (existing&&existing.state==='BATCHING'&&item.state!=='BATCHING'&&item.state!==undefined) {
      existing._recording=true; taskCache.set(ref,existing);
      var merged=Object.assign({},existing,item), r=computeRow(merged);
      recordCompletedBatch(merged,r.elapsedSec); taskCache.delete(ref); return true;
    }
    if (item.state!=='BATCHING'&&item.operationState!=='IN_PROGRESS') return false;
    if (!item.associateId && !item.associate && item.driverAssignment) {
      item.associate = item.driverAssignment;
    }
    taskCache.set(ref,item); return true;
  }

  function ingestData(d) {
    if (!d) return; var changed=false;
    deepCaptureNames(d, 0);
    if (Array.isArray(d)) { d.forEach(function(i){if(ingestItem(i))changed=true;}); }
    else if (d.shortClientRef) { if(ingestItem(d))changed=true; }
    else { for(var k of ['summaries','tasks','results','items','jobs','data']) { if(Array.isArray(d[k])){d[k].forEach(function(i){if(ingestItem(i))changed=true;});if(changed)break;}}}
    if (changed) renderLive();
  }

  var _origFetch = window.fetch;
  window.fetch = async function() {
    var resp; try { resp = await _origFetch.apply(this,arguments); } catch(e){throw e;}
    try { if((resp.headers.get('content-type')||'').includes('json')){resp.clone().json().then(function(d){ingestData(d);}).catch(function(){});} } catch(e){}
    return resp;
  };
  var _xhrOpen=XMLHttpRequest.prototype.open, _xhrSend=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,url){this._cbtUrl=url;return _xhrOpen.apply(this,arguments);};
  XMLHttpRequest.prototype.send=function(){
    this.addEventListener('load',function(){try{if(!(this.getResponseHeader('content-type')||'').includes('json'))return;ingestData(JSON.parse(this.responseText));}catch(e){}});
    return _xhrSend.apply(this,arguments);
  };

  async function pollActiveTasks() {
    try {
      var res = await _origFetch(COMO_BASE+'/store/'+STORE_ID+'/activeJobsWithSiteSummary',{credentials:'include',headers:{Accept:'application/json'}});
      if(res.ok) {
        var freshData = await res.json();
        var activeRefs = new Set();
        var items = Array.isArray(freshData) ? freshData : [];
        ['summaries','tasks','results','items','jobs','data'].forEach(function(k){
          if(Array.isArray(freshData[k])) items = items.concat(freshData[k]);
        });
        items.forEach(function(d){
          if(d.shortClientRef && d.state==='BATCHING') activeRefs.add(d.shortClientRef);
        });
        taskCache.forEach(function(val, key) {
          if(!activeRefs.has(key)) taskCache.delete(key);
        });
        ingestData(freshData);
      }
    } catch(e){}
    renderLive();
  }

  function buildPanel() {
    var panel2 = document.createElement('div');
    panel2.id = 'cbt-panel';
    panel2.innerHTML =
      '<div id="cbt-header">' +
        '<span id="cbt-title">Batcher Timers</span>' +
        '<div id="cbt-controls">' +
          '<span id="cbt-font-dec" title="Smaller text">A−</span>' +
          '<span id="cbt-font-inc" title="Larger text">A+</span>' +
          '<span id="cbt-theme-btn" title="Toggle Dark/Light">🌙</span>' +
          '<span id="cbt-collapse-btn" title="Collapse/Expand">🔼</span>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-stats-bar">' +
        '<div class="cbt-stat-card">' +
          '<div class="cbt-stat-icon">\uD83E\uDDBA</div>' +
          '<div class="cbt-stat-label">Batchers</div>' +
          '<div class="cbt-stat-value" id="cbt-stat-ip">\u2014</div>' +
        '</div>' +
        '<div class="cbt-stat-card">' +
          '<div class="cbt-stat-icon">\uD83D\uDCCA</div>' +
          '<div class="cbt-stat-label">Recommended</div>' +
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
        '<span class="cbt-tab" data-tab="names">Names</span>' +
      '</div>' +
      '<div id="cbt-body">' +
        '<div id="cbt-live-view">' +
          '<div id="cbt-live-search"><input id="cbt-live-search-input" type="text" placeholder="Search any associate..."/><button id="cbt-live-search-clear">✕</button></div>' +
          '<table id="cbt-table" style="table-layout:fixed;width:100%;"><thead><tr>' +
            '<th class="cbt-sortable-live" data-sort="assoc" style="width:40%;text-align:left;">Associate</th>' +
            '<th class="cbt-sortable-live" data-sort="elapsed" style="width:30%;text-align:center;">Elapsed</th>' +
            '<th class="cbt-sortable-live" data-sort="rate" style="width:30%;text-align:center;">Bags/min \u25BC</th>' +
          '</tr></thead><tbody id="cbt-tbody"></tbody></table>' +
          '<div id="cbt-empty">No active batching tasks</div>' +
          '<div id="cbt-live-results"></div>' +
          '<div id="cbt-updated"></div>' +
        '</div>' +
        '<div id="cbt-history-view" style="display:none">' +
          '<div id="cbt-hist-search"><input id="cbt-hist-search-input" type="text" placeholder="Search associate..."/><button id="cbt-hist-search-clear">✕</button></div>' +
          '<div id="cbt-hist-summary"></div>' +
          '<table id="cbt-hist-table"><thead><tr>' +
            '<th class="cbt-sortable-hist" data-sort="assoc">Associate</th>' +
            '<th class="cbt-sortable-hist" data-sort="runs">Runs</th>' +
            '<th class="cbt-sortable-hist" data-sort="pkgs">Pkgs</th>' +
            '<th class="cbt-sortable-hist" data-sort="avgRate">Avg Rate \u25BC</th>' +
          '</tr></thead><tbody id="cbt-hist-tbody"></tbody></table>' +
          '<div id="cbt-hist-empty">No history yet today</div>' +
          '<div id="cbt-hist-cross"></div>' +
        '</div>' +
        '<div id="cbt-weekly-view" style="display:none">' +
          '<div id="cbt-weekly-search"><input id="cbt-search-input" style="flex:1;" type="text" placeholder="Search associate..."/><button id="cbt-weekly-search-clear">✕</button></div>' +
          '<div id="cbt-weekly-summary"></div>' +
          '<table id="cbt-weekly-table"><thead><tr>' +
            '<th class="cbt-sortable" data-sort="assoc">Associate</th>' +
            '<th class="cbt-sortable" data-sort="days">Days</th>' +
            '<th class="cbt-sortable" data-sort="runs">Runs</th>' +
            '<th class="cbt-sortable" data-sort="pkgs">Pkgs</th>' +
            '<th class="cbt-sortable" data-sort="avgRate">Avg Rate \u25BC</th>' +
            '<th class="cbt-sortable" data-sort="hrs">Hrs</th>' +
          '</tr></thead><tbody id="cbt-weekly-tbody"></tbody></table>' +
          '<div id="cbt-weekly-empty">No weekly data yet</div>' +
          '<div id="cbt-weekly-cross"></div>' +
        '</div>' +
        '<div id="cbt-names-view" style="display:none">' +
          '<div id="cbt-names-search"><input id="cbt-names-search-input" style="flex:1;" type="text" placeholder="Search saved names..."/><button id="cbt-names-search-clear">✕</button></div>' +
          '<div id="cbt-names-count" style="text-align:center;font-size:12px;color:#5a7a96;padding:2px 0 4px;font-weight:600;"></div>' +
          '<table id="cbt-names-table"><thead><tr>' +
            '<th style="text-align:left;">Associate (saved permanently)</th>' +
          '</tr></thead><tbody id="cbt-names-tbody"></tbody></table>' +
          '<div id="cbt-names-empty" style="display:none;text-align:center;color:#aaa;padding:9px 0;font-size:13px;font-style:italic;line-height:1.2;">No names saved yet</div>' +
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
  function shouldShowSearchPanel() {
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
      var body0  = _panel2Ref.querySelector('#cbt-body');
      var tabs0  = _panel2Ref.querySelector('#cbt-tabs');
      if (savedH && body0) {
        var h0 = parseFloat(savedH);
        body0.style.height    = h0 + 'px';
        body0.style.maxHeight = h0 + 'px';
        if (tabs0) tabs0.style.display = h0 === 0 ? 'none' : '';
      }
    } catch(ex) {}

    mount.el.parentNode.insertBefore(_panel2Ref, mount.el);

    _mountFails = 0;              /* mounted successfully */
    clearAutoReloadCount();       /* board is up — reset the reload budget */
    renderLive();
    renderHistory();
    renderWeekly();
    renderNames();
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

  function attachPanelEvents(panel2) {
    panel2.querySelectorAll('.cbt-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        panel2.querySelectorAll('.cbt-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        var lsi = document.getElementById('cbt-live-search-input');
        var hsi = document.getElementById('cbt-hist-search-input');
        var wsi = document.getElementById('cbt-search-input');
        var nsi = document.getElementById('cbt-names-search-input');
        if (lsi) { lsi.value = ''; liveSearchTerm = ''; }
        if (hsi) { hsi.value = ''; historySearchTerm = ''; }
        if (wsi) { wsi.value = ''; weeklySearchTerm = ''; }
        if (nsi) { nsi.value = ''; namesSearchTerm = ''; }
        var lr = document.getElementById('cbt-live-results');
        if (lr) lr.innerHTML = '';
        document.getElementById('cbt-live-view').style.display    = activeTab==='live'    ? '' : 'none';
        document.getElementById('cbt-history-view').style.display = activeTab==='history' ? '' : 'none';
        document.getElementById('cbt-weekly-view').style.display  = activeTab==='weekly'  ? '' : 'none';
        document.getElementById('cbt-names-view').style.display   = activeTab==='names'   ? '' : 'none';
        if (activeTab==='history') renderHistory();
        if (activeTab==='weekly')  renderWeekly();
        if (activeTab==='live')    renderLive();
        if (activeTab==='names')   renderNames();
      });
    });

    var isCollapsed = false;
    var collapseBtn = panel2.querySelector('#cbt-collapse-btn');
    collapseBtn.addEventListener('click', function() {
      var body = panel2.querySelector('#cbt-body');
      var tabs = panel2.querySelector('#cbt-tabs');
      var drag = panel2.querySelector('#cbt-drag-bottom');
      var savedH = parseFloat(localStorage.getItem('cbt_body_h') || '350');

      if (isCollapsed) {
        isCollapsed = false;
        if (body) { body.style.display = ''; body.style.height = '350px'; body.style.maxHeight = '350px'; body.style.minHeight = '350px'; }
        if (tabs) tabs.style.display = '';
        if (drag) drag.style.display = '';
        collapseBtn.textContent = '🔼';
        try { localStorage.setItem('cbt_body_h', 350); } catch(ex) {}
      } else if (savedH > 350) {
        if (body) { body.style.height = '350px'; body.style.maxHeight = '350px'; body.style.minHeight = '350px'; }
        collapseBtn.textContent = '🔼';
        try { localStorage.setItem('cbt_body_h', 350); } catch(ex) {}
      } else {
        isCollapsed = true;
        if (body) { body.style.display = 'none'; body.style.minHeight = '0'; }
        if (tabs) tabs.style.display = 'none';
        if (drag) drag.style.display = 'none';
        collapseBtn.textContent = '🔽';
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
    });

    var _fontScale = loadFontScale();
    applyFontScale(panel2, _fontScale);
    var fontIncBtn = panel2.querySelector('#cbt-font-inc');
    var fontDecBtn = panel2.querySelector('#cbt-font-dec');
    if (fontIncBtn) fontIncBtn.addEventListener('click', function() {
      _fontScale = Math.min(2.0, Math.round((_fontScale + 0.1) * 10) / 10);
      saveFontScale(_fontScale); applyFontScale(panel2, _fontScale);
    });
    if (fontDecBtn) fontDecBtn.addEventListener('click', function() {
      _fontScale = Math.max(0.7, Math.round((_fontScale - 0.1) * 10) / 10);
      saveFontScale(_fontScale); applyFontScale(panel2, _fontScale);
    });

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
      try { localStorage.setItem('cbt_body_h', newH); } catch(ex) {}
    });
    document.addEventListener('mouseup', function() { isDragging = false; });

    try {
      var savedH = localStorage.getItem('cbt_body_h');
      if (savedH) {
        var body = panel2.querySelector('#cbt-body');
        var tabs = panel2.querySelector('#cbt-tabs');
        var h = parseFloat(savedH);
        if (body) { body.style.height = h + 'px'; body.style.maxHeight = h + 'px'; }
        if (tabs) tabs.style.display = h === 0 ? 'none' : '';
      }
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
      if (e.target.id === 'cbt-live-search-clear') {
        var inp = document.getElementById('cbt-live-search-input');
        if (inp) { inp.value = ''; liveSearchTerm = ''; renderLive(); renderLiveSearch(''); }
      }
      if (e.target.id === 'cbt-hist-search-clear') {
        var inp2 = document.getElementById('cbt-hist-search-input');
        if (inp2) { inp2.value = ''; historySearchTerm = ''; renderHistory(); }
      }
      if (e.target.id === 'cbt-weekly-search-clear') {
        var inp3 = document.getElementById('cbt-search-input');
        if (inp3) { inp3.value = ''; weeklySearchTerm = ''; renderWeekly(); }
      }
      if (e.target.id === 'cbt-names-search-clear') {
        var inp4 = document.getElementById('cbt-names-search-input');
        if (inp4) { inp4.value = ''; namesSearchTerm = ''; renderNames(); }
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
      if (e.target.id==='cbt-search-input') { weeklySearchTerm=e.target.value; renderWeekly(); }
      if (e.target.id==='cbt-hist-search-input') { historySearchTerm=e.target.value; renderHistory(); }
      if (e.target.id==='cbt-live-search-input') { liveSearchTerm=e.target.value; renderLive(); renderLiveSearch(e.target.value); }
      if (e.target.id==='cbt-names-search-input') { namesSearchTerm=e.target.value; renderNames(); }
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
        if(liveSortKey===key2){liveSortAsc=!liveSortAsc;}else{liveSortKey=key2;liveSortAsc=false;}
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
    if (!term || term.trim() === '') { resultsEl.innerHTML = ''; return; }
    term = term.toLowerCase().trim();
    var html = '';
    var shown = new Set();

    var history = getDisplayHistory(), histEntries = Object.values(history).filter(function(e){ return e.assoc && e.assoc.toLowerCase().indexOf(term) !== -1; });
    if (histEntries.length > 0) {
      html += '<div class="cbt-search-result-section">📅 Today</div>';
      histEntries.forEach(function(e) {
        shown.add(e.assoc.toLowerCase());
        var rateCls = e.avgRate >= WARN_RATE ? 'good' : e.avgRate >= ALERT_RATE ? 'warn' : 'alert';
        html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + e.assoc + '</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.runs + '</span> runs | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
        '<span class="cbt-search-row-rate cbt-hist-rate ' + rateCls + '">' + e.avgRate.toFixed(1) + '</span></div>';
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
    var weeklyEntries = Object.values(agg);
    if (weeklyEntries.length > 0) {
      html += '<div class="cbt-search-result-section">📆 Weekly</div>';
      weeklyEntries.forEach(function(e) {
        shown.add(e.assoc.toLowerCase());
        var avgRate = e.totalPkgs / (e.totalSec / 60);
        var rateCls = avgRate >= WARN_RATE ? 'good' : avgRate >= ALERT_RATE ? 'warn' : 'alert';
        html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + e.assoc + '</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.daysSet.size + '</span> days | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
        '<span class="cbt-search-row-rate cbt-hist-rate ' + rateCls + '">' + avgRate.toFixed(1) + '</span></div>';
      });
    }

    html += savedNamesSearchHTML(term, shown);

    if (html === '') html = '<div style="text-align:center;color:#aaa;padding:10px;font-style:italic;font-size:14px;">No results found for "' + term + '"</div>';
    setHTML(resultsEl, html);
  }

  function renderLive() {
    var tbody=document.querySelector('#cbt-tbody'), empty=document.querySelector('#cbt-empty');
    if (!tbody||!empty) return;
    var lowerTerm = liveSearchTerm ? liveSearchTerm.toLowerCase() : '';
    // Compute each row's stats once — previously computeRow ran inside the sort
    // comparator (O(n log n) calls) and again in the render loop.
    var rows=[]; taskCache.forEach(function(d){
      if(d.state==='BATCHING') {
        if (lowerTerm) {
          var name = (d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'').toLowerCase();
          if (name.indexOf(lowerTerm) === -1) return;
        }
        rows.push({ d: d, r: computeRow(d) });
      }
    });
    rows.sort(function(A,B){
      var a=A.d, b=B.d, ra=A.r, rb=B.r;
      var slowA = ra.scanRate && ra.scanRate < ALERT_RATE && (ra.elapsedSec||0) > 120;
      var slowB = rb.scanRate && rb.scanRate < ALERT_RATE && (rb.elapsedSec||0) > 120;
      if (slowA && !slowB) return -1;
      if (!slowA && slowB) return 1;
      if (slowA && slowB) return (ra.scanRate||0) - (rb.scanRate||0);
      var va, vb;
      if(liveSortKey==='assoc'){va=(a.associateId||a.associate||'').toLowerCase();vb=(b.associateId||b.associate||'').toLowerCase();return liveSortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(liveSortKey==='rate'){va=ra.scanRate||0;vb=rb.scanRate||0;}
      else{va=ra.elapsedSec||0;vb=rb.elapsedSec||0;}
      return liveSortAsc?va-vb:vb-va;
    });
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
      var slowAlert=(r.scanRate!==null&&r.scanRate<ALERT_RATE&&r.elapsedSec>120)?'<span class="cbt-slow-alert">⚠ SLOW</span>':'';
      html+='<tr><td><span class="cbt-assoc">'+assoc+'</span>'+slowAlert+'<span class="cbt-ref">'+shortRef+'</span></td>';
      html+='<td><span class="cbt-elapsed '+elCls+'" data-start="'+(r.startMs||'')+'" data-live="'+(r.inProgress?'1':'0')+'">'+elTxt+'</span></td>';
      html+='<td><span class="cbt-rate '+rateCls+'">'+rateTxt+'</span></td></tr>';
    }
    setHTML(tbody, html);
    var upd=document.querySelector('#cbt-updated');
    if(upd) upd.textContent='updated '+new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
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
      var oR=entries.reduce(function(s,e){return s+e.totalPkgs;},0)/(tS/60);
      var tMissing=entries.reduce(function(s,e){return s+(e.totalMissing||0);},0);
      var tExpected=entries.reduce(function(s,e){return s+(e.totalExpected||0);},0);
      var avgMissPct=tExpected>0?(tMissing/tExpected*100):0;
      summary.innerHTML='<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tA+'</span><span class="cbt-ws-label">Batchers</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+oR.toFixed(1)+'</span><span class="cbt-ws-label">Avg Rate</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+avgMissPct.toFixed(1)+'%</span><span class="cbt-ws-label">Avg Miss %</span></div>';
    }
    var filtered=entries;
    if(historySearchTerm){var term=historySearchTerm.toLowerCase();filtered=entries.filter(function(e){return e.assoc.toLowerCase().indexOf(term)!==-1;});}
    filtered.sort(function(a,b){
      var va,vb;
      if(historySortKey==='assoc'){va=a.assoc.toLowerCase();vb=b.assoc.toLowerCase();return historySortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(historySortKey==='runs'){va=a.runs;vb=b.runs;}
      else if(historySortKey==='pkgs'){va=a.totalPkgs;vb=b.totalPkgs;}
      else{va=a.avgRate;vb=b.avgRate;}
      return historySortAsc?va-vb:vb-va;
    });
    var html='';
    for(var i=0;i<filtered.length;i++){
      var e=filtered[i],rateCls=e.avgRate>=WARN_RATE?'good':e.avgRate>=ALERT_RATE?'warn':'alert';
      var rankCls=i===0?'gold':i===1?'silver':i===2?'bronze':'';
      html+='<tr><td><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+(i+1)+'</span>'+e.assoc+'</span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.runs+'</span></td><td><span class="cbt-hist-meta">'+e.totalPkgs+'</span></td>';
      html+='<td><span class="cbt-hist-rate '+rateCls+'">'+e.avgRate.toFixed(1)+'</span></td></tr>';
    }
    setHTML(tbody, html);

    if(historySearchTerm) renderHistoryCrossSearch(historySearchTerm);
    else {
      var cross = document.getElementById('cbt-hist-cross');
      if(cross) cross.innerHTML='';
    }
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
    var entries = Object.values(agg);
    var shown = new Set();
    var todayHist = getDisplayHistory();
    Object.values(todayHist).forEach(function(e){ if(e.assoc.toLowerCase().indexOf(term)!==-1) shown.add(e.assoc.toLowerCase()); });
    var html='';
    if(entries.length>0){
      html+='<div class="cbt-search-result-section">📆 Also in Weekly</div>';
      entries.forEach(function(e){
        shown.add(e.assoc.toLowerCase());
        var avgRate=e.totalPkgs/(e.totalSec/60);
        var rateCls=avgRate>=WARN_RATE?'good':avgRate>=ALERT_RATE?'warn':'alert';
        html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+e.assoc+'</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.daysSet.size+'</span> days | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>' +
        '<span class="cbt-search-row-rate cbt-hist-rate '+rateCls+'">'+avgRate.toFixed(1)+'</span></div>';
      });
    }
    html += savedNamesSearchHTML(term, shown);
    setHTML(crossEl, html);
  }

  function sanitizeWeekly(w) {
    var clean = {};
    for (var dk in w) {
      clean[dk] = {};
      for (var a in w[dk]) {
        var e = w[dk][a];
        if ((e.totalPkgs||0) > 50000 || (e.runs||0) > 300) continue;
        var sec = e.totalSec || 0;
        if (sec > 60 && (e.totalPkgs||0) / (sec / 60) > 20) continue;
        clean[dk][a] = e;
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
        if(!agg[assoc])agg[assoc]={assoc:assoc,totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,daysSet:new Set()};
        agg[assoc].totalPkgs+=d3.totalPkgs;agg[assoc].totalSec+=d3.totalSec;agg[assoc].runs+=d3.runs;
        agg[assoc].totalMissing+=(d3.totalMissing||0);agg[assoc].totalExpected+=(d3.totalExpected||0);agg[assoc].daysSet.add(dayKey);
      }
    }
    var all=Object.values(agg).map(function(a){
      // Sanity cap: real-world max ~2000 pkgs/run, ~500 runs/week, ~100000 pkgs total
      var pkgs = Math.min(a.totalPkgs, 100000);
      var sec  = Math.min(a.totalSec,  500*3600);
      var runs = Math.min(a.runs, 500);
      return{assoc:a.assoc,totalPkgs:pkgs,totalSec:sec,runs:runs,days:a.daysSet.size,avgRate:sec>0?pkgs/(sec/60):0,hrs:sec,missPct:a.totalExpected>0?(a.totalMissing/a.totalExpected*100):0};
    });
    if(all.length===0){setHTML(tbody,'');empty.style.display='block';if(summary)summary.innerHTML='';
      if(weeklySearchTerm) renderWeeklyCrossSearch(weeklySearchTerm);
      return;}
    empty.style.display='none';
    if(summary){
      var tA=all.length,tS=all.reduce(function(s,e){return s+e.totalSec;},0);
      var oR=all.reduce(function(s,e){return s+e.totalPkgs;},0)/(tS/60);
      var tM=all.reduce(function(s,e){return s+e.missPct;},0)/tA;
      summary.innerHTML='<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tA+'</span><span class="cbt-ws-label">Batchers</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+oR.toFixed(1)+'</span><span class="cbt-ws-label">Avg Rate</span></div>'+
        '<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tM.toFixed(1)+'%</span><span class="cbt-ws-label">Avg Miss %</span></div>';
    }
    var filtered=all;
    if(weeklySearchTerm){var term=weeklySearchTerm.toLowerCase();filtered=all.filter(function(e){return e.assoc.toLowerCase().indexOf(term)!==-1;});}
    filtered.sort(function(a,b){
      var va,vb;
      if(weeklySortKey==='assoc'){va=a.assoc.toLowerCase();vb=b.assoc.toLowerCase();return weeklySortAsc?va.localeCompare(vb):vb.localeCompare(va);}
      else if(weeklySortKey==='days'){va=a.days;vb=b.days;}else if(weeklySortKey==='runs'){va=a.runs;vb=b.runs;}
      else if(weeklySortKey==='pkgs'){va=a.totalPkgs;vb=b.totalPkgs;}else if(weeklySortKey==='avgRate'){va=a.avgRate;vb=b.avgRate;}
      else if(weeklySortKey==='hrs'){va=a.hrs;vb=b.hrs;}else{va=a.avgRate;vb=b.avgRate;}
      return weeklySortAsc?va-vb:vb-va;
    });
    var html='';
    for(var i=0;i<filtered.length;i++){
      var e=filtered[i],rateCls=e.avgRate>=WARN_RATE?'good':e.avgRate>=ALERT_RATE?'warn':'alert';
      var rankCls=i===0?'gold':i===1?'silver':i===2?'bronze':'';
      html+='<tr><td><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+(i+1)+'</span>'+e.assoc+'</span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.days+'</span></td><td><span class="cbt-hist-meta">'+e.runs+'</span></td>';
      html+='<td><span class="cbt-hist-meta">'+e.totalPkgs+'</span></td><td><span class="cbt-hist-rate '+rateCls+'">'+e.avgRate.toFixed(1)+'</span></td>';
      html+='<td><span class="cbt-hist-meta">'+fmtHours(e.totalSec)+'</span></td></tr>';
    }
    setHTML(tbody, html);

    if(weeklySearchTerm) renderWeeklyCrossSearch(weeklySearchTerm);
    else {
      var cross2 = document.getElementById('cbt-weekly-cross');
      if(cross2) cross2.innerHTML='';
    }
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
    var html = '<div class="cbt-search-result-section">📋 Saved Names</div>';
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
    if (term) names = names.filter(function(n){ return n.toLowerCase().indexOf(term) !== -1; });

    var countEl = document.getElementById('cbt-names-count');
    if (countEl) {
      countEl.textContent = term ? (names.length + ' of ' + totalCount + ' names') : (totalCount + ' names saved');
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
  }

  function renderWeeklyCrossSearch(term) {
    var crossEl = document.getElementById('cbt-weekly-cross');
    if(!crossEl) return;
    if(!term){ crossEl.innerHTML=''; return; }
    term = term.toLowerCase();
    var history = loadHistory();
    var entries = Object.values(history).filter(function(e){ return e.assoc.toLowerCase().indexOf(term)!==-1; });
    var shown = new Set();
    var weeklyData = pruneWeeklyOlderThan(WEEKLY_DAYS);
    for(var wdk of Object.keys(weeklyData)){
      for(var wa of Object.keys(weeklyData[wdk])){
        if(wa.toLowerCase().indexOf(term)!==-1) shown.add(wa.toLowerCase());
      }
    }
    var html='';
    if(entries.length>0){
      html+='<div class="cbt-search-result-section">📅 Also in Today</div>';
      entries.forEach(function(e){
        shown.add(e.assoc.toLowerCase());
        var rateCls=e.avgRate>=WARN_RATE?'good':e.avgRate>=ALERT_RATE?'warn':'alert';
        html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+e.assoc+'</span>' +
        '<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.runs+'</span> runs | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>' +
        '<span class="cbt-search-row-rate cbt-hist-rate '+rateCls+'">'+e.avgRate.toFixed(1)+'</span></div>';
      });
    }
    html += savedNamesSearchHTML(term, shown);
    setHTML(crossEl, html);
  }

  function tickLive() {
    document.querySelectorAll('.cbt-elapsed[data-live="1"]').forEach(function(el){
      var startMs=parseFloat(el.dataset.start); if(!startMs) return;
      var sec=(Date.now()-startMs)/1000, min=sec/60;
      el.className='cbt-elapsed '+(min>=ALERT_ELAPSED_MIN?'alert':min>=WARN_ELAPSED_MIN?'warn':'');
      el.textContent=fmt(sec);
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
      if (d.state === 'BATCHING') {
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
  var panelWatcher = new MutationObserver(function() {
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

  function qrRender(text) {
    var canvas = document.getElementById('cbt-qr-canvas');
    var err = document.getElementById('cbt-qr-err');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, W);
    text = text || '';
    if (!text.trim()) { if (err) err.style.display = 'none'; return; }
    try {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var n = qr.getModuleCount();
      var quiet = 4;
      var cell = Math.floor(W / (n + quiet * 2));
      var off = Math.floor((W - cell * n) / 2);
      ctx.fillStyle = '#0d1b2a';
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
        }
      }
      if (err) err.style.display = 'none';
    } catch(e) {
      if (err) { err.textContent = 'Text too long for a QR code'; err.style.display = 'block'; }
    }
  }

  function qrTeardown() {
    if (_qrOverlay && _qrOverlay.parentNode) _qrOverlay.parentNode.removeChild(_qrOverlay);
    _qrOverlay = null;
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
    qrTeardown();
    _qrOverlay = document.createElement('div');
    _qrOverlay.id = 'cbt-qr-overlay';
    _qrOverlay.innerHTML =
      '<div id="cbt-qr-card">' +
        '<div id="cbt-qr-head">' +
          '<span id="cbt-qr-title">QR Code</span>' +
          '<button id="cbt-qr-close" title="Close">✕</button>' +
        '</div>' +
        '<div id="cbt-qr-canvas-wrap"><canvas id="cbt-qr-canvas" width="648" height="648"></canvas></div>' +
        '<div id="cbt-qr-err"></div>' +
        '<input id="cbt-qr-input" type="text" spellcheck="false" autocomplete="off" placeholder="Text to encode..."/>' +
      '</div>';
    document.body.appendChild(_qrOverlay);
    var input = _qrOverlay.querySelector('#cbt-qr-input');
    input.value = text;
    /* click on the dark backdrop (not the card) closes the popup. This is the
       only close path with a mouseup still to come, so flag that one mouseup
       to be ignored — otherwise it reopens the popup on the spot. */
    _qrOverlay.addEventListener('mousedown', function(e){
      if (e.target !== _qrOverlay) return;
      _qrSuppressNextMouseup = true;
      qrClose();
    });
    _qrOverlay.querySelector('#cbt-qr-close').addEventListener('click', qrClose);
    /* live re-render while editing */
    _qrOverlay.addEventListener('input', function(e){ if (e.target === input) qrRender(input.value); });
    qrRender(text);
  }

  /* highlight any text -> open the QR popup */
  document.addEventListener('mouseup', function(e){
    if (_qrOverlay && _qrOverlay.contains(e.target)) return;
    /* This mouseup belongs to the click that just closed the popup — ignore
       it once, then resume normal behavior. */
    if (_qrSuppressNextMouseup) { _qrSuppressNextMouseup = false; return; }
    setTimeout(function(){
      var sel = '';
      try { sel = String(window.getSelection() || ''); } catch(ex) {}
      sel = sel.trim();
      if (!sel) return;
      if (sel.length > 1000) sel = sel.slice(0, 1000);
      qrOpen(sel);
    }, 10);
  }, true);

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && _qrOverlay) qrClose();
  }, true);

  function start() {
    MY_DEVICE_ID = getDeviceId(); // initialize once at startup

    /* ── Self-heal FIRST ──
       These loops are what put the panels back whenever they are missing.
       They used to be registered at the very end of start(), so any error
       earlier in startup silently skipped them and the panels never came
       back after a page reload. Registering them up front, before anything
       that can fail, guarantees the panels always return.
       The style sheet goes in first so panels mount already styled. */
    try { document.head.appendChild(style); } catch(e) {}
    setInterval(panelHealthCheck, PANEL_HEALTH_MS);
    setInterval(taskPanelHealthCheck, PANEL_HEALTH_MS);
    /* A fresh reload often renders the page's anchors well after this point,
       so check rapidly for the first 60s to bring the panels up promptly. */
    var _fastMountUntil = Date.now() + 60000;
    setInterval(function(){
      if (Date.now() > _fastMountUntil) return;
      try { panelHealthCheck(); taskPanelHealthCheck(); } catch(e) {}
    }, 400);
    /* Late-loading pages: re-check once everything has finished loading. */
    window.addEventListener('load', function(){
      try { panelHealthCheck(); taskPanelHealthCheck(); } catch(e) {}
    });

    // Pull the shared names list FIRST, before any scans, panel work,
    // or push can happen, so a fresh install starts from the full list.
    // The gate in syncPush keeps every push queued until this completes,
    // and the union push in the callback then re-seeds with anything this
    // computer has that the server is missing.
    try { syncPull(function(){ syncPush(); }); } catch(e) {}

    // ── One-time migration to v21.9 own/remote split ──
    var CLEAN_KEY = 'cbt_cleaned_v21_9';
    if (!gmGet(CLEAN_KEY, null)) {
      // Migrate existing weekly data into OWN store before wiping old key
      try {
        var oldWeekly = null;
        try { var gv = gmGet(WEEKLY_KEY, null); if (gv) oldWeekly = (typeof gv === 'string') ? JSON.parse(gv) : gv; } catch(e) {}
        if (!oldWeekly) { try { oldWeekly = JSON.parse(localStorage.getItem(WEEKLY_KEY) || '{}'); } catch(e) {} }
        if (oldWeekly && Object.keys(oldWeekly).length > 0) {
          var cleanedOld = sanitizeWeekly(oldWeekly);
          if (Object.keys(cleanedOld).length > 0) {
            var json = JSON.stringify(cleanedOld);
            gmSet(OWN_WEEKLY_KEY, json);
            try { localStorage.setItem(OWN_WEEKLY_KEY, json); } catch(e) {}
          }
        }
      } catch(e) {}
      // Migrate existing today history into OWN store
      try {
        var oldHistory = null;
        try { var ghv = gmGet(STORAGE_KEY, null); if (ghv) oldHistory = (typeof ghv === 'string') ? JSON.parse(ghv) : ghv; } catch(e) {}
        if (!oldHistory) { try { oldHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) {} }
        if (oldHistory && Object.keys(oldHistory).length > 0) {
          var cleanedHist = sanitizeHistory(oldHistory);
          if (Object.keys(cleanedHist).length > 0) {
            var hjson = JSON.stringify(cleanedHist);
            gmSet(STORAGE_KEY, hjson);
            try { localStorage.setItem(STORAGE_KEY, hjson); } catch(e) {}
          }
        }
      } catch(e) {}
      // Wipe remote caches — will be rebuilt correctly on first pull
      saveRemoteHistory({});
      saveRemoteWeekly({});
      gmSet(CLEAN_KEY, '1');
    }

    if (isComoSite()) {
      try {
        timerWatcher.observe(document.documentElement, { childList: true, subtree: true });
        injectAllTimers();
        setInterval(function(){ try { tickTimers(); injectAllTimers(); } catch(e) {} }, 1000);
        fetchAndUpdate();
      } catch(e) {}
    }
    try { panelWatcher.observe(document.documentElement, { childList: true, subtree: true }); } catch(e) {}
    try { if (isDashboardView()) injectPanel(); } catch(e) {}
    try { injectTaskPanel(); } catch(e) {}

    /* React the moment the route changes instead of waiting for the next
       health tick — otherwise the board lingers for up to 2s on Packages.
       Angular routes via pushState, which does not fire popstate. */
    (function () {
      function onRoute() {
        if (!isDashboardView()) detachMainPanel();
        panelHealthCheck();
        taskPanelHealthCheck();
      }
      var _push = history.pushState, _repl = history.replaceState;
      history.pushState = function () {
        var r = _push.apply(this, arguments); onRoute(); return r;
      };
      history.replaceState = function () {
        var r = _repl.apply(this, arguments); onRoute(); return r;
      };
      window.addEventListener('popstate', onRoute);
      window.addEventListener('hashchange', onRoute);

      /* Safety net for route changes the patch above misses. */
      var lastPath = location.pathname + location.hash;
      setInterval(function () {
        var now = location.pathname + location.hash;
        if (now !== lastPath) { lastPath = now; onRoute(); }
      }, 150);

      /* Immediate correction if the board is ever found out of place. */
      setInterval(function () { if (boardIsMisplaced()) detachMainPanel(); }, 400);
    })();
    if (isComoSite()) {
      pollActiveTasks();
      setInterval(pollActiveTasks, POLL_MS);
      setInterval(tickLive, TICK_MS);
      setInterval(fetchAndUpdate, 1000);
    }
    syncNamesFromAllTabs();
    scanLocalStorageForNames();
    setInterval(function(){
      if (syncNamesFromAllTabs() && activeTab === 'names') renderNames();
    }, 5000);
    syncHistoryPull(function(){ syncHistoryPush(); });
    syncWeeklyPull(function(){ syncWeeklyPush(); });
    setInterval(function(){ syncPull(); }, 60000);
    setInterval(function(){ syncHistoryPull(); }, 60000);
    setInterval(function(){ syncWeeklyPull(); }, 60000);
    if (isComoSite()) {
      try {
        GM_xmlhttpRequest({
          method: 'GET', url: DRIVE_URL + '&_=' + Date.now(), responseType: 'json',
          onload: function(res) {
            if (res.status>=200&&res.status<300&&res.response) batchRateCache = res.response[STORE_ID]||200;
            fetchAndUpdate();
          },
          onerror: function(){}
        });
      } catch(e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
