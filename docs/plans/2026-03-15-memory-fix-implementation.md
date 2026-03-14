# Memory System Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix the AI memory system so bot properly saves, acknowledges, and recalls user information like their name.

**Architecture:** Fix prompt injection in ai-agent.ts to use "User's name: X" instead of "your name is X", switch to Qwen model for better function calling, and ensure acknowledgment response.

**Tech Stack:** Groq SDK, OpenAI-compatible API, Drizzle ORM, Neon PostgreSQL

---

### Task 1: Fix prompt injection in ai-agent.ts

**Files:**
- Modify: `src/lib/ai-agent.ts:503-506`

**Step 1: Change the user name injection**

Current code (lines 503-506):
```js
const userName = await getMemory('user_name');
if (userName) {
  augmentedSystemPrompt = augmentedSystemPrompt.replace('You are Nimbot', `You are Nimbot (your name is ${userName})`);
}
```

Replace with:
```js
const userName = await getMemory('user_name');
if (userName) {
  augmentedSystemPrompt += `\n\nUser's name: ${userName}`;
}
```

**Step 2: Verify change**

Check that the code now appends "User's name: Nimay" instead of replacing the bot's identity.

**Step 3: Commit**

```bash
git add src/lib/ai-agent.ts
git commit -m "fix: correct user name injection in system prompt"
```

---

### Task 2: Switch to Qwen model for better function calling

**Files:**
- Modify: `src/lib/ai-agent.ts:25-37`

**Step 1: Update MODEL_CONFIG**

Change the groq model from llama to qwen:

```js
const MODEL_CONFIG = {
  // ... other models ...
  groq: 'qwen/qwen-2.5-32b-instruct',  // Changed from llama-3.2-90b-versatile
  // ... keep fallback models ...
};
```

**Step 2: Commit**

```bash
git add src/lib/ai-agent.ts
git commit -m "feat: switch to Qwen model for better function calling"
```

---

### Task 3: Test memory system

**Step 1: Deploy to Vercel**

Push changes to trigger deployment.

**Step 2: Test via Telegram**

Send: "Remember my name is TestUser"
Expected: Bot should save memory AND respond with acknowledgment like "Got it! I'll remember your name is TestUser"

**Step 3: Test recall**

Send in new message: "What's my name?"
Expected: Bot should say "Your name is TestUser" (or similar)

**Step 4: If still not working, consider adding a second model try**

If Qwen still doesn't call saveMemory, we can add Qwen 3 32B as fallback in the model chain.

---

### Task 4: Verify no regressions

**Step 1: Test existing features still work**

- Create a task: "Add task: Buy milk"
- Create a schedule: "Meeting at 3pm"
- Complete a task: "Buy milk done"

**Step 2: Commit any fixes**

```bash
git add .
git commit -m "fix: ensure existing features work after memory changes"
```

---

## Plan Complete

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
