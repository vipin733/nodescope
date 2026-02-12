# NodeScope

A Laravel Telescope-inspired debugging and monitoring package for Node.js/Bun applications.

## Features

- 📊 **Real-time Monitoring** - Watch requests, queries, and logs as they happen
- 💾 **Multiple Storage Options** - In-memory, SQLite, MySQL, PostgreSQL
- 🔌 **Framework Agnostic** - Works with Express, Hono, Fastify, and more
- 🎨 **Beautiful Dashboard** - React-based UI with dark/light mode
- 🚀 **Zero Config** - Sensible defaults, just install and go

## Installation

```bash
npm install @nodescope/core
# or
pnpm add @nodescope/core
# or
bun add @nodescope/core
```

## Quick Start

### Express.js

```typescript
import express from 'express';
import { NodeScope } from '@nodescope/core';

const app = express();
const nodescope = new NodeScope({
  storage: 'sqlite',
  dashboardPath: '/_debug',
});

app.use(nodescope.middleware());

app.get('/', (req, res) => res.send('Hello!'));

app.listen(3000);
// Dashboard at: http://localhost:3000/_debug
```

### Hono (Bun)

```typescript
import { Hono } from 'hono';
import { nodescope } from '@nodescope/core';

const app = new Hono();

app.use('*', nodescope({ storage: 'memory' }));

export default app;
```

## Watchers

NodeScope includes the following watchers:

| Watcher | Description |
|---------|-------------|
| Request | HTTP requests and responses |
| Query | Database queries with timing |
| Cache | Cache operations (Redis, memory) |
| Log | Console and custom logs |
| Exception | Errors with stack traces |
| HTTP Client | Outgoing HTTP requests |
| Event | Application events |
| Job | Background job processing |

## Storage Options

- **memory** - Fast, in-memory storage (default, development only)
- **sqlite** - Single file database, great for local dev
- **postgresql** - Production-ready with connection pooling
- **mysql** - Production-ready with connection pooling

## License

MIT
