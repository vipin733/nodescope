import {
  MemoryStorage
} from "./chunk-6KBKW63X.js";
import {
  SQLiteStorage
} from "./chunk-BOBKU5LG.js";
import {
  PostgreSQLStorage
} from "./chunk-6H665NNC.js";
import {
  MySQLStorage
} from "./chunk-V5BR4MSS.js";
import {
  createStorageAdapter
} from "./chunk-OF6NKXP5.js";

// src/watchers/base.ts
import { nanoid } from "nanoid";
var BaseWatcher = class {
  /** Whether this watcher is enabled */
  enabled = true;
  /**
   * Create an entry from captured data
   */
  createEntry(content, options = {}) {
    return {
      id: nanoid(),
      batchId: options.batchId ?? nanoid(),
      type: this.type,
      content,
      tags: options.tags ?? [],
      createdAt: /* @__PURE__ */ new Date(),
      duration: options.duration,
      memoryUsage: options.memoryUsage
    };
  }
};
function createRequestContext() {
  return {
    batchId: nanoid(),
    startTime: performance.now(),
    startMemory: process.memoryUsage?.()?.heapUsed
  };
}
function getDuration(ctx) {
  return Math.round(performance.now() - ctx.startTime);
}
function getMemoryDelta(ctx) {
  if (ctx.startMemory === void 0) return void 0;
  const currentMemory = process.memoryUsage?.()?.heapUsed;
  if (currentMemory === void 0) return void 0;
  return currentMemory - ctx.startMemory;
}

// src/watchers/request.ts
var DEFAULT_SIZE_LIMIT = 64;
var DEFAULT_HIDE_HEADERS = ["authorization", "cookie", "set-cookie"];
var RequestWatcher = class extends BaseWatcher {
  type = "request";
  options;
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.options = {
      enabled: options.enabled ?? true,
      sizeLimit: options.sizeLimit ?? DEFAULT_SIZE_LIMIT,
      ignorePaths: options.ignorePaths ?? ["/_nodescope", "/favicon.ico"],
      captureBody: options.captureBody ?? true,
      captureResponse: options.captureResponse ?? true,
      hideHeaders: options.hideHeaders ?? DEFAULT_HIDE_HEADERS
    };
  }
  /**
   * Record a request/response pair
   */
  record(data) {
    if (this.options.ignorePaths.some((p) => data.path.startsWith(p))) {
      return null;
    }
    const duration = Math.round(performance.now() - data.startTime);
    const filteredHeaders = this.filterHeaders(data.headers);
    const filteredResponseHeaders = this.filterHeaders(data.response.headers);
    const requestBody = this.options.captureBody ? this.truncateBody(data.body) : void 0;
    const responseBody = this.options.captureResponse ? this.truncateBody(data.response.body) : void 0;
    const content = {
      method: data.method.toUpperCase(),
      url: data.url,
      path: data.path,
      query: data.query,
      headers: filteredHeaders,
      body: requestBody,
      ip: data.ip,
      userAgent: data.userAgent,
      session: data.session,
      response: {
        status: data.response.status,
        headers: filteredResponseHeaders,
        body: responseBody,
        size: this.getBodySize(data.response.body)
      },
      middleware: data.middleware,
      controllerAction: data.controllerAction
    };
    const entry = this.createEntry(content, {
      batchId: data.batchId,
      duration,
      tags: this.generateTags(content)
    });
    return entry;
  }
  filterHeaders(headers) {
    const filtered = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.options.hideHeaders.includes(key.toLowerCase())) {
        filtered[key] = "[HIDDEN]";
      } else {
        filtered[key] = value;
      }
    }
    return filtered;
  }
  truncateBody(body) {
    if (body === void 0 || body === null) return body;
    const serialized = JSON.stringify(body);
    const sizeKB = Buffer.byteLength(serialized, "utf8") / 1024;
    if (sizeKB > this.options.sizeLimit) {
      return `[TRUNCATED - ${Math.round(sizeKB)}KB exceeds ${this.options.sizeLimit}KB limit]`;
    }
    return body;
  }
  getBodySize(body) {
    if (body === void 0 || body === null) return void 0;
    try {
      return Buffer.byteLength(JSON.stringify(body), "utf8");
    } catch {
      return void 0;
    }
  }
  generateTags(content) {
    const tags = [];
    tags.push(`method:${content.method}`);
    tags.push(`status:${content.response.status}`);
    if (content.response.status >= 400) {
      tags.push("error");
    }
    if (content.response.status >= 500) {
      tags.push("server-error");
    }
    return tags;
  }
};

// src/watchers/query.ts
var DEFAULT_SLOW_THRESHOLD = 100;
var QueryWatcher = class extends BaseWatcher {
  type = "query";
  slowThreshold;
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.slowThreshold = options.slowThreshold ?? DEFAULT_SLOW_THRESHOLD;
  }
  /**
   * Record a database query
   */
  record(data) {
    const slow = data.duration > this.slowThreshold;
    const content = {
      sql: data.sql,
      bindings: data.bindings ?? [],
      connection: data.connection ?? "default",
      database: data.database,
      slow,
      rowCount: data.rowCount
    };
    const tags = [];
    if (slow) {
      tags.push("slow");
    }
    const queryType = this.extractQueryType(data.sql);
    if (queryType) {
      tags.push(`query:${queryType}`);
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags
    });
  }
  extractQueryType(sql) {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith("select")) return "select";
    if (normalized.startsWith("insert")) return "insert";
    if (normalized.startsWith("update")) return "update";
    if (normalized.startsWith("delete")) return "delete";
    if (normalized.startsWith("create")) return "create";
    if (normalized.startsWith("alter")) return "alter";
    if (normalized.startsWith("drop")) return "drop";
    return null;
  }
};
function wrapPrisma(prisma, watcher, batchId) {
  if ("$on" in prisma && typeof prisma.$on === "function") {
    prisma.$on("query", (e) => {
      watcher.record({
        batchId,
        sql: e.query,
        bindings: e.params ? JSON.parse(e.params) : [],
        duration: e.duration
      });
    });
  }
  return prisma;
}
function createQueryInterceptor(watcher, batchId) {
  return {
    /**
     * Wrap a query function to track its execution
     */
    wrap(queryFn, getSql, getBindings) {
      return async (...args) => {
        const startTime = performance.now();
        try {
          const result = await queryFn(...args);
          const duration = Math.round(performance.now() - startTime);
          watcher.record({
            batchId,
            sql: getSql(...args),
            bindings: getBindings?.(...args) ?? [],
            duration,
            rowCount: Array.isArray(result) ? result.length : void 0
          });
          return result;
        } catch (error) {
          const duration = Math.round(performance.now() - startTime);
          watcher.record({
            batchId,
            sql: getSql(...args),
            bindings: getBindings?.(...args) ?? [],
            duration
          });
          throw error;
        }
      };
    }
  };
}

