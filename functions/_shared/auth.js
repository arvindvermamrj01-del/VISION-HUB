const clean = value => String(value || "").replace(/\/+$/, "");

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

export async function requireUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("Authentication required.");
  const base = clean(env.SUPABASE_URL);
  if (!base || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or publishable key is not configured on the server.");
  }
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) throw new Error("Your session is invalid or expired.");
  const user = await response.json();
  if (!user?.id) throw new Error("Authenticated user could not be verified.");

  // The user's JWT can read their own profiles row under the existing profiles RLS policy.
  // Do not require a service-role key just to validate an authenticated staff member.
  const profileUrl = new URL(base + "/rest/v1/profiles");
  profileUrl.search = new URLSearchParams({
    id: "eq." + user.id,
    select: "id,fullname,role"
  }).toString();
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!profileResponse.ok) throw new Error("Could not verify your Vision Hub role. Check profile read permissions.");
  const rows = await profileResponse.json();
  return { user, profile: rows[0] || null, token };
}

export async function requireRole(request, env, roles) {
  const identity = await requireUser(request, env);
  if (!identity.profile || !roles.includes(identity.profile.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return identity;
}

export function supabaseAdminHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "content-type": "application/json"
  };
}

export function supabaseBase(env) {
  return clean(env.SUPABASE_URL);
}
