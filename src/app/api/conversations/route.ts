import { NextRequest, NextResponse } from 'next/server';
import { getConversationsByChatId, getMessages, getConversation } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let chatId = searchParams.get('chatId');
    const conversationId = searchParams.get('id');
    
    if (conversationId) {
      if (!isValidUUID(conversationId)) {
        return NextResponse.json({ conversation: null, messages: [] });
      }
      const conversation = await getConversation(conversationId);
      const messages = await getMessages(conversationId);
      return NextResponse.json({ conversation, messages });
    }
    
    // Use admin chat ID as default if not provided or is 0
    if (!chatId || chatId === '0') {
      chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '1345151781';
    }
    
    const conversations = await getConversationsByChatId(parseInt(chatId));
    return NextResponse.json(conversations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
