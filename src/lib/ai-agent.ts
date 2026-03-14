import OpenAI from 'openai';
import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { db } from './db';
import { conversations, messages, tasks, schedules } from './schema';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { logApiUsage } from './conversation';
import { createTask, completeTaskFromText, getPendingTasks, getTodaysTasks } from './tasks';
import { createSchedule, getTodaysSchedules, getUpcomingSchedules } from './schedules';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

type Provider = 'openrouter' | 'gemini' | 'groq';

const MODEL_CONFIG = {
  openrouter: 'deepseek/deepseek-chat',
  openrouter2: 'google/gemini-2.0-flash-exp', 
  openrouter3: 'qwen/qwen-2.5-7b-instruct',
  openrouter4: 'mistralai/mistral-7b-instruct-v0.2',
  openrouter5: 'meta-llama/llama-3.2-3b-instruct',
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.2-90b-versatile',
  groq2: 'llama-3.3-70b-versatile',
  groq3: 'llama-3.1-70b-versatile',
  groq4: 'mixtral-8x7b-32768',
  groq5: 'gemma-7b-it',
};

interface AITools {
  createTask: typeof createTask;
  createSchedule: typeof createSchedule;
  completeTaskFromText: typeof completeTaskFromText;
  getPendingTasks: typeof getPendingTasks;
  getTodaysTasks: typeof getTodaysTasks;
  getTodaysSchedules: typeof getTodaysSchedules;
  getUpcomingSchedules: typeof getUpcomingSchedules;
}

const tools = {
  createTask: async (args: { title: string; description?: string; dueDate?: string }) => {
    const task = await createTask(args.title, undefined, args.description, args.dueDate ? new Date(args.dueDate) : undefined);
    return { success: true, task };
  },
  createSchedule: async (args: { title: string; eventTime: string; description?: string }) => {
    const schedule = await createSchedule(args.title, new Date(args.eventTime), undefined, args.description);
    return { success: true, schedule };
  },
  completeTaskFromText: async (args: { completedTitles: string[]; conversationId: string }) => {
    const completed = await completeTaskFromText(args.conversationId, args.completedTitles);
    return { success: true, completed };
  },
  getPendingTasks: async () => {
    const tasks = await getPendingTasks();
    return { tasks };
  },
  getTodaysTasks: async () => {
    const tasks = await getTodaysTasks();
    return { tasks };
  },
  getTodaysSchedules: async () => {
    const schedules = await getTodaysSchedules();
    return { schedules };
  },
  getUpcomingSchedules: async (args: { hoursAhead?: number }) => {
    const schedules = await getUpcomingSchedules(args.hoursAhead || 24);
    return { schedules };
  },
};

const systemPrompt = `You are Nimbot, a helpful AI assistant that manages schedules and todos for the user.

Your capabilities:
1. Add tasks/todos - When user wants to add a todo, use createTask tool
2. Mark tasks as done - When user says "this done", "completed", use completeTaskFromText tool
3. View today's tasks - When user wants to see pending tasks, use getTodaysTasks
4. Add schedules - When user mentions a time (e.g., "meeting at 2pm", "football at 2 p.m."), use createSchedule
5. View schedules - When user wants to see schedules, use getTodaysSchedules or getUpcomingSchedules

Important:
- Always extract the title and any relevant details (time, description)
- For schedules, parse the time from natural language (e.g., "2pm", "2:30 p.m.", "tomorrow at 3pm")
- When user marks tasks as done, extract which tasks were completed from their message
- Keep responses friendly and concise
- Always confirm when you've added or completed tasks

Current context: ${new Date().toLocaleString()}`;

const PAST_CONTEXT_KEYWORDS = [
  'yesterday', 'before', 'earlier', 'last week', 'last month', 'past', 
  'history', 'previous', 'old', 'what did i', 'what was', 'remember',
  'did i say', 'did i ask', 'earlier', 'previously', 'ago', 'earlier'
];

function isAskingAboutPast(message: string): boolean {
  const lower = message.toLowerCase();
  return PAST_CONTEXT_KEYWORDS.some(keyword => lower.includes(keyword));
}

