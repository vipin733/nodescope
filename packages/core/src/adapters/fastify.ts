import { NodeScope } from '../nodescope.js';
import { getDashboardHtml } from '../dashboard/index.js';

// Use inline types to avoid dependency on fastify types
interface FastifyRequest {
  url: string;
  method: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body: unknown;
  ip: string;
  routeOptions?: { url?: string };
  nodescope?: {
    batchId: string;
    startTime: number;
  };
}

interface FastifyReply {
  statusCode: number;
  getHeaders(): Record<string, string>;
  status(code: number): FastifyReply;
  type(contentType: string): FastifyReply;
  send(payload: unknown): FastifyReply;
}

interface FastifyInstance {
  addHook(name: string, handler: (...args: any[]) => Promise<void>): void;
  get(path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>): void;
  all(path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>): void;
  log: { error: (...args: any[]) => void };
}

/**
 * Create Fastify plugin for NodeScope
 */
export async function fastifyNodeScope(
  fastify: FastifyInstance,
  options: { nodescope: NodeScope }
): Promise<void> {
  const { nodescope } = options;
  const dashboardPath = nodescope.dashboardPath;

  // Add hook for request tracking
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    if (!nodescope.isEnabled) return;
    if (request.url.startsWith(dashboardPath)) return;

    const ctx = nodescope.createContext();
    request.nodescope = ctx;
  });

  // Add hook for response recording
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!nodescope.isEnabled) return;
    if (!nodescope.requestWatcher.enabled) return;
    if (!request.nodescope) return;

    try {
      const entry = nodescope.requestWatcher.record({
        batchId: request.nodescope.batchId,
        startTime: request.nodescope.startTime,
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url || request.url.split('?')[0],
        query: request.query as Record<string, string | string[]>,
        headers: request.headers,
        body: request.body,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        session: undefined,
        response: {
          status: reply.statusCode,
          headers: reply.getHeaders(),
          body: undefined, // Fastify doesn't expose response body easily
        },
      });

      if (entry) {
        await nodescope.recordEntry(entry);
      }
    } catch (error) {
      fastify.log.error('NodeScope error recording request:', error);
    }
  });

  // Dashboard route
  fastify.get(dashboardPath, async (request: FastifyRequest, reply: FastifyReply) => {
    const authorized = await nodescope.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: 'Unauthorized' });
    }
    return reply.type('text/html').send(getDashboardHtml(dashboardPath));
  });

  // Catch-all for dashboard paths
  fastify.get(`${dashboardPath}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    const authorized = await nodescope.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: 'Unauthorized' });
    }
    return reply.type('text/html').send(getDashboardHtml(dashboardPath));
  });

  // API routes
  fastify.all(`${dashboardPath}/api/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    const authorized = await nodescope.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const response = await nodescope.api.handle({
      method: request.method,
      url: request.url,
      query: request.query as Record<string, string>,
      body: request.body as Record<string, unknown>,
    });

    return reply.status(response.status).send(response.body);
  });
}
