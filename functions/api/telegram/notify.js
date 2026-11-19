const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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
  if (!env.TELEGRAM_BOT_TOKEN || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
    return json({ error: "Telegram notifications are not configured" }, 503);
  }
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Authentication required" }, 401);

  try {
    const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }
    });
    if (!authResponse.ok) return json({ error: "Invalid session" }, 401);
    const user = await authResponse.json();
    const roleResponse = await supabase(env, `profiles?id=eq.${encodeURIComponent(user.id)}&select=role`);
    const roles = await roleResponse.json();
    if (roles?.[0]?.role !== "admin") return json({ error: "Admin permission required" }, 403);

    const body = await request.json();
    const title = String(body.title || "").trim().slice(0, 180);
    const type = String(body.type || "Content").trim().slice(0, 40);
    const link = String(body.url || "").trim();
    if (!title) return json({ error: "A title is required" }, 400);
    let safeLink = "";
    if (link) {
      const parsed = new URL(link);
      if (parsed.protocol !== "https:") return json({ error: "Only HTTPS links are allowed" }, 400);
      safeLink = parsed.href;
    }
    const subscribersResponse = await supabase(env, "telegram_subscribers?active=eq.true&select=chat_id");
    const subscribers = await subscribersResponse.json();
    const text = `🎬 Vision Hub — New ${type}\n\n${title}${safeLink ? `\n\nOpen: ${safeLink}` : ""}`;
    let sent = 0, failed = 0;
    for (const subscriber of subscribers || []) {
      try {
        const result = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: subscriber.chat_id, text, disable_web_page_preview: false })
        });
        if (result.ok) sent++; else failed++;
      } catch (_) { failed++; }
    }
    return json({ ok: true, sent, failed });
  } catch (error) {
    console.error("Telegram notification error:", error);
    return json({ error: "Could not send Telegram notifications" }, 500);
  }
}