// src/watchers/cache.ts
var CacheWatcher = class extends BaseWatcher {
  type = "cache";
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }
  /**
   * Record a cache operation
   */
  record(data) {
    const content = {
      key: data.key,
      value: this.truncateValue(data.value),
      operation: data.operation,
      driver: data.driver ?? "unknown",
      ttl: data.ttl,
      tags: data.tags
    };
    const entryTags = [`operation:${data.operation}`];
    if (data.operation === "hit") {
      entryTags.push("hit");
    } else if (data.operation === "miss") {
      entryTags.push("miss");
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags: entryTags
    });
  }
  truncateValue(value) {
    if (value === void 0 || value === null) return value;
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > 1024) {
        return `[TRUNCATED - ${serialized.length} bytes]`;
      }
      return value;
    } catch {
      return "[UNSERIALIZABLE]";
    }
  }
};
function createCacheWrapper(cache, watcher, driver, batchId) {
  const handler = {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== "function") {
        return value;
      }
      const methodName = String(prop).toLowerCase();
      return async (...args) => {
        const startTime = performance.now();
        try {
          const result = await value.apply(target, args);
          const duration = Math.round(performance.now() - startTime);
          let operation = "get";
          let key = "";
          let cacheValue;
          let ttl;
          if (methodName.includes("get") || methodName === "fetch") {
            key = String(args[0] ?? "");
            operation = result !== null && result !== void 0 ? "hit" : "miss";
            cacheValue = result;
          } else if (methodName.includes("set") || methodName === "put") {
            key = String(args[0] ?? "");
            operation = "set";
            cacheValue = args[1];
            ttl = typeof args[2] === "number" ? args[2] : void 0;
          } else if (methodName.includes("del") || methodName === "remove") {
            key = String(args[0] ?? "");
            operation = "delete";
          } else if (methodName.includes("flush") || methodName === "clear") {
            key = "*";
            operation = "flush";
          }
          if (key) {
            watcher.record({
              batchId,
              key,
              value: cacheValue,
              operation,
              driver,
              ttl,
              duration
            });
          }
          return result;
        } catch (error) {
          throw error;
        }
      };
    }
  };
  return new Proxy(cache, handler);
}

// src/watchers/log.ts
var LOG_LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var LogWatcher = class extends BaseWatcher {
  type = "log";
  minLevel;
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.minLevel = options.level ?? "debug";
  }
  /**
   * Record a log entry
   */
  record(data) {
    if (LOG_LEVEL_PRIORITY[data.level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return null;
    }
    const content = {
      level: data.level,
      message: data.message,
      context: data.context,
      channel: data.channel
    };
    const tags = [`level:${data.level}`];
    if (data.level === "error") {
      tags.push("error");
    }
    if (data.channel) {
      tags.push(`channel:${data.channel}`);
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      tags
    });
  }
  /**
   * Create a logger instance that automatically records to NodeScope
   */
  createLogger(batchId, channel) {
    return {
      debug: (message, context) => {
        return this.record({ batchId, level: "debug", message, context, channel });
      },
      info: (message, context) => {
        return this.record({ batchId, level: "info", message, context, channel });
      },
      warn: (message, context) => {
        return this.record({ batchId, level: "warn", message, context, channel });
      },
      error: (message, context) => {
        return this.record({ batchId, level: "error", message, context, channel });
      }
    };
  }
};
function interceptConsole(watcher, batchIdFn) {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  const createInterceptor = (level, original) => {
    return (...args) => {
      original.apply(console, args);
      const message = args.map((arg) => {
        if (typeof arg === "string") return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }).join(" ");
      watcher.record({
        batchId: batchIdFn?.(),
        level,
        message,
        channel: "console"
      });
    };
  };
  console.log = createInterceptor("info", originalConsole.log);
  console.info = createInterceptor("info", originalConsole.info);
  console.warn = createInterceptor("warn", originalConsole.warn);
  console.error = createInterceptor("error", originalConsole.error);
  console.debug = createInterceptor("debug", originalConsole.debug);
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  };
}

// src/watchers/exception.ts
var ExceptionWatcher = class extends BaseWatcher {
  type = "exception";
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }
  /**
   * Record an exception
   */
  record(data) {
    const content = this.errorToContent(data.error, data.context);
    const tags = ["error", `class:${content.class}`];
    return this.createEntry(content, {
      batchId: data.batchId,
      tags
    });
  }
  errorToContent(error, context) {
    const { file, line } = this.extractLocation(error.stack);
    const content = {
      class: error.name || "Error",
      message: error.message,
      stack: error.stack || "",
      file,
      line,
      context
    };
    if ("cause" in error && error.cause instanceof Error) {
      content.previous = this.errorToContent(error.cause);
    }
    return content;
  }
  extractLocation(stack) {
    if (!stack) return {};
    const lines = stack.split("\n");
    for (const line of lines) {
      const match = line.match(/at\s+(?:.+?\s+)?\(?(.+?):(\d+):\d+\)?/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10)
        };
      }
    }
    return {};
  }
};
function setupGlobalErrorHandlers(watcher, onEntry) {
  const handleUncaughtException = (error) => {
    const entry = watcher.record({
      error,
      context: { uncaught: true, type: "uncaughtException" }
    });
    onEntry(entry);
  };
  const handleUnhandledRejection = (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const entry = watcher.record({
      error,
      context: { uncaught: true, type: "unhandledRejection" }
    });
    onEntry(entry);
  };
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);
  return () => {
    process.removeListener("uncaughtException", handleUncaughtException);
    process.removeListener("unhandledRejection", handleUnhandledRejection);
  };
}

// src/watchers/http-client.ts
var DEFAULT_SIZE_LIMIT2 = 64;
var HttpClientWatcher = class extends BaseWatcher {
  type = "http_client";
  sizeLimit;
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.sizeLimit = options.sizeLimit ?? DEFAULT_SIZE_LIMIT2;
  }
  /**
   * Record an outgoing HTTP request
   */
  record(data) {
    const content = {
      method: data.method.toUpperCase(),
      url: data.url,
      headers: this.sanitizeHeaders(data.headers),
      body: this.truncateBody(data.body),
      response: {
        status: data.response.status,
        headers: data.response.headers,
        body: this.truncateBody(data.response.body),
        size: this.getBodySize(data.response.body)
      }
    };
    const tags = [
      `method:${content.method}`,
      `status:${content.response.status}`
    ];
    if (content.response.status >= 400) {
      tags.push("error");
    }
    try {
      const url = new URL(data.url);
      tags.push(`host:${url.host}`);
    } catch {
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags
    });
  }
  sanitizeHeaders(headers) {
    const sanitized = {};
    const sensitiveHeaders = ["authorization", "cookie", "x-api-key", "api-key"];
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = "[HIDDEN]";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  truncateBody(body) {
    if (body === void 0 || body === null) return body;
    try {
      const serialized = JSON.stringify(body);
      const sizeKB = Buffer.byteLength(serialized, "utf8") / 1024;
      if (sizeKB > this.sizeLimit) {
        return `[TRUNCATED - ${Math.round(sizeKB)}KB]`;
      }
      return body;
    } catch {
      return "[UNSERIALIZABLE]";
    }
  }
  getBodySize(body) {
    if (body === void 0 || body === null) return void 0;
    try {
      return Buffer.byteLength(JSON.stringify(body), "utf8");
    } catch {
      return void 0;
    }
  }
};
function wrapFetch(watcher, batchIdFn) {
  const originalFetch = globalThis.fetch;
  return async (input, init) => {
    const startTime = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || (typeof input === "object" && "method" in input ? input.method : "GET");
    const headers = init?.headers ? Object.fromEntries(
      init.headers instanceof Headers ? init.headers.entries() : Array.isArray(init.headers) ? init.headers : Object.entries(init.headers)
    ) : {};
    let requestBody;
    if (init?.body) {
      try {
        requestBody = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      } catch {
        requestBody = init.body;
      }
    }
    try {
      const response = await originalFetch(input, init);
      const duration = Math.round(performance.now() - startTime);
      const clonedResponse = response.clone();
      let responseBody;
      try {
        responseBody = await clonedResponse.json();
      } catch {
        try {
          responseBody = await clonedResponse.text();
        } catch {
          responseBody = void 0;
        }
      }
      watcher.record({
        batchId: batchIdFn?.(),
        method: method || "GET",
        url,
        headers,
        body: requestBody,
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody
        },
        duration
      });
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      watcher.record({
        batchId: batchIdFn?.(),
        method: method || "GET",
        url,
        headers,
        body: requestBody,
        response: {
          status: 0,
          headers: {},
          body: error instanceof Error ? error.message : String(error)
        },
        duration
      });
      throw error;
    }
  };
}
function interceptFetch(watcher, batchIdFn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = wrapFetch(watcher, batchIdFn);
  return () => {
    globalThis.fetch = originalFetch;
  };
}

