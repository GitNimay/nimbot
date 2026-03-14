import { db } from './db';
import { agentMemory } from './schema';
import { eq, and } from 'drizzle-orm';

export async function getAllMemory(chatId: number): Promise<{ key: string; value: string; importance: string }[]> {
  const memories = await db
    .select({
      key: agentMemory.memoryKey,
      value: agentMemory.value,
      importance: agentMemory.importance,
    })
    .from(agentMemory)
    .where(eq(agentMemory.chatId, chatId))
    .orderBy(agentMemory.importance);
  
  return memories.map(m => ({
    key: m.key || '',
    value: m.value || '',
    importance: m.importance || 'medium'
  }));
}

export async function getMemory(chatId: number, key: string): Promise<string | null> {
  const result = await db
    .select({ value: agentMemory.value })
    .from(agentMemory)
    .where(and(eq(agentMemory.chatId, chatId), eq(agentMemory.memoryKey, key)))
    .limit(1);
  
  return result.length > 0 ? result[0].value : null;
}

export async function setMemory(chatId: number, key: string, value: string, importance: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
  await db
    .insert(agentMemory)
    .values({
      chatId,
      memoryKey: key,
      value,
      importance,
    })
    .onConflictDoUpdate({
      target: [agentMemory.chatId, agentMemory.memoryKey],
      set: {
        value,
        importance,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMemory(chatId: number, key: string): Promise<void> {
  await db
    .delete(agentMemory)
    .where(and(eq(agentMemory.chatId, chatId), eq(agentMemory.memoryKey, key)));
}

export async function clearAllMemory(chatId: number): Promise<void> {
  await db.delete(agentMemory).where(eq(agentMemory.chatId, chatId));
}

export function formatMemoryForPrompt(): string {
  return '';
}

export async function getFormattedMemory(chatId: number): Promise<string> {
  const memories = await getAllMemory(chatId);
  
  if (memories.length === 0) {
    return '';
  }
  
  const important = memories.filter(m => m.importance === 'high');
  const medium = memories.filter(m => m.importance === 'medium');
  const low = memories.filter(m => m.importance === 'low');
  
  let formatted = '\n\n📌 IMPORTANT MEMORY:\n';
  
  if (important.length > 0) {
    formatted += 'High Priority:\n';
    for (const m of important) {
      formatted += `• ${m.key}: ${m.value}\n`;
    }
  }
  
  if (medium.length > 0) {
    formatted += 'Medium Priority:\n';
    for (const m of medium) {
      formatted += `• ${m.key}: ${m.value}\n`;
    }
  }
  
  if (low.length > 0) {
    formatted += 'Other:\n';
    for (const m of low) {
      formatted += `• ${m.key}: ${m.value}\n`;
    }
  }
  
  return formatted;
}
