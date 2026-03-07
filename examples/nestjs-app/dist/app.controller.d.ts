import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getUsers(): {
        id: number;
        name: string;
        email: string;
    }[];
    getUser(id: string): {
        id: number;
        name: string;
        email: string;
    };
    createUser(body: {
        name: string;
        email: string;
    }): {
        createdAt: string;
        name: string;
        email: string;
        id: number;
    };
    triggerError(): void;
}
