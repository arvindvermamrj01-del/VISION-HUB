import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";

const encodePath = value => String(value).split("/").map(encodeURIComponent).join("/");

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const body = await request.json();
    const provider = String(body.provider || "");
    const key = String(body.storagePath || "");
    if (!key || key.includes("..") || key.startsWith("/")) return json({ error: "Invalid storage path." }, 400);
    if (provider === "cloudflare_r2") {
      if (!key.startsWith(user.id + "/")) return json({ error: "You can only clean up files uploaded by your account." }, 403);
      const signed = await presignR2(env, "DELETE", key, "", 300);
      const result = await fetch(signed.url, { method: "DELETE" });
      if (!result.ok && result.status !== 404) return json({ error: "R2 object cleanup failed." }, 502);
      return json({ success: true });
    }
    if (provider === "supabase") {
      const response = await fetch(supabaseBase(env) + "/storage/v1/object/vh-private-media/" + encodePath(key), {
        method: "DELETE",
        headers: supabaseAdminHeaders(env)
      });
      if (!response.ok && response.status !== 404) return json({ error: "Private storage cleanup failed." }, 502);
      return json({ success: true });
    }
    return json({ error: "Unsupported storage provider." }, 400);
  } catch (error) {
    return json({ error: error.message || "Storage cleanup failed." }, 403);
  }
}