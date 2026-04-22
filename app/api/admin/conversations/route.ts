import { NextResponse } from "next/server";
import { getAllConversations } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const conversations = await getAllConversations();
    return NextResponse.json({ success: true, data: conversations }, { status: 200 });
  } catch (error) {
    console.error("[admin-api] Error fetching conversations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