// src/watchers/event.ts
var EventWatcher = class extends BaseWatcher {
  type = "event";
  ignorePatterns;
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.ignorePatterns = options.ignore ?? [];
  }
  /**
   * Record an event
   */
  record(data) {
    if (this.ignorePatterns.some((pattern) => data.name.includes(pattern))) {
      return null;
    }
    const content = {
      name: data.name,
      payload: data.payload,
      listeners: data.listeners ?? [],
      broadcast: data.broadcast
    };
    const tags = [`event:${data.name}`];
    if (data.broadcast) {
      tags.push("broadcast");
      tags.push(`channel:${data.broadcast.channel}`);
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      tags
    });
  }
};
var TrackedEventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  watcher;
  batchIdFn;
  constructor(watcher, batchIdFn) {
    this.watcher = watcher;
    this.batchIdFn = batchIdFn;
  }
  on(event, handler, handlerName) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({
      name: handlerName ?? (handler.name || "anonymous"),
      handler
    });
  }
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  emit(event, payload) {
    const handlers = this.listeners.get(event) ?? [];
    const listenerNames = handlers.map((h) => h.name);
    this.watcher.record({
      batchId: this.batchIdFn?.(),
      name: event,
      payload,
      listeners: listenerNames
    });
    for (const { handler } of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
  listenerCount(event) {
    return this.listeners.get(event)?.length ?? 0;
  }
};

// src/watchers/job.ts
var JobWatcher = class extends BaseWatcher {
  type = "job";
  constructor(options = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }
  /**
   * Record a job
   */
  record(data) {
    const content = {
      name: data.name,
      queue: data.queue ?? "default",
      data: data.data,
      status: data.status,
      attempts: data.attempts ?? 1,
      maxAttempts: data.maxAttempts,
      error: data.error
    };
    const tags = [
      `status:${data.status}`,
      `queue:${content.queue}`,
      `job:${data.name}`
    ];
    if (data.status === "failed") {
      tags.push("failed");
    }
    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags
    });
  }
  /**
   * Create a job tracker that can be used to track job lifecycle
   */
  createJobTracker(name, options = {}) {
    let attempts = 0;
    const { batchId, queue, data, maxAttempts } = options;
    return {
      start: () => {
        attempts++;
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: "processing",
          attempts,
          maxAttempts
        });
      },
      complete: (duration) => {
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: "completed",
          attempts,
          maxAttempts,
          duration
        });
      },
      fail: (error, duration) => {
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: "failed",
          attempts,
          maxAttempts,
          error: error instanceof Error ? error.message : error,
          duration
        });
      }
    };
  }
};
function wrapJobProcessor(watcher, name, processor, options = {}) {
  return async (data) => {
    const tracker = watcher.createJobTracker(name, {
      queue: options.queue,
      data,
      maxAttempts: options.maxAttempts
    });
    const startTime = performance.now();
    tracker.start();
    try {
      const result = await processor(data);
      const duration = Math.round(performance.now() - startTime);
      tracker.complete(duration);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      tracker.fail(error instanceof Error ? error : String(error), duration);
      throw error;
    }
  };
}

// src/server/api.ts
var ApiHandler = class {
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Handle an API request
   */
  async handle(req) {
    const path = new URL(req.url, "http://localhost").pathname;
    try {
      if (req.method === "GET" && path === "/api/entries") {
        return this.listEntries(req);
      }
      if (req.method === "GET" && path.match(/^\/api\/entries\/[^/]+$/)) {
        const id = path.split("/").pop();
        return this.getEntry(id);
      }
      if (req.method === "GET" && path.match(/^\/api\/batch\/[^/]+$/)) {
        const batchId = path.split("/").pop();
        return this.getBatch(batchId);
      }
      if (req.method === "GET" && path === "/api/stats") {
        return this.getStats();
      }
      if (req.method === "DELETE" && path === "/api/entries") {
        return this.clearEntries();
      }
      if (req.method === "POST" && path === "/api/prune") {
        return this.pruneEntries(req);
      }
      return {
        status: 404,
        body: { error: "Not found" }
      };
    } catch (error) {
      console.error("NodeScope API error:", error);
      return {
        status: 500,
        body: { error: error instanceof Error ? error.message : "Internal server error" }
      };
    }
  }
  async listEntries(req) {
    const options = {};
    if (req.query.type) {
      options.type = String(req.query.type);
    }
    if (req.query.batchId) {
      options.batchId = String(req.query.batchId);
    }
    if (req.query.search) {
      options.search = String(req.query.search);
    }
    if (req.query.tags) {
      options.tags = Array.isArray(req.query.tags) ? req.query.tags : [String(req.query.tags)];
    }
    if (req.query.before) {
      options.before = new Date(String(req.query.before));
    }
    if (req.query.after) {
      options.after = new Date(String(req.query.after));
    }
    if (req.query.limit) {
      options.limit = parseInt(String(req.query.limit), 10);
    }
    if (req.query.offset) {
      options.offset = parseInt(String(req.query.offset), 10);
    }
    const result = await this.storage.list(options);
    return {
      status: 200,
      body: result
    };
  }
  async getEntry(id) {
    const entry = await this.storage.find(id);
    if (!entry) {
      return {
        status: 404,
        body: { error: "Entry not found" }
      };
    }
    return {
      status: 200,
      body: entry
    };
  }
  async getBatch(batchId) {
    const entries = await this.storage.findByBatch(batchId);
    return {
      status: 200,
      body: { batchId, entries }
    };
  }
  async getStats() {
    const stats = await this.storage.stats();
    return {
      status: 200,
      body: stats
    };
  }
  async clearEntries() {
    await this.storage.clear();
    return {
      status: 200,
      body: { success: true, message: "All entries cleared" }
    };
  }
  async pruneEntries(req) {
    const body = req.body;
    const hours = body?.hours ?? 24;
    const beforeDate = new Date(Date.now() - hours * 60 * 60 * 1e3);
    const pruned = await this.storage.prune(beforeDate);
    return {
      status: 200,
      body: { success: true, pruned, message: `Pruned ${pruned} entries older than ${hours} hours` }
    };
  }
};

