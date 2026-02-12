import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from NestJS with NodeScope!';
  }

  getUsers() {
    // Simulate some work
    return [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];
  }

  createUser(data: { name: string; email: string }) {
    // Simulate user creation
    return {
      id: Math.floor(Math.random() * 1000),
      ...data,
      createdAt: new Date().toISOString(),
    };
  }
}
