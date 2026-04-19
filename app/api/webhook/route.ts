// ============================================================
// WEBHOOK ROUTE — RECEIVES & VERIFIES META WEBHOOK (GET + POST)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  isMessageProcessed,
  markMessageProcessed,
  saveMessage,
} from "@/lib/supabase";
import {
  detectCommand,
  handleMenuCommand,
  handleFaqCommand,
  handleAgentCommand,
  handleBookingFlow,
  startBookingFlow,
} from "@/lib/commands";
import { loadConversationMemory } from "@/lib/memory";
import { generateAIReply } from "@/lib/openrouter";
import { sendTextMessage, markAsRead } from "@/lib/whatsapp";

// ── Types for Meta Webhook Payload ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetaWebhookPayload = any;

// ── GET: Webhook Verification ────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error("[webhook] WEBHOOK_VERIFY_TOKEN not set in environment.");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[webhook] Webhook verified successfully.");
      return new NextResponse(challenge, { status: 200 });
    }

    console.warn("[webhook] Webhook verification failed. Invalid token.");
    return NextResponse.json(
      { error: "Forbidden — invalid verify token" },
      { status: 403 }
    );
  } catch (error) {
    console.error(
      "[webhook] Verification error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── POST: Incoming Messages ──────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: MetaWebhookPayload = await request.json();

    // Process the webhook synchronously before returning.
    // Vercel terminates serverless functions after the response is sent,
    // so fire-and-forget / background processing does NOT work.
    // Meta allows ~15s before retrying, and our flow completes in 3-5s.
    await processWebhook(body);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error(
      "[webhook] POST handler error:",
      error instanceof Error ? error.message : error
    );
    // Always return 200 to Meta to prevent retries
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

// ── Background Processing Pipeline ──────────────────────────

async function processWebhook(body: MetaWebhookPayload): Promise<void> {
  try {
    // Validate the webhook structure
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      // This could be a status update or other non-message event — ignore
      return;
    }

    const value = body.entry[0].changes[0].value;
    const message = value.messages[0];
    const from: string = message.from; // sender phone number
    const messageId: string = message.id;
    const messageType: string = message.type;

    // ── Step 1: Only process text and interactive messages ────
    if (messageType !== "text" && messageType !== "interactive") {
      console.log(
        `[webhook] Ignoring non-text message type: ${messageType} from ${from}`
      );
      return;
    }

    // Extract message text
    let messageText = "";
    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "interactive") {
      // Interactive button replies
      messageText =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "";
    }

    if (!messageText.trim()) {
      return;
    }

    console.log(`[webhook] Message from ${from}: "${messageText}"`);

    // ── Step 2: Deduplication ────────────────────────────────
    const alreadyProcessed = await isMessageProcessed(messageId);
    if (alreadyProcessed) {
      console.log(`[webhook] Duplicate message ${messageId} — skipping.`);
      return;
    }

    // ── Step 3: Mark as processed ────────────────────────────
    await markMessageProcessed(messageId);

    // ── Step 4: Mark as read (send read receipt) ─────────────
    await markAsRead(messageId);

    // ── Step 5: Save incoming message ────────────────────────
    await saveMessage(from, "user", messageText);

    // ── Step 6: Check for active booking flow first ──────────
    const bookingResponse = await handleBookingFlow(from, messageText);
    if (bookingResponse) {
      await saveMessage(from, "assistant", bookingResponse);
      await sendTextMessage(from, bookingResponse);
      return;
    }

    // ── Step 7: Detect command ───────────────────────────────
    const command = detectCommand(messageText);
    let reply: string;

    switch (command) {
      case "menu": {
        reply = await handleMenuCommand(from);
        break;
      }

      case "book": {
        reply = await startBookingFlow(from);
        break;
      }

      case "faq": {
        reply = await handleFaqCommand();
        break;
      }

      case "agent": {
        reply = await handleAgentCommand(from);
        break;
      }

      default: {
        // ── Step 8: No command — use AI ──────────────────────
        const conversationHistory = await loadConversationMemory(from, 10);
        reply = await generateAIReply(messageText, conversationHistory, from);
        break;
      }
    }

    // ── Step 9: Save AI/bot reply ────────────────────────────
    await saveMessage(from, "assistant", reply, command ? "system" : undefined);

    // ── Step 10: Send reply via WhatsApp ─────────────────────
    await sendTextMessage(from, reply);

    console.log(`[webhook] Reply sent to ${from}`);
  } catch (error) {
    console.error(
      "[webhook] Processing error:",
      error instanceof Error ? error.message : error
    );
  }
}
