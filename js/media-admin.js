/* Vision Hub media library: authorised direct uploads, alternate renditions and language tracks. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const $ = id => document.getElementById(id);
  const bucket = "vh-private-media";
  const resolutions = ["180p","240p","420p","480p","720p","1080p","2k","4k","8k"];
  const providers = ["supabase","terabox","mega","degoo","google_drive","mediafire","pcloud","box","icedrive","koofr","internxt","telegram"];
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = m => typeof window.toast==="function" ? window.toast(m) : alert(m);
  async function admin() {
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user) throw new Error("Main Admin login required.");
    const {data:profile,error:pErr}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(pErr) throw pErr;
    if(profile?.role!=="admin" || profile?.is_primary_admin === false) throw new Error("Only the primary Admin can manage media.");
    return user;
  }
  function injectPanel() {
    if(!window.VH_IS_ADMIN) return;
    if($("tab-media-library")) return;
    const host=$("tab-manage")?.parentElement;
    if(!host) return;
    const panel=document.createElement("section");
    panel.id="tab-media-library"; panel.className="admin-tab";
    panel.innerHTML=`
      <h2>🎞️ Media Library & Multi-Quality Manager</h2>
      <p style="color:var(--text-muted)">Upload authorised video renditions, audio languages and WebVTT subtitles for an existing catalogue item. Each quality must be supplied as its own encoded file; this panel does not transcode or upscale videos.</p>
      <form id="vhMediaUploadForm" class="admin-form">
        <div class="form-group"><label for="vhMediaContent">Select Movie / Series / Short</label><select id="vhMediaContent" required><option value="">Loading catalogue…</option></select></div>
        <div class="form-row">
          <div class="form-group"><label for="vhMediaType">Media type</label><select id="vhMediaType"><option value="video">Video quality</option><option value="audio">Additional audio language</option><option value="subtitle">Subtitle (WebVTT .vtt)</option></select></div>
          <div class="form-group"><label for="vhMediaResolution">Video resolution</label><select id="vhMediaResolution">${resolutions.map(x=>`<option value="${x}">${x}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="vhMediaLanguage">Language / track label</label><input id="vhMediaLanguage" placeholder="Hindi, English, Tamil…" value="Hindi" required/></div>
          <div class="form-group"><label for="vhMediaLabel">Optional label</label><input id="vhMediaLabel" placeholder="Hindi 5.1 / English subtitles"/></div>
        </div>
        <div class="form-group"><label for="vhMediaFile">Choose media file</label><input id="vhMediaFile" type="file" accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,text/vtt,.vtt" required/><small>Large files are limited by your Supabase plan and the configured bucket cap. Uploads are sent directly to Supabase Storage.</small></div>
        <button type="submit" class="btn-primary">Upload track to media library</button>
        <p id="vhMediaStatus" role="status"></p>
      </form>
      <div class="admin-form" style="margin-top:22px"><h3>Saved tracks</h3><div id="vhMediaAssetsList">Select a title to view tracks.</div></div>`;
    host.appendChild(panel);
    const nav=document.querySelector('.admin-nav');
    if(nav&&!nav.querySelector('[data-vh-media-nav]')){
      const b=document.createElement("button"); b.className="admin-nav-btn"; b.dataset.vhMediaNav="1";
      b.innerHTML='<i class="fas fa-photo-video"></i> Media Library';
      b.addEventListener("click",()=>{ if(typeof window.adminTab==="function") window.adminTab("media-library",b); loadTitles(); });
      nav.insertBefore(b,nav.querySelector('[onclick*="adminLogout"]')||null);
    }
    $("vhMediaType").addEventListener("change",()=>{
      const type=$("vhMediaType").value;
      $("vhMediaResolution").disabled=type!=="video";
      $("vhMediaFile").accept=type==="video"?"video/mp4,video/webm,video/quicktime":type==="audio"?"audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav":"text/vtt,.vtt";
    });
    $("vhMediaContent").addEventListener("change",loadAssets);
    $("vhMediaUploadForm").addEventListener("submit",uploadAsset);
  }
  async function loadTitles(){
    try{
      await admin();
      const {data,error}=await db.from("vh_content").select("id,title,content_type").order("title");
      if(error) throw error;
      const select=$("vhMediaContent"); if(!select)return;
      select.innerHTML='<option value="">Choose content…</option>'+(data||[]).map(x=>`<option value="${Number(x.id)}">${esc(x.title)} · ${esc(x.content_type)}</option>`).join("");
      if(select.value) loadAssets();
    }catch(e){if($("vhMediaStatus"))$("vhMediaStatus").textContent=e.message;}
  }
  async function loadAssets(){
    const id=Number($("vhMediaContent")?.value),host=$("vhMediaAssetsList");
    if(!id||!host){if(host)host.textContent="Select a title to view tracks.";return;}
    try{
      await admin();
      const {data,error}=await db.from("vh_media_assets").select("*").eq("content_id",id).order("asset_type").order("resolution");
      if(error) throw error;
      const rows=data||[];
      host.innerHTML=rows.length?rows.map(x=>`<div class="manage-item" style="display:flex;justify-content:space-between;gap:12px;padding:10px;border-bottom:1px solid var(--border)"><span><strong>${esc(x.asset_type.toUpperCase())} · ${esc(x.resolution||x.language||"")}</strong><small style="display:block">${esc(x.language||"")} · ${esc(x.label||"")} · ${(Number(x.file_size_bytes||0)/1048576).toFixed(1)} MB</small></span><button type="button" class="btn-delete" data-delete-asset="${Number(x.id)}">Delete</button></div>`).join(""):"<p>No extra tracks uploaded yet. The original video remains the fallback.</p>";
      host.querySelectorAll("[data-delete-asset]").forEach(b=>b.addEventListener("click",()=>deleteAsset(Number(b.dataset.deleteAsset))));
      window.VH_MEDIA_ASSETS=window.VH_MEDIA_ASSETS||{};
      window.VH_MEDIA_ASSETS[id]=rows;
    }catch(e){host.textContent=e.message||"Could not load media tracks.";}
  }
  async function uploadAsset(event){
    event.preventDefault();
    const button=event.currentTarget.querySelector('[type="submit"]'),status=$("vhMediaStatus");
    button.disabled=true; status.textContent="Uploading…";
    let uploadedPath=null;
    try{
      const user=await admin(),contentId=Number($("vhMediaContent").value),type=$("vhMediaType").value;
      const language=$("vhMediaLanguage").value.trim(),label=$("vhMediaLabel").value.trim()||null,file=$("vhMediaFile").files[0];
      if(!contentId||!file||!language)throw new Error("Content, file and language are required.");
      const allowed=type==="video"?["video/mp4","video/webm","video/quicktime"]:type==="audio"?["audio/mpeg","audio/mp4","audio/aac","audio/ogg","audio/wav"]:["text/vtt"];
      if(!allowed.includes(file.type) && !(type==="subtitle"&&file.name.toLowerCase().endsWith(".vtt")))throw new Error("This file type is not allowed for the selected track.");
      if(type==="subtitle"&&file.size>2*1024*1024)throw new Error("Subtitle file must be 2 MB or smaller.");
      const resolution=type==="video"?$("vhMediaResolution").value:null;
      const path=user.id+"/"+contentId+"/"+type+"/"+Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const {error:upErr}=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||"text/vtt"});
      if(upErr)throw upErr; uploadedPath=path;
      const {error:dbErr}=await db.from("vh_media_assets").insert({content_id:contentId,asset_type:type,resolution,language,label,asset_url:"",storage_provider:"supabase",mime_type:file.type||"text/vtt",file_size_bytes:file.size,storage_path:path,created_by:user.id});
      if(dbErr)throw dbErr;
      status.textContent="Upload complete."; event.currentTarget.reset(); $("vhMediaType").dispatchEvent(new Event("change")); await loadAssets();
    }catch(e){
      if(uploadedPath) await db.storage.from(bucket).remove([uploadedPath]).catch(()=>{});
      status.textContent=e.message||"Upload failed.";
    }finally{button.disabled=false;}
  }
  async function deleteAsset(id){
    if(!confirm("Delete this media track?"))return;
    try{await admin();const {data,error}=await db.from("vh_media_assets").select("storage_path,asset_url").eq("id",id).maybeSingle();if(error)throw error;
      const {error:delErr}=await db.from("vh_media_assets").delete().eq("id",id);if(delErr)throw delErr;
      if(data?.storage_path)await db.storage.from(data.asset_url ? "vh-media" : bucket).remove([data.storage_path]);
      await loadAssets();toast("Media track deleted.");
    }catch(e){toast(e.message||"Could not delete media track.");}
  }
  function installPlayerTracks(){
    const original=window.openMovie;
    if(typeof original!=="function"||original.__vhTracksInstalled)return;
    const wrapped=function(id){
      const result=original.apply(this,arguments);
      const item=(window.VISION_HUB_DATA||[]).find(x=>String(x.id)===String(id));
      const button=$("modalPlayBtn");
      if(button&&item?.isSupabaseContent){
        button.onclick=async()=>{
          try{
            const {data,error}=await db.from("vh_media_assets").select("*").eq("content_id",Number(id));
            if(error)throw error;
            const assets=data||[],videos=assets.filter(x=>x.asset_type==="video"),audios=assets.filter(x=>x.asset_type==="audio"),subs=assets.filter(x=>x.asset_type==="subtitle");
            const video=$("playerFallback")?.querySelector("video");
            if(!video)throw new Error("Built-in video element not found.");
            const signedUrl=async asset=>{
              if(asset?.asset_url) return asset.asset_url; // legacy public track
              if(asset?.storage_provider==="supabase"&&asset?.storage_path){
                const {data:signed,error:signedError}=await db.storage.from(bucket).createSignedUrl(asset.storage_path,21600);
                if(signedError)throw signedError;
                return signed.signedUrl;
              }
              return "";
            };
            let baseUrl=item.video_url;
            if(item.storage_path){
              const {data:signed,error:signedError}=await db.storage.from(bucket).createSignedUrl(item.storage_path,21600);
              if(signedError)throw signedError;
              baseUrl=signed.signedUrl;
            }
            if(!baseUrl)throw new Error("Video URL could not be resolved. Check private-media SQL policies.");
            const [videoRows,audioRows,subtitleRows]=await Promise.all([
              Promise.all(videos.map(async v=>({...v,playUrl:await signedUrl(v)}))),
              Promise.all(audios.map(async v=>({...v,playUrl:await signedUrl(v)}))),
              Promise.all(subs.map(async v=>({...v,playUrl:await signedUrl(v)})))
            ]);
            const prior=$("vhPlayerTrackControls");prior?.remove();
            const controls=document.createElement("div");controls.id="vhPlayerTrackControls";controls.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0";
            if(videoRows.length){
              const q=document.createElement("select");q.setAttribute("aria-label","Video quality");
              q.innerHTML='<option value="">Auto / Original</option>'+videoRows.map(v=>'<option value="'+esc(v.playUrl)+'">'+esc(v.resolution)+'</option>').join("");
              q.addEventListener("change",()=>{const time=video.currentTime,playing=!video.paused;video.src=q.value||baseUrl;video.load();video.currentTime=time;if(playing)video.play().catch(()=>{});});
              controls.append("Quality ",q);
            }
            if(subtitleRows.length){
              const s=document.createElement("select");s.setAttribute("aria-label","Subtitle language");s.innerHTML='<option value="">Subtitles off</option>'+subtitleRows.map(v=>'<option value="'+esc(v.playUrl)+'">'+esc(v.language)+'</option>').join("");
              let trackNode=null;s.addEventListener("change",()=>{if(trackNode)trackNode.remove();if(s.value){trackNode=document.createElement("track");trackNode.kind="subtitles";trackNode.label=s.selectedOptions[0].text;trackNode.srclang=(s.selectedOptions[0].text.slice(0,2).toLowerCase()||"en");trackNode.src=s.value;trackNode.default=true;video.appendChild(trackNode);}});
              controls.append("Subtitles ",s);
            }
            let audio=null;
            if(audioRows.length){
              const a=document.createElement("select");a.setAttribute("aria-label","Audio language");a.innerHTML='<option value="">Original audio</option>'+audioRows.map(v=>'<option value="'+esc(v.playUrl)+'">'+esc(v.language)+'</option>').join("");
              audio=document.createElement("audio");audio.preload="none";audio.style.display="none";video.parentElement.appendChild(audio);
              a.addEventListener("change",()=>{audio.pause();video.muted=Boolean(a.value);audio.dataset.trackSelected=a.value?"1":"0";if(!a.value){audio.removeAttribute("src");audio.load();return;}audio.src=a.value;audio.currentTime=video.currentTime;audio.play().catch(()=>{});});
              video.addEventListener("play",()=>{if(audio?.dataset.trackSelected==="1")audio.play().catch(()=>{});});
              video.addEventListener("pause",()=>audio?.pause());
              video.addEventListener("seeking",()=>{if(audio?.dataset.trackSelected==="1")audio.currentTime=video.currentTime;});
              video.addEventListener("timeupdate",()=>{if(audio?.dataset.trackSelected==="1"&&Math.abs(audio.currentTime-video.currentTime)>0.35)audio.currentTime=video.currentTime;});
              controls.append("Audio ",a);
            }
            video.src=baseUrl;video.load();
            video.parentElement.insertBefore(controls,video);
            $("playerTitle").textContent="▶ "+item.title;
            $("playerFallback").classList.add("active");$("playerOverlay").classList.add("open");
            video.play().catch(()=>{});
          }catch(e){toast(e.message||"Player could not load tracks.");}
        };
      }
      return result;
    };
    wrapped.__vhTracksInstalled=true;window.openMovie=wrapped;
  }
  document.addEventListener("DOMContentLoaded",()=>{injectPanel();loadTitles();installPlayerTracks();});
  db.auth.onAuthStateChange((_event,session)=>{if(session?.user&&window.VH_IS_ADMIN){injectPanel();loadTitles();}});
  window.addEventListener("vh:page-shown",name=>{if(name.detail==="admin"&&window.VH_IS_ADMIN){injectPanel();loadTitles();}});
})();
