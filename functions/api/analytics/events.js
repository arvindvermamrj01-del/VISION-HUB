import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

const retentionMs = 24 * 60 * 60 * 1000;

function activityUrl(env, filter = {}) {
  const url = new URL(supabaseBase(env) + "/rest/v1/vh_analytics_events");
  url.search = new URLSearchParams({ ...filter }).toString();
  return url;
}

async function pruneExpired(env) {
  const url = activityUrl(env, {
    created_at: "lt." + new Date(Date.now() - retentionMs).toISOString()
  });
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...supabaseAdminHeaders(env),
      Prefer: "return=minimal"
    }
  });
  if (!response.ok) throw new Error("Expired analytics events could not be pruned (" + response.status + ").");
}

async function countRecent(env) {
  const url = activityUrl(env, { select: "id" });
  const response = await fetch(url, {
    method: "HEAD",
    headers: {
      ...supabaseAdminHeaders(env),
      Prefer: "count=exact"
    }
  });
  if (!response.ok) throw new Error("Analytics event count could not be loaded.");
  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function onRequestGet({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    await pruneExpired(env);
    const total = await countRecent(env);
    return json({ total, retentionHours: 24, refreshedAt: new Date().toISOString() }, 200, {
      "cache-control": "no-store"
    });
  } catch (error) {
    const status = error.status || (/Authentication|required/i.test(error.message || "") ? 401 : 403);
    return json({ error: error.message || "Analytics activity could not be refreshed." }, status);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    const body = await request.json().catch(() => null);
    if (!body || body.action !== "reset") return json({ error: "Unsupported analytics action." }, 400);
    const url = activityUrl(env, { id: "not.is.null" });
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...supabaseAdminHeaders(env),
        Prefer: "return=minimal"
      }
    });
    if (!response.ok) return json({ error: "Tracked analytics could not be reset." }, 502);
    return json({ cleared: true, total: 0, retentionHours: 24 }, 200, {
      "cache-control": "no-store"
    });
  } catch (error) {
    const status = error.status || (/Authentication|required/i.test(error.message || "") ? 401 : 403);
    return json({ error: error.message || "Analytics activity could not be reset." }, status);
  }
}
