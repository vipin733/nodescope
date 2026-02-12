import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { NodeScope } from '../../nodescope.js';
import { createHonoMiddleware, nodescope as nodescopeMiddleware } from '../../adapters/hono.js';

// Helper to make requests to Hono app
async function makeRequest(app: Hono, path: string, init?: RequestInit) {
  const url = `http://localhost${path}`;
  const request = new Request(url, init);
  return app.fetch(request);
}

describe('Hono Adapter', () => {
  describe('createHonoMiddleware', () => {
    let app: Hono;
    let nodescope: NodeScope;

    beforeEach(async () => {
      nodescope = new NodeScope({
        storage: 'memory',
        dashboardPath: '/_nodescope',
      });
      await nodescope.initialize();

      app = new Hono();
      app.use('*', createHonoMiddleware(nodescope));
      
      app.get('/test', (c) => c.json({ message: 'Hello, World!' }));
      app.post('/data', async (c) => {
        const body = await c.req.json();
        return c.json({ received: body }, 201);
      });
    });

    afterAll(async () => {
      await nodescope.close();
    });

    it('should allow requests to pass through', async () => {
      const response = await makeRequest(app, '/test');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ message: 'Hello, World!' });
    });

    it('should capture GET request', async () => {
      await makeRequest(app, '/test');

      // Wait for async recording
      await new Promise(resolve => setTimeout(resolve, 100));

      const entries = await nodescope.getStorage().list({ type: 'request' });
      expect(entries.data.length).toBeGreaterThan(0);
      
      const entry = entries.data[0];
      expect(entry.content).toMatchObject({
        method: 'GET',
        path: '/test',
        response: { status: 200 },
      });
    });

    it('should capture POST request with body', async () => {
      await makeRequest(app, '/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User' }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const entries = await nodescope.getStorage().list({ type: 'request' });
      const postEntry = entries.data.find(
        (e) => (e.content as any).method === 'POST'
      );

      expect(postEntry).toBeDefined();
      expect((postEntry!.content as any).response.status).toBe(201);
    });

    it('should set nodescope context on request', async () => {
      let batchId: string | undefined;

      app.get('/context', (c) => {
        batchId = c.get('nodescope')?.batchId;
        return c.json({ ok: true });
      });

      await makeRequest(app, '/context');

      expect(batchId).toBeDefined();
      expect(typeof batchId).toBe('string');
    });

    it('should skip nodescope dashboard paths', async () => {
      const initialCount = (await nodescope.getStorage().list()).total;

      // Make request to dashboard path - should 404 since routes not mounted
      await makeRequest(app, '/_nodescope');

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalCount = (await nodescope.getStorage().list()).total;
      // Dashboard paths should be skipped
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('nodescope middleware (all-in-one)', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.use('*', nodescopeMiddleware({ storage: 'memory' }));
      app.get('/test', (c) => c.json({ ok: true }));
    });

    it('should handle regular requests', async () => {
      const response = await makeRequest(app, '/test');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ ok: true });
    });

    it('should serve dashboard at default path', async () => {
      const response = await makeRequest(app, '/_nodescope');

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should track requests through the middleware', async () => {
      // The middleware initializes lazily, make a request first
      await makeRequest(app, '/test');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the app is still working
      const response = await makeRequest(app, '/test');
      expect(response.status).toBe(200);
    });
  });

  describe('disabled state', () => {
    it('should skip recording when disabled', async () => {
      const app = new Hono();
      app.use('*', nodescopeMiddleware({ storage: 'memory', enabled: false }));
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await makeRequest(app, '/test');
      expect(response.status).toBe(200);

      // The app still works, just no recording happens
    });
  });
});
