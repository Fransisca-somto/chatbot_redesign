// ============================================================
// MEMORY — LOAD CONVERSATION HISTORY FOR AI CONTEXT
// ============================================================

import { getConversationHistory, ConversationRow } from "@/lib/supabase";
import { Message } from "@/lib/openrouter";

/**
 * Load the last N messages from the conversation history
 * and format them for the OpenRouter API.
 *
 * @param phone - The user's phone number
 * @param limit - Maximum number of messages to load (default: 10)
 * @returns Formatted message array for the AI model
 */
export async function loadConversationMemory(
  phone: string,
  limit: number = 10
): Promise<Message[]> {
  try {
    const history: ConversationRow[] = await getConversationHistory(
      phone,
      limit
    );

    // Convert DB rows to OpenRouter message format
    const messages: Message[] = history.map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

    console.log(
      `[memory] Loaded ${messages.length} messages for ${phone}`
    );
    return messages;
  } catch (error) {
    console.error(
      "[memory] Failed to load conversation history:",
      error instanceof Error ? error.message : error
    );
    // Return empty array — AI can still respond without history
    return [];
  }
}
