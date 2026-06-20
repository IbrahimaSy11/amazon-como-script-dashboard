// ==UserScript==
// @name         COMO - Early Task In Order With Timer & Batcher Dashboard
// @namespace    https://github.com/uny2-ops
// @version      21.3.0
// @description  Sorts tasks in order by earliest Batch Target + Time Left column + Batcher Timer Dashboard
// @author       Ibrahim
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*/dash*
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*/tasks*
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*/jobs*
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*/task/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      drive.corp.amazon.com
// @connect      getpantry.cloud
// ==/UserScript==

(function () {
  'use strict';

  var STORE_ID  = (window.location.href.split('store/')[1] || '').split('/')[0];
  var DRIVE_URL = 'https://drive.corp.amazon.com/view/jsermar@/COMO_Dashboard_BatchRate_NA.json?download=true';
  var COMO_BASE = 'https://como-operations-dashboard-iad.iad.proxy.amazon.com';

  var style = document.createElement('style');
  style.textContent = `
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

    #cbt-panel.dark { background: #000 !important; border-color: #333 !important; color: #fff !important; }
    #cbt-panel.dark #cbt-header { background: #111 !important; border-bottom-color: #333 !important; }
    #cbt-panel.dark #cbt-title { color: #fff !important; }
    #cbt-panel.dark #cbt-controls span { color: #aaa !important; }
    #cbt-panel.dark #cbt-stats-bar { background: #111 !important; border-bottom-color: #333 !important; }
    #cbt-panel.dark #cbt-label-batchers { color: #ffffff !important; }
    #cbt-panel.dark #cbt-label-rec { color: #ffffff !important; }
    #cbt-panel.dark #cbt-label-remaining { color: #ffffff !important; }
    #cbt-panel.dark #cbt-stat-ip { color: #58a6ff !important; }
    #cbt-panel.dark #cbt-stat-rem { color: #58a6ff !important; }
    #cbt-panel.dark #cbt-tabs { background: #111 !important; border-bottom-color: #333 !important; }
    #cbt-panel.dark .cbt-tab { color: #aaa !important; }
    #cbt-panel.dark .cbt-tab.active { color: #58a6ff !important; border-bottom-color: #58a6ff !important; }
    #cbt-panel.dark #cbt-body { background: #000 !important; }
    #cbt-panel.dark #cbt-table th, #cbt-panel.dark #cbt-hist-table th, #cbt-panel.dark #cbt-weekly-table th { background: #000 !important; color: #fff !important; }
    #cbt-panel.dark #cbt-table td, #cbt-panel.dark #cbt-hist-table td, #cbt-panel.dark #cbt-weekly-table td { color: #e6edf3 !important; border-bottom-color: #222 !important; }
    #cbt-panel.dark #cbt-table tbody tr:hover td, #cbt-panel.dark #cbt-hist-table tbody tr:hover td, #cbt-panel.dark #cbt-weekly-table tbody tr:hover td { background: #111 !important; }
    #cbt-panel.dark .cbt-assoc { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-assoc:hover { color: #58a6ff !important; }
    #cbt-panel.dark .cbt-hist-meta { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-ws-val { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-ws-label { color: #aaa !important; }
    #cbt-panel.dark #cbt-search-input, #cbt-panel.dark #cbt-hist-search-input, #cbt-panel.dark #cbt-live-search-input { background: #111 !important; border-color: #333 !important; color: #fff !important; }
    #cbt-panel.dark #cbt-live-search, #cbt-panel.dark #cbt-weekly-search, #cbt-panel.dark #cbt-hist-search { background: #000 !important; }
    #cbt-panel.dark #cbt-live-search-clear, #cbt-panel.dark #cbt-hist-search-clear, #cbt-panel.dark #cbt-weekly-search-clear { color: #555 !important; }
    #cbt-panel.dark #cbt-updated { color: #555 !important; }
    #cbt-panel.dark #cbt-weekly-summary, #cbt-panel.dark #cbt-hist-summary { border-bottom-color: #333 !important; }
    #cbt-panel.dark #cbt-drag-bottom { background: #222 !important; }
    #cbt-panel.dark #cbt-drag-bottom:hover { background: #58a6ff !important; }

    #cbt-panel {
      width: 100%; background: #ffffff; border: 1px solid #c8c8c8;
      border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: #333; margin-bottom: 12px; overflow: hidden;
    }
    #cbt-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #f5f5f5;
      border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;
    }
    #cbt-title { font-weight: 700; font-size: 22px; color: #333; letter-spacing: 0.02em; }
    #cbt-controls { display: flex; gap: 12px; align-items: center; }
    #cbt-controls span { cursor: pointer; }
    #cbt-controls span:hover { opacity: 0.7; }
    #cbt-tabs {
      display: flex; justify-content: center;
      border-bottom: 1px solid #ddd; background: #f5f5f5;
    }
    .cbt-tab {
      flex: 1; text-align: center; padding: 8px 0; font-size: 22px;
      font-weight: 600; color: #888; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .cbt-tab:hover { color: #333; }
    .cbt-tab.active { color: #0066cc; border-bottom: 2px solid #0066cc; }
    #cbt-body { padding: 6px 8px 8px; height: 350px; max-height: 350px; min-height: 350px; overflow-y: auto; background: #fff; }
    #cbt-table, #cbt-hist-table, #cbt-weekly-table, #cbt-names-table { width: 100%; border-collapse: collapse; }
    #cbt-table thead tr, #cbt-hist-table thead tr, #cbt-weekly-table thead tr, #cbt-names-table thead tr { border-bottom: 1px solid #ddd; }
    #cbt-table th, #cbt-hist-table th, #cbt-weekly-table th, #cbt-names-table th {
      color: #333; font-weight: 700; font-size: 16px; text-transform: uppercase;
      letter-spacing: 0.06em; padding: 5px 6px 7px; text-align: left; background: #fff;
    }
    #cbt-table th:not(:first-child), #cbt-hist-table th:not(:first-child),
    #cbt-weekly-table th:not(:first-child) { text-align: center; }
    #cbt-table td, #cbt-hist-table td, #cbt-weekly-table td, #cbt-names-table td {
      padding: 7px 6px; border-bottom: 1px solid #f0f0f0;
      vertical-align: middle; text-align: center; font-size: 22px; color: #333;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #cbt-table td:first-child, #cbt-hist-table td:first-child,
    #cbt-weekly-table td:first-child, #cbt-names-table td:first-child { text-align: left; }
    #cbt-table tbody tr:last-child td, #cbt-hist-table tbody tr:last-child td,
    #cbt-weekly-table tbody tr:last-child td, #cbt-names-table tbody tr:last-child td { border-bottom: none; }
    #cbt-table tbody tr:hover td, #cbt-hist-table tbody tr:hover td,
    #cbt-weekly-table tbody tr:hover td, #cbt-names-table tbody tr:hover td { background: #f9f9f9; }
    .cbt-name-cell { font-size: 18px; font-weight: 700; color: #333; cursor: pointer; }
    .cbt-name-cell:hover { color: #0066cc; }
    #cbt-panel.dark .cbt-name-cell { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-name-cell:hover { color: #58a6ff !important; }
    #cbt-panel.dark #cbt-names-table th { background: #000 !important; color: #fff !important; }
    #cbt-panel.dark #cbt-names-table td { color: #e6edf3 !important; border-bottom-color: #222 !important; }
    #cbt-panel.dark #cbt-names-table tbody tr:hover td { background: #111 !important; }
    #cbt-panel.dark #cbt-names-search-input { background: #111 !important; border-color: #333 !important; color: #fff !important; }
    #cbt-names-search-input {
      padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px;
      font-size: 14px; outline: none; background: #fff; color: #333;
    }
    #cbt-names-search-input:focus { border-color: #0066cc; }
    .cbt-assoc { font-size: 22px; font-weight: 700; color: #333; cursor: pointer; }
    .cbt-assoc:hover { color: #0066cc; }
    .cbt-ref { display: block; font-size: 12px; color: #aaa; font-family: monospace; }
    .cbt-elapsed { font-family: "Courier New", monospace; font-size: 22px; font-weight: 700; color: #2a9d2a; }
    .cbt-elapsed.warn { color: #cc8800; } .cbt-elapsed.alert { color: #cc2200; }
    .cbt-rate { font-family: "Courier New", monospace; font-size: 22px; font-weight: 700; color: #2a9d2a; }
    .cbt-rate.warn { color: #cc8800; } .cbt-rate.alert { color: #cc2200; }
    .cbt-rate.pending { color: #aaa; font-style: italic; font-size: 22px; }
    .cbt-hist-rate { font-family: "Courier New", monospace; font-size: 22px; font-weight: 700; }
    .cbt-hist-rate.good { color: #2a9d2a; } .cbt-hist-rate.warn { color: #cc8800; } .cbt-hist-rate.alert { color: #cc2200; }
    .cbt-hist-meta { font-size: 22px; color: #333; }
    .cbt-rank { display: inline-block; width: 22px; height: 22px; line-height: 22px; border-radius: 50%;
      font-size: 13px; font-weight: 700; text-align: center; margin-right: 5px; background: #eee; color: #666; }
    .cbt-rank.gold { background: #b8860b; color: #fff; }
    .cbt-rank.silver { background: #888; color: #fff; }
    .cbt-rank.bronze { background: #cd7f32; color: #fff; }
    #cbt-empty, #cbt-hist-empty, #cbt-weekly-empty {
      display: none; text-align: center; color: #aaa; padding: 12px 0; font-style: italic; font-size: 14px;
    }
    #cbt-updated { text-align: right; color: #bbb; font-size: 13px; margin-top: 4px; }
    #cbt-weekly-summary, #cbt-hist-summary {
      display: flex; justify-content: space-around;
      padding: 8px 4px 10px; border-bottom: 1px solid #ddd; margin-bottom: 4px;
    }
    .cbt-ws-stat { text-align: center; }
    .cbt-ws-val { font-family: "Courier New", monospace; font-size: 22px; font-weight: 700; color: #333; display: block; }
    .cbt-ws-label { font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.07em; }
    #cbt-weekly-search, #cbt-hist-search, #cbt-live-search { padding: 6px 4px 2px; text-align: center; }
    #cbt-search-input, #cbt-hist-search-input, #cbt-live-search-input {
      width: 95%; padding: 6px 10px; background: #fff; border: 1px solid #ccc;
      border-radius: 6px; color: #333; font-size: 16px; outline: none;
    }
    #cbt-search-input:focus, #cbt-hist-search-input:focus, #cbt-live-search-input:focus { border-color: #0066cc; }
    #cbt-live-results { margin-top: 6px; }
    .cbt-search-result-section { font-size: 13px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.1em; padding: 8px 8px 6px; border-top: 3px solid #333; border-bottom: 1px solid #ddd; margin-top: 6px; background: #f5f5f5; }
    .cbt-search-row { display: table; width: 100%; padding: 0; border-bottom: 1px solid #f0f0f0; margin: 0; box-sizing: border-box; height: 36px; }
    .cbt-search-row-name { display: table-cell; width: 35%; font-size: 18px; font-weight: 700; color: #333; text-align: left; vertical-align: middle; padding: 5px 4px 5px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; transition: color 0.15s; }
    .cbt-search-row-name:hover { color: #0066cc !important; }
    #cbt-panel.dark .cbt-search-row-name:hover { color: #58a6ff !important; }
    .cbt-search-row-mid { display: table-cell; width: 40%; font-size: 15px; color: #888; text-align: center; vertical-align: middle; padding: 5px 4px; font-family: "Courier New", monospace; letter-spacing: 0; white-space: nowrap; }
    .cbt-search-row-rate { display: table-cell; width: 25%; font-size: 20px; font-weight: 700; text-align: right; vertical-align: middle; padding: 5px 8px 5px 4px; font-family: "Courier New", monospace; }
    .cbt-search-row .cbt-hist-rate { font-size: 20px !important; line-height: 1 !important; display: inline; margin: 0; padding: 0; }
    #cbt-panel.dark .cbt-search-row { border-bottom-color: #222 !important; }
    #cbt-panel.dark .cbt-search-result-section { color: #aaa !important; border-top-color: #58a6ff !important; border-bottom-color: #333 !important; background: #111 !important; }
    #cbt-panel.dark .cbt-search-row-name { color: #e6edf3 !important; }
    #cbt-panel.dark .cbt-search-row-mid { color: #666 !important; }
    .cbt-sortable, .cbt-sortable-live, .cbt-sortable-hist { cursor: pointer; user-select: none; }
    .cbt-sortable:hover, .cbt-sortable-live:hover, .cbt-sortable-hist:hover { color: #0066cc; }
    .cbt-miss-dot { margin-left: 4px; font-size: 16px; vertical-align: middle; }
    .cbt-miss-dot.warn { color: #cc8800; } .cbt-miss-dot.alert { color: #cc2200; }

    /* ── Slow batcher alert ── */
    .cbt-slow-alert {
      display: inline-block; background: #f85149; color: #fff;
      font-size: 11px; font-weight: 800; padding: 2px 6px;
      border-radius: 8px; margin-left: 6px; vertical-align: middle;
      animation: cbt-slow-pulse 1s infinite;
    }
    @keyframes cbt-slow-pulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.4; }
    }

    #cbt-drag-bottom {
      width: 100%; height: 8px; background: #e0e0e0;
      cursor: ns-resize; border-radius: 0 0 4px 4px; transition: background 0.2s;
      user-select: none;
    }
    #cbt-drag-bottom:hover { background: #0066cc; }

    /* ── Task Detail Panel (tp) ── */
    #cbt-tp {
      position: fixed !important; top: 90px !important; right: 10px !important; width: 500px !important; z-index: 9999 !important;
      background: #fff; border: 1px solid #c8c8c8; border-radius: 4px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: #333; overflow: hidden;
    }
    #cbt-tp.dark { background: #000 !important; border-color: #333 !important; color: #fff !important; }
    #cbt-tp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #ddd;
    }
    #cbt-tp.dark #cbt-tp-header { background: #111 !important; border-bottom-color: #333 !important; }
    #cbt-tp-title { font-weight: 700; font-size: 16px; color: #333; }
    #cbt-tp.dark #cbt-tp-title { color: #fff !important; }
    #cbt-tp-controls { display: flex; gap: 8px; align-items: center; cursor: pointer; }
    #cbt-tp-body { height: 160px; min-height: 160px; max-height: 160px; overflow-y: auto; background: #fff; }
    #cbt-tp.dark #cbt-tp-body { background: #000 !important; }
    .cbt-tp-assoc { font-size: 15px; font-weight: 700; color: #333; cursor: pointer; }
    .cbt-tp-assoc:hover { color: #0066cc; }
    #cbt-tp.dark .cbt-tp-assoc { color: #e6edf3 !important; }
    #cbt-tp.dark .cbt-tp-assoc:hover { color: #58a6ff !important; }
    #cbt-tp-results { margin-top: 4px; }
    .cbt-tp-section { font-size: 11px; font-weight: 800; color: #555; text-transform: uppercase;
      padding: 5px 8px 3px; border-top: 2px solid #333; border-bottom: 1px solid #ddd;
      background: #f5f5f5; }
    #cbt-tp.dark .cbt-tp-section { color: #aaa !important; border-top-color: #58a6ff !important; border-bottom-color: #333 !important; background: #111 !important; }
    .cbt-tp-row { display: table; width: 100%; border-bottom: 1px solid #f0f0f0; height: 36px; margin: 0; box-sizing: border-box; }
    #cbt-tp.dark .cbt-tp-row { border-bottom-color: #222 !important; }
    .cbt-tp-row-name { display: table-cell; width: 35%; font-size: 14px; font-weight: 700; color: #333; vertical-align: middle; padding: 3px 4px 3px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cbt-tp-row-name:hover { color: #0066cc !important; }
    #cbt-tp.dark .cbt-tp-row-name { color: #e6edf3 !important; }
    #cbt-tp.dark .cbt-tp-row-name:hover { color: #58a6ff !important; }
    .cbt-tp-row-mid { display: table-cell; width: 40%; font-size: 12px; color: #888; text-align: center; vertical-align: middle; font-family: "Courier New", monospace; }
    #cbt-tp.dark .cbt-tp-row-mid { color: #666 !important; }
    .cbt-tp-row-rate { display: table-cell; width: 25%; font-size: 15px; font-weight: 700; text-align: right; vertical-align: middle; padding: 3px 8px 3px 4px; font-family: "Courier New", monospace; }
    #cbt-tp-search-input {
      flex: 1; padding: 6px 10px; background: #fff; border: 1px solid #ccc;
      border-radius: 6px; color: #333; font-size: 14px; outline: none;
    }
    #cbt-tp.dark #cbt-tp-search-input { background: #111 !important; border-color: #333 !important; color: #fff !important; }
    #cbt-tp-search-clear { font-size: 14px; border: none; background: none; cursor: pointer; color: #888; padding: 0 4px; }
    /* font-size controls in tp header */
    #cbt-tp-font-dec, #cbt-tp-font-inc { font-size: 14px; font-weight: 700; cursor: pointer; user-select: none; }
    #cbt-tp-font-dec:hover, #cbt-tp-font-inc:hover { opacity: 0.7; }
    #cbt-tp.dark #cbt-tp-font-dec, #cbt-tp.dark #cbt-tp-font-inc { color: #aaa !important; }

  `;

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
  bodyWatcher.observe(document.documentElement, { childList: true, subtree: true });
  var c = getContainer(); if (c) attach(c);

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

  var SYNC_PANTRY_ID = 'e568532d-0d42-4e03-a8a9-001c354eead5';
  var SYNC_BASKET    = 'como_names';
  function syncEnabled() { return SYNC_PANTRY_ID && SYNC_PANTRY_ID.indexOf('PASTE_YOUR') !== 0; }
  function syncUrl() { return 'https://getpantry.cloud/apiv1/pantry/' + SYNC_PANTRY_ID + '/basket/' + SYNC_BASKET; }

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

  function loadWeekly() { try { return JSON.parse(localStorage.getItem(WEEKLY_KEY) || '{}'); } catch(e) { return {}; } }
  function saveWeekly(w) { try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(w)); } catch(e) {} }

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

  function syncPull(cb) {
    if (!syncEnabled()) { if (cb) cb(false); return; }
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: syncUrl(), headers: { 'Content-Type': 'application/json' },
        onload: function(res){
          var added = false;
          try {
            if (res.status >= 200 && res.status < 300 && res.responseText) {
              var data = JSON.parse(res.responseText);
              var remote = (data && data.names) ? data.names : {};
              var all = loadAllNames();
              for (var k in remote) {
                if (!all[k] && typeof remote[k] === 'string') { all[k] = remote[k]; added = true; }
              }
              if (added) { persistAllNames(); if (activeTab === 'names') renderNames(); }
            }
          } catch(e) {}
          if (cb) cb(added);
        },
        onerror: function(){ if (cb) cb(false); }
      });
    } catch(e) { if (cb) cb(false); }
  }
  var _syncPushTimer = null;
  function syncPush() {
    if (!syncEnabled()) return;
    if (_syncPushTimer) return;
    _syncPushTimer = setTimeout(function(){
      _syncPushTimer = null;
      try {
        var payload = JSON.stringify({ names: loadAllNames() });
        GM_xmlhttpRequest({
          method: 'POST', url: syncUrl(),
          headers: { 'Content-Type': 'application/json' },
          data: payload,
          onload: function(){}, onerror: function(){}
        });
      } catch(e) {}
    }, 2500);
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
    var w = loadWeekly();
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0,0,0,0);
    var changed = false;
    for (var dk of Object.keys(w)) { if (new Date(dk) < cutoff) { delete w[dk]; changed = true; } }
    if (changed) saveWeekly(w);
    return w;
  }

  function rollDailyIntoWeekly() {
    try {
      var sd = localStorage.getItem(DATE_KEY); if (!sd) return;
      var daily = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!Object.keys(daily).length) return;
      var w = loadWeekly(); if (!w[sd]) w[sd] = {};
      for (var a of Object.keys(daily)) {
        var d2 = daily[a];
        w[sd][a] = { totalPkgs: d2.totalPkgs, totalSec: d2.totalSec, runs: d2.runs,
          avgRate: d2.avgRate, totalMissing: d2.totalMissing||0, totalExpected: d2.totalExpected||0 };
      }
      saveWeekly(w);
    } catch(e) {}
  }

  function loadHistory() {
    try {
      var sd = localStorage.getItem(DATE_KEY);
      if (sd !== todayStr()) { rollDailyIntoWeekly(); localStorage.removeItem(STORAGE_KEY); localStorage.setItem(DATE_KEY, todayStr()); return {}; }
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function saveHistory(h) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); localStorage.setItem(DATE_KEY, todayStr()); } catch(e) {} }

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
        '<span id="cbt-title">\u23F1 Batcher Timers</span>' +
        '<div id="cbt-controls">' +
          '<span id="cbt-font-dec" title="Smaller text" style="font-size:20px;cursor:pointer;font-weight:700;">A\u2212</span>' +
          '<span id="cbt-font-inc" title="Larger text" style="font-size:20px;cursor:pointer;font-weight:700;">A+</span>' +
          '<span id="cbt-theme-btn" title="Toggle Dark/Light" style="font-size:22px;cursor:pointer;">🌙</span>' +
          '<span id="cbt-collapse-btn" title="Collapse/Expand" style="font-size:22px;cursor:pointer;">🔼</span>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-stats-bar" style="display:flex;justify-content:space-around;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 10px;border-bottom:1px solid #ddd;background:#fafafa;">' +
        '<div style="display:flex;align-items:center;justify-content:center;white-space:nowrap;">' +
          '<span style="font-size:22px;line-height:1;flex-shrink:0;">\uD83E\uDDBA</span>' +
          '<span id="cbt-label-batchers" style="font-size:26px;font-weight:700;color:#333;margin-left:5px;white-space:nowrap;">Batchers: <b id="cbt-stat-ip" style="color:#0066cc;">—</b></span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;white-space:nowrap;">' +
          '<span style="font-size:22px;line-height:1;flex-shrink:0;">\uD83D\uDCCA</span>' +
          '<span id="cbt-label-rec" style="font-size:26px;font-weight:700;color:#333;margin-left:5px;white-space:nowrap;">Recommended: <b id="cbt-stat-rec" style="color:#0066cc;">—</b>' +
          '<span id="cbt-stat-dot" style="display:inline-block;width:16px;height:16px;border-radius:50%;background:gray;box-shadow:0 0 6px gray;vertical-align:middle;margin-left:8px;"></span></b></span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;white-space:nowrap;">' +
          '<span style="font-size:22px;line-height:1;flex-shrink:0;">\uD83D\uDCE6</span>' +
          '<span id="cbt-label-remaining" style="font-size:26px;font-weight:700;color:#333;margin-left:5px;white-space:nowrap;">Remaining: <b id="cbt-stat-rem" style="color:#0066cc;">—</b></span>' +
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
          '<div id="cbt-live-search" style="padding:6px 4px 2px;text-align:center;display:flex;align-items:center;gap:6px;"><input id="cbt-live-search-input" style="flex:1;" type="text" placeholder="Search any associate..."/><button id="cbt-live-search-clear" style="font-size:16px;border:none;background:none;cursor:pointer;color:#888;padding:0 4px;">✕</button></div>' +
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
          '<div id="cbt-hist-search" style="display:flex;align-items:center;gap:6px;padding:6px 4px 2px;"><input id="cbt-hist-search-input" style="flex:1;" type="text" placeholder="Search associate..."/><button id="cbt-hist-search-clear" style="font-size:16px;border:none;background:none;cursor:pointer;color:#888;padding:0 4px;">✕</button></div>' +
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
          '<div id="cbt-weekly-search" style="display:flex;align-items:center;gap:6px;padding:6px 4px 2px;"><input id="cbt-search-input" style="flex:1;" type="text" placeholder="Search associate..."/><button id="cbt-weekly-search-clear" style="font-size:16px;border:none;background:none;cursor:pointer;color:#888;padding:0 4px;">✕</button></div>' +
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
          '<div id="cbt-names-search" style="display:flex;align-items:center;gap:6px;padding:6px 4px 2px;"><input id="cbt-names-search-input" style="flex:1;" type="text" placeholder="Search saved names..."/><button id="cbt-names-search-clear" style="font-size:16px;border:none;background:none;cursor:pointer;color:#888;padding:0 4px;">✕</button></div>' +
          '<div id="cbt-names-count" style="text-align:center;font-size:12px;color:#888;padding:2px 0 4px;"></div>' +
          '<table id="cbt-names-table"><thead><tr>' +
            '<th style="text-align:left;">Associate (saved permanently)</th>' +
          '</tr></thead><tbody id="cbt-names-tbody"></tbody></table>' +
          '<div id="cbt-names-empty" style="display:none;text-align:center;color:#aaa;padding:12px;font-size:13px;font-style:italic;">No names saved yet</div>' +
        '</div>' +
      '</div>' +
      '<div id="cbt-drag-bottom" title="Drag to resize"></div>';
    return panel2;
  }

  var _panel2Ref = null;

  function injectPanel() {
    if (document.getElementById('cbt-panel')) return;
    var utilEl = document.querySelector('utilization.dashboard-utilization');
    if (!utilEl) utilEl = document.querySelector('utilization');

    if (!_panel2Ref) {
      _panel2Ref = buildPanel();
      attachPanelEvents(_panel2Ref);
    }

    if (!utilEl) return;

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
    utilEl.parentNode.insertBefore(_panel2Ref, utilEl);
    renderLive();
    renderHistory();
    renderWeekly();
    renderNames();
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
      var text = el.textContent.replace(/^\d+\s*/, '').replace(/[●•]/g, '').trim();
      navigator.clipboard.writeText(text).then(function() {
        var prev = el.style.color;
        el.style.color = '#2a9d2a';
        setTimeout(function() { el.style.color = prev; }, 600);
      });
    });

    document.addEventListener('click', function(e) {
      var el = e.target.closest('.cbt-search-row-name');
      if (!el || !panel2.contains(el)) return;
      var text = el.textContent.trim();
      navigator.clipboard.writeText(text).then(function() {
        var prev = el.style.color;
        el.style.color = '#2a9d2a';
        setTimeout(function() { el.style.color = prev; }, 600);
      });
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
        var nm = nameCell.textContent.trim();
        navigator.clipboard.writeText(nm).then(function(){
          var prev = nameCell.style.color; nameCell.style.color = '#2a9d2a';
          setTimeout(function(){ nameCell.style.color = prev; }, 600);
        });
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

    var history = loadHistory(), histEntries = Object.values(history).filter(function(e){ return e.assoc.toLowerCase().indexOf(term) !== -1; });
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

    var weekly = pruneWeeklyOlderThan(WEEKLY_DAYS), agg = {};
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
    resultsEl.innerHTML = html;
  }

  function renderLive() {
    var tbody=document.querySelector('#cbt-tbody'), empty=document.querySelector('#cbt-empty');
    if (!tbody||!empty) return;
    var rows=[]; taskCache.forEach(function(d){
      if(d.state==='BATCHING') {
        if (!liveSearchTerm) { rows.push(d); return; }
        var name = (d.associateId||d.associate||d.driverAssignment||d.shortClientRef||'').toLowerCase();
        if (name.indexOf(liveSearchTerm.toLowerCase()) !== -1) rows.push(d);
      }
    });
    rows.sort(function(a,b){
      var ra=computeRow(a),rb=computeRow(b);
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
    if(rows.length===0){tbody.innerHTML='';empty.style.display='block';
      var body2=document.querySelector('#cbt-body');
      if(body2&&!body2.style.height){body2.style.height='350px';body2.style.maxHeight='350px';}
      return;}

    empty.style.display='none';
    var html='';
    for(var i=0;i<rows.length;i++){
      var data=rows[i],assoc=data.associateId||data.associate||data.driverAssignment||data.shortClientRef,shortRef=data.shortClientRef,r=computeRow(data);
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
    tbody.innerHTML=html;
    var upd=document.querySelector('#cbt-updated');
    if(upd) upd.textContent='updated '+new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }

  function renderHistory() {
    var tbody=document.querySelector('#cbt-hist-tbody'),empty=document.querySelector('#cbt-hist-empty'),summary=document.querySelector('#cbt-hist-summary');
    if(!tbody||!empty) return;
    var history=loadHistory(),entries=Object.values(history);
    if(entries.length===0){tbody.innerHTML='';empty.style.display='block';if(summary)summary.innerHTML='';
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
    tbody.innerHTML=html;

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
    var weekly = pruneWeeklyOlderThan(WEEKLY_DAYS), agg = {};
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
    var todayHist = loadHistory();
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
    crossEl.innerHTML=html;
  }

  function renderWeekly() {
    var tbody=document.querySelector('#cbt-weekly-tbody'),empty=document.querySelector('#cbt-weekly-empty'),summary=document.querySelector('#cbt-weekly-summary');
    if(!tbody||!empty) return;
    var weekly=pruneWeeklyOlderThan(WEEKLY_DAYS),agg={};
    for(var dayKey of Object.keys(weekly)){
      for(var assoc of Object.keys(weekly[dayKey])){
        var d3=weekly[dayKey][assoc];
        if(!agg[assoc])agg[assoc]={assoc:assoc,totalPkgs:0,totalSec:0,runs:0,totalMissing:0,totalExpected:0,daysSet:new Set()};
        agg[assoc].totalPkgs+=d3.totalPkgs;agg[assoc].totalSec+=d3.totalSec;agg[assoc].runs+=d3.runs;
        agg[assoc].totalMissing+=(d3.totalMissing||0);agg[assoc].totalExpected+=(d3.totalExpected||0);agg[assoc].daysSet.add(dayKey);
      }
    }
    var all=Object.values(agg).map(function(a){return{assoc:a.assoc,totalPkgs:a.totalPkgs,totalSec:a.totalSec,runs:a.runs,days:a.daysSet.size,avgRate:a.totalPkgs/(a.totalSec/60),hrs:a.totalSec,missPct:a.totalExpected>0?(a.totalMissing/a.totalExpected*100):0};});
    if(all.length===0){tbody.innerHTML='';empty.style.display='block';if(summary)summary.innerHTML='';
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
    tbody.innerHTML=html;

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

  function renderNames() {
    var tbody = document.getElementById('cbt-names-tbody');
    if (!tbody) return;
    scanLocalStorageForNames();
    syncNamesFromAllTabs();
    var all = loadAllNames();
    var totalCount = Object.keys(all).length;
    var names = Object.keys(all).map(function(k){ return all[k]; });
    names.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });

    var term = (namesSearchTerm||'').toLowerCase().trim();
    if (term) names = names.filter(function(n){ return n.toLowerCase().indexOf(term) !== -1; });

    var countEl = document.getElementById('cbt-names-count');
    if (countEl) countEl.textContent = term ? (names.length + ' of ' + totalCount + ' names') : (totalCount + ' names saved');

    var emptyEl = document.getElementById('cbt-names-empty');
    if (!names.length) {
      tbody.innerHTML = '';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = term ? 'No names match "' + namesSearchTerm + '"' : 'No names saved yet'; }
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    names.forEach(function(n){
      html += '<tr><td style="text-align:left;"><span class="cbt-name-cell">' + n + '</span></td></tr>';
    });
    tbody.innerHTML = html;
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
    crossEl.innerHTML=html;
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
        '<span id="cbt-tp-title">🔍 Search Associate</span>' +
        '<div id="cbt-tp-controls">' +
          '<span id="cbt-tp-font-dec" title="Smaller text">A−</span>' +
          '<span id="cbt-tp-font-inc" title="Larger text">A+</span>' +
          '<span id="cbt-tp-theme" title="Toggle Dark/Light" style="font-size:16px;cursor:pointer;">' + (isDark?'☀️':'🌙') + '</span>' +
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

    var weekly = pruneWeeklyOlderThan(WEEKLY_DAYS), agg = {};
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
    el.innerHTML = html;
  }

  function tpAttachEvents(tp) {
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
        var text = nameEl.textContent.trim();
        navigator.clipboard.writeText(text).then(function(){
          var prev = nameEl.style.color; nameEl.style.color = '#2a9d2a';
          setTimeout(function(){ nameEl.style.color = prev; }, 600);
        });
      }
    });
  }

  function injectTaskPanel() {
    if (document.getElementById('cbt-tp')) return;
    if (!document.querySelector('div.job-details')) return;

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

    _tpRef = buildTaskPanel();
    document.body.appendChild(_tpRef);
    tpAttachEvents(_tpRef);
  }

  var panelWatcher = new MutationObserver(function() {
    if (!document.getElementById('cbt-panel')) injectPanel();
    var isTaskPage = document.querySelector('div.job-details') !== null;
    if (isTaskPage && !document.getElementById('cbt-tp')) injectTaskPanel();
    if (!isTaskPage && document.getElementById('cbt-tp')) { document.getElementById('cbt-tp').remove(); _tpRef = null; }
  });

  function start() {
    document.head.appendChild(style);
    timerWatcher.observe(document.documentElement, { childList: true, subtree: true });
    injectAllTimers();
    setInterval(tickTimers, 1000);
    setInterval(injectAllTimers, 1000);
    fetchAndUpdate();
    panelWatcher.observe(document.documentElement, { childList: true, subtree: true });
    injectPanel();
    injectTaskPanel();
    pollActiveTasks();
    setInterval(pollActiveTasks, POLL_MS);
    setInterval(tickLive, TICK_MS);
    setInterval(fetchAndUpdate, 1000);
    syncNamesFromAllTabs();
    scanLocalStorageForNames();
    setInterval(function(){
      if (syncNamesFromAllTabs() && activeTab === 'names') renderNames();
    }, 5000);
    syncPull(function(){ syncPush(); });
    setInterval(function(){ syncPull(); }, 60000);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
