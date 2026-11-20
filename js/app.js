/* Vision Hub storefront interactions. Supabase is the account database; localStorage is a guest/device cache only. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), data=window.VISION_HUB_DATA||[];
let industry="All",genre="All",movieGenre="All",movieYear="All",movieLanguage="All",movieSort="newest",seriesGenre="All",seriesYear="All",seriesLanguage="All",seriesSort="newest",heroIndex=0,current=null,catalogCategories=[];
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getList=k=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
const setList=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const watchlistStorageKey=userId=>window.VH_ACCOUNT_DATA?.watchlistKey(userId)||"vh_watchlist";
const getWatchlist=(userId=window.VH_USER_ID)=>window.VH_ACCOUNT_DATA?.readWatchlist(userId)??getList(watchlistStorageKey(userId));
const saveWatchlist=(items,userId=window.VH_USER_ID)=>window.VH_ACCOUNT_DATA?.writeWatchlist(items,userId)??setList(watchlistStorageKey(userId),items);
const progressStorageKey=(id,userId=window.VH_USER_ID)=>window.VH_ACCOUNT_DATA?.progressKey(id,userId)||"vh_progress_"+String(id);
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2800)}
function card(m){
const poster=m.poster?'<img loading="lazy" src="'+safe(m.poster)+'" alt="'+safe(m.title)+' poster" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'poster-empty\',textContent:\'Poster unavailable\'}))">':'<div class="poster-empty">Poster unavailable</div>';
const meta=[m.year,m.genre,m.rating?'★ '+m.rating:'',m.view_count?'🔥 '+Number(m.view_count).toLocaleString('en-IN')+' views':''].filter(Boolean).join(' · ');
return '<article class="movie-card"><button class="poster-button" onclick="openMovie(&quot;'+safe(m.id)+'&quot;)" aria-label="View '+safe(m.title)+'">'+poster+'<span class="poster-play"><i class="fas fa-play"></i></span></button><div class="movie-info"><h3>'+safe(m.title)+'</h3><p>'+safe(meta)+'</p><div class="card-actions"><button onclick="openMovie(&quot;'+safe(m.id)+'&quot;)">Details</button><button onclick="toggleItem(&quot;'+safe(m.id)+'&quot;)" aria-label="Add to watchlist">♡</button></div></div></article>';
}
function grid(id,items){const el=$(id);if(el)el.innerHTML=items.length?items.map(card).join(""):'<div class="empty-state"><h3>No titles found</h3><p>Try another filter or search.</p></div>'}
function hero(){const featured=data.filter(item=>item.is_featured&&item.type!=="Short"&&item.type!=="Episode"),catalog=data.filter(item=>item.type!=="Episode"),pool=featured.length?featured:catalog;const m=pool[heroIndex%pool.length];if(!m)return;current=m;if($("heroBg"))$("heroBg").style.backgroundImage=(m.backdrop||m.poster)?`url("${m.backdrop||m.poster}")`:"none";if($("heroTitle"))$("heroTitle").textContent=m.title;if($("heroDesc"))$("heroDesc").textContent=m.description;if($("heroMeta"))$("heroMeta").textContent=`${m.year} · ${m.duration} · ★ ${m.rating}`;if($("heroPlayBtn"))$("heroPlayBtn").onclick=()=>openMovie(m.id);if($("heroListBtn"))$("heroListBtn").onclick=()=>toggleItem(m.id)}
function fillCatalogSelect(id,values,allLabel){
 const select=$(id);if(!select)return;
 const current=select.value||"All";
 select.innerHTML='<option value="All">'+safe(allLabel)+'</option>'+values.map(value=>'<option value="'+safe(value)+'">'+safe(value)+'</option>').join("");
 select.value=values.includes(current)?current:"All";
}
function populateCatalogFilters(){
 const items=data.filter(item=>item.type!=="Episode"&&item.type!=="Short");
 const years=[...new Set(items.map(item=>String(item.year||"").trim()).filter(value=>/^\d{4}$/.test(value)))].sort((a,b)=>Number(b)-Number(a));
 const languages=[...new Set(items.flatMap(item=>String(item.language||"").split(/[,/]+/).map(value=>value.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
 fillCatalogSelect("movieYearFilter",years,"All years");
 fillCatalogSelect("seriesYearFilter",years,"All years");
 fillCatalogSelect("movieLanguageFilter",languages,"All languages");
 fillCatalogSelect("seriesLanguageFilter",languages,"All languages");
}
function sortCatalog(items,sort){
 const list=[...items];
 if(sort==="rating")return list.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)||String(a.title).localeCompare(String(b.title)));
 if(sort==="popular")return list.sort((a,b)=>Number(b.view_count||0)-Number(a.view_count||0)||Number(b.rating||0)-Number(a.rating||0));
 if(sort==="title")return list.sort((a,b)=>String(a.title).localeCompare(String(b.title)));
 return list.sort((a,b)=>(new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime())||Number(b.year||0)-Number(a.year||0)||String(a.title).localeCompare(String(b.title)));
}
async function loadPopularContent(){
 const section=$("popularContentSection"),host=$("popularGrid"),db=window.VH_SUPABASE;
 if(!section||!host||!db)return;
 try{
  const {data:ranked,error}=await db.rpc("vh_get_popular_content",{p_limit:6});
  if(error)throw error;
  const items=(ranked||[]).map(row=>{const item=data.find(item=>item.isSupabaseContent&&Number(item.id)===Number(row.content_id));if(item)item.view_count=Number(row.view_count)||0;return item||null;}).filter(Boolean);
  if(!items.length){section.classList.add("hidden");return;}
  grid("popularGrid",items);
  section.classList.remove("hidden");
  render();
 }catch(error){
  section.classList.add("hidden");
  console.debug("Popular content rail unavailable:",error.message);
 }
}
function getCategoryNames(){
 const fromContent=[...new Set(data.filter(item=>item.type!=="Episode"&&item.type!=="Short").map(item=>String(item.genre||"").trim()).filter(name=>name&&name!=="Uncategorised"&&name.toLowerCase()!=="all"))];
 return catalogCategories.length?catalogCategories:fromContent.sort((a,b)=>a.localeCompare(b));
}
function renderCategoryButtons(hostId,selected,allLabel,onChoose){
 const host=$(hostId);if(!host)return;
 host.replaceChildren();
 const names=[allLabel,...getCategoryNames()];
 names.forEach((name,index)=>{
  const value=index===0?"All":name;
  const button=document.createElement("button");
  button.type="button";button.className="filter-btn"+(selected===value?" active":"");
  button.textContent=index===0?allLabel:name;
  button.addEventListener("click",()=>onChoose(value));
  host.appendChild(button);
 });
}
async function loadPublicCategories(){
 const db=window.VH_SUPABASE;if(!db)return;
 try{
  const {data:rows,error}=await db.from("vh_categories").select("name").eq("is_active",true).order("name");
  if(error)throw error;
  catalogCategories=[...new Set((rows||[]).map(row=>String(row.name||"").trim()).filter(name=>name&&name.toLowerCase()!=="all"))];
  render();
 }catch(error){console.debug("Public categories unavailable:",error.message);}
}
function render(){
const f=data.filter(m=>(industry==="All"||m.industry===industry)&&(genre==="All"||m.genre===genre));
grid("trendingGrid",f.filter(x=>x.type==="Movie").slice(0,6));
grid("seriesGrid",data.filter(x=>x.type==="Web Series"));
grid("newGrid",[...data].filter(x=>x.type!=="Episode").sort((a,b)=>(new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime())||Number(b.year||0)-Number(a.year||0)).slice(0,6));
grid("topRatedGrid",[...data].filter(x=>x.type!=="Episode"&&x.rating!==""&&x.rating!=null).sort((a,b)=>Number(b.rating)-Number(a.rating)).slice(0,6));
let progressItems=[];try{progressItems=data.filter(item=>Number(localStorage.getItem(progressStorageKey(item.id))||0)>5).sort((a,b)=>Number(localStorage.getItem(progressStorageKey(b.id))||0)-Number(localStorage.getItem(progressStorageKey(a.id))||0)).slice(0,6);}catch(_){}
grid("continueWatchingGrid",progressItems);$("continueWatchingSection")?.classList.toggle("hidden",!progressItems.length);
grid("homeShortsGrid",data.filter(x=>x.type==="Short"&&x.is_featured===true).slice(0,6));
populateCatalogFilters();
const movies=data.filter(x=>x.type==="Movie"&&(movieGenre==="All"||x.genre===movieGenre)&&(movieYear==="All"||String(x.year)===movieYear)&&(movieLanguage==="All"||String(x.language||"").toLowerCase().split(/[,/]+/).map(v=>v.trim()).includes(movieLanguage.toLowerCase())));
grid("allMoviesGrid",sortCatalog(movies,movieSort));
const series=data.filter(x=>x.type==="Web Series"&&(seriesGenre==="All"||x.genre===seriesGenre)&&(seriesYear==="All"||String(x.year)===seriesYear)&&(seriesLanguage==="All"||String(x.language||"").toLowerCase().split(/[,/]+/).map(v=>v.trim()).includes(seriesLanguage.toLowerCase())));
grid("allSeriesGrid",sortCatalog(series,seriesSort));
grid("shortsGrid",data.filter(x=>x.type==="Short"));
renderCategoryButtons("movieGenreFilters",movieGenre,"All",value=>window.filterMoviesPage(value));
renderCategoryButtons("seriesGenreFilters",seriesGenre,"All genres",value=>window.filterSeriesGenre(value));
const genreHost=$("popularGenreLinks");
if(genreHost){
 const counts=new Map();data.filter(item=>item.type!=="Episode"&&item.type!=="Short").forEach(item=>{if(item.genre&&item.genre!=="Uncategorised")counts.set(item.genre,(counts.get(item.genre)||0)+1)});
 genreHost.replaceChildren();
 [...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([name,count])=>{
  const button=document.createElement("button");button.type="button";button.className="filter-btn";button.textContent=name+" · "+count;
  button.addEventListener("click",()=>window.filterByGenre(name));genreHost.appendChild(button);
 });
 if(!counts.size){const empty=document.createElement("p");empty.textContent="Genres will appear as the catalog grows.";genreHost.appendChild(empty);}
}
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
const pageTitles={home:"Vision Hub | Movies, Web Series & Shorts",movies:"All Movies | Vision Hub",series:"Web Series | Vision Hub",shorts:"Shorts | Vision Hub",songs:"Songs & Music | Vision Hub",watchlist:"My Watchlist | Vision Hub",request:"Request Content | Vision Hub",community:"Community | Vision Hub",privacy:"Privacy Policy | Vision Hub",terms:"Terms of Use | Vision Hub",copyright:"Copyright Policy | Vision Hub",profile:"My Account | Vision Hub",login:"Sign In | Vision Hub",register:"Create Account | Vision Hub","reset-password":"Reset Password | Vision Hub","admin-login":"Admin Login | Vision Hub",admin:"Control Center | Vision Hub"};
 const pageDescriptions={home:"Discover authorised movies, web series and shorts on Vision Hub.",movies:"Browse the Vision Hub movie catalog by genre, language and year.",series:"Explore web series available in the Vision Hub catalog.",shorts:"Watch short-form videos published on Vision Hub.",songs:"Listen to authorised music on Vision Hub.",watchlist:"Your saved Vision Hub watchlist.",request:"Send a movie or series request to the Vision Hub team.",community:"Share suggestions, report bugs and vote on the Vision Hub roadmap.",privacy:"Learn how Vision Hub handles account, usage, storage and donation information.",terms:"Terms for using Vision Hub accounts, media and community features.",copyright:"Vision Hub content ownership, licensing and copyright complaint policy.",profile:"Manage your Vision Hub profile, password, watchlist and requests.",login:"Sign in to sync your watchlist and playback progress.",register:"Create a Vision Hub account to sync your watchlist and viewing progress.","reset-password":"Set a new password for your Vision Hub account.","admin-login":"Restricted Vision Hub staff sign in.",admin:"Vision Hub Control Center."};
 document.title=pageTitles[name]||"Vision Hub";
 const metaDescription=document.querySelector('meta[name="description"]');
 if(metaDescription)metaDescription.content=pageDescriptions[name]||pageDescriptions.home;
 const ogTitle=document.querySelector('meta[property="og:title"]');
 const ogDescription=document.querySelector('meta[property="og:description"]');
 if(ogTitle)ogTitle.content=pageTitles[name]||pageTitles.home;
 if(ogDescription)ogDescription.content=pageDescriptions[name]||pageDescriptions.home;
 window.scrollTo({top:0,behavior:"smooth"});
if(name==="watchlist")renderWatchlist();
 document.dispatchEvent(new CustomEvent("visionhub:page-changed",{detail:{name}}));
};
window.openHiddenAdminLogin=()=>window.showPage("admin-login");
const publicPageHashes=new Set(["home","movies","series","shorts","songs","watchlist","request","community","privacy","terms","copyright","profile","login","register","reset-password","admin-login","admin"]);
window.addEventListener("hashchange",()=>{
  const target=location.hash.replace(/^#/,"");
  if(target==="control-center")window.openHiddenAdminLogin();
  else if(publicPageHashes.has(target))window.showPage(target);
});
const initialHash=location.hash.replace(/^#/,"");
if(initialHash==="control-center"||location.pathname.replace(/\/+$/,"")==="/control-center")window.openHiddenAdminLogin();
else if(publicPageHashes.has(initialHash))window.showPage(initialHash);
window.filterByIndustry=(v,el)=>{industry=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterByGenre=(v,el)=>{genre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterMoviesPage=(v,el)=>{movieGenre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterMovieYear=value=>{movieYear=value||"All";render()};
window.filterMovieLanguage=value=>{movieLanguage=value||"All";render()};
window.sortMoviesPage=value=>{movieSort=value||"newest";render()};
window.filterSeriesGenre=(value,el)=>{seriesGenre=value||"All";el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterSeriesYear=value=>{seriesYear=value||"All";render()};
window.filterSeriesLanguage=value=>{seriesLanguage=value||"All";render()};
window.sortSeriesPage=value=>{seriesSort=value||"newest";render()};
window.toggleItem=async id=>{
  const db=window.VH_SUPABASE;
  let user=null;
  try{const result=await db?.auth.getUser();user=result?.data?.user||null;}catch(_){}
  const userId=user?.id||null;
  if(userId)window.VH_ACCOUNT_DATA?.migrateLegacy(userId);
  let a=getWatchlist(userId).map(String),key=String(id),adding=!a.includes(key);
  a=adding?[...a,key]:a.filter(x=>x!==key);
  saveWatchlist(a,userId);
  renderWatchlist();
  try{
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
  const db=window.VH_SUPABASE;if(!db){renderWatchlist();return;}
  try{
    const {data:{user}}=await db.auth.getUser();
    if(!user){renderWatchlist();return;}
    window.VH_USER_ID=user.id;
    window.VH_ACCOUNT_DATA?.migrateLegacy(user.id);
    const {data:rows,error}=await db.from("vh_user_watchlist").select("content_id").eq("user_id",user.id);
    if(error)throw error;
    const cloudIds=(rows||[]).map(row=>String(row.content_id));
    const localIds=getWatchlist(user.id).map(String);
    const merged=[...new Set([...cloudIds,...localIds])];
    saveWatchlist(merged,user.id);
    const missing=localIds.filter(id=>!cloudIds.includes(id));
    if(missing.length){
      const {error:syncError}=await db.from("vh_user_watchlist").upsert(missing.map(content_id=>({user_id:user.id,content_id})),{onConflict:"user_id,content_id"});
      if(syncError)console.warn("Local watchlist items could not be merged:",syncError.message);
    }
    renderWatchlist();
  }catch(error){console.warn("Cloud watchlist load unavailable:",error.message);renderWatchlist();}
}
function renderWatchlist(){const ids=getWatchlist().map(String),a=data.filter(x=>ids.includes(String(x.id)));grid("watchlistGrid",a);grid("profileWatchlistGrid",a);$("watchlistEmpty")?.classList.toggle("hidden",a.length>0);if($("statWatchlist"))$("statWatchlist").textContent=a.length}
window.openMovie=id=>{const m=data.find(x=>String(x.id)===String(id));if(!m)return;current=m;document.title=m.title+" ("+(m.year||"")+") | Vision Hub";const description=document.querySelector('meta[name="description"]');if(description)description.content=String(m.description||("Discover "+m.title+" on Vision Hub.")).slice(0,300);const ogTitle=document.querySelector('meta[property="og:title"]');if(ogTitle)ogTitle.content=m.title+" | Vision Hub";const ogDescription=document.querySelector('meta[property="og:description"]');if(ogDescription)ogDescription.content=String(m.description||("Discover "+m.title+" on Vision Hub.")).slice(0,300);if($("modalTitle"))$("modalTitle").textContent=m.title;if($("modalDesc"))$("modalDesc").textContent=m.description;if($("modalMeta"))$("modalMeta").textContent=`${m.year} · ${m.genre} · ${m.language} · ★ ${m.rating}`;if($("modalPoster")){ $("modalPoster").style.display=m.poster?"":"none"; if(m.poster)$("modalPoster").src=m.poster; else $("modalPoster").removeAttribute("src"); }if($("modalCast"))$("modalCast").textContent=m.cast?"Cast: "+m.cast:"";if($("modalDirector"))$("modalDirector").textContent=m.director?"Director: "+m.director:"";const shots=$("modalScreenshots");if(shots){const list=Array.isArray(m.screenshots)?m.screenshots:String(m.screenshots||"").split(",").map(x=>x.trim()).filter(Boolean);shots.innerHTML=list.length?'<h3>Preview Screenshots</h3><div class="vh-screenshot-grid">'+list.map((url,i)=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+safe(url)+'" alt="'+safe(m.title)+' screenshot '+(i+1)+'"></a>').join("")+'</div>':"";}const trailer=$("trailerEmbed");if(trailer){const raw=String(m.trailer||"");let videoId="";try{const u=new URL(raw);if(u.hostname.includes("youtu.be"))videoId=u.pathname.slice(1);else if(u.hostname.includes("youtube.com"))videoId=u.searchParams.get("v")||u.pathname.split("/").filter(Boolean).pop()||"";}catch(_){}trailer.innerHTML=videoId?'<iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/'+safe(videoId)+'" title="Official trailer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>':""; $("trailerSection")?.classList.toggle("hidden",!videoId);} $("movieModal")?.classList.add("open");if($("modalPlayBtn"))$("modalPlayBtn").onclick=()=>m.trailer?window.open(m.trailer,"_blank","noopener"):toast("Official trailer not available");if($("modalWatchBtn"))$("modalWatchBtn").onclick=()=>toggleItem(id)};
window.closeModal=()=> $("movieModal")?.classList.remove("open");window.closeModalBtn=window.closeModal;window.playMovie=()=>current?.trailer?window.open(current.trailer,"_blank","noopener"):toast("Official trailer unavailable");window.toggleWatchlist=()=>current&&toggleItem(current.id);
window.downloadMovie=()=>toast("Only official trailers and authorised viewing links are supported.");window.openTelegram=()=>{const link=document.querySelector("a.telegram-target-link")?.href||"https://t.me/visionhub_official";window.open(link,"_blank","noopener");};window.triggerDownload=()=>toast("Unverified downloads are disabled. Use an authorised provider.");window.closePlayer=()=>{ $("playerOverlay")?.classList.remove("open");if($("playerIframe"))$("playerIframe").src=""};window.closeDownloadModal=()=> $("downloadModal")?.classList.remove("open");
window.toggleSearch=()=>{const o=$("searchOverlay");o?.classList.toggle("open");if(o?.classList.contains("open"))$("searchInput")?.focus()};
window.liveSearch=q=>{
  const t=String(q||"").trim().toLowerCase(),host=$("searchResults");
  if(!host)return;
  if(!t){
    let recent=[];try{recent=JSON.parse(localStorage.getItem("vh_recent_searches")||"[]")}catch(_){}
    host.innerHTML=recent.length?'<p class="search-hint">Recent searches</p>'+recent.map(term=>'<button type="button" class="search-chip" data-search-term="'+safe(term)+'">'+safe(term)+'</button>').join(""):'<p class="search-hint">Search by title, actor, director, genre, language, year or content type.</p>';
     host.querySelectorAll("[data-search-term]").forEach(button=>button.addEventListener("click",()=>{$("searchInput").value=button.dataset.searchTerm||"";window.liveSearch(button.dataset.searchTerm||"");}));
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
  // The dedicated theme manager owns appearance selection and persistence.
  // Keep the legacy entry point so existing startup flow remains compatible.
  if(typeof window.setVHTheme==="function")return;
}

document.addEventListener("DOMContentLoaded",()=>{
  initTheme();
  render();
  loadPopularContent();
  loadPublicCategories();
  document.addEventListener("visionhub:content-loaded",loadPopularContent);
  document.addEventListener("visionhub:categories-updated",loadPublicCategories);
  loadCloudWatchlist();
  window.VH_SUPABASE?.auth.onAuthStateChange((_event,session)=>{if(session?.user){window.VH_USER_ID=session.user.id;window.VH_ACCOUNT_DATA?.migrateLegacy(session.user.id);loadCloudWatchlist();}else{window.VH_USER_ID=null;renderWatchlist();render();}});
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
