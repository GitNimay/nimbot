import { getSchedulesNeedingReminders, markReminderSent, getTodaysSchedules, getSchedules } from './schedules';
import { sendMessage } from './telegram';
import { getConversationsByChatId } from './conversation';

const REMINDER_30_MIN_BEFORE = 30 * 60 * 1000;

export async function checkAndSendReminders() {
  console.log('[Scheduler] Checking for reminders...');
  
  try {
    const schedulesNeeding30Min = await getSchedulesNeedingReminders();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID ? parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID) : null;
    
    for (const schedule of schedulesNeeding30Min) {
      const eventTime = new Date(schedule.eventTime).getTime();
      const now = Date.now();
      const timeUntilEvent = eventTime - now;
      
      if (timeUntilEvent <= REMINDER_30_MIN_BEFORE && timeUntilEvent > 0) {
        const message = `⏰ <b>Reminder!</b>\n\n"${schedule.title}" starts in 30 minutes!\n\n${schedule.description ? `📝 ${schedule.description}` : ''}`;
        
        if (adminChatId) {
          await sendMessage(adminChatId, message);
        }
        
        await markReminderSent(schedule.id, '30min');
        console.log(`[Scheduler] Sent 30-min reminder for: ${schedule.title}`);
      }
    }
    
    const now = new Date();
    const schedulesAtTime = await db.select().from(schedules).where(
      and(
        eq(schedules.reminderAtTimeSent, false),
        gte(schedules.eventTime, new Date(now.getTime() - 60000)),
        lte(schedules.eventTime, new Date(now.getTime() + 60000))
      )
    );
    
    for (const schedule of schedulesAtTime) {
      const message = `🔔 <b>Starting Now!</b>\n\n"${schedule.title}" is happening now!\n\n${schedule.description ? `📝 ${schedule.description}` : ''}`;
      
      if (adminChatId) {
        await sendMessage(adminChatId, message);
      }
      
      await markReminderSent(schedule.id, 'atTime');
      console.log(`[Scheduler] Sent at-time reminder for: ${schedule.title}`);
    }
    
  } catch (error) {
    console.error('[Scheduler] Error:', error);
  }
}

export async function startScheduler() {
  console.log('[Scheduler] Starting reminder scheduler...');
  
  setInterval(async () => {
    await checkAndSendReminders();
  }, 60000);
  
  await checkAndSendReminders();
}

import { db } from './db';
import { schedules } from './schema';
import { and, eq, gte, lte } from 'drizzle-orm';
