import { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { NodeScope } from '@vipin733/nodescope';
export declare class AppModule implements NestModule {
    private readonly nodescope;
    constructor(nodescope: NodeScope);
    configure(consumer: MiddlewareConsumer): void;
}
