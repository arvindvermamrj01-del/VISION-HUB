/* Shared request submission and admin moderation for Vision Hub. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const notify = message => {
    const toast = $("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(notify.timer);
      notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
    } else {
      window.alert(message);
    }
  };
  const localRecent = request => {
    try {
      const list = JSON.parse(localStorage.getItem("vh_requests") || "[]");
      list.unshift({ title: request.request_title, type: request.content_type, date: new Date().toLocaleDateString() });
      localStorage.setItem("vh_requests", JSON.stringify(list.slice(0, 8)));
      const host = $("requestsList");
      if (host) host.innerHTML = list.slice(0, 8).map(item =>
        '<div class="request-item"><b>' + escapeHTML(item.title) + '</b><small>' +
        escapeHTML(item.type) + ' · ' + escapeHTML(item.date) + '</small></div>'
      ).join("");
    } catch (_) { /* Local preview is optional; Supabase is the source of truth. */ }
  };
  window.submitRequest = async event => {
    event?.preventDefault();
    const title = $("reqTitle")?.value.trim();
    if (!title) return notify("Please enter the movie or series title.");
    const request = {
      request_title: title,
      content_type: $("reqType")?.value || "Movie",
      release_year: Number($("reqYear")?.value) || null,
      preferred_language: $("reqLang")?.value.trim() || null,
      notes: $("reqNotes")?.value.trim() || null,
      status: "pending"
    };
    if (!db) return notify("Request service is not connected yet. Please try again later.");
    const button = event?.submitter || event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const { error } = await db.from("vh_requests").insert(request);
      if (error) throw error;
      // Analytics is best-effort: a tracking failure must never undo a successful request.
      db.from("vh_analytics_events").insert({ event_type: "request_submit" })
        .then(({ error: analyticsError }) => {
          if (analyticsError) console.debug("Request analytics not stored:", analyticsError.message);
        });
      localRecent(request);
      $("reqTitle").value = "";
      $("reqYear").value = "";
      $("reqLang").value = "";
      $("reqNotes").value = "";
      notify("Request submitted successfully.");
    } catch (error) {
      console.error("Request submission failed:", error);
      notify(error.message || "Request could not be submitted. Please try again.");
    } finally {
      if (button) button.disabled = false;
    }
  };

  async function requireRequestStaff() {
    if (!db) throw new Error("Supabase is not connected.");
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!["admin","sub_admin","moderator"].includes(profile?.role)) throw new Error("Request moderation permission required.");
    return user;
  }
  async function loadRequests() {
    const host = $("adminRequestsList");
    if (!host || !db) return;
    try {
      await requireRequestStaff();
      const { data, error } = await db.from("vh_requests").select("*")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      if (!data?.length) {
        host.textContent = "No requests have been submitted yet.";
        return;
      }
      host.innerHTML = data.map(item => {
        const status = item.status || "pending";
        return '<article class="request-item" style="padding:14px;margin:10px 0;border:1px solid var(--border);border-radius:10px">' +
          '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>' +
          escapeHTML(item.request_title) + '</strong><span>' + escapeHTML(status.toUpperCase()) + '</span></div>' +
          '<small>' + escapeHTML(item.content_type) + ' · ' +
          escapeHTML(item.release_year || "Year unknown") + ' · ' +
          escapeHTML(item.preferred_language || "Language not specified") + ' · ' +
          escapeHTML(new Date(item.created_at).toLocaleString()) + '</small>' +
          (item.notes ? '<p>' + escapeHTML(item.notes) + '</p>' : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
          (status !== "approved" ? '<button type="button" onclick="moderateRequest(' + Number(item.id) + ',\'approved\')">Approve</button>' : '') +
          (status !== "declined" ? '<button type="button" onclick="moderateRequest(' + Number(item.id) + ',\'declined\')">Decline</button>' : '') +
          '<button type="button" onclick="deleteRequest(' + Number(item.id) + ')">Delete</button></div></article>';
      }).join("");
    } catch (error) {
      host.textContent = error.message || "Could not load requests.";
    }
  }
  window.moderateRequest = async (id, status) => {
    try {
      const user = await requireRequestStaff();
      const { error } = await db.from("vh_requests").update({
        status, reviewed_at: new Date().toISOString(), reviewed_by: user.id
      }).eq("id", id);
      if (error) throw error;
      notify("Request status updated.");
      await loadRequests();
    } catch (error) { notify(error.message || "Could not update request."); }
  };
  window.deleteRequest = async id => {
    if (!window.confirm("Permanently delete this request?")) return;
    try {
      await requireRequestStaff();
      const { error } = await db.from("vh_requests").delete().eq("id", id);
      if (error) throw error;
      notify("Request deleted.");
      await loadRequests();
    } catch (error) { notify(error.message || "Could not delete request."); }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const tab = $("tab-requests-admin");
    if (tab) {
      const observer = new MutationObserver(() => {
        if (tab.classList.contains("active")) loadRequests();
      });
      observer.observe(tab, { attributes: true, attributeFilter: ["class"] });
    }
    db?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadRequests();
    });
  });
})();