async function getPastConversationContext(chatId: number, query: string): Promise<string> {
  const searchTerm = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 1)[0] || '';
  
  let pastMessages;
  
  if (searchTerm) {
    pastMessages = await db
      .select({ content: messages.content, role: messages.role, createdAt: messages.createdAt })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.telegramChatId, chatId),
          sql`LOWER(${messages.content}) LIKE ${`%${searchTerm}%`}`
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(15);
  } else {
    pastMessages = await db
      .select({ content: messages.content, role: messages.role, createdAt: messages.createdAt })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.telegramChatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(15);
  }

  if (pastMessages.length === 0) return '';

  const context = pastMessages.reverse().map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');

  return `\n\nRelevant past conversation context:\n${context}`;
}

function getToolDefinitions() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'createTask',
        description: 'Create a new task/todo',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Optional description' },
            dueDate: { type: 'string', description: 'Optional due date' },
          },
          required: ['title'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createSchedule',
        description: 'Create a scheduled event',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title' },
            eventTime: { type: 'string', description: 'Event time in ISO format' },
            description: { type: 'string', description: 'Optional description' },
          },
          required: ['title', 'eventTime'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'completeTaskFromText',
        description: 'Mark tasks as completed based on user text',
        parameters: {
          type: 'object',
          properties: {
            completedTitles: { type: 'array', items: { type: 'string' }, description: 'List of task titles completed' },
            conversationId: { type: 'string', description: 'Conversation ID' },
          },
          required: ['completedTitles', 'conversationId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getPendingTasks',
        description: 'Get all pending tasks',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getTodaysTasks',
        description: "Get today's tasks",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getTodaysSchedules',
        description: "Get today's schedules",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getUpcomingSchedules',
        description: 'Get upcoming schedules',
        parameters: {
          type: 'object',
          properties: {
            hoursAhead: { type: 'number', description: 'Hours to look ahead' },
          },
        },
      },
    },
  ];
}

async function callOpenRouter(messages: any[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: MODEL_CONFIG.openrouter,
    messages,
    tools: getToolDefinitions() as any,
  });

  await logApiUsage('openrouter', MODEL_CONFIG.openrouter, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callOpenRouter2(messages: any[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: MODEL_CONFIG.openrouter2,
    messages,
    tools: getToolDefinitions(),
  });

  await logApiUsage('openrouter', MODEL_CONFIG.openrouter2, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callOpenRouter3(messages: any[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: MODEL_CONFIG.openrouter3,
    messages,
    tools: getToolDefinitions(),
  });

  await logApiUsage('openrouter', MODEL_CONFIG.openrouter3, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGemini(messages: any[]): Promise<string> {
  const model = gemini.getGenerativeModel({ 
    model: MODEL_CONFIG.gemini,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  });

  const contents: Content[] = messages.map(m => ({
    role: m.role === 'system' ? 'user' as const : m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }] as Part[],
  }));

  const tools = [
    {
      name: 'createTask',
      description: 'Create a new task/todo',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Optional description' },
          dueDate: { type: 'string', description: 'Optional due date' },
        },
        required: ['title'],
      },
    },
    {
      name: 'createSchedule',
      description: 'Create a scheduled event',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          eventTime: { type: 'string', description: 'Event time in ISO format' },
          description: { type: 'string', description: 'Optional description' },
        },
        required: ['title', 'eventTime'],
      },
    },
    {
      name: 'completeTaskFromText',
      description: 'Mark tasks as completed based on user text',
      parameters: {
        type: 'object',
        properties: {
          completedTitles: { type: 'array', items: { type: 'string' }, description: 'List of task titles completed' },
          conversationId: { type: 'string', description: 'Conversation ID' },
        },
        required: ['completedTitles', 'conversationId'],
      },
    },
    {
      name: 'getPendingTasks',
      description: 'Get all pending tasks',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'getTodaysTasks',
      description: "Get today's tasks",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'getTodaysSchedules',
      description: "Get today's schedules",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'getUpcomingSchedules',
      description: 'Get upcoming schedules',
      parameters: {
        type: 'object',
        properties: {
          hoursAhead: { type: 'number', description: 'Hours to look ahead' },
        },
      },
    },
  ];

  const result = await model.generateContent({
    contents,
    tools: [{ functionDeclarations: tools }],
  });

  const response = result.response;
  const functionCalls = response.functionCalls();
  
  if (functionCalls && functionCalls.length > 0) {
    return JSON.stringify({ functionCalls: functionCalls.map(fc => ({
      function: {
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      },
    }))});
  }

  const text = response.text();
  await logApiUsage('gemini', MODEL_CONFIG.gemini, result.response.usageMetadata?.totalTokenCount || 0, true);
  return text || 'I understand your request.';
}

