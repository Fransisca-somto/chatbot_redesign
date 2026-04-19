# 🤖 PARADOX STORE — WHATSAPP CHATBOT MASTER BUILD PROMPT
## Paste this entire prompt into Claude or Gemini to generate the full system

---

## ROLE & OBJECTIVE

You are a senior full-stack developer specializing in WhatsApp Business API integrations.
Your task is to build a production-grade WhatsApp AI chatbot for **Paradox Store** using
Next.js 14 (App Router), Supabase, and OpenRouter (with Claude as primary model and
Gemini as automatic fallback when Claude is unavailable or quota is exceeded).

Build every file completely. Do not use placeholders or "add your logic here" comments.
Every function must be fully implemented and production-ready.

---

## TECH STACK

| Layer         | Technology                                      |
|---------------|-------------------------------------------------|
| Framework     | Next.js 14 (App Router, TypeScript)             |
| Hosting       | Vercel                                          |
| Database      | Supabase (PostgreSQL)                           |
| AI Router     | OpenRouter API                                  |
| Primary Model | anthropic/claude-3-haiku (cheapest/fastest)     |
| Fallback Model| google/gemini-flash-1.5 (when Claude unavailable)|
| Messaging     | WhatsApp Business API (Meta Graph API v18.0)    |
| Notifications | Email via Nodemailer + WhatsApp agent alert     |

---

## PROJECT STRUCTURE TO GENERATE

Generate every one of these files completely:

```
/app
  /api
    /webhook/route.ts         ← Receives & verifies Meta webhook (GET + POST)
    /send-message/route.ts    ← Internal API to send WhatsApp messages
    /handoff/route.ts         ← Triggers human agent alert
/lib
  whatsapp.ts                 ← Send text, images, interactive buttons via Meta API
  openrouter.ts               ← AI call with Claude primary + Gemini fallback logic
  supabase.ts                 ← Supabase client + all DB helper functions
  commands.ts                 ← Parses commands: /menu, /book, "4" = agent handoff
  memory.ts                   ← Loads last 10 messages from Supabase for context
  notify.ts                   ← Sends booking email + WhatsApp agent notification
/config
  business.ts                 ← ⭐ ALL BUSINESS INFO LIVES HERE (edit this file only)
/prompts
  system.ts                   ← Builds full system prompt from business.ts config
.env.local.example            ← All required environment variables
README.md                     ← Full setup and deployment guide
supabase-schema.sql           ← Copy-paste SQL to create all required tables
```

> ⭐ IMPORTANT: The file `/config/business.ts` is the ONLY file the business owner
> needs to edit. All business-specific information must be imported from this file
> into every other part of the system. Never hardcode business info elsewhere.

---

## /config/business.ts — FULL SPECIFICATION

This file must export a single `BUSINESS_CONFIG` object containing ALL of the following:

```typescript
export const BUSINESS_CONFIG = {
  name: "Paradox Store",
  tagline: "[OWNER: Add your store tagline here]",
  description: "[OWNER: Describe what Paradox Store offers in 2-3 sentences]",
  location: "123 Main Street, City, Country", // placeholder
  operatingHours: "Monday – Saturday: 9am – 6pm",
  contactPhone: "[OWNER: Add your WhatsApp number with country code]",
  contactEmail: "[OWNER: Add your business email]",
  agentWhatsAppNumber: "[OWNER: Add the human agent WhatsApp number e.g. +2348012345678]",
  agentEmail: "[OWNER: Add the agent notification email]",
  bookingLink: "[OWNER: Add Calendly or booking page URL]",
  currency: "NGN", // Change to your currency code

  services: [
    // OWNER: Replace these with your actual services and prices
    { id: 1, name: "Service One",   price: 5000,  description: "Brief description" },
    { id: 2, name: "Service Two",   price: 10000, description: "Brief description" },
    { id: 3, name: "Service Three", price: 15000, description: "Brief description" },
  ],

  faqs: [
    // OWNER: Add your most common customer questions and answers
    { question: "How do I place an order?",    answer: "Reply with /book to start a booking." },
    { question: "What payment methods do you accept?", answer: "[OWNER: Add answer]" },
    { question: "How long does delivery take?", answer: "[OWNER: Add answer]" },
  ],

  welcomeMessage: `
