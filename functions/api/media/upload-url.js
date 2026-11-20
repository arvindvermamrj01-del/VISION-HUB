import { json, requireRole } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const body = await request.json();
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const kind = body.kind === "audio" ? "audio" : "video";
    const fileName = String(body.fileName || kind).slice(0, 180);
    const fileSize = Number(body.fileSize || 0);
    const allowedAudioTypes = ["audio/mpeg","audio/mp4","audio/aac","audio/ogg","audio/wav","audio/x-wav","audio/flac","audio/x-flac","audio/webm","audio/opus"];
    const validType = kind === "audio" ? allowedAudioTypes.includes(contentType) : contentType.startsWith("video/");
    const maxSize = kind === "audio" ? 1024 * 1024 * 1024 : 5 * 1024 * 1024 * 1024;
    if (!validType) return json({ error: kind === "audio" ? "Only audio uploads are accepted for this request." : "Only video uploads are accepted." }, 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxSize) {
      return json({ error: kind === "audio" ? "Audio file must be between 1 byte and 1 GB." : "Video file must be between 1 byte and 5 GB. Larger files need multipart upload." }, 400);
    }
    const safeName = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^-+|-+$/g, "").slice(-100) || kind;
    const key = user.id + "/" + (kind === "audio" ? "audio/" : "") + crypto.randomUUID() + "-" + safeName;
    const provider = String(body.provider || "backblaze_b2").toLowerCase();
    const uploadExpiry = kind === "audio" ? 3600 : 900;
    if (provider === "backblaze_b2") {
      const signed = await presignB2(env, "PUT", key, contentType, uploadExpiry);
      return json({ provider, key, kind, uploadUrl: signed.url, headers: signed.headers, expiresIn: uploadExpiry });
    }
    if (provider !== "cloudflare_r2") return json({ error: "Unsupported upload provider." }, 400);
    const signed = await presignR2(env, "PUT", key, contentType, uploadExpiry);
    return json({ provider, key, kind, uploadUrl: signed.url, headers: signed.headers, expiresIn: 900 });
  } catch (error) {
    const message = error.message || "Could not create secure upload URL.";
    const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503;
    return json({ error: message }, status);
  }
}