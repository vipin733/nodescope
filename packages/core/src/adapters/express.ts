import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { NodeScope } from '../nodescope.js';
import { getDashboardHtml } from '../dashboard/index.js';

declare module 'express' {
  interface Request {
    nodescope?: {
      batchId: string;
      startTime: number;
    };
  }
}

type ExpressApp = {
  use: (path: string | RequestHandler, ...handlers: RequestHandler[]) => void;
};

/**
 * Create Express middleware for NodeScope
 */
export function createExpressMiddleware(nodescope: NodeScope): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if disabled
    if (!nodescope.isEnabled) {
      return next();
    }

    // Skip if this is a NodeScope request
    const dashboardPath = nodescope.dashboardPath;
    if (req.path.startsWith(dashboardPath)) {
      return next();
    }

    // Create request context
    const ctx = nodescope.createContext();
    req.nodescope = ctx;

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
          path: req.path,
          query: req.query as Record<string, string | string[]>,
          headers: req.headers as Record<string, string>,
          body: req.body,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.get('user-agent'),
          session: (req as any).session,
          response: {
            status: res.statusCode,
            headers: res.getHeaders() as Record<string, string>,
            body: responseBody,
          },
        });

        if (entry) {
          await nodescope.recordEntry(entry);
        }
      } catch (error) {
        console.error('NodeScope error recording request:', error);
      }
    });

    next();
  };
}

/**
 * Mount all NodeScope routes on an Express app
 */
export async function mountExpressRoutes(
  app: ExpressApp,
  nodescope: NodeScope
): Promise<void> {
  const dashboardPath = nodescope.dashboardPath;

  // Middleware for tracking requests
  app.use(createExpressMiddleware(nodescope) as any);

  // Dashboard HTML
  app.use(dashboardPath, async (req: Request, res: Response, next: NextFunction) => {
    // Check authorization
    const authorized = await nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    if (req.path === '/' || req.path === '') {
      res.setHeader('Content-Type', 'text/html');
      res.send(getDashboardHtml(dashboardPath));
      return;
    }

    next();
  });

  // API routes
  app.use(`${dashboardPath}/api`, async (req: Request, res: Response) => {
    // Check authorization
    const authorized = await nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // req.path at this mount point is the subpath after /api (e.g., /stats, /entries)
    // We need to construct the full API path for the handler
    const apiPath = `/api${req.path}`;
    const response = await nodescope.api.handle({
      method: req.method,
      url: apiPath,
      query: req.query as Record<string, string>,
      body: req.body,
    });

    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
    }

    res.status(response.status).json(response.body);
  });
}

/**
 * Attach WebSocket handler to an HTTP server for real-time updates
 * Requires 'ws' package: npm install ws @types/ws
 */
export function attachWebSocket(
  server: import('http').Server,
  nodescope: NodeScope,
  options: { path?: string } = {}
): void {
  const wsPath = options.path ?? `${nodescope.dashboardPath}/ws`;

  // Dynamically import ws to avoid hard dependency
  import('ws').then(({ WebSocketServer }) => {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      
      if (url.pathname === wsPath) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Handle connection
          nodescope.realtime.handleConnection(ws as any);
          
          ws.on('close', () => {
            nodescope.realtime.handleDisconnection(ws as any);
          });
          
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === 'pong') {
                // Keep-alive response
              }
            } catch {
              // Invalid message, ignore
            }
          });
        });
      } else {
        socket.destroy();
      }
    });

    nodescope.realtime.startHeartbeat();
    console.log(`⚡ NodeScope WebSocket available at ws://localhost:PORT${wsPath}`);
  }).catch(() => {
    console.warn('NodeScope: ws package not installed, real-time updates disabled');
    console.warn('Install with: npm install ws');
  });
}
