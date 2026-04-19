// ============================================================
// COMMAND PARSER + BOOKING FLOW
// ============================================================

import { BUSINESS_CONFIG } from "@/config/business";
import {
  getActiveBookingSession,
  createBookingSession,
  updateBookingSession,
  completeBooking,
  BookingSessionRow,
} from "@/lib/supabase";
import { sendTextMessage, sendImageMessage } from "@/lib/whatsapp";
import { notifyAgentOfBooking } from "@/lib/notify";

// ── Types ────────────────────────────────────────────────────

export type CommandType = "menu" | "book" | "faq" | "agent" | null;

// ── Command Detection ────────────────────────────────────────

/**
 * Detect which command the user's message matches.
 * Returns null if no command matches (message should go to AI).
 */
export function detectCommand(messageText: string): CommandType {
  const normalized = messageText.trim().toLowerCase();

  // Check "1" separately for menu (services & prices)
  if (normalized === "1") {
    return "menu";
  }

  const { commands } = BUSINESS_CONFIG;

  for (const cmd of commands.agent) {
    if (normalized === cmd.toLowerCase()) return "agent";
  }

  for (const cmd of commands.book) {
    if (normalized === cmd.toLowerCase()) return "book";
  }

  for (const cmd of commands.faq) {
    if (normalized === cmd.toLowerCase()) return "faq";
  }

  for (const cmd of commands.menu) {
    if (normalized === cmd.toLowerCase()) return "menu";
  }

  return null;
}

// ── Command Handlers ─────────────────────────────────────────

/**
 * Handle the /menu command: send welcome banner + welcome message.
 */
export async function handleMenuCommand(phone: string): Promise<string> {
  // Send the welcome banner image first
  await sendImageMessage(
    phone,
    BUSINESS_CONFIG.mediaImages.welcomeBanner,
    BUSINESS_CONFIG.name
  );

  // Build services list
  const servicesList = BUSINESS_CONFIG.services
    .map(
      (s) =>
        `*${s.id}.* ${s.name} — ${BUSINESS_CONFIG.currency} ${s.price.toLocaleString()}\n   _${s.description}_`
    )
    .join("\n\n");

  const menuText = `${BUSINESS_CONFIG.welcomeMessage}\n\n━━━━━━━━━━━━━━━━━\n📋 *Our Services & Prices:*\n\n${servicesList}\n\n━━━━━━━━━━━━━━━━━\n📍 ${BUSINESS_CONFIG.location}\n🕐 ${BUSINESS_CONFIG.operatingHours}`;

  return menuText;
}

/**
 * Handle the /faq command: send FAQ list.
 */
export async function handleFaqCommand(): Promise<string> {
  const faqList = BUSINESS_CONFIG.faqs
    .map((faq, i) => `*${i + 1}. ${faq.question}*\n${faq.answer}`)
    .join("\n\n");

  return `📖 *Frequently Asked Questions*\n\n${faqList}\n\n━━━━━━━━━━━━━━━━━\nStill have questions? Type *4* to speak with a human agent. 👤`;
}

/**
 * Handle the /agent command: notify agent and inform user.
 */
export async function handleAgentCommand(phone: string): Promise<string> {
  // Send alert to agent's WhatsApp
  const agentPhone = BUSINESS_CONFIG.agentWhatsAppNumber.replace(/[^0-9]/g, "");
  if (agentPhone) {
    await sendTextMessage(
      agentPhone,
      `🔔 *Agent Alert*\n\nA customer needs assistance!\n📱 Phone: ${phone}\n⏰ Time: ${new Date().toLocaleString()}\n\nPlease reach out to them on WhatsApp.`
    );
  }

  return `Connecting you to a human agent now 👤\n\nOne of our team members will be with you shortly. You can also reach us at:\n\n📱 ${BUSINESS_CONFIG.contactPhone}\n📧 ${BUSINESS_CONFIG.contactEmail}\n\nThank you for your patience! 🙏`;
}

// ── Booking Flow ─────────────────────────────────────────────

/**
 * Check if the user has an active booking session and process their input.
 * Returns a response string if in a booking flow, or null if not.
 */
export async function handleBookingFlow(
  phone: string,
  messageText: string
): Promise<string | null> {
  const session = await getActiveBookingSession(phone);
  if (!session) return null;

  return processBookingStep(session, messageText, phone);
}

/**
 * Start a new booking session.
 */
export async function startBookingFlow(phone: string): Promise<string> {
  await createBookingSession(phone);
  return `📝 *Let's book an appointment!*\n\nI'll need a few details from you.\n\n*Step 1/5:* What is your full name?`;
}

/**
 * Process the current booking step based on user input.
 */
