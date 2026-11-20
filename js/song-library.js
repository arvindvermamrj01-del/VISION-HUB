/* Public music library. Audio links are supplied and managed by Vision Hub admins. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,$=id=>document.getElementById(id);
  let songs=[],loading=false;
  const httpsUrl=value=>{try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:"";}catch(_){return "";}};
  function render(){
    const host=$("songsLibraryGrid");if(!host)return;
    const query=String($("songLibrarySearch")?.value||"").trim().toLowerCase();
    const rows=songs.filter(song=>[song.title,song.artist].join(" ").toLowerCase().includes(query));
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
      const audio=document.createElement("audio");audio.controls=true;audio.preload="none";audio.src=httpsUrl(song.audio_url);audio.setAttribute("aria-label","Play "+song.title);
      audio.addEventListener("play",()=>document.querySelectorAll(".song-card audio").forEach(other=>{if(other!==audio)other.pause();}));
      body.append(title,artist,audio);card.append(cover,body);host.appendChild(card);
    });
  }
  async function load(){
    const host=$("songsLibraryGrid");if(!host||!db||loading)return;
    loading=true;
    try{
      const {data,error}=await db.from("vh_songs").select("id,title,artist,audio_url,poster_url,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(100);
      if(error)throw error;
      songs=(data||[]).filter(song=>httpsUrl(song.audio_url));
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
