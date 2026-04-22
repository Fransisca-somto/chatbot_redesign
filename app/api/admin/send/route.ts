import { NextRequest, NextResponse } from "next/server";
import { sendTextMessage } from "@/lib/whatsapp";
import { saveMessage } from "@/lib/supabase";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { phone_number, message } = body;

    if (!phone_number || !message) {
      return NextResponse.json(
        { error: "Missing phone_number or message" },
        { status: 400 }
      );
    }

    // Send the message via WhatsApp API
    const result = await sendTextMessage(phone_number, message);

    if (result) {
      // Save it as an admin message in the database
      await saveMessage(phone_number, "assistant", message, "admin", "human-admin");
      return NextResponse.json({ success: true, data: result }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Failed to send message via WhatsApp" },
      { status: 502 }
    );
  } catch (error) {
    console.error("[admin-send] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
