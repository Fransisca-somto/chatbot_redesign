// ============================================================
// NOTIFICATIONS — EMAIL + WHATSAPP AGENT ALERTS
// ============================================================

import nodemailer from "nodemailer";
import { BUSINESS_CONFIG } from "@/config/business";
import { sendTextMessage } from "@/lib/whatsapp";
import { markBookingNotified } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────

export interface BookingNotification {
  phone: string;
  name: string;
  service: string;
  date: string;
  time: string;
  bookingId: string;
}

// ── Email Transport ──────────────────────────────────────────

function createEmailTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[notify] SMTP not configured. Skipping email notification.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// ── Send Booking Email ───────────────────────────────────────

async function sendBookingEmail(booking: BookingNotification): Promise<void> {
  const agentEmail =
    process.env.AGENT_EMAIL || BUSINESS_CONFIG.agentEmail;

  if (!agentEmail || agentEmail.includes("[OWNER")) {
    console.warn("[notify] Agent email not configured. Skipping email notification.");
    return;
  }

  const transport = createEmailTransport();
  if (!transport) return;

  const subject = `📅 New Booking — ${booking.name} | ${BUSINESS_CONFIG.name}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📅 New Booking Received</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${BUSINESS_CONFIG.name}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; color: #6c757d; width: 140px;">👤 Customer Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #212529;">${booking.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">📱 Phone Number</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #212529;">${booking.phone}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">💼 Service</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #212529;">${booking.service}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">📅 Preferred Date</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #212529;">${booking.date}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6c757d;">🕐 Preferred Time</td>
            <td style="padding: 12px 0; font-weight: bold; color: #212529;">${booking.time}</td>
          </tr>
        </table>
        
        <div style="margin-top: 24px; padding: 16px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
          <p style="margin: 0; color: #155724; font-size: 14px;">
            💡 This booking was made via WhatsApp. Please reach out to the customer to confirm.
          </p>
        </div>
        
        <p style="margin-top: 24px; color: #6c757d; font-size: 12px; text-align: center;">
          Booking ID: ${booking.bookingId} | ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;

  const text = `
New Booking — ${BUSINESS_CONFIG.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Customer: ${booking.name}
📱 Phone: ${booking.phone}
💼 Service: ${booking.service}
📅 Date: ${booking.date}
🕐 Time: ${booking.time}
🆔 Booking ID: ${booking.bookingId}

Please reach out to the customer to confirm.
  `.trim();

  await transport.sendMail({
    from: `"${BUSINESS_CONFIG.name}" <${process.env.SMTP_USER}>`,
    to: agentEmail,
    subject,
    text,
    html,
  });

  console.log(`[notify] Booking email sent to ${agentEmail}`);
}

// ── Send Agent WhatsApp Alert ────────────────────────────────

async function sendAgentWhatsAppAlert(
  booking: BookingNotification
): Promise<void> {
  const agentPhone = (
    process.env.AGENT_WHATSAPP ||
    BUSINESS_CONFIG.agentWhatsAppNumber
  ).replace(/[^0-9]/g, "");

  if (!agentPhone || agentPhone.includes("OWNER")) {
    console.warn(
      "[notify] Agent WhatsApp number not configured. Skipping WhatsApp notification."
    );
    return;
  }

  const message = `📅 *New Booking Alert!*

━━━━━━━━━━━━━━━━━
👤 *Customer:* ${booking.name}
📱 *Phone:* ${booking.phone}
💼 *Service:* ${booking.service}
📅 *Date:* ${booking.date}
🕐 *Time:* ${booking.time}
━━━━━━━━━━━━━━━━━

Please reach out to confirm the appointment.
🆔 Booking ID: ${booking.bookingId}`;

  await sendTextMessage(agentPhone, message);
  console.log(`[notify] Agent WhatsApp alert sent to ${agentPhone}`);
}

// ── Public API ───────────────────────────────────────────────

/**
 * Notify the agent of a new booking via both email and WhatsApp.
 * This function is fire-and-forget safe — errors are caught and logged.
 */
export async function notifyAgentOfBooking(
  booking: BookingNotification
): Promise<void> {
  const results = await Promise.allSettled([
    sendBookingEmail(booking),
    sendAgentWhatsAppAlert(booking),
  ]);

  // Log any failures
  results.forEach((result, index) => {
    const channel = index === 0 ? "email" : "WhatsApp";
    if (result.status === "rejected") {
      console.error(
        `[notify] Failed to send ${channel} notification:`,
        result.reason
      );
    }
  });

  // Mark booking as notified if at least one notification succeeded
  const anySuccess = results.some((r) => r.status === "fulfilled");
  if (anySuccess) {
    try {
      await markBookingNotified(booking.bookingId);
    } catch (error) {
      console.error("[notify] Failed to mark booking as notified:", error);
    }
  }
}