Welcome to *Paradox Store!* 🎉

How can we help you today? Reply with a number:

*1️⃣* — View our Services & Prices
*2️⃣* — Make a Booking
*3️⃣* — FAQs & Help
*4️⃣* — Speak to a Human Agent
  `.trim(),

  commands: {
    menu:   ["/menu", "/start", "/hello", "hi", "hello", "hey"],
    book:   ["/book", "/booking", "2", "book", "reserve"],
    faq:    ["/faq", "/help", "3", "faq", "help"],
    agent:  ["/agent", "4", "human", "agent", "speak to human"],
  },

  mediaImages: {
    // OWNER: Replace with actual public image URLs hosted on Cloudinary, Supabase Storage, etc.
    welcomeBanner:  "https://placehold.co/800x400?text=Paradox+Store",
    servicesCatalog:"https://placehold.co/800x600?text=Our+Services",
    bookingConfirm: "https://placehold.co/800x400?text=Booking+Confirmed",
  },

  brandTone: `
    - Friendly, professional, and enthusiastic
    - Use emojis moderately to keep messages warm
    - Always be solution-focused
    - Keep responses concise (under 200 words unless listing services)
    - Never make up prices or policies not listed in this config
  `,
}
```

---

## WEBHOOK LOGIC — /app/api/webhook/route.ts

### GET handler (webhook verification):
- Read `hub.mode`, `hub.verify_token`, `hub.challenge` from URL params
- If mode is `subscribe` AND verify_token matches `WEBHOOK_VERIFY_TOKEN` env var → return challenge
- Otherwise return 403

### POST handler (incoming messages):
Implement this exact processing pipeline:

1. Parse body: extract `from` (sender phone), `messageText`, `messageType`, `messageId`
2. Only process `type === "text"` and `type === "interactive"` messages (ignore status updates)
3. De-duplicate: check Supabase `processed_messages` table — if `messageId` already exists, return 200 immediately
4. Save `messageId` to `processed_messages` table
5. Save incoming message to `conversations` table with role `"user"`
6. Detect command using `commands.ts`:
   - If command is `menu` → send welcome image + welcome message text
   - If command is `book` → start booking flow (collect: name, service, date, time, phone)
   - If command is `faq` → send FAQ list
   - If command is `agent` (or user types "4") → trigger handoff: send agent alert, send user a message like "Connecting you to a human agent now 👤"
7. If no command detected → load last 10 messages from `memory.ts` + call `openrouter.ts` to generate AI reply
8. Save AI reply to `conversations` table with role `"assistant"`
9. Send reply via `whatsapp.ts`
10. Return 200 OK to Meta (must respond within 5 seconds — use background processing)

---

## BOOKING FLOW — /lib/commands.ts

The booking flow must be a multi-step stateful conversation stored in Supabase:

```
Step 1: Ask for full name
Step 2: Ask which service (show numbered list from BUSINESS_CONFIG.services)
Step 3: Ask preferred date (validate it's a future date)
Step 4: Ask preferred time
Step 5: Confirm booking details + send Calendly link + save to Supabase bookings table
Step 6: Notify agent via email (nodemailer) AND WhatsApp message to agent number
Step 7: Send user booking confirmation image + confirmation text
```

Track booking step in Supabase `booking_sessions` table with columns:
`phone`, `step`, `name`, `service`, `date`, `time`, `created_at`

---

## AI SYSTEM — /lib/openrouter.ts

```typescript
// PRIMARY: Claude Haiku (fast + cheap)
// FALLBACK: Gemini Flash (when Claude quota exceeded or unavailable)

// Logic:
// 1. Try Claude first with 8-second timeout
// 2. If error code 429 (rate limit), 503, or any 5xx → automatically switch to Gemini
// 3. Log which model was used to console for monitoring
// 4. Always pass full system prompt from /prompts/system.ts
// 5. Always pass last 10 messages from memory as conversation history
// 6. Max tokens: 500 (keeps responses concise for WhatsApp)
// 7. Temperature: 0.7
```

