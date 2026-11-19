/* Vision Hub front-end demo. Local storage is not secure authentication or shared storage. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), data=window.VISION_HUB_DATA||[];
let industry="All",genre="All",movieGenre="All",heroIndex=0,current=null;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getList=k=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
const setList=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2800)}
function card(m){return `<article class="movie-card"><button class="poster-button" onclick="openMovie(${m.id})" aria-label="View ${safe(m.title)}"><img loading="lazy" src="${safe(m.poster)}" alt="${safe(m.title)} poster" onerror="this.src='https://placehold.co/400x600/171b2b/ffffff?text=Vision+Hub'"><span class="poster-play"><i class="fas fa-play"></i></span></button><div class="movie-info"><h3>${safe(m.title)}</h3><p>${safe(m.year)} · ${safe(m.genre)} · ★ ${safe(m.rating)}</p><div class="card-actions"><button onclick="openMovie(${m.id})">Details</button><button onclick="toggleItem(${m.id})" aria-label="Add to watchlist">♡</button></div></div></article>`}
function grid(id,items){const el=$(id);if(el)el.innerHTML=items.length?items.map(card).join(""):'<div class="empty-state"><h3>No titles found</h3><p>Try another filter or search.</p></div>'}
function hero(){const m=data[heroIndex%data.length];if(!m)return;current=m;if($("heroBg"))$("heroBg").style.backgroundImage=`url("${m.backdrop||m.poster}")`;if($("heroTitle"))$("heroTitle").textContent=m.title;if($("heroDesc"))$("heroDesc").textContent=m.description;if($("heroMeta"))$("heroMeta").textContent=`${m.year} · ${m.duration} · ★ ${m.rating}`;if($("heroPlayBtn"))$("heroPlayBtn").onclick=()=>openMovie(m.id);if($("heroListBtn"))$("heroListBtn").onclick=()=>toggleItem(m.id)}
function render(){const f=data.filter(m=>(industry==="All"||m.industry===industry)&&(genre==="All"||m.genre===genre));grid("trendingGrid",f.filter(x=>x.type==="Movie").slice(0,6));grid("seriesGrid",data.filter(x=>x.type==="Web Series"));grid("newGrid",[...data].sort((a,b)=>b.year-a.year).slice(0,6));grid("allMoviesGrid",data.filter(x=>x.type==="Movie"&&(movieGenre==="All"||x.genre===movieGenre)));grid("allSeriesGrid",data.filter(x=>x.type==="Web Series"));grid("shortsGrid",data.filter(x=>x.type==="Short"));renderWatchlist();hero()}
window.renderVisionHub=render;
window.showPage=name=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("page-"+name)?.classList.add("active");document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+name));$("navLinks")?.classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});if(name==="watchlist")renderWatchlist()};
window.filterByIndustry=(v,el)=>{industry=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterByGenre=(v,el)=>{genre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.filterMoviesPage=(v,el)=>{movieGenre=v;el?.parentElement?.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===el));render()};
window.toggleItem=id=>{let a=getList("vh_watchlist");a=a.includes(id)?a.filter(x=>x!==id):[...a,id];setList("vh_watchlist",a);renderWatchlist();toast(a.includes(id)?"Added to your watchlist":"Removed from watchlist")};
function renderWatchlist(){const a=data.filter(x=>getList("vh_watchlist").includes(x.id));grid("watchlistGrid",a);$("watchlistEmpty")?.classList.toggle("hidden",a.length>0);if($("statWatchlist"))$("statWatchlist").textContent=a.length}
window.openMovie=id=>{const m=data.find(x=>x.id===id);if(!m)return;current=m;if($("modalTitle"))$("modalTitle").textContent=m.title;if($("modalDesc"))$("modalDesc").textContent=m.description;if($("modalMeta"))$("modalMeta").textContent=`${m.year} · ${m.genre} · ${m.language} · ★ ${m.rating}`;if($("modalPoster"))$("modalPoster").src=m.poster;if($("modalCast"))$("modalCast").textContent="Cast: "+m.cast;$("movieModal")?.classList.add("open");if($("modalPlayBtn"))$("modalPlayBtn").onclick=()=>m.trailer?window.open(m.trailer,"_blank","noopener"):toast("Official trailer not available");if($("modalWatchBtn"))$("modalWatchBtn").onclick=()=>toggleItem(id)};
window.closeModal=()=> $("movieModal")?.classList.remove("open");window.closeModalBtn=window.closeModal;window.playMovie=()=>current?.trailer?window.open(current.trailer,"_blank","noopener"):toast("Official trailer unavailable");window.toggleWatchlist=()=>current&&toggleItem(current.id);
window.downloadMovie=()=>toast("Only official trailers and authorised viewing links are supported.");window.openTelegram=()=>window.open("https://t.me/visionhub_official","_blank","noopener");window.triggerDownload=()=>toast("Unverified downloads are disabled. Use an authorised provider.");window.closePlayer=()=>{ $("playerOverlay")?.classList.remove("open");if($("playerIframe"))$("playerIframe").src=""};window.closeDownloadModal=()=> $("downloadModal")?.classList.remove("open");
window.toggleSearch=()=>{const o=$("searchOverlay");o?.classList.toggle("open");if(o?.classList.contains("open"))$("searchInput")?.focus()};
window.liveSearch=q=>{const t=q.trim().toLowerCase(),a=data.filter(m=>(m.title+" "+m.genre+" "+m.cast+" "+m.industry).toLowerCase().includes(t));if($("searchResults"))$("searchResults").innerHTML=t?(a.map(m=>`<button class="search-result" onclick="toggleSearch();openMovie(${m.id})"><img src="${safe(m.poster)}" alt=""><span>${safe(m.title)}<small>${safe(m.year)} · ${safe(m.type)}</small></span></button>`).join("")||"<p>No results found.</p>"):""};
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

document.addEventListener("DOMContentLoaded",()=>{
  render();
  renderRequests();
  document.addEventListener("keydown",e=>{
    if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){
      e.preventDefault();
      toggleSearch();
    }
    if(e.key==="Escape"){
      closeModal();
      closePlayer();
      closeDownloadModal();
    }
  });
});
})();
