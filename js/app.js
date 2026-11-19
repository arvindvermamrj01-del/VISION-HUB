/* Vision Hub front-end demo. Local storage is not secure authentication or shared storage. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), data=window.VISION_HUB_DATA||[];
let industry="All",genre="All",movieGenre="All",heroIndex=0,current=null;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getList=k=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
const setList=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2800)}
function card(m){
const poster=m.poster?'<img loading="lazy" src="'+safe(m.poster)+'" alt="'+safe(m.title)+' poster" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'poster-empty\',textContent:\'Poster unavailable\'}))">':'<div class="poster-empty">Poster unavailable</div>';
const meta=[m.year,m.genre,m.rating?'★ '+m.rating:''].filter(Boolean).join(' · ');
return '<article class="movie-card"><button class="poster-button" onclick="openMovie(&quot;'+safe(m.id)+'&quot;)" aria-label="View '+safe(m.title)+'">'+poster+'<span class="poster-play"><i class="fas fa-play"></i></span></button><div class="movie-info"><h3>'+safe(m.title)+'</h3><p>'+safe(meta)+'</p><div class="card-actions"><button onclick="openMovie(&quot;'+safe(m.id)+'&quot;)">Details</button><button onclick="toggleItem(&quot;'+safe(m.id)+'&quot;)" aria-label="Add to watchlist">♡</button></div></div></article>';
}
function grid(id,items){const el=$(id);if(el)el.innerHTML=items.length?items.map(card).join(""):'<div class="empty-state"><h3>No titles found</h3><p>Try another filter or search.</p></div>'}
function hero(){const m=data[heroIndex%data.length];if(!m)return;current=m;if($("heroBg"))$("heroBg").style.backgroundImage=(m.backdrop||m.poster)?`url("${m.backdrop||m.poster}")`:"none";if($("heroTitle"))$("heroTitle").textContent=m.title;if($("heroDesc"))$("heroDesc").textContent=m.description;if($("heroMeta"))$("heroMeta").textContent=`${m.year} · ${m.duration} · ★ ${m.rating}`;if($("heroPlayBtn"))$("heroPlayBtn").onclick=()=>openMovie(m.id);if($("heroListBtn"))$("heroListBtn").onclick=()=>toggleItem(m.id)}
function render(){
const f=data.filter(m=>(industry==="All"||m.industry===industry)&&(genre==="All"||m.genre===genre));
grid("trendingGrid",f.filter(x=>x.type==="Movie").slice(0,6));
grid("seriesGrid",data.filter(x=>x.type==="Web Series"));
grid("newGrid",[...data].sort((a,b)=>Number(b.year||0)-Number(a.year||0)).slice(0,6));
grid("topRatedGrid",[...data].filter(x=>x.rating!==""&&x.rating!=null).sort((a,b)=>Number(b.rating)-Number(a.rating)).slice(0,6));
let progressItems=[];try{progressItems=data.filter(item=>Number(localStorage.getItem("vh_progress_"+String(item.id))||0)>5).sort((a,b)=>Number(localStorage.getItem("vh_progress_"+String(b.id))||0)-Number(localStorage.getItem("vh_progress_"+String(a.id))||0)).slice(0,6);}catch(_){}
grid("continueWatchingGrid",progressItems);$("continueWatchingSection")?.classList.toggle("hidden",!progressItems.length);
grid("homeShortsGrid",data.filter(x=>x.type==="Short").slice(0,6));
grid("allMoviesGrid",data.filter(x=>x.type==="Movie"&&(movieGenre==="All"||x.genre===movieGenre)));
grid("allSeriesGrid",data.filter(x=>x.type==="Web Series"));
grid("shortsGrid",data.filter(x=>x.type==="Short"));
const genreHost=$("popularGenreLinks");
if(genreHost){const counts=new Map();data.forEach(item=>{if(item.genre&&item.genre!=="Uncategorised")counts.set(item.genre,(counts.get(item.genre)||0)+1)});genreHost.innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,count])=>'<button class="filter-btn" onclick="filterByGenre(\''+safe(name)+'\')">'+safe(name)+' · '+count+'</button>').join("")||'<p>Genres will appear as the catalog grows.</p>';}
renderWatchlist();hero();
}
window.renderVisionHub=render;
window.showPage=name=>{
if(name==="profile"&&!window.VH_USER_ID){name="login";}
if(name==="admin"&&!window.VH_IS_ADMIN)name="admin-login";
document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
$("page-"+name)?.classList.add("active");
document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+name));
$("navLinks")?.classList.remove("open");
const pageTitles={home:"Vision Hub | Movies, Web Series & Shorts",movies:"All Movies | Vision Hub",series:"Web Series | Vision Hub",shorts:"Shorts | Vision Hub",watchlist:"My Watchlist | Vision Hub",request:"Request Content | Vision Hub",profile:"My Account | Vision Hub",login:"Sign In | Vision Hub",register:"Create Account | Vision Hub","reset-password":"Reset Password | Vision Hub","admin-login":"Admin Login | Vision Hub",admin:"Control Center | Vision Hub"};
document.title=pageTitles[name]||"Vision Hub";
window.scrollTo({top:0,behavior:"smooth"});
if(name==="watchlist")renderWatchlist();
};
window.openHiddenAdminLogin=()=>window.showPage("admin-login");
window.addEventListener("hashchange",()=>{if(location.hash==="#control-center")window.openHiddenAdminLogin()});
if(location.hash==="#control-center"||location.pathname.replace(/\/+$/,"")==="/control-center")window.openHiddenAdminLogin();
window.filterByIndustry=(v,el)=>{industry=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterByGenre=(v,el)=>{genre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterMoviesPage=(v,el)=>{movieGenre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.toggleItem=async id=>{
  let a=getList("vh_watchlist").map(String),key=String(id),adding=!a.includes(key);
  a=adding?[...a,key]:a.filter(x=>x!==key);setList("vh_watchlist",a);renderWatchlist();
  const db=window.VH_SUPABASE;
  try{
    const {data:{user}}=await db?.auth.getUser()||{data:{user:null}};
    if(user&&db){
      const result=adding
        ?await db.from("vh_user_watchlist").upsert({user_id:user.id,content_id:key},{onConflict:"user_id,content_id"})
        :await db.from("vh_user_watchlist").delete().eq("user_id",user.id).eq("content_id",key);
      if(result.error)throw result.error;
    }
    toast(adding?"Added to your watchlist":"Removed from watchlist");
  }catch(error){console.warn("Cloud watchlist sync unavailable; local copy retained:",error.message);toast("Saved on this device. Cloud sync needs the watchlist migration.");}
};
async function loadCloudWatchlist(){
  const db=window.VH_SUPABASE;if(!db)return;
  try{
    const {data:{user}}=await db.auth.getUser();if(!user)return;
    const {data:rows,error}=await db.from("vh_user_watchlist").select("content_id").eq("user_id",user.id);
    if(error)throw error;
    setList("vh_watchlist",(rows||[]).map(row=>String(row.content_id)));
    renderWatchlist();
  }catch(error){console.warn("Cloud watchlist load unavailable:",error.message);}
}
function renderWatchlist(){const ids=getList("vh_watchlist").map(String),a=data.filter(x=>ids.includes(String(x.id)));grid("watchlistGrid",a);grid("profileWatchlistGrid",a);$("watchlistEmpty")?.classList.toggle("hidden",a.length>0);if($("statWatchlist"))$("statWatchlist").textContent=a.length}
window.openMovie=id=>{const m=data.find(x=>String(x.id)===String(id));if(!m)return;current=m;document.title=m.title+" ("+(m.year||"")+") | Vision Hub";const description=document.querySelector('meta[name="description"]');if(description)description.content=String(m.description||("Discover "+m.title+" on Vision Hub.")).slice(0,300);if($("modalTitle"))$("modalTitle").textContent=m.title;if($("modalDesc"))$("modalDesc").textContent=m.description;if($("modalMeta"))$("modalMeta").textContent=`${m.year} · ${m.genre} · ${m.language} · ★ ${m.rating}`;if($("modalPoster")){ $("modalPoster").style.display=m.poster?"":"none"; if(m.poster)$("modalPoster").src=m.poster; else $("modalPoster").removeAttribute("src"); }if($("modalCast"))$("modalCast").textContent=m.cast?"Cast: "+m.cast:"";if($("modalDirector"))$("modalDirector").textContent=m.director?"Director: "+m.director:"";const shots=$("modalScreenshots");if(shots){const list=Array.isArray(m.screenshots)?m.screenshots:String(m.screenshots||"").split(",").map(x=>x.trim()).filter(Boolean);shots.innerHTML=list.length?'<h3>Preview Screenshots</h3><div class="vh-screenshot-grid">'+list.map((url,i)=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+safe(url)+'" alt="'+safe(m.title)+' screenshot '+(i+1)+'"></a>').join("")+'</div>':"";}const trailer=$("trailerEmbed");if(trailer){const raw=String(m.trailer||"");let videoId="";try{const u=new URL(raw);if(u.hostname.includes("youtu.be"))videoId=u.pathname.slice(1);else if(u.hostname.includes("youtube.com"))videoId=u.searchParams.get("v")||u.pathname.split("/").filter(Boolean).pop()||"";}catch(_){}trailer.innerHTML=videoId?'<iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/'+safe(videoId)+'" title="Official trailer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>':""; $("trailerSection")?.classList.toggle("hidden",!videoId);} $("movieModal")?.classList.add("open");if($("modalPlayBtn"))$("modalPlayBtn").onclick=()=>m.trailer?window.open(m.trailer,"_blank","noopener"):toast("Official trailer not available");if($("modalWatchBtn"))$("modalWatchBtn").onclick=()=>toggleItem(id)};
window.closeModal=()=> $("movieModal")?.classList.remove("open");window.closeModalBtn=window.closeModal;window.playMovie=()=>current?.trailer?window.open(current.trailer,"_blank","noopener"):toast("Official trailer unavailable");window.toggleWatchlist=()=>current&&toggleItem(current.id);
window.downloadMovie=()=>toast("Only official trailers and authorised viewing links are supported.");window.openTelegram=()=>{const link=document.querySelector("a.telegram-target-link")?.href||"https://t.me/visionhub_official";window.open(link,"_blank","noopener");};window.triggerDownload=()=>toast("Unverified downloads are disabled. Use an authorised provider.");window.closePlayer=()=>{ $("playerOverlay")?.classList.remove("open");if($("playerIframe"))$("playerIframe").src=""};window.closeDownloadModal=()=> $("downloadModal")?.classList.remove("open");
window.toggleSearch=()=>{const o=$("searchOverlay");o?.classList.toggle("open");if(o?.classList.contains("open"))$("searchInput")?.focus()};
window.liveSearch=q=>{
  const t=String(q||"").trim().toLowerCase(),host=$("searchResults");
  if(!host)return;
  if(!t){
    let recent=[];try{recent=JSON.parse(localStorage.getItem("vh_recent_searches")||"[]")}catch(_){}
    host.innerHTML=recent.length?'<p class="search-hint">Recent searches</p>'+recent.map(term=>'<button type="button" class="search-chip" onclick="document.getElementById(\'searchInput\').value='+JSON.stringify(term)+';liveSearch('+JSON.stringify(term)+')">'+safe(term)+'</button>').join(""):'<p class="search-hint">Search by title, actor, director, genre, language, year or content type.</p>';
    return;
  }
  let recent=[];try{recent=JSON.parse(localStorage.getItem("vh_recent_searches")||"[]")}catch(_){}
  if(!recent.includes(t)){recent.unshift(t);try{localStorage.setItem("vh_recent_searches",JSON.stringify(recent.slice(0,8)))}catch(_){}}
  const fields=m=>[m.title,m.genre,m.cast,m.director,m.industry,m.language,m.year,m.type,m.rating,m.description].join(" ").toLowerCase();
  const matches=data.filter(m=>fields(m).includes(t));
  host.innerHTML='<p class="search-hint">'+matches.length+' result(s)</p>'+(matches.map(m=>'<button class="search-result" onclick="toggleSearch();openMovie(\''+safe(m.id)+'\')"><img src="'+safe(m.poster)+'" alt="" loading="lazy"><span>'+safe(m.title)+'<small>'+safe([m.year,m.type,m.genre,m.language,m.director].filter(Boolean).join(" · "))+'</small></span></button>').join("")||'<div class="empty-state"><h3>No matching titles</h3><p>Try a different actor, director, genre, language or year.</p></div>');
};
window.toggleMenu=()=> $("navLinks")?.classList.toggle("open");
window.submitRequest=e=>{e.preventDefault();const r={title:$("reqTitle").value.trim(),type:$("reqType").value,year:$("reqYear").value,language:$("reqLang").value,notes:$("reqNotes").value,date:new Date().toLocaleDateString()};let a=getList("vh_requests");a.unshift(r);setList("vh_requests",a);$("reqTitle").value="";$("reqNotes").value="";renderRequests();toast("Saved on this device. Backend setup is needed for team review.")};
function renderRequests(){const a=getList("vh_requests");if($("requestsList"))$("requestsList").innerHTML=a.length?a.slice(0,8).map(x=>`<div class="request-item"><b>${safe(x.title)}</b><small>${safe(x.type)} · ${safe(x.date)}</small></div>`).join(""):"<p>No requests yet.</p>";if($("statRequests"))$("statRequests").textContent=a.length}
window.loginGuest=()=>toast("Guest browsing is available.");
window.togglePassword=id=>{
  const x=$(id);
  if(x)x.type=x.type==="password"?"text":"password";
};

window.adminTab=(tab,el)=>{
  document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));
  $("tab-"+tab)?.classList.add("active");
  el?.parentElement?.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===el));
};

["addMovie","importFromDrive","updateAdminCredentials","addSubAdmin","addCategory","addSong","saveWebsiteSettings"].forEach(fn=>window[fn]=e=>{
  e?.preventDefault?.();
  toast("Publishing requires a secure backend and verified content rights.");
});

window.filterManageList=()=>{};
window.filterUsersList=()=>{};


function initTheme(){
  let theme="dark";
  try{theme=localStorage.getItem("vh_theme")==="light"?"light":"dark"}catch(_){}
  document.documentElement.dataset.theme=theme;
  const host=document.querySelector(".nav-actions");
  if(!host||$("vhThemeToggle"))return;
  const button=document.createElement("button");
  button.type="button";button.id="vhThemeToggle";button.className="vh-theme-toggle";
  button.setAttribute("aria-label","Switch colour theme");
  const paint=()=>{const light=document.documentElement.dataset.theme==="light";button.innerHTML=light?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';button.title=light?"Switch to dark theme":"Switch to light theme";};
  button.addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="light"?"dark":"light";document.documentElement.dataset.theme=next;try{localStorage.setItem("vh_theme",next)}catch(_){}paint();});
  host.appendChild(button);paint();
}

document.addEventListener("DOMContentLoaded",()=>{
  initTheme();
  render();
  loadCloudWatchlist();
  window.VH_SUPABASE?.auth.onAuthStateChange((_event,session)=>{if(session?.user)loadCloudWatchlist();});
  renderRequests();
  document.addEventListener("keydown",e=>{
    if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){
      e.preventDefault();
      toggleSearch();
    }
    if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="a"){e.preventDefault();window.openHiddenAdminLogin()}
    if(e.key==="Escape"){
      closeModal();
      closePlayer();
      closeDownloadModal();
    }
  });
});
})();
