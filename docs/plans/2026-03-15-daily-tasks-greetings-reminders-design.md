# Daily Tasks, Greetings & Reminders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 
1. Sort tasks per day with date grouping in dashboard
2. Daily greeting at 1:00 AM via cron-job.org
3. Task reminder every 2-3 hours throughout the day
4. Fix chat sessions not showing in dashboard

**Architecture:** 
- Tasks: Add `taskDate` field to group by day, update dashboard UI
- Greetings: Create API endpoint for cron-job.org to trigger daily greeting
- Reminders: Create API endpoint + database tracking for reminder schedules
- Dashboard: Fix conversation API to use admin chat ID by default

**Tech Stack:** Next.js API Routes, Drizzle ORM, Neon PostgreSQL, Telegram Bot API, cron-job.org REST API

---

### Task 1: Fix chat sessions not showing in dashboard

**Files:**
- Modify: `src/app/api/conversations/route.ts`
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Update API to accept optional chatId for admin**

Update the GET function to return all conversations when no chatId is provided, or use admin chat ID as default.

```typescript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let chatId = searchParams.get('chatId');
    const conversationId = searchParams.get('id');
    
    if (conversationId) {
      // ... existing code
    }
    
    // Use admin chat ID as default if not provided or is 0
    if (!chatId || chatId === '0') {
      chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '1345151781';
    }
    
    const conversations = await getConversationsByChatId(parseInt(chatId));
    return NextResponse.json(conversations);
  } catch (error) {
    // ... error handling
  }
}
```

**Step 2: Update dashboard to use admin chat ID**

Update the SWR call to use the admin chat ID from environment or default.

```typescript
const ADMIN_CHAT_ID = '1345151781'; // Fallback
const { data: conversations, mutate: mutateConversations } = useSWR<Conversation[]>(
  `/api/conversations?chatId=${ADMIN_CHAT_ID}`, 
  fetcher, 
  { refreshInterval: 5000 }
);
```

**Step 3: Commit**

```bash
git add src/app/api/conversations/route.ts src/app/dashboard/page.tsx
git commit -m "fix: use admin chat ID for fetching conversations in dashboard"
```

---

### Task 2: Add taskDate field and update task schema

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/tasks.ts`
- Run: `npm run db:push`

**Step 1: Add taskDate field to schema**

```typescript
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('task_status', { length: 20 }).default('pending'),
  dueDate: timestamp('due_date', { mode: 'date' }),
  taskDate: timestamp('task_date', { mode: 'date' }).notNull().defaultNow(), // NEW
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  completedAt: timestamp('completed_at', { mode: 'date' }),
});
```

**Step 2: Run migration**

```bash
npm run db:push
```

**Step 3: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat: add taskDate field to tasks table"
```

---

### Task 3: Update tasks library functions

**Files:**
- Modify: `src/lib/tasks.ts`

**Step 1: Update createTask to handle taskDate**

```typescript
export async function createTask(
  title: string,
  conversationId?: string,
  description?: string,
  dueDate?: Date,
  taskDate?: Date
) {
  const result = await db
    .insert(tasks)
    .values({
      title,
      description,
      dueDate,
      taskDate: taskDate || new Date(), // Use provided date or default to now
      conversationId,
    })
    .returning();
  return result[0];
}
```

**Step 2: Add getTasksByDate function**

```typescript
export async function getTasksByDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.taskDate, startOfDay),
        lte(tasks.taskDate, endOfDay)
      )
    )
    .orderBy(desc(tasks.createdAt));
}
```

**Step 3: Add getAllTasksGroupedByDate function**

```typescript
export async function getAllTasksGroupedByDate() {
  const allTasks = await db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.taskDate), desc(tasks.createdAt));
  
  // Group by date
  const grouped: Record<string, typeof allTasks> = {};
  for (const task of allTasks) {
    const dateKey = task.taskDate.toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(task);
  }
  
  return grouped;
}
```

**Step 4: Commit**

```bash
git add src/lib/tasks.ts
git commit -m "feat: add taskDate handling and grouping functions"
```

---

### Task 4: Update tasks API route

**Files:**
- Modify: `src/app/api/tasks/route.ts`

**Step 1: Add new endpoints**