async function callOpenRouter4(messages: any[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: MODEL_CONFIG.openrouter4,
    messages,
    tools: getToolDefinitions(),
  });

  await logApiUsage('openrouter', MODEL_CONFIG.openrouter4, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callOpenRouter5(messages: any[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: MODEL_CONFIG.openrouter5,
    messages,
    tools: getToolDefinitions(),
  });

  await logApiUsage('openrouter', MODEL_CONFIG.openrouter5, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGroq1(messages: any[]): Promise<string> {
  const response = await groqClient.chat.completions.create({
    model: MODEL_CONFIG.groq,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.7,
    max_tokens: 2048,
  });

  await logApiUsage('groq', MODEL_CONFIG.groq, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGroq2(messages: any[]): Promise<string> {
  const response = await groqClient.chat.completions.create({
    model: MODEL_CONFIG.groq2,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.7,
    max_tokens: 2048,
  });

  await logApiUsage('groq', MODEL_CONFIG.groq2, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGroq3(messages: any[]): Promise<string> {
  const response = await groqClient.chat.completions.create({
    model: MODEL_CONFIG.groq3,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.7,
    max_tokens: 2048,
  });

  await logApiUsage('groq', MODEL_CONFIG.groq3, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGroq4(messages: any[]): Promise<string> {
  const response = await groqClient.chat.completions.create({
    model: MODEL_CONFIG.groq4,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.7,
    max_tokens: 2048,
  });

  await logApiUsage('groq', MODEL_CONFIG.groq4, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

async function callGroq5(messages: any[]): Promise<string> {
  const response = await groqClient.chat.completions.create({
    model: MODEL_CONFIG.groq5,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.7,
    max_tokens: 2048,
  });

  await logApiUsage('groq', MODEL_CONFIG.groq5, response.usage?.total_tokens || 0, true);
  return JSON.stringify(response.choices[0].message);
}

export async function processWithAI(userMessage: string, conversationId: string, chatId: number): Promise<string> {
  let augmentedSystemPrompt = systemPrompt;
  
  const pastContext = await getPastConversationContext(chatId, userMessage);
  if (pastContext) {
    augmentedSystemPrompt = systemPrompt + pastContext;
  }

  const messages = [
    { role: 'system', content: augmentedSystemPrompt },
    { role: 'user', content: userMessage },
  ];

  let lastError: Error | null = null;
  let response: string = '';

  console.log('[AI] Trying Groq Llama 3.3 70B...');
  try {
    response = await callGroq1(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Groq Llama 3.3 failed, trying Groq Llama 3.1 70B...');
    await logApiUsage('groq', MODEL_CONFIG.groq, 0, false, error.message, true);
  }

  console.log('[AI] Trying Groq Llama 3.1 70B...');
  try {
    response = await callGroq2(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Groq Llama 3.1 70B failed, trying Groq Llama 3.1 8B...');
    await logApiUsage('groq', MODEL_CONFIG.groq2, 0, false, error.message, true, 'groq');
  }

  console.log('[AI] Trying Groq Llama 3.1 8B...');
  try {
    response = await callGroq3(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Groq Llama 3.1 8B failed, trying Groq Mixtral...');
    await logApiUsage('groq', MODEL_CONFIG.groq3, 0, false, error.message, true, 'groq2');
  }

  console.log('[AI] Trying Groq Mixtral 8x7B...');
  try {
    response = await callGroq4(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Groq Mixtral failed, trying Groq Gemma...');
    await logApiUsage('groq', MODEL_CONFIG.groq4, 0, false, error.message, true, 'groq3');
  }

  console.log('[AI] Trying Groq Gemma 7B...');
  try {
    response = await callGroq5(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Groq Gemma failed, trying DeepSeek...');
    await logApiUsage('groq', MODEL_CONFIG.groq5, 0, false, error.message, true, 'groq4');
  }

  console.log('[AI] Trying DeepSeek (OpenRouter Free)...');
  try {
    response = await callOpenRouter(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] DeepSeek failed, trying Gemini...');
    await logApiUsage('openrouter', MODEL_CONFIG.openrouter, 0, false, error.message, true, 'groqClient');
  }

  console.log('[AI] Trying Gemini 2.5 Flash...');
  try {
    response = await callGemini(messages);
    return parseGeminiResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Gemini failed, trying OpenRouter Gemini Flash...');
    await logApiUsage('gemini', MODEL_CONFIG.gemini, 0, false, error.message, true, 'openrouter');
  }

  console.log('[AI] Trying OpenRouter Gemini Flash...');
  try {
    response = await callOpenRouter2(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] OpenRouter Gemini failed, trying OpenRouter Qwen...');
    await logApiUsage('openrouter', MODEL_CONFIG.openrouter2, 0, false, error.message, true, 'gemini');
  }

  console.log('[AI] Trying OpenRouter Qwen...');
  try {
    response = await callOpenRouter3(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Qwen failed, trying OpenRouter Mistral...');
    await logApiUsage('openrouter', MODEL_CONFIG.openrouter3, 0, false, error.message, true, 'openrouter2');
  }

  console.log('[AI] Trying OpenRouter Mistral...');
  try {
    response = await callOpenRouter4(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] Mistral failed, trying OpenRouter Llama...');
    await logApiUsage('openrouter', MODEL_CONFIG.openrouter4, 0, false, error.message, true, 'openrouter3');
  }

  console.log('[AI] Trying OpenRouter Llama...');
  try {
    response = await callOpenRouter5(messages);
    return parseAIResponse(response, conversationId, userMessage);
  } catch (error: any) {
    lastError = error;
    console.log('[AI] All providers failed');
    await logApiUsage('openrouter', MODEL_CONFIG.openrouter5, 0, false, error.message, true, 'openrouter4');
  }

  return `Sorry, all AI services are currently unavailable. Please try again later.`;
}

function parseAIResponse(responseStr: string, conversationId: string, userMessage: string): string {
  try {
    const response = JSON.parse(responseStr);
    
    if (response.tool_calls) {
      return handleToolCalls(response.tool_calls, conversationId, userMessage);
    }
    
    return response.content || 'I understood your message. Is there anything specific you\'d like me to help with?';
  } catch {
    return responseStr;
  }
}

function parseGeminiResponse(response: string, conversationId: string, userMessage: string): string {
  try {
    const parsed = JSON.parse(response);
    if (parsed.functionCalls) {
      return handleToolCalls(parsed.functionCalls, conversationId, userMessage);
    }
  } catch {
    if (response.includes('createTask') || response.includes('createSchedule')) {
      return handleGeminiTools(response, conversationId, userMessage);
    }
  }
  
  return response;
}

function handleGeminiTools(response: string, conversationId: string, userMessage: string): string {
  const taskMatch = response.match(/createTask.*?"title":\s*"([^"]+)"/);
  const scheduleMatch = response.match(/createSchedule.*?"title":\s*"([^"]+)".*?"eventTime":\s*"([^"]+)"/);
  
  if (taskMatch) {
    const title = taskMatch[1];
    createTask(title, conversationId);
    return `I've added "${title}" to your tasks!`;
  }
  
  if (scheduleMatch) {
    const title = scheduleMatch[1];
    const time = scheduleMatch[2];
    createSchedule(title, new Date(time), conversationId);
    return `I've scheduled "${title}" for ${new Date(time).toLocaleString()}`;
  }
  
  return response;
}

async function handleToolCalls(toolCalls: any[], conversationId: string, userMessage: string): Promise<string> {
  const responses: string[] = [];
  
  for (const call of toolCalls) {
    const fn = call.function;
    const name = fn.name;
    const args = JSON.parse(fn.arguments);
    
    try {
      let result;
      switch (name) {
        case 'createTask':
          result = await tools.createTask(args);
          responses.push(`✅ Task added: "${args.title}"`);
          break;
        case 'createSchedule':
          result = await tools.createSchedule(args);
          const time = new Date(args.eventTime).toLocaleString();
          responses.push(`📅 Schedule added: "${args.title}" at ${time}`);
          break;
        case 'completeTaskFromText':
          args.conversationId = conversationId;
          const completed = userMessage.split(',').map(s => s.trim().replace(/^(this|that)\s+/i, '').replace(/\s+done$/i, ''));
          result = await tools.completeTaskFromText({ completedTitles: completed, conversationId });
          if (result.completed.length > 0) {
            responses.push(`✅ Completed: ${result.completed.join(', ')}`);
          } else {
            responses.push('No matching tasks found to complete.');
          }
          break;
        case 'getPendingTasks':
          result = await tools.getPendingTasks();
          if (result.tasks.length > 0) {
            responses.push('📋 Pending Tasks:\n' + result.tasks.map(t => `• ${t.title} (${t.status})`).join('\n'));
          } else {
            responses.push('No pending tasks!');
          }
          break;
        case 'getTodaysTasks':
          result = await tools.getTodaysTasks();
          if (result.tasks.length > 0) {
            responses.push("📋 Today's Tasks:\n" + result.tasks.map(t => `• ${t.title} [${t.status}]`).join('\n'));
          } else {
            responses.push('No tasks for today!');
          }
          break;
        case 'getTodaysSchedules':
          result = await tools.getTodaysSchedules();
          if (result.schedules.length > 0) {
            responses.push("📅 Today's Schedule:\n" + result.schedules.map(s => `• ${s.title} at ${new Date(s.eventTime).toLocaleTimeString()}`).join('\n'));
          } else {
            responses.push('No schedules for today!');
          }
          break;
        case 'getUpcomingSchedules':
          result = await tools.getUpcomingSchedules(args.hoursAhead || 24);
          if (result.schedules.length > 0) {
            responses.push("📅 Upcoming Schedule:\n" + result.schedules.map(s => `• ${s.title} at ${new Date(s.eventTime).toLocaleString()}`).join('\n'));
          } else {
            responses.push('No upcoming schedules!');
          }
          break;
      }
    } catch (error: any) {
      responses.push(`Error: ${error.message}`);
    }
  }
  
  return responses.join('\n') || 'I processed your request.';
}

export async function simpleAIResponse(userMessage: string, context: { tasks?: any[], schedules?: any[] } = {}): Promise<string> {
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('tasks') || lowerMsg.includes('todo') || lowerMsg.includes('what to do')) {
    const tasks = await getTodaysTasks();
    if (tasks.length > 0) {
      return "📋 Today's Tasks:\n" + tasks.map(t => `• ${t.title} [${t.status}]`).join('\n');
    }
    return 'No tasks for today! Add some tasks by telling me what you need to do.';
  }
  
  if (lowerMsg.includes('schedule') || lowerMsg.includes('meeting') || lowerMsg.includes('football')) {
    const schedules = await getTodaysSchedules();
    if (schedules.length > 0) {
      return "📅 Today's Schedule:\n" + schedules.map(s => `• ${s.title} at ${new Date(s.eventTime).toLocaleTimeString()}`).join('\n');
    }
    return 'No schedules for today! Tell me about your upcoming events.';
  }
  
  if (lowerMsg.includes('done') || lowerMsg.includes('completed')) {
    const completed = userMessage
      .replace(/^(i've|i have|this|that|these|those)/i, '')
      .replace(/\s+(done|completed)$/i, '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (completed.length > 0) {
      return `I'll mark those as done. Which tasks did you complete?`;
    }
  }
  
  const isAddingTask = lowerMsg.includes('add') || lowerMsg.includes('create') || lowerMsg.includes('remind me') || lowerMsg.includes('need to');
  const isAddingSchedule = /\d{1,2}[:.]\d{2}\s*(am|pm)?/i.test(userMessage) || 
    lowerMsg.includes('at') && (lowerMsg.includes('pm') || lowerMsg.includes('am') || lowerMsg.includes('o\'clock'));
  
  if (isAddingTask || isAddingSchedule) {
    return `I understand you want to add ${isAddingSchedule ? 'a schedule' : 'a task'}. Let me process that with AI... (This would be handled by the AI agent with full context).`;
  }
  
  return `I'm here to help manage your tasks and schedule! You can:\n• Tell me to add tasks: "Add task: buy groceries"\n• Tell me about schedules: "Meeting at 2pm"\n• Mark tasks done: "this done, that done"\n• Ask what's on today: "what are my tasks?"`;
}