// src/server/websocket.ts
var RealTimeServer = class {
  clients = /* @__PURE__ */ new Set();
  heartbeatInterval;
  heartbeatMs;
  constructor(options = {}) {
    this.heartbeatMs = options.heartbeatInterval ?? 3e4;
  }
  /**
   * Handle a new WebSocket connection
   */
  handleConnection(ws) {
    this.clients.add(ws);
    this.sendTo(ws, {
      type: "connected",
      clients: this.clients.size
    });
  }
  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(ws) {
    this.clients.delete(ws);
  }
  /**
   * Broadcast a new entry to all connected clients
   */
  broadcastEntry(entry) {
    this.broadcast({
      type: "entry",
      data: entry
    });
  }
  /**
   * Broadcast stats update to all clients
   */
  broadcastStats(stats) {
    this.broadcast({
      type: "stats",
      data: stats
    });
  }
  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: "ping", timestamp: Date.now() });
    }, this.heartbeatMs);
  }
  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = void 0;
    }
  }
  /**
   * Get number of connected clients
   */
  get clientCount() {
    return this.clients.size;
  }
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        try {
          client.send(data);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }
  sendTo(ws, message) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
};

// src/nodescope.ts
var DEFAULT_CONFIG = {
  enabled: true,
  storage: "memory",
  databaseUrl: void 0,
  dashboardPath: "/_nodescope",
  watchers: {
    request: true,
    query: true,
    cache: true,
    log: true,
    exception: true,
    httpClient: true,
    event: true,
    job: true
  },
  realtime: true,
  pruneAfterHours: 24
};
var NodeScope = class {
  config;
  storage;
  apiHandler;
  realTimeServer;
  initialized = false;
  cleanupFns = [];
  // Watchers
  requestWatcher;
  queryWatcher;
  cacheWatcher;
  logWatcher;
  exceptionWatcher;
  httpClientWatcher;
  eventWatcher;
  jobWatcher;
  // Current request context (for middleware use)
  currentBatchId;
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.realTimeServer = new RealTimeServer();
    const wc = this.config.watchers;
    this.requestWatcher = new RequestWatcher(
      typeof wc.request === "object" ? wc.request : {}
    );
    this.requestWatcher.enabled = wc.request !== false;
    this.queryWatcher = new QueryWatcher(
      typeof wc.query === "object" ? wc.query : {}
    );
    this.queryWatcher.enabled = wc.query !== false;
    this.cacheWatcher = new CacheWatcher(
      typeof wc.cache === "object" ? wc.cache : {}
    );
    this.cacheWatcher.enabled = wc.cache !== false;
    this.logWatcher = new LogWatcher(
      typeof wc.log === "object" ? wc.log : {}
    );
    this.logWatcher.enabled = wc.log !== false;
    this.exceptionWatcher = new ExceptionWatcher(
      typeof wc.exception === "object" ? wc.exception : {}
    );
    this.exceptionWatcher.enabled = wc.exception !== false;
    this.httpClientWatcher = new HttpClientWatcher(
      typeof wc.httpClient === "object" ? wc.httpClient : {}
    );
    this.httpClientWatcher.enabled = wc.httpClient !== false;
    this.eventWatcher = new EventWatcher(
      typeof wc.event === "object" ? wc.event : {}
    );
    this.eventWatcher.enabled = wc.event !== false;
    this.jobWatcher = new JobWatcher(
      typeof wc.job === "object" ? wc.job : {}
    );
    this.jobWatcher.enabled = wc.job !== false;
  }
  /**
   * Initialize storage and start background processes
   */
  async initialize() {
    if (this.initialized) return;
    this.storage = await createStorageAdapter(this.config.storage, {
      databaseUrl: this.config.databaseUrl
    });
    await this.storage.initialize();
    this.apiHandler = new ApiHandler(this.storage);
    if (this.exceptionWatcher.enabled) {
      const cleanup = setupGlobalErrorHandlers(
        this.exceptionWatcher,
        (entry) => this.recordEntry(entry)
      );
      this.cleanupFns.push(cleanup);
    }
    if (this.config.realtime) {
      this.realTimeServer.startHeartbeat();
    }
    if (this.config.pruneAfterHours && this.config.pruneAfterHours > 0) {
      const pruneInterval = setInterval(async () => {
        const beforeDate = new Date(
          Date.now() - this.config.pruneAfterHours * 60 * 60 * 1e3
        );
        await this.storage.prune(beforeDate);
      }, 60 * 60 * 1e3);
      this.cleanupFns.push(() => clearInterval(pruneInterval));
    }
    this.initialized = true;
  }
  /**
   * Record an entry to storage and broadcast
   */
  async recordEntry(entry) {
    if (!this.config.enabled) return;
    if (this.config.filter && !this.config.filter(entry)) {
      return;
    }
    if (this.config.tag) {
      const customTags = this.config.tag(entry);
      entry.tags = [...entry.tags, ...customTags];
    }
    await this.storage.save(entry);
    if (this.config.realtime) {
      this.realTimeServer.broadcastEntry(entry);
    }
  }
  /**
   * Get the current batch ID
   */
  get batchId() {
    return this.currentBatchId;
  }
  /**
   * Create a new request context
   */
  createContext() {
    const ctx = createRequestContext();
    this.currentBatchId = ctx.batchId;
    return ctx;
  }
  /**
   * Get the dashboard path
   */
  get dashboardPath() {
    return this.config.dashboardPath;
  }
  /**
   * Get the API handler
   */
  get api() {
    return this.apiHandler;
  }
  /**
   * Get the real-time server
   */
  get realtime() {
    return this.realTimeServer;
  }
  /**
   * Get storage adapter
   */
  getStorage() {
    return this.storage;
  }
  /**
   * Check if NodeScope is enabled
   */
  get isEnabled() {
    return this.config.enabled;
  }
  /**
   * Check authorization
   */
  async checkAuthorization(req) {
    if (!this.config.authorization) return true;
    return this.config.authorization(req);
  }
  /**
   * Cleanup and close connections
   */
  async close() {
    this.realTimeServer.stopHeartbeat();
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    if (this.storage) {
      await this.storage.close();
    }
  }
};
var defaultInstance = null;
function getNodeScope() {
  if (!defaultInstance) {
    defaultInstance = new NodeScope();
  }
  return defaultInstance;
}
async function initNodeScope(config = {}) {
  defaultInstance = new NodeScope(config);
  await defaultInstance.initialize();
  return defaultInstance;
}