```typescript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const grouped = searchParams.get('grouped');
    
    if (id) {
      const task = await getTaskById(id);
      return NextResponse.json(task);
    }
    
    if (grouped === 'true') {
      const groupedTasks = await getAllTasksGroupedByDate();
      return NextResponse.json(groupedTasks);
    }
    
    if (date) {
      const tasks = await getTasksByDate(new Date(date));
      return NextResponse.json(tasks);
    }
    
    const tasks = await getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
```

**Step 2: Update POST to handle taskDate**

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, dueDate, taskDate } = body;
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    const task = await createTask(
      title, 
      undefined, 
      description, 
      dueDate ? new Date(dueDate) : undefined,
      taskDate ? new Date(taskDate) : undefined
    );
    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: add date-based task fetching to API"
```

---

### Task 5: Update dashboard UI for tasks per day

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Update state and fetch**

```typescript
// Update the SWR call to get grouped tasks
const { data: groupedTasks, error: tasksError, mutate: mutateTasks } = useSWR<Record<string, Task[]>>(
  '/api/tasks?grouped=true', 
  fetcher, 
  { refreshInterval: 3000 }
);

// Add state for expanded dates
const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
const toggleDate = (date: string) => {
  const newSet = new Set(expandedDates);
  if (newSet.has(date)) {
    newSet.delete(date);
  } else {
    newSet.add(date);
  }
  setExpandedDates(newSet);
};
```

**Step 2: Update tasks tab UI**

Replace the flat task list with grouped-by-date view:

```tsx
{activeTab === 'tasks' && (
  <div className="section">
    <div className="section-header">
      <h2 className="section-title">Tasks by Date</h2>
      <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
        + Add Task
      </button>
    </div>
    
    {groupedTasks && Object.keys(groupedTasks).length === 0 && (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p>No tasks yet. Add your first task!</p>
      </div>
    )}
    
    {groupedTasks && Object.entries(groupedTasks).map(([date, dateTasks]) => (
      <div key={date} className="date-group">
        <div className="date-header" onClick={() => toggleDate(date)}>
          <span className="date-label">
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
          <span className="date-count">{dateTasks.filter(t => t.status === 'pending').length} pending</span>
          <span className="expand-icon">{expandedDates.has(date) ? '▼' : '▶'}</span>
        </div>
        
        {expandedDates.has(date) && (
          <div className="date-tasks">
            {dateTasks.map(task => (
              <div key={task.id} className="item">
                <div className="item-content">
                  <div className="item-title">{task.title}</div>
                  {task.description && <div className="item-meta">{task.description}</div>}
                </div>
                <span className={`item-status status-${task.status}`}>{task.status}</span>
                <div className="item-actions">
                  <button className="icon-btn success" onClick={() => handleToggleTaskStatus(task)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDeleteTask(task.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

**Step 3: Add CSS styles**

```css
.date-group {
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.date-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  cursor: pointer;
  font-weight: 600;
}
.date-header:hover {
  background: #f3f4f6;
}
.date-label {
  flex: 1;
}
.date-count {
  font-size: 12px;
  color: #6b7280;
  margin-right: 12px;
}
.expand-icon {
  font-size: 10px;
  color: #9ca3af;
}
.date-tasks {
  padding: 8px;
}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add date-grouped task view in dashboard"
```

---

### Task 6: Create daily greeting API endpoint

**Files:**
- Create: `src/app/api/cron/daily-greeting/route.ts`

**Step 1: Create greeting endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { getAllChatIds } from '@/lib/conversation';

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

export async function POST(req: NextRequest) {
  try {
    // Verify cron-job.org API key
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
```

**Step 2: Add getAllChatIds to conversation.ts**

```typescript
export async function getAllChatIds() {
  const result = await db
    .selectDistinct({ telegramChatId: conversations.telegramChatId })
    .from(conversations);
  return result.map(r => r.telegramChatId);
}
```

**Step 3: Commit**

```bash
git add src/app/api/cron/daily-greeting/route.ts src/lib/conversation.ts
git commit -m "feat: add daily greeting cron endpoint"
```

---

### Task 7: Create task reminder API endpoint

**Files:**
- Create: `src/app/api/cron/task-reminder/route.ts`
- Modify: `src/lib/schema.ts` (add reminder tracking table)

**Step 1: Add reminder tracking table**

```typescript
export const taskReminders = pgTable('task_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  lastReminderSent: timestamp('last_reminder_sent', { mode: 'date' }),
  nextReminderAt: timestamp('next_reminder_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});
```

Run `npm run db:push`

**Step 2: Create reminder functions in tasks.ts**

```typescript
export async function getTodaysPendingTasksWithReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'pending'),
        gte(tasks.taskDate, today),
        lte(tasks.taskDate, tomorrow)
      )
    );
}

export async function createOrUpdateReminder(taskId: string, chatId: number, nextReminder: Date) {
  const existing = await db
    .select()
    .from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));

  if (existing.length > 0) {
    return db
      .update(taskReminders)
      .set({ lastReminderSent: new Date(), nextReminderAt: nextReminder })
      .where(eq(taskReminders.taskId, taskId));
  }

  return db
    .insert(taskReminders)
    .values({
      taskId,
      chatId,
      lastReminderSent: new Date(),
      nextReminderAt: nextReminder,
    });
}

export async function getTasksDueForReminder() {
  const now = new Date();
  return db
    .select()
    .from(taskReminders)
    .where(
      and(
        lte(taskReminders.nextReminderAt, now),
        eq(taskReminders.chatId, parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID || '1345151781'))
      )
    );
}
```

**Step 3: Create reminder API endpoint**

```typescript
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

    // Schedule next reminder (2-3 hours from now)
    const nextReminder = new Date();
    nextReminder.setHours(nextReminder.getHours() + REMINDER_INTERVAL_HOURS + Math.random());

    for (const task of pendingTasks) {
      await createOrUpdateReminder(task.id, parseInt(ADMIN_CHAT_ID), nextReminder);
    }

    return NextResponse.json({ success: true, tasksReminded: pendingTasks.length });
  } catch (error) {
    console.error('Task reminder error:', error);
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/cron/task-reminder/route.ts src/lib/schema.ts src/lib/tasks.ts
git commit -m "feat: add task reminder cron endpoint"
```

---

### Task 8: Handle task completion response from Telegram

**Files:**
- Modify: `src/bot/polling-bot.ts` and `src/app/api/telegram/webhook/route.ts`

**Step 1: Add completion handling in polling-bot.ts**

When user replies with "completed" or similar keywords, process task completion:

```typescript
// In the message handler, after checking for commands
const COMPLETION_KEYWORDS = ['completed', 'done', 'finished', 'all done', 'mark complete'];

function isCompletionMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPLETION_KEYWORDS.some(keyword => lower.includes(keyword));
}

// After the regular message handler, add:
if (isCompletionMessage(text)) {
  // Get pending tasks and ask which ones are completed
  const pendingTasks = await getTodaysPendingTasks();
  if (pendingTasks.length === 0) {
    await bot.sendMessage(chatId, "No pending tasks to complete! ✅");
    return;
  }
  
  const taskList = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
  await bot.sendMessage(chatId, `Which tasks did you complete?\n\n${taskList}\n\nJust reply with the numbers or names!`);
  return;
}
```

Also update the AI response parsing to handle completion responses.

**Step 2: Commit**

```bash
git add src/bot/polling-bot.ts src/app/api/telegram/webhook/route.ts
git commit -m "feat: handle task completion responses from users"
```

---

### Task 9: Test and verify

**Step 1: Test dashboard**

- Navigate to localhost:3000/dashboard
- Check Tasks tab shows tasks grouped by date
- Check Sessions tab shows chat sessions

**Step 2: Test API endpoints**

```bash
# Test daily greeting (with proper auth)
curl -X POST http://localhost:3000/api/cron/daily-greeting \
  -H "Authorization: Bearer 1D6U3E43l9KKnk7rwORiF9gr1cBTpGFKQoSwHxnIizM="

# Test task reminder
curl -X POST http://localhost:3000/api/cron/task-reminder \
  -H "Authorization: Bearer 1D6U3E43l9KKnk7rwORiF9gr1cBTpGFKQoSwHxnIizM="
```

**Step 3: Commit**

```bash
git add .
git commit -m "test: verify all new features work correctly"
```

---

## Plan Complete

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?