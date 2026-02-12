import type { Context, MiddlewareHandler, Hono } from 'hono';
import { NodeScope } from '../nodescope.js';
import type { HttpMethod } from '../types.js';
import { getDashboardHtml } from '../dashboard/index.js';

declare module 'hono' {
  interface ContextVariableMap {
    nodescope: {
      batchId: string;
      startTime: number;
    };
  }
}

/**
 * Create Hono middleware for NodeScope
 */
export function createHonoMiddleware(nodescope: NodeScope): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    // Skip if disabled
    if (!nodescope.isEnabled) {
      return next();
    }

    // Skip NodeScope paths
    const dashboardPath = nodescope.dashboardPath;
    if (c.req.path.startsWith(dashboardPath)) {
      return next();
    }

    // Create context
    const ctx = nodescope.createContext();
    c.set('nodescope', ctx);

    const startTime = ctx.startTime;

    // Execute request
    await next();

    // Record after response
    if (!nodescope.requestWatcher.enabled) return;

    try {
      // Get response body (need to clone for reading)
      let responseBody: unknown;
      const response = c.res;
      
      // Try to get body from response
      if (response.headers.get('content-type')?.includes('application/json')) {
        try {
          responseBody = await response.clone().json();
        } catch {
          responseBody = undefined;
        }
      }

      const entry = nodescope.requestWatcher.record({
        batchId: ctx.batchId,
        startTime,
        method: c.req.method,
        url: c.req.url,
        path: c.req.path,
        query: Object.fromEntries(new URL(c.req.url).searchParams),
        headers: Object.fromEntries(c.req.raw.headers),
        body: await getRequestBody(c),
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        response: {
          status: c.res.status,
          headers: Object.fromEntries(c.res.headers),
          body: responseBody,
        },
      });

      if (entry) {
        await nodescope.recordEntry(entry);
      }
    } catch (error) {
      console.error('NodeScope error recording request:', error);
    }
  };
}

async function getRequestBody(c: Context): Promise<unknown> {
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      return await c.req.json();
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return await c.req.parseBody();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Create Hono routes for NodeScope dashboard
 */
export function createHonoDashboardRoutes(nodescope: NodeScope): Hono {
  // We need to dynamically import Hono to avoid hard dependency
  const createRoutes = async (): Promise<any> => {
    const { Hono } = await import('hono');
    const app = new Hono();
    const dashboardPath = nodescope.dashboardPath;

    // Dashboard HTML
    app.get('/', async (c) => {
      const authorized = await nodescope.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      return c.html(getDashboardHtml(dashboardPath));
    });

    // API routes
    app.all('/api/*', async (c) => {
      const authorized = await nodescope.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      const response = await nodescope.api.handle({
        method: c.req.method,
        url: c.req.url,
        query: Object.fromEntries(new URL(c.req.url).searchParams) as Record<string, string>,
        body: c.req.method !== 'GET' ? await c.req.json().catch(() => undefined) : undefined,
      });

      return c.json(response.body, response.status as any);
    });

    return app;
  };

  // Return a placeholder that will be resolved
  return createRoutes() as unknown as Hono;
}

/**
 * Create a simple Hono middleware that sets up everything
 */
export function nodescope(config: import('../types.js').NodeScopeConfig = {}): MiddlewareHandler {
  const ns = new NodeScope(config);
  let initialized = false;

  return async (c: Context, next: () => Promise<void>) => {
    // Initialize on first request
    if (!initialized) {
      await ns.initialize();
      initialized = true;
    }

    // Handle dashboard routes
    const dashboardPath = ns.dashboardPath;
    if (c.req.path.startsWith(dashboardPath)) {
      const authorized = await ns.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      const subPath = c.req.path.slice(dashboardPath.length) || '/';

      if (subPath === '/' || subPath === '') {
        return c.html(getDashboardHtml(dashboardPath));
      }

      if (subPath.startsWith('/api')) {
        const response = await ns.api.handle({
          method: c.req.method,
          url: c.req.url,
          query: Object.fromEntries(new URL(c.req.url).searchParams) as Record<string, string>,
          body: c.req.method !== 'GET' ? await c.req.json().catch(() => undefined) : undefined,
        });

        return c.json(response.body, response.status as any);
      }
    }

    // Apply regular middleware
    return createHonoMiddleware(ns)(c, next);
  };
}
