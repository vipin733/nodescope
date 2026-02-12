import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { 
  NodeScope,
  NodeScopeModule, 
  NodeScopeMiddleware 
} from '@vipin733/nodescope';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    NodeScopeModule.forRoot({
      storage: 'memory',
      dashboardPath: '/_debug',
      enabled: true,
      realtime: true,  // Enable WebSocket for real-time updates
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  constructor(private readonly nodescope: NodeScope) {
    console.log('[AppModule] Constructed with NodeScope:', !!nodescope);
  }

  configure(consumer: MiddlewareConsumer) {
    console.log('[AppModule] Configuring middleware...');
    // Apply NodeScope middleware to all routes
    const middleware = new NodeScopeMiddleware(this.nodescope);
    consumer
      .apply((req, res, next) => middleware.use(req, res, next))
      .forRoutes('*');
  }
}
