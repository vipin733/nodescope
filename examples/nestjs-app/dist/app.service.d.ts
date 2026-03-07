export declare class AppService {
    getHello(): string;
    getUsers(): {
        id: number;
        name: string;
        email: string;
    }[];
    createUser(data: {
        name: string;
        email: string;
    }): {
        createdAt: string;
        name: string;
        email: string;
        id: number;
    };
}
