import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('users')
  getUsers() {
    return this.appService.getUsers();
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    const users = this.appService.getUsers();
    const user = users.find(u => u.id === parseInt(id));
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  @Post('users')
  createUser(@Body() body: { name: string; email: string }) {
    return this.appService.createUser(body);
  }

  @Get('error')
  triggerError() {
    throw new Error('This is a test error to demonstrate exception tracking');
  }
}
