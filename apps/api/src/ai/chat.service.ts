/**
 * AI Assistant — chat service.
 *
 * Persists conversation in `chat_threads` + `chat_messages`.
 * Each turn: load last N messages → call Claude via AWS Bedrock (or stub) → save reply.
 *
 * The assistant has campaign context: when the client asks "how did Bondi go?",
 * we surface their job summary in the system prompt so the model can answer
 * specifically.
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { chatMessages, chatThreads, jobs } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { chat, type ChatMessage } from './bedrock.client.js';

/** How much history to include each turn (token-bound). */
const HISTORY_LIMIT = 20;
/** Max words per stubbed response — keeps fallback short and on-brand. */

export interface SendMessageInput {
  userId: string;
  threadId?: string;
  content: string;
}

export interface SendMessageResult {
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  assistantContent: string;
  stubbed: boolean;
  model: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  // ─────────────────── threads ───────────────────

  async listThreads(userId: string) {
    const rows = await this.db
      .select({
        id: chatThreads.id,
        title: chatThreads.title,
        createdAt: chatThreads.createdAt,
        lastMessageAt: chatThreads.lastMessageAt,
        messageCount: sql<string | number>`COUNT(${chatMessages.id})`,
      })
      .from(chatThreads)
      .leftJoin(chatMessages, eq(chatMessages.threadId, chatThreads.id))
      .where(eq(chatThreads.userId, userId))
      .groupBy(chatThreads.id)
      .orderBy(desc(chatThreads.lastMessageAt));
    // postgres-js returns COUNT as bigint → string. Coerce explicitly so the
    // wire format is a real JS number.
    return rows.map((r) => ({ ...r, messageCount: Number(r.messageCount) }));
  }

  async getThread(threadId: string, userId: string) {
    const [thread] = await this.db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
      .limit(1);
    if (!thread) throw new NotFoundException('Thread not found');

    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(chatMessages.createdAt);

    return { thread, messages };
  }

