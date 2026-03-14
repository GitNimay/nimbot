# Enhanced /newchat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add auto-suggest for /newchat when user types related phrases, and display all chat sessions with full history in dashboard.

**Architecture:** 
- Telegram: Add inline keyboard with /newchat suggestion when user types "new chat", "start fresh", "new conversation" etc.
- Dashboard: Add clickable session cards that expand to show full conversation history, with chat summary
- Database: Add optional summary field to conversations table

**Tech Stack:** Next.js, Telegram Bot API, Drizzle ORM, Neon PostgreSQL

---

### Task 1: Add summary field to conversations table

**Files:**
- Modify: `src/lib/schema.ts:7-14`

**Step 1: Add summary column to schema**

```typescript
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull(),
  sessionName: varchar('session_name', { length: 255 }).default('New Chat'),
  summary: text('summary'),  // NEW: Add this line
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  isActive: boolean('is_active').default(true),
});
```

**Step 2: Add Conversation type update**

Update the Conversation type at bottom of file to include summary.

**Step 3: Run database migration**

Run: `npm run db:push`

**Step 4: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat: add summary field to conversations table"
```

---

### Task 2: Add summary generation when starting new chat

**Files:**
- Modify: `src/lib/conversation.ts:31-45`

**Step 1: Update startNewChat function**

```typescript
export async function startNewChat(chatId: number) {
  // Get current active conversation to generate summary
  const currentConv = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.telegramChatId, chatId), eq(conversations.isActive, true)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  // Generate summary if conversation exists
  if (currentConv.length > 0) {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, currentConv[0].id))
      .orderBy(messages.createdAt);
    
    if (msgs.length > 0) {
      const userMessages = msgs.filter(m => m.role === 'user').map(m => m.content);
      const summary = userMessages.slice(0, 5).join(' | '); // First 5 user messages as summary
      
      await db
        .update(conversations)
        .set({ isActive: false, summary })
        .where(eq(conversations.id, currentConv[0].id));
    } else {
      await db
        .update(conversations)
        .set({ isActive: false })
        .where(eq(conversations.id, currentConv[0].id));
    }
  }

  // Create new conversation
  const result = await db
    .insert(conversations)
    .values({
      telegramChatId: chatId,
      sessionName: `Chat ${new Date().toLocaleDateString()}`,
    })
    .returning();
  return result[0];
}
```

**Step 2: Commit**

```bash
git add src/lib/conversation.ts
git commit -m "feat: generate summary when starting new chat"
```

---

### Task 3: Enhance Telegram bot with /newchat auto-suggest

**Files:**
- Modify: `src/bot/polling-bot.ts:1-119`

**Step 1: Add auto-suggest logic**

Replace the message handler to detect phrases related to new chat and suggest /newchat command using Telegram's inline keyboard:

```typescript
// Add this helper function
const NEW_CHAT_KEYWORDS = ['new chat', 'new conversation', 'start fresh', 'clear chat', 'reset chat', 'begin new'];

function shouldSuggestNewChat(text: string): boolean {
  const lower = text.toLowerCase();
  return NEW_CHAT_KEYWORDS.some(keyword => lower.includes(keyword));
}

// Update the /new chat handler to use the enhanced startNewChat
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

// Add auto-suggest for /newchat
if (shouldSuggestNewChat(text)) {
  await bot.sendMessage(chatId, 'Did you want to start a new chat?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Start New Chat', callback_data: 'newchat' }]
      ]
    }
  });
}

// Handle callback query for inline button
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
```

**Step 2: Commit**

```bash
git add src/bot/polling-bot.ts
git commit -m "feat: add /newchat auto-suggest to Telegram bot"
```

---

### Task 4: Update webhook route with same enhancements

**Files:**
- Modify: `src/app/api/telegram/webhook/route.ts`

**Step 1: Add new chat handling to webhook**

Add similar auto-suggest logic to the webhook route.

**Step 2: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit -m "feat: add /newchat auto-suggest to webhook"
```

---

### Task 5: Enhance dashboard sessions tab

**Files:**
- Modify: `src/app/dashboard/page.tsx:269-292`

**Step 1: Add state for selected conversation**

```typescript
const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
```

**Step 2: Add click handler to load conversation**

```typescript
const handleSelectConversation = async (conv: Conversation) => {
  const response = await fetch(`/api/conversations?id=${conv.id}`);
  const data = await response.json();
  setSelectedConversation(data.conversation);
  setConversationMessages(data.messages || []);
  setActiveTab('chat-detail');
};
```

**Step 3: Update sessions tab UI**

Replace the sessions tab with clickable cards:

```tsx
{activeTab === 'sessions' && (
  <div className="section">
    <div className="section-header">
      <h2 className="section-title">Chat Sessions</h2>
    </div>
    <div className="item-list">
      {conversations?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>No chat sessions yet. Start chatting with your bot!</p>
        </div>
      ) : (
        conversations?.map(conv => (
          <div 
            key={conv.id} 
            className="item clickable"
            onClick={() => handleSelectConversation(conv)}
          >
            <div className="item-content">
              <div className="item-title">
                {conv.sessionName}
                {conv.isActive && <span className="active-badge">Active</span>}
              </div>
              <div className="item-meta">{formatDate(conv.createdAt)}</div>
              {conv.summary && <div className="item-summary">{conv.summary}</div>}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
)}
```

**Step 4: Add chat detail view**

Add a new tab/view for showing full conversation:

```tsx
{activeTab === 'chat-detail' && selectedConversation && (
  <div className="section">
    <div className="section-header">
      <button className="btn btn-secondary" onClick={() => setActiveTab('sessions')}>
        ← Back to Sessions
      </button>
      <h2 className="section-title">{selectedConversation.sessionName}</h2>
    </div>
    <div className="chat-messages">
      {conversationMessages.map(msg => (
        <div key={msg.id} className={`chat-message ${msg.role}`}>
          <div className="message-content">{msg.content}</div>
          <div className="message-time">{formatDate(msg.createdAt)}</div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 5: Add CSS styles for new UI elements**

Add to the page CSS:
- `.clickable` - cursor pointer, hover effect
- `.active-badge` - small badge for active sessions
- `.item-summary` - truncated summary text
- `.chat-messages` - message container
- `.chat-message` - user/assistant message styling

**Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: enhance dashboard sessions with clickable history"
```

---

### Task 6: Update API route to return messages

**Files:**
- Modify: `src/app/api/conversations/route.ts`

**Step 1: Ensure messages are returned**

The existing code already returns messages when conversation ID is provided. Verify it works correctly.

**Step 2: Commit**

```bash
git add src/app/api/conversations/route.ts
git commit -m "fix: ensure conversation messages are returned in API"
```

---

### Task 7: Test end-to-end

**Step 1: Start the development servers**

Run both:
```bash
npm run dev
npm run bot
```

**Step 2: Test Telegram bot**

1. Send "new chat" to bot - should see auto-suggest
2. Click the button - should start new chat
3. Old chat should now be inactive

**Step 3: Test dashboard**

1. Open localhost:3000/dashboard
2. Go to Sessions tab
3. Click on a session - should see full chat history
4. New chat should appear as "Active"

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify /newchat and dashboard sessions work"
```

---

## Plan Complete

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?