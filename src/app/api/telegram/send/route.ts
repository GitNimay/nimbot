import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, text } = body;
    
    if (!chatId || !text) {
      return NextResponse.json({ error: 'chatId and text are required' }, { status: 400 });
    }
    
    const result = await sendMessage(chatId, text);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
