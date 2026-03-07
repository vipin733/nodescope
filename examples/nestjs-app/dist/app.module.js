"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const nodescope_1 = require("@vipin733/nodescope");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
let AppModule = class AppModule {
    constructor(nodescope) {
        this.nodescope = nodescope;
        console.log('[AppModule] Constructed with NodeScope:', !!nodescope);
    }
    configure(consumer) {
        console.log('[AppModule] Configuring middleware...');
        const middleware = new nodescope_1.NodeScopeMiddleware(this.nodescope);
        consumer
            .apply((req, res, next) => middleware.use(req, res, next))
            .forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nodescope_1.NodeScopeModule.forRoot({
                storage: 'memory',
                dashboardPath: '/_debug',
                enabled: true,
                realtime: true,
            }),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    }),
    __metadata("design:paramtypes", [nodescope_1.NodeScope])
], AppModule);
//# sourceMappingURL=app.module.js.map