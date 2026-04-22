import { NextRequest, NextResponse } from "next/server";
import { setAgentMode } from "@/lib/supabase";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { phone_number, mode } = body;

    if (!phone_number || !mode || !["ai", "human"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid parameters. Need phone_number and mode ('ai' or 'human')" },
        { status: 400 }
      );
    }

    await setAgentMode(phone_number, mode as "ai" | "human");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[admin-mode] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
