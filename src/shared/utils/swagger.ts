import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  serviceName: string;
  port: number;
  apiBasePath?: string;
}

function buildCustomHtml(specUrl: string, config: SwaggerConfig): string {
  const logoUrl = process.env.APP_URL ? `${process.env.APP_URL}/email/logo.png` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.title} – API Reference</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --orange:        #DD4F05;
      --orange-hover:  #B83E04;
      --orange-light:  rgba(221,79,5,.1);
      --sidebar-bg:    #0D1117;
      --sidebar-hover: #161B22;
      --sidebar-border:#21262D;
      --sidebar-text:  #C9D1D9;
      --sidebar-muted: #6E7681;
      --sidebar-w:     280px;
      --content-bg:    #FFFFFF;
      --border:        #E5E7EB;
      --text:          #111827;
      --text-muted:    #6B7280;
      --radius:        6px;
      --font:          'Inter', system-ui, -apple-system, sans-serif;
    }

    html, body { height: 100%; font-family: var(--font); background: var(--content-bg); color: var(--text); font-size: 14px; overflow: hidden; }

    /* ── Layout ───────────────────────────────────────────── */
    .layout { display: flex; height: 100vh; }

    /* ── Sidebar ──────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      background: var(--sidebar-bg);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      border-right: 1px solid var(--sidebar-border);
      position: fixed;
      left: 0; top: 0; bottom: 0;
      z-index: 100;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--sidebar-border);
      text-decoration: none;
      flex-shrink: 0;
    }

    .sidebar-logo img { height: 32px; width: auto; display: block; }
    .sidebar-logo-text { font-size: 16px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px; }

    .sidebar-version {
      font-size: 10px;
      font-weight: 600;
      background: var(--orange);
      color: #fff;
      border-radius: 3px;
      padding: 1px 5px;
      margin-left: auto;
      flex-shrink: 0;
    }

    /* Search */
    .sidebar-search {
      padding: 12px 12px 8px;
      flex-shrink: 0;
    }

    .sidebar-search input {
      width: 100%;
      background: #161B22;
      border: 1px solid var(--sidebar-border);
      border-radius: var(--radius);
      color: var(--sidebar-text);
      font-family: var(--font);
      font-size: 13px;
      padding: 7px 10px 7px 30px;
      outline: none;
      transition: border-color .15s;
    }

    .sidebar-search input::placeholder { color: var(--sidebar-muted); }
    .sidebar-search input:focus { border-color: var(--orange); }

    .sidebar-search-wrap {
      position: relative;
    }

    .sidebar-search-icon {
      position: absolute;
      left: 9px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--sidebar-muted);
      pointer-events: none;
    }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0 24px;
    }

    .sidebar-nav::-webkit-scrollbar { width: 4px; }
    .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: var(--sidebar-border); border-radius: 2px; }

    .nav-section { margin-bottom: 2px; }

    .nav-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px 4px;
      cursor: pointer;
      user-select: none;
    }

    .nav-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--sidebar-muted);
    }

    .nav-section-chevron {
      color: var(--sidebar-muted);
      transition: transform .2s;
      flex-shrink: 0;
    }

    .nav-section.collapsed .nav-section-chevron { transform: rotate(-90deg); }
    .nav-section.collapsed .nav-endpoints { display: none; }

    .nav-endpoints { padding: 0; }

    .nav-endpoint {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 16px 5px 20px;
      cursor: pointer;
      text-decoration: none;
      border-radius: 0;
      transition: background .1s;
      border-left: 2px solid transparent;
    }

    .nav-endpoint:hover { background: var(--sidebar-hover); }
    .nav-endpoint.active { background: var(--sidebar-hover); border-left-color: var(--orange); }

    .method-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .5px;
      border-radius: 3px;
      padding: 2px 5px;
      min-width: 36px;
      text-align: center;
      flex-shrink: 0;
      font-family: 'Menlo', monospace;
    }

    .method-get    { background: #0C4A6E; color: #38BDF8; }
    .method-post   { background: #14532D; color: #4ADE80; }
    .method-put    { background: #3B0764; color: #C084FC; }
    .method-patch  { background: #451A03; color: #FB923C; }
    .method-delete { background: #450A0A; color: #F87171; }

    .nav-endpoint-path {
      font-size: 12px;
      color: var(--sidebar-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: 'Menlo', 'Consolas', monospace;
    }

    /* Auth button */
    .sidebar-auth {
      padding: 12px;
      border-top: 1px solid var(--sidebar-border);
      flex-shrink: 0;
    }

    .btn-auth {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      background: var(--orange);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font);
      cursor: pointer;
      transition: background .15s;
    }

    .btn-auth:hover { background: var(--orange-hover); }

    /* ── Main content ─────────────────────────────────────── */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* Top bar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      height: 52px;
      border-bottom: 1px solid var(--border);
      background: var(--content-bg);
      flex-shrink: 0;
      gap: 16px;
    }

    .topbar-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .topbar-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-muted);
      background: #F9FAFB;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 3px 10px;
    }

    .topbar-pill-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #16A34A;
    }

    .topbar-link {
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .topbar-link:hover { color: var(--orange); }

    /* Content scroll area */
    .content {
      flex: 1;
      overflow-y: auto;
      background: #F9FAFB;
    }

    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-track { background: transparent; }
    .content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* ── Swagger UI Overrides ─────────────────────────────── */
    #swagger-ui .swagger-ui {
      font-family: var(--font) !important;
    }

    #swagger-ui .swagger-ui .topbar,
    #swagger-ui .swagger-ui .information-container { display: none !important; }

    #swagger-ui .swagger-ui .scheme-container {
      background: var(--content-bg) !important;
      box-shadow: none !important;
      border-bottom: 1px solid var(--border) !important;
      padding: 10px 24px !important;
      margin: 0 !important;
    }

    #swagger-ui .swagger-ui .servers > label {
      font-family: var(--font) !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      color: var(--text-muted) !important;
    }

    #swagger-ui .swagger-ui .servers > label select {
      font-family: var(--font) !important;
      font-size: 13px !important;
      border: 1px solid var(--border) !important;
      border-radius: var(--radius) !important;
      padding: 5px 10px !important;
      background: var(--content-bg) !important;
      color: var(--text) !important;
    }

    #swagger-ui .swagger-ui .auth-wrapper .authorize {
      background: var(--orange) !important;
      border-color: var(--orange) !important;
      color: #fff !important;
      border-radius: var(--radius) !important;
      font-family: var(--font) !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      padding: 7px 16px !important;
    }
    #swagger-ui .swagger-ui .auth-wrapper .authorize:hover { background: var(--orange-hover) !important; border-color: var(--orange-hover) !important; }
    #swagger-ui .swagger-ui .auth-wrapper .authorize svg { fill: #fff !important; }

    /* Wrapper padding */
    #swagger-ui .swagger-ui .wrapper { padding: 0 24px 32px !important; max-width: 100% !important; }

    /* Tag headings */
    #swagger-ui .swagger-ui .opblock-tag {
      font-family: var(--font) !important;
      font-size: 17px !important;
      font-weight: 700 !important;
      color: var(--text) !important;
      border-bottom: 2px solid var(--border) !important;
      padding: 28px 0 10px !important;
      margin: 0 !important;
    }
    #swagger-ui .swagger-ui .opblock-tag:hover { background: transparent !important; }
    #swagger-ui .swagger-ui .opblock-tag small {
      font-size: 12px !important;
      font-weight: 400 !important;
      color: var(--text-muted) !important;
      margin-left: 8px !important;
    }

    /* Endpoint blocks */
    #swagger-ui .swagger-ui .opblock {
      border-radius: var(--radius) !important;
      border: 1px solid var(--border) !important;
      box-shadow: none !important;
      margin: 6px 0 !important;
    }

    #swagger-ui .swagger-ui .opblock .opblock-summary {
      padding: 10px 14px !important;
      border: none !important;
    }

    #swagger-ui .swagger-ui .opblock .opblock-summary-method {
      font-family: 'Menlo', 'Consolas', monospace !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      border-radius: 4px !important;
      min-width: 58px !important;
      text-align: center !important;
      padding: 3px 6px !important;
    }

    #swagger-ui .swagger-ui .opblock .opblock-summary-path {
      font-family: 'Menlo', 'Consolas', monospace !important;
      font-size: 13px !important;
      color: var(--text) !important;
      font-weight: 500 !important;
    }

    #swagger-ui .swagger-ui .opblock .opblock-summary-description {
      font-family: var(--font) !important;
      font-size: 12px !important;
      color: var(--text-muted) !important;
    }

    #swagger-ui .swagger-ui .opblock.opblock-get    { border-left: 3px solid #0EA5E9 !important; background: #F0F9FF !important; }
    #swagger-ui .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0EA5E9 !important; color: #fff !important; }
    #swagger-ui .swagger-ui .opblock.opblock-get .opblock-summary { background: transparent !important; }

    #swagger-ui .swagger-ui .opblock.opblock-post   { border-left: 3px solid #16A34A !important; background: #F0FDF4 !important; }
    #swagger-ui .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #16A34A !important; color: #fff !important; }
    #swagger-ui .swagger-ui .opblock.opblock-post .opblock-summary { background: transparent !important; }

    #swagger-ui .swagger-ui .opblock.opblock-put    { border-left: 3px solid #9333EA !important; background: #FAF5FF !important; }
    #swagger-ui .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #9333EA !important; color: #fff !important; }
    #swagger-ui .swagger-ui .opblock.opblock-put .opblock-summary { background: transparent !important; }

    #swagger-ui .swagger-ui .opblock.opblock-patch  { border-left: 3px solid var(--orange) !important; background: #FFF7F4 !important; }
    #swagger-ui .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: var(--orange) !important; color: #fff !important; }
    #swagger-ui .swagger-ui .opblock.opblock-patch .opblock-summary { background: transparent !important; }

    #swagger-ui .swagger-ui .opblock.opblock-delete { border-left: 3px solid #DC2626 !important; background: #FFF1F2 !important; }
    #swagger-ui .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #DC2626 !important; color: #fff !important; }
    #swagger-ui .swagger-ui .opblock.opblock-delete .opblock-summary { background: transparent !important; }

    #swagger-ui .swagger-ui .opblock-body { background: #fff !important; border-top: 1px solid var(--border) !important; }

    #swagger-ui .swagger-ui .try-out__btn {
      background: transparent !important;
      border: 1px solid var(--orange) !important;
      color: var(--orange) !important;
      font-family: var(--font) !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      border-radius: var(--radius) !important;
      padding: 5px 12px !important;
    }
    #swagger-ui .swagger-ui .try-out__btn:hover { background: var(--orange-light) !important; }
    #swagger-ui .swagger-ui .try-out__btn.cancel { border-color: #DC2626 !important; color: #DC2626 !important; }

    #swagger-ui .swagger-ui .btn.execute {
      background: var(--orange) !important;
      border-color: var(--orange) !important;
      color: #fff !important;
      font-family: var(--font) !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      border-radius: var(--radius) !important;
      padding: 8px 20px !important;
    }
    #swagger-ui .swagger-ui .btn.execute:hover { background: var(--orange-hover) !important; }

    #swagger-ui .swagger-ui .btn { font-family: var(--font) !important; border-radius: var(--radius) !important; }

    #swagger-ui .swagger-ui .highlight-code,
    #swagger-ui .swagger-ui .microlight {
      font-family: 'Menlo','Consolas', monospace !important;
      font-size: 12px !important;
      line-height: 1.6 !important;
      background: #1E293B !important;
      border-radius: var(--radius) !important;
    }

    #swagger-ui .swagger-ui input[type="text"],
    #swagger-ui .swagger-ui input[type="password"],
    #swagger-ui .swagger-ui textarea,
    #swagger-ui .swagger-ui select {
      font-family: var(--font) !important;
      font-size: 13px !important;
      border: 1px solid var(--border) !important;
      border-radius: var(--radius) !important;
      padding: 7px 10px !important;
    }

    #swagger-ui .swagger-ui input[type="text"]:focus,
    #swagger-ui .swagger-ui input[type="password"]:focus,
    #swagger-ui .swagger-ui textarea:focus {
      outline: none !important;
      border-color: var(--orange) !important;
      box-shadow: 0 0 0 3px rgba(221,79,5,.1) !important;
    }

    #swagger-ui .swagger-ui label {
      font-family: var(--font) !important;
      font-size: 13px !important;
      font-weight: 500 !important;
    }

    #swagger-ui .swagger-ui table tbody tr td {
      font-family: var(--font) !important;
      font-size: 13px !important;
    }

    #swagger-ui .swagger-ui .filter-container {
      padding: 10px 24px !important;
      background: #F9FAFB !important;
      border-bottom: 1px solid var(--border) !important;
    }

    #swagger-ui .swagger-ui .filter-container .operation-filter-input {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius) !important;
      font-family: var(--font) !important;
      font-size: 13px !important;
      padding: 7px 12px !important;
      width: 100% !important;
    }

    #swagger-ui .swagger-ui section.models {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius) !important;
      margin: 16px 0 !important;
    }

    #swagger-ui .swagger-ui .dialog-ux .modal-ux {
      border: 1px solid var(--border) !important;
      border-radius: 10px !important;
      box-shadow: 0 20px 60px rgba(0,0,0,.15) !important;
      font-family: var(--font) !important;
    }

    #swagger-ui .swagger-ui .dialog-ux .modal-ux-header {
      background: var(--content-bg) !important;
      border-bottom: 1px solid var(--border) !important;
      border-radius: 10px 10px 0 0 !important;
      padding: 16px 20px !important;
    }

    #swagger-ui .swagger-ui .dialog-ux .modal-ux-header h3 {
      font-family: var(--font) !important;
      font-size: 15px !important;
      font-weight: 600 !important;
    }

    #swagger-ui .swagger-ui .btn.modal-btn.auth {
      background: var(--orange) !important;
      border-color: var(--orange) !important;
      color: #fff !important;
      border-radius: var(--radius) !important;
      font-family: var(--font) !important;
    }

    /* ── Mobile ───────────────────────────────────────────── */
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; }
    }
  </style>
