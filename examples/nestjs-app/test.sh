#!/bin/bash

# NestJS + NodeScope Test Script
# This script tests the NestJS integration

echo "🧪 Testing NestJS NodeScope Integration"
echo "======================================="
echo ""

# Start the server in the background
echo "1️⃣  Starting NestJS server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start (5 seconds)..."
sleep 5

echo ""
echo "2️⃣  Making test requests..."
echo ""

# Test 1: Homepage
echo "✓ Testing GET /"
curl -s http://localhost:3000/ | head -c 100
echo ""
echo ""

# Test 2: Users list
echo "✓ Testing GET /users"
curl -s http://localhost:3000/users | jq '.' 2>/dev/null || curl -s http://localhost:3000/users
echo ""
echo ""

# Test 3: Single user
echo "✓ Testing GET /users/1"
curl -s http://localhost:3000/users/1 | jq '.' 2>/dev/null || curl -s http://localhost:3000/users/1
echo ""
echo ""

# Test 4: Create user
echo "✓ Testing POST /users"
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}' | jq '.' 2>/dev/null || curl -s -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Test User","email":"test@example.com"}'
echo ""
echo ""

# Test 5: Error endpoint
echo "✓ Testing GET /error (should trigger exception)"
curl -s http://localhost:3000/error || echo "Error caught ✓"
echo ""
echo ""

echo "3️⃣  Dashboard should be available at:"
echo "    http://localhost:3000/_debug"
echo ""
echo "📊 You should see all the above requests tracked in the dashboard!"
echo ""
echo "Press Ctrl+C to stop the server, or kill it with:"
echo "    kill $SERVER_PID"
echo ""
