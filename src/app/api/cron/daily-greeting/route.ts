import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { db } from '@/lib/db';
import { conversations } from '@/lib/schema';
import { sql } from 'drizzle-orm';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!);

const GREETINGS = [
  "🌟 Good morning! Hope your day is filled with positivity and productivity!",
  "☀️ Rise and shine! Today is a fresh opportunity to achieve great things!",
  "🌈 Good morning! Remember: you're capable of amazing things today!",
  "💪 Start your day with confidence! You've got this!",
  "🌻 Good morning! May your day be as bright as the sun!",
  "✨ New day, new opportunities! Make it count!",
  "🎉 Good morning! Time to make some progress!",
  "🚀 Let's make today amazing! You have the power!",
];

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything! 😂",
  "What do you call a fake noodle? An impasta! 🍝",
  "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
  "I told my wife she was drawing her eyebrows too high. She looked surprised. 😮",
  "Why don't eggs tell jokes? They'd crack each other up! 🥚",
];

async function getAllChatIds() {
  const result = await db
    .selectDistinct({ telegramChatId: conversations.telegramChatId })
    .from(conversations);
  return result.map(r => r.telegramChatId);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = process.env.CRON_JOB_API_KEY;
    
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allChatIds = await getAllChatIds();
    const message = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    const finalMessage = `${message}\n\n${joke}`;

    for (const chatId of allChatIds) {
      try {
        await bot.sendMessage(chatId, finalMessage);
      } catch (error) {
        console.error(`Failed to send greeting to ${chatId}:`, error);
      }
    }

    return NextResponse.json({ success: true, sentTo: allChatIds.length });
  } catch (error) {
    console.error('Daily greeting error:', error);
    return NextResponse.json({ error: 'Failed to send greetings' }, { status: 500 });
  }
}
