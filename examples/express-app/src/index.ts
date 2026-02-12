import express from 'express';
import { createServer } from 'http';
import { NodeScope, mountExpressRoutes, attachWebSocket } from '@nodescope/core';

const app = express();

// Parse JSON bodies
app.use(express.json());

// Create NodeScope instance
const nodescope = new NodeScope({
  enabled: true,
  storage: 'memory', // Use 'sqlite' for persistence
  dashboardPath: '/_debug',
  watchers: {
    request: {
      enabled: true,
      ignorePaths: ['/_debug', '/favicon.ico'],
    },
    query: { enabled: true, slowThreshold: 100 },
    cache: true,
    log: { enabled: true, level: 'debug' },
    exception: true,
    httpClient: true,
    event: true,
    job: true,
  },
  realtime: true,
  pruneAfterHours: 24,
});

// Initialize and mount routes
async function start() {
  await nodescope.initialize();
  await mountExpressRoutes(app, nodescope);

  // Example routes
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the NodeScope demo!', timestamp: new Date() });
  });

  app.get('/api/users', async (req, res) => {
    // Simulate some processing
    console.log('📍 Request received at /api/users');
    console.log('📍 NodeScope context:', (req as any).nodescope);
    
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];
    
    // Check if request watcher is enabled
    console.log('📍 Request watcher enabled:', nodescope.requestWatcher.enabled);
    console.log('📍 NodeScope enabled:', nodescope.isEnabled);
    
    res.json(users);
  });

  app.get('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (id === 999) {
      throw new Error('User not found!');
    }
    res.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
  });

  app.post('/api/users', (req, res) => {
    const { name, email } = req.body;
    console.log('Creating new user:', { name, email });
    res.status(201).json({ id: Date.now(), name, email, created: true });
  });

  app.get('/api/slow', async (req, res) => {
    // Simulate a slow endpoint
    await new Promise(resolve => setTimeout(resolve, 2000));
    res.json({ message: 'This was slow!', duration: '2s' });
  });

  app.get('/api/external', async (req, res) => {
    // Make an external HTTP request (will be tracked)
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data = await response.json();
    res.json(data);
  });

  app.get('/api/error', (req, res) => {
    // Intentionally throw an error
    throw new Error('This is a test error!');
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err.message);
    
    // Record exception
    if (nodescope.exceptionWatcher.enabled) {
      const entry = nodescope.exceptionWatcher.record({
        batchId: (req as any).nodescope?.batchId,
        error: err,
        context: {
          url: req.url,
          method: req.method,
        },
      });
      nodescope.recordEntry(entry);
    }
    
    res.status(500).json({ error: err.message });
  });

  const port = process.env.PORT || 3009;
  const server = createServer(app);
  
  // Attach WebSocket for real-time updates
  attachWebSocket(server, nodescope);
  
  server.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`⚡ NodeScope dashboard at http://localhost:${port}/_debug`);
  });
}

console.log('🔧 Starting NodeScope Express example...');

start()
  .then(() => {
    console.log('✅ Server started successfully');  
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
