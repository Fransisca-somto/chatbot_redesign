import { NextRequest, NextResponse } from "next/server";
import { getConversationByPhone } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { phone: string } }
): Promise<NextResponse> {
  try {
    const phone = params.phone;
    if (!phone) {
      return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });
    }

    const data = await getConversationByPhone(phone);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error(`[admin-api] Error fetching conversation for ${params.phone}:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
