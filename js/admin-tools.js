/* Supabase-backed admin tools. Privileged Auth user creation and OAuth are intentionally server-only. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);
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
      const { data, error } = await db.from("profiles").select("id,fullname,role,created_at").order("created_at",{ascending:false}).limit(500);
      if (error) throw error;
      users = data || [];
      renderUsers($("userManageSearch")?.value || "");
    } catch (error) {
      body.innerHTML = '<tr><td colspan="7">' + esc(error.message || "Users could not be loaded.") + '</td></tr>';
    }
  }
  function renderUsers(query="") {
    const body=$("adminUsersTableBody"); if(!body)return;
    const q=String(query).trim().toLowerCase();
    const filtered=users.filter(u=>[u.fullname,u.id,u.role].join(" ").toLowerCase().includes(q));
    body.innerHTML=filtered.length?filtered.map((u,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(u.fullname||"—")+
      '</td><td><code>'+esc(u.id)+'</code></td><td>Not stored in profiles</td><td>Not collected here</td><td>'+esc(u.created_at?new Date(u.created_at).toLocaleDateString():"—")+
      '</td><td>'+esc(u.role)+'</td></tr>').join(""):'<tr><td colspan="7">No matching user profiles found.</td></tr>';
  }
  window.filterUsersList=value=>renderUsers(value);

  async function loadDashboard() {
    try {
      await requireAdmin();
      const [contentRes,profileRes,eventRes,requestRes]=await Promise.all([
        db.from("vh_content").select("id,content_type,title,created_at").eq("published",true),
        db.from("profiles").select("id,role"),
        db.from("vh_analytics_events").select("id",{count:"exact",head:true}),
        db.from("vh_requests").select("id",{count:"exact",head:true})
      ]);
      if(contentRes.error)throw contentRes.error;
      if(profileRes.error)throw profileRes.error;
      const items=contentRes.data||[],people=profileRes.data||[];
      if($("totalMovies"))$("totalMovies").textContent=items.filter(x=>x.content_type==="Movie").length;
      if($("totalSeries"))$("totalSeries").textContent=items.filter(x=>x.content_type==="Web Series").length;
      if($("totalUsers"))$("totalUsers").textContent=people.filter(x=>x.role==="user").length;
      if($("totalViews"))$("totalViews").textContent=eventRes.error?"—":(eventRes.count??0);
      const recent=$("recentMoviesAdmin");
      if(recent)recent.innerHTML=items.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8)
        .map(x=>'<div class="request-item"><strong>'+esc(x.title)+'</strong><small>'+esc(x.content_type)+' · '+esc(new Date(x.created_at).toLocaleDateString())+'</small></div>').join("")||"<p>No published content yet.</p>";
      const requestStat=$("adminRequestCount");
      if(requestStat)requestStat.textContent=requestRes.error?"—":(requestRes.count??0);
    } catch(error) {
      console.warn("Dashboard data unavailable:",error);
      if($("recentMoviesAdmin"))$("recentMoviesAdmin").textContent=error.message||"Dashboard data unavailable.";
    }
  }

  async function loadReports() {
    try {
      await requireAdmin();
      const [eventsRes, contentRes] = await Promise.all([
        db.from("vh_analytics_events").select("event_type,content_id,created_at").order("created_at", {ascending:false}).limit(5000),
        db.from("vh_content").select("id,title,genre,content_type")
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (contentRes.error) throw contentRes.error;
      const events = eventsRes.data || [];
      const catalog = new Map((contentRes.data || []).map(item => [Number(item.id), item]));
      const countByContent = (type) => {
        const counts = new Map();
        events.filter(event => event.event_type === type && event.content_id != null).forEach(event => {
          const id = Number(event.content_id);
          counts.set(id, (counts.get(id) || 0) + 1);
        });
        return [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,10)
          .map(([id,count]) => ({item:catalog.get(id),count})).filter(x => x.item);
      };
      const renderRanked = (hostId, rows, empty) => {
        const host = $(hostId); if (!host) return;
        host.innerHTML = rows.length ? rows.map((row,index) =>
          '<div class="request-item"><strong>' + (index+1) + '. ' + esc(row.item.title) +
          '</strong><small>' + esc(row.item.content_type) + ' · ' + row.count + ' events</small></div>'
        ).join("") : '<p>' + empty + '</p>';
      };
      renderRanked("topViewedList", countByContent("content_view"), "No content views recorded yet.");
      renderRanked("topDownloadedList", countByContent("play_click"), "No play clicks recorded yet.");
      const genreCounts = new Map();
      events.filter(event => event.event_type === "content_view" && event.content_id != null).forEach(event => {
        const item = catalog.get(Number(event.content_id));
        if (item) {
          const genre = item.genre || "Uncategorised";
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      });
      const genreHost = $("genreChart");
      if (genreHost) {
        const genres = [...genreCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,8);
        genreHost.innerHTML = genres.length ? genres.map(([name,count]) =>
          '<div class="request-item"><strong>' + esc(name) + '</strong><small>' + count + ' content views</small></div>'
        ).join("") : "<p>No genre activity recorded yet.</p>";
      }
      const monthCounts = new Map();
      events.forEach(event => {
        const date = new Date(event.created_at);
        if (!Number.isNaN(date.getTime())) {
          const key = date.toLocaleString(undefined,{month:"short",year:"numeric"});
          monthCounts.set(key,(monthCounts.get(key)||0)+1);
        }
      });
      const monthHost = $("monthlyChart");
      if (monthHost) {
        const months = [...monthCounts.entries()].slice(0,12).reverse();
        monthHost.innerHTML = months.length ? months.map(([name,count]) =>
          '<div class="request-item"><strong>' + esc(name) + '</strong><small>' + count + ' tracked events</small></div>'
        ).join("") : "<p>No monthly activity recorded yet.</p>";
      }
    } catch (error) {
      console.warn("Reports unavailable:", error);
      ["topViewedList","topDownloadedList","genreChart","monthlyChart"].forEach(id => {
        const host = $(id); if (host) host.textContent = error.message || "Reports unavailable.";
      });
    }
  }

  async function loadCategories() {
    const host=$("categoriesList"); if(!host)return;
    try {
      await requireAdmin();
      const {data,error}=await db.from("vh_categories").select("*").order("name");
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(x=>'<div class="manage-item" style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid var(--border)"><span><strong>'+esc(x.name)+'</strong><small style="display:block">'+esc(x.description||"")+'</small></span><button type="button" class="btn-delete" onclick="deleteCategory('+Number(x.id)+')">Delete</button></div>').join(""):"<p>No categories added.</p>";
    } catch(e){host.textContent=e.message||"Categories unavailable.";}
  }
  window.addCategory=async event=>{
    event?.preventDefault();const name=$("catName")?.value.trim();const description=$("catDesc")?.value.trim()||null;
    if(!name)return toast("Category name is required.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{const user=await requireAdmin();const {error}=await db.from("vh_categories").insert({name,description});if(error)throw error;
      event.currentTarget.reset();toast("Category saved.");await loadCategories();}
    catch(e){toast(e.message||"Category could not be saved.");}finally{if(button)button.disabled=false;}
  };
  window.deleteCategory=async id=>{
    if(!window.confirm("Delete this category?"))return;
    try{await requireAdmin();const {error}=await db.from("vh_categories").delete().eq("id",id);if(error)throw error;toast("Category deleted.");await loadCategories();}
    catch(e){toast(e.message||"Delete failed.");}
  };

  async function loadSongs(){
    const host=$("songsList");if(!host)return;
    try{await requireAdmin();const {data,error}=await db.from("vh_songs").select("*").order("created_at",{ascending:false});if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(x=>'<div class="manage-item" style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid var(--border)"><span><strong>'+esc(x.title)+'</strong><small style="display:block">'+esc(x.artist||"")+' · '+(x.is_published?"Published":"Draft")+'</small></span><button type="button" class="btn-delete" onclick="deleteSong('+Number(x.id)+')">Delete</button></div>').join(""):"<p>No songs added.</p>";
    }catch(e){host.textContent=e.message||"Songs unavailable.";}
  }
  window.addSong=async event=>{
    event?.preventDefault();const title=$("songTitle")?.value.trim(),artist=$("songArtist")?.value.trim(),audio=$("songFileUrl")?.value.trim(),poster=$("songPoster")?.value.trim()||null;
    if(!title||!audio)return toast("Song title and authorised audio URL are required.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{const user=await requireAdmin();const {error}=await db.from("vh_songs").insert({title,artist,audio_url:audio,poster_url:poster,is_published:true,created_by:user.id});if(error)throw error;
      event.currentTarget.reset();toast("Song added.");await loadSongs();}
    catch(e){toast(e.message||"Song could not be added.");}finally{if(button)button.disabled=false;}
  };
  window.deleteSong=async id=>{
    if(!window.confirm("Delete this song?"))return;
    try{await requireAdmin();const {error}=await db.from("vh_songs").delete().eq("id",id);if(error)throw error;toast("Song deleted.");await loadSongs();}
    catch(e){toast(e.message||"Delete failed.");}
  };

  window.saveWebsiteSettings=async event=>{
    event?.preventDefault();
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{
      const user=await requireAdmin();
      const settings={
        site_name:$("settingSiteName")?.value.trim()||"Vision Hub",
        telegram_url:$("settingTelegram")?.value.trim()||"",
        seo_description:$("settingSeo")?.value.trim()||"",
        maintenance_mode:$("settingMaintenance")?.value||"off"
      };
      const rows=Object.entries(settings).map(([setting_key,setting_value])=>({setting_key,setting_value,updated_by:user.id,updated_at:new Date().toISOString()}));
      const {error}=await db.from("vh_site_settings").upsert(rows,{onConflict:"setting_key"});if(error)throw error;
      window.dispatchEvent(new CustomEvent("vh:site-settings-updated", {detail:settings}));
      toast("Website settings saved and public site updated.");
    }catch(e){toast(e.message||"Settings could not be saved.");}finally{if(button)button.disabled=false;}
  };
  async function loadWebsiteSettings(){
    try{await requireAdmin();const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value");if(error)throw error;
      const map=Object.fromEntries((data||[]).map(x=>[x.setting_key,x.setting_value]));
      if($("settingSiteName")&&map.site_name)$("settingSiteName").value=map.site_name;
      if($("settingTelegram")&&map.telegram_url)$("settingTelegram").value=map.telegram_url;
      if($("settingSeo")&&map.seo_description)$("settingSeo").value=map.seo_description;
      if($("settingMaintenance")&&map.maintenance_mode)$("settingMaintenance").value=map.maintenance_mode;
    }catch(e){console.warn("Site settings not loaded:",e.message);}
  }

  window.updateAdminCredentials=async event=>{
    event?.preventDefault();const current=$("changeCurrPass")?.value||"",next=$("changeNewPass")?.value||"",confirm=$("changeConfirmPass")?.value||"";
    if(next.length<12)return toast("New password must be at least 12 characters.");
    if(next!==confirm)return toast("New password and confirmation do not match.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{const user=await requireAdmin();if(!user.email)throw new Error("Admin email unavailable; use Supabase password reset.");
      const {error:reauthError}=await db.auth.signInWithPassword({email:user.email,password:current});if(reauthError)throw new Error("Current password is incorrect.");
      const {error:updateError}=await db.auth.updateUser({password:next});if(updateError)throw updateError;event.currentTarget.reset();toast("Admin password updated.");
    }catch(e){toast(e.message||"Password update failed.");}finally{if(button)button.disabled=false;}
  };

  async function teamRequest(method="GET",body=null) {
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
    const response=await fetch("/api/admin/subadmins",{
      method,headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||"Staff management request failed.");
    return result;
  }
  async function loadSubAdmins() {
    const host=$("subAdminsList");if(!host)return;
    try {
      await requireAdmin();
      const result=await teamRequest("GET");
      host.innerHTML=result.team?.length?result.team.map(member=>
        '<article class="request-item" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">'+
        '<span><strong>'+esc(member.fullname||"Staff member")+'</strong><small>'+esc(String(member.role||"").replaceAll("_"," "))+' · '+esc(member.created_at?new Date(member.created_at).toLocaleDateString():"")+'</small></span>'+
        '<button type="button" class="btn-delete" onclick="revokeSubAdmin(\''+esc(member.id)+'\')">Revoke staff access</button></article>'
      ).join(""):"<p>No staff accounts have been created.</p>";
    } catch(error) { host.textContent=error.message||"Staff list unavailable."; }
  }
  window.addSubAdmin=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget;
    const name=$("subName")?.value.trim();
    const email=$("subEmail")?.value.trim().toLowerCase();
    const password=$("subPassword")?.value||"";
    const role=$("subRole")?.value||"";
    const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try {
      if(!name||!email)throw new Error("Staff name and email are required.");
      if(password.length<12)throw new Error("Use a password with at least 12 characters.");
      const result=await teamRequest("POST",{name,email,password,role});
      form.reset();
      toast("Staff account created with "+role.replaceAll("_"," ")+" permissions.");
      await loadSubAdmins();
    } catch(error) { toast(error.message||"Staff account could not be created."); }
    finally { if(button)button.disabled=false; }
  };
  window.revokeSubAdmin=async userId=>{
    if(!window.confirm("Remove this staff member's Vision Hub permissions? The sign-in account will remain active as a normal user."))return;
    try{await teamRequest("DELETE",{userId});toast("Staff permissions revoked.");await loadSubAdmins();}
    catch(error){toast(error.message||"Could not revoke staff permissions.");}
  };
  window.importFromDrive=()=>{const log=$("driveImportLog");if(log)log.textContent="Google Drive import is not connected yet. It still needs a Google OAuth client, Cloudflare server secret and provider consent flow.";toast("Drive import needs Google OAuth configuration.");};

  document.addEventListener("DOMContentLoaded",()=>{
    const watchers=[["tab-users-admin",loadUsers],["tab-team-admin",loadSubAdmins],["tab-dashboard",loadDashboard],["tab-reports",loadReports],["tab-categories",loadCategories],["tab-songs",loadSongs],["tab-settings",loadWebsiteSettings]];
    watchers.forEach(([id,fn])=>{const el=$(id);if(el)new MutationObserver(()=>{if(el.classList.contains("active"))fn();}).observe(el,{attributes:true,attributeFilter:["class"]});});
    db?.auth.onAuthStateChange((_event,session)=>{if(session?.user){loadDashboard();if($("tab-users-admin")?.classList.contains("active"))loadUsers();}});
    if(window.VH_IS_ADMIN)loadDashboard();
  });
})();
