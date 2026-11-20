import { json, requireRole } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const body = await request.json();
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const fileName = String(body.fileName || "video").slice(0, 180);
    const fileSize = Number(body.fileSize || 0);
    if (!contentType.startsWith("video/")) return json({ error: "Only video uploads are accepted." }, 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 5 * 1024 * 1024 * 1024) {
      return json({ error: "File must be between 1 byte and 5 GB. Larger files need multipart upload." }, 400);
    }
    const safeName = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "video";
    const key = user.id + "/" + crypto.randomUUID() + "-" + safeName;
    const provider = String(body.provider || "cloudflare_r2").toLowerCase();
    if (provider === "backblaze_b2") {
      const signed = await presignB2(env, "PUT", key, contentType, 900);
      return json({ provider, key, uploadUrl: signed.url, headers: signed.headers, expiresIn: 900 });
    }
    if (provider !== "cloudflare_r2") return json({ error: "Unsupported upload provider." }, 400);
    const signed = await presignR2(env, "PUT", key, contentType, 900);
    return json({ provider, key, uploadUrl: signed.url, headers: signed.headers, expiresIn: 900 });
  } catch (error) {
    const message = error.message || "Could not create secure upload URL.";
    const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503;
    return json({ error: message }, status);
  }
}