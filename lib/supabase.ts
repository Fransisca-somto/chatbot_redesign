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
  sender?: "user" | "ai" | "admin";
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
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

export const supabase = getSupabaseClient();

// ── Conversation Helpers ─────────────────────────────────────

/**
 * Save a message (user or assistant) to the conversations table.
 */
export async function saveMessage(
  phone: string,
  role: "user" | "assistant",
  content: string,
  sender: "user" | "ai" | "admin",
  modelUsed?: string
): Promise<void> {
  const { error } = await supabase.from("conversations").insert({
    phone,
    role,
    content,
    sender,
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

// ── Agent Mode Helpers ───────────────────────────────────────

/**
 * Get the current agent mode (AI or human) for a phone number.
 */
export async function getAgentMode(phone: string): Promise<"ai" | "human"> {
  const { data, error } = await supabase
    .from("agent_mode")
    .select("mode")
    .eq("phone_number", phone)
    .single();

  if (error || !data) {
    return "ai"; // Default to AI if no record exists
  }

  return data.mode as "ai" | "human";
}

/**
 * Set the agent mode for a phone number.
 */
export async function setAgentMode(phone: string, mode: "ai" | "human", profileName?: string): Promise<void> {
  const payload: any = { phone_number: phone, mode, updated_at: new Date().toISOString() };
  if (profileName) payload.profile_name = profileName;

  const { error } = await supabase
    .from("agent_mode")
    .upsert(payload, { onConflict: "phone_number" });

  if (error) {
    console.error("[supabase] Failed to set agent mode:", error.message);
    throw new Error(`Failed to set agent mode: ${error.message}`);
  }
}

/**
 * Update only the profile name for a user without touching the agent mode.
 */
export async function updateProfileName(phone: string, profileName: string): Promise<void> {
  const { error } = await supabase
    .from("agent_mode")
    .upsert(
      { phone_number: phone, profile_name: profileName, updated_at: new Date().toISOString() },
      { onConflict: "phone_number" }
    );

  if (error) {
    console.error("[supabase] Failed to update profile name:", error.message);
  }
}

// ── Admin Dashboard Helpers ──────────────────────────────────

export interface AdminConversationPreview {
  phone_number: string;
  last_message: string;
  updated_at: string;
  mode: "ai" | "human";
  profile_name?: string;
  last_sender?: "user" | "ai" | "admin";
}

/**
 * Get a list of all unique conversations with their latest message and mode.
 */
export async function getAllConversations(): Promise<AdminConversationPreview[]> {
  // This is a bit complex without a view, but we can do a grouped query or fetch distinct.
  // A simple approach for a smaller scale app is to fetch the latest message per phone.
  
  // 1. Get all unique phones and their modes
  const { data: modes, error: modesError } = await supabase
    .from("agent_mode")
    .select("*");
    
  // 2. We'll use a raw SQL-like approach if we had one, but with Supabase client we can do:
  const { data: messages, error: messagesError } = await supabase
    .from("conversations")
    .select("phone, content, created_at, role, sender")
    .order("created_at", { ascending: false });

  if (messagesError) {
    console.error("[supabase] Failed to load conversations:", messagesError.message);
    return [];
  }

  // 3. Get names from bookings to use as identity if they have booked
  const { data: bookings } = await supabase
    .from("bookings")
    .select("phone, name")
    .order("created_at", { ascending: false });

  const modeMap = new Map();
  for (const m of modes || []) {
    modeMap.set(m.phone_number, { mode: m.mode, profile_name: m.profile_name });
  }
  
  const bookingMap = new Map();
  for (const b of bookings || []) {
    if (!bookingMap.has(b.phone)) {
      bookingMap.set(b.phone, b.name);
    }
  }
  
  // Deduplicate to get only the latest message per phone
  const previews: AdminConversationPreview[] = [];
  const seenPhones = new Set<string>();

  for (const msg of messages || []) {
    if (!seenPhones.has(msg.phone)) {
      seenPhones.add(msg.phone);
      const agentData = modeMap.get(msg.phone) || { mode: "ai", profile_name: "" };
      const bookedName = bookingMap.get(msg.phone);
      
      previews.push({
        phone_number: msg.phone,
        last_message: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
        updated_at: msg.created_at,
        mode: agentData.mode,
        profile_name: bookedName || agentData.profile_name, // Booked name takes priority
        last_sender: msg.sender || (msg.role === 'assistant' ? 'ai' : 'user'),
      });
    }
  }

  return previews;
}

/**
 * Get full conversation history and mode for a specific phone number.
 */
export async function getConversationByPhone(phone: string): Promise<{ messages: ConversationRow[], mode: "ai" | "human" }> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: true });

  const mode = await getAgentMode(phone);

  if (error) {
    console.error("[supabase] Failed to load conversation:", error.message);
    return { messages: [], mode };
  }

  return { messages: data || [], mode };
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
