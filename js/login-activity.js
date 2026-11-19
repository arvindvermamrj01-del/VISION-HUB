/* Primary-admin-only login activity panel. Supabase RLS is the security boundary. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  window.loadLoginActivity = async function () {
    const body = document.getElementById("loginActivityTableBody");
    const status = document.getElementById("loginActivityStatus");
    if (!body || !status) return;
    body.replaceChildren();
    if (!window.VH_IS_ADMIN) {
      status.textContent = "Access denied. Only the primary Admin can view login activity.";
      return;
    }
    if (!db) {
      status.textContent = "Supabase connection is unavailable.";
      return;
    }
    status.textContent = "Loading recent login activity…";
    try {
      const { data: events, error } = await db.from("vh_login_activity")
        .select("id,user_id,created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = [...new Set((events || []).map(item => item.user_id).filter(Boolean))];
      let profiles = [];
      if (ids.length) {
        const result = await db.from("profiles").select("id,fullname,role").in("id", ids);
        if (result.error) throw result.error;
        profiles = result.data || [];
      }
      const byId = new Map(profiles.map(profile => [profile.id, profile]));
      if (!events?.length) {
        status.textContent = "No login activity has been recorded yet.";
        return;
      }
      body.innerHTML = events.map((event, index) => {
        const profile = byId.get(event.user_id);
        return "<tr><td>" + (index + 1) + "</td><td>" + esc(profile?.fullname || "User") +
          "</td><td><code>" + esc(event.user_id) + "</code></td><td>" + esc(profile?.role || "user") +
          "</td><td>" + esc(event.created_at ? new Date(event.created_at).toLocaleString() : "—") + "</td></tr>";
      }).join("");
      status.textContent = "Showing " + events.length + " most recent login events.";
    } catch (error) {
      console.error("Login activity load failed:", error);
      status.textContent = error.message || "Could not load login activity.";
    }
  };
})();