// src/dashboard/index.ts
function getDashboardHtml(basePath) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NodeScope</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#f0f9ff',
              100: '#e0f2fe',
              200: '#bae6fd',
              300: '#7dd3fc',
              400: '#38bdf8',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
              800: '#075985',
              900: '#0c4a6e',
              950: '#082f49',
            },
          },
        },
      },
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
    }
    
    code, pre, .mono {
      font-family: 'JetBrains Mono', monospace;
    }
    
    .glass {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .entry-row:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .status-success { color: #4ade80; }
    .status-warning { color: #fbbf24; }
    .status-error { color: #f87171; }
    .status-info { color: #60a5fa; }
    
    .animate-pulse-slow {
      animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
    }
    
    /* JSON syntax highlighting */
    .json-key { color: #93c5fd; }
    .json-string { color: #86efac; }
    .json-number { color: #fcd34d; }
    .json-boolean { color: #f9a8d4; }
    .json-null { color: #a78bfa; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="app"></div>
  
  <script>
    const API_BASE = '${basePath}/api';
    const WS_URL = location.protocol === 'https:' 
      ? 'wss://' + location.host + '${basePath}/ws'
      : 'ws://' + location.host + '${basePath}/ws';
    
    // State
    let state = {
      entries: [],
      stats: null,
      selectedEntry: null,
      selectedType: null,
      search: '',
      loading: true,
      connected: false,
      page: 0,
      hasMore: false,
    };
    
    // Types
    const ENTRY_TYPES = [
      { type: 'request', label: 'Requests', icon: '\u{1F310}' },
      { type: 'query', label: 'Queries', icon: '\u{1F50D}' },
      { type: 'cache', label: 'Cache', icon: '\u{1F4BE}' },
      { type: 'log', label: 'Logs', icon: '\u{1F4DD}' },
      { type: 'exception', label: 'Exceptions', icon: '\u26A0\uFE0F' },
      { type: 'http_client', label: 'HTTP Client', icon: '\u{1F4E1}' },
      { type: 'event', label: 'Events', icon: '\u{1F4E3}' },
      { type: 'job', label: 'Jobs', icon: '\u2699\uFE0F' },
    ];
    
    // Fetch entries
    async function fetchEntries() {
      state.loading = true;
      render();
      
      const params = new URLSearchParams();
      if (state.selectedType) params.set('type', state.selectedType);
      if (state.search) params.set('search', state.search);
      params.set('limit', '50');
      params.set('offset', String(state.page * 50));
      
      try {
        const res = await fetch(API_BASE + '/entries?' + params);
        const data = await res.json();
        state.entries = data.data || [];
        state.hasMore = data.hasMore;
      } catch (e) {
        console.error('Failed to fetch entries:', e);
        state.entries = [];
      }
      
      state.loading = false;
      render();
    }
    
    // Fetch stats
    async function fetchStats() {
      try {
        const res = await fetch(API_BASE + '/stats');
        state.stats = await res.json();
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
      render();
    }
    
    // Clear entries
    async function clearEntries() {
      if (!confirm('Are you sure you want to clear all entries?')) return;
      
      try {
        await fetch(API_BASE + '/entries', { method: 'DELETE' });
        state.entries = [];
        state.selectedEntry = null;
        fetchStats();
      } catch (e) {
        console.error('Failed to clear entries:', e);
      }
      render();
    }
    
    // Format date
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleTimeString();
    }
    
    // Format duration
    function formatDuration(ms) {
      if (ms < 1) return '<1ms';
      if (ms < 1000) return Math.round(ms) + 'ms';
      return (ms / 1000).toFixed(2) + 's';
    }
    
    // Get status color
    function getStatusColor(status) {
      if (status >= 500) return 'status-error';
      if (status >= 400) return 'status-warning';
      if (status >= 200 && status < 300) return 'status-success';
      return 'status-info';
    }
    
    // Syntax highlight JSON
    function highlightJson(obj, indent = 0) {
      if (obj === null) return '<span class="json-null">null</span>';
      if (typeof obj === 'boolean') return '<span class="json-boolean">' + obj + '</span>';
      if (typeof obj === 'number') return '<span class="json-number">' + obj + '</span>';
      if (typeof obj === 'string') {
        const escaped = obj.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (escaped.length > 200) {
          return '<span class="json-string">"' + escaped.substring(0, 200) + '..."</span>';
        }
        return '<span class="json-string">"' + escaped + '"</span>';
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map(i => '  '.repeat(indent + 1) + highlightJson(i, indent + 1)).join(',\\n');
        return '[\\n' + items + '\\n' + '  '.repeat(indent) + ']';
      }
      if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(k => {
          const key = '<span class="json-key">"' + k + '"</span>';
          const value = highlightJson(obj[k], indent + 1);
          return '  '.repeat(indent + 1) + key + ': ' + value;
        }).join(',\\n');
        return '{\\n' + items + '\\n' + '  '.repeat(indent) + '}';
      }
      return String(obj);
    }
    
    // Render entry summary
    function renderEntrySummary(entry) {
      switch (entry.type) {
        case 'request':
          const req = entry.content;
          return \`
            <span class="font-medium">\${req.method}</span>
            <span class="text-slate-400 mx-1">\${req.path}</span>
            <span class="\${getStatusColor(req.response?.status || 0)}">\${req.response?.status || '...'}</span>
          \`;
        case 'query':
          const sql = entry.content.sql?.substring(0, 60) || '';
          return \`
            <span class="mono text-sm">\${sql}\${sql.length >= 60 ? '...' : ''}</span>
            \${entry.content.slow ? '<span class="ml-2 px-1 py-0.5 rounded bg-yellow-900 text-yellow-200 text-xs">slow</span>' : ''}
          \`;
        case 'cache':
          return \`
            <span class="font-medium">\${entry.content.operation}</span>
            <span class="text-slate-400 mx-1">\${entry.content.key}</span>
          \`;
        case 'log':
          return \`
            <span class="\${entry.content.level === 'error' ? 'status-error' : entry.content.level === 'warn' ? 'status-warning' : 'text-slate-300'}">\${entry.content.message?.substring(0, 80) || ''}</span>
          \`;
        case 'exception':
          return \`
            <span class="status-error font-medium">\${entry.content.class}</span>
            <span class="text-slate-400 mx-1">\${entry.content.message?.substring(0, 50) || ''}</span>
          \`;
        case 'http_client':
          const hc = entry.content;
          return \`
            <span class="font-medium">\${hc.method}</span>
            <span class="text-slate-400 mx-1 mono text-sm">\${new URL(hc.url).host}</span>
            <span class="\${getStatusColor(hc.response?.status || 0)}">\${hc.response?.status || '...'}</span>
          \`;
        case 'event':
          return \`
            <span class="font-medium">\${entry.content.name}</span>
            <span class="text-slate-400 mx-1">\${entry.content.listeners?.length || 0} listeners</span>
          \`;
        case 'job':
          return \`
            <span class="font-medium">\${entry.content.name}</span>
            <span class="\${entry.content.status === 'completed' ? 'status-success' : entry.content.status === 'failed' ? 'status-error' : 'status-info'} ml-1">\${entry.content.status}</span>
          \`;
        default:
          return \`<span class="text-slate-400">\${entry.type}</span>\`;
      }
    }
    
    // Render entry detail
    function renderEntryDetail(entry) {
      if (!entry) {
        return \`
          <div class="flex items-center justify-center h-full text-slate-500">
            <p>Select an entry to view details</p>
          </div>
        \`;
      }
      
      return \`
        <div class="p-4 space-y-4 overflow-y-auto h-full scrollbar-thin">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold capitalize">\${entry.type}</h3>
            <span class="text-sm text-slate-400">\${formatDate(entry.createdAt)}</span>
          </div>
          
          \${entry.duration ? \`
            <div class="flex items-center gap-4 text-sm">
              <span class="text-slate-400">Duration:</span>
              <span class="font-mono">\${formatDuration(entry.duration)}</span>
            </div>
          \` : ''}
          
          \${entry.tags.length ? \`
            <div class="flex flex-wrap gap-1">
              \${entry.tags.map(t => \`<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">\${t}</span>\`).join('')}
            </div>
          \` : ''}
          
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-slate-400">Content</h4>
            <pre class="p-4 rounded-lg bg-slate-900 overflow-x-auto text-sm mono">\${highlightJson(entry.content)}</pre>
          </div>
        </div>
      \`;
    }
    
    // Main render function
    function render() {
      const app = document.getElementById('app');
      
      app.innerHTML = \`
        <div class="flex h-screen">
          <!-- Sidebar -->
          <aside class="w-64 glass border-r border-slate-800 flex flex-col">
            <div class="p-4 border-b border-slate-800">
              <h1 class="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                \u26A1 NodeScope
              </h1>
              <p class="text-xs text-slate-500 mt-1">Debug Assistant</p>
            </div>
            
            <nav class="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
              <button 
                onclick="state.selectedType = null; state.page = 0; fetchEntries();"
                class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 \${!state.selectedType ? 'bg-primary-600/20 text-primary-300' : 'hover:bg-slate-800 text-slate-300'}">
                <span>\u{1F4CA}</span>
                <span>All</span>
                \${state.stats ? \`<span class="ml-auto text-xs text-slate-500">\${state.stats.totalEntries}</span>\` : ''}
              </button>
              
              \${ENTRY_TYPES.map(t => \`
                <button 
                  onclick="state.selectedType = '\${t.type}'; state.page = 0; fetchEntries();"
                  class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 \${state.selectedType === t.type ? 'bg-primary-600/20 text-primary-300' : 'hover:bg-slate-800 text-slate-300'}">
                  <span>\${t.icon}</span>
                  <span>\${t.label}</span>
                  \${state.stats?.entriesByType ? \`<span class="ml-auto text-xs text-slate-500">\${state.stats.entriesByType[t.type] || 0}</span>\` : ''}
                </button>
              \`).join('')}
            </nav>
            
            <div class="p-2 border-t border-slate-800">
              <button 
                onclick="clearEntries()"
                class="w-full px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 flex items-center gap-2 text-sm">
                <span>\u{1F5D1}\uFE0F</span>
                <span>Clear All</span>
              </button>
            </div>
          </aside>
          
          <!-- Main content -->
          <main class="flex-1 flex flex-col">
            <!-- Header -->
            <header class="glass border-b border-slate-800 p-4 flex items-center gap-4">
              <div class="relative flex-1 max-w-md">
                <input 
                  type="text" 
                  placeholder="Search entries..." 
                  value="\${state.search}"
                  oninput="state.search = this.value; state.page = 0; fetchEntries();"
                  class="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-primary-500 focus:outline-none text-sm">
              </div>
              
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full \${state.connected ? 'bg-green-500 animate-pulse-slow' : 'bg-red-500'}"></span>
                <span class="text-xs text-slate-500">\${state.connected ? 'Live' : 'Offline'}</span>
              </div>
              
              <button 
                onclick="fetchEntries(); fetchStats();"
                class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">
                \u{1F504} Refresh
              </button>
            </header>
            
            <!-- Content -->
            <div class="flex-1 flex overflow-hidden">
              <!-- Entry list -->
              <div class="w-1/2 border-r border-slate-800 flex flex-col">
                <div class="flex-1 overflow-y-auto scrollbar-thin">
                  \${state.loading ? \`
                    <div class="flex items-center justify-center h-32">
                      <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                    </div>
                  \` : state.entries.length === 0 ? \`
                    <div class="flex items-center justify-center h-32 text-slate-500">
                      <p>No entries found</p>
                    </div>
                  \` : \`
                    <div class="divide-y divide-slate-800">
                      \${state.entries.map((entry, i) => \`
                        <div 
                          onclick="state.selectedEntry = state.entries[\${i}]; render();"
                          class="entry-row p-3 cursor-pointer \${state.selectedEntry?.id === entry.id ? 'bg-primary-600/10 border-l-2 border-primary-500' : ''}">
                          <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-2 flex-1 min-w-0">
                              <span class="text-xs text-slate-500">\${formatDate(entry.createdAt)}</span>
                              <span class="truncate">\${renderEntrySummary(entry)}</span>
                            </div>
                            \${entry.duration ? \`<span class="text-xs text-slate-500 ml-2">\${formatDuration(entry.duration)}</span>\` : ''}
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  \`}
                </div>
                
                \${state.hasMore || state.page > 0 ? \`
                  <div class="p-2 border-t border-slate-800 flex justify-between">
                    <button 
                      onclick="state.page = Math.max(0, state.page - 1); fetchEntries();"
                      \${state.page === 0 ? 'disabled' : ''}
                      class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50">
                      \u2190 Prev
                    </button>
                    <span class="text-sm text-slate-500">Page \${state.page + 1}</span>
                    <button 
                      onclick="state.page++; fetchEntries();"
                      \${!state.hasMore ? 'disabled' : ''}
                      class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50">
                      Next \u2192
                    </button>
                  </div>
                \` : ''}
              </div>
              
              <!-- Entry detail -->
              <div class="w-1/2 bg-slate-900/50">
                \${renderEntryDetail(state.selectedEntry)}
              </div>
            </div>
          </main>
        </div>
      \`;
    }
    
    // Initialize
    fetchStats();
    fetchEntries();
    
    // WebSocket connection (optional)
    try {
      const ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        state.connected = true;
        render();
      };
      ws.onclose = () => {
        state.connected = false;
        render();
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'entry') {
          state.entries.unshift(data.data);
          if (state.entries.length > 50) state.entries.pop();
          render();
        }
        if (data.type === 'stats') {
          state.stats = data.data;
          render();
        }
      };
    } catch (e) {
      console.log('WebSocket not available');
    }
  </script>
</body>
</html>`;
}

// src/adapters/express.ts
function createExpressMiddleware(nodescope2) {
  return async (req, res, next) => {
    if (!nodescope2.isEnabled) {
      return next();
    }
    const dashboardPath = nodescope2.dashboardPath;
    if (req.path.startsWith(dashboardPath)) {
      return next();
    }
    const ctx = nodescope2.createContext();
    req.nodescope = ctx;
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody;
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    res.json = function(body) {
      responseBody = body;
      return originalJson.call(this, body);
    };
    res.on("finish", async () => {
      if (!nodescope2.requestWatcher.enabled) return;
      try {
        const entry = nodescope2.requestWatcher.record({
          batchId: ctx.batchId,
          startTime: ctx.startTime,
          method: req.method,
          url: req.originalUrl || req.url,
          path: req.path,
          query: req.query,
          headers: req.headers,
          body: req.body,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.get("user-agent"),
          session: req.session,
          response: {
            status: res.statusCode,
            headers: res.getHeaders(),
            body: responseBody
          }
        });
        if (entry) {
          await nodescope2.recordEntry(entry);
        }
      } catch (error) {
        console.error("NodeScope error recording request:", error);
      }
    });
    next();
  };
}
async function mountExpressRoutes(app, nodescope2) {
  const dashboardPath = nodescope2.dashboardPath;
  app.use(createExpressMiddleware(nodescope2));
  app.use(dashboardPath, async (req, res, next) => {
    const authorized = await nodescope2.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }
    if (req.path === "/" || req.path === "") {
      res.setHeader("Content-Type", "text/html");
      res.send(getDashboardHtml(dashboardPath));
      return;
    }
    next();
  });
  app.use(`${dashboardPath}/api`, async (req, res) => {
    const authorized = await nodescope2.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }
    const apiPath = `/api${req.path}`;
    const response = await nodescope2.api.handle({
      method: req.method,
      url: apiPath,
      query: req.query,
      body: req.body
    });
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
    }
    res.status(response.status).json(response.body);
  });
}
function attachWebSocket(server, nodescope2, options = {}) {
  const wsPath = options.path ?? `${nodescope2.dashboardPath}/ws`;
  import("ws").then(({ WebSocketServer }) => {
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      if (url.pathname === wsPath) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          nodescope2.realtime.handleConnection(ws);
          ws.on("close", () => {
            nodescope2.realtime.handleDisconnection(ws);
          });
          ws.on("message", (data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === "pong") {
              }
            } catch {
            }
          });
        });
      } else {
        socket.destroy();
      }
    });
    nodescope2.realtime.startHeartbeat();
    console.log(`\u26A1 NodeScope WebSocket available at ws://localhost:PORT${wsPath}`);
  }).catch(() => {
    console.warn("NodeScope: ws package not installed, real-time updates disabled");
    console.warn("Install with: npm install ws");
  });
}

