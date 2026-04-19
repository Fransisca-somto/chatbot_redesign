// ============================================================
// SUPABASE CLIENT + ALL DB HELPER FUNCTIONS
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────

export interface ConversationRow {
  id?: string;
  phone: string;
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  created_at?: string;
}

export interface ProcessedMessageRow {
  id?: string;
  message_id: string;
  created_at?: string;
}

export interface BookingSessionRow {
  id?: string;
  phone: string;
  step: number;
  name?: string;
  service?: string;
  preferred_date?: string;
  preferred_time?: string;
  status: "in_progress" | "completed" | "cancelled";
  created_at?: string;
}

export interface BookingRow {
  id?: string;
  phone: string;
  name: string;
  service: string;
  preferred_date: string;
  preferred_time: string;
  confirmed_at?: string;
  notified: boolean;
}

// ── Supabase Client (server-side only) ───────────────────────

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const supabase = getSupabaseClient();

// ── Conversation Helpers ─────────────────────────────────────

/**
 * Save a message (user or assistant) to the conversations table.
 */
export async function saveMessage(
  phone: string,
  role: "user" | "assistant",
  content: string,
  modelUsed?: string
): Promise<void> {
  const { error } = await supabase.from("conversations").insert({
    phone,
    role,
    content,
    model_used: modelUsed || null,
  });

  if (error) {
    console.error("[supabase] Failed to save message:", error.message);
    throw new Error(`Failed to save message: ${error.message}`);
  }
}

/**
 * Load the last N messages for a given phone number for AI context.
 */
export async function getConversationHistory(
  phone: string,
  limit: number = 10
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[supabase] Failed to load conversation history:", error.message);
    return [];
  }

  // Reverse so oldest messages come first (chronological order)
  return (data || []).reverse();
}

// ── Deduplication Helpers ────────────────────────────────────

/**
 * Check if a message ID has already been processed.
 */
export async function isMessageProcessed(messageId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("processed_messages")
    .select("id")
    .eq("message_id", messageId)
    .limit(1);

  if (error) {
    console.error("[supabase] Failed to check message dedup:", error.message);
    // Err on the side of processing the message
    return false;
  }

  return (data && data.length > 0) || false;
}

/**
 * Mark a message ID as processed.
 */
export async function markMessageProcessed(messageId: string): Promise<void> {
  const { error } = await supabase.from("processed_messages").insert({
    message_id: messageId,
  });

  if (error) {
    // Unique constraint violation means it was already processed — that's fine
    if (error.code === "23505") {
      return;
    }
    console.error("[supabase] Failed to mark message processed:", error.message);
  }
}

// ── Booking Session Helpers ──────────────────────────────────

/**
 * Get the active booking session for a phone number.
 */
export async function getActiveBookingSession(
  phone: string
): Promise<BookingSessionRow | null> {
  const { data, error } = await supabase
    .from("booking_sessions")
    .select("*")
    .eq("phone", phone)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[supabase] Failed to get booking session:", error.message);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Create a new booking session for a phone number.
 */
export async function createBookingSession(
  phone: string
): Promise<BookingSessionRow> {
  // Cancel any existing in-progress sessions first
  await supabase
    .from("booking_sessions")
    .update({ status: "cancelled" })
    .eq("phone", phone)
    .eq("status", "in_progress");

  const { data, error } = await supabase
    .from("booking_sessions")
    .insert({
      phone,
      step: 1,
      status: "in_progress",
    })
    .select()
    .single();

  if (error) {
    console.error("[supabase] Failed to create booking session:", error.message);
    throw new Error(`Failed to create booking session: ${error.message}`);
  }

  return data;
}

/**
 * Update a booking session with new data and advance the step.
 */
export async function updateBookingSession(
  sessionId: string,
  updates: Partial<BookingSessionRow>
): Promise<void> {
  const { error } = await supabase
    .from("booking_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) {
    console.error("[supabase] Failed to update booking session:", error.message);
    throw new Error(`Failed to update booking session: ${error.message}`);
  }
}

/**
 * Complete a booking session and save a confirmed booking.
 */
export async function completeBooking(
  session: BookingSessionRow
): Promise<BookingRow> {
  // Mark session as completed
  await supabase
    .from("booking_sessions")
    .update({ status: "completed" })
    .eq("id", session.id);

  // Insert into bookings table
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      phone: session.phone,
      name: session.name!,
      service: session.service!,
      preferred_date: session.preferred_date!,
      preferred_time: session.preferred_time!,
      notified: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[supabase] Failed to save confirmed booking:", error.message);
    throw new Error(`Failed to save confirmed booking: ${error.message}`);
  }

  return data;
}

/**
 * Mark a booking as notified (agent has been alerted).
 */
export async function markBookingNotified(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ notified: true })
    .eq("id", bookingId);

  if (error) {
    console.error("[supabase] Failed to mark booking notified:", error.message);
  }
}
