# 🤖 Paradox Store — WhatsApp AI Chatbot

A production-grade WhatsApp AI chatbot for **Paradox Store** built with Next.js 14, Supabase, and OpenRouter (Claude + Gemini fallback).

> **One-file configuration**: Edit only `/config/business.ts` to customize the bot for your business.

---

## ✨ Features

- 🤖 **AI-Powered Conversations** — Uses Claude (primary) with automatic Gemini fallback
- 📋 **Service Menu** — Displays your services and prices on demand
- 📅 **Multi-Step Booking** — Guided 5-step booking flow via WhatsApp
- ❓ **FAQ System** — Instantly answers common questions
- 👤 **Human Handoff** — Seamlessly connects customers to a real agent
- 📧 **Email + WhatsApp Alerts** — Notifies agents of new bookings and handoff requests
- 🧠 **Conversation Memory** — Loads last 10 messages for context-aware replies
- 🔒 **Deduplication** — Prevents duplicate message processing
- ⚡ **Background Processing** — Responds to Meta webhook within 5 seconds

---

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js 18+** — [Download here](https://nodejs.org/)
2. **A Vercel account** — [Sign up free](https://vercel.com)
3. **A Meta Business account** with WhatsApp API access — [Meta for Developers](https://developers.facebook.com)
4. **A Supabase account** — [Sign up free](https://supabase.com)
5. **An OpenRouter account** — [Sign up here](https://openrouter.ai)
6. **A Gmail account** (for sending email notifications via SMTP)

---

## 🚀 Step-by-Step Setup

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd paradox-store-chatbot
npm install
```

### Step 2: Set Up Meta WhatsApp Business API

1. Go to [Meta for Developers](https://developers.facebook.com) and log in
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** as the app type
4. Give your app a name (e.g., "Paradox Store Bot") and click Create
5. In your app dashboard, click **"Add Product"** and select **"WhatsApp"**
6. Go to **WhatsApp → API Setup** in the left sidebar
7. You'll see:
   - **Phone Number ID** — Copy this (this is your `WHATSAPP_PHONE_ID`)
   - **Temporary Access Token** — Copy this (this is your `WHATSAPP_TOKEN`)
   - A test phone number to send from
8. Add your phone number as a **test recipient** under "To" field
9. Go to **WhatsApp → Configuration** in the left sidebar
10. You'll configure the webhook URL here after deploying (see Step 7)

> 💡 **Tip**: For production, generate a permanent System User Token instead of the temporary one. Go to **Business Settings → System Users → Generate Token**.

### Step 3: Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Once your project is ready, go to **SQL Editor**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it into the SQL Editor and click **"Run"**
5. Verify the tables were created: go to **Table Editor** and check for:
   - `conversations`
   - `processed_messages`
   - `booking_sessions`
   - `bookings`
6. Go to **Settings → API** and copy:
   - **URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** → This is your `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **Important**: Use the `service_role` key, NOT the `anon` key. The service role key bypasses Row Level Security for server-side operations.

### Step 4: Set Up OpenRouter

1. Go to [OpenRouter](https://openrouter.ai) and create an account
2. Add credits to your account (Claude Haiku is very cheap — ~$0.25/M input tokens)
3. Go to **Keys** and generate a new API key
4. Copy the key — this is your `OPENROUTER_API_KEY`

### Step 5: Configure Environment Variables

1. Copy the example env file:

```bash
cp .env.local.example .env.local
```

2. Open `.env.local` and fill in ALL values:

```env
# From Meta for Developers (Step 2)
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_ID=your_phone_id_here
WEBHOOK_VERIFY_TOKEN=paradox_secret_2024

# From OpenRouter (Step 4)
OPENROUTER_API_KEY=your_key_here

# From Supabase (Step 3)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_16_char_app_password

# Agent notifications
AGENT_EMAIL=agent@yourbusiness.com
AGENT_WHATSAPP=+2348012345678
```

> 💡 **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App passwords. Generate a new app password for "Mail".

### Step 6: Run Locally with ngrok

For local webhook testing, you need a public URL. Use [ngrok](https://ngrok.com):

1. Install ngrok: [Download here](https://ngrok.com/download)

2. Start your dev server:
```bash
npm run dev
```

3. In a separate terminal, start ngrok:
```bash
ngrok http 3000
```

4. Copy the **Forwarding URL** (e.g., `https://abc123.ngrok.io`)

5. Go to **Meta for Developers → WhatsApp → Configuration**:
   - **Callback URL**: `https://abc123.ngrok.io/api/webhook`
   - **Verify Token**: `paradox_secret_2024` (must match your `WEBHOOK_VERIFY_TOKEN`)
   - Click **"Verify and Save"**

6. Under **Webhook Fields**, subscribe to: `messages`

7. Send a message to your test WhatsApp number — you should get a reply!

### Step 7: Deploy to Vercel

1. Push your code to GitHub/GitLab

2. Go to [Vercel](https://vercel.com) and import your repository

3. In the Vercel project settings, add ALL environment variables from `.env.local`

4. Deploy the project

5. Copy your production URL (e.g., `https://paradox-store.vercel.app`)

6. Go back to **Meta for Developers → WhatsApp → Configuration**:
   - Update **Callback URL** to: `https://paradox-store.vercel.app/api/webhook`
   - Keep the same Verify Token
   - Click **"Verify and Save"**

7. Your bot is now live! 🎉

---

## ⚙️ Customizing Your Business

### Step 8: Update Business Information

Open `/config/business.ts` — this is the **ONLY file you need to edit**:

```typescript
export const BUSINESS_CONFIG = {
  name: "Your Business Name",
  tagline: "Your awesome tagline",
  description: "What your business does...",
  location: "Your address",
  operatingHours: "Mon-Sat: 9am-6pm",
  contactPhone: "+234...",
  contactEmail: "hello@yourbusiness.com",
  // ... more fields
};
```

### Step 9: Add or Modify Services, FAQs, or AI Model

**Adding services:**
```typescript
services: [
  { id: 1, name: "Haircut",     price: 3000,  description: "Professional haircut" },
  { id: 2, name: "Hair Coloring", price: 15000, description: "Full color treatment" },
  // Add more services here...
],
```

**Adding FAQs:**
```typescript
faqs: [
  { question: "Do you accept walk-ins?", answer: "Yes! Walk-ins are welcome during business hours." },
  // Add more FAQs here...
],
```

**Changing AI model:** Edit `/lib/openrouter.ts`:
```typescript
const PRIMARY_MODEL = "anthropic/claude-3-haiku";    // Change primary model
const FALLBACK_MODEL = "google/gemini-flash-1.5";    // Change fallback model
```

Browse available models at [OpenRouter Models](https://openrouter.ai/models).

---

## 🔧 Troubleshooting

### Webhook not receiving messages

1. **Check your webhook URL** in Meta for Developers → WhatsApp → Configuration
2. Make sure the URL ends with `/api/webhook`
3. Verify the **Verify Token** matches `WEBHOOK_VERIFY_TOKEN` in your `.env.local`
4. Make sure you've subscribed to the `messages` webhook field
5. If using ngrok, ensure it's still running and the URL hasn't changed
6. Check Vercel function logs for errors

### AI not responding

1. Check your **OpenRouter API key** is valid and has credits
2. Check Vercel/terminal logs for error messages from `[openrouter]`
3. Verify the model names in `/lib/openrouter.ts` are correct
4. Try switching to a different model temporarily

### Bookings not saving

1. Verify your **Supabase URL and service_role key** are correct
2. Check that all 4 tables exist in Supabase (run the SQL schema again if needed)
3. Check Vercel logs for `[supabase]` error messages
4. Make sure you're using the `service_role` key (not `anon`)

### Email notifications not sending

1. Verify Gmail App Password is correct (16 characters, no spaces)
2. Make sure 2-Step Verification is enabled on your Google account
3. Check that `SMTP_USER` and `SMTP_PASS` are set correctly
4. Try sending a test email using the `/api/handoff` endpoint

### Duplicate replies

1. The system uses message deduplication via the `processed_messages` table
2. If you're getting duplicates, check if Meta is retrying webhooks (your server may be too slow to respond)
3. Ensure your webhook returns 200 within 5 seconds

---

## 📁 Project Structure

```
/app
  /api
    /webhook/route.ts         ← Receives & verifies Meta webhook
    /send-message/route.ts    ← Internal API to send messages
    /handoff/route.ts         ← Triggers human agent alert
/lib
  whatsapp.ts                 ← WhatsApp Business API client
  openrouter.ts               ← AI with Claude + Gemini fallback
  supabase.ts                 ← Database client + helpers
  commands.ts                 ← Command parser + booking flow
  memory.ts                   ← Conversation memory loader
  notify.ts                   ← Email + WhatsApp notifications
/config
  business.ts                 ← ⭐ ALL BUSINESS INFO (edit this!)
/prompts
  system.ts                   ← Dynamic AI system prompt
.env.local.example            ← Environment variable template
supabase-schema.sql           ← Database schema
```

---

## 📄 License

MIT License — feel free to use this for your business!

---

Built with ❤️ for **Paradox Store**
