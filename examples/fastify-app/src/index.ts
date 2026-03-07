import Fastify from 'fastify';
import { NodeScope } from '@nodescope/core';

// Initialize Fastify
const fastify = Fastify({ logger: false });

// Initialize NodeScope
const nodescope = new NodeScope({
  storage: 'memory',
  dashboardPath: '/_debug',
  watchers: {
    request: true,
    query: true,
    log: true,
    exception: true,
  }
});

// Configure Database (mocking a database query since sqlite is the storage, we'll just log an event or log directly to nodescope, or simulate query)
const db = {
  query: async (sql: string, params?: any[]) => {
    const start = process.hrtime();
    // Simulate DB latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    
    // Log the query to NodeScope
    const entry = nodescope.queryWatcher.record({
      sql,
      bindings: params,
      duration,
      connection: 'sqlite',
    });
    
    if (entry) {
      nodescope.recordEntry(entry);
    }
    
    return [{ id: 1, name: 'John Doe' }];
  }
};

import { fastifyNodeScope } from '@nodescope/core';

// Register NodeScope Fastify Plugin
fastify.register(fastifyNodeScope as any, { nodescope });


// Sample Routes
fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

fastify.get('/users', async (request, reply) => {
  const users = await db.query('SELECT * FROM users');
  console.log('Fetched users:', users.length);
  return users;
});

fastify.get('/error', async (request, reply) => {
  throw new Error('This is a simulated error');
});

import { attachWebSocket } from '@nodescope/core';

// Start the server
const start = async () => {
  try {
    await nodescope.initialize();
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    attachWebSocket(fastify.server as any, nodescope);
    console.log('Fastify server listening on http://localhost:3000');
    console.log('NodeScope Dashboard available at http://localhost:3000/_debug');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