// src/adapters/hono.ts
function createHonoMiddleware(nodescope2) {
  return async (c, next) => {
    if (!nodescope2.isEnabled) {
      return next();
    }
    const dashboardPath = nodescope2.dashboardPath;
    if (c.req.path.startsWith(dashboardPath)) {
      return next();
    }
    const ctx = nodescope2.createContext();
    c.set("nodescope", ctx);
    const startTime = ctx.startTime;
    await next();
    if (!nodescope2.requestWatcher.enabled) return;
    try {
      let responseBody;
      const response = c.res;
      if (response.headers.get("content-type")?.includes("application/json")) {
        try {
          responseBody = await response.clone().json();
        } catch {
          responseBody = void 0;
        }
      }
      const entry = nodescope2.requestWatcher.record({
        batchId: ctx.batchId,
        startTime,
        method: c.req.method,
        url: c.req.url,
        path: c.req.path,
        query: Object.fromEntries(new URL(c.req.url).searchParams),
        headers: Object.fromEntries(c.req.raw.headers),
        body: await getRequestBody(c),
        ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
        response: {
          status: c.res.status,
          headers: Object.fromEntries(c.res.headers),
          body: responseBody
        }
      });
      if (entry) {
        await nodescope2.recordEntry(entry);
      }
    } catch (error) {
      console.error("NodeScope error recording request:", error);
    }
  };
}
async function getRequestBody(c) {
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      return await c.req.json();
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return await c.req.parseBody();
    }
    return void 0;
  } catch {
    return void 0;
  }
}
function createHonoDashboardRoutes(nodescope2) {
  const createRoutes = async () => {
    const { Hono } = await import("hono");
    const app = new Hono();
    const dashboardPath = nodescope2.dashboardPath;
    app.get("/", async (c) => {
      const authorized = await nodescope2.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: "Unauthorized" }, 403);
      }
      return c.html(getDashboardHtml(dashboardPath));
    });
    app.all("/api/*", async (c) => {
      const authorized = await nodescope2.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: "Unauthorized" }, 403);
      }
      const response = await nodescope2.api.handle({
        method: c.req.method,
        url: c.req.url,
        query: Object.fromEntries(new URL(c.req.url).searchParams),
        body: c.req.method !== "GET" ? await c.req.json().catch(() => void 0) : void 0
      });
      return c.json(response.body, response.status);
    });
    return app;
  };
  return createRoutes();
}
function nodescope(config = {}) {
  const ns = new NodeScope(config);
  let initialized = false;
  return async (c, next) => {
    if (!initialized) {
      await ns.initialize();
      initialized = true;
    }
    const dashboardPath = ns.dashboardPath;
    if (c.req.path.startsWith(dashboardPath)) {
      const authorized = await ns.checkAuthorization(c.req.raw);
      if (!authorized) {
        return c.json({ error: "Unauthorized" }, 403);
      }
      const subPath = c.req.path.slice(dashboardPath.length) || "/";
      if (subPath === "/" || subPath === "") {
        return c.html(getDashboardHtml(dashboardPath));
      }
      if (subPath.startsWith("/api")) {
        const response = await ns.api.handle({
          method: c.req.method,
          url: c.req.url,
          query: Object.fromEntries(new URL(c.req.url).searchParams),
          body: c.req.method !== "GET" ? await c.req.json().catch(() => void 0) : void 0
        });
        return c.json(response.body, response.status);
      }
    }
    return createHonoMiddleware(ns)(c, next);
  };
}

