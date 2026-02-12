import type {
  NestMiddleware,
  CallHandler,
  ExecutionContext,
  DynamicModule,
  Type,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { NodeScope } from '../nodescope.js';
import type { NodeScopeConfig } from '../types.js';
import { getDashboardHtml } from '../dashboard/index.js';

// Re-export these for users who need them
export type { NestMiddleware, CallHandler, ExecutionContext };

/**
 * NodeScope Middleware for NestJS
 * Tracks HTTP requests and responses
 * 
 * This middleware must be provided by NodeScopeModule to ensure proper DI
 */
export class NodeScopeMiddleware implements NestMiddleware {
  constructor(private readonly nodescope: NodeScope) {}

  async use(req: any, res: any, next: () => void): Promise<void> {
    // Capture nodescope reference for use in callbacks
    const nodescope = this.nodescope;
    
    // Skip if disabled
    if (!nodescope || !nodescope.isEnabled) {
      return next();
    }

    // Skip NodeScope dashboard paths
    const dashboardPath = nodescope.dashboardPath;
    if (req.path?.startsWith(dashboardPath)) {
      return next();
    }

    // Create request context
    const ctx = nodescope.createContext();
    (req as any).nodescope = ctx;

    // Capture response
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: unknown;

    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function (body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // When response finishes
    res.on('finish', async () => {
      if (!nodescope.requestWatcher.enabled) return;

      try {
        const entry = nodescope.requestWatcher.record({
          batchId: ctx.batchId,
          startTime: ctx.startTime,
          method: req.method,
          url: req.originalUrl || req.url,
          path: req.path || req.route?.path,
          query: req.query,
          headers: req.headers,
          body: req.body,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.get?.('user-agent'),
          session: req.session,
          response: {
            status: res.statusCode,
            headers: res.getHeaders?.() || {},
            body: responseBody,
          },
        });

        if (entry) {
          await nodescope.recordEntry(entry);
        }
      } catch (error) {
        // Silent fail - don't break the app
      }
    });

    next();
  }
}

/**
 * NodeScope Interceptor for NestJS
 * Alternative to middleware, provides more NestJS-native integration
 */
export class NodeScopeInterceptor {
  constructor(private readonly nodescope: NodeScope) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // Skip if disabled
    if (!this.nodescope.isEnabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    // Skip NodeScope paths
    const dashboardPath = this.nodescope.dashboardPath;
    if (request.path?.startsWith(dashboardPath)) {
      return next.handle();
    }

    // Create context
    const ctx = this.nodescope.createContext();
    request.nodescope = ctx;

    // Import tap operator
    const { tap } = await import('rxjs/operators');

    return next.handle().pipe(
      tap({
        next: async (data: any) => {
          if (!this.nodescope.requestWatcher.enabled) return;

          try {
            const entry = this.nodescope.requestWatcher.record({
              batchId: ctx.batchId,
              startTime: ctx.startTime,
              method: request.method,
              url: request.originalUrl || request.url,
              path: request.path || request.route?.path,
              query: request.query,
              headers: request.headers,
              body: request.body,
              ip: request.ip || request.socket?.remoteAddress,
              userAgent: request.get?.('user-agent'),
              session: request.session,
              response: {
                status: response.statusCode,
                headers: response.getHeaders?.() || {},
                body: data,
              },
            });

            if (entry) {
              await this.nodescope.recordEntry(entry);
            }
          } catch (error) {
            console.error('NodeScope error recording request:', error);
          }
        },
        error: async (error: any) => {
          if (!this.nodescope.exceptionWatcher.enabled) return;

          try {
            // Ensure we have an Error object
            const errorObj = error instanceof Error ? error : new Error(String(error));
            
            const entry = this.nodescope.exceptionWatcher.record({
              error: errorObj,
              context: {
                method: request.method,
                url: request.url,
                statusCode: error.status || 500,
              },
            });

            if (entry) {
              await this.nodescope.recordEntry(entry);
            }
          } catch (recordError) {
            console.error('NodeScope error recording exception:', recordError);
          }
        },
      })
    );
  }
}

/**
 * NodeScope Controller for NestJS
 * Serves the dashboard and API endpoints
 */
export class NodeScopeController {
  constructor(private readonly nodescope: NodeScope) {}

  async getDashboard(req: any, res: any): Promise<any> {
    const authorized = await this.nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(getDashboardHtml(this.nodescope.dashboardPath));
  }

  async handleApi(req: any, res: any): Promise<any> {
    const authorized = await this.nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Extract API path
    const apiPath = req.path.replace(this.nodescope.dashboardPath, '');
    
    const response = await this.nodescope.api.handle({
      method: req.method,
      url: apiPath,
      query: req.query,
      body: req.body,
    });

    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
    }

    res.status(response.status).json(response.body);
  }
}

/**
 * NodeScope Module for NestJS
 * Dynamic module that provides NodeScope functionality
 */
export class NodeScopeModule {
  /**
   * Create a dynamic NestJS module for NodeScope
   * 
   * @example
   * ```typescript
   * import { Module } from '@nestjs/common';
   * import { NodeScopeModule } from '@vipin733/nodescope';
   * 
   * @Module({
   *   imports: [
   *     NodeScopeModule.forRoot({
   *       storage: 'sqlite',
   *       dashboardPath: '/_debug',
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(config: NodeScopeConfig = {}): DynamicModule {
    const nodescope = new NodeScope(config);

    // Initialize on module creation
    nodescope.initialize().catch((err) => {
      console.error('Failed to initialize NodeScope:', err);
    });

    return {
      module: NodeScopeModule as Type<any>,
      providers: [
        {
          provide: 'NODESCOPE_INSTANCE',
          useValue: nodescope,
        },
        {
          provide: NodeScope,
          useValue: nodescope,
        },
        {
          provide: NodeScopeMiddleware,
          useFactory: () => new NodeScopeMiddleware(nodescope),
        },
        {
          provide: NodeScopeInterceptor,
          useFactory: () => new NodeScopeInterceptor(nodescope),
        },
        {
          provide: NodeScopeController,
          useFactory: () => new NodeScopeController(nodescope),
        },
      ],
      exports: ['NODESCOPE_INSTANCE', NodeScope, NodeScopeMiddleware, NodeScopeInterceptor],
      global: true,
    };
  }

  /**
   * Create an async dynamic module
   * Useful when you need to inject other services
   * 
   * @example
   * ```typescript
   * NodeScopeModule.forRootAsync({
   *   useFactory: (configService: ConfigService) => ({
   *     storage: configService.get('NODESCOPE_STORAGE'),
   *     dashboardPath: '/_debug',
   *     enabled: configService.get('NODE_ENV') === 'development',
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => NodeScopeConfig | Promise<NodeScopeConfig>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: NodeScopeModule as Type<any>,
      providers: [
        {
          provide: 'NODESCOPE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: 'NODESCOPE_INSTANCE',
          useFactory: async (config: NodeScopeConfig) => {
            const nodescope = new NodeScope(config);
            await nodescope.initialize();
            return nodescope;
          },
          inject: ['NODESCOPE_CONFIG'],
        },
        {
          provide: NodeScope,
          useFactory: async (config: NodeScopeConfig) => {
            const nodescope = new NodeScope(config);
            await nodescope.initialize();
            return nodescope;
          },
          inject: ['NODESCOPE_CONFIG'],
        },
        {
          provide: NodeScopeMiddleware,
          useFactory: (nodescope: NodeScope) => new NodeScopeMiddleware(nodescope),
          inject: ['NODESCOPE_INSTANCE'],
        },
        {
          provide: NodeScopeInterceptor,
          useFactory: (nodescope: NodeScope) => new NodeScopeInterceptor(nodescope),
          inject: ['NODESCOPE_INSTANCE'],
        },
        {
          provide: NodeScopeController,
          useFactory: (nodescope: NodeScope) => new NodeScopeController(nodescope),
          inject: ['NODESCOPE_INSTANCE'],
        },
      ],
      exports: ['NODESCOPE_INSTANCE', NodeScope, NodeScopeMiddleware, NodeScopeInterceptor],
      global: true,
    };
  }
}

/**
 * Helper function to configure NestJS routes for NodeScope dashboard
 * Use this in your main.ts to set up dashboard routes
 * 
 * @example
 * ```typescript
 * import { setupNodeScopeRoutes } from '@vipin733/nodescope';
 * 
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   
 *   // Get NodeScope instance from app
 *   const nodescope = app.get('NODESCOPE_INSTANCE');
 *   await setupNodeScopeRoutes(app, nodescope);
 *   
 *   await app.listen(3000);
 * }
 * ```
 */
export async function setupNodeScopeRoutes(app: any, nodescope: NodeScope): Promise<void> {
  const dashboardPath = nodescope.dashboardPath;
  const controller = new NodeScopeController(nodescope);

  // Register dashboard route
  app.getHttpAdapter().get(dashboardPath, (req: any, res: any) => {
    return controller.getDashboard(req, res);
  });

  // Register API routes
  app.getHttpAdapter().all(`${dashboardPath}/api/*`, (req: any, res: any) => {
    return controller.handleApi(req, res);
  });

  // Attach WebSocket for real-time updates
  const httpServer = app.getHttpServer();
  if (httpServer) {
    // Dynamically import ws to avoid hard dependency
    import('ws').then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ noServer: true });
      const wsPath = `${dashboardPath}/ws`;

      httpServer.on('upgrade', (request: any, socket: any, head: any) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        
        if (url.pathname === wsPath) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            // Handle connection
            nodescope.realtime.handleConnection(ws as any);
            
            ws.on('close', () => {
              nodescope.realtime.handleDisconnection(ws as any);
            });
          });
        }
      });

      console.log('[NodeScope] WebSocket server attached for real-time updates at', wsPath);
    }).catch(err => {
      console.warn('[NodeScope] WebSocket not available, real-time updates disabled:', err.message);
    });
  }
}
