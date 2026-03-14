import { db } from './db';
import { agentMemory } from './schema';
import { eq } from 'drizzle-orm';

export async function getAllMemory(): Promise<{ key: string; value: string; importance: string }[]> {
  const memories = await db
    .select({
      key: agentMemory.memoryKey,
      value: agentMemory.value,
      importance: agentMemory.importance,
    })
    .from(agentMemory)
    .orderBy(agentMemory.importance);
  
  return memories.map(m => ({
    key: m.key || '',
    value: m.value || '',
    importance: m.importance || 'medium'
  }));
}

export async function getMemory(key: string): Promise<string | null> {
  const result = await db
    .select({ value: agentMemory.value })
    .from(agentMemory)
    .where(eq(agentMemory.memoryKey, key))
    .limit(1);
  
  return result.length > 0 ? result[0].value : null;
}

export async function setMemory(key: string, value: string, importance: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
  await db
    .insert(agentMemory)
    .values({
      memoryKey: key,
      value,
      importance,
    })
    .onConflictDoUpdate({
      target: agentMemory.memoryKey,
      set: {
        value,
        importance,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMemory(key: string): Promise<void> {
  await db
    .delete(agentMemory)
    .where(eq(agentMemory.memoryKey, key));
}

export async function clearAllMemory(): Promise<void> {
  await db.delete(agentMemory);
}

export function formatMemoryForPrompt(): string {
  return '';
}

export async function getFormattedMemory(): Promise<string> {
  const memories = await getAllMemory();
  
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
