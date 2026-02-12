# 🧪 Testing the NestJS + NodeScope Integration

This guide shows you how to test the NestJS example application with NodeScope.

## Quick Start

### Option 1: Automated Test Script

Run the automated test script:

```bash
./test.sh
```

This will:
- Start the NestJS server
- Make several test requests
- Show you the results
- Tell you where to find the dashboard

### Option 2: Manual Testing

#### 1. Start the Development Server

```bash
npm run dev
```

You should see:
```
🚀 NestJS app running on http://localhost:3000
📊 NodeScope dashboard: http://localhost:3000/_debug

Try these endpoints:
  - GET  http://localhost:3000/
  - GET  http://localhost:3000/users
  - GET  http://localhost:3000/users/1
  - POST http://localhost:3000/users
  - GET  http://localhost:3000/error
```

#### 2. Open the Dashboard

Open your browser to: **http://localhost:3000/_debug**

You should see the NodeScope dashboard with:
- Real-time request tracking
- Request/response details
- Timing information
- Exception tracking

#### 3. Make Test Requests

Open a new terminal and run these commands:

**Test 1: Homepage**
```bash
curl http://localhost:3000/
```

**Test 2: Get all users**
```bash
curl http://localhost:3000/users
```

Expected response:
```json
[
  {"id":1,"name":"Alice","email":"alice@example.com"},
  {"id":2,"name":"Bob","email":"bob@example.com"},
  {"id":3,"name":"Charlie","email":"charlie@example.com"}
]
```

**Test 3: Get specific user**
```bash
curl http://localhost:3000/users/1
```

**Test 4: Create a new user**
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'
```

**Test 5: Trigger an error (to test exception tracking)**
```bash
curl http://localhost:3000/error
```

#### 4. Watch the Dashboard

Go back to the dashboard at http://localhost:3000/_debug

You should see:
- ✅ All 5+ requests logged
- ✅ Request methods (GET, POST)
- ✅ Response status codes
- ✅ Response times
- ✅ Request/response payloads
- ✅ The error from `/error` endpoint in exceptions section

## What to Look For

### ✅ Request Tracking
- Each request should appear in the dashboard
- Shows: Method, URL, Status Code, Duration
- Click on a request to see full details

### ✅ Request/Response Details
- Request headers
- Request body (for POST requests)
- Response headers
- Response body
- Query parameters

### ✅ Exception Tracking
- The `/error` endpoint should log an exception
- Stack trace should be visible
- Error message: "This is a test error to demonstrate exception tracking"

### ✅ Real-Time Updates
- Dashboard updates in real-time as requests come in
- No need to refresh the page

## Advanced Testing

### Test with Multiple Concurrent Requests

```bash
# Make 10 concurrent requests
for i in {1..10}; do
  curl http://localhost:3000/users &
done
wait
```

Watch them all appear in the dashboard!

### Test Different HTTP Methods

```bash
# GET request
curl http://localhost:3000/users

# POST request  
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com"}'

# Error handling
curl http://localhost:3000/users/999
```

### Test with Query Parameters

```bash
curl "http://localhost:3000/users?filter=active&sort=name"
```

Check the dashboard - query parameters should be visible in the request details.

## Troubleshooting

### Server won't start?

Make sure you installed dependencies:
```bash
npm install
```

### Dashboard shows nothing?

1. Make sure the server is running
2. Make some requests first
3. Refresh the dashboard page
4. Check console for errors

### "Cannot find module" errors?

Make sure the core package is built:
```bash
cd ../../packages/core
npm run build
cd -
npm install
```

### Port 3000 already in use?

Kill the existing process:
```bash
lsof -ti:3000 | xargs kill -9
```

Or change the port in `src/main.ts`:
```typescript
await app.listen(3001); // Use port 3001 instead
```

## Integration Patterns Demonstrated

This example shows:

✅ **Module Integration** - `NodeScopeModule.forRoot()`
✅ **Middleware Setup** - Applied to all routes via `MiddlewareConsumer`
✅ **Dashboard Routes** - `setupNodeScopeRoutes()` helper
✅ **Request Tracking** - All incoming HTTP requests
✅ **Exception Tracking** - Unhandled errors and exceptions
✅ **Response Capture** - Full request/response cycle

## Next Steps

- Try the async configuration with `ConfigService`
- Implement the interceptor approach instead of middleware
- Add database queries and watch them in NodeScope
- Deploy to production (remember to disable or secure the dashboard!)

## Need Help?

- Check the [main README](../../packages/core/README.md)
- Look at [other examples](../)
- Open an issue on GitHub
