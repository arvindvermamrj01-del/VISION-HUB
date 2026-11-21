/* Public music library. Audio links are supplied and managed by Vision Hub admins. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,$=id=>document.getElementById(id);
  let songs=[],loading=false;
  const httpsUrl=value=>{try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:"";}catch(_){return "";}};
  function render(){
    const host=$("songsLibraryGrid");if(!host)return;
    const query=String($("songLibrarySearch")?.value||"").trim().toLowerCase();
    const rows=songs.filter(song=>[song.title,song.artist,song.description,song.genre].join(" ").toLowerCase().includes(query));
    host.replaceChildren();
    if(!rows.length){
      const empty=document.createElement("div");empty.className="empty-state";
      const heading=document.createElement("h3");heading.textContent=query?"No matching songs":"No songs published yet";
      const note=document.createElement("p");note.textContent=query?"Try another title or artist.":"New music added by the Vision Hub team will appear here.";
      empty.append(heading,note);host.appendChild(empty);return;
    }
    rows.forEach(song=>{
      const card=document.createElement("article");card.className="song-card";
      const cover=document.createElement("div");cover.className="song-cover";
      const poster=httpsUrl(song.poster_url);
      if(poster){const img=document.createElement("img");img.src=poster;img.alt=song.title+" cover";img.loading="lazy";img.onerror=()=>{img.remove();cover.textContent="♫";};cover.appendChild(img);}
      else cover.textContent="♫";
      const body=document.createElement("div");body.className="song-card-body";
      const title=document.createElement("h3");title.textContent=song.title;
      const artist=document.createElement("p");artist.className="song-artist";artist.textContent=song.artist||"Vision Hub Music";
      const description=document.createElement("p");description.className="song-description";description.textContent=song.description||"";
      const audio=document.createElement("audio");audio.controls=true;audio.preload="metadata";audio.src=httpsUrl(song.playable_url||song.audio_url);audio.setAttribute("aria-label","Play "+song.title);
      const duration=document.createElement("small");duration.className="song-duration";duration.textContent="Loading duration…";
      audio.addEventListener("loadedmetadata",()=>{const seconds=Number(audio.duration);if(Number.isFinite(seconds)&&seconds>0){const mins=Math.floor(seconds/60),secs=Math.floor(seconds%60);duration.textContent="Duration · "+mins+":"+String(secs).padStart(2,"0");}else duration.textContent="Duration unavailable";},{once:true});
      audio.addEventListener("error",()=>{duration.textContent="Audio source could not be loaded. Check the source link.";duration.classList.add("is-error");});
      audio.addEventListener("play",()=>document.querySelectorAll(".song-card audio").forEach(other=>{if(other!==audio)other.pause();}));
      body.append(title,artist);
      if(description.textContent)body.appendChild(description);
      body.appendChild(duration);
      body.appendChild(audio);
      const credits=document.createElement("div");credits.className="song-license";
      if(song.genre){const genre=document.createElement("span");genre.textContent=song.genre;credits.appendChild(genre);}
      if(song.license_name){const license=document.createElement("span");license.textContent=song.license_name+(song.license_credit?" · "+song.license_credit:"");credits.appendChild(license);}
      const links=document.createElement("div");links.className="song-source-links";
      const sourceUrl=httpsUrl(song.source_url),licenseUrl=httpsUrl(song.license_url);
      if(sourceUrl){const link=document.createElement("a");link.href=sourceUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Source / track details";links.appendChild(link);}
      if(licenseUrl){const link=document.createElement("a");link.href=licenseUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="License terms";links.appendChild(link);}
      if(links.childElementCount)credits.appendChild(links);
      if(credits.childElementCount)body.appendChild(credits);
      card.append(cover,body);host.appendChild(card);
    });
  }
  async function load(){
    const host=$("songsLibraryGrid");if(!host||!db||loading)return;
    loading=true;
    try{
      let {data,error}=await db.from("vh_songs").select("id,title,artist,audio_url,poster_url,storage_provider,storage_path,description,source_url,license_name,license_url,license_credit,genre,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(40);
      if(error&&/storage_provider|storage_path|column/i.test(error.message||"")){
        const legacy=await db.from("vh_songs").select("id,title,artist,audio_url,poster_url,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(40);
        data=legacy.data;error=legacy.error;
        if(error)throw error;
        songs=(data||[]).filter(song=>httpsUrl(song.audio_url)).map(song=>({...song,playable_url:song.audio_url}));
        render();return;
      }
      if(error)throw error;
      songs=(await Promise.all((data||[]).map(async song=>{
        const provider=String(song.storage_provider||"direct").toLowerCase();
        if(song.storage_path&&["supabase","cloudflare_r2","backblaze_b2"].includes(provider)){
          try{
            const response=await fetch("/api/song/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({songId:song.id,storagePath:song.storage_path,provider})});
            const result=await response.json().catch(()=>({}));
            if(response.ok&&httpsUrl(result.url))return {...song,playable_url:result.url};
            return null;
          }catch(_){return null;}
        }
        const direct=httpsUrl(song.audio_url);
        return direct?{...song,playable_url:direct}:null;
      }))).filter(Boolean);
      render();
    }catch(error){
      host.textContent=error.message||"Music library is unavailable. Apply the latest Supabase setup SQL.";
    }finally{loading=false;}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $("songLibrarySearch")?.addEventListener("input",render);
    load();
    const page=$("page-songs");
    if(page)new MutationObserver(()=>{if(page.classList.contains("active"))load();}).observe(page,{attributes:true,attributeFilter:["class"]});
  });
  window.refreshSongLibrary=load;
  window.addEventListener("visionhub:songs-updated",load);
})();
