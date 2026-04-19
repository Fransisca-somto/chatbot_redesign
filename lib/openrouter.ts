// ============================================================
// OPENROUTER AI — CLAUDE PRIMARY + GEMINI FALLBACK
// ============================================================

import { buildSystemPrompt } from "@/prompts/system";

// ── Types ────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  model: string;
  error?: {
    message: string;
    code: number;
  };
}

// ── Configuration (all configurable from .env.local) ─────────

const PRIMARY_MODEL = process.env.AI_PRIMARY_MODEL || "anthropic/claude-3-haiku";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "google/gemini-flash-1.5";
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || "500", 10);
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || "0.7");
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "8000", 10);
const OPENROUTER_URL = process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions";

// ── Helper: call OpenRouter with a specific model ────────────

async function callOpenRouter(
  model: string,
  messages: Message[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL || "https://paradox-store.vercel.app",
        "X-Title": "Paradox Store WhatsApp Bot",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check for rate limiting or server errors that should trigger fallback
    if (response.status === 429 || response.status === 503 || response.status >= 500) {
      throw new Error(
        `OpenRouter returned ${response.status} for model ${model}`
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter error ${response.status}: ${errorBody}`
      );
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (data.error) {
      throw new Error(
        `OpenRouter API error: ${data.error.message} (code: ${data.error.code})`
      );
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("OpenRouter returned no choices.");
    }

    console.log(`[openrouter] Response generated using model: ${model}`);
    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${model} timed out after ${TIMEOUT_MS}ms`);
    }

    throw error;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate an AI reply using Claude (primary) with automatic Gemini fallback.
 *
 * @param userMessage - The latest message from the user
 * @param conversationHistory - Last N messages for context
 * @param senderPhone - The sender's phone number (for logging)
 * @returns The AI-generated reply text
 */
export async function generateAIReply(
  userMessage: string,
  conversationHistory: Message[],
  senderPhone: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt();

  // Build the messages array: system prompt + conversation history + latest user message
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Try primary model (Claude Haiku) first
  try {
    console.log(
      `[openrouter] Trying primary model (${PRIMARY_MODEL}) for ${senderPhone}`
    );
    const reply = await callOpenRouter(PRIMARY_MODEL, messages);
    return reply;
  } catch (primaryError) {
    console.warn(
      `[openrouter] Primary model failed for ${senderPhone}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
  }

  // Fallback to Gemini
  try {
    console.log(
      `[openrouter] Falling back to ${FALLBACK_MODEL} for ${senderPhone}`
    );
    const reply = await callOpenRouter(FALLBACK_MODEL, messages);
    return reply;
  } catch (fallbackError) {
    console.error(
      `[openrouter] Fallback model also failed for ${senderPhone}:`,
      fallbackError instanceof Error ? fallbackError.message : fallbackError
    );
    return "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment, or type *4* to speak to a human agent. 🙏";
  }
}
