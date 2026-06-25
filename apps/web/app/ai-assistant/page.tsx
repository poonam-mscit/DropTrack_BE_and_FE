'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface ChatThread {
  id: string;
  title: string | null;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface SendResult {
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  assistantContent: string;
  stubbed: boolean;
  model: string;
}

const SUGGESTED_PROMPTS = [
  'How did my last campaign go?',
  'When should I re-run Bondi?',
  'What if my coverage trails the deadline?',
  'Suggest a hook for a clinic flyer',
];

export default function AiAssistantPage() {
  const router = useRouter();
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial — auth + load threads
  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSessionState(s);
    void reloadThreads();
  }, [router]);

  // Auto-scroll bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function reloadThreads() {
    try {
      const ts = await api.get<ChatThread[]>('/api/ai/chat/threads');
      setThreads(ts);
    } catch (err) {
      console.error(err);
    }
  }

  async function openThread(id: string) {
    setActiveThread(id);
    setMessages([]);
    setLoadingThread(true);
    try {
      const data = await api.get<{ thread: ChatThread; messages: ChatMessage[] }>(
        `/api/ai/chat/threads/${id}`,
      );
      setMessages(data.messages);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingThread(false);
    }
  }

  function newConversation() {
    setActiveThread(null);
    setMessages([]);
    setError(null);
    setDraft('');
    textareaRef.current?.focus();
  }

  async function send(promptOverride?: string) {
    const content = (promptOverride ?? draft).trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setDraft('');

    // Optimistic — show user message immediately + a "thinking" placeholder.
    const tempUserId = `tmp-u-${Date.now()}`;
    const tempAssistantId = `tmp-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        threadId: activeThread ?? '',
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      },
      {
        id: tempAssistantId,
        threadId: activeThread ?? '',
        role: 'assistant',
        content: '…',
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const result = await api.post<SendResult>('/api/ai/chat/messages', {
        threadId: activeThread ?? undefined,
        content,
      });

      // Replace placeholders with real ids/content.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempUserId
            ? { ...m, id: result.userMessageId, threadId: result.threadId }
            : m.id === tempAssistantId
              ? {
                  ...m,
                  id: result.assistantMessageId,
                  threadId: result.threadId,
                  content: result.assistantContent,
                }
              : m,
        ),
      );

      if (!activeThread) {
        setActiveThread(result.threadId);
      }
      void reloadThreads();
    } catch (err) {
      // Remove optimistic placeholders on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId));
      const msg = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof msg === 'string' ? msg : (err as Error).message);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function deleteThread(id: string) {
    if (!confirm('Delete this conversation? It cannot be undone.')) return;
    try {
      await api.delete(`/api/ai/chat/threads/${id}`);
      if (activeThread === id) newConversation();
      void reloadThreads();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!session) return null;

  return (
    <div className="flex h-screen">
      <AppSidebar active="ai" />

      {/* Thread list */}
      <aside className="ml-[252px] w-[280px] border-r border-border bg-bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <button
            onClick={newConversation}
            className="btn-primary w-full justify-center"
          >
            <Plus size={14} /> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-text-muted">
              No conversations yet. Ask anything to start.
            </div>
          )}
          {threads.map((t) => {
            const isActive = activeThread === t.id;
            return (
              <div
                key={t.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-[10px] cursor-pointer transition-colors mb-1 ${
                  isActive
                    ? 'bg-primary-50 text-text-primary'
                    : 'hover:bg-bg-muted text-text-secondary'
                }`}
                onClick={() => openThread(t.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${isActive ? 'font-semibold text-primary' : 'font-medium'}`}>
                    {t.title ?? 'Untitled'}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {t.messageCount} message{t.messageCount === 1 ? '' : 's'} ·{' '}
                    {timeAgo(t.lastMessageAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteThread(t.id);
                  }}
                  className={`opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger p-1 transition-opacity ${
                    isActive ? 'opacity-100' : ''
                  }`}
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col bg-bg-base">
        <header className="px-8 py-5 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AI Assistant</h1>
              <p className="text-xs text-text-muted">
                Your marketing copilot for DropTrack campaigns
              </p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl mx-auto">
            {!activeThread && messages.length === 0 && (
              <div className="text-center pt-10">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white mb-4"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
                >
                  <Sparkles size={28} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">
                  How can I help with your campaigns?
                </h2>
                <p className="text-text-muted text-sm mb-6">
                  I know your jobs, dropper roster, and what the AI Campaign Reports said.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="text-left text-sm p-3 rounded-xl border border-border bg-white hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingThread && (
              <div className="text-text-muted text-sm">Loading conversation…</div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-white px-8 py-4">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask anything about your campaigns, droppers, or AU agent strategy…"
                rows={2}
                className="flex-1 resize-none border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                disabled={sending}
              />
              <button
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                className="btn-primary disabled:opacity-50 px-4 py-3 h-[52px] shrink-0"
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-2 text-center">
              AI Assistant uses Claude 3.5 Haiku via AWS Bedrock when configured · falls back to stub copy in
              local dev
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 mb-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
        >
          <Sparkles size={14} />
        </div>
      )}
      <div
        className={`px-4 py-3 rounded-2xl max-w-[640px] text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-white border border-border text-text-primary rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-text-primary text-white shrink-0 text-xs font-bold">
          You
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