async function processBookingStep(
  session: BookingSessionRow,
  userInput: string,
  phone: string
): Promise<string> {
  const input = userInput.trim();

  switch (session.step) {
    // ── Step 1: Collect name ──────────────────────────────────
    case 1: {
      if (input.length < 2) {
        return "Please enter your full name (at least 2 characters).";
      }

      await updateBookingSession(session.id!, {
        name: input,
        step: 2,
      });

      const servicesList = BUSINESS_CONFIG.services
        .map(
          (s) =>
            `*${s.id}.* ${s.name} — ${BUSINESS_CONFIG.currency} ${s.price.toLocaleString()}`
        )
        .join("\n");

      return `Thanks, *${input}*! 😊\n\n*Step 2/5:* Which service would you like?\n\n${servicesList}\n\nReply with the *number* of your choice.`;
    }

    // ── Step 2: Collect service ───────────────────────────────
    case 2: {
      const serviceNumber = parseInt(input, 10);
      const service = BUSINESS_CONFIG.services.find(
        (s) => s.id === serviceNumber
      );

      if (!service) {
        const validIds = BUSINESS_CONFIG.services.map((s) => s.id).join(", ");
        return `Please reply with a valid service number (${validIds}).`;
      }

      await updateBookingSession(session.id!, {
        service: service.name,
        step: 3,
      });

      return `Great choice! *${service.name}* — ${BUSINESS_CONFIG.currency} ${service.price.toLocaleString()} ✅\n\n*Step 3/5:* What is your preferred *date*?\n\nPlease use the format: DD/MM/YYYY (e.g., 25/04/2025)`;
    }

    // ── Step 3: Collect date ──────────────────────────────────
    case 3: {
      // Validate date format and ensure it's in the future
      const dateValid = validateFutureDate(input);
      if (!dateValid.valid) {
        return dateValid.message;
      }

      await updateBookingSession(session.id!, {
        preferred_date: input,
        step: 4,
      });

      return `📅 Date set: *${input}*\n\n*Step 4/5:* What time works best for you?\n\nOur hours: ${BUSINESS_CONFIG.operatingHours}\n\nPlease reply with a time (e.g., 10:00 AM, 2:30 PM)`;
    }

    // ── Step 4: Collect time ──────────────────────────────────
    case 4: {
      if (input.length < 3) {
        return "Please enter a valid time (e.g., 10:00 AM, 2:30 PM).";
      }

      await updateBookingSession(session.id!, {
        preferred_time: input,
        step: 5,
      });

      // Show confirmation summary
      const updatedSession: BookingSessionRow = {
        ...session,
        preferred_time: input,
      };

      return `🔍 *Please confirm your booking:*\n\n👤 Name: *${session.name}*\n💼 Service: *${session.service}*\n📅 Date: *${session.preferred_date}*\n🕐 Time: *${updatedSession.preferred_time}*\n\n*Step 5/5:* Reply *YES* to confirm or *NO* to cancel.`;
    }

    // ── Step 5: Confirm booking ───────────────────────────────
    case 5: {
      const answer = input.toLowerCase();

      if (answer === "yes" || answer === "y" || answer === "confirm") {
        // Complete the booking
        const booking = await completeBooking(session);

        // Send booking confirmation image
        await sendImageMessage(
          phone,
          BUSINESS_CONFIG.mediaImages.bookingConfirm,
          "Booking Confirmed! ✅"
        );

        // Notify agent via email + WhatsApp
        try {
          await notifyAgentOfBooking({
            phone,
            name: session.name!,
            service: session.service!,
            date: session.preferred_date!,
            time: session.preferred_time || input,
            bookingId: booking.id!,
          });
        } catch (notifyError) {
          console.error("[booking] Failed to notify agent:", notifyError);
        }

        let confirmMessage = `✅ *Booking Confirmed!*\n\n👤 Name: *${session.name}*\n💼 Service: *${session.service}*\n📅 Date: *${session.preferred_date}*\n🕐 Time: *${session.preferred_time || input}*`;

        if (
          BUSINESS_CONFIG.bookingLink &&
          !BUSINESS_CONFIG.bookingLink.includes("[OWNER")
        ) {
          confirmMessage += `\n\n🔗 Complete your booking here:\n${BUSINESS_CONFIG.bookingLink}`;
        }

        confirmMessage +=
          "\n\nWe'll send you a reminder before your appointment. Thank you for choosing *" +
          BUSINESS_CONFIG.name +
          "*! 🎉";

        return confirmMessage;
      } else if (answer === "no" || answer === "n" || answer === "cancel") {
        await updateBookingSession(session.id!, { status: "cancelled" });
        return "❌ Booking cancelled. No worries!\n\nType *2* if you'd like to start over, or *4* to speak with an agent.";
      } else {
        return 'Please reply *YES* to confirm or *NO* to cancel your booking.';
      }
    }

    default:
      return "Something went wrong with your booking. Let's start over — type *2* to restart.";
  }
}

// ── Date Validation Helper ───────────────────────────────────

function validateFutureDate(input: string): {
  valid: boolean;
  message: string;
} {
  // Try DD/MM/YYYY format
  const dateRegex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
  const match = input.match(dateRegex);

  if (!match) {
    return {
      valid: false,
      message:
        "Please use the format DD/MM/YYYY (e.g., 25/04/2025).",
    };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Basic validation
  if (month < 1 || month > 12) {
    return { valid: false, message: "Invalid month. Please check your date." };
  }

  if (day < 1 || day > 31) {
    return { valid: false, message: "Invalid day. Please check your date." };
  }

  // Check if the date is in the future
  const inputDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate < today) {
    return {
      valid: false,
      message:
        "That date is in the past! Please choose a future date. 📅",
    };
  }

  return { valid: true, message: "" };
}
