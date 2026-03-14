# Nimbot - AI Schedule & Todo Manager

A Telegram bot built with Next.js that manages your schedule and todos using AI. Features multi-LLM fallback (OpenRouter → Gemini → Groq) and a real-time admin dashboard.

## Features

- **Telegram Bot**: Control everything via Telegram messages (uses long polling - no domain needed!)
- **AI-Powered**: Natural language processing for tasks and schedules
- **Smart Fallback**: Automatically switches between AI providers if limits are reached
- **Real-time Dashboard**: Admin panel with live data from Neon database
- **Reminders**: Automatic reminders 30 minutes before and at event time

## How It Works

This bot uses **long polling** (like OpenClaw) - it continuously checks Telegram for new messages. This means:
- ✅ No domain/URL required
- ✅ Works on local machine
- ✅ No SSL/HTTPS needed
- ✅ Easy to set up

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   - `TELEGRAM_BOT_TOKEN`: Get from @BotFather on Telegram
   - `TELEGRAM_ADMIN_CHAT_ID`: Your Telegram chat ID (optional, for reminders)
   - `OPENROUTER_API_KEY`: From openrouter.ai
   - `GEMINI_API_KEY`: From aistudio.google.com
   - `GROQ_API_KEY`: From console.groq.com

3. **Get Your Telegram Bot Token**
   - Open Telegram and message @BotFather
   - Use /newbot to create a new bot
   - Copy the token

4. **Get Your Chat ID** (optional, for reminders)
   - Message @userinfobot on Telegram
   - Copy your numeric chat ID

5. **Run the Bot** (terminal 1)
   ```bash
   npm run bot
   ```

6. **Run Reminder Scheduler** (terminal 2)
   ```bash
   npm run scheduler
   ```

7. **Run Dashboard** (optional - terminal 3)
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000/dashboard

## Running Everything

You need 3 terminal windows:

```bash
# Terminal 1 - Main bot (handles messages)
npm run bot

# Terminal 2 - Reminder scheduler (sends reminders)
npm run scheduler

# Terminal 3 - Next.js server (dashboard)
npm run dev
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome menu |
| `/new chat` | Start new conversation |
| `/tasks` | View today's tasks |
| `/schedule` | View today's schedule |

## Usage Examples

- **Add a task**: "Add task: buy groceries"
- **Add a schedule**: "Meeting at 2pm" or "Football at 2:30 p.m."
- **Mark done**: "this done, that done"
- **View tasks**: "what are my tasks?"

## Database

The app uses Neon PostgreSQL with the following tables:
- `conversations` - Chat sessions
- `messages` - Message history for RAG
- `tasks` - Todo items
- `schedules` - Scheduled events
- `api_usage` - Track AI provider usage

## Tech Stack

- **Backend**: Next.js 14 (App Router)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **AI**: OpenRouter, Gemini 2.0 Flash, Groq
- **Telegram**: node-telegram-bot-api with long polling
- **Frontend**: React with SWR for real-time updates

## API Fallback Logic

```
OpenRouter (Gemini 2.0 Flash) → Gemini 2.0 Flash → Groq (Llama)
```

If any provider fails or hits rate limits, it automatically switches to the next one.
