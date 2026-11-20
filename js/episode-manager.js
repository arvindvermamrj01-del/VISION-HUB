/* Admin season/episode publishing and series detail episode browser. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,$=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=message=>typeof window.toast==="function"?window.toast(message):window.alert(message);
  const staffRoles=["admin","sub_admin","content_editor"];
  const validUrl=value=>{if(!value)return null;let u;try{u=new URL(value);}catch(_){throw new Error("Episode URL valid nahi hai.");}if(!["http:","https:"].includes(u.protocol))throw new Error("Only HTTP/HTTPS video URLs are allowed.");return u.href;};
  async function requireStaff(){
    const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Admin login required.");
    const {data:profile,error:pError}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(pError)throw pError;if(!staffRoles.includes(profile?.role))throw new Error("Episode management permission required.");return user;
  }
  async function uploadEpisodeFile(file,user,provider){
    if(!file.type.startsWith("video/"))throw new Error("Select a valid video file.");
    if(file.size>5*1024*1024*1024)throw new Error("Episode file exceeds the 5 GB single-upload limit.");
    if(provider==="backblaze_b2"||provider==="cloudflare_r2"){
      const {data:{session}}=await db.auth.getSession();if(!session?.access_token)throw new Error("Admin session expired.");
      const response=await fetch("/api/media/upload-url",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({contentType:file.type,fileName:file.name,fileSize:file.size,provider})});
      const signed=await response.json().catch(()=>({}));if(!response.ok||!signed.uploadUrl)throw new Error(signed.error||"Cloud upload URL unavailable.");
      const uploaded=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers||{"Content-Type":file.type},body:file});
      if(!uploaded.ok)throw new Error("Cloud upload failed: HTTP "+uploaded.status);
      return {path:signed.key,provider};
    }
    if(provider==="supabase"){
      const path=user.id+"/"+crypto.randomUUID()+"-"+file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100);
      const {error}=await db.storage.from("vh-private-media").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
      if(error)throw error;return {path,provider};
    }
    throw new Error("File upload supports B2, R2 or Supabase. For other providers use an authorised direct URL.");
  }
  async function cleanupUploaded(path,provider){
    try{
      const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return;
      await fetch("/api/media/delete",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({storagePath:path,provider})});
    }catch(error){console.warn("Episode upload cleanup failed:",error.message);}
  }
  async function loadSeriesOptions(){
    const select=$("episodeSeriesId");if(!select||!db)return;
    const previous=select.value;
    try{
      const {data,error}=await db.from("vh_content").select("id,title").eq("content_type","Web Series").eq("published",true).order("title");
      if(error)throw error;
      select.innerHTML='<option value="">Select a Web Series</option>'+(data||[]).map(item=>'<option value="'+Number(item.id)+'">'+esc(item.title)+'</option>').join("");
      if((data||[]).some(item=>String(item.id)===previous))select.value=previous;
      if(select.value)loadEpisodeList(select.value);
    }catch(error){select.innerHTML='<option value="">Series list unavailable</option>';console.warn("Series list unavailable:",error.message);}
  }
  async function loadEpisodeList(seriesId){
    const host=$("episodeManageList");if(!host||!db)return;
    if(!seriesId){host.textContent="Choose a series to view its episodes.";return;}
    try{
      const {data,error}=await db.from("vh_content").select("id,title,season_number,episode_number,duration,created_at").eq("content_type","Episode").eq("parent_series_id",seriesId).eq("published",true).order("season_number").order("episode_number");
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(item=>'<article class="manage-item"><div><strong>S'+String(item.season_number).padStart(2,"0")+' · E'+String(item.episode_number).padStart(2,"0")+' — '+esc(item.title)+'</strong><small>'+esc(item.duration||"Duration not set")+'</small></div><div class="manage-actions"><button type="button" class="btn-primary" onclick="playEpisode('+Number(item.id)+')">Watch</button><button type="button" class="btn-delete" onclick="deletePublishedContent('+Number(item.id)+')">Delete</button></div></article>').join(""):"<p>No episodes have been published for this series yet.</p>";
    }catch(error){host.textContent=error.message||"Episode list could not be loaded.";}
  }
  window.publishEpisode=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget,button=form?.querySelector('[type="submit"]'),status=$("episodePublishStatus");
    if(button)button.disabled=true;if(status)status.textContent="Publishing episode…";
    let uploaded=null,createdId=null;
    try{
      const user=await requireStaff();
      const seriesId=Number($("episodeSeriesId")?.value),season=Number($("episodeSeasonNumber")?.value),episode=Number($("episodeNumber")?.value);
      const title=$("episodeTitle")?.value.trim()||"",provider=$("episodeStorageProvider")?.value||"backblaze_b2";
      const file=$("episodeVideoFile")?.files?.[0]||null,rawUrl=$("episodeVideoUrl")?.value.trim()||"";
      const series=(window.VISION_HUB_DATA||[]).find(item=>String(item.id)===String(seriesId)&&item.type==="Web Series");
      if(!seriesId||!series)throw new Error("Select a published Web Series.");
      if(!Number.isInteger(season)||season<1||season>100||!Number.isInteger(episode)||episode<1||episode>500)throw new Error("Season and episode numbers must be valid.");
      if(!title)throw new Error("Episode title is required.");
      if(!file&&!rawUrl)throw new Error("Upload an episode video or enter an authorised video URL.");
      if(file&&rawUrl)throw new Error("Choose either a video file or a URL, not both.");
      let videoUrl,storageProvider=provider,storagePath;
      if(file){
        uploaded=await uploadEpisodeFile(file,user,provider);storagePath=uploaded.path;videoUrl="private://"+storagePath;storageProvider=provider;
      }else{
        videoUrl=validUrl(rawUrl);storagePath=videoUrl;storageProvider=provider;
      }
      const row={
        title,content_type:"Episode",parent_series_id:seriesId,season_number:season,episode_number:episode,
        video_url:videoUrl,storage_provider:storageProvider,published:true,created_by:user.id,
        release_year:Number($("episodeReleaseYear")?.value)||series.year||null,
        duration:$("episodeDuration")?.value.trim()||"",
        description:$("episodeDescription")?.value.trim()||"",
        poster_url:validUrl($("episodePoster")?.value.trim()||"")||series.poster||null,
        genre:series.genre||"Drama",language:series.language||"",industry:series.industry||"All"
      };
      const {data:created,error}=await db.from("vh_content").insert(row).select("id").single();
      if(error)throw error;createdId=created.id;
      const {error:assetError}=await db.from("vh_media_assets").insert({
        content_id:created.id,asset_type:"video",asset_url:videoUrl,storage_path:storagePath,
        storage_provider:storageProvider,resolution:null,is_primary:true,language:series.language||""
      });
      if(assetError)throw assetError;
      form?.reset();$("episodeSeasonNumber").value="1";
      if(status)status.textContent="Episode published successfully.";
      toast("Episode published successfully.");
      await loadEpisodeList(seriesId);
      document.dispatchEvent(new CustomEvent("visionhub:content-loaded"));
      window.renderVisionHub?.();
    }catch(error){
      if(createdId)await db.from("vh_content").delete().eq("id",createdId);
      if(uploaded?.path)await cleanupUploaded(uploaded.path,uploaded.provider);
      if(status)status.textContent=error.message||"Episode could not be published.";
      toast(error.message||"Episode publish failed.");
    }finally{if(button)button.disabled=false;}
  };
  window.playEpisode=id=>{
    window.openMovie?.(id);
    window.playMovie?.();
  };
  function renderSeriesEpisodes(series){
    const panel=$("seriesEpisodesPanel"),host=$("seriesEpisodesList");
    if(!panel||!host)return;
    if(!series||series.type!=="Web Series"){panel.classList.add("hidden");host.textContent="";return;}
    const episodes=(window.VISION_HUB_DATA||[]).filter(item=>item.type==="Episode"&&String(item.parent_series_id)===String(series.id)).sort((a,b)=>(Number(a.season_number)-Number(b.season_number))||(Number(a.episode_number)-Number(b.episode_number)));
    if(!episodes.length){panel.classList.remove("hidden");host.innerHTML="<p>Episodes will appear here as soon as this series is updated by the team.</p>";return;}
    const groups=new Map();episodes.forEach(item=>{const key=Number(item.season_number)||1;const list=groups.get(key)||[];list.push(item);groups.set(key,list);});
    host.innerHTML=[...groups.entries()].map(([season,items])=>'<section class="vh-season-group"><h4>Season '+season+'</h4><div class="vh-episode-list">'+items.map(item=>'<article class="vh-episode-row"><div><strong>E'+String(item.episode_number).padStart(2,"0")+' · '+esc(item.title)+'</strong><small>'+esc(item.duration||"Episode")+(item.year?" · "+esc(item.year):"")+'</small><p>'+esc(item.description||"")+'</p></div><button type="button" class="btn-play" onclick="playEpisode('+Number(item.id)+')"><i class="fas fa-play"></i> Watch</button></article>').join("")+'</div></section>').join("");
    panel.classList.remove("hidden");
  }
  const baseOpen=window.openMovie;
  if(typeof baseOpen==="function"){
    window.openMovie=function(id){const result=baseOpen.apply(this,arguments);const item=(window.VISION_HUB_DATA||[]).find(entry=>String(entry.id)===String(id));renderSeriesEpisodes(item);return result;};
  }
  document.addEventListener("DOMContentLoaded",()=>{
    loadSeriesOptions();
    $("episodeSeriesId")?.addEventListener("change",event=>loadEpisodeList(event.target.value));
    document.addEventListener("visionhub:content-loaded",loadSeriesOptions);
  });
})();
