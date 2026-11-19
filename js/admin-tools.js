/* Admin dashboard utilities backed by Supabase. No service-role keys are used in the browser. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = message => {
    if (typeof window.toast === "function") window.toast(message);
    else window.alert(message);
  };
  async function requireAdmin() {
    if (!db) throw new Error("Supabase connection missing.");
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: pErr } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pErr) throw pErr;
    if (profile?.role !== "admin") throw new Error("Admin permission required.");
    return user;
  }
  let users = [];
  async function loadUsers() {
    const body = $("adminUsersTableBody");
    if (!body) return;
    try {
      await requireAdmin();
      const { data, error } = await db.from("profiles")
        .select("id,fullname,role,created_at").order("created_at", {ascending:false}).limit(500);
      if (error) throw error;
      users = data || [];
      renderUsers($("userManageSearch")?.value || "");
    } catch (error) {
      body.innerHTML = '<tr><td colspan="6">' + esc(error.message || "Users could not be loaded.") + '</td></tr>';
    }
  }
  function renderUsers(query="") {
    const body = $("adminUsersTableBody");
    if (!body) return;
    const q = String(query).trim().toLowerCase();
    const filtered = users.filter(u => [u.fullname,u.id,u.role].join(" ").toLowerCase().includes(q));
    body.innerHTML = filtered.length ? filtered.map((u,i) => '<tr><td>'+(i+1)+'</td><td>'+esc(u.fullname || "—")+
      '</td><td>Private (not stored in public profile)</td><td>Not collected</td><td>'+esc(u.created_at ? new Date(u.created_at).toLocaleDateString() : "—")+
      '</td><td><span>'+esc(u.role)+'</span></td></tr>').join("") :
      '<tr><td colspan="6">No matching user profiles found.</td></tr>';
  }
  window.filterUsersList = value => renderUsers(value);
  async function loadDashboard() {
    try {
      await requireAdmin();
      const [{data:content,error:cErr},{data:profiles,error:pErr}] = await Promise.all([
        db.from("vh_content").select("id,content_type,title,created_at").eq("published",true),
        db.from("profiles").select("id,role")
      ]);
      if(cErr) throw cErr;
      if(pErr) throw pErr;
      const items=content||[], people=profiles||[];
      if($("totalMovies")) $("totalMovies").textContent=items.filter(x=>x.content_type==="Movie").length;
      if($("totalSeries")) $("totalSeries").textContent=items.filter(x=>x.content_type==="Web Series").length;
      if($("totalUsers")) $("totalUsers").textContent=people.filter(x=>x.role!=="admin").length;
      if($("totalViews")) $("totalViews").textContent="—";
      const recent=$("recentMoviesAdmin");
      if(recent) recent.innerHTML=items.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8)
        .map(x=>'<div class="request-item"><strong>'+esc(x.title)+'</strong><small>'+esc(x.content_type)+' · '+esc(new Date(x.created_at).toLocaleDateString())+'</small></div>').join("") || "<p>No published content yet.</p>";
    } catch(error) {
      console.warn("Dashboard data could not be loaded:",error);
      if($("recentMoviesAdmin")) $("recentMoviesAdmin").textContent=error.message || "Dashboard data unavailable.";
    }
  }
  window.updateAdminCredentials = async event => {
    event?.preventDefault();
    const current=$("changeCurrPass")?.value || "";
    const next=$("changeNewPass")?.value || "";
    const confirm=$("changeConfirmPass")?.value || "";
    if(next.length<10) return toast("New password must be at least 10 characters.");
    if(next!==confirm) return toast("New password and confirmation do not match.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');
    if(button) button.disabled=true;
    try {
      const user=await requireAdmin();
      if(!user.email) throw new Error("Admin email is unavailable; use Supabase password reset.");
      const {error:reauthError}=await db.auth.signInWithPassword({email:user.email,password:current});
      if(reauthError) throw new Error("Current password is incorrect.");
      const {error:updateError}=await db.auth.updateUser({password:next});
      if(updateError) throw updateError;
      event.currentTarget.reset();
      toast("Admin password updated successfully.");
    } catch(error) {
      console.error("Password update failed:",error);
      toast(error.message || "Password could not be updated.");
    } finally { if(button) button.disabled=false; }
  };
  const unsupported = feature => event => {
    event?.preventDefault?.();
    toast(feature + " needs a secure server-side Supabase function and database table. It has not been activated, to avoid insecure account creation or fake saves.");
  };
  window.addSubAdmin = unsupported("Sub-admin creation");
  window.addCategory = unsupported("Category management");
  window.addSong = unsupported("Song management");
  window.saveWebsiteSettings = unsupported("Website settings");
  window.importFromDrive = unsupported("Google Drive import");
  document.addEventListener("DOMContentLoaded", () => {
    const usersTab=$("tab-users-admin"), dashboard=$("tab-dashboard");
    if(usersTab) new MutationObserver(()=>{if(usersTab.classList.contains("active"))loadUsers();}).observe(usersTab,{attributes:true,attributeFilter:["class"]});
    if(dashboard) new MutationObserver(()=>{if(dashboard.classList.contains("active"))loadDashboard();}).observe(dashboard,{attributes:true,attributeFilter:["class"]});
    db?.auth.onAuthStateChange((_event,session)=>{if(session?.user){loadDashboard();if(usersTab?.classList.contains("active"))loadUsers();}});
    if(window.VH_IS_ADMIN){loadDashboard();}
  });
})();
