import { db } from './db';
import { conversations, messages, tasks, schedules, apiUsage } from './schema';
import { eq, desc, and, gte, lte, isNull } from 'drizzle-orm';

export async function getOrCreateConversation(chatId: number, sessionName?: string) {
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.telegramChatId, chatId), eq(conversations.isActive, true)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, existing[0].id));
    return existing[0];
  }

  const result = await db
    .insert(conversations)
    .values({
      telegramChatId: chatId,
      sessionName: sessionName || `Chat ${new Date().toLocaleDateString()}`,
    })
    .returning();
  return result[0];
}

export async function startNewChat(chatId: number) {
  const currentConv = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.telegramChatId, chatId), eq(conversations.isActive, true)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (currentConv.length > 0) {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, currentConv[0].id))
      .orderBy(messages.createdAt);

    if (msgs.length > 0) {
      const userMessages = msgs.filter(m => m.role === 'user').map(m => m.content);
      const summary = userMessages.slice(0, 5).join(' | ');

      await db
        .update(conversations)
        .set({ isActive: false, summary })
        .where(eq(conversations.id, currentConv[0].id));
    } else {
      await db
        .update(conversations)
        .set({ isActive: false })
        .where(eq(conversations.id, currentConv[0].id));
    }
  }

  const result = await db
    .insert(conversations)
    .values({
      telegramChatId: chatId,
      sessionName: `Chat ${new Date().toLocaleDateString()}`,
    })
    .returning();
  return result[0];
}

export async function getConversation(conversationId: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  return result[0];
}

export async function getConversationsByChatId(chatId: number) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.telegramChatId, chatId))
    .orderBy(desc(conversations.createdAt));
}

export async function addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string) {
  const result = await db
    .insert(messages)
    .values({
      conversationId,
      role,
      content,
    })
    .returning();
  return result[0];
}

export async function getMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function getConversationContext(chatId: number, limit = 10) {
  const conv = await getOrCreateConversation(chatId);
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return { conversation: conv, messages: msgs.reverse() };
}

export async function logApiUsage(
  provider: 'openrouter' | 'gemini' | 'groq',
  model: string,
  tokensUsed: number,
  success: boolean,
  errorMessage?: string,
  fallbackUsed = false,
  fallbackFrom?: string
) {
  await db
    .insert(apiUsage)
    .values({
      provider,
      model,
      tokensUsed,
      success,
      errorMessage,
      fallbackUsed,
      fallbackFrom,
    });
}

export async function getApiUsageStats() {
  return db
    .select()
    .from(apiUsage)
    .orderBy(desc(apiUsage.createdAt))
    .limit(100);
}
