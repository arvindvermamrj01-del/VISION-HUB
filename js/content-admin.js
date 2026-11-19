/* Supabase-backed admin publishing for authorised media only. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const BUCKET = "vh-private-media";
  const $ = id => document.getElementById(id);
  const toast = message => {
    if (typeof window.toast === "function") window.toast(message);
    else alert(message);
  };
  const safe = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = name => String(name).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  async function requireContentStaff() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Pehle Admin account se login karein.");
    const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["admin","sub_admin","content_editor"].includes(profile.role)) throw new Error("Content management permission nahi hai.");
    return user;
  }
  async function uploadVideo(file, user, provider) {
    if (!file) return null;
    if (provider === "terabox") {
      if (typeof window.VH_TERABOX_UPLOAD !== "function") throw new Error("TeraBox upload module did not load.");
      return await window.VH_TERABOX_UPLOAD(file);
    }
    if (provider === "google_drive") {
      if (typeof window.VH_GOOGLE_DRIVE_UPLOAD !== "function") throw new Error("Google Drive upload module did not load.");
      return await window.VH_GOOGLE_DRIVE_UPLOAD(file);
    }
    if (provider !== "supabase") {
      throw new Error("Is provider ke liye direct upload abhi connect nahi hai. Authorised share/direct URL use karein ya Supabase/TeraBox/Google Drive select karein.");
    }
    if (!file.type.startsWith("video/")) throw new Error("Sirf video file upload karein.");
    const path = user.id + "/" + Date.now() + "-" + slug(file.name || "video");
    const { error } = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return { storagePath: path };
  }
  function addToCatalog(row) {
    const item = {
      id: row.id, isSupabaseContent: true, title: row.title, type: row.content_type, industry: row.industry || "All",
      genre: row.genre || "Drama", year: row.release_year || new Date().getFullYear(),
      rating: row.rating || "—", language: row.language || "", duration: row.duration || "",
      poster: row.poster_url || "https://placehold.co/400x600/171b2b/ffffff?text=Vision+Hub",
      backdrop: row.poster_url || "", description: row.description || "", cast: row.cast || "",
      trailer: row.trailer_url || "", video_url: row.video_url, storage_path: row.storage_path || null, storage_provider: row.storage_provider || "supabase", is_short: row.content_type === "Short"
    };
    const list = window.VISION_HUB_DATA || (window.VISION_HUB_DATA = []);
    const index = list.findIndex(x => x.id === item.id);
    if (index >= 0) list[index] = item; else list.unshift(item);
  }
  function renderManageList(query = "") {
    const host = $("manageList");
    if (!host) return;
    const term = String(query || "").trim().toLowerCase();
    const items = (window.VISION_HUB_DATA || []).filter(item =>
      item.isSupabaseContent &&
      [item.title, item.type, item.genre, item.language, item.industry].join(" ").toLowerCase().includes(term)
    );
    host.innerHTML = items.length ? items.map(item => `
      <article class="manage-item" style="display:flex;justify-content:space-between;gap:14px;align-items:center;padding:12px;border-bottom:1px solid var(--border);">
        <div><strong>${safe(item.title)}</strong><small style="display:block;color:var(--text-muted)">${safe(item.type)} · ${safe(item.year)} · ${safe(item.genre)}</small></div>
        <button type="button" class="btn-delete" onclick="deletePublishedContent(${Number(item.id)})">Delete</button>
      </article>`).join("") : "<p>No published Supabase content found.</p>";
  }
  window.filterManageList = value => renderManageList(value);
  window.deletePublishedContent = async id => {
    if (!Number.isFinite(Number(id)) || !window.confirm("Delete this published item permanently?")) return;
    let cleanupPending=false;
    try {
      await requireContentStaff();
      const { data: row, error: readError } = await db.from("vh_content").select("storage_path,storage_provider,content_type").eq("id", Number(id)).maybeSingle();
      if (readError) throw readError;
      const {data:tracks,error:tracksError}=await db.from("vh_media_assets").select("storage_path,storage_provider,asset_url").eq("content_id",Number(id));
      if(tracksError)throw tracksError;
      const privateTrackPaths=(tracks||[]).filter(asset=>asset.storage_provider==="supabase"&&asset.storage_path&&!String(asset.asset_url||"").includes("/object/public/vh-media/")).map(asset=>asset.storage_path);
      if(privateTrackPaths.length){
        const {error:removeTracksError}=await db.storage.from(BUCKET).remove(privateTrackPaths);
        if(removeTracksError)throw removeTracksError;
      }
      if(row?.storage_provider==="terabox"||row?.storage_provider==="google_drive"){
        const {data:{session}}=await db.auth.getSession();
        const endpoint=row.storage_provider==="terabox"?"/api/storage/terabox/file?id=":"/api/storage/google-drive/file?id=";
        const response=await fetch(endpoint+encodeURIComponent(id),{method:"DELETE",headers:{authorization:"Bearer "+session.access_token}});
        const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Could not remove external-storage item.");
        cleanupPending=Boolean(payload.cleanup_pending);
      }else{
        if(row?.storage_path){
          const {error:removeVideoError}=await db.storage.from(BUCKET).remove([row.storage_path]);
          if(removeVideoError)throw removeVideoError;
        }
        const { error } = await db.from("vh_content").delete().eq("id", Number(id));
        if (error) throw error;
      }
      window.VISION_HUB_DATA = (window.VISION_HUB_DATA || []).filter(item => !(item.isSupabaseContent && Number(item.id) === Number(id)));
      window.renderVisionHub?.();
      renderManageList($("manageSearch")?.value || "");
      toast(cleanupPending?"Content deleted; external storage cleanup is pending.":"Content deleted.");
    } catch (error) {
      console.error("Content delete failed:", error);
      toast(error.message || "Could not delete content.");
    }
  };
  async function loadPublished() {
    const { data, error } = await db.from("vh_content").select("*").eq("published", true).order("created_at", { ascending: false });
    if (error) { console.warn("Published content could not be loaded:", error.message); return; }
    (data || []).forEach(addToCatalog);
    ["trendingGrid","seriesGrid","newGrid","allMoviesGrid","allSeriesGrid"].forEach(id => {
      // Re-render via the site's existing router/render is not exposed; opening pages still uses updated shared array.
      const el = $(id);
      if (el) el.dispatchEvent(new Event("visionhub:catalog-updated"));
    });
    window.renderVisionHub?.();
    renderManageList($("manageSearch")?.value || "");
    document.dispatchEvent(new CustomEvent("visionhub:content-loaded"));
  }
  async function publish(form, type) {
    const user = await requireContentStaff();
    const title = $(type === "Short" ? "shortTitle" : "addTitle")?.value.trim();
    const file = $(type === "Short" ? "shortVideoFile" : "addVideoFile")?.files?.[0] || null;
    const urlInput = type === "Short" ? $("shortVideoUrl")?.value.trim() : $("addVideo")?.value.trim();
    const providerSelect = $(type === "Short" ? "shortStorageProvider" : "addStorageProvider");
    const provider = providerSelect?.value || window.VH_STORAGE_DEFAULT || "supabase";
    if (!title) throw new Error("Title required hai.");
    if (!file && !urlInput) throw new Error("Video file upload karein ya authorised video URL dein.");
    let videoUrl = urlInput || "";
    let storagePath = null;
    if (file) {
      const uploaded = await uploadVideo(file, user, provider);
      storagePath = uploaded.storagePath;
      if(uploaded.videoUrl) videoUrl = uploaded.videoUrl;
    } else {
      if (!videoUrl) throw new Error("Video URL is missing.");
      let parsedVideoUrl;
      try { parsedVideoUrl = new URL(videoUrl); } catch (_) { throw new Error("Valid HTTPS video or authorised provider URL dein."); }
      if (parsedVideoUrl.protocol !== "https:") throw new Error("Only HTTPS media URLs are accepted.");
    }
    const row = {
      title, content_type: type, video_url: videoUrl, storage_path: storagePath, storage_provider: provider, published: true, created_by: user.id,
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
    if (error) {
      if (storagePath && provider === "supabase") await db.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      throw error;
    }
    addToCatalog(data);
    form?.reset();
    toast(type + " successfully publish ho gaya.");
    try {
      const { data: { session } } = await db.auth.getSession();
      if (session?.access_token) {
        const response = await fetch("/api/telegram/notify", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ title, type, url: window.location.origin })
        });
        if (!response.ok) console.warn("Telegram notification was not sent:", await response.text());
      }
    } catch (notifyError) { console.warn("Telegram notification unavailable:", notifyError); }
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
  window.addEventListener("vh:google-drive-upload-progress", event => {
    const detail=event.detail||{};
    const text="Google Drive upload: chunk "+Number(detail.completed||0)+" of "+Number(detail.total||0)+" complete.";
    ["googleDriveUploadProgress","googleDriveShortUploadProgress"].forEach(id=>{const node=$(id);if(node)node.textContent=text;});
  });
  window.addEventListener("vh:terabox-upload-progress", event => {
    const detail=event.detail||{};
    const text="TeraBox upload: chunk "+Number(detail.completed||0)+" of "+Number(detail.total||0)+" complete.";
    ["teraboxUploadProgress","teraboxShortUploadProgress"].forEach(id=>{const node=$(id);if(node)node.textContent=text;});
  });
  document.addEventListener("DOMContentLoaded", loadPublished);
  db.auth.onAuthStateChange((event, session) => {
    if (session?.user) loadPublished();
  });
})();
