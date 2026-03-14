const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
  edited_message?: any;
  callback_query?: any;
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<any> {
  const url = `${TELEGRAM_API_URL}/sendMessage`;
  
  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return response.json();
}

export async function setWebhook(url: string, secret?: string): Promise<any> {
  const webhookUrl = `${TELEGRAM_API_URL}/setWebhook`;
  
  const payload: any = {
    url,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
  };
  
  if (secret) {
    payload.secret_token = secret;
  }
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return response.json();
}

export async function getMe(): Promise<any> {
  const url = `${TELEGRAM_API_URL}/getMe`;
  const response = await fetch(url);
  return response.json();
}

export async function deleteWebhook(): Promise<any> {
  const url = `${TELEGRAM_API_URL}/deleteWebhook`;
  const response = await fetch(url);
  return response.json();
}

export function parseMessage(update: TelegramUpdate): { chatId: number; text: string; messageId: number } | null {
  if (!update.message) return null;
  
  const { chat, text, message_id } = update.message;
  
  if (!chat || !text) return null;
  
  return {
    chatId: chat.id,
    text,
    messageId: message_id,
  };
}

export function buildMainKeyboard() {
  return {
    keyboard: [
      [{ text: '/tasks' }, { text: '/schedule' }],
      [{ text: '/new chat' }, { text: '/start' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function buildTaskKeyboard(tasks: { id: string; title: string }[]) {
  const buttons = tasks.slice(0, 10).map(task => [
    { text: `✅ ${task.title}`, callback_data: `task_done_${task.id}` },
  ]);
  
  return {
    inline_keyboard: buttons,
  };
}
