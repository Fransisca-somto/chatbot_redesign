// ============================================================
// HANDOFF ROUTE — TRIGGERS HUMAN AGENT ALERT
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { BUSINESS_CONFIG } from "@/config/business";
import { sendTextMessage } from "@/lib/whatsapp";
import nodemailer from "nodemailer";

// ── Types ────────────────────────────────────────────────────

interface HandoffBody {
  customerPhone: string;
  customerName?: string;
  reason?: string;
}

// ── POST: Trigger agent handoff ──────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate authorization
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: HandoffBody = await request.json();

    if (!body.customerPhone) {
      return NextResponse.json(
        { error: "Missing 'customerPhone' field." },
        { status: 400 }
      );
    }

    const customerName = body.customerName || "A customer";
    const reason = body.reason || "Customer requested to speak with a human agent.";
    const timestamp = new Date().toLocaleString();

    // ── Send WhatsApp alert to agent ─────────────────────────
    const agentPhone = (
      process.env.AGENT_WHATSAPP ||
      BUSINESS_CONFIG.agentWhatsAppNumber
    ).replace(/[^0-9]/g, "");

    let whatsappSent = false;
    if (agentPhone && !agentPhone.includes("OWNER")) {
      const agentMessage = `🔔 *Human Agent Needed*

━━━━━━━━━━━━━━━━━
👤 *Customer:* ${customerName}
📱 *Phone:* ${body.customerPhone}
📝 *Reason:* ${reason}
⏰ *Time:* ${timestamp}
━━━━━━━━━━━━━━━━━

Please reach out to the customer on WhatsApp as soon as possible.`;

      const result = await sendTextMessage(agentPhone, agentMessage);
      whatsappSent = result !== null;
    }

    // ── Send email alert to agent ────────────────────────────
    let emailSent = false;
    const agentEmail = process.env.AGENT_EMAIL || BUSINESS_CONFIG.agentEmail;

    if (agentEmail && !agentEmail.includes("[OWNER")) {
      try {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const port = parseInt(process.env.SMTP_PORT || "587", 10);

        if (host && user && pass) {
          console.log("[handoff] Sending email alert to agent...");
          const transport = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          });

          await transport.sendMail({
            from: `"${BUSINESS_CONFIG.name}" <${user}>`,
            to: agentEmail,
            subject: `🔔 Agent Handoff — ${customerName} | ${BUSINESS_CONFIG.name}`,
            text: `Human Agent Needed\n\nCustomer: ${customerName}\nPhone: ${body.customerPhone}\nReason: ${reason}\nTime: ${timestamp}\n\nPlease reach out to the customer on WhatsApp.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px;">
                <h2 style="color: #e74c3c;">🔔 Human Agent Needed</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #666;">👤 Customer</td><td style="padding: 8px 0; font-weight: bold;">${customerName}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666;">📱 Phone</td><td style="padding: 8px 0; font-weight: bold;">${body.customerPhone}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666;">📝 Reason</td><td style="padding: 8px 0;">${reason}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666;">⏰ Time</td><td style="padding: 8px 0;">${timestamp}</td></tr>
                </table>
                <p style="margin-top: 20px; color: #e74c3c; font-weight: bold;">Please reach out to the customer on WhatsApp as soon as possible.</p>
              </div>
            `,
          });

          emailSent = true;
        } else {
          console.warn("[handoff] SMTP not configured. Skipping email notification.");
        }
      } catch (emailError) {
        console.error(
          "[handoff] Email notification failed (non-blocking):",
          emailError instanceof Error ? emailError.message : emailError
        );
      }
    }

    // ── Send confirmation to the customer ────────────────────
    await sendTextMessage(
      body.customerPhone,
      `Connecting you to a human agent now 👤\n\nOne of our team members will be with you shortly. You can also reach us at:\n\n📱 ${BUSINESS_CONFIG.contactPhone}\n📧 ${BUSINESS_CONFIG.contactEmail}\n\nThank you for your patience! 🙏`
    );

    return NextResponse.json(
      {
        success: true,
        notifications: {
          whatsapp: whatsappSent,
          email: emailSent,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[handoff] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
