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
  // Pass spec as a JSON string inside spec.content — Scalar parses it from textContent
  // of the script tag. Embedding avoids any fetch/TLS issue.
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
    :root {
      --scalar-color-accent: #DD4F05;
      --scalar-background-accent: rgba(221,79,5,0.08);
      --scalar-font: 'Inter', system-ui, sans-serif;
      --scalar-font-code: 'Menlo', 'Consolas', monospace;
    }
    .sidebar, [class*="sidebar"] {
      --scalar-sidebar-background-1: #0D1117;
      --scalar-sidebar-color-1: #C9D1D9;
      --scalar-sidebar-color-2: #6E7681;
      --scalar-sidebar-color-active-1: #FFFFFF;
      --scalar-sidebar-item-active-background: #161B22;
      --scalar-sidebar-item-hover-background: rgba(255,255,255,0.04);
      --scalar-sidebar-border-color: #21262D;
    }
  </style>
</head>
<body>
  <script>
    // Initialise Scalar with the spec embedded as a parsed object.
    // Runs after the Scalar script below loads.
    window.__SCALAR_CONFIG__ = {
      theme: 'alternate',
      darkMode: false,
      hideDownloadButton: false,
      persistAuth: true,
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
      spec: { content: ${specString} },
    };
  <\/script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"><\/script>
  <script>
    // Use the imperative API once Scalar has loaded.
    document.addEventListener('DOMContentLoaded', function () {
      if (window.Scalar && window.Scalar.createApiReference) {
        window.Scalar.createApiReference('#scalar-root', window.__SCALAR_CONFIG__);
      }
    });
  <\/script>
  <div id="scalar-root"></div>
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(buildCustomHtml(config, swaggerSpec));
  });

  console.log(`📚 API Docs available at http://localhost:${config.port}/api-docs`);
};

export default setupSwagger;