// src/adapters/fastify.ts
async function fastifyNodeScope(fastify, options) {
  const { nodescope: nodescope2 } = options;
  const dashboardPath = nodescope2.dashboardPath;
  fastify.addHook("onRequest", async (request) => {
    if (!nodescope2.isEnabled) return;
    if (request.url.startsWith(dashboardPath)) return;
    const ctx = nodescope2.createContext();
    request.nodescope = ctx;
  });
  fastify.addHook("onResponse", async (request, reply) => {
    if (!nodescope2.isEnabled) return;
    if (!nodescope2.requestWatcher.enabled) return;
    if (!request.nodescope) return;
    try {
      const entry = nodescope2.requestWatcher.record({
        batchId: request.nodescope.batchId,
        startTime: request.nodescope.startTime,
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url || request.url.split("?")[0],
        query: request.query,
        headers: request.headers,
        body: request.body,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        session: void 0,
        response: {
          status: reply.statusCode,
          headers: reply.getHeaders(),
          body: void 0
          // Fastify doesn't expose response body easily
        }
      });
      if (entry) {
        await nodescope2.recordEntry(entry);
      }
    } catch (error) {
      fastify.log.error("NodeScope error recording request:", error);
    }
  });
  fastify.get(dashboardPath, async (request, reply) => {
    const authorized = await nodescope2.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: "Unauthorized" });
    }
    return reply.type("text/html").send(getDashboardHtml(dashboardPath));
  });
  fastify.get(`${dashboardPath}/*`, async (request, reply) => {
    const authorized = await nodescope2.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: "Unauthorized" });
    }
    return reply.type("text/html").send(getDashboardHtml(dashboardPath));
  });
  fastify.all(`${dashboardPath}/api/*`, async (request, reply) => {
    const authorized = await nodescope2.checkAuthorization(request);
    if (!authorized) {
      return reply.status(403).send({ error: "Unauthorized" });
    }
    const response = await nodescope2.api.handle({
      method: request.method,
      url: request.url,
      query: request.query,
      body: request.body
    });
    return reply.status(response.status).send(response.body);
  });
}