</head>
<body>
<div class="layout">

  <!-- ── Sidebar ─────────────────────────────────────────── -->
  <aside class="sidebar">
    <a class="sidebar-logo" href="/" id="logo-link">
      ${logoUrl
        ? `<img src="${logoUrl}" alt="SohCahToa" id="nav-logo-img" /><span id="nav-logo-text" style="display:none" class="sidebar-logo-text">SohCahToa</span>`
        : `<span class="sidebar-logo-text">SohCahToa</span>`}
      <span class="sidebar-version">v${config.version}</span>
    </a>

    <div class="sidebar-search">
      <div class="sidebar-search-wrap">
        <svg class="sidebar-search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="sidebar-search" placeholder="Search endpoints…" autocomplete="off" />
      </div>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      <div style="padding:16px;color:#6E7681;font-size:12px;">Loading API…</div>
    </nav>

    <div class="sidebar-auth">
      <button class="btn-auth" id="sidebar-auth-btn">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        Authorize
      </button>
    </div>
  </aside>

  <!-- ── Main ───────────────────────────────────────────── -->
  <div class="main">
    <div class="topbar">
      <span class="topbar-title">API Reference</span>
      <div class="topbar-right">
        <span class="topbar-pill" id="endpoint-count-pill">
          <span class="topbar-pill-dot"></span>
          <span id="endpoint-count">—</span> endpoints
        </span>
        <a class="topbar-link" href="/api-docs.json" target="_blank">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          OpenAPI JSON
        </a>
      </div>
    </div>

    <div class="content">
      <div id="swagger-ui"></div>
    </div>
  </div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-bundle.min.js"></script>