The function signature must be:
```typescript
export async function generateAIReply(
  userMessage: string,
  conversationHistory: Message[],
  senderPhone: string
): Promise<string>
```

---

## SYSTEM PROMPT — /prompts/system.ts

Build a dynamic system prompt from `BUSINESS_CONFIG`. It must include:

1. Business identity (name, location, hours)
2. Complete services list with prices
3. All FAQs
4. Brand tone guidelines
5. Hard rules:
   - NEVER invent prices or policies not in the config
   - NEVER roleplay as a different business
   - If user asks something you don't know → say "Let me connect you with our team" and suggest typing 4
   - Keep all replies under 200 words
   - Always respond in the same language the user writes in
   - Format replies for WhatsApp (use *bold*, line breaks — no markdown headers)

---

## SUPABASE SCHEMA — supabase-schema.sql

Generate SQL to create these 4 tables:

```sql
-- 1. conversations: full chat history per phone number
-- columns: id, phone, role (user/assistant), content, model_used, created_at

-- 2. processed_messages: for deduplication
-- columns: id, message_id (unique), created_at

-- 3. booking_sessions: tracks multi-step booking state
-- columns: id, phone, step, name, service, preferred_date, preferred_time, status, created_at

-- 4. bookings: confirmed completed bookings
-- columns: id, phone, name, service, preferred_date, preferred_time, confirmed_at, notified
```

Add Row Level Security policies and indexes on `phone` and `message_id` columns.

---

## ENVIRONMENT VARIABLES — .env.local.example

Generate this file with ALL required variables and clear comments explaining where to get each one:

```
# Meta / WhatsApp
WHATSAPP_TOKEN=            # From Meta for Developers → Your App → WhatsApp → API Setup
WHATSAPP_PHONE_ID=         # Your WhatsApp Business number Phone ID
WEBHOOK_VERIFY_TOKEN=      # Any secret string you choose (e.g. paradox_secret_2024)

# OpenRouter (get key at openrouter.ai)
OPENROUTER_API_KEY=

# Supabase (from supabase.com → Project → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY= # Use service role (not anon) for server-side operations

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=                 # Your Gmail address
SMTP_PASS=                 # Gmail App Password (NOT your regular password)
AGENT_EMAIL=               # Email to receive booking notifications
AGENT_WHATSAPP=            # Agent WhatsApp number with country code e.g. +2348012345678
```

---

## README.md — FULL SETUP GUIDE

Generate a step-by-step README covering:

1. Prerequisites (Node 18+, Vercel account, Meta Business account)
2. Clone and install (`npm install`)
3. How to set up Meta WhatsApp Business API (step by step with screenshot descriptions)
4. How to configure Supabase (run the SQL schema)
5. How to fill in `.env.local` (where to find each key)
6. How to run locally with `ngrok` for webhook testing
7. How to deploy to Vercel and set the webhook URL
8. How to update business info (point them ONLY to `/config/business.ts`)
9. How to add new services, FAQs, or change AI model in future
10. Troubleshooting: webhook not receiving, AI not responding, bookings not saving

---

## QUALITY REQUIREMENTS

- All TypeScript — no `any` types except for Meta's webhook payload
- All async operations wrapped in try/catch with meaningful error messages
- Every API route must return proper HTTP status codes
- The system must respond to Meta's webhook within 5 seconds (use `waitUntil` or background tasks)
- All sensitive logic must only run server-side (no API keys exposed to client)
- The system must handle concurrent messages gracefully (no duplicate replies)

---

## FINAL INSTRUCTION TO AI

Generate every file listed in the project structure above.
Start with `supabase-schema.sql`, then `/config/business.ts`, then all `/lib/` files,
then `/prompts/system.ts`, then `/app/api/` routes, then `.env.local.example`,
and end with `README.md`.

For each file, output the complete filename as a header then the full file content.
Do not summarize or skip any file. Every file must be 100% complete and runnable.
