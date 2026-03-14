import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { getTodaysPendingTasksWithReminders, createOrUpdateReminder } from '@/lib/tasks';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!);
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '1345151781';

const REMINDER_INTERVAL_HOURS = 2;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = process.env.CRON_JOB_API_KEY;
    
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingTasks = await getTodaysPendingTasksWithReminders();
    
    if (pendingTasks.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending tasks' });
    }

    const taskList = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    const message = `📋 <b>Task Reminder</b>\n\nHere are your pending tasks for today:\n\n${taskList}\n\nPlease let me know which tasks you've completed!`;

    await bot.sendMessage(parseInt(ADMIN_CHAT_ID), message, { parse_mode: 'HTML' });

    const nextReminder = new Date();
    nextReminder.setHours(nextReminder.getHours() + REMINDER_INTERVAL_HOURS + Math.floor(Math.random() * 2));

    for (const task of pendingTasks) {
      await createOrUpdateReminder(task.id, parseInt(ADMIN_CHAT_ID), nextReminder);
    }

    return NextResponse.json({ success: true, tasksReminded: pendingTasks.length });
  } catch (error) {
    console.error('Task reminder error:', error);
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
  }
}
