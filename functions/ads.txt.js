/* Public AdSense sellers declaration, sourced from the admin-managed publisher ID. */
export async function onRequestGet({ env }) {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !key) {
    return new Response("AdSense publisher is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  try {
    const url = new URL(base + "/rest/v1/vh_site_settings");
    url.search = new URLSearchParams({
      select: "setting_value",
      setting_key: "eq.adsense_publisher_id",
      limit: "1"
    }).toString();
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key }
    });
    if (!response.ok) throw new Error("Settings lookup failed");
    const rows = await response.json();
    const raw = String(rows?.[0]?.setting_value || "").trim();
    const publisher = raw.startsWith("ca-pub-") ? raw.slice(3) : raw;
    if (!/^pub-\d{10,20}$/.test(publisher)) {
      return new Response("AdSense publisher is not configured.\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return new Response("google.com, " + publisher + ", DIRECT, f08c47fec0942fa0\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" }
    });
  } catch (_) {
    return new Response("AdSense publisher is temporarily unavailable.\n", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
