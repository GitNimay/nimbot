import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { getSchedulesNeedingReminders, markReminderSent, getTodaysSchedules } from '../lib/schedules';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
  ? parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID)
  : null;

console.log('[Scheduler] Starting reminder scheduler...');

async function checkAndSendReminders() {
  console.log('[Scheduler] Checking for reminders...');

  try {
    const schedulesNeeding30Min = await getSchedulesNeedingReminders();

    for (const schedule of schedulesNeeding30Min) {
      const eventTime = new Date(schedule.eventTime).getTime();
      const now = Date.now();
      const timeUntilEvent = eventTime - now;

      if (timeUntilEvent <= 30 * 60 * 1000 && timeUntilEvent > 0) {
        const message = `⏰ <b>Reminder!</b>\n\n"${schedule.title}" starts in 30 minutes!\n\n${
          schedule.description ? `📝 ${schedule.description}` : ''
        }`;

        if (ADMIN_CHAT_ID) {
          await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        }

        await markReminderSent(schedule.id, '30min');
        console.log(`[Scheduler] Sent 30-min reminder for: ${schedule.title}`);
      }
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todaysSchedules = await getTodaysSchedules();

    for (const schedule of todaysSchedules) {
      const eventTime = new Date(schedule.eventTime).getTime();
      const timeDiff = Math.abs(eventTime - now.getTime());

      if (timeDiff < 60000 && !schedule.reminderAtTimeSent) {
        const message = `🔔 <b>Starting Now!</b>\n\n"${schedule.title}" is happening now!\n\n${
          schedule.description ? `📝 ${schedule.description}` : ''
        }`;

        if (ADMIN_CHAT_ID) {
          await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        }

        await markReminderSent(schedule.id, 'atTime');
        console.log(`[Scheduler] Sent at-time reminder for: ${schedule.title}`);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error:', error);
  }
}

setInterval(async () => {
  await checkAndSendReminders();
}, 60000);

checkAndSendReminders();

console.log('[Scheduler] Running...');
