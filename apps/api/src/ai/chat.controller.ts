import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { ChatService } from './chat.service.js';

const sendSchema = z.object({
  threadId: z.string().uuid().optional(),
  content: z.string().min(1).max(4000),
});

@Controller('ai/chat')
@Roles('client', 'admin')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('threads')
  threads(@CurrentUser() user: AuthedUser) {
    return this.chat.listThreads(user.id);
  }

  @Get('threads/:id')
  thread(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.chat.getThread(id, user.id);
  }

  @Delete('threads/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    await this.chat.deleteThread(id, user.id);
  }

  @Post('messages')
  send(@Body() body: unknown, @CurrentUser() user: AuthedUser) {
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    return this.chat.send({
      userId: user.id,
      threadId: parsed.data.threadId,
      content: parsed.data.content,
    });
  }
}
