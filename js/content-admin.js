/* Supabase-backed admin publishing for authorised media only. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const BUCKET = "vh-media";
  const $ = id => document.getElementById(id);
  const toast = message => {
    if (typeof window.toast === "function") window.toast(message);
    else alert(message);
  };
  const safe = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = name => String(name).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  async function requireAdmin() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Pehle Admin account se login karein.");
    const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin") throw new Error("Admin permission nahi hai.");
    return user;
  }
  async function uploadVideo(file, user) {
    if (!file) return null;
    if (!file.type.startsWith("video/")) throw new Error("Sirf video file upload karein.");
    const path = user.id + "/" + Date.now() + "-" + slug(file.name || "video");
    const { error } = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  function addToCatalog(row) {
    const item = {
      id: row.id, title: row.title, type: row.content_type, industry: row.industry || "All",
      genre: row.genre || "Drama", year: row.release_year || new Date().getFullYear(),
      rating: row.rating || "—", language: row.language || "", duration: row.duration || "",
      poster: row.poster_url || "https://placehold.co/400x600/171b2b/ffffff?text=Vision+Hub",
      backdrop: row.poster_url || "", description: row.description || "", cast: row.cast || "",
      trailer: row.trailer_url || "", video_url: row.video_url, is_short: row.content_type === "Short"
    };
    const list = window.VISION_HUB_DATA || (window.VISION_HUB_DATA = []);
    const index = list.findIndex(x => x.id === item.id);
    if (index >= 0) list[index] = item; else list.unshift(item);
  }
  async function loadPublished() {
    const { data, error } = await db.from("vh_content").select("*").eq("published", true).order("created_at", { ascending: false });
    if (error) { console.warn("Published content could not be loaded:", error.message); return; }
    (data || []).forEach(addToCatalog);
    ["trendingGrid","seriesGrid","newGrid","allMoviesGrid","allSeriesGrid"].forEach(id => {
      // Re-render via the site's existing router/render is not exposed; opening pages still uses updated shared array.
      const el = $(id);
      if (el) el.dispatchEvent(new Event("visionhub:catalog-updated"));
    });
    window.renderVisionHub?.();\n    document.dispatchEvent(new CustomEvent("visionhub:content-loaded"));
  }
  async function publish(form, type) {
    const user = await requireAdmin();
    const title = $(type === "Short" ? "shortTitle" : "addTitle")?.value.trim();
    const file = $(type === "Short" ? "shortVideoFile" : "addVideoFile")?.files?.[0] || null;
    const urlInput = type === "Short" ? "" : $("addVideo")?.value.trim();
    if (!title) throw new Error("Title required hai.");
    if (!file && !urlInput) throw new Error("Video file upload karein ya authorised video URL dein.");
    const videoUrl = await uploadVideo(file, user) || urlInput;
    const row = {
      title, content_type: type, video_url: videoUrl, published: true, created_by: user.id,
      poster_url: type === "Short" ? null : ($("addPoster")?.value.trim() || null),
      genre: type === "Short" ? "Shorts" : ($("addGenre")?.value || "Drama"),
      language: type === "Short" ? "" : ($("addLang")?.value.trim() || ""),
      release_year: type === "Short" ? new Date().getFullYear() : (Number($("addYear")?.value) || null),
      rating: type === "Short" ? null : (Number($("addRating")?.value) || null),
      description: type === "Short" ? ($("shortDesc")?.value.trim() || "") : ($("addDesc")?.value.trim() || ""),
      cast: type === "Short" ? "" : ($("addCast")?.value.trim() || ""),
      duration: type === "Short" ? "" : ($("addDuration")?.value.trim() || ""),
      trailer_url: type === "Short" ? null : ($("addTrailer")?.value.trim() || null),
      industry: type === "Short" ? "All" : (($("addLang")?.value || "").toLowerCase().includes("hindi") ? "Bollywood" : "All")
    };
    const { data, error } = await db.from("vh_content").insert(row).select("*").single();
    if (error) throw error;
    addToCatalog(data);
    form?.reset();
    toast(type + " successfully publish ho gaya.");
    await loadPublished();
  }
  window.addMovie = async function(e) {
    e?.preventDefault();
    const form = e?.currentTarget || document.querySelector('#tab-add-movie form');
    const button = form?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try { await publish(form, $("addType")?.value || "Movie"); }
    catch (err) { console.error(err); toast(err.message || "Publish failed."); }
    finally { if (button) button.disabled = false; }
  };
  window.publishShort = async function(e) {
    e?.preventDefault();
    const form = e?.currentTarget;
    const button = form?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try { await publish(form, "Short"); }
    catch (err) { console.error(err); toast(err.message || "Short publish failed."); }
    finally { if (button) button.disabled = false; }
  };
  const originalOpenMovie = window.openMovie;
  if (typeof originalOpenMovie === "function") {
    window.openMovie = function(id) {
      originalOpenMovie(id);
      const item = (window.VISION_HUB_DATA || []).find(x => String(x.id) === String(id));
      const button = $("modalPlayBtn");
      if (button && item?.video_url) button.onclick = () => {
        $("playerTitle").textContent = "▶ " + item.title;
        $("playerIframe").src = "";
        const video = $("playerFallback")?.querySelector("video");
        if (video) { video.src = item.video_url; video.load(); }
        $("playerFallback")?.classList.add("active");
        $("playerOverlay")?.classList.add("open");
      };
    };
  }
  document.addEventListener("DOMContentLoaded", loadPublished);
  db.auth.onAuthStateChange((event, session) => {
    if (session?.user) loadPublished();
  });
})();
