# NestJS NodeScope Example

A complete example of integrating NodeScope with a NestJS application.

## Features Demonstrated

- ✅ NestJS module integration
- ✅ Middleware-based request tracking
- ✅ Exception tracking
- ✅ Dashboard routes setup
- ✅ Multiple API endpoints

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run the Application

```bash
npm run dev
```

The app will start on `http://localhost:3000`

### Access NodeScope Dashboard

Open `http://localhost:3000/_debug` in your browser to see the NodeScope dashboard.

## Test the Integration

### Make Some Requests

```bash
# Get all users
curl http://localhost:3000/users

# Get a specific user
curl http://localhost:3000/users/1

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Trigger an error (to test exception tracking)
curl http://localhost:3000/error
```

### View Tracked Data

1. Open `http://localhost:3000/_debug`
2. See all requests, their timing, payloads, and responses
3. View exceptions with stack traces
4. Monitor real-time as requests come in

## Integration Patterns

### Basic Module Integration

```typescript
@Module({
  imports: [
    NodeScopeModule.forRoot({
      storage: 'memory',
      dashboardPath: '/_debug',
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(NodeScopeMiddleware).forRoutes('*');
  }
}
```

### With ConfigService

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    NodeScopeModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        storage: config.get('NODESCOPE_STORAGE'),
        enabled: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
```

### Using Interceptor Instead of Middleware

```typescript
@Module({
  imports: [NodeScopeModule.forRoot()],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: NodeScopeInterceptor,
    },
  ],
})
```

## Learn More

- [NodeScope Documentation](../../packages/core/README.md)
- [NestJS Documentation](https://docs.nestjs.com)
