import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { NodeScope } from '../../nodescope.js';
import { createExpressMiddleware, mountExpressRoutes } from '../../adapters/express.js';

describe('Express Adapter', () => {
  let app: express.Application;
  let nodescope: NodeScope;

  beforeEach(async () => {
    nodescope = new NodeScope({
      storage: 'memory',
      dashboardPath: '/_nodescope',
    });
    await nodescope.initialize();

    app = express();
    app.use(express.json());
  });

  afterAll(async () => {
    await nodescope.close();
  });

  describe('createExpressMiddleware', () => {
    beforeEach(() => {
      app.use(createExpressMiddleware(nodescope));
      app.get('/test', (req, res) => {
        res.json({ message: 'Hello, World!' });
      });
      app.post('/data', (req, res) => {
        res.status(201).json({ received: req.body });
      });
    });

    it('should allow requests to pass through', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({ message: 'Hello, World!' });
    });

    it('should capture GET request', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      // Wait a bit for async recording
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
      await request(app)
        .post('/data')
        .send({ name: 'Test User' })
        .set('Content-Type', 'application/json')
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      const entries = await nodescope.getStorage().list({ type: 'request' });
      const postEntry = entries.data.find(
        (e) => (e.content as any).method === 'POST'
      );

      expect(postEntry).toBeDefined();
      expect((postEntry!.content as any).body).toEqual({ name: 'Test User' });
    });

    it('should set nodescope context on request', async () => {
      let batchId: string | undefined;

      app.get('/context', (req, res) => {
        batchId = (req as any).nodescope?.batchId;
        res.json({ ok: true });
      });

      await request(app)
        .get('/context')
        .expect(200);

      expect(batchId).toBeDefined();
      expect(typeof batchId).toBe('string');
    });

    it('should skip nodescope dashboard paths', async () => {
      const initialCount = (await nodescope.getStorage().list()).total;

      // Make request to dashboard path
      await request(app).get('/_nodescope').expect(404); // 404 because route not mounted

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalCount = (await nodescope.getStorage().list()).total;
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('disabled state', () => {
    it('should skip recording when disabled', async () => {
      const disabledNodescope = new NodeScope({
        storage: 'memory',
        enabled: false,
      });
      await disabledNodescope.initialize();

      const testApp = express();
      testApp.use(createExpressMiddleware(disabledNodescope));
      testApp.get('/test', (req, res) => res.json({ ok: true }));

      await request(testApp).get('/test').expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      const entries = await disabledNodescope.getStorage().list();
      expect(entries.total).toBe(0);

      await disabledNodescope.close();
    });
  });
});

describe('Express Routes (mountExpressRoutes)', () => {
  let app: express.Application;
  let nodescope: NodeScope;

  beforeAll(async () => {
    nodescope = new NodeScope({
      storage: 'memory',
      dashboardPath: '/_nodescope',
    });
    await nodescope.initialize();

    app = express();
    app.use(express.json());
    await mountExpressRoutes(app, nodescope);

    // Add a test route
    app.get('/hello', (req, res) => {
      res.json({ message: 'Hello!' });
    });
  });

  afterAll(async () => {
    await nodescope.close();
  });

  it('should serve dashboard at configured path', async () => {
    const response = await request(app)
      .get('/_nodescope/')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('<!DOCTYPE html>');
  });

  it('should track requests through the middleware', async () => {
    // Make a request
    await request(app).get('/hello').expect(200);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify request was recorded
    const storage = nodescope.getStorage();
    const entries = await storage.list({ type: 'request' });
    expect(entries.data.length).toBeGreaterThan(0);
  });
});
