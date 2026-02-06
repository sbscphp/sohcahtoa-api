import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';

export interface ScalarConfig {
  title: string;
  description: string;
  version: string;
  serviceName: string;
  port: number;
  apiBasePath?: string;
}

export const setupScalar = async (app: Express, config: ScalarConfig): Promise<void> => {
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
          url: `http://localhost:${config.port}${config.apiBasePath || ''}`,
          description: 'Development server',
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
    apis: ['./src/routes/*.ts', './src/routes/*.js', './dist/routes/*.js', './src/index.ts', './dist/index.js'],
  };

  const swaggerSpec = swaggerJsdoc(options);

  // Dynamically import the ES Module
  const { apiReference } = await import('@scalar/express-api-reference');

  // Serve Scalar API documentation
  app.use(
    '/api-docs',
    apiReference({
      spec: {
        content: swaggerSpec,
      },
      theme: 'purple',
      layout: 'modern',
      darkMode: true,
      customCss: `
        .scalar-app {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
      `,
      metaData: {
        title: config.title,
        description: config.description,
      },
      searchHotKey: 'k',
      showSidebar: true,
    })
  );

  // Serve OpenAPI JSON spec
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📚 Scalar API documentation available at http://localhost:${config.port}/api-docs`);
};
