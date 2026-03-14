import { pgTable, uuid, varchar, text, timestamp, boolean, integer, pgEnum, bigint } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['user', 'assistant', 'system']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'completed', 'cancelled']);
export const providerEnum = pgEnum('provider', ['openrouter', 'gemini', 'groq']);

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull(),
  sessionName: varchar('session_name', { length: 255 }).default('New Chat'),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  isActive: boolean('is_active').default(true),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('task_status', { length: 20 }).default('pending'),
  dueDate: timestamp('due_date', { mode: 'date' }),
  taskDate: timestamp('task_date', { mode: 'date' }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
});

export const schedules = pgTable('schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  eventTime: timestamp('event_time', { withTimezone: true, mode: 'date' }).notNull(),
  reminder30minSent: boolean('reminder_30min_sent').default(false),
  reminderAtTimeSent: boolean('reminder_at_time_sent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const apiUsage = pgTable('api_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: providerEnum('provider').notNull(),
  model: varchar('model', { length: 100 }),
  tokensUsed: integer('tokens_used').default(0),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  fallbackUsed: boolean('fallback_used').default(false),
  fallbackFrom: varchar('fallback_from', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const taskReminders = pgTable('task_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  lastReminderSent: timestamp('last_reminder_sent', { mode: 'date' }),
  nextReminderAt: timestamp('next_reminder_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type ApiUsage = typeof apiUsage.$inferSelect;
