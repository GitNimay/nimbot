import { db } from './db';
import { tasks, taskReminders } from './schema';
import { eq, desc, and, isNull, gte, lte } from 'drizzle-orm';

export async function createTask(
  title: string,
  conversationId?: string,
  description?: string,
  dueDate?: Date,
  taskDate?: Date
) {
  const result = await db
    .insert(tasks)
    .values({
      title,
      description,
      dueDate,
      taskDate: taskDate || new Date(),
      conversationId,
    })
    .returning();
  return result[0];
}

export async function getTasks(conversationId?: string) {
  if (conversationId) {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.conversationId, conversationId))
      .orderBy(desc(tasks.createdAt));
  }
  return db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.createdAt));
}

export async function getTodaysTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.createdAt, today),
        lte(tasks.createdAt, tomorrow)
      )
    )
    .orderBy(desc(tasks.createdAt));
}

export async function getPendingTasks() {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.status, 'pending'))
    .orderBy(desc(tasks.createdAt));
}

export async function updateTaskStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };
  
  if (status === 'completed') {
    updateData.completedAt = new Date();
  }

  const result = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();
  return result[0];
}

export async function deleteTask(id: string) {
  await db
    .delete(tasks)
    .where(eq(tasks.id, id));
}

export async function getTaskById(id: string) {
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));
  return result[0];
}

export async function completeTaskFromText(conversationId: string, completedTitles: string[]) {
  const allTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.conversationId, conversationId),
        eq(tasks.status, 'pending')
      )
    );

  const completed: string[] = [];
  
  for (const task of allTasks) {
    const matched = completedTitles.find(title => 
      task.title.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(task.title.toLowerCase())
    );
    
    if (matched) {
      await updateTaskStatus(task.id, 'completed');
      completed.push(task.title);
    }
  }
  
  return completed;
}

export async function getTasksByDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.taskDate, startOfDay),
        lte(tasks.taskDate, endOfDay)
      )
    )
    .orderBy(desc(tasks.createdAt));
}

export async function getAllTasksGroupedByDate() {
  const allTasks = await db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.createdAt));
  
  const grouped: Record<string, typeof allTasks> = {};
  for (const task of allTasks) {
    let taskDateVal = task.createdAt ? new Date(task.createdAt) : new Date();
    if (isNaN(taskDateVal.getTime())) {
      taskDateVal = new Date();
    }
    
    const dateKey = taskDateVal.toISOString().split('T')[0];
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(task);
  }
  
  return grouped;
}

export async function getTodaysPendingTasksWithReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'pending'),
        gte(tasks.taskDate, today),
        lte(tasks.taskDate, tomorrow)
      )
    );
}

export async function createOrUpdateReminder(taskId: string, chatId: number, nextReminder: Date) {
  const existing = await db
    .select()
    .from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));

  if (existing.length > 0) {
    return db
      .update(taskReminders)
      .set({ lastReminderSent: new Date(), nextReminderAt: nextReminder })
      .where(eq(taskReminders.taskId, taskId));
  }

  return db
    .insert(taskReminders)
    .values({
      taskId,
      chatId,
      lastReminderSent: new Date(),
      nextReminderAt: nextReminder,
    });
}
