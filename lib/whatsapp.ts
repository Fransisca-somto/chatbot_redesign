// ============================================================
// WHATSAPP BUSINESS API — SEND MESSAGES VIA META GRAPH API
// ============================================================

const GRAPH_API_VERSION = "v18.0";

// ── Types ────────────────────────────────────────────────────

interface WhatsAppTextMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

interface WhatsAppImageMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "image";
  image: { link: string; caption?: string };
}

interface InteractiveButton {
  type: "reply";
  reply: { id: string; title: string };
}

interface WhatsAppInteractiveMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    body: { text: string };
    action: { buttons: InteractiveButton[] };
  };
}

type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppInteractiveMessage;

interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

// ── Helper: get API URL ──────────────────────────────────────

function getApiUrl(): string {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) {
    throw new Error("Missing WHATSAPP_PHONE_ID environment variable.");
  }
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
}

function getToken(): string {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new Error("Missing WHATSAPP_TOKEN environment variable.");
  }
  return token;
}

// ── Core send function ───────────────────────────────────────

async function sendToWhatsApp(
  payload: WhatsAppMessage
): Promise<WhatsAppApiResponse | null> {
  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[whatsapp] API error ${response.status}: ${errorBody}`
      );
      return null;
    }

    const data = (await response.json()) as WhatsAppApiResponse;
    console.log(`[whatsapp] Message sent to ${payload.to}`);
    return data;
  } catch (error) {
    console.error(
      "[whatsapp] Failed to send message:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Send a plain text message to a WhatsApp number.
 */
export async function sendTextMessage(
  to: string,
  body: string
): Promise<WhatsAppApiResponse | null> {
  return sendToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

/**
 * Send an image with an optional caption to a WhatsApp number.
 */
export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<WhatsAppApiResponse | null> {
  return sendToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption },
  });
}

/**
 * Send an interactive button message (up to 3 buttons).
 */
export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
): Promise<WhatsAppApiResponse | null> {
  if (buttons.length > 3) {
    console.warn(
      "[whatsapp] WhatsApp only supports up to 3 interactive buttons. Truncating."
    );
    buttons = buttons.slice(0, 3);
  }

  return sendToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply" as const,
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  });
}

/**
 * Mark a message as read (sends read receipt).
 */
export async function markAsRead(messageId: string): Promise<void> {
  try {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    );
  } catch (error) {
    console.error(
      "[whatsapp] Failed to mark message as read:",
      error instanceof Error ? error.message : error
    );
  }
}
