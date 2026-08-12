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

function buildCustomHtml(config: SwaggerConfig, swaggerSpec: any): string {
  const specString = JSON.stringify(swaggerSpec).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${config.title} – API Reference</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }

    /* ── Shared ──────────────────────────────────────── */
    :root {
      --scalar-color-accent: #DD4F05;
      --scalar-background-accent: rgba(221,79,5,0.1);
      --scalar-font: 'Inter', system-ui, sans-serif;
      --scalar-font-code: 'Menlo', 'Consolas', monospace;
    }

    /* ── Hide Scalar branding ────────────────────────── */
    [href*="scalar.com"],
    a[href*="scalar.com"],
    [class*="powered-by"],
    [class*="poweredBy"],
    [class*="mcp-button"],
    [class*="mcpButton"],
    [class*="mcp_button"],
    [class*="generate-mcp"],
    [class*="generateMcp"],
    button[title*="MCP"],
    button[aria-label*="MCP"],
    button[aria-label*="mcp"],
    a[title*="MCP"],
    [class*="scalar-footer"],
    [class*="footer"] a[href*="scalar"] {
      display: none !important;
    }

    /* ── Light mode: white content, white sidebar, orange border ── */
    .light-mode {
      --scalar-color-1: #111111;
      --scalar-color-2: #444444;
      --scalar-color-3: #666666;
      --scalar-background-1: #FFFFFF;
      --scalar-background-2: #F5F5F5;
      --scalar-background-3: #EBEBEB;
      --scalar-border-color: #E0E0E0;

      --scalar-sidebar-background-1: #FFFFFF;
      --scalar-sidebar-color-1: #111111;
      --scalar-sidebar-color-2: #666666;
      --scalar-sidebar-color-active-1: #DD4F05;
      --scalar-sidebar-item-active-background: rgba(221,79,5,0.08);
      --scalar-sidebar-item-hover-background: rgba(221,79,5,0.05);
      --scalar-sidebar-border-color: #DD4F05;
      --scalar-sidebar-search-background: #F5F5F5;
      --scalar-sidebar-search-border-color: #DD4F05;
    }

    /* ── Dark mode: black content, black sidebar, orange border ── */
    .dark-mode {
      --scalar-color-1: #FFFFFF;
      --scalar-color-2: #C0C0C0;
      --scalar-color-3: #888888;
      --scalar-background-1: #000000;
      --scalar-background-2: #0D0D0D;
      --scalar-background-3: #1A1A1A;
      --scalar-border-color: #2A2A2A;

      --scalar-sidebar-background-1: #000000;
      --scalar-sidebar-color-1: #FFFFFF;
      --scalar-sidebar-color-2: #888888;
      --scalar-sidebar-color-active-1: #DD4F05;
      --scalar-sidebar-item-active-background: rgba(221,79,5,0.12);
      --scalar-sidebar-item-hover-background: rgba(221,79,5,0.08);
      --scalar-sidebar-border-color: #DD4F05;
      --scalar-sidebar-search-background: #0D0D0D;
      --scalar-sidebar-search-border-color: #DD4F05;
    }
  </style>
</head>
<body>
  <script>
    window.__SCALAR_CONFIG__ = {
      theme: 'default',
      darkMode: false,
      hideDownloadButton: false,
      persistAuth: true,
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
      spec: { content: ${specString} },
    };
  <\/script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"><\/script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (window.Scalar && window.Scalar.createApiReference) {
        window.Scalar.createApiReference('#scalar-root', window.__SCALAR_CONFIG__);
      }
    });
  <\/script>
  <div id="scalar-root"></div>

  <!-- Logo pinned to bottom of sidebar — covers the Generate MCP link -->
  <div id="sct-sidebar-logo" style="
    position: fixed;
    bottom: 0;
    left: 0;
    width: var(--sct-sidebar-w, 320px);
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    pointer-events: all;
    background: #ffffff;
    border-top: 2px solid #DD4F05;
  ">
    <img
      src="${process.env.APP_URL ? `${process.env.APP_URL}email/logo.png` : ''}"
      alt="SohCahToa"
      style="height: 52px; width: auto; display: block; object-fit: contain;"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
    />
    <span style="
      display: none;
      font-family: Inter, system-ui, sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #DD4F05;
      letter-spacing: -0.3px;
    ">SohCahToa</span>
  </div>

  <script>
    (function() {
      function syncSidebarWidth() {
        var sidebar = document.querySelector('.sidebar')
          || document.querySelector('[class*="sidebar"]')
          || document.querySelector('[class*="t-doc__sidebar"]');
        if (!sidebar) return;
        var w = sidebar.getBoundingClientRect().width;
        if (w > 0) document.documentElement.style.setProperty('--sct-sidebar-w', w + 'px');
      }
      var resizeObs = new ResizeObserver(syncSidebarWidth);
      var mutObs = new MutationObserver(function() {
        var sidebar = document.querySelector('.sidebar')
          || document.querySelector('[class*="sidebar"]')
          || document.querySelector('[class*="t-doc__sidebar"]');
        if (sidebar) { resizeObs.observe(sidebar); syncSidebarWidth(); }
      });
      mutObs.observe(document.body, { childList: true, subtree: true });
      [200, 600, 1500].forEach(function(t) { setTimeout(syncSidebarWidth, t); });
    })();
  <\/script>

  <script>
    (function() {
      function hideScalarBranding() {
        var patterns = [/^powered by scalar$/i, /^generate mcp$/i];
        document.querySelectorAll('a, button, li').forEach(function(el) {
          var text = (el.textContent || '').trim();
          if (patterns.some(function(r) { return r.test(text); })) {
            var target = (el.tagName === 'LI' ? el : el.closest('li')) || el;
            (target as HTMLElement).style.setProperty('display', 'none', 'important');
          }
        });
      }
      var observer = new MutationObserver(hideScalarBranding);
      observer.observe(document.body, { childList: true, subtree: true });
      [500, 1500, 3000].forEach(function(t) { setTimeout(hideScalarBranding, t); });
    })();
  <\/script>
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
        { url: `http://localhost:${config.port}${config.apiBasePath || ''}`, description: 'Local development' },
        { url: `https://sohcahtoa-dev.clocksurewise.com${config.apiBasePath || ''}`, description: 'Production' },
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(buildCustomHtml(config, swaggerSpec));
  });

  console.log(`📚 API Docs available at http://localhost:${config.port}/api-docs`);
};

export default setupSwagger;
