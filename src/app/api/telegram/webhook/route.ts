import { NextRequest, NextResponse } from 'next/server';
import { parseMessage, sendMessage, buildMainKeyboard } from '@/lib/telegram';
import { getOrCreateConversation, startNewChat, addMessage, getConversationContext } from '@/lib/conversation';
import { processWithAI, simpleAIResponse } from '@/lib/ai-agent';
import { getTodaysTasks, getPendingTasks } from '@/lib/tasks';
import { getTodaysSchedules } from '@/lib/schedules';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    // Debug: Log what's received vs expected
    console.log(`[Webhook] Secret received: ${secret ? 'yes' : 'no'}`);
    console.log(`[Webhook] Secret expected: ${expectedSecret ? 'yes' : 'no'}`);
    
    // Allow if no secret configured (dev mode) or if secret matches
    if (expectedSecret && secret !== expectedSecret) {
      console.log(`[Webhook] Secret mismatch! Got: ${secret}, Expected: ${expectedSecret}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update = await req.json();
    const parsed = parseMessage(update);

    if (!parsed) {
      return NextResponse.json({ ok: true });
    }

    const { chatId, text, messageId } = parsed;
    console.log(`[Telegram] Received from ${chatId}: ${text}`);

    if (text === '/start') {
      const welcomeMessage = `👋 Welcome to <b>Nimbot</b>!

I'm your personal AI assistant for managing tasks and schedules.

<b>Commands:</b>
• /start - Show this menu
• /new chat - Start a new conversation
• /tasks - View today's tasks
• /schedule - View today's schedule

<b>Just tell me:</b>
• "Add task: buy groceries"
• "Meeting at 2pm"
• "this done, that done"

I'll remember everything and remind you!`;
      
      await sendMessage(chatId, welcomeMessage, buildMainKeyboard());
      return NextResponse.json({ ok: true });
    }

    if (text === '/new chat') {
      const newConv = await startNewChat(chatId);
      await addMessage(newConv.id, 'user', '/new chat');
      await addMessage(newConv.id, 'assistant', 'Started a new chat session!');
      
      await sendMessage(chatId, '🔄 New chat session started! Previous context has been archived.', buildMainKeyboard());
      return NextResponse.json({ ok: true });
    }

    if (text === '/tasks') {
      const tasks = await getTodaysTasks();
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      
      if (pendingTasks.length === 0) {
        await sendMessage(chatId, '📋 No pending tasks for today! You\'re all caught up.');
      } else {
        const taskList = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
        await sendMessage(chatId, `📋 <b>Today's Tasks:</b>\n\n${taskList}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (text === '/schedule') {
      const schedules = await getTodaysSchedules();
      
      if (schedules.length === 0) {
        await sendMessage(chatId, '📅 No events scheduled for today!');
      } else {
        const scheduleList = schedules.map(s => {
          const time = new Date(s.eventTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return `• ${time} - ${s.title}`;
        }).join('\n');
        await sendMessage(chatId, `📅 <b>Today's Schedule:</b>\n\n${scheduleList}`);
      }
      return NextResponse.json({ ok: true });
    }

    const NEW_CHAT_KEYWORDS = ['new chat', 'new conversation', 'start fresh', 'clear chat', 'reset chat', 'begin new'];
    const shouldSuggestNewChat = (text: string): boolean => {
      const lower = text.toLowerCase();
      return NEW_CHAT_KEYWORDS.some(keyword => lower.includes(keyword));
    };

    if (shouldSuggestNewChat(text)) {
      await sendMessage(chatId, '💡 Did you want to start a new chat? Use /new chat to start a fresh conversation!');
    }

    const COMPLETION_KEYWORDS = ['completed', 'done', 'finished', 'all done', 'mark complete', 'i completed', 'i finished'];
    const isCompletionMessage = (text: string): boolean => {
      const lower = text.toLowerCase();
      return COMPLETION_KEYWORDS.some(keyword => lower.includes(keyword));
    };

    if (isCompletionMessage(text)) {
      const pendingTasks = await getTodaysTasks();
      const pending = pendingTasks.filter(t => t.status === 'pending');
      
      if (pending.length === 0) {
        await sendMessage(chatId, "No pending tasks to complete! ✅ You're all caught up!");
        return NextResponse.json({ ok: true });
      }

      const taskList = pending.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      await sendMessage(chatId, `Which tasks did you complete?\n\n${taskList}\n\nJust reply with the numbers or names!`);
      return NextResponse.json({ ok: true });
    }

    const conversation = await getOrCreateConversation(chatId);
    await addMessage(conversation.id, 'user', text);

    try {
      const aiResponse = await processWithAI(text, conversation.id, chatId);
      await addMessage(conversation.id, 'assistant', aiResponse);
      await sendMessage(chatId, aiResponse);
    } catch (error: any) {
      console.error('[AI Error]', error);
      const fallbackResponse = await simpleAIResponse(text);
      await addMessage(conversation.id, 'assistant', fallbackResponse);
      await sendMessage(chatId, fallbackResponse);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Nimbot webhook is running' });
}
