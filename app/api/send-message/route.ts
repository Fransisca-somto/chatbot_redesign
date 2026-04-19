// ============================================================
// SEND MESSAGE — INTERNAL API TO SEND WHATSAPP MESSAGES
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  sendTextMessage,
  sendImageMessage,
  sendInteractiveButtons,
} from "@/lib/whatsapp";

// ── Types ────────────────────────────────────────────────────

interface SendMessageBody {
  to: string;
  type: "text" | "image" | "interactive";
  text?: string;
  imageUrl?: string;
  caption?: string;
  buttons?: { id: string; title: string }[];
}

// ── POST: Send a message via WhatsApp ────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate the request has proper authorization
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: SendMessageBody = await request.json();

    // Validate required fields
    if (!body.to) {
      return NextResponse.json(
        { error: "Missing 'to' field — recipient phone number is required." },
        { status: 400 }
      );
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Missing 'type' field — must be 'text', 'image', or 'interactive'." },
        { status: 400 }
      );
    }

    let result = null;

    switch (body.type) {
      case "text": {
        if (!body.text) {
          return NextResponse.json(
            { error: "Missing 'text' field for text message." },
            { status: 400 }
          );
        }
        result = await sendTextMessage(body.to, body.text);
        break;
      }

      case "image": {
        if (!body.imageUrl) {
          return NextResponse.json(
            { error: "Missing 'imageUrl' field for image message." },
            { status: 400 }
          );
        }
        result = await sendImageMessage(body.to, body.imageUrl, body.caption);
        break;
      }

      case "interactive": {
        if (!body.text || !body.buttons || body.buttons.length === 0) {
          return NextResponse.json(
            {
              error:
                "Missing 'text' and/or 'buttons' fields for interactive message.",
            },
            { status: 400 }
          );
        }
        result = await sendInteractiveButtons(body.to, body.text, body.buttons);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported message type: ${body.type}` },
          { status: 400 }
        );
    }

    if (result) {
      return NextResponse.json(
        { success: true, data: result },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message. Check server logs for details." },
      { status: 502 }
    );
  } catch (error) {
    console.error(
      "[send-message] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
