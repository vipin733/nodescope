import { Hono } from 'hono';
import { nodescope } from '@nodescope/core';

const app = new Hono();

// Mount NodeScope middleware (handles everything automatically)
app.use('*', nodescope({
  storage: 'memory',
  dashboardPath: '/_debug',
  watchers: {
    request: true,
    log: { level: 'debug' },
    exception: true,
    httpClient: true,
  },
}));

// Routes
app.get('/', (c) => {
  return c.json({ message: 'Welcome to Hono + NodeScope!', timestamp: new Date() });
});

app.get('/api/users', (c) => {
  console.log('Fetching users...');
  return c.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ]);
});

app.get('/api/users/:id', (c) => {
  const id = c.req.param('id');
  console.log(`Fetching user ${id}`);
  return c.json({ id, name: `User ${id}` });
});

app.post('/api/users', async (c) => {
  const body = await c.req.json();
  console.log('Creating user:', body);
  return c.json({ ...body, id: Date.now() }, 201);
});

app.get('/api/external', async (c) => {
  // External request will be tracked
  const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
  const data = await res.json();
  return c.json(data);
});

app.get('/api/error', () => {
  throw new Error('Test error from Hono!');
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err.message);
  return c.json({ error: err.message }, 500);
});

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Hono server running at http://localhost:${port}`);
console.log(`⚡ NodeScope dashboard at http://localhost:${port}/_debug`);

export default {
  port,
  fetch: app.fetch,
};
