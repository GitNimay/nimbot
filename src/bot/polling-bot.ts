import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { getOrCreateConversation, startNewChat, addMessage } from '../lib/conversation';
import { processWithAI, simpleAIResponse } from '../lib/ai-agent';
import { getTodaysTasks, updateTaskStatus } from '../lib/tasks';
import { getTodaysSchedules } from '../lib/schedules';

const NEW_CHAT_KEYWORDS = ['new chat', 'new conversation', 'start fresh', 'clear chat', 'reset chat', 'begin new'];

function shouldSuggestNewChat(text: string): boolean {
  const lower = text.toLowerCase();
  return NEW_CHAT_KEYWORDS.some(keyword => lower.includes(keyword));
}

const COMPLETION_KEYWORDS = ['completed', 'done', 'finished', 'all done', 'mark complete', 'i completed', 'i finished'];

function isCompletionMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPLETION_KEYWORDS.some(keyword => lower.includes(keyword));
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

console.log('[Bot] Nimbot started with long polling...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const messageId = msg.message_id;

  if (!text) return;

  console.log(`[Bot] Received from ${chatId}: ${text}`);

  if (text === '/start') {
    const welcomeMessage = `👋 Welcome to Nimbot!

I'm your personal AI assistant for managing tasks and schedules.

Commands:
• /start - Show this menu
• /new chat - Start a new conversation
• /tasks - View today's tasks
• /schedule - View today's schedule

Just tell me:
• "Add task: buy groceries"
• "Meeting at 2pm"
• "this done, that done"

I'll remember everything and remind you!`;

    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: [
          ['/tasks', '/schedule'],
          ['/new chat', '/start'],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (text === '/new chat') {
    const newConv = await startNewChat(chatId);
    await addMessage(newConv.id, 'user', '/new chat');
    await addMessage(newConv.id, 'assistant', 'Started a new chat session!');

    await bot.sendMessage(chatId, '🔄 New chat session started! Previous context has been archived.', {
      reply_markup: {
        keyboard: [
          ['/tasks', '/schedule'],
          ['/new chat', '/start'],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (text === '/tasks') {
    const tasks = await getTodaysTasks();
    const pendingTasks = tasks.filter((t) => t.status === 'pending');

    if (pendingTasks.length === 0) {
      await bot.sendMessage(chatId, '📋 No pending tasks for today! You\'re all caught up.');
    } else {
      const taskList = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      await bot.sendMessage(chatId, `📋 Today's Tasks:\n\n${taskList}`, { parse_mode: 'HTML' });
    }
    return;
  }

  if (text === '/schedule') {
    const schedules = await getTodaysSchedules();

    if (schedules.length === 0) {
      await bot.sendMessage(chatId, '📅 No events scheduled for today!');
    } else {
      const scheduleList = schedules.map((s) => {
        const time = new Date(s.eventTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `• ${time} - ${s.title}`;
      }).join('\n');
      await bot.sendMessage(chatId, `📅 Today's Schedule:\n\n${scheduleList}`, {
        parse_mode: 'HTML',
      });
    }
    return;
  }

  if (shouldSuggestNewChat(text)) {
    await bot.sendMessage(chatId, 'Did you want to start a new chat?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Start New Chat', callback_data: 'newchat' }]
        ]
      }
    });
  }

  if (isCompletionMessage(text)) {
    const pendingTasks = await getTodaysTasks();
    const pending = pendingTasks.filter(t => t.status === 'pending');
    
    if (pending.length === 0) {
      await bot.sendMessage(chatId, "No pending tasks to complete! ✅ You're all caught up!");
      return;
    }

    const taskList = pending.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    await bot.sendMessage(chatId, `Which tasks did you complete?\n\n${taskList}\n\nJust reply with the numbers or names!`);
    return;
  }

  const conversation = await getOrCreateConversation(chatId);
  await addMessage(conversation.id, 'user', text);

  try {
    const aiResponse = await processWithAI(text, conversation.id, chatId);
    await addMessage(conversation.id, 'assistant', aiResponse);
    await bot.sendMessage(chatId, aiResponse, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('[AI Error]', error);
    const fallbackResponse = await simpleAIResponse(text);
    await addMessage(conversation.id, 'assistant', fallbackResponse);
    await bot.sendMessage(chatId, fallbackResponse);
  }
});

bot.on('polling_error', (error) => {
  console.error('[Polling Error]', error);
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  
  if (data === 'newchat' && msg) {
    const chatId = msg.chat.id;
    const newConv = await startNewChat(chatId);
    await addMessage(newConv.id, 'user', '/new chat');
    await addMessage(newConv.id, 'assistant', 'Started a new chat session!');
    
    await bot.editMessageText('🔄 New chat session started! Previous context has been archived.', {
      chat_id: chatId,
      message_id: msg.message_id,
    });
    
    await bot.sendMessage(chatId, '🔄 New chat session started! Previous context has been archived.', {
      reply_markup: {
        keyboard: [
          ['/tasks', '/schedule'],
          ['/new chat', '/start'],
        ],
        resize_keyboard: true,
      },
    });
  }
});

console.log('[Bot] Bot is polling for messages...');
