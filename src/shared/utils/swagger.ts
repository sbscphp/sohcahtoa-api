import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  serviceName: string;
  port: number;
  apiBasePath?: string;
}

export const setupSwagger = async (app: Express, config: SwaggerConfig): Promise<void> => {
  // Find the project root by looking for package.json
  // This works regardless of whether we're running from src or dist
  let rootDir = __dirname;
  while (rootDir !== '/' && !require('fs').existsSync(path.join(rootDir, 'package.json'))) {
    rootDir = path.dirname(rootDir);
  }

  const isProduction = __dirname.includes('/dist/');

  // IMPORTANT: Always use TypeScript source files because compiled JS files lose JSDoc comments
  // swagger-jsdoc can read .ts files directly even in production
  const apiPaths = [
    // All module route files (main pattern)
    path.join(rootDir, 'src', 'modules', '*', 'routes', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', '*', 'routes', '*.ts'),

    // All module controller files (may contain JSDoc)
    path.join(rootDir, 'src', 'modules', '*', 'controllers', '*.ts'),
    path.join(rootDir, 'src', 'modules', '*', '*', 'controllers', '*.ts'),

    // Service files (some may have JSDoc)
    path.join(rootDir, 'src', 'modules', '*', 'services', '*.ts'),

    // Root level routes
    path.join(rootDir, 'src', 'routes', '*.ts'),

    // Main app files
    path.join(rootDir, 'src', 'app.ts'),
    path.join(rootDir, 'src', 'index.ts'),

    // Shared utilities that might have JSDoc
    path.join(rootDir, 'src', 'shared', 'middleware', '*.ts'),
  ];

  const options: swaggerJsdoc.Options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
        contact: {
          name: 'FX Platform API Support',
          email: 'support@fxplatform.com',
        },
      },
      servers: [
        {
          url: `https://sohcahtoa-dev.clocksurewise.com${config.apiBasePath || ''}`,
          description: 'Production server',
        },
        {
          url: `http://localhost:${config.port}${config.apiBasePath || ''}`,
          description: 'Local development',
        },
        {
          url: `http://${config.serviceName}:${config.port}${config.apiBasePath || ''}`,
          description: 'Docker network',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your JWT token',
          },
        },
        responses: {
          UnauthorizedError: {
            description: 'Access token is missing or invalid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Unauthorized' },
                  },
                },
              },
            },
          },
          ValidationError: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Validation failed' },
                    errors: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          NotFoundError: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Resource not found' },
                  },
                },
              },
            },
          },
          ServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Internal server error' },
                  },
                },
              },
            },
          },
        },
      },
      security: [],
    },
    apis: apiPaths,
  };

  console.log('🔍 Swagger scanning paths:', apiPaths);
  console.log('📁 Current directory:', __dirname);
  console.log('📁 Root directory:', rootDir);
  console.log('🏭 Is production:', isProduction);

  const swaggerSpec = swaggerJsdoc(options) as any;

  // Log the number of paths found
  const pathCount = Object.keys(swaggerSpec.paths || {}).length;
  console.log(`📚 Swagger generated ${pathCount} API endpoints`);

  if (pathCount === 0) {
    console.warn('⚠️  WARNING: No API endpoints found! Check the api paths configuration.');
    console.log('📂 Trying to list route files...');
    const glob = require('glob');
    apiPaths.forEach((pattern: string) => {
      const files = glob.sync(pattern);
      console.log(`   Pattern: ${pattern}`);
      console.log(`   Found ${files.length} files:`, files.slice(0, 5));
    });
  }

  // Mount swagger-ui-express
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: config.title,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css',
  }));

  // Serve OpenAPI JSON spec
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📚 Swagger UI available at http://localhost:${config.port}/api-docs`);
};

export default setupSwagger;
