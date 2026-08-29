// ==UserScript==
// @name         COMO - Early Task In Order With Timer & Batcher Dashboard
// @namespace    https://github.com/uny2-ops
// @version      23.9.176
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
if (window.top !== window.self &&
/[?&](?:cbtAfaProbe|cbtMissingQrProbe|cbtAssignProbe)=1(?:&|$)/.test(window.location.search)) return;
function cbtStoreIdFromLocation() {
try {
var m = String(window.location.href || '').match(/\/store\/([^/?#]+)/i);
return m ? decodeURIComponent(m[1]) : '';
} catch(e) { return ''; }
}
var STORE_ID = cbtStoreIdFromLocation();
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
    #cbt-panel, #cbt-qr-overlay, #cbt-afa-overlay, #cbt-ac-drop {
      -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
    }
    #cbt-panel input, #cbt-panel textarea,
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
    #cbt-afa-overlay.cbt-dark #cbt-afa-assign-types .cbt-afa-opt b {
      color: #e6edf3;
    }
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

    /* Retired floating task-detail Search Associate panel CSS removed. */

    /* ── UI polish (v21.10) ── */
    @keyframes cbtFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    #cbt-panel { animation: cbtFadeIn 0.28s ease-out; }

    /* row hover: left accent bar, no layout shift */
    #cbt-table tbody tr:hover td:first-child, #cbt-hist-table tbody tr:hover td:first-child,
    #cbt-weekly-table tbody tr:hover td:first-child, #cbt-names-table tbody tr:hover td:first-child {
      box-shadow: inset 3px 0 0 var(--cb-blue);
    }
    #cbt-panel.dark #cbt-table tbody tr:hover td:first-child, #cbt-panel.dark #cbt-hist-table tbody tr:hover td:first-child,
    #cbt-panel.dark #cbt-weekly-table tbody tr:hover td:first-child, #cbt-panel.dark #cbt-names-table tbody tr:hover td:first-child {
      box-shadow: inset 3px 0 0 #58a6ff;
    }
    .cbt-search-row:hover .cbt-search-row-name {
      box-shadow: inset 3px 0 0 var(--cb-blue);
    }
    #cbt-panel.dark .cbt-search-row:hover .cbt-search-row-name {
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
    #cbt-panel.dark .cbt-copied-name, #cbt-panel.dark .cbt-copied-name:hover { color: #3fb950 !important; }
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
      gap: 4px;
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
    #cbt-afa-missing-copy {
      font-size: 10px;
      line-height: 1.30;
    }

    /* Assign associate picker — search/select only. */
    #cbt-afa-assign-search {
      width: 100%;
      height: 42px;
      box-sizing: border-box;
      border: 1.5px solid var(--cb-border);
      border-radius: 8px;
      padding: 0 12px;
      background: #fff;
      color: var(--cb-text);
      font-family: var(--cb-sans);
      font-size: 14px;
      font-weight: 600;
      outline: none;
    }
    #cbt-afa-assign-search:focus {
      border-color: var(--cb-blue);
      box-shadow: 0 0 0 3px rgba(30,136,229,.12);
    }
    #cbt-afa-assign-results {
      margin-top: 9px;
      border: 1px solid var(--cb-border);
      border-radius: 8px;
      overflow-y: auto;
      max-height: 240px;
      background: var(--cb-row-alt);
    }
    .cbt-afa-assign-name {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--cb-border);
      cursor: pointer;
      font-family: var(--cb-mono);
      font-size: 13px;
      font-weight: 800;
      color: var(--cb-navy);
      user-select: none;
    }
    .cbt-afa-assign-name:last-child { border-bottom: none; }
    .cbt-afa-assign-name:hover,
    .cbt-afa-assign-name.on,
    .cbt-afa-assign-name.selected {
      background: rgba(30,136,229,.10);
    }
    .cbt-afa-assign-check {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--cb-blue);
      pointer-events: none;
    }
    .cbt-afa-assign-order {
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--cb-blue);
      color: #fff;
      font-family: var(--cb-sans);
      font-size: 11px;
      font-weight: 900;
      line-height: 1;
    }
    .cbt-afa-assign-order.hidden { visibility: hidden; }
    .cbt-afa-assign-empty {
      padding: 12px;
      color: var(--cb-text3);
      font-size: 12px;
      text-align: center;
    }
    #cbt-afa-assign-selected {
      margin-top: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      border-radius: 8px;
      background: rgba(30,136,229,.10);
      border: 1px solid rgba(30,136,229,.28);
      color: var(--cb-text2);
      font-size: 12px;
      font-weight: 700;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-title {
      flex: 0 0 100%;
      width: 100%;
      margin-bottom: 2px;
      color: var(--cb-text2);
      font-family: var(--cb-sans);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    #cbt-afa-assign-clear {
      border: 1px solid rgba(220,53,69,.55);
      border-radius: 6px;
      padding: 4px 9px;
      background: rgba(220,53,69,.10);
      color: #ffb9c1;
      font-family: var(--cb-sans);
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
      text-transform: none;
      letter-spacing: 0;
      cursor: pointer;
    }
    #cbt-afa-assign-clear:hover {
      background: #dc3545;
      border-color: #dc3545;
      color: #fff;
    }
    #cbt-afa-assign-selected .cbt-afa-assign-empty {
      flex: 0 0 100%;
      width: 100%;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-row {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      width: auto;
      max-width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      margin-top: 3px;
      border-radius: 6px;
      background: rgba(30,136,229,.08);
      color: #eaf4ff;
      font-family: var(--cb-mono);
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      user-select: none;
      flex: 0 1 auto;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-row:hover {
      background: rgba(220,53,69,.22);
      box-shadow: inset 0 0 0 1px rgba(220,53,69,.65);
    }
    #cbt-afa-assign-selected .cbt-afa-selected-row:hover .cbt-afa-selected-num {
      background: #dc3545;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-row:hover .cbt-afa-selected-name {
      color: #ffdfe3;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-name {
      flex: 1 1 auto;
      min-width: 0;
      color: #ffffff;
      overflow-wrap: anywhere;
    }
    #cbt-afa-assign-selected .cbt-afa-selected-num {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--cb-blue);
      color: #fff;
      font-family: var(--cb-sans);
      font-size: 11px;
      font-weight: 900;
      flex: 0 0 auto;
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
      margin-top: 10px;
      padding: 9px 10px;
      border-radius: 6px;
      background: var(--cb-row-alt);
      color: var(--cb-navy);
      font-family: var(--cb-mono);
      font-size: 18px;
      line-height: 1.25;
      font-weight: 900;
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

    #cbt-afa-assign-types {
      margin: 0 0 12px;
      padding: 10px 11px;
      border: 1px solid var(--cb-border);
      border-radius: 8px;
      background: var(--cb-row-alt);
    }
    .cbt-afa-assign-type-title {
      color: var(--cb-navy);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 7px;
    }
    #cbt-afa-assign-types .cbt-afa-opt {
      margin-top: 6px;
      padding: 7px 8px;
      gap: 5px;
      font-size: 12px;
      line-height: 1.35;
    }
    #cbt-afa-assign-types .cbt-afa-opt b {
      color: var(--cb-navy);
    }

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
var _sorting = false, _sortObserver = null, _attached = null;
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
var CBT_OWN_UI_SELECTOR =
'#cbt-panel,#cbt-qr-overlay,#cbt-afa-overlay,#cbt-ac-drop,.etf-col-cell,.cbt-missing-probe-frame,.cbt-assign-probe-frame';
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
var _storeTimezoneWasFallback = false;
var _storeTimezoneBroadScanAt = 0;
var _storeTimezoneBroadScanValue = null;
var _parseTimeMemo = Object.create(null);
var _parseTimeMemoDay = '';
function getStoreTimezone() {
var nowMs = Date.now();
var scope = '';
try {
var sm = location.pathname.match(/\/store\/([^/]+)/i);
scope = sm && sm[1] ? sm[1] : (location.host + location.pathname);
} catch(e0) {
scope = location.host || '';
}
var tzCacheTtl = _storeTimezoneWasFallback ? 2000 : (10 * 60 * 1000);
if (_storeTimezoneCache && _storeTimezoneCacheScope === scope &&
nowMs - _storeTimezoneCacheAt < tzCacheTtl) {
return _storeTimezoneCache;
}
if (_storeTimezoneCacheScope !== scope) {
_storeTimezoneCache = null;
_storeTimezoneWasFallback = false;
_storeTimezoneBroadScanAt = 0;
_storeTimezoneBroadScanValue = null;
_parseTimeMemo = Object.create(null);
_parseTimeMemoDay = '';
}
var tz = null;
var tzEl = document.querySelector(
'[class*="timezone"], [class*="time-zone"], .store-time, .current-time,' +
'[data-timezone], [data-time-zone], [timezone]'
);
if (tzEl) {
var tzCandidate = '';
try {
tzCandidate = [
tzEl.textContent || '',
tzEl.getAttribute && tzEl.getAttribute('data-timezone') || '',
tzEl.getAttribute && tzEl.getAttribute('data-time-zone') || '',
tzEl.getAttribute && tzEl.getAttribute('timezone') || ''
].join(' ');
} catch(eTzAttr) { tzCandidate = tzEl.textContent || ''; }
var match = tzCandidate.match(/([A-Za-z]+\/[A-Za-z_]+)/);
if (match) tz = match[1];
}
if (!tz) {
if (!_storeTimezoneBroadScanAt || nowMs - _storeTimezoneBroadScanAt >= 30000) {
_storeTimezoneBroadScanAt = nowMs;
_storeTimezoneBroadScanValue = null;
try {
var bodyText = document.body ? (document.body.textContent || '') : '';
var tzMatch = bodyText.match(/America\/[A-Za-z_]+/);
if (!tzMatch && document.body) {
tzMatch = (document.body.innerHTML || '').match(/America\/[A-Za-z_]+/);
}
if (tzMatch) _storeTimezoneBroadScanValue = tzMatch[0];
} catch(e1) {}
}
if (_storeTimezoneBroadScanValue) tz = _storeTimezoneBroadScanValue;
}
_storeTimezoneWasFallback = !tz;
_storeTimezoneCache = tz || 'America/New_York';
_storeTimezoneCacheAt = nowMs;
_storeTimezoneCacheScope = scope;
return _storeTimezoneCache;
}
function cbtWallTimeInZoneMs(dateStr, hour, minute, tz) {
var dm = String(dateStr || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
if (!dm) return NaN;
var targetUtc = Date.UTC(Number(dm[1]), Number(dm[2])-1, Number(dm[3]), Number(hour)||0, Number(minute)||0, 0, 0);
var guess = targetUtc;
try {
var fmt = new Intl.DateTimeFormat('en-US', {
timeZone: tz, hour12:false,
year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit',
hourCycle:'h23'
});
for (var n=0; n<3; n++) {
var parts = fmt.formatToParts(new Date(guess)), got={};
for (var i=0;i<parts.length;i++) got[parts[i].type]=parts[i].value;
var represented = Date.UTC(Number(got.year), Number(got.month)-1, Number(got.day), Number(got.hour)%24, Number(got.minute), Number(got.second)||0, 0);
var diff = represented - targetUtc;
if (!diff) break;
guess -= diff;
}
return guess;
} catch(e) { return NaN; }
}
function parseTime(raw) {
if (!raw) return null;
var str = raw.replace(/[^\d:APMapm\s]/g, '').trim();
var m = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
if (!m) return null;
var tz = getStoreTimezone();
var nowMs = (typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now();
var now = new Date(nowMs);
var dateStr;
try { dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); }
catch(e0) { dateStr = now.toLocaleDateString('en-CA'); }
var hourBucket = Math.floor(nowMs / 3600000);
if (_parseTimeMemoDay !== dateStr + '|' + tz + '|' + hourBucket) {
_parseTimeMemoDay = dateStr + '|' + tz + '|' + hourBucket;
_parseTimeMemo = Object.create(null);
}
var memoKey = str.toUpperCase();
if (Object.prototype.hasOwnProperty.call(_parseTimeMemo, memoKey)) return _parseTimeMemo[memoKey];
var h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
var ap = m[3] ? m[3].toUpperCase() : null;
if (ap === 'PM' && h < 12) h += 12;
if (ap === 'AM' && h === 12) h = 0;
var result = cbtWallTimeInZoneMs(dateStr, h, mn, tz);
if (!isFinite(result)) {
var d = new Date(nowMs); d.setHours(h, mn, 0, 0); result = d.getTime();
}
var delta = result - nowMs;
if (delta > 12 * 3600000) result -= 86400000;
else if (delta < -12 * 3600000) result += 86400000;
_parseTimeMemo[memoKey] = result;
return result;
}
function getBatchTarget(card) {
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
var data = cards.map(function (card, index) {
return {
card: card,
btMs: getBatchTarget(card),
rowOrder: index
};
});
data.sort(function (a, b) {
var hasA = a.btMs != null, hasB = b.btMs != null;
if (hasA && hasB) {
if (a.btMs !== b.btMs) return a.btMs - b.btMs;
return a.rowOrder - b.rowOrder;
}
if (hasA) return -1;
if (hasB) return 1;
return a.rowOrder - b.rowOrder;
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
cbtMarkRelevantDomChanged();
sortNow(container);
_sortObserver = new MutationObserver(function (mutations) {
if (_sorting) return;
for (var i = 0; i < mutations.length; i++) {
if (mutations[i].type === 'childList') {
cbtMarkRelevantDomChanged();
sortNow(container);
return;
}
}
});
_sortObserver.observe(container, { childList: true });
try { cbtRetargetTimerWatcher(container); } catch(eTimerRoot) {}
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
cbtMarkRelevantDomChanged();
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
if (!_bodyWatcherStarted) {
try {
bodyWatcher.observe(document.documentElement, { childList: true, subtree: true });
_bodyWatcherStarted = true;
} catch(e2) {}
}
}
function fmtTimeLeft(targetMs) {
var diffMs = targetMs - ((typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now());
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
var _cbtTimerElements = new Set();
function injectRowTimer(row) {
var existingTimerCol = row.querySelector('.etf-col-cell');
if (existingTimerCol) {
try {
var existingTimerEl = existingTimerCol.querySelector('.etf-timeleft[data-target]');
if (existingTimerEl) _cbtTimerElements.add(existingTimerEl);
} catch(eExistingTimer) {}
return;
}
var isHeader = row.classList.contains('job-card-header');
var found = findBatchTargetCol(row);
if (!found) return;
var btCol = found.col;
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
try {
var timerEl = newCol.querySelector('.etf-timeleft[data-target]');
if (timerEl) _cbtTimerElements.add(timerEl);
} catch(eTimerTrack) {}
}
var EXCLUDED_SECTION_RE = /problem\s*solve|partially\s*batched|staged\s*for\s*pickup/i;
var _cbtRelevantDomVersion = 1;
var _excludedTurnCache = new WeakMap();
var _cbtMainTasksSnapshotCache = null;
var _cbtPartialCheckboxRefreshPending = false;
function cbtSchedulePartialCheckboxRefresh() {
var box = document.getElementById('cbt-afa-type-partial');
if (!box || _cbtPartialCheckboxRefreshPending) return;
_cbtPartialCheckboxRefreshPending = true;
setTimeout(function(){
_cbtPartialCheckboxRefreshPending = false;
try { cbtAssignRefreshPartialCheckboxState(); } catch(e) {}
}, 60);
}
function cbtMarkRelevantDomChanged() {
_cbtRelevantDomVersion++;
_cbtMainTasksSnapshotCache = null;
cbtSchedulePartialCheckboxRefresh();
}
function isInExcludedSection(el) {
if (!el || el.nodeType !== 1) return false;
var cached = _excludedTurnCache.get(el);
if (cached && cached.version === _cbtRelevantDomVersion &&
Date.now() - Number(cached.at || 0) < 5000) {
return cached.value;
}
var node = el;
var excluded = false;
while (node && node !== document.body) {
var prev = node.previousElementSibling;
while (prev) {
if (EXCLUDED_SECTION_RE.test(prev.textContent || '')) {
excluded = true;
break;
}
prev = prev.previousElementSibling;
}
if (excluded) break;
if (node.parentElement) {
var parentPrev = node.parentElement.previousElementSibling;
if (parentPrev &&
EXCLUDED_SECTION_RE.test(parentPrev.textContent || '')) {
excluded = true;
break;
}
}
node = node.parentElement;
}
_excludedTurnCache.set(el, {
version: _cbtRelevantDomVersion,
at: Date.now(),
value: excluded
});
return excluded;
}
function injectAllTimers() {
var nodes = document.querySelectorAll('div.row.job-card-header, job-card');
for (var i = 0; i < nodes.length; i++) {
var el = nodes[i];
if (isInExcludedSection(el)) {
try {
el.querySelectorAll('.etf-col-cell').forEach(function(col){ col.remove(); });
} catch(e0) {}
continue;
}
if (el.matches && el.matches('div.row.job-card-header')) {
injectRowTimer(el);
} else {
var row = null;
try { row = el.querySelector('div.row'); } catch(e1) {}
if (row) injectRowTimer(row);
}
}
}
function tickTimers() {
if (document.hidden || !isDashboardView()) return;
_cbtTimerElements.forEach(function (el) {
if (!el || !el.isConnected) {
_cbtTimerElements.delete(el);
return;
}
var targetMs = parseInt(el.dataset.target, 10);
if (!targetMs) return;
var result = fmtTimeLeft(targetMs);
var nextClass = 'etf-timeleft ' + result.cls;
if (el.textContent !== result.text) el.textContent = result.text;
if (el.className !== nextClass) el.className = nextClass;
});
cbtAssignRenderProtectionCountdown();
try { cbtAssignRenderGlobalSessionState(); } catch(eGlobalAssignTick) {}
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
try { cbtAssignRenderProtectionCountdown(); } catch(eCooldown) {}
}
var _timerWatchRoot = null;
function cbtRetargetTimerWatcher(root) {
if (typeof timerWatcher === 'undefined' || !timerWatcher) return;
root = root && root.isConnected ? root : document.documentElement;
if (_timerWatchRoot === root) return;
try { timerWatcher.disconnect(); } catch(e0) {}
_timerWatchRoot = root;
try { timerWatcher.observe(root, { childList:true, subtree:true }); } catch(e1) {}
}
var timerWatcher = new MutationObserver(function(mutations) {
if (!isDashboardView()) return;
var foundRelevant = false;
for (var i = 0; i < mutations.length; i++) {
if (cbtMutationIsOnlyOwnUi(mutations[i])) continue;
foundRelevant = true;
queueTimerHost(mutations[i].target);
var added = mutations[i].addedNodes || [];
for (var j = 0; j < added.length; j++) queueTimerHost(added[j]);
}
if (!foundRelevant) return;
cbtMarkRelevantDomChanged();
if (_timerMutationPending) return;
_timerMutationPending = true;
var raf = (typeof requestAnimationFrame === 'function')
? requestAnimationFrame
: function(cb){ return setTimeout(cb, 16); };
raf(flushTimerMutationHosts);
});
var CBT_REC_RELEASE_MINUTE = 55;
var CBT_REC_RELEASE_FREEZE_START = 55;
var CBT_REC_FIRST_DROP_HOUR = 2;
var CBT_REC_LAST_DROP_HOUR = 20;
var CBT_REC_QUIET_START_HOUR = 21;
var CBT_REC_CART_MINUTES = 20;
var CBT_REC_DEADLINE_BUFFER_MIN = 5;
var CBT_REC_OVERDUE_WINDOW_MIN = 8;
var CBT_REC_RUSH_RATIO = 0.12;
var CBT_REC_RUSH_MIN = 1;
var CBT_REC_RUSH_MAX = 4;
var CBT_REC_MAX_BATCHERS = 38;
var CBT_REC_STATE_PREFIX = 'cbt_hourly_recommend_v4_release55_';
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
if (h >= CBT_REC_QUIET_START_HOUR || h < CBT_REC_FIRST_DROP_HOUR) return true;
if (h === CBT_REC_FIRST_DROP_HOUR && m < CBT_REC_RELEASE_FREEZE_START) return true;
return false;
}
function cbtRecCycleInfo(nowMs) {
var p = cbtRecStoreClock(nowMs);
var releaseSerial = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0);
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
var inReleaseWindow = false;
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
var typeText = [
job.destinationType, job.jobType, job.taskType,
job.operationType, job.workflowType
].filter(Boolean).join(' ').toUpperCase();
if (typeText.indexOf('UNPACK') !== -1) return false;
if (typeText.indexOf('PROBLEM') !== -1 && typeText.indexOf('SOLVE') !== -1) return false;
return true;
}
function cbtRecMainTasksSnapshot() {
if (!isDashboardView()) return null;
var container = null;
if (_attached && _attached.isConnected) {
container = _attached;
} else {
try { container = getContainer(); } catch(e) {}
}
if (!container || !container.isConnected) return null;
if (_cbtMainTasksSnapshotCache &&
_cbtMainTasksSnapshotCache.version === _cbtRelevantDomVersion &&
_cbtMainTasksSnapshotCache.container === container &&
Date.now() - Number(_cbtMainTasksSnapshotCache.at || 0) < 1200) {
return _cbtMainTasksSnapshotCache.snapshot;
}
var cards = [];
try {
cards = Array.prototype.slice.call(
container.querySelectorAll(':scope > job-card')
);
} catch(e2) {
cards = Array.prototype.slice.call(container.children || []).filter(function(el){
return el && el.tagName && el.tagName.toLowerCase() === 'job-card';
});
}
var refs = new Set();
var ids = new Set();
for (var i = 0; i < cards.length; i++) {
var card = cards[i];
try { if (isInExcludedSection(card)) continue; } catch(e3) {}
var a = null;
try { a = card.querySelector('a[href*="jobdetails"], a'); } catch(e4) {}
if (!a) continue;
var ref = String(a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
if (ref) refs.add(ref);
var href = a.getAttribute('href') || '';
var m = href.match(/jobId=([^&#]+)/i);
if (m) {
try { ids.add(decodeURIComponent(m[1])); }
catch(e5) { ids.add(m[1]); }
}
}
var snapshot = {
count: cards.filter(function(card){
try { return !isInExcludedSection(card); }
catch(e6) { return true; }
}).length,
refs: refs,
ids: ids
};
_cbtMainTasksSnapshotCache = {
version: _cbtRelevantDomVersion,
at: Date.now(),
container: container,
snapshot: snapshot
};
return snapshot;
}
function cbtRecJobMatchesMainTasks(job, snapshot) {
if (!job || !snapshot) return false;
var jobId = job.jobId != null ? String(job.jobId) : '';
if (jobId && snapshot.ids.has(jobId)) return true;
var refFields = [
job.shortClientRef,
job.clientRef,
job.clientReference,
job.reference
];
for (var i = 0; i < refFields.length; i++) {
if (refFields[i] == null) continue;
var ref = String(refFields[i]).replace(/\s+/g, ' ').trim().toLowerCase();
if (ref && snapshot.refs.has(ref)) return true;
}
return false;
}
function cbtRecScopeJobsToMainTasks(jobs, snapshot) {
jobs = Array.isArray(jobs) ? jobs.slice() : [];
if (!snapshot) return null;
if (snapshot.count === 0) return [];
if (snapshot.refs.size || snapshot.ids.size) {
var matched = jobs.filter(function(job){
return cbtRecJobMatchesMainTasks(job, snapshot);
});
if (!matched.length && jobs.length) return null;
if (matched.length) jobs = matched;
}
if (jobs.length > snapshot.count) {
jobs = jobs.slice(0, snapshot.count);
}
return jobs;
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
if (mins <= 0) mins = CBT_REC_OVERDUE_WINDOW_MIN;
var effective = Math.max(1, mins - CBT_REC_DEADLINE_BUFFER_MIN);
var need = Math.ceil((count * CBT_REC_CART_MINUTES) / effective);
if (need > count) need = count;
if (need < 1) need = 1;
return need;
}
function cbtRecCalculate(data, nowMs, mainTasks) {
nowMs = Number(nowMs) || Date.now();
var cycle = cbtRecCycleInfo(nowMs);
if (mainTasks === undefined) {
mainTasks = cbtRecMainTasksSnapshot();
}
var jobs = Array.isArray(data)
? data.filter(cbtRecIsBatchingWork)
: [];
jobs = cbtRecScopeJobsToMainTasks(jobs, mainTasks);
if (jobs === null) {
return {
ready: false,
raw: null, urgentRaw: null, openCount: 0, rushReserve: 0,
overdue: 0, dueByNextRelease: 0, earliestMinutes: null,
cycle: cycle
};
}
var openCount = jobs.length;
if (!openCount) {
return {
ready: true,
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
var allowRushReserve = !cycle.inReleaseWindow && !cycle.quietHours;
var rushReserve = allowRushReserve ? cbtRecRushReserve(openCount) : 0;
if (allowRushReserve) {
var plannedCount = openCount + rushReserve;
var horizonNeed = cbtRecNeedForCount(plannedCount, cycle.minutesToNextRelease);
if (horizonNeed > maxNeed) maxNeed = horizonNeed;
}
var taskCap = Math.max(0, Math.min(CBT_REC_MAX_BATCHERS, openCount));
maxNeed = Math.max(1, Math.min(taskCap, maxNeed));
urgentNeed = Math.max(0, Math.min(taskCap, urgentNeed));
return {
ready: true,
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
function cbtRecLockedValue(calc, mainTasks) {
if (!calc || !calc.cycle || calc.ready === false) return null;
if (mainTasks === undefined) {
mainTasks = cbtRecMainTasksSnapshot();
}
if (!mainTasks) return null;
var state = cbtRecLoadState();
var cycleKey = calc.cycle.key;
var taskCap = Math.max(0, Math.min(CBT_REC_MAX_BATCHERS, Number(calc.openCount) || 0));
taskCap = Math.min(taskCap, Math.max(0, Number(mainTasks.count) || 0));
if (!state || state.cycleKey !== cycleKey) {
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
var currentLocked = Math.max(0, Math.min(taskCap, Number(state.locked) || 0));
if (currentLocked !== Number(state.locked)) {
state.locked = currentLocked;
state.updatedAt = Date.now();
cbtRecSaveState(state);
}
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
if (calc.ready === false || recommended == null) {
return 'Waiting for current normal Tasks to finish loading…';
}
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
parts.push('resets at next :55 store time');
return parts.join(' · ');
}
var CBT_STATS_REFRESH_MS = 2000;
var CBT_STATS_WARM_MAX_AGE_MS = 120000;
var CBT_STATS_WARM_CYCLE_GRACE_MS = 30000;
var CBT_STATS_WARM_WRITE_MIN_MS = 15000;
var _statsWarmLastSerialized = '';
var _statsWarmLastWriteAt = 0;
var _statsLastSummaryData = null;
var _statsLastRequestAt = 0;
var _statsStartupRecheckTimer = 0;
var _statsStartupRecheckTries = 0;
var _statsStartupWarm = null;
var _statsStartupWarmChecked = false;
var _statsStartupGraceUntil = 0;
function cbtStatsCacheKey() {
return 'cbt_stats_warm_v1_' + String(STORE_ID || 'unknown');
}
function cbtStatsCurrentCycleKey() {
try {
var c = cbtRecCycleInfo(Date.now());
return c && c.key ? String(c.key) : '';
} catch(e) {}
return '';
}
function cbtStatsReadWarmRaw() {
var raw = null;
try { raw = sessionStorage.getItem(cbtStatsCacheKey()); } catch(e0) {}
if (!raw) {
try { raw = localStorage.getItem(cbtStatsCacheKey()); } catch(e1) {}
}
if (!raw) return null;
try {
var s = JSON.parse(raw);
return s && s.ts ? s : null;
} catch(e2) {
return null;
}
}
function cbtStatsLoadWarm(allowFreshCycleMismatch) {
var s = cbtStatsReadWarmRaw();
if (!s || !s.ts) return null;
var age = Date.now() - Number(s.ts);
if (!isFinite(age) || age < 0 || age > CBT_STATS_WARM_MAX_AGE_MS) {
return null;
}
var cycleKey = cbtStatsCurrentCycleKey();
if (cycleKey && s.cycleKey && String(s.cycleKey) !== cycleKey) {
if (!allowFreshCycleMismatch || age > CBT_STATS_WARM_CYCLE_GRACE_MS) {
return null;
}
}
if (s.inProgress == null ||
s.remaining == null ||
s.recommended == null) {
return null;
}
return s;
}
function cbtStatsSaveWarm(inProgress, remaining, recommended, dotColor, recTitle, cycleKey) {
if (inProgress == null || remaining == null || recommended == null) return;
var payload = {
ts: Date.now(),
cycleKey: cycleKey || cbtStatsCurrentCycleKey(),
inProgress: Number(inProgress),
remaining: Number(remaining),
recommended: Number(recommended),
dotColor: dotColor || 'gray',
recTitle: recTitle || ''
};
var valueKey = JSON.stringify({
cycleKey: payload.cycleKey,
inProgress: payload.inProgress,
remaining: payload.remaining,
recommended: payload.recommended,
dotColor: payload.dotColor,
recTitle: payload.recTitle
});
var nowMs = Date.now();
if (valueKey === _statsWarmLastSerialized &&
nowMs - _statsWarmLastWriteAt < CBT_STATS_WARM_WRITE_MIN_MS) {
return;
}
var raw = JSON.stringify(payload);
_statsWarmLastSerialized = valueKey;
_statsWarmLastWriteAt = nowMs;
try { sessionStorage.setItem(cbtStatsCacheKey(), raw); } catch(e0) {}
try { localStorage.setItem(cbtStatsCacheKey(), raw); } catch(e1) {}
}
function cbtStatsPrimeStartupWarm() {
if (_statsStartupWarmChecked) return _statsStartupWarm;
_statsStartupWarmChecked = true;
try {
_statsStartupWarm = cbtStatsLoadWarm(true);
} catch(e) {
_statsStartupWarm = null;
}
return _statsStartupWarm;
}
function cbtStatsHydrateWarm() {
var s = cbtStatsPrimeStartupWarm();
if (!s) return false;
updateStats(
s.inProgress,
s.remaining,
s.recommended,
s.dotColor || 'gray',
'Refreshing current dashboard…' + (s.recTitle ? ' · ' + s.recTitle : ''),
false
);
return true;
}
function cbtStatsScheduleStartupRecheck() {
if (!_statsLastSummaryData || _statsStartupRecheckTimer) return;
if (_statsStartupRecheckTries >= 8) return;
_statsStartupRecheckTimer = setTimeout(function(){
_statsStartupRecheckTimer = 0;
_statsStartupRecheckTries++;
var ready = false;
try { ready = !!cbtRecMainTasksSnapshot(); } catch(e) {}
if (ready) {
_statsStartupRecheckTries = 8;
try { cbtApplyStatsData(_statsLastSummaryData); } catch(e2) {}
return;
}
cbtStatsScheduleStartupRecheck();
}, 150);
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
function updateStats(inProgress, remaining, recommended, dotColor, recTitle, provisional) {
var elIP = document.getElementById('cbt-stat-ip');
var elRem = document.getElementById('cbt-stat-rem');
var elRec = document.getElementById('cbt-stat-rec');
var elDot = document.getElementById('cbt-stat-dot');
var elDelta = document.getElementById('cbt-stat-delta');
var ipText = (inProgress !== null && inProgress !== undefined) ? String(inProgress) : '—';
var recText = recommended != null ? String(recommended) : '—';
var actualNum =
(inProgress !== null && inProgress !== undefined && inProgress !== '—')
? Number(inProgress)
: NaN;
var recNum =
(recommended !== null && recommended !== undefined && recommended !== '—')
? Number(recommended)
: NaN;
var deltaText = '';
var deltaClass = '';
var deltaTitle = '';
if (!provisional && isFinite(actualNum) && isFinite(recNum) && recNum >= 0) {
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
if (elIP &&
(_statsDomCache.inProgress !== ipText || elIP.textContent !== ipText)) {
elIP.textContent = ipText;
_statsDomCache.inProgress = ipText;
}
var remText = (remaining !== null && remaining !== undefined) ? String(remaining) : '—';
if (elRem &&
(_statsDomCache.remaining !== remText || elRem.textContent !== remText)) {
elRem.textContent = remText;
_statsDomCache.remaining = remText;
}
if (elRec &&
(_statsDomCache.recommended !== recText || elRec.textContent !== recText)) {
elRec.textContent = recText;
_statsDomCache.recommended = recText;
}
if (elDelta &&
(_statsDomCache.deltaText !== deltaText ||
_statsDomCache.deltaClass !== deltaClass ||
elDelta.textContent !== deltaText ||
elDelta.className !== deltaClass)) {
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
var old = document.getElementById('etf-stats');
if (old) old.remove();
}
function cbtApplyStatsData(data) {
if (!Array.isArray(data)) data = [];
var staffingJobs = data.filter(cbtRecIsBatchingWork);
var mainTasks = cbtRecMainTasksSnapshot();
var scopedStaffingJobs = cbtRecScopeJobsToMainTasks(staffingJobs, mainTasks);
var inProgress = null;
if (scopedStaffingJobs !== null) {
inProgress = scopedStaffingJobs.filter(function (j) {
var st = String(j.operationState || j.state || '').toUpperCase();
return st === 'IN_PROGRESS' || st === 'BATCHING';
}).length;
}
var expected = staffingJobs.reduce(function (s, j) {
return s + (Number(j.totalExpectedPackages) || 0);
}, 0);
var batched = staffingJobs.reduce(function (s, j) {
return s + (Number(j.packagesBatched) || 0);
}, 0);
var collected = staffingJobs.reduce(function (s, j) {
return s + (Number(j.packagesCollected) || 0);
}, 0);
var remaining = Math.max(0, expected - (batched + collected));
var calc = cbtRecCalculate(data, Date.now(), mainTasks);
var recommended = cbtRecLockedValue(calc, mainTasks);
var warm = null;
var startupZeroTransition =
Date.now() < _statsStartupGraceUntil &&
mainTasks &&
mainTasks.count === 0 &&
staffingJobs.length > 0;
var provisional =
startupZeroTransition ||
!mainTasks ||
scopedStaffingJobs === null ||
!calc ||
calc.ready === false;
if (provisional) {
warm = cbtStatsPrimeStartupWarm() || cbtStatsLoadWarm(false);
if (warm) {
inProgress = warm.inProgress;
recommended = warm.recommended;
}
}
if (inProgress == null || recommended == null) {
if (!warm) warm = cbtStatsLoadWarm(false);
if (warm) {
if (inProgress == null) inProgress = warm.inProgress;
if (recommended == null) recommended = warm.recommended;
}
if (inProgress == null) {
inProgress = staffingJobs.filter(function (j) {
var st = String(j.operationState || j.state || '').toUpperCase();
return st === 'IN_PROGRESS' || st === 'BATCHING';
}).length;
}
if (recommended == null) {
try {
var recState = cbtRecLoadState();
var currentCycle = cbtStatsCurrentCycleKey();
if (recState &&
recState.cycleKey &&
currentCycle &&
String(recState.cycleKey) === String(currentCycle) &&
recState.locked != null) {
recommended = Math.max(0, Number(recState.locked) || 0);
}
} catch(eRecWarm) {}
}
}
var dotColor = warm && warm.dotColor ? warm.dotColor : 'gray';
if (recommended != null && inProgress != null && recommended > 0) {
if (inProgress >= recommended) {
dotColor = '#3fb950';
} else {
var deficit = recommended - inProgress;
var coverage = recommended > 0 ? inProgress / recommended : 1;
dotColor = (deficit >= 3 || coverage < 0.75) ? '#f85149' : '#e3b341';
}
}
var recTitle = provisional
? 'Refreshing current dashboard…'
: cbtRecTooltip(calc, recommended);
updateStats(
inProgress,
remaining,
recommended,
dotColor,
recTitle,
provisional
);
if (!startupZeroTransition &&
mainTasks &&
scopedStaffingJobs !== null &&
calc &&
calc.ready !== false &&
inProgress != null &&
recommended != null) {
cbtStatsSaveWarm(
inProgress,
remaining,
recommended,
dotColor,
cbtRecTooltip(calc, recommended),
calc.cycle && calc.cycle.key
);
} else {
cbtStatsScheduleStartupRecheck();
}
removeFromHeader();
}
var _statsFetchInFlight = false;
function fetchAndUpdate() {
if (_statsFetchInFlight || document.hidden || !isDashboardView()) return;
_statsFetchInFlight = true;
_statsLastRequestAt = Date.now();
removeFromHeader();
_origFetch(COMO_BASE + '/api/store/' + STORE_ID + '/activeJobSummary?_cbt=' + Date.now(), {
cache: 'no-store',
credentials: 'include'
})
.then(function (r) { return r.json(); })
.then(function (data) {
if (!Array.isArray(data)) data = [];
_statsLastSummaryData = data;
cbtApplyStatsData(data);
})
.catch(function () {})
.then(function(){ _statsFetchInFlight = false; });
}
var POLL_MS = 2000, TICK_MS = 500;
var WARN_ELAPSED_MIN = 15, ALERT_ELAPSED_MIN = 25;
var WARN_RATE = 2.1, ALERT_RATE = 1.5;
var CBT_MAX_VALID_RATE = 20;
var CBT_OBS_RATE_MIN_WINDOW_MS = 30000;
var _cbtObservedProgressByRef = Object.create(null);
var _cbtBackendLastOk = 0;
var _cbtLiveStartByRef = Object.create(null);
var _cbtMissingPollsByRef = Object.create(null);
var CBT_MISSING_POLL_GRACE = 3;
var CBT_STALE_LIVE_RELOAD_POLLS = 3;
var CBT_STALE_LIVE_RELOAD_COOLDOWN_MS = 15 * 60 * 1000;
var _cbtStaleLiveZeroTaskPolls = 0;
var CBT_START_RETAIN_AFTER_MISSING_MS = 30000;
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
if (n >= 1e17) n = n / 1000000;
else if (n >= 1e14) n = n / 1000;
else if (n < 1e11) n = n * 1000;
return isFinite(n) && n > 0 ? n : null;
}
function cbtTaskGeneration(data) {
if (!data || typeof data !== 'object') return '';
var fields = ['jobId','jobID','taskId','taskID','jobUuid','jobUUID','taskUuid','taskUUID'];
for (var i = 0; i < fields.length; i++) {
var v = data[fields[i]];
if (v != null && String(v).trim()) return 'job:' + String(v).trim();
}
var createdFields = ['created','createdAt','creationTime','createdTime'];
for (var c = 0; c < createdFields.length; c++) {
var createdMs = cbtNormalizeEpochMs(data[createdFields[c]]);
if (createdMs) return 'created:' + Math.round(createdMs);
}
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
if (generation && cur.generation && generation !== cur.generation) {
if (!(bothBatchFallbacks && !cur.missingSince)) replace = true;
}
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
if (!generation || !cur.generation || generation === cur.generation) return cur.ms;
}
if (isLive) {
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
if (!cur || (generation && cur.generation && generation !== cur.generation)) {
_cbtLiveStartByRef[ref] = fresh;
return fresh.ms;
}
return cur.ms;
}
return null;
}
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
function cbtHistoryStoreScope() {
return String(STORE_ID || 'unknown')
.trim()
.toUpperCase()
.replace(/[.$#\[\]\/]/g, '_') || 'UNKNOWN';
}
var CBT_HISTORY_STORE_SCOPE = cbtHistoryStoreScope();
var STORAGE_KEY = 'cbt_history_v3_' + CBT_HISTORY_STORE_SCOPE;
var DATE_KEY = 'cbt_history_date_v3_' + CBT_HISTORY_STORE_SCOPE;
var WEEKLY_KEY = 'cbt_weekly_history_v3_' + CBT_HISTORY_STORE_SCOPE;
var WEEKLY_DAYS = 7;
var ALL_NAMES_KEY = 'cbt_all_names';
var DEVICE_ID_KEY = 'cbt_device_id';
function getDeviceId() {
var id = gmGet(DEVICE_ID_KEY, null);
if (!id) {
id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
gmSet(DEVICE_ID_KEY, id);
}
return id;
}
var MY_DEVICE_ID = null;
var FIREBASE_URL = 'https://como-sync-default-rtdb.firebaseio.com';
var CBT_FIREBASE_SYNC_TIMEOUT_MS = 12000;
var FIREBASE_NAMES_PATH = '/como_names.json';
function syncEnabled() { return true; }
function syncUrl() { return FIREBASE_URL + FIREBASE_NAMES_PATH; }
var OWN_WEEKLY_KEY = 'cbt_own_weekly_v3_' + CBT_HISTORY_STORE_SCOPE;
var WEEKLY_PERIOD_KEY = 'cbt_weekly_period_start_v3_' + CBT_HISTORY_STORE_SCOPE;
var REMOTE_HISTORY_KEY = 'cbt_remote_history_cache_v3_' + CBT_HISTORY_STORE_SCOPE;
var REMOTE_HISTORY_DATE_KEY = 'cbt_remote_history_date_v3_' + CBT_HISTORY_STORE_SCOPE;
var REMOTE_WEEKLY_KEY = 'cbt_remote_weekly_cache_v3_' + CBT_HISTORY_STORE_SCOPE;
var REMOTE_WEEKLY_PERIOD_KEY = 'cbt_remote_weekly_period_start_v3_' + CBT_HISTORY_STORE_SCOPE;
function cbtNormalizeAssociateName(v) {
v = String(v == null ? '' : v).trim();
if (!v || v.length > 60) return '';
return /^[A-Za-z0-9._-]+$/.test(v) ? v : '';
}
function cbtEscHtml(v) {
return String(v == null ? '' : v)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}
var CBT_BATCH_EVENT_SCHEMA = 2;
var CBT_BATCH_EVENT_ROOT = '/como_batch_events_v1/' + CBT_HISTORY_STORE_SCOPE + '/events';
var CBT_BATCH_EVENT_LOCAL_KEY = 'cbt_batch_events_v1_local_' + CBT_HISTORY_STORE_SCOPE;
var CBT_BATCH_EVENT_REMOTE_KEY = 'cbt_batch_events_v1_remote_' + CBT_HISTORY_STORE_SCOPE;
var CBT_BATCH_EVENT_FASTEST_KEY = 'cbt_batch_events_v2_fastest_' + CBT_HISTORY_STORE_SCOPE;
var CBT_BATCH_EVENT_RECENT_ETAG_KEY = 'cbt_batch_events_v2_recent_etag_' + CBT_HISTORY_STORE_SCOPE;
var CBT_BATCH_EVENT_ALL_ETAG_KEY = 'cbt_batch_events_v2_all_etag_' + CBT_HISTORY_STORE_SCOPE;
var _cbtBatchEventPullInFlight = false;
var _cbtBatchEventAllPullInFlight = false;
var _cbtBatchEventLastPullAt = 0;
var _cbtBatchEventLastAllPullAt = 0;
var _cbtBatchEventRenderTimer = null;
var _cbtBatchRecentQueryUnsupported = false;
function cbtBatchEventUrl(eventId) {
var base = FIREBASE_URL + CBT_BATCH_EVENT_ROOT;
return base + (eventId ? ('/' + encodeURIComponent(eventId)) : '') + '.json';
}
function cbtBatchEventHash(text, seed) {
text = String(text || '');
var h1 = (0xdeadbeef ^ (seed || 0) ^ text.length) | 0;
var h2 = (0x41c6ce57 ^ (seed || 0) ^ text.length) | 0;
for (var i = 0; i < text.length; i++) {
var ch = text.charCodeAt(i);
h1 = Math.imul(h1 ^ ch, 2654435761);
h2 = Math.imul(h2 ^ ch, 1597334677);
}
h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
return ((h2 >>> 0).toString(36) + (h1 >>> 0).toString(36));
}
function cbtBatchEventDate(ms) {
ms = Number(ms) || Date.now();
try {
return new Date(ms).toLocaleDateString('en-US', { timeZone: getStoreTimezone() });
} catch(e) {
return new Date(ms).toLocaleDateString('en-US');
}
}
function cbtBatchEventId(data, startMs) {
if (!data || data.shortClientRef == null) return '';
var ref = String(data.shortClientRef || data.ref || '').trim();
var gen = String(data.generation || cbtTaskGeneration(data) || '').trim();
var start = Number(startMs || data.startMs) || 0;
var identity = '';
if (/^(?:job|created):/.test(gen)) identity = gen;
else if (gen) identity = gen + '|' + ref;
else if (ref && start) identity = 'ref:' + ref + '|start:' + Math.round(start / 1000);
else return '';
var raw = CBT_HISTORY_STORE_SCOPE + '|' + identity;
return 'e_' + cbtBatchEventHash(raw, 17) + '_' + cbtBatchEventHash(raw.split('').reverse().join(''), 97);
}
function cbtBatchEventCompletionMs(data, startMs, endMs, elapsedSec) {
var end = Number(endMs) || 0;
if (end > 0) return end;
var fields = ['completedAt','completionTime','completedTime','endedAt','endTime'];
for (var i = 0; i < fields.length; i++) {
var ms = cbtNormalizeEpochMs(data && data[fields[i]]);
if (ms && (!startMs || ms >= Number(startMs))) return ms;
}
if (Number(startMs) > 0 && Number(elapsedSec) > 0) {
return Number(startMs) + Number(elapsedSec) * 1000;
}
return (typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now();
}
function cbtSanitizeBatchEvent(e, fallbackId) {
if (!e || typeof e !== 'object') return null;
var assoc = cbtNormalizeAssociateName(e.assoc || '');
var pkgs = Number(e.pkgs) || 0;
var elapsedSec = Number(e.elapsedSec) || 0;
var completedAt = Number(e.completedAt) || 0;
if (!assoc) return null;
if (!(pkgs > 0) || pkgs > 5000) return null;
if (!(elapsedSec >= 30) || elapsedSec > 12 * 3600) return null;
if (!(completedAt > 0) || !isFinite(completedAt)) return null;
var rate = pkgs / (elapsedSec / 60);
if (!(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return null;
var generation = String(e.generation || '').trim();
var ref = String(e.ref || '').trim();
var startMs = Number(e.startMs) || 0;
var canonicalId = cbtBatchEventId({
shortClientRef: ref,
ref: ref,
generation: generation,
startMs: startMs
}, startMs);
var eventId = canonicalId || String(e.eventId || fallbackId || '').trim();
if (!eventId) return null;
var dateKey = cbtBatchEventDate(completedAt);
var clean = {
schema: CBT_BATCH_EVENT_SCHEMA,
eventId: eventId,
storeId: CBT_HISTORY_STORE_SCOPE,
assoc: assoc,
ref: ref,
generation: generation,
startMs: startMs,
completedAt: completedAt,
observedAt: Math.max(0, Number(e.observedAt) || Number(e.recordedAt) || completedAt),
dateKey: dateKey,
weekStart: cbtWeekStartForDateKey(dateKey) || dateKey,
pkgs: pkgs,
elapsedSec: elapsedSec,
rate: rate,
expected: Math.max(0, Number(e.expected) || 0),
missing: Math.max(0, Number(e.missing) || 0),
quality: Math.max(1, Number(e.quality) || 1)
};
if (clean.missing > clean.expected && clean.expected > 0) clean.missing = clean.expected;
return clean;
}
function cbtBatchEventScore(e) {
if (!e) return -1;
return (Number(e.quality) || 0) * 1e12 +
(Number(e.pkgs) || 0) * 1e7 +
(Number(e.expected) || 0) * 1e3 +
Math.min(999999, Number(e.elapsedSec) || 0);
}
function cbtChooseBatchEvent(a, b) {
a = cbtSanitizeBatchEvent(a, a && a.eventId);
b = cbtSanitizeBatchEvent(b, b && b.eventId);
if (!a) return b;
if (!b) return a;
var sa = cbtBatchEventScore(a), sb = cbtBatchEventScore(b);
if (sb > sa) return b;
if (sa > sb) return a;
return Number(b.observedAt || 0) > Number(a.observedAt || 0) ? b : a;
}
function cbtFirebaseEtag(headers) {
var m = String(headers || '').match(/(?:^|\r?\n)etag:\s*([^\r\n]+)/i);
return m ? m[1].trim() : '';
}
function cbtPruneRecentEventMap(map) {
var out = {}, floor = ((typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now()) - 10 * 86400000;
for (var id in (map || {})) {
var ev = cbtSanitizeBatchEvent(map[id], id);
if (!ev || Number(ev.completedAt) < floor) continue;
out[ev.eventId] = cbtChooseBatchEvent(out[ev.eventId], ev);
}
return out;
}
function cbtBatchEventRecentUrl() {
var weekUtc = cbtDateKeyEpoch(currentWeekStartStr());
var floor = isFinite(weekUtc) ? weekUtc - 14 * 3600000 : ((typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now()) - 8 * 86400000;
return cbtBatchEventUrl('') + '?orderBy=%22completedAt%22&startAt=' + Math.floor(floor);
}
var _cbtFastestSnapshotCache = null;
var _cbtNameSourceRevision = 1;
var _cbtNamesLastSourceRevision = -1;
function cbtFastestSnapshotLoad() {
if (_cbtFastestSnapshotCache) return _cbtFastestSnapshotCache;
try {
var raw = gmGet(CBT_BATCH_EVENT_FASTEST_KEY, null);
if (!raw) raw = localStorage.getItem(CBT_BATCH_EVENT_FASTEST_KEY);
var obj = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
if (!obj || typeof obj !== 'object') obj = {};
if (!obj.stats) obj.stats = {totals:{},peaks:{},latest:{}};
if (!obj.recentIds || typeof obj.recentIds !== 'object') obj.recentIds = {};
obj.pulledAt = Number(obj.pulledAt) || 0;
_cbtFastestSnapshotCache = obj;
return _cbtFastestSnapshotCache;
} catch(e) {
_cbtFastestSnapshotCache = { pulledAt:0, recentIds:{}, stats:{totals:{},peaks:{},latest:{}} };
return _cbtFastestSnapshotCache;
}
}
function cbtFastestSnapshotSave(stats, pulledAt, recentIds) {
var obj = {
pulledAt:Number(pulledAt)||((typeof cbtNowMs === 'function')?cbtNowMs():Date.now()),
recentIds:recentIds || {},
stats:stats || {totals:{},peaks:{},latest:{}}
};
_cbtFastestSnapshotCache = obj;
_cbtEventFastestStatsCache = null;
_cbtNameSourceRevision++;
var json = JSON.stringify(obj);
gmSet(CBT_BATCH_EVENT_FASTEST_KEY, json);
try { localStorage.setItem(CBT_BATCH_EVENT_FASTEST_KEY, json); } catch(e) {}
}
function cbtApplyEventToFastestStats(stats, e) {
if (!stats) stats = { totals:{}, peaks:{}, latest:{} };
if (!stats.totals) stats.totals = {};
if (!stats.peaks) stats.peaks = {};
if (!stats.latest) stats.latest = {};
e = cbtSanitizeBatchEvent(e, e && e.eventId);
if (!e) return stats;
var key = hofKey(e.assoc);
if (!key) return stats;
var t = stats.totals[key];
if (!t) t = stats.totals[key] = { assoc:e.assoc, runs:0, pkgs:0 };
t.assoc = e.assoc || t.assoc;
t.runs += 1;
t.pkgs += e.pkgs;
var l = stats.latest[key];
if (!l || e.completedAt > Number(l.at || 0)) {
stats.latest[key] = { assoc:e.assoc,rate:e.rate,at:e.completedAt,pkgs:e.pkgs,elapsedSec:e.elapsedSec,schema:HOF_SCHEMA,calc:'uniqueBatchEvent/fullBatchingSpan' };
}
if (e.pkgs >= HOF_MIN_PKGS && e.elapsedSec >= HOF_MIN_SEC) {
var p = stats.peaks[key];
if (!p || e.rate > Number(p.rate || 0)) {
stats.peaks[key] = { assoc:e.assoc,rate:e.rate,at:e.completedAt,pkgs:e.pkgs,elapsedSec:e.elapsedSec,schema:HOF_SCHEMA,calc:'uniqueBatchEvent/fullBatchingSpan' };
}
}
return stats;
}
function cbtFastestStatsFromEvents(events) {
var stats = { totals:{}, peaks:{}, latest:{} };
for (var id in (events || {})) cbtApplyEventToFastestStats(stats, events[id]);
return stats;
}
function cbtLoadBatchEventMap(key) {
var out = {};
try {
var gm = gmGet(key, null);
if (gm) out = (typeof gm === 'string') ? JSON.parse(gm) : gm;
} catch(e0) {}
try {
var ls = JSON.parse(localStorage.getItem(key) || '{}');
for (var id in ls) out[id] = cbtChooseBatchEvent(out[id], ls[id]);
} catch(e1) {}
var clean = {};
for (var k in (out || {})) {
var ev = cbtSanitizeBatchEvent(out[k], k);
if (ev) clean[ev.eventId] = cbtChooseBatchEvent(clean[ev.eventId], ev);
}
return cbtPruneRecentEventMap(clean);
}
function cbtSaveBatchEventMap(key, map) {
map = cbtPruneRecentEventMap(map || {});
if (key === CBT_BATCH_EVENT_LOCAL_KEY) _cbtLocalBatchEventsCache = map;
if (key === CBT_BATCH_EVENT_REMOTE_KEY) _cbtRemoteBatchEventsCache = map;
_cbtAllBatchEventsCache = null;
var json = JSON.stringify(map);
gmSet(key, json);
try { localStorage.setItem(key, json); } catch(e) {}
}
var _cbtLocalBatchEventsCache = null;
var _cbtRemoteBatchEventsCache = null;
var _cbtAllBatchEventsCache = null;
function cbtLoadLocalBatchEvents() {
if (_cbtLocalBatchEventsCache) return _cbtLocalBatchEventsCache;
_cbtLocalBatchEventsCache = cbtLoadBatchEventMap(CBT_BATCH_EVENT_LOCAL_KEY);
return _cbtLocalBatchEventsCache;
}
function cbtLoadRemoteBatchEvents() {
if (_cbtRemoteBatchEventsCache) return _cbtRemoteBatchEventsCache;
_cbtRemoteBatchEventsCache = cbtLoadBatchEventMap(CBT_BATCH_EVENT_REMOTE_KEY);
return _cbtRemoteBatchEventsCache;
}
function cbtAllBatchEvents() {
if (_cbtAllBatchEventsCache) return _cbtAllBatchEventsCache;
var out = {};
var remote = cbtLoadRemoteBatchEvents();
var local = cbtLoadLocalBatchEvents();
for (var rid in remote) out[rid] = remote[rid];
for (var id in local) out[id] = cbtChooseBatchEvent(out[id], local[id]);
_cbtAllBatchEventsCache = cbtPruneRecentEventMap(out);
return _cbtAllBatchEventsCache;
}
function cbtInvalidateEventViews() {
_cbtNameSourceRevision++;
_dispHistCache = null;
_dispWeekCache = null;
_cbtEventFastestStatsCache = null;
_cbtDataNameSetCache = null;
_cbtDataNameSetAt = 0;
}
function cbtScheduleEventRender() {
cbtInvalidateEventViews();
if (_cbtBatchEventRenderTimer) return;
_cbtBatchEventRenderTimer = setTimeout(function(){
_cbtBatchEventRenderTimer = null;
try {
if (activeTab === 'history') renderHistory();
else if (activeTab === 'weekly') renderWeekly();
else if (activeTab === 'hof') renderHallOfFame();
} catch(e) {}
try { requestUnifiedSearchCount(); } catch(e2) {}
}, 0);
}
function cbtSaveLocalBatchEvent(event) {
event = cbtSanitizeBatchEvent(event, event && event.eventId);
if (!event) return false;
var map = cbtLoadLocalBatchEvents();
var chosen = cbtChooseBatchEvent(map[event.eventId], event);
if (map[event.eventId] && JSON.stringify(chosen) === JSON.stringify(map[event.eventId])) return false;
map[event.eventId] = chosen;
cbtSaveBatchEventMap(CBT_BATCH_EVENT_LOCAL_KEY, map);
cbtScheduleEventRender();
return true;
}
function cbtPushBatchEvent(event, done, attempt) {
event = cbtSanitizeBatchEvent(event, event && event.eventId);
if (!event || !syncEnabled()) { if (done) done(false); return; }
attempt = Number(attempt) || 0;
var url = cbtBatchEventUrl(event.eventId);
try {
GM_xmlhttpRequest({
method: 'GET', url: url,
headers: { 'Content-Type':'application/json', 'X-Firebase-ETag':'true' },
timeout: CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload: function(getRes) {
if (!(getRes.status >= 200 && getRes.status < 300)) {
if (done) done(false); return;
}
var existing = null;
try {
if (getRes.responseText && getRes.responseText !== 'null') {
existing = cbtSanitizeBatchEvent(JSON.parse(getRes.responseText), event.eventId);
}
} catch(e0) {}
var merged = cbtChooseBatchEvent(existing, event);
if (existing && JSON.stringify(merged) === JSON.stringify(existing)) {
var remote0 = cbtLoadRemoteBatchEvents();
remote0[merged.eventId] = cbtChooseBatchEvent(remote0[merged.eventId], merged);
cbtSaveBatchEventMap(CBT_BATCH_EVENT_REMOTE_KEY, remote0);
if (done) done(true); return;
}
var etag = cbtFirebaseEtag(getRes.responseHeaders);
if (!etag) { if (done) done(false); return; }
GM_xmlhttpRequest({
method: 'PUT', url: url,
headers: { 'Content-Type':'application/json', 'If-Match':etag },
data: JSON.stringify(merged),
timeout: CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload: function(putRes) {
if (putRes.status === 412 && attempt < 3) {
setTimeout(function(){ cbtPushBatchEvent(event, done, attempt + 1); }, 80 * (attempt + 1));
return;
}
if (putRes.status >= 200 && putRes.status < 300) {
var remote = cbtLoadRemoteBatchEvents();
remote[merged.eventId] = cbtChooseBatchEvent(remote[merged.eventId], merged);
cbtSaveBatchEventMap(CBT_BATCH_EVENT_REMOTE_KEY, remote);
cbtScheduleEventRender();
if (done) done(true);
return;
}
if (done) done(false);
},
onerror: function(){ if (done) done(false); },
ontimeout: function(){ if (done) done(false); }
});
},
onerror: function(){ if (done) done(false); },
ontimeout: function(){ if (done) done(false); }
});
} catch(e) { if (done) done(false); }
}
function cbtPushMissingLocalBatchEvents(remote) {
remote = remote || {};
var local = cbtLoadLocalBatchEvents();
var sent = 0;
for (var id in local) {
var ev = local[id];
if (!ev || !cbtIsDateInCurrentWeek(ev.dateKey)) continue;
var chosen = cbtChooseBatchEvent(remote[id], ev);
if (remote[id] && JSON.stringify(chosen) === JSON.stringify(remote[id])) continue;
cbtPushBatchEvent(ev);
if (++sent >= 25) break;
}
}
function cbtBatchEventsPull(cb) {
if (!syncEnabled()) { if (cb) cb(false); return; }
if (_cbtBatchEventPullInFlight) { if (cb) cb(false); return; }
_cbtBatchEventPullInFlight = true;
function finishFromRaw(raw, etag, etagKey) {
var remote = {};
try {
raw = raw || {};
for (var id in raw) {
var ev = cbtSanitizeBatchEvent(raw[id], id);
if (!ev || !cbtIsDateInCurrentWeek(ev.dateKey)) continue;
remote[ev.eventId] = cbtChooseBatchEvent(remote[ev.eventId], ev);
}
} catch(e0) {}
var old = cbtLoadRemoteBatchEvents();
var changed = JSON.stringify(old) !== JSON.stringify(remote);
cbtSaveBatchEventMap(CBT_BATCH_EVENT_REMOTE_KEY, remote);
if (etag && etagKey) { gmSet(etagKey, etag); try { localStorage.setItem(etagKey, etag); } catch(e1) {} }
cbtPushMissingLocalBatchEvents(remote);
if (changed) cbtScheduleEventRender();
_cbtBatchEventPullInFlight = false;
_cbtBatchEventLastPullAt = Date.now();
if (cb) cb(changed);
}
function request(useFull) {
var url = useFull ? cbtBatchEventUrl('') : cbtBatchEventRecentUrl();
var etagKey = useFull ? (CBT_BATCH_EVENT_RECENT_ETAG_KEY + '_full') : (CBT_BATCH_EVENT_RECENT_ETAG_KEY + '_' + currentWeekStartStr().replace(/[^0-9]/g,'_'));
var etag = '';
try { etag = gmGet(etagKey, null) || localStorage.getItem(etagKey) || ''; } catch(e2) {}
var headers = { 'Content-Type':'application/json', 'X-Firebase-ETag':'true' };
if (etag) headers['If-None-Match'] = etag;
GM_xmlhttpRequest({
method:'GET', url:url, headers:headers,
timeout:CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload:function(res){
if (res.status === 304) {
_cbtBatchEventPullInFlight = false;
_cbtBatchEventLastPullAt = Date.now();
cbtPushMissingLocalBatchEvents(cbtLoadRemoteBatchEvents());
if (cb) cb(false);
return;
}
if (res.status >= 200 && res.status < 300) {
var raw = {};
try {
raw = res.responseText && res.responseText !== 'null' ? (JSON.parse(res.responseText) || {}) : {};
} catch(e3) {
_cbtBatchEventPullInFlight = false;
if (cb) cb(false);
return;
}
finishFromRaw(raw, cbtFirebaseEtag(res.responseHeaders), etagKey);
return;
}
if (!useFull) {
_cbtBatchRecentQueryUnsupported = true;
request(true);
return;
}
_cbtBatchEventPullInFlight = false;
if (cb) cb(false);
},
onerror:function(){
if (!useFull) { _cbtBatchRecentQueryUnsupported = true; try { request(true); return; } catch(e4) {} }
_cbtBatchEventPullInFlight = false;
if (cb) cb(false);
},
ontimeout:function(){
if (!useFull) { _cbtBatchRecentQueryUnsupported = true; try { request(true); return; } catch(e5) {} }
_cbtBatchEventPullInFlight = false;
if (cb) cb(false);
}
});
}
try { request(_cbtBatchRecentQueryUnsupported); }
catch(e) { _cbtBatchEventPullInFlight = false; if (cb) cb(false); }
}
function cbtBatchEventsPullAllTime(cb, force) {
if (!syncEnabled()) { if (cb) cb(false); return; }
if (_cbtBatchEventAllPullInFlight) { if (cb) cb(false); return; }
if (!force && _cbtBatchEventLastAllPullAt && Date.now() - _cbtBatchEventLastAllPullAt < 5 * 60 * 1000) {
if (cb) cb(false); return;
}
_cbtBatchEventAllPullInFlight = true;
var etag = '';
try { etag = gmGet(CBT_BATCH_EVENT_ALL_ETAG_KEY, null) || localStorage.getItem(CBT_BATCH_EVENT_ALL_ETAG_KEY) || ''; } catch(e0) {}
try { if (!(cbtFastestSnapshotLoad().pulledAt > 0)) etag = ''; } catch(eSnap) { etag = ''; }
var headers = { 'Content-Type':'application/json', 'X-Firebase-ETag':'true' };
if (etag) headers['If-None-Match'] = etag;
try {
GM_xmlhttpRequest({
method:'GET', url:cbtBatchEventUrl(''), headers:headers,
timeout:CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload:function(res){
_cbtBatchEventAllPullInFlight = false;
_cbtBatchEventLastAllPullAt = Date.now();
if (res.status === 304) { if (cb) cb(false); return; }
if (!(res.status >= 200 && res.status < 300)) { if (cb) cb(false); return; }
var canonical = {}, current = {};
try {
var raw = res.responseText && res.responseText !== 'null' ? (JSON.parse(res.responseText) || {}) : {};
for (var id in raw) {
var ev = cbtSanitizeBatchEvent(raw[id], id);
if (!ev) continue;
canonical[ev.eventId] = cbtChooseBatchEvent(canonical[ev.eventId], ev);
}
} catch(e1) {
if (cb) cb(false);
return;
}
var recentIds = {}, recentFloor = ((typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now()) - 10 * 86400000;
for (var rid in canonical) if (Number(canonical[rid].completedAt) >= recentFloor) recentIds[rid] = true;
cbtFastestSnapshotSave(cbtFastestStatsFromEvents(canonical), ((typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now()), recentIds);
for (var cid in canonical) {
if (cbtIsDateInCurrentWeek(canonical[cid].dateKey)) current[cid] = canonical[cid];
}
cbtSaveBatchEventMap(CBT_BATCH_EVENT_REMOTE_KEY, current);
var newEtag = cbtFirebaseEtag(res.responseHeaders);
if (newEtag) { gmSet(CBT_BATCH_EVENT_ALL_ETAG_KEY, newEtag); try { localStorage.setItem(CBT_BATCH_EVENT_ALL_ETAG_KEY, newEtag); } catch(e2) {} }
cbtScheduleEventRender();
if (cb) cb(true);
},
onerror:function(){ _cbtBatchEventAllPullInFlight = false; if (cb) cb(false); },
ontimeout:function(){ _cbtBatchEventAllPullInFlight = false; if (cb) cb(false); }
});
} catch(e) { _cbtBatchEventAllPullInFlight = false; if (cb) cb(false); }
}
function cbtAggregateBatchEvents(dateFilter) {
var outByKey = Object.create(null);
var events = cbtAllBatchEvents();
for (var id in events) {
var e = events[id];
if (!e || (dateFilter && e.dateKey !== dateFilter)) continue;
var key = String(e.assoc || '').trim().toLowerCase();
if (!key) continue;
var r = outByKey[key];
if (!r) r = outByKey[key] = { assoc:e.assoc,totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,bestRate:null,lastRate:null,lastAt:0 };
r.totalPkgs += e.pkgs;
r.totalSec += e.elapsedSec;
r.runs += 1;
r.totalMissing += e.missing || 0;
r.totalExpected += e.expected || 0;
if (!(Number(r.bestRate) > 0) || e.rate > Number(r.bestRate)) r.bestRate = e.rate;
if (!(Number(r.lastAt) > 0) || e.completedAt > Number(r.lastAt)) {
r.lastRate = e.rate; r.lastAt = e.completedAt; r.assoc = e.assoc || r.assoc;
}
}
var out = {};
for (var key2 in outByKey) {
var x = outByKey[key2];
x.avgRate = x.totalSec > 0 ? x.totalPkgs / (x.totalSec / 60) : 0;
out[key2] = x;
}
return out;
}
function cbtAggregateWeeklyBatchEvents() {
var out = {}, events = cbtAllBatchEvents();
for (var id in events) {
var e = events[id];
if (!e || !cbtIsDateInCurrentWeek(e.dateKey)) continue;
var dk = e.dateKey, key = String(e.assoc || '').trim().toLowerCase();
if (!key) continue;
if (!out[dk]) out[dk] = {};
if (!out[dk][key]) out[dk][key] = { assoc:e.assoc,totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,bestRate:null,lastRate:null,lastAt:0 };
var r = out[dk][key];
r.totalPkgs += e.pkgs; r.totalSec += e.elapsedSec; r.runs += 1;
r.totalMissing += e.missing || 0; r.totalExpected += e.expected || 0;
if (!(Number(r.bestRate) > 0) || e.rate > Number(r.bestRate)) r.bestRate = e.rate;
if (!(Number(r.lastAt) > 0) || e.completedAt > Number(r.lastAt)) {
r.lastRate = e.rate; r.lastAt = e.completedAt; r.assoc = e.assoc || r.assoc;
}
r.avgRate = r.totalSec > 0 ? r.totalPkgs / (r.totalSec / 60) : 0;
}
return out;
}
var _cbtEventFastestStatsCache = null;
function cbtEventFastestStats() {
if (_cbtEventFastestStatsCache) return _cbtEventFastestStatsCache;
var snap = cbtFastestSnapshotLoad();
var base = snap && snap.stats ? snap.stats : { totals:{}, peaks:{}, latest:{} };
var stats = {
totals: JSON.parse(JSON.stringify(base.totals || {})),
peaks: JSON.parse(JSON.stringify(base.peaks || {})),
latest: JSON.parse(JSON.stringify(base.latest || {}))
};
var recentIds = (snap && snap.recentIds) || {};
var recent = cbtAllBatchEvents();
for (var id in recent) {
var ev = recent[id];
if (!recentIds[id]) cbtApplyEventToFastestStats(stats, ev);
}
_cbtEventFastestStatsCache = stats;
return _cbtEventFastestStatsCache;
}
var taskCache = new Map();
var activeTab = 'live';
var _cbtLiveDashboardSyncPending = false;
var _liveRenderPending = false;
function requestLiveRender() {
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
var liveSortUser = false;
var historySortKey = 'bestRate', historySortAsc = false, historySearchTerm = '';
var namesSearchTerm = '';
var hofSearchTerm = '';
var dashboardSearchTerm = '';
var _allNamesCache = null;
function todayStr() {
var nowMs = Date.now();
try { if (typeof cbtNowMs === 'function') nowMs = cbtNowMs(); } catch(e0) {}
try {
return new Date(nowMs).toLocaleDateString('en-US', { timeZone: getStoreTimezone() });
} catch(e) {
return new Date(nowMs).toLocaleDateString('en-US');
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
var dow = new Date(ms).getUTCDay();
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
}
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
}
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
function getDisplayWeekly() {
var _now = Date.now();
if (_dispWeekCache && (_now - _dispWeekTime) < 1500) return _dispWeekCache;
var out = sanitizeWeekly(cbtAggregateWeeklyBatchEvents());
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
var HEADER_FIXED_SCALE = 1.3;
var STATS_FIXED_SCALE = 1.3;
var MISSING_QR_FIXED_SCALE = 1.3;
var UI_SCALE_KEY = 'cbt_ui_scale';
var UI_SCALE_MIN = 0.7, UI_SCALE_MAX = 2.0, UI_SCALE_STEP = 0.1, UI_SCALE_DEFAULT = 1;
var _uiScale = UI_SCALE_DEFAULT;
function clampUiScale(v) {
v = parseFloat(v);
if (!v || isNaN(v)) v = UI_SCALE_DEFAULT;
return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(v * 100) / 100));
}
function loadUiScale() {
var raw = gmGet(UI_SCALE_KEY, null);
if (raw == null) { try { raw = localStorage.getItem(UI_SCALE_KEY); } catch(e) {} }
if (raw == null) return UI_SCALE_DEFAULT;
return clampUiScale(raw);
}
function saveUiScale(v) {
gmSet(UI_SCALE_KEY, String(v));
try { localStorage.setItem(UI_SCALE_KEY, String(v)); } catch(e) {}
}
var _uiScaleLoaded = false;
function applyUiScale() {
if (!_uiScaleLoaded) {
_uiScaleLoaded = true;
try { _uiScale = loadUiScale(); } catch(e) {}
}
var z = _uiScale;
var panel = document.getElementById('cbt-panel');
if (panel) {
var hdr = panel.querySelector('#cbt-header');
if (hdr) hdr.style.zoom = HEADER_FIXED_SCALE;
var stats = panel.querySelector('#cbt-stats-bar');
if (stats) stats.style.zoom = STATS_FIXED_SCALE;
['#cbt-tabs', '#cbt-unified-search', '#cbt-body', '#cbt-drag-bottom'].forEach(function(sel){
var el = panel.querySelector(sel);
if (el) el.style.zoom = z;
});
}
var afa = document.getElementById('cbt-afa-card');
if (afa) {
var afaScale = afa.classList.contains('cbt-afa-missing-qr-card')
? MISSING_QR_FIXED_SCALE
: z;
afa.style.zoom = afaScale;
afa.style.maxHeight = Math.round((window.innerHeight * 0.82) / afaScale) + 'px';
afa.style.maxWidth = Math.round((window.innerWidth * 0.92) / afaScale) + 'px';
}
var drop = document.getElementById('cbt-ac-drop');
if (drop) {
drop.style.zoom = z;
try { acPlace(); } catch(e) {}
}
var label = document.getElementById('cbt-scale-reset');
if (label) label.textContent = Math.round(z * 100) + '%';
}
function isDarkMode() {
var p = document.getElementById('cbt-panel');
if (p) return p.classList.contains('dark');
try {
var v = localStorage.getItem('cbt_dark');
return v !== 'false' && v !== '0';
} catch(e) { return true; }
}
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
function resetUiScale() { setUiScale(UI_SCALE_DEFAULT); }
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
for (var lk in legacy) if (!_allNamesCache[lk]) _allNamesCache[lk] = legacy[lk];
} catch(e2) {}
var safe = {};
for (var nk in _allNamesCache) {
var nv = cbtNormalizeAssociateName(_allNamesCache[nk]);
if (nv) safe[nv.toLowerCase()] = nv;
}
_allNamesCache = safe;
for (var si = 0; si < SEED_NAMES.length; si++) {
var sname = cbtNormalizeAssociateName(SEED_NAMES[si]);
if (!sname) continue;
var skey = sname.toLowerCase();
if (!_allNamesCache[skey]) _allNamesCache[skey] = sname;
}
var sjson = JSON.stringify(_allNamesCache);
gmSet(ALL_NAMES_KEY, sjson);
try { localStorage.setItem(ALL_NAMES_KEY, sjson); } catch(e3) {}
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
var _namesPulled = false;
var _namesPushQueued = false;
var _namesFirstPullRetry = null;
function mergeRemoteNamesIntoLocal(remote) {
var all = loadAllNames();
var added = false;
for (var k in (remote || {})) {
var n = cbtNormalizeAssociateName(remote[k]);
if (!n) continue;
var key = n.toLowerCase();
if (!all[key]) { all[key] = n; added = true; }
}
if (added) { persistAllNames(); if (activeTab === 'names') renderNames(); }
return added;
}
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
timeout: CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload: function(res){
var added = false, localExtra = false;
try {
var remote = {};
if (res.status >= 200 && res.status < 300 && res.responseText && res.responseText !== 'null') {
remote = JSON.parse(res.responseText) || {};
}
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
},
ontimeout: function(){
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
GM_xmlhttpRequest({
method: 'PATCH', url: syncUrl(),
headers: { 'Content-Type': 'application/json' },
data: JSON.stringify(all),
timeout: CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload: function(){},
onerror: function(){ _namesPushQueued = true; },
ontimeout: function(){ _namesPushQueued = true; }
});
} catch(e) {}
}, 2500);
}
function captureName(item) {
if (!item || typeof item !== 'object') return false;
var name = cbtNormalizeAssociateName(item.associateId || item.associate || item.driverAssignment || '');
if (!name) return false;
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
n = cbtNormalizeAssociateName(n || '');
if (!n) return false;
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
if (_cbtNamesLastSourceRevision !== _cbtNameSourceRevision) {
try {
var events = cbtAllBatchEvents();
Object.keys(events).forEach(function(id){
var ev = events[id];
if (ev && addNameToAll(all, ev.assoc || '')) added = true;
});
} catch(e) {}
try {
var fs = cbtEventFastestStats(), totals = fs.totals || {};
Object.keys(totals).forEach(function(k){
if (addNameToAll(all, totals[k].assoc || k)) added = true;
});
} catch(e2) {}
_cbtNamesLastSourceRevision = _cbtNameSourceRevision;
}
if (added) { persistAllNames(); syncPush(); }
return added;
}
function pruneWeeklyOlderThan(days) {
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
var sd = gmGet(DATE_KEY, null) || localStorage.getItem(DATE_KEY);
if (!sd) return;
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
function cbtHistoryEntryHasData(e) {
if (!e || typeof e !== 'object') return false;
return (Number(e.runs) || 0) > 0 ||
(Number(e.totalPkgs) || 0) > 0 ||
(Number(e.totalSec) || 0) > 0 ||
(Number(e.bestRate) || 0) > 0 ||
(Number(e.lastRate) || 0) > 0 ||
(Number(e.totalMissing) || 0) > 0 ||
(Number(e.totalExpected) || 0) > 0;
}
function sanitizeHistory(h) {
var clean = {};
for (var a in (h || {})) {
var e = h[a];
if (!e || typeof e !== 'object') continue;
if (!cbtHistoryEntryHasData(e)) continue;
var pkgs = Number(e.totalPkgs) || 0;
var runs = Number(e.runs) || 0;
var sec = Number(e.totalSec) || 0;
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
try { pruneWeeklyOlderThan(WEEKLY_DAYS); } catch(e1) {}
return false;
}
var savedWeek = savedDay ? cbtWeekStartForDateKey(savedDay) : null;
var crossedWeek = !!(savedDay && savedWeek && savedWeek !== currentWeek);
if (savedDay && !crossedWeek) {
try { rollDailyIntoWeekly(); } catch(e2) {}
}
if (crossedWeek) {
saveWeekly({}, true, currentWeek);
saveRemoteWeekly({}, currentWeek);
_dispWeekCache = null;
} else {
try { pruneWeeklyOlderThan(WEEKLY_DAYS); } catch(e4) {}
}
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
if (document.getElementById('cbt-hist-tbody')) {
try { renderHistory(); } catch(e9) {}
}
if (document.getElementById('cbt-weekly-tbody')) {
try { renderWeekly(); } catch(e10) {}
}
try { cbtBatchEventsPull(); } catch(e11) {}
return true;
}
function cbtScheduleTodayBoundary() {
if (_todayBoundaryTimer) {
try { clearTimeout(_todayBoundaryTimer); } catch(e0) {}
_todayBoundaryTimer = null;
}
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
function saveRemoteHistory(h, dateKey) {
_dispHistCache = null;
_dispWeekCache = null;
var json = JSON.stringify(h || {});
var dk = dateKey || todayStr();
gmSet(REMOTE_HISTORY_KEY, json);
gmSet(REMOTE_HISTORY_DATE_KEY, dk);
try {
localStorage.setItem(REMOTE_HISTORY_KEY, json);
localStorage.setItem(REMOTE_HISTORY_DATE_KEY, dk);
} catch(e) {}
}
function getDisplayHistory() {
var _now = Date.now();
if (_dispHistCache && (_now - _dispHistTime) < 1500) return _dispHistCache;
var out = sanitizeHistory(cbtAggregateBatchEvents(todayStr()));
_dispHistCache = out; _dispHistTime = _now;
return out;
}
var HOF_MIN_PKGS = 20;
var HOF_MIN_SEC = 120;
var HOF_TOP = 30;
var HOF_SCHEMA = 2;
var HOF_PEAKS_KEY = 'cbt_hof_v2_peaks';
var HOF_LATEST_KEY = 'cbt_hof_v2_latest';
function hofKey(assoc) {
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
function hofLoadPeaks() { return hofLoadJson(HOF_PEAKS_KEY) || {}; }
function hofSavePeaks(p) { hofSaveJson(HOF_PEAKS_KEY, p); }
function hofLoadLatest() { return hofLoadJson(HOF_LATEST_KEY) || {}; }
function hofSaveLatest(p) { hofSaveJson(HOF_LATEST_KEY, p); }
function hofWhen(ts) {
if (!ts) return '\u2014';
try {
var d = new Date(ts);
if (isNaN(d.getTime())) return '\u2014';
return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
} catch(e) { return '\u2014'; }
}
function renderHallOfFame() {
var tbody = document.getElementById('cbt-hof-tbody');
if (!tbody) return;
var emptyEl = document.getElementById('cbt-hof-empty');
var noteEl = document.getElementById('cbt-hof-note');
var eventStats = cbtEventFastestStats();
var peaks = eventStats.peaks;
var latest = eventStats.latest;
var own = eventStats.totals;
var remote = {};
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
at: p && p.at ? p.at : (l && l.at ? l.at : null),
latestRate: latestRate,
latestAt: l && l.at ? l.at : null,
runs: (o.runs || 0) + (r.runs || 0),
pkgs: (o.pkgs || 0) + (r.pkgs || 0)
});
}
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
var peakRank = 0;
for (var ri = 0; ri < rows.length; ri++) {
rows[ri].rank = Number(rows[ri].rate) > 0 ? (++peakRank) : null;
}
var hofTerm = (hofSearchTerm || '').toLowerCase().trim();
if (hofTerm) {
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
if (priority > cur._priority) {
cur._priority = priority;
cur.runs = Number(runs) || 0;
cur.pkgs = Number(pkgs) || 0;
}
}
var totalKeys = Object.create(null), kk;
for (kk in own) totalKeys[kk] = true;
for (kk in remote) totalKeys[kk] = true;
for (kk in totalKeys) {
var oo = own[kk] || {}, rr = remote[kk] || {};
addSearchOnly(kk, oo.assoc || rr.assoc || kk,
(oo.runs || 0) + (rr.runs || 0),
(oo.pkgs || 0) + (rr.pkgs || 0), 3);
}
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
var todaySearchData = getDisplayHistory();
for (kk in todaySearchData) {
var td = todaySearchData[kk] || {};
addSearchOnly(hofKey(td.assoc || kk), td.assoc || kk, td.runs, td.totalPkgs, 1);
}
var savedRoster = loadAllNames();
for (var sk in savedRoster) {
var sn = savedRoster[sk];
if (String(sn || '').toLowerCase().indexOf(hofTerm) !== -1) addSearchOnly(hofKey(sn), sn, 0, 0, 0);
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
var rk = (typeof e.rank === 'number') ? e.rank : null;
var rankTxt = rk ? rk : '\u2013';
var rankCls = rk === 1 ? 'gold' : rk === 2 ? 'silver' : rk === 3 ? 'bronze' : '';
var rowCls = (rk && rk <= 3) ? (' class="cbt-hof-' + rk + '"') : '';
html += '<tr' + rowCls + '>' +
'<td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc">' +
'<span class="cbt-rank ' + rankCls + '">' + rankTxt + '</span>' + cbtEscHtml(e.assoc) +
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
document.querySelectorAll('.cbt-copied-tag').forEach(function(t){ if (t.parentNode) t.parentNode.removeChild(t); });
document.querySelectorAll('.cbt-copied-name').forEach(function(n){ n.classList.remove('cbt-copied-name'); });
if (!el) return;
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
var clockMs = (!inProg && endMs && startMs && endMs >= startMs) ? endMs : nowMs;
var elapsedSec = startMs ? Math.max(0, (clockMs - startMs) / 1000) : null;
var fullRate = (batchedN > 0 && elapsedSec > 30)
? batchedN / (elapsedSec / 60)
: null;
var scanRate = null;
var rateSource = 'pending';
if (fullRate != null && isFinite(fullRate) && fullRate > 0 &&
fullRate <= CBT_MAX_VALID_RATE) {
scanRate = fullRate;
rateSource = 'api-full-span';
} else if (inProg) {
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
endMs: endMs,
elapsedSec: elapsedSec,
scanRate: scanRate,
fullRate: fullRate,
rateSource: rateSource,
inProgress: inProg
};
}
function ensureActiveAssociateInToday(data) {
if (!data || !cbtIsLiveBatch(data)) return false;
return captureName(data);
}
function recordCompletedBatch(data, elapsedSec, startMs, endMs, qualityOverride) {
if (!data || (!data.associateId && !data.associate && !data.driverAssignment)) return;
var pkgs = Number(data.packagesBatched) || 0;
if (pkgs === 0 || !elapsedSec || elapsedSec < 30) return;
var assoc = cbtNormalizeAssociateName(data.associateId || data.associate || data.driverAssignment || '');
if (!assoc) return;
var rate = pkgs / (elapsedSec / 60);
if (!(rate > 0) || !isFinite(rate) || rate > CBT_MAX_VALID_RATE) return;
var eventId = cbtBatchEventId(data, startMs);
if (!eventId) return;
var expected = Number(data.totalExpectedPackages) || 0;
var collected = Number(data.packagesCollected) || Number(data.packagesBatched) || 0;
var missing = expected > collected ? expected - collected : 0;
var completedAt = cbtBatchEventCompletionMs(data, startMs, endMs, elapsedSec);
var observedAt = (typeof cbtNowMs === 'function') ? cbtNowMs() : Date.now();
var event = cbtSanitizeBatchEvent({
schema:CBT_BATCH_EVENT_SCHEMA,eventId:eventId,storeId:CBT_HISTORY_STORE_SCOPE,
assoc:assoc,ref:String(data.shortClientRef || ''),generation:cbtTaskGeneration(data),
startMs:Number(startMs)||0,completedAt:completedAt,observedAt:observedAt,pkgs:pkgs,elapsedSec:Number(elapsedSec),
expected:expected,missing:missing,quality:Math.max(1, Number(qualityOverride) || (Number(endMs)>0?2:1))
}, eventId);
if (!event) return;
captureName(data);
var changed = cbtSaveLocalBatchEvent(event);
if (changed) cbtPushBatchEvent(event);
}
function ingestItem(item, authoritative) {
if (!item || typeof item !== 'object' || item.shortClientRef == null) return false;
var ref = String(item.shortClientRef);
var incoming = Object.assign({}, item, { shortClientRef: ref });
var existing = taskCache.get(ref);
var incomingGen = cbtTaskGeneration(incoming);
var existingGen = existing ? cbtTaskGeneration(existing) : '';
if (existing && incomingGen && existingGen && incomingGen !== existingGen) {
taskCache.delete(ref);
cbtForgetLiveStart(ref);
existing = null;
}
var incomingLive = cbtIsLiveBatch(incoming);
if (authoritative && incomingLive) cbtObserveAuthoritativeLive(incoming);
if (existing) {
var oldB = Number(existing.packagesBatched) || 0, newB = Number(incoming.packagesBatched) || 0;
var oldC = Number(existing.packagesCollected) || 0, newC = Number(incoming.packagesCollected) || 0;
if (newB < oldB || newC < oldC) {
if (newB < oldB) incoming.packagesBatched = oldB;
if (newC < oldC) incoming.packagesCollected = oldC;
}
}
if (existing && cbtIsLiveBatch(existing) && incoming.state !== undefined &&
String(incoming.state).toUpperCase() !== 'BATCHING') {
var mergedDone = Object.assign({}, existing, incoming);
mergedDone.packagesBatched = Math.max(Number(existing.packagesBatched)||0, Number(incoming.packagesBatched)||0);
mergedDone.packagesCollected = Math.max(Number(existing.packagesCollected)||0, Number(incoming.packagesCollected)||0);
var finishedRow = computeRow(mergedDone, true);
recordCompletedBatch(mergedDone, finishedRow.elapsedSec, finishedRow.startMs, finishedRow.endMs);
taskCache.delete(ref);
cbtForgetLiveStart(ref);
return true;
}
if (!incomingLive) return false;
var merged = existing ? Object.assign({}, existing, incoming) : incoming;
if (existing && (!Array.isArray(incoming.operationDetails) || !incoming.operationDetails.length) &&
Array.isArray(existing.operationDetails) && existing.operationDetails.length) {
merged.operationDetails = existing.operationDetails;
}
merged.packagesBatched = Math.max(Number(existing && existing.packagesBatched)||0, Number(incoming.packagesBatched)||0);
merged.packagesCollected = Math.max(Number(existing && existing.packagesCollected)||0, Number(incoming.packagesCollected)||0);
if (!merged.associateId && !merged.associate && merged.driverAssignment) merged.associate = merged.driverAssignment;
try { ensureActiveAssociateInToday(merged); } catch(e) {}
taskCache.set(ref, merged);
return true;
}
function cbtCaptureNamesAndJobs(obj, depth) {
if (obj == null || depth > 6) return false;
var added = false;
if (Array.isArray(obj)) {
for (var i = 0; i < obj.length && i < 5000; i++) {
if (cbtCaptureNamesAndJobs(obj[i], depth + 1)) added = true;
}
return added;
}
if (typeof obj !== 'object') return false;
try { if (captureName(obj)) added = true; } catch(eName) {}
try { afaRecordJobObject(obj); } catch(eJob) {}
for (var k in obj) {
var v = obj[k];
if (v && typeof v === 'object' && cbtCaptureNamesAndJobs(v, depth + 1)) added = true;
}
return added;
}
function ingestData(d, authoritative) {
if (!d) return;
var changed = false;
try {
if (cbtCaptureNamesAndJobs(d, 0) && activeTab === 'names') renderNames();
} catch(e) {}
function take(i) { if (ingestItem(i, !!authoritative)) changed = true; }
if (Array.isArray(d)) {
d.forEach(take);
} else if (d.shortClientRef != null) {
take(d);
} else {
['summaries','tasks','results','items','jobs','data'].forEach(function(k) {
if (Array.isArray(d[k])) d[k].forEach(take);
});
}
if (changed && !authoritative) requestLiveRender();
}
var CBT_PASSIVE_JSON_RE = /\"(?:shortClientRef|associateId|driverAssignment|associate)\"\s*:/i;
function cbtPassiveJsonMayMatter(raw) {
return typeof raw === 'string' && CBT_PASSIVE_JSON_RE.test(raw);
}
var _origFetch = window.fetch;
window.fetch = async function() {
var resp;
try { resp = await _origFetch.apply(this, arguments); }
catch(e) { throw e; }
try {
if ((resp.headers.get('content-type') || '').includes('json')) {
resp.clone().text().then(function(raw){
if (!raw || !cbtPassiveJsonMayMatter(raw)) return;
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
if (typeof payload === 'string' && !cbtPassiveJsonMayMatter(payload)) return;
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
function cbtLiveCachedCount() {
var count = 0;
taskCache.forEach(function(d){
if (cbtIsLiveBatch(d)) count++;
});
return count;
}
function cbtStaleLiveReloadKey() {
return 'cbt_stale_live_reload_' + String(STORE_ID || 'unknown');
}
function cbtMaybeReloadStaleLive() {
if (document.hidden || !isDashboardView()) {
_cbtStaleLiveZeroTaskPolls = 0;
return;
}
var mainTasks = null;
try { mainTasks = cbtRecMainTasksSnapshot(); } catch(e) {}
if (!mainTasks || mainTasks.count !== 0 || cbtLiveCachedCount() === 0) {
_cbtStaleLiveZeroTaskPolls = 0;
return;
}
_cbtStaleLiveZeroTaskPolls++;
if (_cbtStaleLiveZeroTaskPolls < CBT_STALE_LIVE_RELOAD_POLLS) return;
_cbtStaleLiveZeroTaskPolls = 0;
var now = Date.now();
var last = 0;
try { last = Number(sessionStorage.getItem(cbtStaleLiveReloadKey()) || 0); }
catch(e2) {}
if (last && (now - last) < CBT_STALE_LIVE_RELOAD_COOLDOWN_MS) {
taskCache.forEach(function(d, key){
if (cbtIsLiveBatch(d)) {
taskCache.delete(key);
cbtForgetLiveStart(String(key));
try { delete _cbtMissingPollsByRef[String(key)]; } catch(e3) {}
}
});
requestLiveRender();
return;
}
try { sessionStorage.setItem(cbtStaleLiveReloadKey(), String(now)); }
catch(e4) {}
location.reload();
}
var _cbtMissingFinalizeByKey = Object.create(null);
function cbtJobIdFromData(data) {
if (!data || typeof data !== 'object') return '';
var fields = ['jobId','jobID','taskId','taskID','jobUuid','jobUUID','taskUuid','taskUUID'];
for (var i = 0; i < fields.length; i++) {
if (data[fields[i]] != null && String(data[fields[i]]).trim()) return String(data[fields[i]]).trim();
}
var gen = cbtTaskGeneration(data);
return /^job:/.test(gen) ? gen.slice(4) : '';
}
function cbtFinalizeMissingLiveTask(ref, cached, locked) {
cached = Object.assign({}, cached || {});
locked = Object.assign({}, locked || {});
var identity = cbtBatchEventId(cached, locked.startMs || 0) || (String(ref) + '|' + String(cbtTaskGeneration(cached) || ''));
if (!identity || _cbtMissingFinalizeByKey[identity]) return;
_cbtMissingFinalizeByKey[identity] = { tries:0, started:Date.now() };
var jobId = cbtJobIdFromData(cached);
function finishRecord(merged, quality, explicitEnd) {
var liveAgain = taskCache.get(String(ref));
if (liveAgain && cbtIsLiveBatch(liveAgain) && cbtTaskGeneration(liveAgain) === cbtTaskGeneration(cached)) {
delete _cbtMissingFinalizeByKey[identity];
return;
}
var startMs = Number(locked.startMs) || (cbtBatchingOpInfo(merged, false) || {}).startMs || 0;
if (!startMs) { delete _cbtMissingFinalizeByKey[identity]; return; }
var info = cbtBatchingOpInfo(merged, false) || {};
var endMs = Number(explicitEnd || info.endMs) || 0;
if (!endMs) {
endMs = Math.max(startMs + 30000, Number(locked.lastSeen) + POLL_MS || 0);
}
var elapsedSec = Math.max(30, Math.floor((endMs - startMs) / 1000));
recordCompletedBatch(merged, elapsedSec, startMs, endMs, quality);
delete _cbtMissingFinalizeByKey[identity];
}
function attempt() {
var stateRow = _cbtMissingFinalizeByKey[identity];
if (!stateRow) return;
stateRow.tries++;
if (!jobId) {
if (stateRow.tries >= 3) finishRecord(cached, 1, 0);
else setTimeout(attempt, POLL_MS);
return;
}
afaFetchJobInfo(jobId).then(function(info){
if (!_cbtMissingFinalizeByKey[identity]) return;
if (info) {
var state = String(cbtAssignOperationStateDeep(info, 0) || '').toUpperCase();
if (/CANCEL|ABORT|VOID|DELETED/.test(state)) {
delete _cbtMissingFinalizeByKey[identity];
return;
}
var merged = Object.assign({}, cached, info);
merged.shortClientRef = cached.shortClientRef || info.shortClientRef || ref;
merged.packagesBatched = Math.max(Number(cached.packagesBatched)||0, Number(info.packagesBatched)||0);
merged.packagesCollected = Math.max(Number(cached.packagesCollected)||0, Number(info.packagesCollected)||0);
if (!merged.associateId && !merged.associate) merged.associate = cached.associateId || cached.associate || cached.driverAssignment;
var op = cbtBatchingOpInfo(merged, false) || {};
var explicitEnd = Number(op.endMs) || cbtNormalizeEpochMs(info.completedAt || info.completionTime || info.endedAt || info.endTime);
var clearlyFinished = /COMPLETED|COMPLETE|DONE|STAGED|PICKUP|FINISHED/.test(state) || explicitEnd > 0;
var clearlyActive = /BATCHING|IN_PROGRESS|ACCEPTED|STARTED|ACTIVE/.test(state) && !explicitEnd;
if (clearlyFinished) { finishRecord(merged, explicitEnd ? 3 : 2, explicitEnd); return; }
if (clearlyActive) {
if (stateRow.tries < 5) setTimeout(attempt, POLL_MS);
else delete _cbtMissingFinalizeByKey[identity];
return;
}
if (state && !clearlyActive) { finishRecord(merged, 2, explicitEnd); return; }
}
if (stateRow.tries < 5) setTimeout(attempt, POLL_MS);
else finishRecord(cached, 1, 0);
}, function(){
if (stateRow.tries < 5) setTimeout(attempt, POLL_MS);
else finishRecord(cached, 1, 0);
});
}
attempt();
}
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
cbtCalibrateServerClock(res, requestPerf);
var freshData = await res.json();
_cbtBackendLastOk = Date.now();
var activeRefs = new Set();
var items = Array.isArray(freshData) ? freshData.slice() : [];
['summaries','tasks','results','items','jobs','data'].forEach(function(k) {
if (freshData && Array.isArray(freshData[k])) items = items.concat(freshData[k]);
});
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
var lockedGone = _cbtLiveStartByRef[key] ? Object.assign({}, _cbtLiveStartByRef[key]) : null;
try { cbtFinalizeMissingLiveTask(key, val, lockedGone); } catch(eFinalize) {}
taskCache.delete(key);
delete _cbtMissingPollsByRef[key];
cbtForgetLiveStart(key);
}
});
ingestData(freshData, true);
Object.keys(bestByRef).forEach(function(ref) {
ingestItem(bestByRef[ref].data, true);
cbtObserveAuthoritativeLive(bestByRef[ref].data);
});
cbtPruneOldLiveStarts();
if (isDashboardView() && _cbtLiveDashboardSyncPending) {
try {
if (cbtRecMainTasksSnapshot()) _cbtLiveDashboardSyncPending = false;
} catch(eReturnSync) {}
}
try { cbtMaybeReloadStaleLive(); } catch(eStaleLive) {}
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
var bootStats = cbtStatsPrimeStartupWarm();
var bootIp = bootStats ? String(bootStats.inProgress) : '\u2014';
var bootRec = bootStats ? String(bootStats.recommended) : '\u2014';
var bootRem = bootStats ? String(bootStats.remaining) : '\u2014';
// Render the cached staffing delta in the very first dashboard HTML so a reload
// does not wait for the first stats callback before showing +N / -N.
var bootDelta = '';
var bootDeltaClass = '';
var bootDeltaTitle = '';
if (bootStats) {
var bootIpNum = Number(bootStats.inProgress);
var bootRecNum = Number(bootStats.recommended);
if (isFinite(bootIpNum) && isFinite(bootRecNum) && bootRecNum >= 0) {
var bootDiff = bootRecNum - bootIpNum;
if (bootDiff > 0) {
bootDelta = '+' + bootDiff;
bootDeltaClass = 'need-more';
bootDeltaTitle = 'Need ' + bootDiff + ' more batcher' + (bootDiff === 1 ? '' : 's');
} else if (bootDiff < 0) {
var bootExtra = Math.abs(bootDiff);
bootDelta = '-' + bootExtra;
bootDeltaClass = 'extra';
bootDeltaTitle = bootExtra + ' extra batcher' + (bootExtra === 1 ? '' : 's');
}
}
}
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
'<div class="cbt-stat-value"><span id="cbt-stat-ip">' + bootIp + '</span><span id="cbt-stat-delta" class="' + bootDeltaClass + '" title="' + bootDeltaTitle + '">' + bootDelta + '</span></div>' +
'</div>' +
'<div class="cbt-stat-card">' +
'<div class="cbt-stat-icon">\uD83D\uDCCA</div>' +
'<div class="cbt-stat-label">Recommended This Hour</div>' +
'<div class="cbt-stat-value"><span id="cbt-stat-rec">' + bootRec + '</span><span id="cbt-stat-dot"></span></div>' +
'</div>' +
'<div class="cbt-stat-card">' +
'<div class="cbt-stat-icon">\uD83D\uDCE6</div>' +
'<div class="cbt-stat-label">Remaining</div>' +
'<div class="cbt-stat-value" id="cbt-stat-rem">' + bootRem + '</div>' +
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
var PANEL_HEALTH_MS = 2000;
var _mountFails = 0;
var _fastMountUntil = 0;
function isComoSite() {
return location.hostname.indexOf('como-operations-dashboard') !== -1;
}
function isOutboundSite() {
return location.hostname === 'na.store-management.f3.amazon.dev';
}
var TASK_DETAIL_RE = /\/(jobdetails|task)(\b|\/|\?|#|$)/i;
function isTaskDetailPage() {
if (document.querySelector('div.job-details')) return true;
return TASK_DETAIL_RE.test(location.pathname);
}
var NON_DASHBOARD_RE = /\/(packages|orders|labor|layout|associates?)(\b|\/|\?|#|$)/i;
var DASHBOARD_PATH_RE = /^\/store\/[^\/]+\/dash\/?$/i;
function isDashboardView() {
if (!isComoSite()) return false;
if (!DASHBOARD_PATH_RE.test(location.pathname)) return false;
if (NON_DASHBOARD_RE.test(location.hash)) return false;
return true;
}
function boardIsMisplaced() {
return !isDashboardView() && !!document.getElementById('cbt-panel');
}
function detachMainPanel() {
var p = document.getElementById('cbt-panel');
if (p) p.remove();
}
function findMountPoint() {
if (!isDashboardView()) return null;
var el = document.querySelector('utilization.dashboard-utilization') ||
document.querySelector('utilization');
if (el && el.parentNode) return { el: el, mode: 'before' };
return null;
}
function injectPanel() {
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
var body0 = _panel2Ref.querySelector('#cbt-body');
var tabs0 = _panel2Ref.querySelector('#cbt-tabs');
var search0 = _panel2Ref.querySelector('#cbt-unified-search');
var drag0 = _panel2Ref.querySelector('#cbt-drag-bottom');
var collapse0 = _panel2Ref.querySelector('#cbt-collapse-btn');
if (savedH && body0) {
var h0 = parseFloat(savedH);
body0.style.height = h0 + 'px';
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
try { cbtStatsHydrateWarm(); } catch(eWarmStats) {}
try {
if (_statsLastSummaryData) cbtApplyStatsData(_statsLastSummaryData);
} catch(eCurrentStats) {}
_mountFails = 0;
try { applyUiScale(); } catch(ex) {}
try { renderActiveSearchTab(); } catch(ex) { try { renderLive(); } catch(ex2) {} }
if (activeTab === 'live' && taskCache.size) requestLiveRender();
}
function panelHealthCheck() {
if (!isDashboardView()) { detachMainPanel(); _mountFails = 0; return; }
var p = document.getElementById('cbt-panel');
if (p && p.isConnected) { _mountFails = 0; return; }
injectPanel();
if (!document.getElementById('cbt-panel')) {
if (_mountFails < 1000) _mountFails++;
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
setDashboardSearchTerm(dashboardSearchTerm);
document.getElementById('cbt-live-view').style.display = activeTab==='live' ? '' : 'none';
document.getElementById('cbt-history-view').style.display = activeTab==='history' ? '' : 'none';
document.getElementById('cbt-weekly-view').style.display = activeTab==='weekly' ? '' : 'none';
document.getElementById('cbt-names-view').style.display = activeTab==='names' ? '' : 'none';
var hofView = document.getElementById('cbt-hof-view');
if (hofView) hofView.style.display = activeTab==='hof' ? '' : 'none';
if (activeTab==='hof') { try { cbtBatchEventsPull(); } catch(e0) {} try { cbtBatchEventsPullAllTime(function(){ try { renderHallOfFame(); } catch(e1) {} }, true); } catch(e) {} }
renderActiveSearchTab();
if ((activeTab === 'weekly' || activeTab === 'history') &&
(Date.now() - _cbtBatchEventLastPullAt > 2500)) {
try { cbtBatchEventsPull(); } catch(e2) {}
}
});
});
var afaBtn = panel2.querySelector('#cbt-afa-btn');
if (afaBtn) afaBtn.addEventListener('click', function(e){
e.stopPropagation();
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
var fontIncBtn = panel2.querySelector('#cbt-font-inc');
var fontDecBtn = panel2.querySelector('#cbt-font-dec');
var scaleResetB = panel2.querySelector('#cbt-scale-reset');
if (fontIncBtn) fontIncBtn.addEventListener('click', function(){ stepUiScale(1); });
if (fontDecBtn) fontDecBtn.addEventListener('click', function(){ stepUiScale(-1); });
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
html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + cbtEscHtml(e.assoc) + '</span>' +
'<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.runs + '</span> runs | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
'<span class="cbt-search-row-rate"><span class="cbt-hist-rate ' + rateCls + '">' + e.avgRate.toFixed(1) + '</span></span></div>';
});
}
var weekly = sanitizeWeekly(getDisplayWeekly()), agg = {};
for (var dk of Object.keys(weekly)) {
for (var a of Object.keys(weekly[dk])) {
if (a.toLowerCase().indexOf(term) === -1) continue;
if (!agg[a]) agg[a] = { assoc:(weekly[dk][a].assoc||a), totalPkgs:0, totalSec:0, runs:0, daysSet:new Set() };
else if (weekly[dk][a].assoc) agg[a].assoc = weekly[dk][a].assoc;
agg[a].totalPkgs += weekly[dk][a].totalPkgs;
agg[a].totalSec += weekly[dk][a].totalSec;
agg[a].runs += weekly[dk][a].runs;
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
html += '<div class="cbt-search-row"><span class="cbt-search-row-name">' + cbtEscHtml(e.assoc) + '</span>' +
'<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">' + e.daysSet.size + '</span> days | <span style="display:inline-block;width:50px;text-align:left;">' + e.totalPkgs + '</span> pkgs</span>' +
'<span class="cbt-search-row-rate"><span class="cbt-hist-rate ' + rateCls + '">' + avgRate.toFixed(1) + '</span></span></div>';
});
}
html += savedNamesSearchHTML(term, shown);
if (html === '') html = '<div style="text-align:center;color:#aaa;padding:10px;font-style:italic;font-size:14px;">No results found for "' + term + '"</div>';
setHTML(resultsEl, html);
requestUnifiedSearchCount();
}
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
var mainTasks = null;
if (isDashboardView()) {
try { mainTasks = cbtRecMainTasksSnapshot(); } catch(eMainTasks) {}
}
var rows=[]; taskCache.forEach(function(d){
if(cbtIsLiveBatch(d)) {
if (isDashboardView()) {
if (!mainTasks && _cbtLiveDashboardSyncPending) return;
if (mainTasks) {
if (mainTasks.count === 0) return;
if ((mainTasks.refs.size || mainTasks.ids.size) &&
!cbtRecJobMatchesMainTasks(d, mainTasks)) return;
}
}
if (lowerTerm) {
var nm = (d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'').toLowerCase();
if (nm.indexOf(lowerTerm) === -1) return;
}
rows.push({ d:d, r:computeRow(d) });
}
});
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
if(liveSortKey==='assoc'){
va=(a.associateId||a.associate||'').toLowerCase();
vb=(b.associateId||b.associate||'').toLowerCase();
return liveSortAsc?va.localeCompare(vb):vb.localeCompare(va);
} else if(liveSortKey==='rate'){
var hasA = (ra.scanRate != null && !isNaN(ra.scanRate));
var hasB = (rb.scanRate != null && !isNaN(rb.scanRate));
if (hasA && !hasB) return -1;
if (!hasA && hasB) return 1;
if (!hasA && !hasB) return 0;
va=ra.scanRate; vb=rb.scanRate;
} else {
va=ra.elapsedSec||0; vb=rb.elapsedSec||0;
}
return liveSortAsc?va-vb:vb-va;
});
updateLiveSortHeaders();
if(rows.length===0){
setHTML(tbody,'');
empty.style.display='block';
var body2=document.querySelector('#cbt-body');
if(body2&&!body2.style.height){body2.style.height='350px';body2.style.maxHeight='350px';}
return;
}
empty.style.display='none';
function present(item) {
var data=item.d, r=item.r;
var assoc=data.associateId||data.associate||data.driverAssignment||data.shortClientRef||'';
var shortRef=data.shortClientRef||'';
var rateCls=r.scanRate!=null?(r.scanRate<ALERT_RATE?'alert':r.scanRate<WARN_RATE?'warn':''):'pending';
var rateTxt=r.scanRate!=null?r.scanRate.toFixed(1):'\u2014';
var rateTitle =
r.rateSource==='api-full-span' ? 'Rate: packages batched / full BATCHING elapsed time' :
r.rateSource==='observed-delta' ? 'Rate fallback: package increase observed by this dashboard' :
r.rateSource==='invalid-api-span' ? 'Rate hidden: API timing/count combination produced an invalid spike' :
'Rate pending until enough trusted timing/progress is available';
var slow=(r.scanRate!==null&&r.scanRate<ALERT_RATE&&r.elapsedSec>120);
return {
key:String(shortRef), assoc:String(assoc), shortRef:String(shortRef),
start:r.startMs||'', live:r.inProgress?'1':'0',
rateClass:'cbt-rate '+rateCls, rateText:rateTxt,
rateTitle:rateTitle, slow:slow
};
}
var pres=rows.map(present);
var domRows=tbody.querySelectorAll('tr[data-cbt-live-key]');
var sameOrder=domRows.length===pres.length;
if (sameOrder) {
for (var di=0; di<pres.length; di++) {
if (domRows[di].getAttribute('data-cbt-live-key') !== pres[di].key) {
sameOrder=false; break;
}
}
}
if (sameOrder) {
for (var pi=0; pi<pres.length; pi++) {
var rowEl=domRows[pi], p=pres[pi];
var assocEl=rowEl.querySelector('.cbt-assoc');
if (assocEl && assocEl.textContent!==p.assoc) assocEl.textContent=p.assoc;
var refEl=rowEl.querySelector('.cbt-ref');
if (refEl && refEl.textContent!==p.shortRef) refEl.textContent=p.shortRef;
var elapsedEl=rowEl.querySelector('.cbt-elapsed');
if (elapsedEl) {
if (elapsedEl.dataset.start!==String(p.start)) elapsedEl.dataset.start=String(p.start);
if (elapsedEl.dataset.live!==p.live) elapsedEl.dataset.live=p.live;
}
var rateEl=rowEl.querySelector('.cbt-rate');
if (rateEl) {
if (rateEl.className!==p.rateClass) rateEl.className=p.rateClass;
if (rateEl.textContent!==p.rateText) rateEl.textContent=p.rateText;
if (rateEl.title!==p.rateTitle) rateEl.title=p.rateTitle;
}
var topEl=rowEl.querySelector('.cbt-cw-top');
var slot=topEl && topEl.querySelector('.cbt-live-status-slot');
if (p.slow && !slot && topEl) {
slot=document.createElement('span');
slot.className='cbt-live-status-slot';
slot.innerHTML='<span class="cbt-slow-alert">⚠ SLOW</span>';
topEl.appendChild(slot);
} else if (!p.slow && slot) {
slot.remove();
}
}
tickLive();
requestUnifiedSearchCount();
return;
}
var html='';
for(var i=0;i<pres.length;i++){
var p=pres[i];
var slowAlert=p.slow?'<span class="cbt-live-status-slot"><span class="cbt-slow-alert">⚠ SLOW</span></span>':'';
html+='<tr data-cbt-live-key="'+cbtEscHtml(p.key)+'"><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc">'+cbtEscHtml(p.assoc)+'</span>'+slowAlert+'</span><span class="cbt-ref">'+cbtEscHtml(p.shortRef)+'</span></span></td>';
html+='<td><span class="cbt-elapsed" data-start="'+cbtEscHtml(p.start)+'" data-live="'+p.live+'">--:--</span></td>';
html+='<td><span class="'+p.rateClass+'" title="'+cbtEscHtml(p.rateTitle)+'">'+p.rateText+'</span></td></tr>';
}
setHTML(tbody, html);
lockLiveRowGeometry();
_cbtLastLiveTickSecond = -1;
tickLive();
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
html+='<tr><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+rk+'</span>'+cbtEscHtml(e.assoc)+'</span></span></span></td>';
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
if(!agg[a]) agg[a]={assoc:(weekly[dk][a].assoc||a),totalPkgs:0,totalSec:0,runs:0,daysSet:new Set()};
else if(weekly[dk][a].assoc)agg[a].assoc=weekly[dk][a].assoc;
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
html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+cbtEscHtml(e.assoc)+'</span>' +
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
if (!cbtIsDateInCurrentWeek(dk)) continue;
if (!w[dk] || typeof w[dk] !== 'object') continue;
clean[dk] = {};
for (var a in w[dk]) {
var e = w[dk][a];
if (!e || typeof e !== 'object') continue;
if (!cbtHistoryEntryHasData(e)) continue;
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
if(!agg[assoc])agg[assoc]={assoc:(d3.assoc||assoc),totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,daysSet:new Set(),bestRate:null,lastRate:null,lastAt:0};
else if (d3.assoc) agg[assoc].assoc = d3.assoc;
agg[assoc].totalPkgs+=d3.totalPkgs;agg[assoc].totalSec+=d3.totalSec;agg[assoc].runs+=d3.runs;
agg[assoc].totalMissing+=(d3.totalMissing||0);agg[assoc].totalExpected+=(d3.totalExpected||0);agg[assoc].daysSet.add(dayKey);
cbtMergeBestFields(agg[assoc], d3);
cbtMergeLatestFields(agg[assoc], d3);
}
}
var all=Object.values(agg).map(function(a){
var pkgs = Math.min(a.totalPkgs, 100000);
var sec = Math.min(a.totalSec, 500*3600);
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
var weeklyRaw=sanitizeWeekly(getDisplayWeekly()),tMissing=0,tExpected=0;
for(var md in weeklyRaw){for(var ma in weeklyRaw[md]){tMissing+=Number(weeklyRaw[md][ma].totalMissing)||0;tExpected+=Number(weeklyRaw[md][ma].totalExpected)||0;}}
var tM=tExpected>0?(tMissing/tExpected*100):0;
summary.innerHTML='<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tA+'</span><span class="cbt-ws-label">Batchers</span></div>'+
'<div class="cbt-ws-stat"><span class="cbt-ws-val">'+oR.toFixed(1)+'</span><span class="cbt-ws-label">Avg Rate</span></div>'+
'<div class="cbt-ws-stat"><span class="cbt-ws-val">'+tM.toFixed(1)+'%</span><span class="cbt-ws-label">Avg Miss %</span></div>';
}
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
html+='<tr><td><span class="cbt-cw"><span class="cbt-cw-top"><span class="cbt-assoc"><span class="cbt-rank '+rankCls+'">'+rk+'</span>'+cbtEscHtml(e.assoc)+'</span></span></span></td>';
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
var _cbtDataNameSetCache = null;
var _cbtDataNameSetAt = 0;
function savedNamesSearchHTML(term, excludeSet) {
term = (term||'').toLowerCase().trim();
if (!term) return '';
var all = loadAllNames();
var matches = [];
for (var k in all) {
var n = all[k];
if (k.indexOf(term) !== -1 && (!excludeSet || !excludeSet.has(k))) matches.push(n);
}
if (!matches.length) return '';
matches.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });
matches = prioritizeNameMatches(matches, term, function(n){ return n; });
var html = '<div class="cbt-search-result-section">SAVED NAMES</div>';
matches.slice(0, 50).forEach(function(n){
html += '<div class="cbt-search-row"><span class="cbt-search-row-name cbt-name-cell">' + cbtEscHtml(n) + '</span>' +
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
var _nowN = Date.now();
if (_nowN - _namesScanLast > 5000) {
_namesScanLast = _nowN;
scanLocalStorageForNames();
syncNamesFromAllTabs();
}
var all = loadAllNames();
var names = Object.keys(all)
.map(function(k){ return all[k]; })
.filter(function(n){ return !!cbtAssignNormText(n); });
var totalCount = names.length;
names.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });
var term = (namesSearchTerm||'').toLowerCase().trim();
if (term) {
names = names.filter(function(n){ return n.toLowerCase().indexOf(term) !== -1; });
names = prioritizeNameMatches(names, term, function(n){ return n; });
}
var countEl = document.getElementById('cbt-names-count');
if (countEl) {
countEl.textContent = totalCount + ' names saved';
var isDarkMode = document.getElementById('cbt-panel') && document.getElementById('cbt-panel').classList.contains('dark');
countEl.style.color = isDarkMode ? '#8faac0' : '#5a7a96';
}
var emptyEl = document.getElementById('cbt-names-empty');
if (!names.length) {
setHTML(tbody, '');
if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = term ? 'No saved names match "' + namesSearchTerm + '"' : 'No saved associates yet'; }
return;
}
if (emptyEl) emptyEl.style.display = 'none';
var html = '';
names.forEach(function(n){
html += '<tr><td style="text-align:left;"><span class="cbt-name-cell">' + cbtEscHtml(n) + '</span></td></tr>';
});
setHTML(tbody, html);
requestUnifiedSearchCount();
}
function renderWeeklyCrossSearch(term) {
var crossEl = document.getElementById('cbt-weekly-cross');
if(!crossEl) return;
if(!term){ crossEl.innerHTML=''; return; }
term = term.toLowerCase().trim();
var history = getDisplayHistory();
var entries = Object.values(history).filter(function(e){ return e.assoc.toLowerCase().indexOf(term)!==-1; });
entries = prioritizeNameMatches(entries, term, function(e){ return e.assoc; });
var shown = new Set(), html='';
if(entries.length>0){
html+='<div class="cbt-search-result-section">TODAY</div>';
entries.forEach(function(e){
shown.add(e.assoc.toLowerCase());
var rateCls=e.avgRate>=WARN_RATE?'good':e.avgRate>=ALERT_RATE?'warn':'alert';
html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+cbtEscHtml(e.assoc)+'</span>' +
'<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.runs+'</span> runs | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>' +
'<span class="cbt-search-row-rate"><span class="cbt-hist-rate '+rateCls+'">'+e.avgRate.toFixed(1)+'</span></span></div>';
});
}
var weekly = sanitizeWeekly(getDisplayWeekly()), agg={};
for(var dk in weekly){
for(var a in weekly[dk]){
var d=weekly[dk][a]||{}, display=d.assoc||a;
if(String(display).toLowerCase().indexOf(term)===-1) continue;
var key=String(display).toLowerCase();
if(!agg[key])agg[key]={assoc:display,totalPkgs:0,totalSec:0,runs:0};
agg[key].assoc=display; agg[key].totalPkgs+=Number(d.totalPkgs)||0; agg[key].totalSec+=Number(d.totalSec)||0; agg[key].runs+=Number(d.runs)||0;
}
}
var wkRows=prioritizeNameMatches(Object.values(agg),term,function(e){return e.assoc;});
if(wkRows.length){
html+='<div class="cbt-search-result-section">WEEKLY</div>';
wkRows.forEach(function(e){
shown.add(e.assoc.toLowerCase());
var avg=e.totalSec>0?e.totalPkgs/(e.totalSec/60):0;
var cls=avg>=WARN_RATE?'good':avg>=ALERT_RATE?'warn':'alert';
html+='<div class="cbt-search-row"><span class="cbt-search-row-name">'+cbtEscHtml(e.assoc)+'</span>'+
'<span class="cbt-search-row-mid"><span style="display:inline-block;width:45px;text-align:right;">'+e.runs+'</span> runs | <span style="display:inline-block;width:50px;text-align:left;">'+e.totalPkgs+'</span> pkgs</span>'+
'<span class="cbt-search-row-rate">'+(avg>0?'<span class="cbt-hist-rate '+cls+'">'+avg.toFixed(1)+'</span>':'<span style="color:#aaa;">—</span>')+'</span></div>';
});
}
html += savedNamesSearchHTML(term, shown);
setHTML(crossEl, html);
}
var _cbtLastLiveTickSecond = -1;
function tickLive() {
if (document.hidden || activeTab !== 'live') return;
var nowMs = cbtNowMs();
var tickSecond = Math.floor(nowMs / 1000);
if (tickSecond === _cbtLastLiveTickSecond) return;
_cbtLastLiveTickSecond = tickSecond;
var tbody = document.getElementById('cbt-tbody');
if (!tbody || !tbody.isConnected) return;
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
var _panelMutationRun = coalesced(function() {
try { ensureSortAttachment(); } catch(e0) {}
if (!isDashboardView()) { detachMainPanel(); return; }
var mp = document.getElementById('cbt-panel');
if (!mp || !mp.isConnected) injectPanel();
}, 50);
var _acMutationRun = null;
var panelWatcher = new MutationObserver(function(mutations) {
var dashboard = isDashboardView();
var livePanel = document.getElementById('cbt-panel');
if (dashboard) {
if (!livePanel || !livePanel.isConnected) {
try { injectPanel(); } catch(eFastPanel) {}
}
} else if (livePanel && livePanel.isConnected) {
_panelMutationRun();
}
if (!_acMutationRun) return;
for (var i = 0; i < mutations.length; i++) {
var m = mutations[i];
if (cbtMutationIsOnlyOwnUi(m)) continue;
if (cbtAutocompleteMutationMayMatter(m)) {
_acMutationRun();
break;
}
}
});
var _cbtQrLib = null;
function qrcode() {
if (!_cbtQrLib) _cbtQrLib = (function(){
var module = { exports: {} }, exports = module.exports, define;
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1})},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(o*r,n*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});
return module.exports;
})();
return _cbtQrLib.apply(null, arguments);
}
var _qrOverlay = null;
var _qrSuppressNextMouseup = false;
var _qrRenderRAF = 0;
var _qrLastOpenedText = '';
var _qrOutsideHandler = null;
var _qrSelectionTimer = 0;
var _qrDragCleanup = null;
var QR_POSITION_KEY = 'cbt_qr_snap_position_v23953';
var QR_DEFAULT_POSITION = 'bottom-right';
var QR_ALLOWED_POSITIONS = {
'bottom-left': 1,
'bottom-center': 1,
'bottom-right': 1
};
var QR_UI_IDS = ['cbt-panel', 'cbt-qr-overlay', 'cbt-afa-overlay', 'cbt-ac-drop'];
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
}
function qrSnapPositionFromPoint(clientX, clientY) {
var vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
var col = clientX < vw / 3
? 'left'
: clientX > (vw * 2 / 3)
? 'right'
: 'center';
return 'bottom-' + col;
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
try {
if (pointerId !== null && head.releasePointerCapture) {
head.releasePointerCapture(pointerId);
}
} catch(ignore) {}
pointerId = null;
try { e.preventDefault(); } catch(ignore2) {}
}
function onDown(e) {
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
function qrInScriptUI(node) {
var n = node, guard = 0;
while (n && guard++ < 200) {
if (n.nodeType === 1 && n.id && QR_UI_IDS.indexOf(n.id) !== -1) return true;
if (n.nodeType === 11 && n.host) { n = n.host; continue; }
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
try {
var s = window.getSelection();
if (s && s.removeAllRanges) s.removeAllRanges();
} catch(e) {}
}
function qrOpen(text) {
text = String(text || '').trim();
if (!text) return;
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
input.addEventListener('input', function(){
qrScheduleRender(input.value);
});
_qrOutsideHandler = function(e) {
if (!_qrOverlay || !card || card.contains(e.target)) return;
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
var direct = qrControlSelection(event && event.target);
if (direct && cbtAssignHiddenUsable(direct)) return direct;
var candidates = [];
function addSelection(sel) {
if (!sel) return;
if (candidates.indexOf(sel) === -1) candidates.push(sel);
}
try { addSelection(window.getSelection()); } catch(e0) {}
try { addSelection(document.getSelection()); } catch(e1) {}
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
_qrSelectionTimer = setTimeout(function(){
_qrSelectionTimer = 0;
qrOpenCurrentSelection(snapshot);
}, 0);
}
if (typeof PointerEvent !== 'undefined') {
document.addEventListener('pointerup', qrQueueSelectionOpen, true);
} else {
document.addEventListener('mouseup', qrQueueSelectionOpen, true);
}
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
var AFA_DELAY_MS = 250;
var AFA_TIMEOUT_MS = 15000;
var _afaJobIndex = Object.create(null);
var _afaJobInfo = Object.create(null);
var _afaDone = Object.create(null);
var _afaRunning = false, _afaStop = false, _afaOverlay = null;
var _afaMissingMenuInfo = null;
var _afaMissingMenuCheckSeq = 0;
function afaLooksLikeJobId(v) {
if (typeof v !== 'string' || v.length < 30 || v.indexOf('_') === -1) return false;
return STORE_ID ? v.indexOf(STORE_ID) === 0 : true;
}
function afaRecordJobObject(obj) {
if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
var ref = obj.shortClientRef;
if (typeof ref === 'string' && ref) {
var id = null, named = ['id','jobId','jobID','taskId'];
for (var n = 0; n < named.length; n++) {
if (afaLooksLikeJobId(obj[named[n]])) { id = obj[named[n]]; break; }
}
if (!id) {
for (var k in obj) {
if (afaLooksLikeJobId(obj[k])) { id = obj[k]; break; }
}
}
if (id) {
_afaJobIndex[ref] = id;
var asg = afaAssignabilityFrom(obj);
if (!_afaJobInfo[id]) _afaJobInfo[id] = { ref: ref, assignability: null };
_afaJobInfo[id].ref = ref;
if (asg) _afaJobInfo[id].assignability = asg;
}
}
}
function afaRecordJobs(obj, depth) {
if (obj == null || depth > 6) return;
if (Array.isArray(obj)) {
for (var i = 0; i < obj.length && i < 5000; i++) afaRecordJobs(obj[i], depth + 1);
return;
}
if (typeof obj !== 'object') return;
afaRecordJobObject(obj);
for (var k2 in obj) {
var v = obj[k2];
if (v && typeof v === 'object') afaRecordJobs(v, depth + 1);
}
}
function afaAssignabilityFrom(obj) {
if (!obj || typeof obj !== 'object') return null;
var k, v;
for (k in obj) {
v = obj[k];
if (typeof v !== 'string') continue;
if (!/assign/i.test(k)) continue;
if (/^UNASSIGNABLE$/i.test(v.trim())) return 'UNASSIGNABLE';
if (/^ASSIGNABLE$/i.test(v.trim())) return 'ASSIGNABLE';
}
for (k in obj) {
v = obj[k];
if (typeof v !== 'string') continue;
if (/^UNASSIGNABLE$/i.test(v.trim())) return 'UNASSIGNABLE';
if (/^ASSIGNABLE$/i.test(v.trim())) return 'ASSIGNABLE';
}
return null;
}
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
if (asg === 'ASSIGNABLE') return { eligible: false, reason: 'already assignable' };
if (asg === 'UNASSIGNABLE') return { eligible: true, reason: 'unassignable (verified)' };
return { eligible: false, reason: 'could not verify status \u2014 skipped' };
});
}
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
try {
if (typeof cbtAssignStrictPartialCandidates !== 'function') return [];
return cbtAssignStrictPartialCandidates().map(function(item){
return {
ref: item.ref,
id: item.id,
partial: true,
partialSectionVerified: true,
explicitPartialId: true
};
});
} catch(e) {
return [];
}
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
if (typeof v !== 'string') continue;
var status = v.trim().toUpperCase();
if (status === 'MISSING' || status === 'DAMAGED') return status;
}
return '';
}
function afaMissingInfoFromJson(root) {
var missingIds = [];
var problemPackages = [];
var cart = '';
var sawPackageSignals = false;
var seenProblem = Object.create(null);
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
var packageStatus = afaMissingStatusFromObject(obj);
if (packageStatus === 'MISSING' || packageStatus === 'DAMAGED') {
var sid = afaMissingScannableFromObject(obj);
var problemKey = packageStatus + '|' + sid;
if (sid && !seenProblem[problemKey]) {
seenProblem[problemKey] = true;
missingIds.push(sid);
problemPackages.push({ id: sid, status: packageStatus });
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
problemPackages: problemPackages,
cart: cart,
sawPackageSignals: sawPackageSignals
};
}
function afaMissingInfoFromDocument(doc) {
if (!doc) return { missingIds: [], problemPackages: [], cart: '' };
var missingIds = [];
var problemPackages = [];
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
var packageStatus = '';
for (var s = 0; s < cells.length; s++) {
var cellText = afaMissingText(cells[s].textContent || '').toUpperCase();
if (cellText === 'MISSING' || cellText === 'DAMAGED') {
statusIdx = s;
packageStatus = cellText;
break;
}
}
if (statusIdx < 0) continue;
var sid = '';
if (cells[statusIdx + 1]) sid = afaMissingText(cells[statusIdx + 1].textContent || '');
if (!sid) {
try {
var statusCell = row.querySelector('.jobdetails-package-status');
if (statusCell && statusCell.nextElementSibling) {
sid = afaMissingText(statusCell.nextElementSibling.textContent || '');
}
} catch(e3) {}
}
var problemKey = packageStatus + '|' + sid;
if (sid && !seen[problemKey]) {
seen[problemKey] = true;
missingIds.push(sid);
problemPackages.push({ id: sid, status: packageStatus });
}
}
return { missingIds: missingIds, problemPackages: problemPackages, cart: cart };
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
if (/\b(?:MISSING|DAMAGED)\b/i.test(txt)) return true;
if (/(?:▲|⚠|❗|⛔)\s*\d*/.test(txt)) return true;
if (/\bA\d+\b/i.test(txt)) return true;
try {
if (node.querySelector(
'[class*="warning-sign"],[class*="warning"],' +
'[class*="exclamation"],[class*="triangle"],' +
'[class*="danger"],[class*="alert"]'
)) {
return true;
}
} catch(e2) {}
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
for (var i = 0; i < cards.length; i++) {
var card = cards[i];
try {
if (isInExcludedSection(card)) continue;
} catch(e) {}
var a = card.querySelector('a');
var item = afaMissingCandidateFromAnchor(a, 'Tasks', i, 0);
if (!item) continue;
var txt = afaMissingText(card.innerText || card.textContent || '');
if (!afaHasMissingPackageSignal(card)) continue;
item.alertScore += 20;
if (/\b(?:MISSING|DAMAGED)\b/i.test(txt)) item.alertScore += 30;
pushCandidate(item);
}
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
pushCandidate(afaMissingCandidateFromAnchor(
psAnchors[p],
'Problem Solve',
10000 + p,
15
));
}
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
if (parsed.sawPackageSignals) return null;
}
return afaProbeMissingJobPage(item);
}, function(){
return afaProbeMissingJobPage(item);
});
}
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
var packages = Array.isArray(info.problemPackages) && info.problemPackages.length
? info.problemPackages
: info.missingIds.map(function(id){ return { id: id, status: 'MISSING' }; });
for (var i = 0; i < packages.length; i++) {
var sid = afaMissingText(packages[i] && packages[i].id);
var packageStatus = afaMissingText(packages[i] && packages[i].status).toUpperCase() || 'MISSING';
if (!sid) continue;
var key = String(info.id || item.id || '') + '|' + packageStatus + '|' + sid;
if (seen[key]) continue;
seen[key] = true;
entries.push({
missingId: sid,
packageStatus: packageStatus,
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
var packages = Array.isArray(info.problemPackages) && info.problemPackages.length
? info.problemPackages
: (Array.isArray(info.missingIds) ? info.missingIds : []).map(function(id){
return { id: id, status: 'MISSING' };
});
for (var i = 0; i < packages.length; i++) {
var sid = afaMissingText(packages[i] && packages[i].id);
if (!sid) continue;
out.push({
missingId: sid,
packageStatus: afaMissingText(packages[i] && packages[i].status).toUpperCase() || 'MISSING',
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
'<div id="cbt-afa-lead">No MISSING or DAMAGED package was found in Tasks, Problem Solve, or Partially Batched.</div>' +
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
try { applyUiScale(); } catch(eScale) {}
function renderCurrent() {
if (!_afaOverlay || !card.isConnected) return;
var stage = card.querySelector('#cbt-missing-qr-stage');
if (!stage) return;
var entry = entries[currentIndex];
var total = entries.length;
var hasPrev = currentIndex > 0;
var hasNext = currentIndex < total - 1;
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
var packageStatus = afaMissingText(entry.packageStatus).toUpperCase() || 'MISSING';
var packageKind = packageStatus === 'DAMAGED' ? 'Damaged Package' : 'Missing Package';
var tiles = afaMissingQrTile(packageKind, entry.missingId);
var hasCart = !!entry.cart;
if (hasCart) {
tiles += afaMissingQrTile('Cart', entry.cart);
}
var note = hasCart
? packageKind + ' QR + cart QR.'
: 'No CART_ location was found, so only the ' + packageKind.toLowerCase() + ' QR is shown.';
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
function moveMissingQr(direction) {
var nextIndex = currentIndex + direction;
if (nextIndex < 0 || nextIndex >= entries.length) return false;
currentIndex = nextIndex;
renderCurrent();
return true;
}
card.setAttribute('tabindex', '-1');
card.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
try { card.focus({ preventScroll: true }); }
catch(eFocus) { try { card.focus(); } catch(eFocus2) {} }
card.addEventListener('keydown', function(e){
if (!e) return;
var isLeft = e.key === 'ArrowLeft' || e.keyCode === 37;
var isRight = e.key === 'ArrowRight' || e.keyCode === 39;
if (!isLeft && !isRight) return;
try { e.preventDefault(); } catch(ignoreKey1) {}
try { e.stopPropagation(); } catch(ignoreKey2) {}
moveMissingQr(isLeft ? -1 : 1);
});
card.addEventListener('click', function(e){
var b = e.target.closest('[data-afa]');
if (!b) return;
var action = b.getAttribute('data-afa');
if (action === 'missing-prev') {
moveMissingQr(-1);
return;
}
if (action === 'missing-next') {
moveMissingQr(1);
return;
}
if (action === 'close') {
afaClose();
} else if (action === 'back') {
afaConfirm();
}
});
}
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
var AFA_COMPLETE_PATH = '/api/store/{storeId}/job/{jobId}/completeJob';
var AFA_COMPLETE_BODY = {};
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
function(){ return { ok: res.ok, status: res.status, body: '' }; }
);
}, function(err){
clearTimeout(timer);
return { ok: false, status: 0, body: (err && err.message) ? String(err.message) : 'network error' };
});
}
function afaForceAssign(jobId) {
var url = COMO_BASE + '/api/store/' + STORE_ID + '/job/' + encodeURIComponent(jobId) + '/forceAssignable';
var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, AFA_TIMEOUT_MS);
var opts = {
method: 'POST',
credentials: 'include',
headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
body: JSON.stringify({ ignoreProblemSolve: false })
};
if (ctrl) opts.signal = ctrl.signal;
return _origFetch(url, opts).then(function(res){
clearTimeout(timer);
return res.text().then(
function(t){ return { ok: res.ok, status: res.status, body: t }; },
function(){ return { ok: res.ok, status: res.status, body: '' }; }
);
}, function(err){
clearTimeout(timer);
return { ok: false, status: 0, body: (err && err.message) ? String(err.message) : 'network error' };
});
}
function cbtAssignNormText(v) {
return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}
function cbtAssignHeaderMap() {
var header = document.querySelector('div.row.job-card-header');
if (!header) return null;
var cols;
try {
cols = Array.prototype.slice.call(
header.querySelectorAll(':scope > div[class*="col-"]')
);
} catch(e) {
cols = Array.prototype.slice.call(header.children || []);
}
var map = { cart: -1, assignment: -1, batch: -1, progress: -1 };
for (var i = 0; i < cols.length; i++) {
var t = cbtAssignNormText(cols[i].textContent || '').toLowerCase();
if (map.cart < 0 && /^cart(?:\/s)?$|^carts?$/.test(t)) {
map.cart = i;
}
if (map.assignment < 0 && /task\s*assignment/.test(t)) {
map.assignment = i;
}
if (map.batch < 0 && /batch\s*target/.test(t)) {
map.batch = i;
}
if (map.progress < 0 && /^progress$/.test(t)) {
map.progress = i;
}
}
return (map.cart >= 0 && map.assignment >= 0 && map.batch >= 0)
? map
: null;
}
function cbtAssignDirectCols(row) {
if (!row) return [];
try {
return Array.prototype.slice.call(
row.querySelectorAll(':scope > div[class*="col-"]')
);
} catch(e) {
return Array.prototype.slice.call(row.children || []).filter(function(el){
return el &&
/(^|\s)col-(?:xs|sm|md|lg)-/.test(String(el.className || ''));
});
}
}
function cbtAssignPackageCount(progressText) {
var s = cbtAssignNormText(progressText || '');
if (!s) return 0;
var fraction = s.match(/(\d+)\s*\/\s*(\d+)/);
if (fraction) {
return Number(fraction[2]) || 0;
}
var nums = s.match(/\d+/g);
if (!nums || !nums.length) return 0;
return Number(nums[nums.length - 1]) || 0;
}
function cbtAssignCartIsBlank(v) {
var s = cbtAssignNormText(v).toUpperCase();
return !s ||
s === '-' ||
s === '—' ||
s === 'N/A' ||
s === 'NA' ||
s === 'NONE';
}
function cbtAssignLinkInfoFromCard(card, ref) {
var links = [];
try {
links = Array.prototype.slice.call(card.querySelectorAll('a[href]'));
} catch(e) {}
for (var i = 0; i < links.length; i++) {
var rawHref = links[i].getAttribute('href') || '';
var m = rawHref.match(/jobId=([^&#]+)/i);
if (!m) continue;
var id = null;
try { id = decodeURIComponent(m[1]); }
catch(e2) { id = m[1]; }
var detailsUrl = null;
try {
detailsUrl = new URL(rawHref, window.location.href).href;
} catch(e3) {
detailsUrl = rawHref;
}
return { id: id, detailsUrl: detailsUrl };
}
var fallbackId =
(ref && _afaJobIndex && _afaJobIndex[ref])
? _afaJobIndex[ref]
: null;
return {
id: fallbackId,
detailsUrl: fallbackId
? (
COMO_BASE +
'/store/' +
encodeURIComponent(STORE_ID) +
'/jobdetails?jobId=' +
encodeURIComponent(fallbackId)
)
: null
};
}
function cbtAssignSiteTaskState() {
var snap = null;
try { snap = cbtRecMainTasksSnapshot(); } catch(e) {}
if (!snap) {
return {
ready: false,
count: null,
hasTasks: false
};
}
var count = Math.max(0, Number(snap.count) || 0);
return {
ready: true,
count: count,
hasTasks: count > 0
};
}
function cbtAssignHasSiteTasks() {
return cbtAssignSiteTaskState().hasTasks;
}
var CBT_ASSIGN_PROTECT_MS = 1 * 60 * 1000;
var CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS = 4000;
var CBT_ASSIGN_SHARED_PROTECT_ROOT = '/como_assign_protect_v1/' + CBT_HISTORY_STORE_SCOPE;
var CBT_ASSIGN_SHARED_PROTECT_KEY = 'cbt_assign_shared_protect_v1_' + CBT_HISTORY_STORE_SCOPE;
var _cbtAssignSharedProtectCache = Object.create(null);
var _cbtAssignSharedProtectCacheLoaded = false;
var _cbtAssignSharedProtectPullInFlight = false;
var _cbtAssignSharedProtectEtag = '';
var _cbtAssignSharedNodeToJobId = Object.create(null);
var _cbtAssignLiveStreamReq = null;
var _cbtAssignLiveStreamActive = false;
var _cbtAssignLiveStreamReady = false;
var _cbtAssignLiveStreamLastProgress = 0;
var _cbtAssignLiveStreamStartedAt = 0;
var _cbtAssignLiveStreamGeneration = 0;
var _cbtAssignLiveStreamOffset = 0;
var _cbtAssignLiveStreamBuffer = '';
var _cbtAssignLiveStreamRetryTimer = null;
var _cbtAssignSharedProtectSaveTimer = null;
var _cbtAssignSharedProtectLastSavedJson = '';
function cbtAssignNowMs() {
try { return typeof cbtNowMs === 'function' ? cbtNowMs() : Date.now(); }
catch(e) { return Date.now(); }
}
function cbtAssignSharedNodeForJob(jobId) {
return 'p_' + cbtBatchEventHash(
CBT_HISTORY_STORE_SCOPE + '|' + String(jobId || ''),
43
);
}
function cbtAssignSharedProtectUrl(jobId) {
var base = FIREBASE_URL + CBT_ASSIGN_SHARED_PROTECT_ROOT;
if (!jobId) return base + '.json';
return base + '/' + cbtAssignSharedNodeForJob(jobId) + '.json';
}
function cbtAssignLoadSharedProtection() {
if (_cbtAssignSharedProtectCacheLoaded) return _cbtAssignSharedProtectCache;
_cbtAssignSharedProtectCacheLoaded = true;
try {
var raw = localStorage.getItem(CBT_ASSIGN_SHARED_PROTECT_KEY);
var parsed = raw ? JSON.parse(raw) : {};
var clean = {};
if (parsed && typeof parsed === 'object') {
for (var id in parsed) {
var candidate = Object.assign({}, parsed[id] || {}, {jobId:(parsed[id] && parsed[id].jobId) || id});
var row = cbtAssignSanitizeProtection(candidate);
if (row) {
clean[row.jobId] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(row.jobId)] = row.jobId;
}
}
}
_cbtAssignSharedProtectCache = clean;
} catch(e) {}
return _cbtAssignSharedProtectCache;
}
function cbtAssignSaveSharedProtection() {
try {
var json = JSON.stringify(_cbtAssignSharedProtectCache || {});
if (json === _cbtAssignSharedProtectLastSavedJson) return;
localStorage.setItem(CBT_ASSIGN_SHARED_PROTECT_KEY, json);
_cbtAssignSharedProtectLastSavedJson = json;
} catch(e) {}
}
function cbtAssignScheduleSharedProtectionSave() {
if (_cbtAssignSharedProtectSaveTimer) return;
_cbtAssignSharedProtectSaveTimer = setTimeout(function(){
_cbtAssignSharedProtectSaveTimer = null;
cbtAssignSaveSharedProtection();
}, 0);
}
function cbtAssignSanitizeProtection(row) {
if (!row || typeof row !== 'object') return null;
var until = Number(row.until) || 0;
if (until <= cbtAssignNowMs()) return null;
var jobId = String(row.jobId || '').trim();
if (!jobId) return null;
return {
jobId:jobId, until:until,
associate:cbtNormalizeAssociateName(row.associate || ''),
ref:cbtAssignNormText(row.ref || '').slice(0,80),
token:String(row.token || '').slice(0,160),
pending:!!row.pending
};
}
function cbtAssignSharedProtectionPut(jobId, row, attempt) {
if (!syncEnabled() || !jobId || !row) return;
attempt = Number(attempt) || 0;
row = Object.assign({}, row, { jobId:String(jobId) });
try {
GM_xmlhttpRequest({
method:'PUT', url:cbtAssignSharedProtectUrl(jobId), headers:{'Content-Type':'application/json'}, data:JSON.stringify(row),
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(res){ if (!(res.status>=200&&res.status<300) && attempt<3) setTimeout(function(){cbtAssignSharedProtectionPut(jobId,row,attempt+1);},75*(attempt+1)); },
onerror:function(){ if(attempt<3)setTimeout(function(){cbtAssignSharedProtectionPut(jobId,row,attempt+1);},75*(attempt+1)); },
ontimeout:function(){ if(attempt<3)setTimeout(function(){cbtAssignSharedProtectionPut(jobId,row,attempt+1);},75*(attempt+1)); }
});
} catch(e) { if(attempt<3)setTimeout(function(){cbtAssignSharedProtectionPut(jobId,row,attempt+1);},75*(attempt+1)); }
}
function cbtAssignAcquireSharedReservation(jobId, associate, attempt, visibleRef) {
jobId = String(jobId || '');
associate = cbtNormalizeAssociateName(associate || '');
attempt = Number(attempt) || 0;
visibleRef = cbtAssignNormText(visibleRef || '').slice(0,80);
if (!jobId) {
return Promise.resolve({
ok:false,
error:true,
fatal:true,
reason:'Shared assignment lock key is missing.'
});
}
if (!syncEnabled()) return Promise.resolve({ok:true,token:'',local:true});
var token = (MY_DEVICE_ID || getDeviceId()) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
return new Promise(function(resolve){
function fatal(reason) {
resolve({
ok:false,
error:true,
fatal:true,
reason:reason || 'Shared assignment lock is unavailable.'
});
}
function run(tryNo) {
try {
GM_xmlhttpRequest({
method:'GET', url:cbtAssignSharedProtectUrl(jobId), headers:{'Content-Type':'application/json','X-Firebase-ETag':'true'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(getRes){
if (!(getRes.status>=200 && getRes.status<300)) {
fatal('Shared assignment lock could not be read. Assignment was not started to prevent a cross-computer conflict.');
return;
}
var existing=null;
try { if (getRes.responseText && getRes.responseText!=='null') existing=cbtAssignSanitizeProtection(JSON.parse(getRes.responseText)); } catch(e0) {}
if (existing) { resolve({ok:false,row:existing,contention:true}); return; }
var etag=cbtFirebaseEtag(getRes.responseHeaders);
if (!etag) {
fatal('Shared assignment lock could not be verified. Assignment was not started to prevent a cross-computer conflict.');
return;
}
var row={jobId:jobId,until:cbtAssignNowMs()+30000,associate:associate,ref:visibleRef,token:token,pending:true};
GM_xmlhttpRequest({
method:'PUT',url:cbtAssignSharedProtectUrl(jobId),headers:{'Content-Type':'application/json','If-Match':etag},data:JSON.stringify(row),
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(putRes){
if(putRes.status===412){
if(tryNo<4){setTimeout(function(){run(tryNo+1);},25*(tryNo+1));return;}
resolve({ok:false,contention:true,reason:'Another computer reserved this item first.'});
return;
}
if(putRes.status>=200&&putRes.status<300){
cbtAssignLoadSharedProtection()[jobId] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)] = jobId;
cbtAssignSaveSharedProtection();
try { cbtAssignRenderProtectionCountdown(); } catch(eRenderPending) {}
resolve({ok:true,token:token,row:row});
return;
}
fatal('Shared assignment lock could not be saved. Assignment was not started to prevent a cross-computer conflict.');
},onerror:function(){fatal('Shared assignment lock could not be saved. Assignment was not started to prevent a cross-computer conflict.');},
ontimeout:function(){fatal('Shared assignment lock save timed out. Assignment was not started to prevent a cross-computer conflict.');}
});
},onerror:function(){fatal('Shared assignment lock could not be read. Assignment was not started to prevent a cross-computer conflict.');},
ontimeout:function(){fatal('Shared assignment lock timed out. Assignment was not started to prevent a cross-computer conflict.');}
});
} catch(e) {
fatal('Shared assignment lock is unavailable. Assignment was not started to prevent a cross-computer conflict.');
}
}
run(attempt);
});
}
function cbtAssignReleaseSharedReservation(jobId, token) {
jobId=String(jobId||''); token=String(token||'');
if(!jobId||!token||!syncEnabled()) return;
try{
GM_xmlhttpRequest({
method:'GET',url:cbtAssignSharedProtectUrl(jobId),headers:{'Content-Type':'application/json','X-Firebase-ETag':'true'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(res){
var row=null;try{if(res.status>=200&&res.status<300&&res.responseText&&res.responseText!=='null')row=JSON.parse(res.responseText);}catch(e0){}
if(!row||String(row.token||'')!==token||!row.pending)return;
var etag=cbtFirebaseEtag(res.responseHeaders);if(!etag)return;
try{
GM_xmlhttpRequest({
method:'DELETE',
url:cbtAssignSharedProtectUrl(jobId),
headers:{'If-Match':etag},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(delRes){
if(delRes.status>=200&&delRes.status<300){
var shared = cbtAssignLoadSharedProtection();
if(shared[jobId] && String(shared[jobId].token||'')===token && shared[jobId].pending){
delete shared[jobId];
delete _cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)];
cbtAssignCommitSharedProtectionVisual();
}
}
},
onerror:function(){},
ontimeout:function(){}
});
}catch(e1){}
},onerror:function(){},ontimeout:function(){}
});
}catch(e){}
}
function cbtAssignSharedProtectionCheck(jobId, ignoreToken) {
jobId = String(jobId || '');
if (!jobId || !syncEnabled()) return Promise.resolve(null);
return new Promise(function(resolve){
try {
GM_xmlhttpRequest({
method:'GET', url:cbtAssignSharedProtectUrl(jobId), headers:{'Content-Type':'application/json'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(res){
var row = null;
try { if (res.status>=200 && res.status<300 && res.responseText && res.responseText!=='null') row = cbtAssignSanitizeProtection(JSON.parse(res.responseText)); } catch(e0) {}
if (row && ignoreToken && row.token === ignoreToken) { resolve(null); return; }
if (row) {
cbtAssignLoadSharedProtection()[jobId] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)] = jobId;
cbtAssignSaveSharedProtection();
try { cbtAssignRenderProtectionCountdown(); } catch(eRender) {}
}
resolve(row);
},
onerror:function(){ resolve(null); },
ontimeout:function(){ resolve(null); }
});
} catch(e) { resolve(null); }
});
}
function cbtAssignCommitSharedProtectionVisual() {
try { cbtAssignRenderProtectionCountdown(); } catch(eRender) {}
try { cbtAssignRenderGlobalSessionState(); } catch(eGlobalLock) {}
cbtAssignScheduleSharedProtectionSave();
}
function cbtAssignApplySharedProtectionSnapshot(raw) {
var clean = Object.create(null);
var nodeMap = Object.create(null);
var expiredNodes = [];
raw = raw && typeof raw === 'object' ? raw : {};
for (var node in raw) {
var row = cbtAssignSanitizeProtection(raw[node]);
if (row) {
clean[row.jobId] = row;
nodeMap[node] = row.jobId;
} else {
expiredNodes.push(node);
}
}
_cbtAssignSharedProtectCache = clean;
_cbtAssignSharedProtectCacheLoaded = true;
_cbtAssignSharedNodeToJobId = nodeMap;
cbtAssignCommitSharedProtectionVisual();
return expiredNodes;
}
function cbtAssignApplySharedProtectionNode(node, rawRow, deferCommit) {
node = String(node || '').replace(/^\/+|\/+$/g, '');
if (!node) return;
cbtAssignLoadSharedProtection();
var previousJobId = _cbtAssignSharedNodeToJobId[node];
if (previousJobId) {
delete _cbtAssignSharedProtectCache[previousJobId];
delete _cbtAssignSharedNodeToJobId[node];
}
var row = cbtAssignSanitizeProtection(rawRow);
if (row) {
_cbtAssignSharedProtectCache[row.jobId] = row;
_cbtAssignSharedNodeToJobId[node] = row.jobId;
}
if (!deferCommit) cbtAssignCommitSharedProtectionVisual();
}
function cbtAssignSharedProtectionNodeRaw(node) {
node = String(node || '').replace(/^\/+|\/+$/g, '');
var jobId = _cbtAssignSharedNodeToJobId[node];
var row = jobId ? _cbtAssignSharedProtectCache[jobId] : null;
return row ? Object.assign({}, row) : null;
}
function cbtAssignApplySharedStreamMessage(eventName, payload) {
if (eventName !== 'put' && eventName !== 'patch') return;
var message = null;
try { message = JSON.parse(payload || '{}'); }
catch(eParse) { return; }
if (!message || typeof message !== 'object') return;
var path = String(message.path || '/');
var data = message.data;
var segments = path.split('/').filter(Boolean);
if (!segments.length && eventName === 'put') {
cbtAssignApplySharedProtectionSnapshot(data || {});
return;
}
if (!segments.length && eventName === 'patch') {
if (!data || typeof data !== 'object') return;
var patchNodes = Object.keys(data);
patchNodes.forEach(function(node){
var patchData = data[node];
if (patchData && typeof patchData === 'object' &&
_cbtAssignSharedNodeToJobId[node]) {
var existing = cbtAssignSharedProtectionNodeRaw(node) || {};
patchData = Object.assign(existing, patchData);
}
cbtAssignApplySharedProtectionNode(node, patchData, true);
});
if (patchNodes.length) cbtAssignCommitSharedProtectionVisual();
return;
}
var node = segments[0];
if (segments.length === 1) {
if (eventName === 'patch' && data && typeof data === 'object') {
var base = cbtAssignSharedProtectionNodeRaw(node) || {};
data = Object.assign(base, data);
}
cbtAssignApplySharedProtectionNode(node, data);
return;
}
var current = cbtAssignSharedProtectionNodeRaw(node);
if (!current) {
try { cbtAssignSharedProtectionPull(true); } catch(ePull) {}
return;
}
var cursor = current;
for (var i = 1; i < segments.length - 1; i++) {
var key = segments[i];
if (!cursor[key] || typeof cursor[key] !== 'object') {
cursor[key] = {};
}
cursor = cursor[key];
}
var leaf = segments[segments.length - 1];
if (data === null) delete cursor[leaf];
else cursor[leaf] = data;
cbtAssignApplySharedProtectionNode(node, current);
}
function cbtAssignParseSharedStreamBlock(block) {
block = String(block || '').trim();
if (!block || block.charAt(0) === ':') return;
var eventName = 'message';
var dataLines = [];
block.split(/\r?\n/).forEach(function(line){
if (line.indexOf('event:') === 0) {
eventName = line.slice(6).trim();
} else if (line.indexOf('data:') === 0) {
dataLines.push(line.slice(5).trim());
}
});
if (!dataLines.length) return;
if (eventName === 'put' || eventName === 'patch') {
cbtAssignApplySharedStreamMessage(
eventName,
dataLines.join('\n')
);
}
}
function cbtAssignHandleSharedStreamProgress(res) {
var full = '';
try { full = String((res && res.responseText) || ''); }
catch(eText) { return; }
if (full.length < _cbtAssignLiveStreamOffset) {
_cbtAssignLiveStreamOffset = 0;
_cbtAssignLiveStreamBuffer = '';
}
if (full.length === _cbtAssignLiveStreamOffset) return;
_cbtAssignLiveStreamReady = true;
_cbtAssignLiveStreamLastProgress = Date.now();
var chunk = full.slice(_cbtAssignLiveStreamOffset);
_cbtAssignLiveStreamOffset = full.length;
_cbtAssignLiveStreamBuffer += chunk;
var separator = null;
while ((separator = /\r?\n\r?\n/.exec(_cbtAssignLiveStreamBuffer))) {
var splitAt = separator.index;
var block = _cbtAssignLiveStreamBuffer.slice(0, splitAt);
_cbtAssignLiveStreamBuffer =
_cbtAssignLiveStreamBuffer.slice(
splitAt + separator[0].length
);
cbtAssignParseSharedStreamBlock(block);
}
if (_cbtAssignLiveStreamBuffer.length > 128 * 1024) {
_cbtAssignLiveStreamBuffer =
_cbtAssignLiveStreamBuffer.slice(-64 * 1024);
}
}
function cbtAssignScheduleSharedProtectionLiveReconnect(delayMs) {
if (_cbtAssignLiveStreamRetryTimer || !syncEnabled()) return;
_cbtAssignLiveStreamRetryTimer = setTimeout(function(){
_cbtAssignLiveStreamRetryTimer = null;
cbtAssignStartSharedProtectionLive();
}, Math.max(50, Number(delayMs) || 150));
}
function cbtAssignStopSharedProtectionLive() {
_cbtAssignLiveStreamGeneration++;
_cbtAssignLiveStreamActive = false;
_cbtAssignLiveStreamReady = false;
_cbtAssignLiveStreamLastProgress = 0;
_cbtAssignLiveStreamStartedAt = 0;
_cbtAssignLiveStreamOffset = 0;
_cbtAssignLiveStreamBuffer = '';
if (_cbtAssignLiveStreamRetryTimer) {
clearTimeout(_cbtAssignLiveStreamRetryTimer);
_cbtAssignLiveStreamRetryTimer = null;
}
var req = _cbtAssignLiveStreamReq;
_cbtAssignLiveStreamReq = null;
try {
if (req && typeof req.abort === 'function') req.abort();
} catch(eAbort) {}
}
function cbtAssignStartSharedProtectionLive() {
if (!syncEnabled() || _cbtAssignLiveStreamActive) return;
var generation = ++_cbtAssignLiveStreamGeneration;
var finished = false;
_cbtAssignLiveStreamActive = true;
_cbtAssignLiveStreamReady = false;
_cbtAssignLiveStreamLastProgress = 0;
_cbtAssignLiveStreamStartedAt = Date.now();
_cbtAssignLiveStreamOffset = 0;
_cbtAssignLiveStreamBuffer = '';
function finish(retryDelay) {
if (finished || generation !== _cbtAssignLiveStreamGeneration) return;
finished = true;
_cbtAssignLiveStreamActive = false;
_cbtAssignLiveStreamReady = false;
_cbtAssignLiveStreamLastProgress = 0;
_cbtAssignLiveStreamStartedAt = 0;
_cbtAssignLiveStreamReq = null;
cbtAssignScheduleSharedProtectionLiveReconnect(retryDelay);
}
try {
_cbtAssignLiveStreamReq = GM_xmlhttpRequest({
method: 'GET',
url: cbtAssignSharedProtectUrl(''),
headers: {
'Accept': 'text/event-stream',
'Cache-Control': 'no-cache'
},
onprogress: function(res) {
if (generation !== _cbtAssignLiveStreamGeneration) return;
cbtAssignHandleSharedStreamProgress(res);
},
onload: function(res) {
if (generation !== _cbtAssignLiveStreamGeneration) return;
try { cbtAssignHandleSharedStreamProgress(res); } catch(eProgress) {}
try { cbtAssignSharedProtectionPull(true); } catch(ePull) {}
finish(75);
},
onerror: function() {
if (generation !== _cbtAssignLiveStreamGeneration) return;
try { cbtAssignSharedProtectionPull(true); } catch(ePull) {}
finish(150);
},
ontimeout: function() {
if (generation !== _cbtAssignLiveStreamGeneration) return;
try { cbtAssignSharedProtectionPull(true); } catch(ePull) {}
finish(150);
}
});
} catch(eStream) {
finish(250);
}
}
function cbtAssignDeleteExpiredSharedNode(node) {
node = String(node || '').replace(/^\/+|\/+$/g, '');
if (!node || !syncEnabled()) return;
var url = FIREBASE_URL + CBT_ASSIGN_SHARED_PROTECT_ROOT + '/' + encodeURIComponent(node) + '.json';
try {
GM_xmlhttpRequest({
method:'GET',
url:url,
headers:{'Content-Type':'application/json','X-Firebase-ETag':'true'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(getRes){
if (!(getRes.status>=200 && getRes.status<300)) return;
if (!getRes.responseText || getRes.responseText === 'null') return;
var current = null;
try { current = JSON.parse(getRes.responseText); } catch(e0) { return; }
// Never delete a node that became active after the root snapshot was taken.
if (cbtAssignSanitizeProtection(current)) return;
var etag = cbtFirebaseEtag(getRes.responseHeaders);
if (!etag) return;
try {
GM_xmlhttpRequest({
method:'DELETE',
url:url,
headers:{'If-Match':etag},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(){},
onerror:function(){},
ontimeout:function(){}
});
} catch(e1) {}
},
onerror:function(){},
ontimeout:function(){}
});
} catch(e) {}
}
function cbtAssignSharedProtectionPull(force) {
if (_cbtAssignSharedProtectPullInFlight || !syncEnabled()) return;
if (!force && document.hidden) return;
_cbtAssignSharedProtectPullInFlight = true;
try {
var headers = {
'Content-Type':'application/json',
'X-Firebase-ETag':'true'
};
if (_cbtAssignSharedProtectEtag) {
headers['If-None-Match'] = _cbtAssignSharedProtectEtag;
}
GM_xmlhttpRequest({
method:'GET',
url:cbtAssignSharedProtectUrl(''),
headers:headers,
timeout:CBT_FIREBASE_SYNC_TIMEOUT_MS,
onload:function(res){
_cbtAssignSharedProtectPullInFlight = false;
if (res.status === 304) return;
var raw = {};
var expiredNodes = [];
var parsedOk = true;
try {
raw =
res.status >= 200 &&
res.status < 300 &&
res.responseText &&
res.responseText !== 'null'
? (JSON.parse(res.responseText) || {})
: {};
} catch(e0) {
parsedOk = false;
}
if (res.status >= 200 && res.status < 300 && parsedOk) {
var nextEtag = cbtFirebaseEtag(res.responseHeaders);
if (nextEtag) _cbtAssignSharedProtectEtag = nextEtag;
expiredNodes = cbtAssignApplySharedProtectionSnapshot(raw);
}
expiredNodes.slice(0,20).forEach(function(node){
try { cbtAssignDeleteExpiredSharedNode(node); } catch(e1) {}
});
},
onerror:function(){
_cbtAssignSharedProtectPullInFlight = false;
},
ontimeout:function(){
_cbtAssignSharedProtectPullInFlight = false;
}
});
} catch(e) {
_cbtAssignSharedProtectPullInFlight = false;
}
}
var _cbtAssignProtectCache = Object.create(null);
var _cbtAssignProtectCacheKey = '';
var _cbtAssignProtectCacheLoaded = false;
function cbtAssignProtectKey() {
return 'cbt_assign_protect_v2_' + String(STORE_ID || 'unknown')
.replace(/[^A-Za-z0-9_.-]/g, '_');
}
function cbtAssignPersistProtection() {
if (!_cbtAssignProtectCacheLoaded || !_cbtAssignProtectCacheKey) return;
try {
localStorage.setItem(
_cbtAssignProtectCacheKey,
JSON.stringify(_cbtAssignProtectCache)
);
} catch(e) {}
}
function cbtAssignLoadProtection() {
var key = cbtAssignProtectKey();
if (!_cbtAssignProtectCacheLoaded || _cbtAssignProtectCacheKey !== key) {
_cbtAssignProtectCache = Object.create(null);
_cbtAssignProtectCacheKey = key;
_cbtAssignProtectCacheLoaded = true;
try {
var raw = localStorage.getItem(key);
var parsed = raw ? JSON.parse(raw) : null;
if (parsed && typeof parsed === 'object') {
Object.keys(parsed).forEach(function(jobId){
var row = parsed[jobId] || {};
var until = Number(row.until) || 0;
if (until <= cbtAssignNowMs()) return;
_cbtAssignProtectCache[String(jobId)] = {
jobId:String(jobId), until:until,
associate:cbtNormalizeAssociateName(row.associate || ''),
ref:cbtAssignNormText(row.ref || '').slice(0,80),
token:String(row.token || ''), pending:!!row.pending
};
});
}
} catch(e) {}
}
return _cbtAssignProtectCache;
}
function cbtAssignProtect(jobId, associate, ref) {
jobId = String(jobId || '');
if (!jobId) return;
var rows = cbtAssignLoadProtection();
var row = {
jobId:jobId,
until: cbtAssignNowMs() + CBT_ASSIGN_PROTECT_MS,
associate: cbtNormalizeAssociateName(associate || ''),
ref: cbtAssignNormText(ref || '').slice(0,80),
token:'', pending:false
};
rows[jobId] = row;
cbtAssignLoadSharedProtection()[jobId] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)] = jobId;
cbtAssignPersistProtection();
cbtAssignSaveSharedProtection();
cbtAssignSharedProtectionPut(jobId, row);
}
function cbtAssignProtection(jobId) {
jobId = String(jobId || '');
if (!jobId) return null;
var now = cbtAssignNowMs();
var local = cbtAssignLoadProtection();
var shared = cbtAssignLoadSharedProtection();
var a = local[jobId], b = shared[jobId];
var row = null;
if (a && Number(a.until) > now) row = a;
if (b && Number(b.until) > now && (!row || Number(b.until) > Number(row.until))) row = b;
if (a && Number(a.until) <= now) { delete local[jobId]; cbtAssignPersistProtection(); }
if (b && Number(b.until) <= now) {
delete shared[jobId];
delete _cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)];
cbtAssignSaveSharedProtection();
}
return row;
}
function cbtAssignIsProtected(jobId, ignoreReservationToken) {
var row = cbtAssignProtection(jobId);
if (!row) return false;
if (ignoreReservationToken &&
row.pending &&
String(row.token || '') === String(ignoreReservationToken)) {
return false;
}
return true;
}
function cbtAssignProtectionSeconds(jobId, knownRow) {
var row = knownRow || cbtAssignProtection(jobId);
if (!row) return 0;
return Math.max(1, Math.ceil((Number(row.until) - cbtAssignNowMs()) / 1000));
}
var CBT_ASSIGN_ASSOC_PROTECT_PREFIX = '__assoc__:';
function cbtAssignAssociateProtectKey(associate) {
var name = cbtNormalizeAssociateName(associate || '');
if (!name) return '';
return CBT_ASSIGN_ASSOC_PROTECT_PREFIX + name.toLowerCase();
}
function cbtAssignAssociateProtection(associate) {
var key = cbtAssignAssociateProtectKey(associate);
return key ? cbtAssignProtection(key) : null;
}
function cbtAssignAssociateCooldownSeconds(associate, knownRow) {
var row = knownRow || cbtAssignAssociateProtection(associate);
if (!row) return 0;
return Math.max(1, Math.ceil((Number(row.until) - cbtAssignNowMs()) / 1000));
}
function cbtAssignAcquireAssociateReservation(associate) {
var key = cbtAssignAssociateProtectKey(associate);
if (!key) return Promise.resolve({ok:true,token:''});
return cbtAssignAcquireSharedReservation(key, associate);
}
function cbtAssignReleaseAssociateReservation(associate, token) {
var key = cbtAssignAssociateProtectKey(associate);
if (key && token) cbtAssignReleaseSharedReservation(key, token);
}
function cbtAssignProtectAssociate(associate) {
var key = cbtAssignAssociateProtectKey(associate);
if (!key) return;
cbtAssignProtect(key, associate, '');
}

// Global store-wide Assign UI/session lease. Exactly one computer/browser may own
// the Assign workflow at a time. The picker gets a 15-second turn; once an actual
// assignment run starts, the same lease is safely renewed until that run finishes.
var CBT_ASSIGN_UI_SESSION_KEY = '__cbt_assign_ui_session__';
var CBT_ASSIGN_UI_SESSION_MS = 15 * 1000;
var _cbtAssignUiSessionToken = '';
var _cbtAssignUiSessionDeadline = 0;
var _cbtAssignUiSessionRunHeartbeat = null;
var _cbtAssignUiSessionAutoBackPending = false;
var _cbtAssignUiAcquireSeq = 0;
function cbtAssignUiSessionRow() {
return cbtAssignProtection(CBT_ASSIGN_UI_SESSION_KEY);
}
function cbtAssignUiSessionSeconds(row) {
row = row || cbtAssignUiSessionRow();
if (!row) return 0;
return Math.max(1, Math.ceil((Number(row.until) - cbtAssignNowMs()) / 1000));
}
function cbtAssignUiSessionOwned() {
if (!syncEnabled()) return true;
if (!_cbtAssignUiSessionToken) return false;
var row = cbtAssignUiSessionRow();
return !!(row && String(row.token || '') === String(_cbtAssignUiSessionToken));
}
function cbtAssignUiSessionOwnedByOther() {
if (!syncEnabled()) return null;
var row = cbtAssignUiSessionRow();
if (!row) return null;
if (_cbtAssignUiSessionToken && String(row.token || '') === String(_cbtAssignUiSessionToken)) return null;
return row;
}
function cbtAssignAcquireUiSessionLock(acquireSeq) {
acquireSeq = Number(acquireSeq) || 0;
if (!syncEnabled()) {
if (acquireSeq && acquireSeq !== _cbtAssignUiAcquireSeq) {
return Promise.resolve({ok:false,cancelled:true});
}
_cbtAssignUiSessionToken = 'local_' + Date.now().toString(36);
_cbtAssignUiSessionDeadline = cbtAssignNowMs() + CBT_ASSIGN_UI_SESSION_MS;
return Promise.resolve({ok:true,token:_cbtAssignUiSessionToken,local:true});
}
var token = (MY_DEVICE_ID || getDeviceId()) + '_assign_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
return new Promise(function(resolve){
function run(tryNo) {
try {
GM_xmlhttpRequest({
method:'GET',
url:cbtAssignSharedProtectUrl(CBT_ASSIGN_UI_SESSION_KEY),
headers:{'Content-Type':'application/json','X-Firebase-ETag':'true'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(getRes){
if (acquireSeq && acquireSeq !== _cbtAssignUiAcquireSeq) {
resolve({ok:false,cancelled:true});
return;
}
if (!(getRes.status>=200 && getRes.status<300)) {
resolve({ok:false,error:true,reason:'Shared Assign lock is unavailable.'});
return;
}
var existing = null;
try {
if (getRes.responseText && getRes.responseText !== 'null') existing = cbtAssignSanitizeProtection(JSON.parse(getRes.responseText));
} catch(e0) {}
if (existing) {
resolve({ok:false,row:existing});
return;
}
var etag = cbtFirebaseEtag(getRes.responseHeaders);
if (!etag) {
resolve({ok:false,error:true,reason:'Shared Assign lock could not be verified.'});
return;
}
var row = {
jobId:CBT_ASSIGN_UI_SESSION_KEY,
until:cbtAssignNowMs() + CBT_ASSIGN_UI_SESSION_MS,
associate:'',
ref:'',
token:token,
pending:true
};
GM_xmlhttpRequest({
method:'PUT',
url:cbtAssignSharedProtectUrl(CBT_ASSIGN_UI_SESSION_KEY),
headers:{'Content-Type':'application/json','If-Match':etag},
data:JSON.stringify(row),
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(putRes){
if (putRes.status === 412 && tryNo < 4) {
setTimeout(function(){ run(tryNo + 1); }, 20 * (tryNo + 1));
return;
}
if (putRes.status >= 200 && putRes.status < 300) {
if (acquireSeq && acquireSeq !== _cbtAssignUiAcquireSeq) {
cbtAssignReleaseSharedReservation(CBT_ASSIGN_UI_SESSION_KEY, token);
resolve({ok:false,cancelled:true});
return;
}
_cbtAssignUiSessionToken = token;
_cbtAssignUiSessionDeadline = Number(row.until) || 0;
cbtAssignLoadSharedProtection()[CBT_ASSIGN_UI_SESSION_KEY] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(CBT_ASSIGN_UI_SESSION_KEY)] = CBT_ASSIGN_UI_SESSION_KEY;
cbtAssignScheduleSharedProtectionSave();
try { cbtAssignRenderGlobalSessionState(); } catch(eRender) {}
resolve({ok:true,token:token,row:row});
return;
}
resolve({ok:false,error:true,reason:'Another computer may have taken the Assign turn.'});
},
onerror:function(){ resolve({ok:false,error:true,reason:'Shared Assign lock is unavailable.'}); },
ontimeout:function(){ resolve({ok:false,error:true,reason:'Shared Assign lock timed out.'}); }
});
},
onerror:function(){ resolve({ok:false,error:true,reason:'Shared Assign lock is unavailable.'}); },
ontimeout:function(){ resolve({ok:false,error:true,reason:'Shared Assign lock timed out.'}); }
});
} catch(e) {
resolve({ok:false,error:true,reason:'Shared Assign lock is unavailable.'});
}
}
run(0);
});
}
function cbtAssignRenewUiSessionLock() {
if (!syncEnabled()) {
_cbtAssignUiSessionDeadline = cbtAssignNowMs() + CBT_ASSIGN_UI_SESSION_MS;
return Promise.resolve(true);
}
var token = String(_cbtAssignUiSessionToken || '');
if (!token) return Promise.resolve(false);
return new Promise(function(resolve){
try {
GM_xmlhttpRequest({
method:'GET',
url:cbtAssignSharedProtectUrl(CBT_ASSIGN_UI_SESSION_KEY),
headers:{'Content-Type':'application/json','X-Firebase-ETag':'true'},
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(getRes){
var current = null;
try {
if (getRes.status>=200 && getRes.status<300 && getRes.responseText && getRes.responseText !== 'null') current = JSON.parse(getRes.responseText);
} catch(e0) {}
if (!current || String(current.token || '') !== token || !current.pending) { resolve(false); return; }
if (String(_cbtAssignUiSessionToken || '') !== token) { resolve(false); return; }
var etag = cbtFirebaseEtag(getRes.responseHeaders);
if (!etag) { resolve(false); return; }
var row = Object.assign({}, current, {
jobId:CBT_ASSIGN_UI_SESSION_KEY,
until:cbtAssignNowMs() + CBT_ASSIGN_UI_SESSION_MS,
token:token,
pending:true,
ref:''
});
GM_xmlhttpRequest({
method:'PUT',
url:cbtAssignSharedProtectUrl(CBT_ASSIGN_UI_SESSION_KEY),
headers:{'Content-Type':'application/json','If-Match':etag},
data:JSON.stringify(row),
timeout:CBT_ASSIGN_LOCK_REQUEST_TIMEOUT_MS,
onload:function(putRes){
if (putRes.status>=200 && putRes.status<300) {
if (String(_cbtAssignUiSessionToken || '') !== token) {
cbtAssignReleaseSharedReservation(CBT_ASSIGN_UI_SESSION_KEY, token);
resolve(false);
return;
}
_cbtAssignUiSessionDeadline = Number(row.until) || 0;
cbtAssignLoadSharedProtection()[CBT_ASSIGN_UI_SESSION_KEY] = cbtAssignSanitizeProtection(row) || row;
cbtAssignScheduleSharedProtectionSave();
try { cbtAssignRenderGlobalSessionState(); } catch(eRender) {}
resolve(true);
return;
}
resolve(false);
},
onerror:function(){ resolve(false); },
ontimeout:function(){ resolve(false); }
});
},
onerror:function(){ resolve(false); },
ontimeout:function(){ resolve(false); }
});
} catch(e) { resolve(false); }
});
}
function cbtAssignReleaseUiSessionLock() {
_cbtAssignUiAcquireSeq++;
var token = String(_cbtAssignUiSessionToken || '');
_cbtAssignUiSessionToken = '';
_cbtAssignUiSessionDeadline = 0;
_cbtAssignUiSessionAutoBackPending = false;
if (_cbtAssignUiSessionRunHeartbeat) {
clearInterval(_cbtAssignUiSessionRunHeartbeat);
_cbtAssignUiSessionRunHeartbeat = null;
}
// Clear our own cached lease immediately so this computer never briefly
// mistakes its just-released turn for another computer's lock.
if (token) {
try {
var shared = cbtAssignLoadSharedProtection();
var cached = shared[CBT_ASSIGN_UI_SESSION_KEY];
if (cached && String(cached.token || '') === token) {
delete shared[CBT_ASSIGN_UI_SESSION_KEY];
delete _cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(CBT_ASSIGN_UI_SESSION_KEY)];
cbtAssignScheduleSharedProtectionSave();
}
} catch(eCacheRelease) {}
}
if (!token) { try { cbtAssignRenderGlobalSessionState(); } catch(e0) {} return; }
if (!syncEnabled()) { try { cbtAssignRenderGlobalSessionState(); } catch(e1) {} return; }
cbtAssignReleaseSharedReservation(CBT_ASSIGN_UI_SESSION_KEY, token);
try { cbtAssignRenderGlobalSessionState(); } catch(e2) {}
}
function cbtAssignStartUiSessionRunHeartbeat() {
if (!syncEnabled() || !_cbtAssignUiSessionToken) return;
if (_cbtAssignUiSessionRunHeartbeat) clearInterval(_cbtAssignUiSessionRunHeartbeat);
cbtAssignRenewUiSessionLock().then(function(ok){ if (!ok && _afaRunning) _afaStop = true; });
_cbtAssignUiSessionRunHeartbeat = setInterval(function(){
if (!_afaRunning || !_cbtAssignUiSessionToken) return;
cbtAssignRenewUiSessionLock().then(function(ok){
if (!ok && _afaRunning) _afaStop = true;
});
}, 3000);
}
function cbtAssignRenderGlobalSessionState() {
var row = cbtAssignUiSessionRow();
var now = cbtAssignNowMs();
var own = !!(row && _cbtAssignUiSessionToken && String(row.token || '') === String(_cbtAssignUiSessionToken));
var other = !!(row && !own);
var seconds = row ? Math.max(1, Math.ceil((Number(row.until) - now) / 1000)) : 0;
var overlay = _afaOverlay;
var card = overlay && overlay.querySelector('#cbt-afa-card');
if (card) {
var menuAssign = card.querySelector('[data-afa="assign"]');
if (menuAssign) {
if (other) {
menuAssign.setAttribute('data-cbt-global-locked','1');
menuAssign.disabled = true;
menuAssign.textContent = 'Wait ' + seconds + 's';
menuAssign.title = 'Another computer is using Assign. ' + seconds + 's remaining.';
var copy = menuAssign.nextElementSibling;
if (copy && copy.classList && copy.classList.contains('cbt-afa-action-copy')) {
copy.textContent = 'Another computer is using Assign — wait ' + seconds + 's.';
}
} else if (menuAssign.getAttribute('data-cbt-global-locked') === '1') {
menuAssign.removeAttribute('data-cbt-global-locked');
menuAssign.textContent = '▶ Assign Cart';
menuAssign.title = '';
var hasNormalNow = cbtAssignHasSiteTasks();
var hasPartialNow = cbtAssignHasPartialTasks();
menuAssign.disabled = !hasNormalNow && !hasPartialNow;
var restoreCopy = menuAssign.nextElementSibling;
if (restoreCopy && restoreCopy.classList && restoreCopy.classList.contains('cbt-afa-action-copy')) {
restoreCopy.textContent = hasNormalNow
? 'Select associates in order. Normal Tasks are the default; Partially Batched can be selected exclusively inside Assign Cart.'
: (hasPartialNow
? 'Partially Batched carts are available. Open Assign Cart and check “Only Assign Partially Batched Carts”.'
: 'No normal Tasks or readable Partially Batched carts are available right now.');
}
}
}
var turn = card.querySelector('#cbt-afa-assign-turn');
if (turn) {
if (own) {
turn.textContent = _afaRunning ? 'Assign In Use · protected across all computers' : 'Your Assign Turn · ' + seconds + 's remaining';
turn.className = 'cbt-afa-note cbt-afa-assign-turn-own';
} else if (other) {
turn.textContent = 'Wait ' + seconds + 's · another computer is using Assign';
turn.className = 'cbt-afa-note cbt-afa-assign-turn-wait';
} else {
turn.textContent = 'Assign turn expired.';
}
var start = card.querySelector('[data-afa="assign-start"]');
if (start && !own && syncEnabled()) start.disabled = true;
}
}
// If this computer held the 15-second picker turn but did not start a run,
// automatically move it back to the Assign menu when its lease expires/lost.
if (_cbtAssignUiSessionToken && !_afaRunning) {
var stillOwn = own && Number(row.until) > now;
if (!stillOwn && !_cbtAssignUiSessionAutoBackPending) {
_cbtAssignUiSessionAutoBackPending = true;
var staleToken = _cbtAssignUiSessionToken;
_cbtAssignUiSessionToken = '';
_cbtAssignUiSessionDeadline = 0;
setTimeout(function(){
_cbtAssignUiSessionAutoBackPending = false;
if (_afaRunning) return;
var title = document.getElementById('cbt-afa-title');
if (title && /^Assign$/i.test(String(title.textContent || '').trim())) {
try { afaConfirm(); } catch(eBack) {}
}
if (staleToken && syncEnabled()) cbtAssignReleaseSharedReservation(CBT_ASSIGN_UI_SESSION_KEY, staleToken);
}, 0);
}
}
}
function cbtAssignOpenPickerWithGlobalLock() {
var other = cbtAssignUiSessionOwnedByOther();
if (other) {
try { cbtAssignRenderGlobalSessionState(); } catch(e0) {}
return;
}
var overlayAtRequest = _afaOverlay;
var acquireSeq = ++_cbtAssignUiAcquireSeq;
cbtAssignAcquireUiSessionLock(acquireSeq).then(function(lock){
if (acquireSeq !== _cbtAssignUiAcquireSeq || !_afaOverlay || _afaOverlay !== overlayAtRequest) {
if (lock && lock.ok && lock.token && syncEnabled()) {
cbtAssignReleaseSharedReservation(CBT_ASSIGN_UI_SESSION_KEY, lock.token);
}
return;
}
if (!lock || !lock.ok) {
try { cbtAssignRenderGlobalSessionState(); } catch(e1) {}
var card = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
var btn = card && card.querySelector('[data-afa="assign"]');
if (btn && lock && lock.row) {
var sec = Math.max(1, Math.ceil((Number(lock.row.until) - cbtAssignNowMs()) / 1000));
btn.disabled = true;
btn.setAttribute('data-cbt-global-locked','1');
btn.textContent = 'Wait ' + sec + 's';
}
return;
}
afaAssignPicker();
try { cbtAssignRenderGlobalSessionState(); } catch(e2) {}
});
}
function cbtAssignUpdateProtectionMeta(jobId, associate, ref) {
jobId = String(jobId || '');
if (!jobId) return;
var row = cbtAssignProtection(jobId);
if (!row) return;
row.associate = cbtAssignNormText(associate || row.associate || '');
row.ref = cbtAssignNormText(ref || row.ref || '').slice(0, 80);
row.pending = false;
row.token = '';
cbtAssignLoadProtection()[jobId] = row;
cbtAssignLoadSharedProtection()[jobId] = row;
_cbtAssignSharedNodeToJobId[cbtAssignSharedNodeForJob(jobId)] = jobId;
cbtAssignPersistProtection();
cbtAssignSaveSharedProtection();
cbtAssignSharedProtectionPut(jobId, row);
try { cbtAssignRenderProtectionCountdown(); } catch(eRender) {}
}
function cbtAssignEnsureProtectionStyle() {
if (document.getElementById('cbt-assign-cooldown-style')) return;
var style = document.createElement('style');
style.id = 'cbt-assign-cooldown-style';
style.textContent =
'job-card.cbt-assign-cooldown{' +
'display:block;' +
'box-shadow:inset 4px 0 0 #f59e0b,inset 0 0 0 1px rgba(245,158,11,.62) !important;' +
'background:rgba(245,158,11,.08) !important;' +
'transition:none !important;' +
'animation:none !important;' +
'}' +
'job-card.cbt-assign-cooldown > .row{' +
'background:rgba(245,158,11,.06) !important;' +
'transition:none !important;' +
'animation:none !important;' +
'}' +
'.cbt-assign-cooldown-destination{' +
'position:relative !important;' +
'overflow:visible !important;' +
'}' +
'.cbt-assign-cooldown-destination::after{' +
'content:attr(data-cbt-cooldown);' +
'position:absolute;' +
'left:var(--cbt-accept-gap-x,50%);' +
'right:auto;' +
'max-width:none;' +
'overflow:visible;' +
'top:50%;' +
'transform:translate(-50%,-50%);' +
'text-align:center;' +
'display:block;' +
'margin:0;' +
'padding:0;' +
'border:0;' +
'background:transparent;' +
'color:#d97706;' +
'font-size:22px;' +
'font-weight:600;' +
'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;' +
'font-variant-numeric:tabular-nums;' +
'line-height:1;' +
'white-space:nowrap;' +
'pointer-events:none;' +
'z-index:3;' +
'transition:none !important;' +
'animation:none !important;' +
'}';
(document.head || document.documentElement).appendChild(style);
}
var _cbtAssignCardIndexVersion = -1;
var _cbtAssignCardIndex = null;
var _cbtAssignHighlightedCards = new Set();
function cbtAssignBuildCardIndex() {
if (_cbtAssignCardIndex &&
_cbtAssignCardIndexVersion === _cbtRelevantDomVersion) {
return { index:_cbtAssignCardIndex, rebuilt:false };
}
var index = {
rows: [],
byRef: Object.create(null)
};
var cards = document.querySelectorAll('job-card');
for (var i = 0; i < cards.length; i++) {
var card = cards[i];
try { if (isInExcludedSection(card)) continue; }
catch(eExcluded) {}
var a = null;
try { a = card.querySelector('a'); } catch(eA) {}
var currentRef = a
? cbtAssignNormText(a.textContent || '').toLowerCase()
: '';
var rememberedRef = cbtAssignNormText(
card.getAttribute('data-cbt-protect-ref') || ''
).toLowerCase();
var destinationCell = null;
var cartCell = null;
try {
var rowEl = card.querySelector('div.row');
var cols = rowEl
? rowEl.querySelectorAll(':scope > div[class*="col-"]')
: null;
if (cols && cols.length > 1) destinationCell = cols[1];
if (cols && cols.length > 2) cartCell = cols[2];
} catch(eDest) {}
var entry = {
card: card,
destinationCell: destinationCell,
cartCell: cartCell,
currentRef: currentRef,
rememberedRef: rememberedRef
};
index.rows.push(entry);
function addRef(ref) {
if (!ref) return;
if (!index.byRef[ref]) index.byRef[ref] = [];
index.byRef[ref].push(entry);
}
addRef(currentRef);
if (rememberedRef && rememberedRef !== currentRef) addRef(rememberedRef);
}
_cbtAssignCardIndexVersion = _cbtRelevantDomVersion;
_cbtAssignCardIndex = index;
return { index:index, rebuilt:true };
}
function cbtAssignClearCooldownEntry(entry) {
if (!entry || !entry.card) return;
var card = entry.card;
try {
card.classList.remove('cbt-assign-cooldown');
card.removeAttribute('data-cbt-protect-ref');
} catch(e0) {}
var cell = entry.destinationCell;
if (!cell || !cell.isConnected) {
try {
var rowEl = card.querySelector('div.row');
var cols = rowEl ? rowEl.querySelectorAll(':scope > div[class*="col-"]') : null;
if (cols && cols.length > 1) cell = cols[1];
} catch(e1) { cell = null; }
}
if (cell) {
try {
cell.classList.remove('cbt-assign-cooldown-destination');
cell.removeAttribute('data-cbt-cooldown');
cell.style.removeProperty('--cbt-accept-gap-x');
} catch(e2) {}
}
}
function cbtAssignRenderProtectionCountdown() {
if (!isDashboardView()) return;
cbtAssignEnsureProtectionStyle();
var now = cbtAssignNowMs();
var localRows = cbtAssignLoadProtection();
var sharedRows = cbtAssignLoadSharedProtection();
var mergedRows = Object.create(null);
var byRef = Object.create(null);
var changedLocal = false;
var changedShared = false;
function mergeProtection(jobId, p, source) {
if (!p || Number(p.until) <= now) {
if (source === 'local' && localRows[jobId]) {
delete localRows[jobId];
changedLocal = true;
}
if (source === 'shared' && sharedRows[jobId]) {
delete sharedRows[jobId];
changedShared = true;
}
return;
}
var existing = mergedRows[jobId];
if (!existing ||
Number(p.until) > Number(existing.until) ||
(Number(p.until) === Number(existing.until) &&
!cbtAssignNormText(existing.ref || '') &&
!!cbtAssignNormText(p.ref || ''))) {
mergedRows[jobId] = p;
}
}
Object.keys(localRows).forEach(function(jobId){
mergeProtection(jobId, localRows[jobId], 'local');
});
Object.keys(sharedRows).forEach(function(jobId){
mergeProtection(jobId, sharedRows[jobId], 'shared');
});
Object.keys(mergedRows).forEach(function(jobId){
var p = mergedRows[jobId];
var ref = cbtAssignNormText(p.ref || '').toLowerCase();
if (!ref) return;
byRef[ref] = {
jobId: String(jobId),
row: p,
seconds: Math.max(1, Math.ceil((Number(p.until) - now) / 1000))
};
});
if (changedLocal) cbtAssignPersistProtection();
if (changedShared) cbtAssignSaveSharedProtection();
var built = cbtAssignBuildCardIndex();
var cardIndex = built.index;
var nextHighlighted = new Set();
if (built.rebuilt) {
for (var r0 = 0; r0 < cardIndex.rows.length; r0++) {
cbtAssignClearCooldownEntry(cardIndex.rows[r0]);
}
} else {
_cbtAssignHighlightedCards.forEach(function(card){
if (!card || !card.isConnected) return;
});
}
var refs = Object.keys(byRef);
for (var ri = 0; ri < refs.length; ri++) {
var wantedRef = refs[ri];
var candidates = cardIndex.byRef[wantedRef] || [];
for (var ci = 0; ci < candidates.length; ci++) {
var entry = candidates[ci];
var card = entry.card;
if (!card || !card.isConnected) continue;
var selectedRef =
(entry.currentRef && byRef[entry.currentRef])
? entry.currentRef
: (entry.rememberedRef && byRef[entry.rememberedRef]
? entry.rememberedRef
: entry.currentRef);
var protectedInfo = selectedRef ? byRef[selectedRef] : null;
if (!protectedInfo) continue;
try {
card.classList.add('cbt-assign-cooldown');
card.setAttribute('data-cbt-protect-ref', selectedRef);
} catch(eCard) {}
var destinationCell = entry.destinationCell;
if (destinationCell && destinationCell.isConnected) {
try {
destinationCell.classList.add('cbt-assign-cooldown-destination');
var nextText = protectedInfo.seconds + 's To Accept';
if (destinationCell.getAttribute('data-cbt-cooldown') !== nextText) {
destinationCell.setAttribute('data-cbt-cooldown', nextText);
}
// Put the label between the VISIBLE Destination value and VISIBLE Cart value,
// not at the geometric middle of either column. Nudge it slightly left as requested.
var cartCell = entry.cartCell;
if (cartCell && cartCell.isConnected) {
var destRect = destinationCell.getBoundingClientRect();
var cartRect = cartCell.getBoundingClientRect();
function directTextRect(cell) {
try {
var nodes = cell.childNodes || [];
for (var ni = 0; ni < nodes.length; ni++) {
var node = nodes[ni];
if (!node || node.nodeType !== 3 || !String(node.nodeValue || '').trim()) continue;
var range = document.createRange();
range.selectNodeContents(node);
var rr = range.getBoundingClientRect();
if (rr && rr.width > 0) return rr;
}
} catch(eTextRect) {}
return null;
}
var destTextRect = directTextRect(destinationCell);
var cartTextRect = directTextRect(cartCell);
var gapLeft = destTextRect ? destTextRect.right : (destRect.left + destRect.width * 0.35);
var gapRight = cartTextRect ? cartTextRect.left : (cartRect.left + cartRect.width * 0.20);
var targetViewportX = (gapLeft + gapRight) / 2;
// Nudge the label a little farther left while keeping it in the open gap and without moving columns.
targetViewportX -= 22;
var localX = targetViewportX - destRect.left;
destinationCell.style.setProperty('--cbt-accept-gap-x', localX.toFixed(2) + 'px');
} else {
destinationCell.style.removeProperty('--cbt-accept-gap-x');
}
} catch(eCell) {}
}
nextHighlighted.add(card);
}
}
_cbtAssignHighlightedCards.forEach(function(card){
if (!card || !card.isConnected || nextHighlighted.has(card)) return;
var entry = null;
for (var i2 = 0; i2 < cardIndex.rows.length; i2++) {
if (cardIndex.rows[i2].card === card) { entry = cardIndex.rows[i2]; break; }
}
if (entry) cbtAssignClearCooldownEntry(entry);
else {
try {
card.classList.remove('cbt-assign-cooldown');
card.removeAttribute('data-cbt-protect-ref');
var oldCell = card.querySelector('.cbt-assign-cooldown-destination');
if (oldCell) {
oldCell.classList.remove('cbt-assign-cooldown-destination');
oldCell.removeAttribute('data-cbt-cooldown');
oldCell.style.removeProperty('--cbt-accept-gap-x');
}
} catch(eOld) {}
}
});
_cbtAssignHighlightedCards = nextHighlighted;
}
function cbtAssignReadRows() {
var map = cbtAssignHeaderMap();
if (!map) return [];
var out = [];
var cards = document.querySelectorAll('job-card');
for (var i = 0; i < cards.length; i++) {
var card = cards[i];
try {
if (isInExcludedSection(card)) continue;
} catch(eExcluded) {}
var row = null;
try {
row = card.querySelector('div.row');
} catch(eRow) {}
if (!row) continue;
var cols = cbtAssignDirectCols(row);
if (cols.length <= Math.max(
map.cart,
map.assignment,
map.batch,
map.progress >= 0 ? map.progress : 0
)) {
continue;
}
var a = null;
try {
a = card.querySelector('a');
} catch(eLink) {}
var ref = a ? cbtAssignNormText(a.textContent || '') : '';
if (!ref) continue;
var linkInfo = cbtAssignLinkInfoFromCard(card, ref);
var id = linkInfo && linkInfo.id;
if (!id) continue;
var cart = cbtAssignNormText(cols[map.cart].textContent || '');
var assignment = cbtAssignNormText(
cols[map.assignment].textContent || ''
);
var batchRaw = cbtAssignNormText(cols[map.batch].textContent || '');
var batchMatch = batchRaw.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
var batchMs = batchMatch ? parseTime(batchMatch[0]) : null;
var progressRaw =
(map.progress >= 0 && cols[map.progress])
? cbtAssignNormText(cols[map.progress].textContent || '')
: '';
var packageCount = cbtAssignPackageCount(progressRaw);
var cartBlank = cbtAssignCartIsBlank(cart);
out.push({
key: String(id),
id: id,
detailsUrl: linkInfo && linkInfo.detailsUrl,
ref: ref,
cart: cart,
cartBlank: cartBlank,
cartHasValue: !cartBlank,
assignment: assignment,
assignmentHasName:
!!assignment &&
assignment.toUpperCase() !== 'ASSIGNABLE' &&
assignment.toUpperCase() !== 'UNASSIGNABLE',
assignable: assignment.toUpperCase() === 'ASSIGNABLE',
unassignable: assignment.toUpperCase() === 'UNASSIGNABLE',
batchRaw: batchRaw,
batchMs: batchMs,
progressRaw: progressRaw,
packageCount: packageCount,
rowOrder: i
});
}
return out;
}
var CBT_FORCED_PARTIAL_PENDING_MS = 10 * 60 * 1000;
function cbtForcedPartialPendingKey() {
return 'cbt_forced_partial_pending_v1_' +
String(STORE_ID || 'unknown').trim().toUpperCase();
}
function cbtLoadForcedPartialPending() {
var now = Date.now();
var list = [];
try {
var raw = sessionStorage.getItem(
cbtForcedPartialPendingKey()
);
if (raw) {
var parsed = JSON.parse(raw);
if (Array.isArray(parsed)) list = parsed;
}
} catch(e0) {
list = [];
}
var clean = [];
for (var i = 0; i < list.length; i++) {
var x = list[i] || {};
var id = String(x.id || '');
var ref = cbtAssignNormText(x.ref || '');
var ts = Number(x.ts) || 0;
if (!id || !ref || !ts) continue;
if (now - ts > CBT_FORCED_PARTIAL_PENDING_MS) continue;
clean.push({
id: id,
ref: ref,
ts: ts
});
}
if (clean.length !== list.length) {
try {
sessionStorage.setItem(
cbtForcedPartialPendingKey(),
JSON.stringify(clean)
);
} catch(e1) {}
}
return clean;
}
function cbtSaveForcedPartialPending(list) {
try {
sessionStorage.setItem(
cbtForcedPartialPendingKey(),
JSON.stringify(list || [])
);
} catch(e) {}
}
function cbtRememberForcedPartial(jobId, ref) {
var id = String(jobId || '');
var shortRef = cbtAssignNormText(ref || '');
if (!id || !shortRef) return;
var list = cbtLoadForcedPartialPending().filter(function(x){
return String(x.id || '') !== id;
});
list.push({
id: id,
ref: shortRef,
ts: Date.now()
});
cbtSaveForcedPartialPending(list);
try { cbtSchedulePartialCheckboxRefresh(); } catch(eRefresh) {}
}
function cbtForgetForcedPartial(jobId) {
var id = String(jobId || '');
if (!id) return;
var list = cbtLoadForcedPartialPending().filter(function(x){
return String(x.id || '') !== id;
});
cbtSaveForcedPartialPending(list);
try { cbtSchedulePartialCheckboxRefresh(); } catch(eRefresh) {}
}
function cbtForcedPartialIdentity(jobId, ref) {
var id = String(jobId || '');
var shortRef = cbtAssignNormText(ref || '').toLowerCase();
if (!id || !shortRef) return false;
var list = cbtLoadForcedPartialPending();
for (var i = 0; i < list.length; i++) {
var x = list[i] || {};
if (String(x.id || '') !== id) continue;
if (cbtAssignNormText(x.ref || '').toLowerCase() !== shortRef) continue;
return true;
}
return false;
}
function cbtForcedPartialRows() {
var list = cbtLoadForcedPartialPending();
var out = [];
var taskRows = [];
try {
taskRows = cbtAssignReadRows() || [];
} catch(e0) {
taskRows = [];
}
var taskById = Object.create(null);
for (var ti = 0; ti < taskRows.length; ti++) {
var tr = taskRows[ti] || {};
var tid = String(tr.key || tr.id || '');
if (!tid || taskById[tid]) continue;
taskById[tid] = tr;
}
for (var i = 0; i < list.length; i++) {
var item = list[i] || {};
var id = String(item.id || '');
var ref = cbtAssignNormText(item.ref || '');
if (!id || !ref) continue;
var currentTask = taskById[id] || null;
out.push({
key: id,
id: id,
detailsUrl:
COMO_BASE +
'/store/' +
encodeURIComponent(STORE_ID) +
'/jobdetails?jobId=' +
encodeURIComponent(id),
ref: ref,
partial: true,
partialSectionVerified: true,
explicitPartialId: true,
partialOriginForced: true,
cart: currentTask ? (currentTask.cart || '') : '',
cartBlank: currentTask ? !!currentTask.cartBlank : true,
cartHasValue: currentTask ? !!currentTask.cartHasValue : false,
assignment: currentTask ? (currentTask.assignment || '') : '',
assignmentHasName:
currentTask ? !!currentTask.assignmentHasName : false,
assignable: true,
batchRaw:
currentTask && currentTask.batchRaw
? currentTask.batchRaw
: 'Waiting For Task Timing',
batchMs:
currentTask && Number.isFinite(Number(currentTask.batchMs))
? Number(currentTask.batchMs)
: Number.MAX_SAFE_INTEGER,
progressRaw:
currentTask ? (currentTask.progressRaw || '') : '',
packageCount:
currentTask && Number.isFinite(Number(currentTask.packageCount))
? Number(currentTask.packageCount)
: 0,
rowOrder:
currentTask && Number.isFinite(Number(currentTask.rowOrder))
? Number(currentTask.rowOrder)
: i
});
}
return out;
}
function cbtAssignFindStrictPartialSection() {
var sections = [];
try {
sections = Array.prototype.slice.call(
document.querySelectorAll('dropped-job[state="SIDELINED"]')
);
if (!sections.length) {
sections = Array.prototype.slice.call(
document.querySelectorAll('dropped-job')
);
}
} catch(e) {
return null;
}
for (var i = 0; i < sections.length; i++) {
var section = sections[i];
var headings = [];
try {
headings = section.querySelectorAll('h1,h2,h3,h4');
} catch(e2) {
headings = [];
}
for (var h = 0; h < headings.length; h++) {
var title = cbtAssignNormText(
headings[h].textContent || ''
);
if (/^Partially\s+Batched(?:\s*\(\d+\))?$/i.test(title)) {
return section;
}
}
}
return null;
}
function cbtAssignExplicitJobIdFromNode(node) {
if (!node) return '';
var nodes = [node];
try {
var ownerCard = node.closest && node.closest('job-card');
if (ownerCard && nodes.indexOf(ownerCard) === -1) nodes.push(ownerCard);
} catch(e0) {}
for (var i = 0; i < nodes.length; i++) {
var el = nodes[i];
if (!el || !el.getAttribute) continue;
var attrs = [
'href',
'ng-href',
'data-ng-href',
'data-href',
'data-job-id',
'data-jobid',
'job-id',
'jobid',
'id'
];
for (var a = 0; a < attrs.length; a++) {
var raw = '';
try { raw = el.getAttribute(attrs[a]) || ''; }
catch(eAttr) { raw = ''; }
if (!raw) continue;
var m = String(raw).match(/jobId=([^&#"']+)/i);
if (m) {
try { return decodeURIComponent(m[1]); }
catch(eDec) { return m[1]; }
}
if (afaLooksLikeJobId(raw)) return String(raw);
}
}
var root = nodes.length > 1 ? nodes[1] : node;
var descendants = [];
try {
descendants = Array.prototype.slice.call(
root.querySelectorAll(
'[href*="jobId="],[ng-href*="jobId="],[data-ng-href*="jobId="],' +
'[data-job-id],[data-jobid],[job-id],[jobid]'
)
);
} catch(eQ) {
descendants = [];
}
for (var d = 0; d < descendants.length; d++) {
var got = cbtAssignExplicitJobIdFromNode(descendants[d]);
if (got) return got;
}
return '';
}
function cbtAssignMainTaskIdentityConflict(jobId, ref) {
var rows = [];
try { rows = cbtAssignReadRows() || []; }
catch(e) { rows = []; }
var idKey = String(jobId || '');
var refKey = cbtAssignNormText(ref || '').toLowerCase();
for (var i = 0; i < rows.length; i++) {
var r = rows[i] || {};
if (idKey && String(r.key || '') === idKey) {
return true;
}
if (refKey &&
cbtAssignNormText(r.ref || '').toLowerCase() === refKey) {
return true;
}
}
return false;
}
function cbtAssignStrictPartialCandidates() {
var section = cbtAssignFindStrictPartialSection();
if (!section) return [];
var holder = null;
try {
holder =
section.querySelector('.job-cards') ||
section.querySelector('[class*="job-cards"]');
} catch(e0) {}
if (!holder) return [];
var found = [];
var seen = Object.create(null);
var cards = [];
try {
cards = Array.prototype.slice.call(
holder.querySelectorAll('job-card')
);
} catch(e1) {
cards = [];
}
function addFromAnchor(a, rowOrder) {
if (!a) return;
try {
var owner = a.closest('dropped-job');
if (owner !== section) return;
} catch(eOwner) {
return;
}
var ref = cbtAssignNormText(a.textContent || '');
if (!ref || ref.length > 24) return;
var id = cbtAssignExplicitJobIdFromNode(a);
if (!id) return;
id = String(id);
if (cbtAssignMainTaskIdentityConflict(id, ref)) return;
var key = id;
if (seen[key]) return;
seen[key] = true;
found.push({
ref: ref,
id: id,
partial: true,
partialSectionVerified: true,
explicitPartialId: true,
rowOrder: rowOrder
});
}
if (cards.length) {
for (var i = 0; i < cards.length; i++) {
var card = cards[i];
var a = null;
try {
a =
card.querySelector('a[href*="jobId="]') ||
card.querySelector('a');
} catch(eCard) {}
addFromAnchor(a, i);
}
return found;
}
var anchors = [];
try {
anchors = Array.prototype.slice.call(
holder.querySelectorAll('a')
);
} catch(eAnchors) {
anchors = [];
}
for (var j = 0; j < anchors.length; j++) {
addFromAnchor(anchors[j], j);
}
return found;
}
function cbtAssignReadPartialRows() {
// Partial-only assignment may use a cart only while BOTH conditions are true:
// 1) the cart is still visibly/strictly verified in the current Partially Batched section; and
// 2) this browser previously remembered that exact cart through the verified Partial workflow.
// This prevents stale remembered carts from remaining assignable after Amazon moves them elsewhere.
var forced = [];
var strict = [];
try { forced = cbtForcedPartialRows() || []; } catch(eForced) { forced = []; }
try { strict = cbtAssignStrictPartialCandidates() || []; } catch(eStrict) { strict = []; }
if (!forced.length || !strict.length) return [];
var strictById = Object.create(null);
for (var si = 0; si < strict.length; si++) {
var s = strict[si] || {};
var sid = String(s.id || s.key || '');
var sref = cbtAssignNormText(s.ref || '').toLowerCase();
if (!sid || !sref) continue;
strictById[sid] = { ref: sref, rowOrder: Number(s.rowOrder) || si };
}
var ready = [];
for (var fi = 0; fi < forced.length; fi++) {
var f = forced[fi] || {};
var fid = String(f.id || f.key || '');
var current = strictById[fid];
if (!current) continue;
if (cbtAssignNormText(f.ref || '').toLowerCase() !== current.ref) continue;
if (!cbtForcedPartialIdentity(fid, f.ref)) continue;
f.rowOrder = current.rowOrder;
f.partialSectionVerified = true;
ready.push(f);
}
return ready;
}
function cbtAssignHasPartialTasks() {
return cbtAssignReadPartialRows().length > 0;
}
function cbtAssignPartialCheckboxAvailable() {
try {
return cbtAssignReadPartialRows().length > 0;
} catch(e) {
return false;
}
}
function cbtAssignRefreshPartialCheckboxState() {
var box = document.getElementById('cbt-afa-type-partial');
if (!box) return;
var available = cbtAssignPartialCheckboxAvailable();
var label = box.closest ? box.closest('label.cbt-afa-opt') : null;
box.disabled = !available;
if (label) {
label.style.opacity = available ? '1' : '0.45';
label.style.cursor = available ? '' : 'not-allowed';
label.title = available
? 'Verified Partially Batched carts are ready to assign.'
: 'No verified Partially Batched carts are ready to assign right now.';
}
if (!available && box.checked) {
box.checked = false;
try {
box.dispatchEvent(new Event('change', { bubbles: true }));
} catch(e) {}
}
}
function cbtAssignTaskType(r) {
if (!r) return '';
if (r.partial) return 'partial';
if (!r.assignmentHasName && !r.cartHasValue) return 'blank';
if (r.assignmentHasName && !r.cartHasValue) return 'name';
if (!r.assignmentHasName && r.cartHasValue) return 'cart';
return 'both';
}
function cbtAssignNormalizeTaskTypes(options) {
options = options || {};
var partialOnly = !!options.partialOnly;
return {
partialOnly: partialOnly,
partialIds: options.partialIds || null,
name: !partialOnly,
blank: !partialOnly,
cart: !partialOnly && !!options.cart,
both: !partialOnly && !!options.both
};
}
function cbtAssignTaskTypeAllowed(r, options) {
var scope = cbtAssignNormalizeTaskTypes(options);
var type = cbtAssignTaskType(r);
if (scope.partialOnly) return type === 'partial';
if (type === 'blank') return true;
if (type === 'name') return scope.name;
if (type === 'cart') return scope.cart;
if (type === 'both') return scope.both;
return false;
}
function cbtAssignVisibleRowLooksAccepted(r) {
if (!r) return false;
var progress =
cbtAssignNormText(r.progressRaw || '').toUpperCase();
return /\b(BATCHING|IN_PROGRESS|ACCEPTED|STARTED|COMPLETED|COMPLETE|DONE)\b/.test(progress);
}
function cbtAssignRowCanBeTried(r, options) {
if (!r) return false;
var scope = cbtAssignNormalizeTaskTypes(options);
if (scope.partialOnly) {
if (!r.partial ||
!r.partialOriginForced ||
!r.explicitPartialId ||
!cbtForcedPartialIdentity(r.key, r.ref)) {
return false;
}
if (scope.partialIds && !scope.partialIds[String(r.key)]) {
return false;
}
return true;
}
if (r.partial || r.batchMs == null) return false;
// Normal Assign must never touch a cart/task Amazon marks UNASSIGNABLE.
// Partially Batched Only keeps its separate verified Force-Assign workflow.
if (r.unassignable || cbtAssignNormText(r.assignment || '').toUpperCase() === 'UNASSIGNABLE') return false;
var type = cbtAssignTaskType(r);
if (type === 'name' && cbtAssignVisibleRowLooksAccepted(r)) {
return false;
}
return cbtAssignTaskTypeAllowed(r, scope);
}
function cbtAssignEligibleRows(claimed, blocked, options) {
claimed = claimed || Object.create(null);
blocked = blocked || Object.create(null);
options = cbtAssignNormalizeTaskTypes(options);
var sourceRows = options.partialOnly
? cbtAssignReadPartialRows()
: cbtAssignReadRows();
var rows = sourceRows
.filter(function(r){
return !claimed[r.key] &&
!blocked[r.key] &&
!cbtAssignIsProtected(r.key) &&
cbtAssignRowCanBeTried(r, options);
});
return rows
.sort(function(a, b){
if (options.partialOnly) {
return a.rowOrder - b.rowOrder;
}
// For normal Assign, use blank available tasks first (no associate and no cart).
// This preserves optional Cart Only / Name + Cart support, but blank tasks win first.
var aBlank = cbtAssignTaskType(a) === 'blank' ? 0 : 1;
var bBlank = cbtAssignTaskType(b) === 'blank' ? 0 : 1;
if (aBlank !== bBlank) return aBlank - bBlank;
var aBatch = Number(a.batchMs);
var bBatch = Number(b.batchMs);
var hasA = Number.isFinite(aBatch);
var hasB = Number.isFinite(bBatch);
if (hasA && hasB && aBatch !== bBatch) return aBatch - bBatch;
if (hasA && !hasB) return -1;
if (!hasA && hasB) return 1;
return a.rowOrder - b.rowOrder;
});
}
function cbtAssignCurrentEligible(jobKey, options, ignoreReservationToken) {
options = cbtAssignNormalizeTaskTypes(options);
var rows = options.partialOnly
? cbtAssignReadPartialRows()
: cbtAssignReadRows();
for (var i = 0; i < rows.length; i++) {
var r = rows[i];
if (r.key !== String(jobKey)) continue;
return !cbtAssignIsProtected(r.key, ignoreReservationToken) &&
cbtAssignRowCanBeTried(r, options);
}
return false;
}
function cbtAssignHiddenUsable(el) {
if (!el || !el.isConnected) return false;
try {
if (el.disabled || el.readOnly) return false;
} catch(e) {}
return true;
}
function cbtAssignExtractAssociateDeep(obj, depth) {
if (obj == null || depth > 7) return null;
if (Array.isArray(obj)) {
for (var i = 0; i < obj.length && i < 500; i++) {
var a = cbtAssignExtractAssociateDeep(
obj[i],
depth + 1
);
if (a) return a;
}
return null;
}
if (typeof obj !== 'object') return null;
var preferred = [
'associateId',
'associateID',
'associate',
'assignedAssociate',
'assignedTo',
'assignee'
];
for (var p = 0; p < preferred.length; p++) {
var v = obj[preferred[p]];
if (typeof v !== 'string') continue;
var s = cbtAssignNormText(v);
if (s &&
!/^(ASSIGNABLE|UNASSIGNABLE|NONE)$/i.test(s)) {
return s;
}
}
for (var k in obj) {
var value = obj[k];
if (typeof value !== 'string') continue;
if (!/associate|assignee|assigned.*to/i.test(k)) continue;
var s2 = cbtAssignNormText(value);
if (s2 &&
!/^(ASSIGNABLE|UNASSIGNABLE|NONE)$/i.test(s2)) {
return s2;
}
}
for (var k2 in obj) {
var child = obj[k2];
if (!child || typeof child !== 'object') continue;
var r = cbtAssignExtractAssociateDeep(
child,
depth + 1
);
if (r) return r;
}
return null;
}
function cbtAssignOperationStateDeep(obj, depth) {
if (!obj || typeof obj !== 'object' || depth > 4) return null;
if (Array.isArray(obj)) {
for (var i = 0; i < obj.length && i < 80; i++) {
var ar = cbtAssignOperationStateDeep(obj[i], depth + 1);
if (ar) return ar;
}
return null;
}
var preferred = [
'operationState',
'jobState',
'taskState'
];
for (var p = 0; p < preferred.length; p++) {
var pv = obj[preferred[p]];
if (typeof pv === 'string' && pv.trim()) {
return pv.trim().toUpperCase();
}
}
if (depth <= 2 &&
typeof obj.state === 'string' &&
obj.state.trim()) {
return obj.state.trim().toUpperCase();
}
var keys;
try { keys = Object.keys(obj); } catch(e) { return null; }
for (var k = 0; k < keys.length; k++) {
var child = obj[keys[k]];
if (!child || typeof child !== 'object') continue;
var r = cbtAssignOperationStateDeep(child, depth + 1);
if (r) return r;
}
return null;
}
function cbtAssignStateLooksAccepted(state) {
state = String(state || '').toUpperCase();
return (
state === 'BATCHING' ||
state === 'IN_PROGRESS' ||
state === 'ACCEPTED' ||
state === 'STARTED' ||
state === 'COMPLETED' ||
state === 'COMPLETE' ||
state === 'DONE'
);
}
function cbtAssignBackendPreflight(jobId, options) {
options = options || {};
return afaFetchJobInfo(jobId).then(function(info){
if (!info) {
return {
ok: true,
verified: false,
state: null,
reason: 'backend state unavailable — assignment API will decide'
};
}
var state = cbtAssignOperationStateDeep(info, 0);
var allowExplicitReassign =
!!options.allowPartialReassign;
var assignability = null;
try { assignability = afaAssignabilityDeep(info, 0); } catch(eAssignability) {}
if (assignability === 'UNASSIGNABLE' && !allowExplicitReassign) {
return {
ok: false,
retryable: true,
skipped: true,
unassignable: true,
state: state || null,
reason: 'task is UNASSIGNABLE — skipped before assignment request'
};
}
if (cbtAssignStateLooksAccepted(state) && !allowExplicitReassign) {
return {
ok: false,
retryable: true,
accepted: true,
state: state,
reason: 'task already active/accepted' + (state ? ' — ' + state : '')
};
}
return {
ok: true,
verified: true,
state: state || null,
reassignAttempt: !!(
allowExplicitReassign &&
cbtAssignStateLooksAccepted(state)
)
};
});
}
function cbtAssignFreshPreflight(jobId, guardFn, options) {
options = options || {};
var localProtected = cbtAssignProtection(jobId);
if (localProtected && (!options.sharedReservationToken || localProtected.token !== options.sharedReservationToken)) {
return Promise.resolve({ok:false,retryable:true,protected:true,reason:'recently assigned'+(localProtected.associate?' to '+localProtected.associate:'')+' — protected for '+cbtAssignProtectionSeconds(jobId,localProtected)+'s more'});
}
return cbtAssignSharedProtectionCheck(jobId, options.sharedReservationToken || '').then(function(sharedProtected){
if (sharedProtected) return {ok:false,retryable:true,protected:true,reason:'recently assigned'+(sharedProtected.associate?' to '+sharedProtected.associate:'')+' — protected for '+cbtAssignProtectionSeconds(jobId,sharedProtected)+'s more'};
if (guardFn && !guardFn()) return {ok:false,retryable:true,reason:'task changed before assignment'};
return cbtAssignBackendPreflight(jobId, options).then(function(check){
if(!check||!check.ok)return check||{ok:false,retryable:true,reason:'backend pre-check failed'};
if(guardFn){try{if(!guardFn())return{ok:false,retryable:true,reason:'task changed during backend pre-check'};}catch(eGuard){return{ok:false,retryable:true,reason:'task changed during backend pre-check'};}}
return check;
});
});
}
function cbtAssignVerifyAssociate(jobId, login) {
var tries = 0;
login = String(login || '').toLowerCase();
function once() {
tries++;
return afaFetchJobInfo(jobId).then(function(info){
var got = info
? cbtAssignExtractAssociateDeep(info, 0)
: null;
if (got &&
String(got).toLowerCase() === login) {
return true;
}
if (tries >= 4) {
return got ? false : null;
}
return new Promise(function(resolve){
setTimeout(function(){
resolve(once());
}, 280);
});
});
}
return once();
}
function cbtAssignDirectResponseOk(r) {
if (!r || !r.ok) return false;
var body = String(
r.body == null ? '' : r.body
).trim().replace(/^"|"$/g, '');
return /^true$/i.test(body);
}
function cbtAssignDirectSubmit(jobId, associate) {
var url =
COMO_BASE +
'/api/store/' +
encodeURIComponent(STORE_ID) +
'/job/' +
encodeURIComponent(jobId) +
'/assignToAssociate';
var ctrl =
(typeof AbortController === 'function')
? new AbortController()
: null;
var timer = setTimeout(function(){
if (ctrl) ctrl.abort();
}, AFA_TIMEOUT_MS);
var opts = {
method: 'POST',
credentials: 'include',
headers: {
'Content-Type': 'application/json',
'Accept': 'application/json'
},
body: JSON.stringify({
associateId: String(associate || '')
})
};
if (ctrl) opts.signal = ctrl.signal;
return _origFetch(url, opts).then(
function(res){
clearTimeout(timer);
return res.text().then(
function(t){
return {
ok: res.ok,
status: res.status,
body: t
};
},
function(){
return {
ok: res.ok,
status: res.status,
body: ''
};
}
);
},
function(err){
clearTimeout(timer);
return {
ok: false,
status: 0,
body:
(err && err.message)
? String(err.message)
: 'network error'
};
}
);
}
function cbtAssignViaUi(jobId, associate, guardFn, detailsUrl, assignOptions) {
associate = cbtAssignNormText(associate);
if (!jobId || !associate) {
return Promise.resolve({
ok: false,
retryable: false,
reason: 'missing task/associate'
});
}
assignOptions = assignOptions || {};
if (assignOptions.requirePartialOnly) {
var partialIds = assignOptions.partialIds || null;
var idKey = String(jobId || '');
if (!partialIds || !partialIds[idKey]) {
return Promise.resolve({
ok: false,
retryable: false,
skipped: true,
reason: 'blocked: job is not in the frozen Partially Batched whitelist'
});
}
if (!guardFn || !guardFn()) {
return Promise.resolve({
ok: false,
retryable: true,
skipped: true,
reason: 'blocked: forced-partial job is no longer eligible for this run'
});
}
if (!assignOptions.partialRef ||
!cbtForcedPartialIdentity(
jobId,
assignOptions.partialRef
)) {
return Promise.resolve({
ok: false,
retryable: true,
skipped: true,
reason: 'blocked: job was not remembered as a successfully Force Assigned partial cart'
});
}
}
return cbtAssignAcquireSharedReservation(jobId, associate, 0, assignOptions.targetRef || '').then(function(lock){
if (!lock || !lock.ok) {
if (lock && (lock.error || lock.fatal)) {
return {
ok:false,
retryable:false,
fatal:true,
reason:lock.reason || 'Shared cart lock is unavailable. Assignment was not started to prevent a cross-computer conflict.'
};
}
var lr = lock && lock.row;
return {
ok:false, retryable:true, protected:true,
reason:(lock && lock.reason) || ('recently assigned' + (lr && lr.associate ? ' to ' + lr.associate : '') +
(lr ? ' — protected for ' + Math.max(1, Math.ceil((Number(lr.until)-cbtAssignNowMs())/1000)) + 's more' : ''))
};
}
var reservationToken = lock.token || '';
function releaseReservation() {
if (reservationToken) cbtAssignReleaseSharedReservation(jobId, reservationToken);
}
function markSuccess(status, verified) {
cbtAssignProtect(jobId, associate, assignOptions.targetRef || '');
return {
ok: true,
attempted: true,
verified: verified !== false,
protectedMs: CBT_ASSIGN_PROTECT_MS,
status: status
};
}
function verifyAmbiguous(status, body, label) {
return cbtAssignVerifyAssociate(jobId, associate).then(function(verified){
if (verified === true) return markSuccess(status, true);
releaseReservation();
if (verified === false) {
return {
ok:false,
attempted:true,
retryable:true,
reason:(label || 'Assignment could not be confirmed') +
(status ? ' — HTTP ' + status : '') +
(body ? ' — ' + body.slice(0,120) : '')
};
}
return {
ok:false,
attempted:true,
retryable:false,
stopAssociate:true,
reason:(label || 'Assignment response was ambiguous') +
'. The script stopped trying this associate to avoid a duplicate assignment' +
(status ? ' — HTTP ' + status : '') +
(body ? ' — ' + body.slice(0,120) : '')
};
});
}
var preflightOptions = Object.assign({}, assignOptions, { sharedReservationToken: reservationToken });
var reservedGuardFn = guardFn
? function(){ return guardFn(reservationToken); }
: null;
return cbtAssignFreshPreflight(
jobId,
reservedGuardFn,
preflightOptions
).then(function(preflight){
if (!preflight || !preflight.ok) {
releaseReservation();
return preflight || { ok:false, retryable:false, reason:'pre-check failed' };
}
if (reservedGuardFn) {
try {
if (!reservedGuardFn()) {
releaseReservation();
return {
ok: false,
retryable: true,
reason: 'task changed before direct assignment'
};
}
} catch(eGuard) {
releaseReservation();
return {
ok: false,
retryable: true,
reason: 'task changed before direct assignment'
};
}
}
return cbtAssignDirectSubmit(
jobId,
associate
).then(function(r){
if (cbtAssignDirectResponseOk(r)) {
return markSuccess(r.status, true);
}
var status = Number(r && r.status) || 0;
var body = cbtAssignNormText(
r && r.body != null ? r.body : ''
);
var plainBody = body.replace(/^"|"$/g, '').trim();
if (status === 401 || status === 403) {
releaseReservation();
return {
ok: false,
attempted: true,
retryable: false,
fatal: true,
reason:
'Assign request denied — HTTP ' +
status +
(body ? ' — ' + body.slice(0, 120) : '')
};
}
if (r && r.ok) {
if (/^false$/i.test(plainBody)) {
releaseReservation();
return {
ok:false,
attempted:true,
retryable:true,
reason:'Assignment rejected by the API' +
(status ? ' — HTTP ' + status : '')
};
}
return verifyAmbiguous(status, body, 'Successful HTTP response did not explicitly confirm the assignment');
}
if (!status || status >= 500) {
return verifyAmbiguous(status, body, status ? ('Server error response') : 'No direct assignment response');
}
releaseReservation();
return {
ok: false,
attempted: true,
retryable: true,
reason:
'Assignment rejected' +
(status ? ' — HTTP ' + status : '') +
(body ? ' — ' + body.slice(0, 120) : '')
};
});
});
});
}
function cbtAssignNoEligibleMessage(taskTypes) {
if (taskTypes && taskTypes.partialOnly) {
var pending = [];
try {
pending = cbtLoadForcedPartialPending() || [];
} catch(e0) {
pending = [];
}
if (!pending.length) {
return (
'Not Assigned. Reason: No Forced Partial Cart Is Available. ' +
'Use Force Assign On A Partially Batched Cart First, Then Try Again.'
);
}
return (
'Not Assigned. Reason: No Eligible Forced Partial Cart Is Available. ' +
'It May Already Be Assigned, Rejected By Amazon, Or No Longer Ready.'
);
}
var state = cbtAssignSiteTaskState();
if (!state.ready) {
return (
'Not Assigned. Reason: The Tasks Page Is Still Loading. ' +
'Wait A Moment For The Page To Finish Loading, Then Try Again.'
);
}
if (!state.hasTasks) {
return (
'Not Assigned. Reason: No Task Cart Is Available Right Now.'
);
}
return (
'Not Assigned. Reason: No Eligible Cart Is Available For The Selected ' +
'Assign Options. The Available Carts May Already Be Active, Assigned, ' +
'Or Temporarily Protected.'
);
}
function cbtAssignProgressView() {
afaShell(
'Assign Running',
'<div id="cbt-afa-lead">' +
'<span id="cbt-assign-count">' +
'Starting…' +
'</span>' +
'</div>' +
'<div id="cbt-afa-bar">' +
'<div id="cbt-afa-fill"></div>' +
'</div>' +
'<div id="cbt-afa-live"></div>',
'<button class="cbt-afa-act stop" ' +
'data-afa="assign-stop">' +
'⏹ Stop' +
'</button>'
);
var card =
_afaOverlay &&
_afaOverlay.querySelector('#cbt-afa-card');
if (!card) return;
card.addEventListener('click', function(e){
var b = e.target.closest('[data-afa]');
if (!b ||
b.getAttribute('data-afa') !== 'assign-stop') {
return;
}
_afaStop = true;
b.textContent = '⏹ Stopping…';
b.disabled = true;
});
}
function cbtAssignProgress(
done,
total,
associate,
target,
results
) {
var c = document.getElementById(
'cbt-assign-count'
);
if (c) {
c.innerHTML =
'Assigning <b>' +
Math.min(done, total) +
'</b> of <b>' +
total +
'</b>' +
(associate
? ': ' + afaEsc(associate)
: '') +
(target
? ' → task ' +
afaEsc(target.ref) +
' (' +
afaEsc(
target.batchRaw || 'earliest'
) +
')'
: '');
}
var fill = document.getElementById(
'cbt-afa-fill'
);
if (fill) {
fill.style.width =
Math.round(
(
Math.max(0, done - 1) /
Math.max(1, total)
) * 100
) + '%';
}
var live = document.getElementById(
'cbt-afa-live'
);
if (live && results.length) {
live.innerHTML =
afaRowsHtml(results.slice(-8));
}
}
function cbtAssignSummary(results, stopped) {
var okN = results.filter(function(r){
return r.ok === true;
}).length;
var skipN = results.filter(function(r){
return r.skip;
}).length;
var badN = results.filter(function(r){
return r.ok === false && !r.skip;
}).length;
afaShell(
'Assign Finished',
'<div id="cbt-afa-lead">' +
(stopped ? 'Stopped early. ' : '') +
'<b>' + okN + '</b> assigned' +
(skipN
? ', <b>' + skipN + '</b> skipped'
: '') +
(badN
? ', <b>' + badN + '</b> failed'
: '') +
'.</div>' +
(
results.length
? afaRowsHtml(results)
: '<div style="color:var(--cb-text2)">' +
'Nothing was processed.' +
'</div>'
),
'<button class="cbt-afa-act" ' +
'data-afa="assign-summary-back">' +
'Back' +
'</button>' +
'<button class="cbt-afa-act go" ' +
'data-afa="assign-summary-done">' +
'Done' +
'</button>'
);
var card =
_afaOverlay &&
_afaOverlay.querySelector('#cbt-afa-card');
if (!card) return;
card.addEventListener('click', function(e){
var b = e.target.closest('[data-afa]');
if (!b) return;
var action = b.getAttribute('data-afa');
if (action === 'assign-summary-done') {
afaClose();
return;
}
if (action === 'assign-summary-back') {
cbtAssignOpenPickerWithGlobalLock();
}
});
}
// v23.9.176 audit: each associate gets its own 5-cart failure set; shared locks fail closed.
var CBT_ASSIGN_MAX_ATTEMPTS_PER_ASSOCIATE = 5;
function cbtAssignRun(names, taskTypes) {
names = Array.isArray(names)
? names.map(cbtAssignNormText).filter(Boolean)
: [];
taskTypes = cbtAssignNormalizeTaskTypes(taskTypes);
if (!names.length || _afaRunning) return;
if (syncEnabled() && !cbtAssignUiSessionOwned()) {
try { cbtAssignRenderGlobalSessionState(); } catch(eNoGlobalTurn) {}
return;
}
if (taskTypes.partialOnly) {
var forcedPartialRows = cbtAssignReadPartialRows();
var forcedPartialIds = Object.create(null);
for (var spi = 0; spi < forcedPartialRows.length; spi++) {
var forcedRow = forcedPartialRows[spi];
if (!forcedRow ||
!forcedRow.partialOriginForced ||
!forcedRow.explicitPartialId ||
!forcedRow.key ||
!cbtForcedPartialIdentity(
forcedRow.key,
forcedRow.ref
)) {
continue;
}
forcedPartialIds[String(forcedRow.key)] = true;
}
if (!Object.keys(forcedPartialIds).length) {
afaConfirm();
return;
}
taskTypes.partialIds = forcedPartialIds;
} else if (!cbtAssignHasSiteTasks()) {
afaConfirm();
return;
}
_afaRunning = true;
_afaStop = false;
try { cbtAssignStartUiSessionRunHeartbeat(); } catch(eAssignTurnHeartbeat) {}
afaSetBtn('⏹ Stop', true);
var results = [];
var claimed = Object.create(null);
var nameIndex = 0;
var currentAssociateReservationName = '';
var currentAssociateReservationToken = '';
function releaseCurrentAssociateReservation() {
var name = currentAssociateReservationName;
var token = currentAssociateReservationToken;
currentAssociateReservationName = '';
currentAssociateReservationToken = '';
if (name && token) {
try { cbtAssignReleaseAssociateReservation(name, token); } catch(eReleaseAssociate) {}
}
}
cbtAssignProgressView();
var assignNextTimer = 0;
var assignNextResume = null;
function resumeAssignPending() {
if (!assignNextResume) return;
var fn = assignNextResume;
assignNextResume = null;
if (assignNextTimer) {
clearTimeout(assignNextTimer);
assignNextTimer = 0;
}
fn();
}
function scheduleAssignStep(fn, delay) {
assignNextResume = fn;
if (document.hidden) {
Promise.resolve().then(resumeAssignPending);
return;
}
assignNextTimer = setTimeout(
resumeAssignPending,
delay == null ? 5 : Math.max(0, delay)
);
}
function onAssignVisibilityChange() {
if (!document.hidden || !assignNextResume) return;
if (assignNextTimer) {
clearTimeout(assignNextTimer);
assignNextTimer = 0;
}
Promise.resolve().then(resumeAssignPending);
}
document.addEventListener('visibilitychange', onAssignVisibilityChange);
function finish() {
releaseCurrentAssociateReservation();
_afaRunning = false;
try { cbtAssignReleaseUiSessionLock(); } catch(eAssignTurnRelease) {}
try {
document.removeEventListener(
'visibilitychange',
onAssignVisibilityChange
);
} catch(eVis) {}
if (assignNextTimer) {
clearTimeout(assignNextTimer);
assignNextTimer = 0;
}
assignNextResume = null;
afaSetBtn('▶ Run', false);
try {
pollActiveTasks();
} catch(eLive) {}
try {
fetchAndUpdate();
} catch(eStats) {}
try {
afaRefreshJobData();
} catch(eJobs) {}
cbtAssignSummary(
results,
_afaStop
);
}
function nextName(delay) {
releaseCurrentAssociateReservation();
nameIndex++;
scheduleAssignStep(
stepName,
delay == null ? 5 : delay
);
}
function stepName() {
if (_afaStop ||
nameIndex >= names.length) {
finish();
return;
}
var associate = names[nameIndex];
var blocked = Object.create(null);
var associateCooldown = cbtAssignAssociateProtection(associate);
if (associateCooldown) {
var associateCooldownSec = cbtAssignAssociateCooldownSeconds(associate, associateCooldown);
results.push({
ref: associate,
skip: true,
ok: false,
msg: 'Not Assigned. Associate Cooldown Active — ' + associateCooldownSec + 's Remaining.'
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
null,
results
);
nextName(5);
return;
}
var attemptedForAssociate = 0;
function ensureAssociateReservation() {
if (currentAssociateReservationToken &&
cbtAssignNormText(currentAssociateReservationName).toLowerCase() === cbtAssignNormText(associate).toLowerCase()) {
return Promise.resolve({ok:true,token:currentAssociateReservationToken,reused:true});
}
return cbtAssignAcquireAssociateReservation(associate).then(function(lock){
if (lock && lock.ok) {
currentAssociateReservationName = associate;
currentAssociateReservationToken = lock.token || '';
}
return lock;
});
}
function tryEarliest() {
if (_afaStop) {
finish();
return;
}
if (syncEnabled() && !cbtAssignUiSessionOwned()) {
results.push({
ref: associate,
skip: true,
ok: false,
msg: 'Not Assigned. The Shared Assign Turn Was Lost. The Run Was Stopped To Prevent A Cross-Computer Conflict.'
});
cbtAssignProgress(nameIndex + 1, names.length, associate, null, results);
finish();
return;
}
if (!taskTypes.partialOnly) {
var siteState = cbtAssignSiteTaskState();
if (!siteState.ready) {
results.push({
ref: associate,
skip: true,
ok: false,
msg: cbtAssignNoEligibleMessage(taskTypes)
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
null,
results
);
nextName(5);
return;
}
}
var eligible =
cbtAssignEligibleRows(
claimed,
blocked,
taskTypes
);
if (!eligible.length) {
results.push({
ref: associate,
skip: true,
ok: false,
msg: cbtAssignNoEligibleMessage(taskTypes)
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
null,
results
);
nextName(5);
return;
}
var target = eligible[0];
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
target,
results
);
function targetStillEligible(ignoreReservationToken) {
return !claimed[target.key] &&
!blocked[target.key] &&
cbtAssignCurrentEligible(
target.key,
taskTypes,
ignoreReservationToken || ''
);
}
if (!targetStillEligible()) {
blocked[target.key] = true;
scheduleAssignStep(tryEarliest, 5);
return;
}
var targetType = cbtAssignTaskType(target);
var allowPartialReassign =
!!taskTypes.partialOnly &&
targetType === 'partial' &&
!!target.partialOriginForced &&
!!target.explicitPartialId &&
cbtForcedPartialIdentity(
target.key,
target.ref
) &&
!!(
taskTypes.partialIds &&
taskTypes.partialIds[String(target.key)]
);
if (taskTypes.partialOnly && !allowPartialReassign) {
blocked[target.key] = true;
results.push({
ref: associate,
id: target.id,
skip: true,
ok: false,
msg: 'Not Assigned. Reason: The Cart Could Not Be Verified As A Partially Batched Cart.'
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
null,
results
);
scheduleAssignStep(tryEarliest, 5);
return;
}
ensureAssociateReservation().then(function(associateLock){
if (!associateLock || !associateLock.ok) {
if (associateLock && (associateLock.error || associateLock.fatal)) {
results.push({
ref: associate,
skip: true,
ok: false,
msg: 'Not Assigned. ' + (associateLock.reason || 'Shared Associate Lock Is Unavailable.')
});
cbtAssignProgress(nameIndex + 1, names.length, associate, null, results);
finish();
return;
}
var associateLockRow = associateLock && associateLock.row;
var associateLockSec = associateLockRow
? Math.max(1, Math.ceil((Number(associateLockRow.until) - cbtAssignNowMs()) / 1000))
: cbtAssignAssociateCooldownSeconds(associate);
results.push({
ref: associate,
skip: true,
ok: false,
msg: 'Not Assigned. Associate Cooldown Active' +
(associateLockSec ? ' — ' + associateLockSec + 's Remaining.' : '.')
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
null,
results
);
nextName(5);
return;
}
cbtAssignViaUi(
target.id,
associate,
targetStillEligible,
target.detailsUrl,
{
allowPartialReassign: allowPartialReassign,
requirePartialOnly: !!taskTypes.partialOnly,
partialIds: taskTypes.partialIds,
partialRef: taskTypes.partialOnly ? target.ref : '',
targetRef: target.ref
}
).then(function(result){
if (_afaStop) {
if (result && result.ok) {
try { cbtAssignProtectAssociate(associate); } catch(eAssociateStopProtect) {}
currentAssociateReservationName = '';
currentAssociateReservationToken = '';
}
finish();
return;
}
if (result && result.ok) {
try { cbtAssignProtectAssociate(associate); } catch(eAssociateProtect) {}
currentAssociateReservationName = '';
currentAssociateReservationToken = '';
claimed[target.key] = true;
if (taskTypes.partialOnly) {
cbtForgetForcedPartial(target.key);
}
try {
cbtAssignUpdateProtectionMeta(
target.key,
associate,
target.ref
);
cbtAssignRenderProtectionCountdown();
} catch(eProtectMeta) {}
results.push({
ref: associate,
id: target.id,
ok: true,
msg:
'Assigned To Task ' +
target.ref +
(taskTypes.partialOnly
? '. Source: Partially Batched Only'
: '. Batch Target: ' +
(
target.batchRaw ||
'Earliest'
)) +
'. Protected For 1 Minute.'
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
target,
results
);
nextName(5);
return;
}
if (result && result.fatal) {
results.push({
ref: associate,
id: target.id,
ok: false,
msg: 'Not Assigned. ' + (result.reason || 'A Fatal Assignment Error Occurred. The Run Was Stopped To Prevent A Conflict.')
});
cbtAssignProgress(nameIndex + 1, names.length, associate, target, results);
finish();
return;
}
if (result && result.stopAssociate) {
attemptedForAssociate += result.attempted ? 1 : 0;
blocked[target.key] = true;
results.push({
ref: associate,
id: target.id,
ok: false,
msg: 'Not Assigned. ' + (result.reason || 'The Assignment Could Not Be Safely Confirmed.') + ' Skipping This Associate To Prevent A Duplicate Assignment.'
});
cbtAssignProgress(nameIndex + 1, names.length, associate, target, results);
nextName(5);
return;
}
if (result && result.attempted) {
attemptedForAssociate++;
blocked[target.key] = true;
var reachedAttemptLimit = attemptedForAssociate >= CBT_ASSIGN_MAX_ATTEMPTS_PER_ASSOCIATE;
results.push({
ref: associate,
id: target.id,
ok: false,
msg:
'Not Assigned. Attempt ' + attemptedForAssociate + ' Of ' +
CBT_ASSIGN_MAX_ATTEMPTS_PER_ASSOCIATE + ' Failed' +
(
result.reason
? '. Details: ' + result.reason
: '.'
) +
(reachedAttemptLimit
? ' Skipping This Associate And Trying The Next Associate.'
: ' Trying The Next Eligible Cart For This Associate.')
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
target,
results
);
if (reachedAttemptLimit) {
nextName(5);
} else {
scheduleAssignStep(tryEarliest, 5);
}
return;
}
if (result && result.retryable) {
blocked[target.key] = true;
scheduleAssignStep(tryEarliest, 5);
return;
}
results.push({
ref: associate,
ok: false,
msg:
'Not Assigned. Reason: The Assignment Could Not Be Safely Started' +
(
result && result.reason
? '. Details: ' + result.reason
: '.'
)
});
cbtAssignProgress(
nameIndex + 1,
names.length,
associate,
target,
results
);
nextName(5);
});
});
}
tryEarliest();
}
stepName();
}
function afaSetBtn(text, busy) {
var b = document.getElementById('cbt-afa-btn');
if (!b) return;
b.innerHTML = '<span class="cbt-afa-lbl">' + text + '</span>';
if (busy) b.classList.add('busy'); else b.classList.remove('busy');
}
function afaClose() {
if (_afaRunning) return;
try { cbtAssignReleaseUiSessionLock(); } catch(eAssignUiCloseRelease) {}
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
function afaConfirm() {
if (_afaRunning) { afaProgressView(); return; }
try { cbtAssignReleaseUiSessionLock(); } catch(eAssignUiRelease) {}
var pbNow = afaScanPartiallyBatched();
var expected = afaSectionCount(/^Partially\s+Batched(\s*\(\d+\))?$/i);
afaConfirmRender(afaScanDashboard(), pbNow, expected);
}
var CBT_ASSIGN_SUGGEST_MAX = 10;
var CBT_ASSIGN_RECENT_KEEP = 30;
function cbtAssignRecentKey() {
return 'cbt_assign_recent_v1_' + String(STORE_ID || 'unknown')
.replace(/[^A-Za-z0-9_.-]/g, '_');
}
function cbtAssignLoadRecentNames() {
try {
var raw = localStorage.getItem(cbtAssignRecentKey());
if (!raw) return [];
var rows = JSON.parse(raw);
if (!Array.isArray(rows)) return [];
return rows
.filter(function(r){
return r && r.name && typeof r.name === 'string';
})
.sort(function(a, b){
var atDiff = (Number(b.lastAt) || 0) - (Number(a.lastAt) || 0);
if (atDiff) return atDiff;
return (Number(b.count) || 0) - (Number(a.count) || 0);
});
} catch(e) {
return [];
}
}
function cbtAssignRememberRecentNames(names) {
if (!Array.isArray(names) || !names.length) return;
try {
var rows = cbtAssignLoadRecentNames();
var byName = Object.create(null);
rows.forEach(function(r){
byName[String(r.name).toLowerCase()] = {
name: String(r.name),
count: Math.max(1, Number(r.count) || 1),
lastAt: Number(r.lastAt) || 0
};
});
var nowMs = Date.now();
names.forEach(function(name, idx){
name = String(name || '').trim();
if (!name) return;
var key = name.toLowerCase();
var old = byName[key] || { name: name, count: 0, lastAt: 0 };
old.name = name;
old.count = (Number(old.count) || 0) + 1;
old.lastAt = nowMs - idx;
byName[key] = old;
});
var merged = Object.keys(byName).map(function(k){ return byName[k]; });
merged.sort(function(a, b){
var atDiff = (Number(b.lastAt) || 0) - (Number(a.lastAt) || 0);
if (atDiff) return atDiff;
return (Number(b.count) || 0) - (Number(a.count) || 0);
});
localStorage.setItem(
cbtAssignRecentKey(),
JSON.stringify(merged.slice(0, CBT_ASSIGN_RECENT_KEEP))
);
} catch(e) {}
}
function cbtAssignSuggestedNames() {
var rows = cbtAssignLoadRecentNames();
var out = [];
var seen = Object.create(null);
for (var i = 0; i < rows.length && out.length < CBT_ASSIGN_SUGGEST_MAX; i++) {
var name = String(rows[i].name || '').trim();
if (!name) continue;
var key = name.toLowerCase();
if (seen[key]) continue;
seen[key] = true;
out.push(name);
}
return out;
}
function afaAssignPicker() {
var selectedNames = [];
var activeIndex = -1;
var currentRows = [];
var showingSuggestions = true;
afaShell(
'Assign',
'<div id="cbt-afa-lead">Search and select one or more associates.</div>' +
'<div id="cbt-afa-assign-turn" class="cbt-afa-note">Your Assign Turn · 15s remaining</div>' +
'<div id="cbt-afa-assign-types">' +
'<div class="cbt-afa-assign-type-title">Assign Source</div>' +
'<label class="cbt-afa-opt">' +
'<input id="cbt-afa-type-partial" type="checkbox">' +
'<span><b>Only Assign Partially Batched Carts</b></span>' +
'</label>' +
'<div id="cbt-afa-normal-task-types">' +
'<div class="cbt-afa-assign-type-title" style="margin-top:8px;">Normal Tasks · Optional</div>' +
'<label class="cbt-afa-opt">' +
'<input id="cbt-afa-type-cart" type="checkbox">' +
'<span><b>Task With Cart Number Only</b></span>' +
'</label>' +
'<label class="cbt-afa-opt">' +
'<input id="cbt-afa-type-both" type="checkbox">' +
'<span><b>Task With Associate Name + Cart Number</b></span>' +
'</label>' +
'</div>' +
'</div>' +
'<input id="cbt-afa-assign-search" type="text" autocomplete="off" spellcheck="false" ' +
'placeholder="Search associate name..." aria-label="Search associate name">' +
'<div id="cbt-afa-assign-results">' +
'<div class="cbt-afa-assign-empty">Loading recent suggestions...</div>' +
'</div>' +
'<div id="cbt-afa-assign-selected"><div class="cbt-afa-selected-title">' +
'<span>Selected associates</span>' +
'<button id="cbt-afa-assign-clear" type="button" disabled>Clear</button>' +
'</div>' +
'<div class="cbt-afa-assign-empty">None selected.</div></div>' +
'<div class="cbt-afa-note" id="cbt-afa-assign-mode-note">Normal Mode: Blank ASSIGNABLE tasks are tried first, earliest Batch Target first. UNASSIGNABLE tasks are always skipped. Time Left and overdue status do not block assignment. Each selected associate gets up to 5 real assignment attempts before the script moves to the next associate. An associate with an active 1-minute cooldown is skipped. A recently assigned cart is protected for 1 minute.</div>',
'<button class="cbt-afa-act" data-afa="assign-back">Back</button>' +
'<button class="cbt-afa-act primary" data-afa="assign-start" disabled>Assign</button>'
);
var card = _afaOverlay && _afaOverlay.querySelector('#cbt-afa-card');
var input = document.getElementById('cbt-afa-assign-search');
var results = document.getElementById('cbt-afa-assign-results');
var selected = document.getElementById('cbt-afa-assign-selected');
var typePartial = document.getElementById('cbt-afa-type-partial');
var normalTypes = document.getElementById('cbt-afa-normal-task-types');
var modeNote = document.getElementById('cbt-afa-assign-mode-note');
var typeCart = document.getElementById('cbt-afa-type-cart');
var typeBoth = document.getElementById('cbt-afa-type-both');
if (!card ||
!input ||
!results ||
!selected ||
!typePartial ||
!normalTypes ||
!modeNote ||
!typeCart ||
!typeBoth) return;
function esc(v) {
return afaEsc(v);
}
function selectedIndex(name) {
var low = String(name || '').toLowerCase();
for (var i = 0; i < selectedNames.length; i++) {
if (selectedNames[i].toLowerCase() === low) return i;
}
return -1;
}
function updateAssignStartState() {
var startBtn = card.querySelector('[data-afa="assign-start"]');
if (!startBtn) return;
if (syncEnabled() && !cbtAssignUiSessionOwned()) {
startBtn.disabled = true;
return;
}
if (typePartial.checked) {
startBtn.disabled =
selectedNames.length === 0 ||
!cbtAssignPartialCheckboxAvailable();
return;
}
startBtn.disabled =
selectedNames.length === 0 ||
!cbtAssignHasSiteTasks();
}
function syncPartialOnlyMode() {
var partialOnly = !!typePartial.checked;
typeCart.disabled = partialOnly;
typeBoth.disabled = partialOnly;
normalTypes.style.opacity = partialOnly ? '0.45' : '1';
modeNote.textContent = partialOnly
? 'Partially Batched Only. Select an associate and press Assign normally. The button stays available. The run can use only exact carts remembered from Partially Batched Force Assign. If none are available, nothing is assigned. Normal Tasks are never used as a fallback.'
: 'Normal Mode: Blank ASSIGNABLE tasks are tried first, earliest Batch Target first. UNASSIGNABLE tasks are always skipped. Time Left is ignored. Cart Only and Name + Cart remain optional. Each selected associate gets up to 5 real assignment attempts before moving to the next associate. An associate with an active 1-minute cooldown is skipped. A cart assigned by this script is protected for 1 minute.';
updateAssignStartState();
}
function renderSelected() {
updateAssignStartState();
if (!selectedNames.length) {
selected.innerHTML =
'<div class="cbt-afa-selected-title">' +
'<span>Selected associates</span>' +
'<button id="cbt-afa-assign-clear" type="button" disabled>Clear</button>' +
'</div>' +
'<div class="cbt-afa-assign-empty">None selected.</div>';
return;
}
selected.innerHTML =
'<div class="cbt-afa-selected-title">' +
'<span>Selected associates (' + selectedNames.length + ')</span>' +
'<button id="cbt-afa-assign-clear" type="button">Clear</button>' +
'</div>' +
selectedNames.map(function(name, i){
return '<div class="cbt-afa-selected-row" data-selected-name="' + esc(name) + '" ' +
'title="Click to remove ' + esc(name) + '">' +
'<span class="cbt-afa-selected-num">' + (i + 1) + '</span>' +
'<span class="cbt-afa-selected-name">' + esc(name) + '</span>' +
'</div>';
}).join('');
}
function renderResults() {
if (!currentRows.length) {
results.innerHTML = showingSuggestions
? '<div class="cbt-afa-assign-empty">No recent suggestions yet. Type at least ' +
AC_MIN_CHARS + ' characters to search.</div>'
: '<div class="cbt-afa-assign-empty">No matches found.</div>';
return;
}
var heading = showingSuggestions
? '<div class="cbt-search-result-section">RECENTLY USED AT THIS WAREHOUSE</div>'
: '';
results.innerHTML = heading + currentRows.map(function(name, i){
var order = selectedIndex(name);
var checked = order >= 0;
return '<div class="cbt-afa-assign-name' +
(i === activeIndex ? ' on' : '') +
(checked ? ' selected' : '') +
'" data-name="' + esc(name) + '">' +
'<input class="cbt-afa-assign-check" type="checkbox" tabindex="-1"' + (checked ? ' checked' : '') + '>' +
'<span>' + esc(name) + '</span>' +
'<span class="cbt-afa-assign-order' + (checked ? '' : ' hidden') + '">' +
(checked ? (order + 1) : '') +
'</span>' +
'</div>';
}).join('');
}
function updateActive() {
var nodes = results.querySelectorAll('.cbt-afa-assign-name');
for (var i = 0; i < nodes.length; i++) {
nodes[i].classList.toggle('on', i === activeIndex);
}
if (activeIndex >= 0 && nodes[activeIndex] && nodes[activeIndex].scrollIntoView) {
nodes[activeIndex].scrollIntoView({ block: 'nearest' });
}
}
function toggleName(name) {
if (!name) return;
var idx = selectedIndex(name);
if (idx >= 0) {
selectedNames.splice(idx, 1);
renderSelected();
renderResults();
} else {
selectedNames.push(name);
renderSelected();
input.value = '';
renderResults();
}
try { input.focus(); } catch(e) {}
}
function search(term) {
term = String(term || '').trim();
if (term.length < AC_MIN_CHARS) {
showingSuggestions = true;
currentRows = cbtAssignSuggestedNames();
activeIndex = currentRows.length ? 0 : -1;
renderResults();
return;
}
showingSuggestions = false;
var res = acSearch(term);
currentRows = (res && res.rows) ? res.rows.slice() : [];
activeIndex = currentRows.length ? 0 : -1;
renderResults();
}
typePartial.addEventListener('change', function(){
syncPartialOnlyMode();
});
input.addEventListener('input', function(){
search(input.value);
});
input.addEventListener('keydown', function(e){
if (!currentRows.length) return;
if (e.key === 'ArrowDown') {
e.preventDefault();
activeIndex = (activeIndex + 1 + currentRows.length) % currentRows.length;
updateActive();
} else if (e.key === 'ArrowUp') {
e.preventDefault();
activeIndex = (activeIndex - 1 + currentRows.length) % currentRows.length;
updateActive();
} else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
e.preventDefault();
toggleName(currentRows[activeIndex]);
}
});
results.addEventListener('mousedown', function(e){
var row = e.target.closest('.cbt-afa-assign-name');
if (!row) return;
e.preventDefault();
toggleName(row.getAttribute('data-name'));
});
selected.addEventListener('click', function(e){
var clearBtn = e.target.closest('#cbt-afa-assign-clear');
if (clearBtn) {
if (!selectedNames.length) return;
selectedNames.length = 0;
renderSelected();
renderResults();
try { input.focus(); } catch(ignoreClearFocus) {}
return;
}
var row = e.target.closest('.cbt-afa-selected-row');
if (!row) return;
var name = row.getAttribute('data-selected-name');
if (!name) return;
var idx = selectedIndex(name);
if (idx >= 0) selectedNames.splice(idx, 1);
renderSelected();
renderResults();
try { input.focus(); } catch(ignoreFocus) {}
});
card.addEventListener('click', function(e){
var b = e.target.closest('[data-afa]');
if (!b) return;
if (b.getAttribute('data-afa') === 'assign-back') {
afaConfirm();
return;
}
if (b.getAttribute('data-afa') === 'assign-start') {
if (!selectedNames.length || b.disabled) return;
if (syncEnabled() && !cbtAssignUiSessionOwned()) {
try { cbtAssignRenderGlobalSessionState(); } catch(eLostTurn) {}
return;
}
if (typePartial.checked && !cbtAssignPartialCheckboxAvailable()) {
cbtAssignRefreshPartialCheckboxState();
syncPartialOnlyMode();
return;
}
if (!typePartial.checked && !cbtAssignHasSiteTasks()) {
afaConfirm();
return;
}
if (b.getAttribute('data-cbt-start-pending') === '1') return;
var frozenNames = selectedNames.slice();
var frozenTypes = {
partialOnly: !!typePartial.checked,
cart: !typePartial.checked && !!typeCart.checked,
both: !typePartial.checked && !!typeBoth.checked
};
var startOverlay = _afaOverlay;
b.setAttribute('data-cbt-start-pending','1');
b.disabled = true;
cbtAssignRenewUiSessionLock().then(function(lockOk){
b.removeAttribute('data-cbt-start-pending');
if (!_afaOverlay || _afaOverlay !== startOverlay || !b.isConnected) return;
if (!lockOk || (syncEnabled() && !cbtAssignUiSessionOwned())) {
updateAssignStartState();
try { cbtAssignRenderGlobalSessionState(); } catch(eRenewRender) {}
return;
}
cbtAssignRememberRecentNames(frozenNames);
cbtAssignRun(frozenNames, frozenTypes);
});
return;
}
});
cbtAssignRefreshPartialCheckboxState();
renderSelected();
syncPartialOnlyMode();
search('');
try { input.focus(); } catch(e) {}
}
function afaConfirmRender(list, pbAll, pbExpected, suppress) {
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
list = (list || []).filter(function(x){ return !isSuppressed('force', x); });
pbAll = (pbAll || []).filter(function(x){ return !isSuppressed('partial', x); });
var ready = list.filter(function(x){ return x.id; });
var noId = list.filter(function(x){ return !x.id; });
var pbReady = pbAll.filter(function(x){ return x.id; });
var pbFound = (pbExpected != null) ? Math.max(pbExpected, pbAll.length) : pbAll.length;
var pbUnresolved = Math.max(0, pbFound - pbReady.length);
var completionCandidates = afaScanCompletionCandidates()
.filter(function(x){ return !isSuppressed('complete', x); });
var completeReady = completionCandidates.filter(function(x){ return x.id; });
var assignTaskState = cbtAssignSiteTaskState();
var assignHasPartial = pbReady.length > 0;
var assignDisabled = !assignTaskState.hasTasks && !assignHasPartial;
var forceDisabled = ready.length === 0;
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
var globalAssignOther = cbtAssignUiSessionOwnedByOther();
var globalAssignWait = globalAssignOther ? cbtAssignUiSessionSeconds(globalAssignOther) : 0;
if (globalAssignOther) assignDisabled = true;
var assignBlock = actionBlock(
'assign',
globalAssignOther ? ('Wait ' + globalAssignWait + 's') : '▶ Assign Cart',
null,
assignDisabled,
assignDisabled
? (!assignTaskState.ready && !assignHasPartial
? 'Tasks are still loading and no readable Partially Batched carts are available yet.'
: 'No normal Tasks or readable Partially Batched carts are available right now.')
: (!assignTaskState.hasTasks && assignHasPartial
? 'Partially Batched carts are available. Open Assign Cart and check “Only Assign Partially Batched Carts”.'
: 'Select associates in order. Normal Tasks are the default; Partially Batched can be selected exclusively inside Assign Cart.')
);
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
(missingCandidates.length ? 'Checking…' : 'No Missing/Damaged') +
'</button>' +
'<span class="cbt-afa-action-copy" id="cbt-afa-missing-copy">' +
(missingCandidates.length
? 'Checking warning rows in Tasks plus every Problem Solve and Partially Batched row. The button enables if a real MISSING or DAMAGED package is found.'
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
missingBlock +
assignBlock +
completeBlock +
warnings +
listHtml +
'<div class="cbt-afa-note">Each action only affects its own cart group. Problem Solve is never touched. Missing Package QR is read-only.</div>',
'<button class="cbt-afa-act" data-afa="close">Close</button>'
);
var card = _afaOverlay.querySelector('#cbt-afa-card');
if (!card) return;
try {
var globalAssignButton = card.querySelector('[data-afa="assign"]');
if (globalAssignButton && globalAssignOther) globalAssignButton.setAttribute('data-cbt-global-locked','1');
cbtAssignRenderGlobalSessionState();
} catch(eGlobalAssignRender) {}
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
var damagedCount = verifiedEntries.filter(function(entry){
return afaMissingText(entry.packageStatus).toUpperCase() === 'DAMAGED';
}).length;
var missingCount = verifiedEntries.length - damagedCount;
var parts = [];
if (missingCount) parts.push(missingCount + ' MISSING');
if (damagedCount) parts.push(damagedCount + ' DAMAGED');
copy.textContent =
parts.join(' + ') + ' package' +
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
btn.innerHTML = '<span class="cbt-afa-missing-triangle">▲</span>No Missing/Damaged';
copy.textContent =
'No MISSING or DAMAGED package was found in Tasks, Problem Solve, or Partially Batched. This button is disabled.';
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
function runFresh(action, button) {
if (!button || button.disabled || _afaRunning) return;
var original = button.textContent;
button.disabled = true;
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
if (action === 'assign') {
if (b.getAttribute('data-cbt-global-locked') === '1') {
try { cbtAssignRenderGlobalSessionState(); } catch(eWaitRender) {}
return;
}
if (b.disabled ||
(!cbtAssignHasSiteTasks() && !cbtAssignHasPartialTasks())) {
afaConfirm();
return;
}
cbtAssignOpenPickerWithGlobalLock();
return;
}
if (action === 'missingqr') {
if (b.disabled || !afaMissingQrEntries(_afaMissingMenuInfo).length) {
return;
}
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
var okN = results.filter(function(r){ return r.ok === true; }).length;
var skipN = results.filter(function(r){ return r.skip; }).length;
var badN = results.filter(function(r){ return r.ok === false && !r.skip; }).length;
afaShell(title + ' \u2014 finished',
'<div id="cbt-afa-lead">' + (stopped ? 'Stopped early. ' : '') +
'<b>' + okN + '</b> ' + (isComplete ? 'completed' : 'assigned') +
(skipN ? ', <b>' + skipN + '</b> skipped' : '') +
(badN ? ', <b>' + badN + '</b> failed' : '') + '.</div>' +
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
try { afaRefreshJobData(); } catch(e) {}
return;
}
});
}
function afaRun(list, opts) {
opts = opts || {};
var runMode = opts.mode || (opts.autoComplete ? 'complete' : 'force');
var autoComplete = runMode === 'complete' || !!opts.autoComplete;
var completeOnly = runMode === 'complete' || !!opts.completeOnly || autoComplete;
_afaRunning = true; _afaStop = false;
_afaDone = Object.create(null);
var partialRefs = Object.create(null);
list.forEach(function(it){ if (it.partial) partialRefs[it.ref] = true; });
var btn = document.getElementById('cbt-afa-btn');
afaSetBtn('⏹ Stop', true);
afaProgressView(runMode);
var results = [], i = 0;
var afaNextTimer = 0;
var afaNextResume = null;
function resumePendingStep() {
if (!afaNextResume) return;
var fn = afaNextResume;
afaNextResume = null;
if (afaNextTimer) {
clearTimeout(afaNextTimer);
afaNextTimer = 0;
}
fn();
}
function onRunVisibilityChange() {
if (!document.hidden || !afaNextResume) return;
if (afaNextTimer) {
clearTimeout(afaNextTimer);
afaNextTimer = 0;
}
Promise.resolve().then(resumePendingStep);
}
document.addEventListener('visibilitychange', onRunVisibilityChange);
function finish() {
_afaRunning = false;
try { document.removeEventListener('visibilitychange', onRunVisibilityChange); } catch(eVis) {}
if (afaNextTimer) {
clearTimeout(afaNextTimer);
afaNextTimer = 0;
}
afaNextResume = null;
afaSetBtn('▶ Run', false);
var stopped = _afaStop;
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
_afaDone = Object.create(null);
afaSummary(results, stopped, retryable, runMode);
});
}
function next(delay) {
i++;
afaNextResume = function() {
step();
};
if (document.hidden) {
Promise.resolve().then(resumePendingStep);
return;
}
afaNextTimer = setTimeout(
resumePendingStep,
delay == null ? AFA_DELAY_MS : delay
);
}
function step() {
if (_afaStop || i >= list.length) return finish();
var item = list[i];
afaProgress(i + 1, list.length, item.ref, results);
if (!item.id) { results.push({ ref: item.ref, ok: false, msg: 'task ID not found' }); return next(20); }
if (_afaDone[item.id]) { results.push({ ref: item.ref, skip: true, ok: false, msg: 'already handled in this run' }); return next(20); }
function doneResult(row, delay) {
results.push(row);
afaProgress(i + 1, list.length, item.ref, results);
next(delay == null ? AFA_DELAY_MS : delay);
}
function forceNow(noteWhy) {
_afaDone[item.id] = true;
return afaForceAssign(item.id).then(function(r){
if (r.ok) {
if (runMode === 'partial' &&
item.partial &&
item.id &&
item.ref) {
cbtRememberForcedPartial(
item.id,
item.ref
);
}
doneResult({ ref: item.ref, id: item.id, ok: true, msg: 'Force Assigned (HTTP ' + r.status + ')' + (noteWhy ? ' \u2014 ' + noteWhy : '') });
} else {
var why = r.status ? ('HTTP ' + r.status) : 'no response';
if (r.body) why += ' \u2014 ' + String(r.body).replace(/\s+/g, ' ').slice(0, 90);
doneResult({ ref: item.ref, ok: false, msg: why });
}
});
}
function continueWithoutCompletion(probeReason) {
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
if (item.completeCandidate && !item.unassignable) {
doneResult({ ref: item.ref, skip: true, ok: false, msg: probeReason || 'Complete Task not available' }, 80);
return;
}
var live = afaScanDashboard();
var still = live.some(function(x){ return x.id ? x.id === item.id : x.ref === item.ref; });
if (!still) {
doneResult({ ref: item.ref, skip: true, ok: false, msg: 'no longer unassignable \u2014 skipped' }, 60);
return;
}
forceNow(probeReason || '');
}
if (runMode === 'partial' && !item.partial) {
doneResult({ ref: item.ref, skip: true, ok: false, msg: 'Skipped \u2014 not a Partially Batched cart' }, 60);
return;
}
if (runMode === 'force' && item.partial) {
doneResult({ ref: item.ref, skip: true, ok: false, msg: 'Skipped \u2014 use Partially Batched button' }, 60);
return;
}
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
var AC_MIN_CHARS = 2;
var AC_MAX_ROWS = 12;
var _acDrop = null, _acInput = null, _acItems = [], _acIdx = -1;
var _acHost = null;
var _acWatch = null, _acRect = '';
function acRealTarget(e) {
try {
if (typeof e.composedPath === 'function') {
var path = e.composedPath();
if (path && path.length) return path[0];
}
} catch(err) {}
return e.target;
}
function acFindKatInput(scope) {
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
try {
var root = scope || document;
var custom = root.querySelectorAll('kat-select,[role="combobox"],button,[aria-haspopup="listbox"]');
for (var j = 0; j < custom.length; j++) {
var ct = (custom[j].textContent || custom[j].getAttribute('value') || custom[j].getAttribute('aria-label') || '')
.replace(/\s+/g, ' ').trim().toLowerCase();
if (/^associate\s*id$|associate\s*id/.test(ct)) return true;
}
} catch(e4) {}
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
return /assign/i.test(tid);
}
var role = n.getAttribute ? (n.getAttribute('role') || '') : '';
var cls = (typeof n.className === 'string') ? n.className : '';
if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog' ||
/(^|\s|-)(modal|dialog)(\s|-|$)/i.test(cls)) {
var txt = '';
try { txt = (n.textContent || '').slice(0, 800); } catch(e) {}
return /assign/i.test(txt);
}
}
if (n.nodeType === 11 && n.host) { n = n.host; continue; }
n = n.parentNode;
}
return false;
}
function acIsAssociateField(el) {
if (!el || el.tagName !== 'INPUT' || acIsOurs(el)) return false;
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
var z = (typeof _uiScale === 'number' && _uiScale > 0) ? _uiScale : 1;
var r = _acInput.getBoundingClientRect();
var w = Math.max(r.width, 240);
var left = Math.min(r.left, window.innerWidth - w - 8);
_acDrop.style.width = (w / z) + 'px';
_acDrop.style.left = (Math.max(8, left) / z) + 'px';
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
function acFire(el) {
try { el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); } catch(e) {}
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
if (host && host !== el) {
try { host.value = value; } catch(e) {}
try { if (host.setAttribute) host.setAttribute('value', value); } catch(e) {}
acFire(host);
}
}
function acPick(name) {
if (!name || !_acInput) return;
var el = _acInput;
acSetValue(el, name, _acHost);
acClose();
try { el.focus(); if (el.setSelectionRange) el.setSelectionRange(name.length, name.length); } catch(e) {}
}
document.addEventListener('focusin', function(e){
var el = acRealTarget(e);
if (!acIsAssociateField(el)) return;
acBind(el, null);
_acInput = el;
if ((el.value || '').trim().length >= AC_MIN_CHARS) acRender(el.value);
}, true);
document.addEventListener('input', function(e){
var t = acRealTarget(e);
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
if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); }
else if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); }
else if (e.key === 'Enter') {
if (_acIdx >= 0 && _acItems[_acIdx]) { e.preventDefault(); e.stopPropagation(); acPick(_acItems[_acIdx]); }
}
else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); }
else if (e.key === 'Tab') { acClose(); }
}, true);
document.addEventListener('mousedown', function(e){
if (!_acDrop) return;
var t = acRealTarget(e);
if (_acDrop.contains(t) || _acDrop.contains(e.target) || t === _acInput) return;
acClose();
}, true);
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
function acDeepActive() {
var a = null;
try { a = document.activeElement; } catch(e) { return null; }
var guard = 0;
while (a && a.shadowRoot && a.shadowRoot.activeElement && guard++ < 12) {
a = a.shadowRoot.activeElement;
}
return a;
}
function acAutoFocus(input) {
if (!input || input._cbtAcFocused) return;
input._cbtAcFocused = true;
var tries = 0, MAX = 40;
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
if (!r || (!r.width && !r.height)) { again(100); return; }
if (acDeepActive() === input) return;
if (userIsElsewhere()) return;
try { input.focus({ preventScroll: true }); } catch(e) { try { input.focus(); } catch(e2) {} }
again(tries < 6 ? 16 : 120);
}
attempt();
}
function acBind(input, host) {
if (!input || input._cbtAcBound) { if (host && input) input._cbtAcHost = host; return; }
input._cbtAcBound = true;
if (host) input._cbtAcHost = host;
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
if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); }
else if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); }
else if (e.key === 'Enter') { if (_acIdx >= 0 && _acItems[_acIdx]) { e.preventDefault(); e.stopPropagation(); acPick(_acItems[_acIdx]); } }
else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); }
else if (e.key === 'Tab') { acClose(); }
});
}
var _acModalSeen = null;
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
function acGenericModalEl() {
var sels = ['[role="dialog"]', '[role="alertdialog"]', 'dialog[open]', '.modal.in', '.modal'];
for (var s = 0; s < sels.length; s++) {
var nodes;
try { nodes = document.querySelectorAll(sels[s]); } catch(e) { continue; }
for (var i = 0; i < nodes.length; i++) {
var n = nodes[i];
var r;
try { r = n.getBoundingClientRect(); } catch(e) { continue; }
if (!r.width && !r.height) continue;
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
if (!modal) { _acModalSeen = null; return; }
if (_acModalSeen === modal) return;
var found = acFindKatInput(modal) || acFindKatInput();
if (!found) {
var deep = acDeepFindInput(modal, 0) || acDeepFindInput(document, 0);
if (!deep) return;
found = deep;
}
var rr;
try { rr = found.input.getBoundingClientRect(); } catch(e) { rr = null; }
if (!rr || (!rr.width && !rr.height)) return;
_acModalSeen = modal;
acBind(found.input, found.host);
found.input._cbtAcFocused = false;
acAutoFocus(found.input);
}
function acScanForFields() {
try { acWatchAssignModal(); } catch(e) {}
var found = acFindKatInput();
if (found) { acBind(found.input, found.host); return; }
try {
var plain = document.querySelectorAll('input');
for (var i = 0; i < plain.length; i++) {
if (!plain[i]._cbtAcBound && acIsAssociateField(plain[i])) acBind(plain[i], null);
}
} catch(e) {}
if (document.querySelector('kat-modal, [role="dialog"], .modal')) {
var deep = acDeepFindInput(document, 0);
if (deep) acBind(deep.input, deep.host);
}
}
function acTick() {
if (!_acDrop) return;
if (!_acInput || !_acInput.isConnected) { acClose(); return; }
var r = _acInput.getBoundingClientRect();
if (!r.width && !r.height) { acClose(); return; }
var sig = Math.round(r.left) + ':' + Math.round(r.top) + ':' + Math.round(r.width);
if (sig !== _acRect) { _acRect = sig; acPlace(); }
}
window.addEventListener('resize', function(){ try { applyUiScale(); } catch(e) {} });
window.addEventListener('resize', function(){ if (_acDrop) acPlace(); });
window.addEventListener('scroll', function(){ if (_acDrop) acPlace(); }, true);
function acWatchRelevant() {
if (isOutboundSite() || isTaskDetailPage()) return true;
return !!document.querySelector('kat-modal, [role="dialog"], .modal');
}
function cbtAutocompleteMutationMayMatter(m) {
if (!m) return false;
var target = m.target && m.target.nodeType === 1 ? m.target : null;
try {
if (target && (
(target.matches && target.matches('kat-modal,[role="dialog"],[role="alertdialog"],.modal,input')) ||
(target.closest && target.closest('kat-modal,[role="dialog"],[role="alertdialog"],.modal'))
)) {
return true;
}
} catch(eTarget) {}
var added = m.addedNodes || [];
for (var j = 0; j < added.length; j++) {
var n = added[j];
if (!n || n.nodeType !== 1) continue;
try {
if ((n.matches && n.matches('kat-modal,[role="dialog"],[role="alertdialog"],.modal,input')) ||
(n.querySelector && n.querySelector('kat-modal,[role="dialog"],[role="alertdialog"],.modal,input'))) {
return true;
}
} catch(eAdded) {}
}
return false;
}
function startAutocompleteWatch() {
if (_acWatch) return;
_acMutationRun = coalesced(function(){
if (!acWatchRelevant() && !_acDrop) return;
acScanForFields();
}, 140);
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
var RESET_KEY = 'cbt_today_weekly_reset_v239128_v3_' + CBT_HISTORY_STORE_SCOPE;
try {
if (gmGet(RESET_KEY, null) || localStorage.getItem(RESET_KEY)) return;
} catch(e0) {}
var today = todayStr();
var week = currentWeekStartStr();
var empty = '{}';
try { gmSet(STORAGE_KEY, empty); } catch(e1) {}
try { gmSet(DATE_KEY, today); } catch(e2) {}
try { localStorage.setItem(STORAGE_KEY, empty); } catch(e3) {}
try { localStorage.setItem(DATE_KEY, today); } catch(e4) {}
try { gmSet(REMOTE_HISTORY_KEY, empty); } catch(e5) {}
try { gmSet(REMOTE_HISTORY_DATE_KEY, today); } catch(e6) {}
try { localStorage.setItem(REMOTE_HISTORY_KEY, empty); } catch(e7) {}
try { localStorage.setItem(REMOTE_HISTORY_DATE_KEY, today); } catch(e8) {}
try { gmSet(OWN_WEEKLY_KEY, empty); } catch(e9) {}
try { gmSet(WEEKLY_KEY, empty); } catch(e10) {}
try { gmSet(WEEKLY_PERIOD_KEY, week); } catch(e11) {}
try { localStorage.setItem(OWN_WEEKLY_KEY, empty); } catch(e12) {}
try { localStorage.setItem(WEEKLY_KEY, empty); } catch(e13) {}
try { localStorage.setItem(WEEKLY_PERIOD_KEY, week); } catch(e14) {}
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
function installRouteHealth() {
var wasDashboard = isDashboardView();
function onRoute() {
var routedStore = cbtStoreIdFromLocation();
if (routedStore && STORE_ID && String(routedStore) !== String(STORE_ID)) {
location.reload();
return;
}
var nowDashboard = isDashboardView();
var returnedToDashboard = nowDashboard && !wasDashboard;
wasDashboard = nowDashboard;
if (!nowDashboard) detachMainPanel();
if (returnedToDashboard) {
_cbtLiveDashboardSyncPending = true;
_cbtStaleLiveZeroTaskPolls = 0;
requestLiveRender();
}
_fastMountUntil = Date.now() + 15000;
try { ensureSortAttachment(); } catch(e0) {}
panelHealthCheck();
if (returnedToDashboard) {
try { pollActiveTasks(); } catch(e1) {}
try { fetchAndUpdate(); } catch(e2) {}
}
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
var hbLastLive = 0, hbLastSecond = 0, hbLastHealth = 0, hbLastTimers = 0;
setInterval(function () {
var nowMs = Date.now();
var nowPath = location.pathname + location.hash;
if (nowPath !== lastPath) {
lastPath = nowPath;
onRoute();
}
if (nowMs - hbLastLive >= TICK_MS) {
hbLastLive = nowMs;
if (isComoSite()) {
try { tickLive(); } catch(eLiveTick) {}
}
}
if (nowMs - hbLastSecond >= 1000) {
hbLastSecond = nowMs;
if (!document.hidden && boardIsMisplaced()) detachMainPanel();
if (isComoSite()) {
try { tickTimers(); } catch(eTimerTick) {}
}
}
if (nowMs - hbLastHealth >= PANEL_HEALTH_MS) {
hbLastHealth = nowMs;
try { panelHealthCheck(); } catch(eHealth) {}
if (isComoSite()) {
try { pollActiveTasks(); } catch(ePoll) {}
try { fetchAndUpdate(); } catch(eStats) {}
}
}
if (nowMs - hbLastTimers >= 5000) {
hbLastTimers = nowMs;
if (isComoSite() && !document.hidden && isDashboardView()) {
try { injectAllTimers(); } catch(eTimerScan) {}
}
}
if (Date.now() < _fastMountUntil && !document.hidden && isDashboardView()) {
var mp = document.getElementById('cbt-panel');
if (!mp || !mp.isConnected) {
try { panelHealthCheck(); } catch(eFast) {}
}
}
}, 500);
}
function startCoreFeatures() {
try {
if (!style.isConnected) document.head.appendChild(style);
} catch(e) {}
try {
_uiScale = loadUiScale();
_uiScaleLoaded = true;
} catch(e2) {
_uiScale = UI_SCALE_DEFAULT;
}
_fastMountUntil = Date.now() + 60000;
window.addEventListener('load', function(){
try { panelHealthCheck(); } catch(e4) {}
});
try {
panelWatcher.observe(document.documentElement, { childList: true, subtree: true });
} catch(e5) {}
try { ensureSortAttachment(); } catch(e6) {}
try { if (isDashboardView()) injectPanel(); } catch(e7) {}
installRouteHealth();
try { cbtAssignSharedProtectionPull(true); } catch(eFastProtect) {}
try { cbtAssignStartSharedProtectionLive(); } catch(eFastProtectLive) {}
try { startAutocompleteWatch(); } catch(e9) {}
try { cbtStartTodayBoundaryClock(); } catch(e10) {}
if (isComoSite()) {
try {
cbtRetargetTimerWatcher((_attached && _attached.isConnected) ? _attached : getContainer());
injectAllTimers();
} catch(e12) {}
pollActiveTasks();
if (!_statsLastRequestAt ||
(Date.now() - _statsLastRequestAt) > 700) {
fetchAndUpdate();
}
}
}
function startBackgroundFeatures() {
try { cbtResetTodayWeeklyV2(); } catch(eReset) {}
try { cbtTrustedRateMigration(); } catch(e0) {}
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
try { cbtBatchEventsPull(); } catch(eEvents) {}
try { cbtAssignSharedProtectionPull(true); } catch(eProtect) {}
try { cbtAssignStartSharedProtectionLive(); } catch(eProtectLive) {}
setInterval(function(){ if (!document.hidden) { try { cbtBatchEventsPull(); } catch(eEvents2) {} } }, 15000);
setInterval(function(){ if (!document.hidden) syncPull(); }, 30000);
var cbtAssignProtectFallbackTick = 0;
setInterval(function(){
if (document.hidden) return;
cbtAssignProtectFallbackTick++;
try { cbtAssignRenderGlobalSessionState(); } catch(eGlobalAssignFastTick) {}
try {
var streamTooOld =
_cbtAssignLiveStreamActive &&
_cbtAssignLiveStreamStartedAt &&
Date.now() - _cbtAssignLiveStreamStartedAt > 10 * 60 * 1000;
var streamStale =
_cbtAssignLiveStreamReady &&
_cbtAssignLiveStreamLastProgress &&
Date.now() - _cbtAssignLiveStreamLastProgress > 75000;
if (streamTooOld || streamStale) {
cbtAssignStopSharedProtectionLive();
cbtAssignSharedProtectionPull(true);
cbtAssignStartSharedProtectionLive();
}
if (!_cbtAssignLiveStreamReady ||
cbtAssignProtectFallbackTick % 20 === 0) {
cbtAssignSharedProtectionPull();
}
if (!_cbtAssignLiveStreamActive) {
cbtAssignStartSharedProtectionLive();
}
} catch(eProtect2) {}
}, 500);
document.addEventListener('visibilitychange', function(){
if (document.hidden) return;
try { panelHealthCheck(); } catch(e9p) {}
if (isComoSite() && isDashboardView()) {
try { pollActiveTasks(); } catch(e9live) {}
try { fetchAndUpdate(); } catch(e9stats) {}
}
try { cbtBatchEventsPull(); } catch(e9events) {}
try { cbtAssignSharedProtectionPull(true); } catch(e9protect) {}
try { cbtAssignStartSharedProtectionLive(); } catch(e9protectLive) {}
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
_statsStartupGraceUntil = Date.now() + 2500;
try { cbtStatsPrimeStartupWarm(); } catch(eWarmPrime) {}
if (isComoSite() && isDashboardView() && !document.hidden) {
try { fetchAndUpdate(); } catch(eStatsWarm) {}
}
cbtAfterFirstPaint(startCoreFeatures, 120);
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