  async deleteThread(threadId: string, userId: string) {
    const [thread] = await this.db
      .select({ id: chatThreads.id, userId: chatThreads.userId })
      .from(chatThreads)
      .where(eq(chatThreads.id, threadId))
      .limit(1);
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.userId !== userId) throw new ForbiddenException('Not your thread');
    await this.db.delete(chatThreads).where(eq(chatThreads.id, threadId));
    return { deleted: true };
  }

  // ─────────────────── send a message ───────────────────

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    let threadId = input.threadId;

    // 1. Resolve or create the thread.
    if (threadId) {
      const [thread] = await this.db
        .select({ id: chatThreads.id, userId: chatThreads.userId })
        .from(chatThreads)
        .where(eq(chatThreads.id, threadId))
        .limit(1);
      if (!thread) throw new NotFoundException('Thread not found');
      if (thread.userId !== input.userId) throw new ForbiddenException('Not your thread');
    } else {
      const [created] = await this.db
        .insert(chatThreads)
        .values({
          userId: input.userId,
          title: input.content.slice(0, 60),
          lastMessageAt: new Date(),
        })
        .returning({ id: chatThreads.id });
      threadId = created.id;
    }

    // 2. Persist the user message.
    const [userMsg] = await this.db
      .insert(chatMessages)
      .values({
        threadId,
        role: 'user',
        content: input.content,
      })
      .returning({ id: chatMessages.id });

    // 3. Build the LLM context — system prompt + recent history.
    const recentHistory = await this.db
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(HISTORY_LIMIT);

    const orderedHistory = recentHistory.reverse(); // chronological

    const contextSnippet = await this.gatherClientContext(input.userId);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt(contextSnippet),
      },
      ...orderedHistory.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
    ];

    // 4. Call the model.
    const ai = await chat(messages, { temperature: 0.5, maxTokens: 800 });
    const assistantContent = ai.stubbed
      ? this.stubReply(input.content, contextSnippet)
      : ai.text.trim();

    // 5. Persist assistant reply + bump thread.
    const [assistantMsg] = await this.db
      .insert(chatMessages)
      .values({
        threadId,
        role: 'assistant',
        content: assistantContent,
        tokensInput: ai.tokensInput,
        tokensOutput: ai.tokensOutput,
      })
      .returning({ id: chatMessages.id });

    await this.db
      .update(chatThreads)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatThreads.id, threadId));

    this.logger.log(
      `chat reply · thread ${threadId.slice(0, 8)}.. · ${ai.stubbed ? 'STUB' : ai.model} · tokens ${ai.tokensInput}/${ai.tokensOutput}`,
    );

    return {
      threadId,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
      assistantContent,
      stubbed: ai.stubbed,
      model: ai.model,
    };
  }

  // ─────────────────── helpers ───────────────────

  /** Top-line stats so the assistant can answer "how's my Bondi run?" etc. */
  private async gatherClientContext(userId: string) {
    const recent = await this.db
      .select({
        code: jobs.jobCode,
        title: jobs.title,
        status: jobs.status,
        leafletCount: jobs.leafletCount,
        startDate: jobs.startDate,
        actualCompletedAt: jobs.actualCompletedAt,
      })
      .from(jobs)
      .where(eq(jobs.clientUserId, userId))
      .orderBy(desc(jobs.createdAt))
      .limit(5);

    if (!recent.length) return 'No campaigns yet.';

    const lines = recent.map(
      (j) =>
        `- ${j.code} "${j.title}" · ${j.leafletCount} leaflets · status=${j.status}${
          j.startDate ? ` · started ${j.startDate}` : ''
        }${j.actualCompletedAt ? ` · completed ${j.actualCompletedAt.toISOString().slice(0, 10)}` : ''}`,
    );
    return `Recent campaigns for this client:\n${lines.join('\n')}`;
  }

  private systemPrompt(contextSnippet: string) {
    return [
      'You are DropTrack AI Assistant — a friendly, concise marketing copilot for Australian agents using',
      'DropTrack to run leaflet-distribution campaigns. Answer in plain English.',
      '',
      'Style:',
      '- Direct. No fluff. No "I am an AI assistant" preambles.',
      '- Anchor advice in Australian context (suburbs, AU industry norms, weather, seasonality).',
      '- If the user asks for a specific campaign metric, use the data you can see below — never invent.',
      '- If you do not know, say so and suggest where to look (e.g. /admin/track/[id], the AI Campaign Report).',
      '',
      contextSnippet,
    ].join('\n');
  }

  private stubReply(userText: string, context: string): string {
    const lower = userText.toLowerCase();
    if (lower.includes('campaign') && (lower.includes('how') || lower.includes('result'))) {
      return [
        `Here's what I can see right now:`,
        '',
        context,
        '',
        `Open the campaign in **/admin/track/[id]** for live drops + the full AI Campaign Report once it completes.`,
        '',
        `(Note: this reply was generated by the local stub — Bedrock isn't configured yet, so I can't reason freely.)`,
      ].join('\n');
    }
    if (lower.includes('re-run') || lower.includes('rerun') || lower.includes('repeat')) {
      return [
        `Most AU real-estate agents see a ~20% uplift on a clean repeat 18–21 days after the first drop.`,
        `For clinics it's ~35 days; political campaigns tighten to ~10 days.`,
        '',
        `Open any completed job and look for the **AI Re-run Recommender** card — it picks a specific date based on your coverage and history.`,
        '',
        `(Stub reply — Bedrock not configured.)`,
      ].join('\n');
    }
    if (lower.includes('price') || lower.includes('cost') || lower.includes('quote')) {
      return [
        `Pricing is ~$0.20 per leaflet plus a 3% platform fee, GST inclusive. AI Smart Zones gives you an exact quote the moment you draw a polygon on the map.`,
        '',
        `(Stub reply — Bedrock not configured.)`,
      ].join('\n');
    }
    return [
      `Got it. ${context}`,
      '',
      `Ask me about a specific campaign by name or job code, or things like "when should I re-run Bondi?".`,
      '',
      `(Stub reply — once you wire AWS_BEDROCK_REGION I'll switch to Claude.)`,
    ].join('\n');
  }
}
