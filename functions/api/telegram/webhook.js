const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram API request failed");
  return result;
}

async function supabase(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return response;
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Telegram webhook is not configured" }, 503);
  }
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const update = await request.json();
    const message = update.message;
    const chat = message?.chat;
    if (!chat?.id || chat.type !== "private") return json({ ok: true });
    const text = String(message.text || "").trim();
    const chatId = String(chat.id);
    const username = chat.username ? String(chat.username).slice(0, 64) : null;
    const firstName = chat.first_name ? String(chat.first_name).slice(0, 100) : null;

    if (/^\/stop(?:@\w+)?$/i.test(text)) {
      await supabase(env, `telegram_subscribers?chat_id=eq.${encodeURIComponent(chatId)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: false, updated_at: new Date().toISOString() })
      });
      await telegram(env, "sendMessage", { chat_id: chat.id, text: "You have been unsubscribed from Vision Hub updates. Send /start to subscribe again." });
      return json({ ok: true });
    }

    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      await supabase(env, "telegram_subscribers?on_conflict=chat_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ chat_id: chatId, username, first_name: firstName, active: true, updated_at: new Date().toISOString() })
      });
      await telegram(env, "sendMessage", {
        chat_id: chat.id,
        text: "Welcome to Vision Hub updates! You are subscribed. We will send new-content announcements here. Send /stop anytime to unsubscribe."
      });
    } else if (/^\/help(?:@\w+)?$/i.test(text)) {
      await telegram(env, "sendMessage", { chat_id: chat.id, text: "Vision Hub Bot\n/start — subscribe to updates\n/stop — unsubscribe\n/help — show help" });
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
}

export async function onRequestGet() {
  return json({ service: "Vision Hub Telegram webhook", status: "ready for Telegram POST updates" });
}
