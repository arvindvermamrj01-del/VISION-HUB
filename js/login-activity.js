/* Main-admin-only sign-in activity. RLS in the matching migration is the security boundary. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rows = () => document.getElementById("vhLoginActivityRows");
  async function isMainAdmin() {
    if (!db) return false;
    const {data:{user},error} = await db.auth.getUser();
    if (error || !user) return false;
    const {data:profile,error:profileError} = await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    return !profileError && profile?.role === "admin";
  }
  async function load() {
    const body = rows();
    if (!body) return;
    body.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
    try {
      if (!await isMainAdmin()) throw new Error("Main administrator access required.");
      const {data,error} = await db.from("vh_login_activity").select("user_id,created_at").order("created_at",{ascending:false}).limit(100);
      if (error) throw error;
      const entries = data || [];
      const ids = [...new Set(entries.map(entry => entry.user_id).filter(Boolean))];
      let profiles = [];
      if (ids.length) {
        const result = await db.from("profiles").select("id,fullname").in("id",ids);
        if (!result.error) profiles = result.data || [];
      }
      const names = new Map(profiles.map(profile => [profile.id,profile.fullname]));
      body.innerHTML = entries.length ? entries.map(entry => {
        const date = new Date(entry.created_at);
        const time = Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleString();
        const id = String(entry.user_id || "");
        return '<tr><td>'+esc(time)+'</td><td>'+esc(names.get(id)||"Account")+'</td><td><code>'+esc(id)+'</code></td></tr>';
      }).join("") : '<tr><td colspan="3">No sign-ins recorded yet.</td></tr>';
    } catch (error) {
      body.innerHTML = '<tr><td colspan="3">'+esc(error.message || "Activity could not be loaded.")+'</td></tr>';
    }
  }
  async function record(user) {
    if (!db || !user?.id) return;
    const {error} = await db.from("vh_login_activity").insert({user_id:user.id});
    if (error) console.debug("Sign-in activity is unavailable until its database migration is applied:",error.message);
  }
  window.VHLoginActivity = {load,record};
  document.addEventListener("click",event => {
    if (event.target.closest("#vhLoginActivityNav")) load();
  });
  document.addEventListener("DOMContentLoaded",() => {
    const nav = document.getElementById("vhLoginActivityNav");
    const panel = document.getElementById("tab-login-activity");
    const updateVisibility = () => {
      const visible = window.VH_ROLE === "admin";
      if (nav) nav.classList.toggle("hidden",!visible);
      if (panel) panel.classList.toggle("hidden",!visible);
    };
    updateVisibility();
    window.addEventListener("vh-auth-state-changed",updateVisibility);
  });
})();
