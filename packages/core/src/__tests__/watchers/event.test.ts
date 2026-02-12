import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventWatcher, TrackedEventEmitter } from '../../watchers/event.js';

describe('EventWatcher', () => {
  let watcher: EventWatcher;

  beforeEach(() => {
    watcher = new EventWatcher();
  });

  describe('record', () => {
    it('should create event entry', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        name: 'user.created',
        payload: { userId: '123' },
        listeners: ['EmailNotifier', 'Analytics'],
      });

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe('event');
      expect(entry!.batchId).toBe('batch-1');
      expect(entry!.content).toMatchObject({
        name: 'user.created',
        payload: { userId: '123' },
        listeners: ['EmailNotifier', 'Analytics'],
      });
    });

    it('should add event name tag', () => {
      const entry = watcher.record({
        name: 'order.completed',
        payload: {},
      });

      expect(entry!.tags).toContain('event:order.completed');
    });

    it('should add broadcast tags when provided', () => {
      const entry = watcher.record({
        name: 'message.sent',
        payload: { content: 'Hello' },
        broadcast: {
          channel: 'chat-room-1',
          event: 'NewMessage',
        },
      });

      expect(entry!.tags).toContain('broadcast');
      expect(entry!.tags).toContain('channel:chat-room-1');
      expect((entry!.content as any).broadcast).toMatchObject({
        channel: 'chat-room-1',
        event: 'NewMessage',
      });
    });

    it('should return null for ignored events', () => {
      const watcherWithIgnore = new EventWatcher({
        ignore: ['internal', 'debug'],
      });

      const entry1 = watcherWithIgnore.record({ name: 'internal.tick' });
      const entry2 = watcherWithIgnore.record({ name: 'debug.log' });
      const entry3 = watcherWithIgnore.record({ name: 'user.login' });

      expect(entry1).toBeNull();
      expect(entry2).toBeNull();
      expect(entry3).not.toBeNull();
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(watcher.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const disabledWatcher = new EventWatcher({ enabled: false });
      expect(disabledWatcher.enabled).toBe(false);
    });
  });
});

describe('TrackedEventEmitter', () => {
  let watcher: EventWatcher;
  let emitter: TrackedEventEmitter;

  beforeEach(() => {
    watcher = new EventWatcher();
    emitter = new TrackedEventEmitter(watcher);
  });

  describe('on', () => {
    it('should register event handlers', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('should allow multiple handlers for same event', () => {
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      emitter.on('test', () => {});

      expect(emitter.listenerCount('test')).toBe(3);
    });
  });

  describe('off', () => {
    it('should remove event handler', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);

      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('emit', () => {
    it('should call registered handlers', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      emitter.emit('test', { data: 'value' });

      expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });

    it('should record event to watcher', () => {
      vi.spyOn(watcher, 'record');
      const handler = vi.fn();
      emitter.on('test', handler, 'TestHandler');

      emitter.emit('test', { payload: 'data' });

      expect(watcher.record).toHaveBeenCalledWith({
        batchId: undefined,
        name: 'test',
        payload: { payload: 'data' },
        listeners: ['TestHandler'],
      });
    });

    it('should handle errors in handlers gracefully', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      emitter.on('test', errorHandler);
      emitter.on('test', normalHandler);

      // Should not throw
      expect(() => emitter.emit('test')).not.toThrow();
      
      // Both handlers should be attempted
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      expect(emitter.listenerCount('nonexistent')).toBe(0);

      emitter.on('test', () => {});
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.on('test', () => {});
      expect(emitter.listenerCount('test')).toBe(2);
    });
  });
});