<script>
window.onload = function() {

  // Logo fallback
  var logoImg = document.getElementById('nav-logo-img');
  if (logoImg) {
    logoImg.addEventListener('error', function() {
      logoImg.style.display = 'none';
      var t = document.getElementById('nav-logo-text');
      if (t) t.style.display = 'block';
    });
  }

  // ── Sidebar auth button wires to swagger authorize button
  document.getElementById('sidebar-auth-btn').addEventListener('click', function() {
    var btn = document.querySelector('#swagger-ui .authorize');
    if (btn) btn.click();
  });

  // ── Build sidebar from spec ──────────────────────────────
  function buildSidebar(spec) {
    var paths = spec.paths || {};
    // Group by first tag
    var groups = {};
    Object.entries(paths).forEach(function(entry) {
      var p = entry[0], methods = entry[1];
      Object.entries(methods).forEach(function(me) {
        var method = me[0], op = me[1];
        if (!['get','post','put','patch','delete'].includes(method)) return;
        var tag = (op.tags && op.tags[0]) || 'Other';
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push({ method: method, path: p, summary: op.summary || '' });
      });
    });

    var total = Object.values(groups).reduce(function(a, g) { return a + g.length; }, 0);
    document.getElementById('endpoint-count').textContent = total;

    var nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';

    Object.keys(groups).sort().forEach(function(tag) {
      var endpoints = groups[tag];
      var section = document.createElement('div');
      section.className = 'nav-section';
      section.dataset.tag = tag;

      var header = document.createElement('div');
      header.className = 'nav-section-header';
      header.innerHTML =
        '<span class="nav-section-title">' + tag + '</span>' +
        '<svg class="nav-section-chevron" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>';
      header.addEventListener('click', function() {
        section.classList.toggle('collapsed');
      });

      var list = document.createElement('div');
      list.className = 'nav-endpoints';

      endpoints.forEach(function(ep) {
        var a = document.createElement('a');
        a.className = 'nav-endpoint';
        a.href = '#';
        a.dataset.tag = tag;
        a.dataset.path = ep.path;
        a.dataset.method = ep.method;

        var badge = document.createElement('span');
        badge.className = 'method-badge method-' + ep.method;
        badge.textContent = ep.method.toUpperCase();

        var pathSpan = document.createElement('span');
        pathSpan.className = 'nav-endpoint-path';
        pathSpan.textContent = ep.path;
        pathSpan.title = ep.path;

        a.appendChild(badge);
        a.appendChild(pathSpan);

        a.addEventListener('click', function(e) {
          e.preventDefault();
          // Mark active
          document.querySelectorAll('.nav-endpoint').forEach(function(el) { el.classList.remove('active'); });
          a.classList.add('active');
          // Scroll swagger UI to this tag section
          scrollToTag(tag);
        });

        list.appendChild(a);
      });

      section.appendChild(header);
      section.appendChild(list);
      nav.appendChild(section);
    });

    // Search filter
    document.getElementById('sidebar-search').addEventListener('input', function() {
      var q = this.value.toLowerCase();
      document.querySelectorAll('.nav-endpoint').forEach(function(el) {
        var txt = (el.dataset.path + ' ' + el.dataset.method).toLowerCase();
        el.style.display = txt.includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.nav-section').forEach(function(sec) {
        var visible = Array.from(sec.querySelectorAll('.nav-endpoint')).some(function(el) {
          return el.style.display !== 'none';
        });
        sec.style.display = visible ? '' : 'none';
      });
    });
  }

  function scrollToTag(tag) {
    // Swagger renders tag headings as <h3> inside .opblock-tag elements
    var headings = document.querySelectorAll('#swagger-ui .opblock-tag');
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      var tagText = h.getAttribute('data-tag') || h.querySelector('span') && h.querySelector('span').textContent;
      if (!tagText) {
        var a = h.querySelector('a');
        if (a) tagText = a.textContent;
      }
      if (tagText && tagText.trim().toLowerCase() === tag.toLowerCase()) {
        // Expand section if collapsed
        var section = h.closest('.opblock-tag-section');
        if (section) {
          var isCollapsed = section.classList.contains('is-open') === false;
          if (isCollapsed) h.click();
        }
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  // ── Init Swagger UI ──────────────────────────────────────
  SwaggerUIBundle({
    url: '${specUrl}',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: 'BaseLayout',
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: false,
    docExpansion: 'none',
    filter: false,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    defaultModelsExpandDepth: -1,
    syntaxHighlight: { activated: true, theme: 'agate' },
    onComplete: function() {
      // Build sidebar from fetched spec
      fetch('${specUrl}')
        .then(function(r) { return r.json(); })
        .then(function(spec) { buildSidebar(spec); })
        .catch(function(e) { console.error('Spec fetch failed', e); });
    },
  });
};
</script>
</body>
</html>`;
}

export const setupSwagger = async (app: Express, config: SwaggerConfig): Promise<void> => {
  let rootDir = __dirname;
  while (rootDir !== '/' && !require('fs').existsSync(path.join(rootDir, 'package.json'))) {
    rootDir = path.dirname(rootDir);
  }

  const apiPaths = [
    path.join(rootDir, 'src', 'modules', '*', 'routes', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', '*', 'routes', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', 'controllers', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', '*', 'controllers', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', 'services', '*.ts'),
    path.join(rootDir, 'src', 'routes', '*.ts'),
    path.join(rootDir, 'src', 'app.ts'),
    path.join(rootDir, 'src', 'index.ts'),
    path.join(rootDir, 'src', 'shared', 'middleware', '*.ts'),
  ];

  const options: swaggerJsdoc.Options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
        contact: { name: 'SohCahToa API Support', email: 'support@sohcahtoa.com' },
      },
      servers: [
        { url: `https://sohcahtoa-dev.clocksurewise.com${config.apiBasePath || ''}`, description: 'Production' },
        { url: `http://localhost:${config.port}${config.apiBasePath || ''}`, description: 'Local development' },
        { url: `http://${config.serviceName}:${config.port}${config.apiBasePath || ''}`, description: 'Docker network' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter your JWT token' },
        },
        responses: {
          UnauthorizedError: { description: 'Access token is missing or invalid', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Unauthorized' } } } } } },
          ValidationError: { description: 'Validation error', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Validation failed' }, errors: { type: 'array', items: { type: 'string' } } } } } } },
          NotFoundError: { description: 'Resource not found', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Resource not found' } } } } } },
          ServerError: { description: 'Internal server error', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Internal server error' } } } } } },
        },
      },
      security: [],
    },
    apis: apiPaths,
  };

  const swaggerSpec = swaggerJsdoc(options) as any;
  const pathCount = Object.keys(swaggerSpec.paths || {}).length;
  console.log(`📚 Swagger generated ${pathCount} API endpoints`);

  if (pathCount === 0) {
    console.warn('⚠️  No API endpoints found!');
    const glob = require('glob');
    apiPaths.forEach((pattern: string) => {
      console.log(`   ${pattern} — ${glob.sync(pattern).length} files`);
    });
  }

  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.get('/api-docs', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(buildCustomHtml('/api-docs.json', config));
  });

  console.log(`📚 API Docs available at http://localhost:${config.port}/api-docs`);
};

export default setupSwagger;
