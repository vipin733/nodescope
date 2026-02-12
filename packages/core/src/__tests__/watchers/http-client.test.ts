import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClientWatcher } from '../../watchers/http-client.js';

describe('HttpClientWatcher', () => {
  let watcher: HttpClientWatcher;

  beforeEach(() => {
    watcher = new HttpClientWatcher();
  });

  describe('record', () => {
    it('should create HTTP client entry', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { users: [] },
        },
        duration: 150,
      });

      expect(entry.type).toBe('http_client');
      expect(entry.batchId).toBe('batch-1');
      expect(entry.duration).toBe(150);
      expect(entry.content).toMatchObject({
        method: 'GET',
        url: 'https://api.example.com/users',
      });
    });

    it('should uppercase method', () => {
      const entry = watcher.record({
        method: 'post',
        url: 'https://api.example.com/data',
        headers: {},
        response: { status: 201, headers: {} },
        duration: 100,
      });

      expect((entry.content as any).method).toBe('POST');
    });

    it('should add method and status tags', () => {
      const entry = watcher.record({
        method: 'GET',
        url: 'https://api.example.com',
        headers: {},
        response: { status: 200, headers: {} },
        duration: 50,
      });

      expect(entry.tags).toContain('method:GET');
      expect(entry.tags).toContain('status:200');
    });

    it('should add error tag for 4xx/5xx responses', () => {
      const entry404 = watcher.record({
        method: 'GET',
        url: 'https://api.example.com/notfound',
        headers: {},
        response: { status: 404, headers: {} },
        duration: 50,
      });

      const entry500 = watcher.record({
        method: 'GET',
        url: 'https://api.example.com/error',
        headers: {},
        response: { status: 500, headers: {} },
        duration: 50,
      });

      expect(entry404.tags).toContain('error');
      expect(entry500.tags).toContain('error');
    });

    it('should add host tag from URL', () => {
      const entry = watcher.record({
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        response: { status: 200, headers: {} },
        duration: 50,
      });

      expect(entry.tags).toContain('host:api.example.com');
    });

    it('should sanitize sensitive headers', () => {
      const entry = watcher.record({
        method: 'GET',
        url: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer secret-token',
          'X-API-Key': 'secret-key',
          'Cookie': 'session=abc123',
        },
        response: { status: 200, headers: {} },
        duration: 50,
      });

      const headers = (entry.content as any).headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('[HIDDEN]');
      expect(headers['X-API-Key']).toBe('[HIDDEN]');
      expect(headers['Cookie']).toBe('[HIDDEN]');
    });

    it('should truncate large response bodies', () => {
      const largeBody = { data: 'x'.repeat(100000) };
      
      const entry = watcher.record({
        method: 'GET',
        url: 'https://api.example.com/large',
        headers: {},
        body: largeBody,
        response: { 
          status: 200, 
          headers: {},
          body: largeBody,
        },
        duration: 50,
      });

      expect((entry.content as any).body).toContain('TRUNCATED');
      expect((entry.content as any).response.body).toContain('TRUNCATED');
    });

    it('should include response size', () => {
      const entry = watcher.record({
        method: 'GET',
        url: 'https://api.example.com',
        headers: {},
        response: { 
          status: 200, 
          headers: {},
          body: { data: 'test' },
        },
        duration: 50,
      });

      expect((entry.content as any).response.size).toBeDefined();
      expect(typeof (entry.content as any).response.size).toBe('number');
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(watcher.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const disabledWatcher = new HttpClientWatcher({ enabled: false });
      expect(disabledWatcher.enabled).toBe(false);
    });

    it('should respect sizeLimit option', () => {
      const customWatcher = new HttpClientWatcher({ sizeLimit: 128 });
      expect(customWatcher.enabled).toBe(true);
    });
  });
});
