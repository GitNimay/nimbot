# Memory System Fix - Design

## Goal
Fix the AI memory system so that:
1. When user says "Remember my name is Nimay", bot acknowledges and saves it
2. Bot uses saved user info in subsequent conversations
3. Switch to better AI model (Qwen) for improved function calling

## Current Issues

1. **Wrong prompt injection** (ai-agent.ts:503-506):
   - Current: `You are Nimbot (your name is Nimay)` 
   - Problem: Sounds like the bot's name is Nimay
   - Fix: Use "User's name: Nimay" to be clear

2. **AI not calling saveMemory**:
   - Groq Llama may not reliably call the saveMemory function
   - Need to switch to Qwen which has better function calling

3. **No acknowledgment**:
   - Bot should respond with "Got it! I'll remember your name is X"
   - Currently it just saves silently

## Solution

### 1. Fix Prompt Injection
Change from:
```js
augmentedSystemPrompt = augmentedSystemPrompt.replace('You are Nimbot', `You are Nimbot (your name is ${userName})`);
```
To:
```js
augmentedSystemPrompt += `\n\nUser's name: ${userName}`;
```

### 2. Switch to Qwen Model
Replace `llama-3.2-90b-versatile` with Groq's Qwen model in MODEL_CONFIG:
```js
groq: 'qwen/qwen-2.5-32b-instruct',
```

### 3. Add Memory Recall in Response
After saveMemory is called, include the saved info in the bot's response.

## Files to Modify
- `src/lib/ai-agent.ts` - Fix prompt injection, switch model
- `src/lib/memory.ts` - Already has correct implementation

## Testing
1. Deploy to Vercel
2. Test: "Remember my name is [YourName]"
3. Verify bot acknowledges
4. Test: "What's my name?" in new conversation
5. Verify bot remembers
