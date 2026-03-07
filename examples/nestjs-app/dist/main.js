"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const nodescope_1 = require("@vipin733/nodescope");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const nodescope = app.get('NODESCOPE_INSTANCE');
    await (0, nodescope_1.setupNodeScopeRoutes)(app, nodescope);
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
//# sourceMappingURL=main.js.map