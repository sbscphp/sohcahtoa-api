import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  serviceName: string;
  port: number;
  apiBasePath?: string;
}

export const setupSwagger = async (app: Express, config: SwaggerConfig): Promise<void> => {
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

  // Mount swagger-ui-express
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: config.title,
  }));

  // Serve OpenAPI JSON spec
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📚 Swagger UI available at http://localhost:${config.port}/api-docs`);
};

export default setupSwagger;
