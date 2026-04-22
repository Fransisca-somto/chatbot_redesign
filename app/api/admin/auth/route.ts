import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("[admin-auth] ADMIN_PASSWORD not set in environment.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (password === adminPassword) {
      const response = NextResponse.json({ success: true }, { status: 200 });
      
      // Set an httpOnly cookie valid for 7 days
      response.cookies.set("admin_auth", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    console.error("[admin-auth] Auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
