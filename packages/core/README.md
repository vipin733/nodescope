# @vipin733/nodescope

> 🔭 A Laravel Telescope-inspired debugging and monitoring package for Node.js and Bun applications

[![npm version](https://img.shields.io/npm/v/@vipin733/nodescope.svg)](https://www.npmjs.com/package/@vipin733/nodescope)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 📊 **Real-time Monitoring** - Watch requests, queries, and logs as they happen via WebSocket streaming
- 💾 **Multiple Storage Backends** - Choose from in-memory, SQLite, PostgreSQL, or MySQL
- 🔌 **Framework Agnostic** - First-class support for Express, Hono, Fastify, NestJS, and vanilla Node.js
- 🎨 **Beautiful Dashboard** - React-based UI with dark/light mode (coming soon)
- 🚀 **Zero Configuration** - Sensible defaults, just install and go
- 🔍 **Comprehensive Watchers** - Track requests, database queries, logs, exceptions, and more
- ⚡ **Blazing Fast** - Minimal performance overhead, designed for production use
- 🌐 **WebSocket Support** - Real-time data streaming to connected clients

## 📦 Installation

```bash
npm install @vipin733/nodescope
# or
pnpm add @vipin733/nodescope
# or
yarn add @vipin733/nodescope
# or
bun add @vipin733/nodescope
```

### Optional Database Drivers

NodeScope supports multiple storage backends. Install the driver you need:

```bash
# SQLite
npm install better-sqlite3

# PostgreSQL
npm install pg

# MySQL
npm install mysql2
```

## 🚀 Quick Start

### Express.js

```typescript
import express from 'express';
import { NodeScope } from '@vipin733/nodescope';

const app = express();

// Initialize NodeScope
const nodescope = new NodeScope({
  storage: 'sqlite',
  storagePath: './nodescope.db',
  dashboardPath: '/_debug',
  enabled: process.env.NODE_ENV === 'development',
});

// Mount NodeScope middleware and routes
app.use(nodescope.middleware());
nodescope.mountExpressRoutes(app);

// Your app routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Dashboard available at http://localhost:3000/_debug');
});
```

### Hono (Bun/Node)

```typescript
import { Hono } from 'hono';
import { createHonoMiddleware } from '@vipin733/nodescope';

const app = new Hono();

// Add NodeScope middleware
app.use('*', createHonoMiddleware({ 
  storage: 'memory',
  dashboardPath: '/_debug'
}));

// Your app routes
app.get('/', (c) => c.text('Hello Hono!'));

export default app;
```

### Fastify

```typescript
import Fastify from 'fastify';
import { createFastifyPlugin } from '@vipin733/nodescope';

const fastify = Fastify({ logger: true });

// Register NodeScope plugin
await fastify.register(createFastifyPlugin, {
  storage: 'memory',
  dashboardPath: '/_debug',
});

// Your app routes
fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

await fastify.listen({ port: 3000 });
```

### NestJS

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { 
  NodeScope,
  NodeScopeModule, 
  NodeScopeMiddleware,
  setupNodeScopeRoutes 
} from '@vipin733/nodescope';

@Module({
  imports: [
    NodeScopeModule.forRoot({
      storage: 'memory',
      dashboardPath: '/_debug',
    }),
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly nodescope: NodeScope) {}

  configure(consumer: MiddlewareConsumer) {
    // Apply NodeScope middleware to all routes
    const middleware = new NodeScopeMiddleware(this.nodescope);
    consumer
      .apply((req, res, next) => middleware.use(req, res, next))
      .forRoutes('*');
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Set up dashboard routes
  const nodescope = app.get('NODESCOPE_INSTANCE');
  await setupNodeScopeRoutes(app, nodescope);
  
  await app.listen(3000);
}
bootstrap();
```

#### NestJS with ConfigService (Async Configuration)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodeScopeModule } from '@vipin733/nodescope';

@Module({
  imports: [
    ConfigModule.forRoot(),
    NodeScopeModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        storage: configService.get('NODESCOPE_STORAGE') || 'sqlite',
        dashboardPath: '/_debug',
        enabled: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

#### NestJS Global Interceptor (Alternative to Middleware)

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { NodeScopeModule, NodeScopeInterceptor } from '@vipin733/nodescope';

@Module({
  imports: [
    NodeScopeModule.forRoot({
      storage: 'memory',
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: NodeScopeInterceptor,
    },
  ],
})
export class AppModule {}
```

## ⚙️ Configuration

### Constructor Options

```typescript
interface NodeScopeOptions {
  // Enable/disable NodeScope (default: true)
  enabled?: boolean;
  
  // Storage backend: 'memory' | 'sqlite' | 'postgresql' | 'mysql'
  storage?: StorageType;
  
  // Storage configuration
  storagePath?: string; // For SQLite
  databaseUrl?: string; // For PostgreSQL/MySQL
  
  // Dashboard configuration
  dashboardPath?: string; // Default: '/_debug'
  
  // Data retention
  maxEntries?: number; // Default: 1000
  pruneInterval?: number; // In milliseconds, default: 60000
  
  // WebSocket configuration
  wsPath?: string; // Default: '/_debug/ws'
  
  // Watchers to enable
  watchers?: {
    request?: boolean;
    query?: boolean;
    cache?: boolean;
    log?: boolean;
    exception?: boolean;
    httpClient?: boolean;
    event?: boolean;
    job?: boolean;
  };
}
```

### Example Configurations

#### Development (In-Memory)

```typescript
const nodescope = new NodeScope({
  storage: 'memory',
  maxEntries: 500,
});
```

#### Production (PostgreSQL)

```typescript
const nodescope = new NodeScope({
  storage: 'postgresql',
  databaseUrl: process.env.DATABASE_URL,
  maxEntries: 5000,
  pruneInterval: 300000, // Prune every 5 minutes
  enabled: process.env.ENABLE_NODESCOPE === 'true',
});
```

#### SQLite for Local Development

```typescript
const nodescope = new NodeScope({
  storage: 'sqlite',
  storagePath: './data/nodescope.db',
  dashboardPath: '/_telescope',
});
```

## 📊 Watchers

NodeScope includes the following watchers to monitor different aspects of your application:

| Watcher | Description | Status |
|---------|-------------|--------|
| **Request** | HTTP requests and responses with timing | ✅ Active |
| **Query** | Database queries with execution time | ✅ Active |
| **Cache** | Cache operations (Redis, memory) | 🚧 Coming Soon |
| **Log** | Console and custom logs | ✅ Active |
| **Exception** | Errors with stack traces | ✅ Active |
| **HTTP Client** | Outgoing HTTP requests | 🚧 Coming Soon |
| **Event** | Application events | 🚧 Coming Soon |
| **Job** | Background job processing | 🚧 Coming Soon |

## 💾 Storage Options

### Memory (Development)

Fast, in-memory storage. **Not recommended for production** as data is lost on restart.

```typescript
{ storage: 'memory' }
```

### SQLite (Development/Small Production)

Single-file database, perfect for local development and small production deployments.

```typescript
{
  storage: 'sqlite',
  storagePath: './nodescope.db'
}
```

### PostgreSQL (Production)

Production-ready with connection pooling and excellent performance.

```typescript
{
  storage: 'postgresql',
  databaseUrl: 'postgresql://user:password@localhost:5432/mydb'
}
```

### MySQL (Production)

Production-ready MySQL support with connection pooling.

```typescript
{
  storage: 'mysql',
  databaseUrl: 'mysql://user:password@localhost:3306/mydb'
}
```

## 🔍 Manual Logging

You can manually log events to NodeScope:

```typescript
import { nodescope } from '@vipin733/nodescope';

// Log a request
nodescope.record('request', {
  method: 'GET',
  path: '/api/users',
  statusCode: 200,
  duration: 145,
});

// Log a database query
nodescope.record('query', {
  sql: 'SELECT * FROM users WHERE id = ?',
  bindings: [1],
  duration: 12,
});

// Log an exception
nodescope.record('exception', {
  message: 'User not found',
  stack: error.stack,
});

// Log a custom log
nodescope.record('log', {
  level: 'info',
  message: 'User logged in',
  context: { userId: 123 },
});
```

## 🌐 WebSocket API

NodeScope provides real-time updates via WebSocket. Connect to the WebSocket endpoint to receive live data:

```javascript
const ws = new WebSocket('ws://localhost:3000/_debug/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New entry:', data);
};
```

## 🔒 Security Considerations

**⚠️ Important**: NodeScope can expose sensitive application data. Always ensure proper security measures:

1. **Never enable in production** without authentication
2. **Use environment variables** to control when it's enabled
3. **Restrict access** to the dashboard endpoint using middleware
4. **Consider IP whitelisting** for production debugging

### Example: Protect Dashboard with Auth

```typescript
// Express example
app.use('/_debug', (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer YOUR_SECRET_TOKEN') {
    return res.status(401).send('Unauthorized');
  }
  next();
});

app.use(nodescope.middleware());
nodescope.mountExpressRoutes(app);
```

## 📖 API Reference

### `NodeScope` Class

#### Constructor

```typescript
new NodeScope(options?: NodeScopeOptions)
```

#### Methods

- `middleware()` - Returns middleware function for your framework
- `record(type: string, data: any)` - Manually record an entry
- `getEntries(type?: string, limit?: number)` - Retrieve stored entries
- `clear()` - Clear all stored entries
- `mountExpressRoutes(app: Express)` - Mount Express routes (Express only)

### Framework Helpers

#### Express

```typescript
import { NodeScope } from '@vipin733/nodescope';
const nodescope = new NodeScope(options);
app.use(nodescope.middleware());
nodescope.mountExpressRoutes(app);
```

#### Hono

```typescript
import { createHonoMiddleware } from '@vipin733/nodescope';
app.use('*', createHonoMiddleware(options));
```

#### Fastify

```typescript
import { createFastifyPlugin } from '@vipin733/nodescope';
await fastify.register(createFastifyPlugin, options);
```

#### NestJS

```typescript
import { NodeScopeModule, NodeScopeMiddleware, NodeScopeInterceptor } from '@vipin733/nodescope';

// Module approach
@Module({
  imports: [NodeScopeModule.forRoot(options)],
})

// Or async configuration
NodeScopeModule.forRootAsync({
  useFactory: (config: ConfigService) => ({...}),
  inject: [ConfigService],
})

// Use middleware or interceptor
consumer.apply(NodeScopeMiddleware).forRoutes('*');
// or
{ provide: APP_INTERCEPTOR, useClass: NodeScopeInterceptor }
```

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/yourusername/nodescope.git
cd nodescope

# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

## 📝 Examples

Check out the [examples](https://github.com/yourusername/nodescope/tree/main/examples) directory for complete working examples:

- Express.js example
- Hono example
- Fastify example
- NestJS example

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [Your Name]

## 🙏 Acknowledgments

Inspired by [Laravel Telescope](https://laravel.com/docs/telescope) - the amazing debugging assistant for Laravel applications.

---

**Made with ❤️ for the Node.js and Bun communities**
