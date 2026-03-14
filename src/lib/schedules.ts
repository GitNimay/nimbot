import { db } from './db';
import { schedules } from './schema';
import { eq, desc, and, gte, lte, isNull, or, isNotNull } from 'drizzle-orm';

export async function createSchedule(
  title: string,
  eventTime: Date,
  conversationId?: string,
  description?: string
) {
  const result = await db
    .insert(schedules)
    .values({
      title,
      eventTime,
      description,
      conversationId,
    })
    .returning();
  return result[0];
}

export async function getSchedules(conversationId?: string) {
  if (conversationId) {
    return db
      .select()
      .from(schedules)
      .where(eq(schedules.conversationId, conversationId))
      .orderBy(schedules.eventTime);
  }
  return db
    .select()
    .from(schedules)
    .orderBy(schedules.eventTime);
}

export async function getTodaysSchedules() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db
    .select()
    .from(schedules)
    .where(
      and(
        gte(schedules.eventTime, today),
        lte(schedules.eventTime, tomorrow)
      )
    )
    .orderBy(schedules.eventTime);
}

export async function getUpcomingSchedules(hoursAhead = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return db
    .select()
    .from(schedules)
    .where(
      and(
        gte(schedules.eventTime, now),
        lte(schedules.eventTime, future)
      )
    )
    .orderBy(schedules.eventTime);
}

export async function getSchedulesNeedingReminders() {
  const now = new Date();
  const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  return db
    .select()
    .from(schedules)
    .where(
      and(
        gte(schedules.eventTime, now),
        lte(schedules.eventTime, thirtyMinFromNow),
        eq(schedules.reminder30minSent, false)
      )
    );
}

export async function markReminderSent(id: string, type: '30min' | 'atTime') {
  const updateData = type === '30min' 
    ? { reminder30minSent: true }
    : { reminderAtTimeSent: true };

  const result = await db
    .update(schedules)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(schedules.id, id))
    .returning();
  return result[0];
}

export async function deleteSchedule(id: string) {
  await db
    .delete(schedules)
    .where(eq(schedules.id, id));
}

export async function getScheduleById(id: string) {
  const result = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));
  return result[0];
}

export async function updateSchedule(
  id: string,
  data: { title?: string; description?: string; eventTime?: Date }
) {
  const result = await db
    .update(schedules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schedules.id, id))
    .returning();
  return result[0];
}