// src/adapters/nestjs.ts
var NodeScopeMiddleware = class {
  constructor(nodescope2) {
    this.nodescope = nodescope2;
  }
  async use(req, res, next) {
    const nodescope2 = this.nodescope;
    if (!nodescope2 || !nodescope2.isEnabled) {
      return next();
    }
    const dashboardPath = nodescope2.dashboardPath;
    if (req.path?.startsWith(dashboardPath)) {
      return next();
    }
    const ctx = nodescope2.createContext();
    req.nodescope = ctx;
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody;
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    res.json = function(body) {
      responseBody = body;
      return originalJson.call(this, body);
    };
    res.on("finish", async () => {
      if (!nodescope2.requestWatcher.enabled) return;
      try {
        const entry = nodescope2.requestWatcher.record({
          batchId: ctx.batchId,
          startTime: ctx.startTime,
          method: req.method,
          url: req.originalUrl || req.url,
          path: req.path || req.route?.path,
          query: req.query,
          headers: req.headers,
          body: req.body,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.get?.("user-agent"),
          session: req.session,
          response: {
            status: res.statusCode,
            headers: res.getHeaders?.() || {},
            body: responseBody
          }
        });
        if (entry) {
          await nodescope2.recordEntry(entry);
        }
      } catch (error) {
      }
    });
    next();
  }
};
var NodeScopeInterceptor = class {
  constructor(nodescope2) {
    this.nodescope = nodescope2;
  }
  async intercept(context, next) {
    if (!this.nodescope.isEnabled) {
      return next.handle();
    }
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const dashboardPath = this.nodescope.dashboardPath;
    if (request.path?.startsWith(dashboardPath)) {
      return next.handle();
    }
    const ctx = this.nodescope.createContext();
    request.nodescope = ctx;
    const { tap } = await import("rxjs/operators");
    return next.handle().pipe(
      tap({
        next: async (data) => {
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
              userAgent: request.get?.("user-agent"),
              session: request.session,
              response: {
                status: response.statusCode,
                headers: response.getHeaders?.() || {},
                body: data
              }
            });
            if (entry) {
              await this.nodescope.recordEntry(entry);
            }
          } catch (error) {
            console.error("NodeScope error recording request:", error);
          }
        },
        error: async (error) => {
          if (!this.nodescope.exceptionWatcher.enabled) return;
          try {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            const entry = this.nodescope.exceptionWatcher.record({
              error: errorObj,
              context: {
                method: request.method,
                url: request.url,
                statusCode: error.status || 500
              }
            });
            if (entry) {
              await this.nodescope.recordEntry(entry);
            }
          } catch (recordError) {
            console.error("NodeScope error recording exception:", recordError);
          }
        }
      })
    );
  }
};
var NodeScopeController = class {
  constructor(nodescope2) {
    this.nodescope = nodescope2;
  }
  async getDashboard(req, res) {
    const authorized = await this.nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.send(getDashboardHtml(this.nodescope.dashboardPath));
  }
  async handleApi(req, res) {
    const authorized = await this.nodescope.checkAuthorization(req);
    if (!authorized) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }
    const apiPath = req.path.replace(this.nodescope.dashboardPath, "");
    const response = await this.nodescope.api.handle({
      method: req.method,
      url: apiPath,
      query: req.query,
      body: req.body
    });
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
    }
    res.status(response.status).json(response.body);
  }
};
var NodeScopeModule = class _NodeScopeModule {
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
  static forRoot(config = {}) {
    const nodescope2 = new NodeScope(config);
    nodescope2.initialize().catch((err) => {
      console.error("Failed to initialize NodeScope:", err);
    });
    return {
      module: _NodeScopeModule,
      providers: [
        {
          provide: "NODESCOPE_INSTANCE",
          useValue: nodescope2
        },
        {
          provide: NodeScope,
          useValue: nodescope2
        },
        {
          provide: NodeScopeMiddleware,
          useFactory: () => new NodeScopeMiddleware(nodescope2)
        },
        {
          provide: NodeScopeInterceptor,
          useFactory: () => new NodeScopeInterceptor(nodescope2)
        },
        {
          provide: NodeScopeController,
          useFactory: () => new NodeScopeController(nodescope2)
        }
      ],
      exports: ["NODESCOPE_INSTANCE", NodeScope, NodeScopeMiddleware, NodeScopeInterceptor],
      global: true
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
  static forRootAsync(options) {
    return {
      module: _NodeScopeModule,
      providers: [
        {
          provide: "NODESCOPE_CONFIG",
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        {
          provide: "NODESCOPE_INSTANCE",
          useFactory: async (config) => {
            const nodescope2 = new NodeScope(config);
            await nodescope2.initialize();
            return nodescope2;
          },
          inject: ["NODESCOPE_CONFIG"]
        },
        {
          provide: NodeScope,
          useFactory: async (config) => {
            const nodescope2 = new NodeScope(config);
            await nodescope2.initialize();
            return nodescope2;
          },
          inject: ["NODESCOPE_CONFIG"]
        },
        {
          provide: NodeScopeMiddleware,
          useFactory: (nodescope2) => new NodeScopeMiddleware(nodescope2),
          inject: ["NODESCOPE_INSTANCE"]
        },
        {
          provide: NodeScopeInterceptor,
          useFactory: (nodescope2) => new NodeScopeInterceptor(nodescope2),
          inject: ["NODESCOPE_INSTANCE"]
        },
        {
          provide: NodeScopeController,
          useFactory: (nodescope2) => new NodeScopeController(nodescope2),
          inject: ["NODESCOPE_INSTANCE"]
        }
      ],
      exports: ["NODESCOPE_INSTANCE", NodeScope, NodeScopeMiddleware, NodeScopeInterceptor],
      global: true
    };
  }
};
async function setupNodeScopeRoutes(app, nodescope2) {
  const dashboardPath = nodescope2.dashboardPath;
  const controller = new NodeScopeController(nodescope2);
  app.getHttpAdapter().get(dashboardPath, (req, res) => {
    return controller.getDashboard(req, res);
  });
  app.getHttpAdapter().all(`${dashboardPath}/api/*`, (req, res) => {
    return controller.handleApi(req, res);
  });
  const httpServer = app.getHttpServer();
  if (httpServer) {
    import("ws").then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ noServer: true });
      const wsPath = `${dashboardPath}/ws`;
      httpServer.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url || "", `http://${request.headers.host}`);
        if (url.pathname === wsPath) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            nodescope2.realtime.handleConnection(ws);
            ws.on("close", () => {
              nodescope2.realtime.handleDisconnection(ws);
            });
          });
        }
      });
      console.log("[NodeScope] WebSocket server attached for real-time updates at", wsPath);
    }).catch((err) => {
      console.warn("[NodeScope] WebSocket not available, real-time updates disabled:", err.message);
    });
  }
}
export {
  ApiHandler,
  BaseWatcher,
  CacheWatcher,
  EventWatcher,
  ExceptionWatcher,
  HttpClientWatcher,
  JobWatcher,
  LogWatcher,
  MemoryStorage,
  MySQLStorage,
  NodeScope,
  NodeScopeController,
  NodeScopeInterceptor,
  NodeScopeMiddleware,
  NodeScopeModule,
  PostgreSQLStorage,
  QueryWatcher,
  RealTimeServer,
  RequestWatcher,
  SQLiteStorage,
  TrackedEventEmitter,
  attachWebSocket,
  createCacheWrapper,
  createExpressMiddleware,
  createHonoDashboardRoutes,
  createHonoMiddleware,
  createQueryInterceptor,
  createRequestContext,
  createStorageAdapter,
  fastifyNodeScope,
  getDashboardHtml,
  getDuration,
  getMemoryDelta,
  getNodeScope,
  initNodeScope,
  interceptConsole,
  interceptFetch,
  mountExpressRoutes,
  nodescope,
  setupGlobalErrorHandlers,
  setupNodeScopeRoutes,
  wrapFetch,
  wrapJobProcessor,
  wrapPrisma
};
