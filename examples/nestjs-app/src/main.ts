import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupNodeScopeRoutes } from '@vipin733/nodescope';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get NodeScope instance and set up dashboard routes
  const nodescope = app.get('NODESCOPE_INSTANCE');
  await setupNodeScopeRoutes(app, nodescope);

  await app.listen(3000);
  
  console.log('🚀 NestJS app running on http://localhost:3000');
  console.log('📊 NodeScope dashboard: http://localhost:3000/_debug');
  console.log('');
  console.log('Try these endpoints:');
  console.log('  - GET  http://localhost:3000/');
  console.log('  - GET  http://localhost:3000/users');
  console.log('  - GET  http://localhost:3000/users/1');
  console.log('  - POST http://localhost:3000/users');
  console.log('  - GET  http://localhost:3000/error');
}

bootstrap();
