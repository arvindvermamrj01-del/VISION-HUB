/* Supabase publishing, private media assets, quality-aware playback. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) { console.error("VISION HUB: Supabase client is unavailable; publishing is disabled."); return; }
  const PRIVATE_BUCKET = "vh-private-media";
  const $ = id => document.getElementById(id);
  const originalOpenMovie = window.openMovie;
  let activeItem = null;
  let activeVideo = null;

  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = value => String(value || "media").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-100) || "media";
  const qualityOrder = ["180p","240p","360p","420p","480p","720p","1080p","2K","4K","8K"];

  async function requireAdmin() {
    const {data:{user},error} = await db.auth.getUser();
    if (error || !user) throw new Error("Pehle Admin account se login karein.");
    const {data:profile,error:profileError} = await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin") throw new Error("Admin permission nahi hai.");
    return user;
  }

  function ensureQualityFields() {
    const form = document.querySelector("#tab-add-movie form");
    if (!form || $("vhQualityUploads")) return;
    const block = document.createElement("section");
    block.id = "vhQualityUploads";
    block.className = "vh-quality-upload-panel";
    block.innerHTML = '<h3>Video qualities & alternate links</h3><p>Upload only qualities that actually exist. Do not label an upscaled file as native 4K/8K.</p><div class="vh-quality-grid">' +
      qualityOrder.map(q => '<label class="vh-quality-field"><span>'+q+' file</span><input type="file" accept="video/*" data-vh-quality-file="'+q+'"></label>').join("") +
      '</div><div class="vh-quality-links">' +
      [["180p","addDl180"],["240p","addDl240"],["420p","addDl420"],["480p","addDl480"],["720p","addDl720"],["1080p","addDl1080"],["2K","addDl2k"],["4K","addDl4k"],["8K","addDl8k"]].map(([q,id]) => '<label class="vh-quality-field"><span>'+q+' authorised link</span><input type="url" id="'+id+'" placeholder="Optional direct media URL"></label>').join("") +
      '</div><label class="vh-quality-field vh-language-field"><span>Audio / subtitle languages (optional)</span><input id="vhMediaLanguages" type="text" placeholder="Hindi, English, Tamil; subtitles: Hindi, English"></label>';
    const submit = form.querySelector('[type="submit"]');
    form.insertBefore(block, submit || null);
  }

  async function uploadPrivate(file,user) {
    if (!file) return null;
    if (!file.type.startsWith("video/")) throw new Error("Selected file video format mein nahi hai.");
    const path = user.id + "/" + Date.now() + "-" + slug(file.name);
    const {error} = await db.storage.from(PRIVATE_BUCKET).upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
    if (error) throw error;
    return {path,file};
  }

  async function signedAsset(asset) {
    const provider = String(asset.storage_provider || "supabase").toLowerCase();
    const path = asset.storage_path || asset.video_url || "";
    if (!path) return null;
    if (provider === "supabase" && !/^https?:\/\//i.test(path)) {
      const {data,error} = await db.storage.from(PRIVATE_BUCKET).createSignedUrl(path,3600);
      if (error) { console.warn("Could not sign media asset:",error.message); return null; }
      return data?.signedUrl || null;
    }
    return path;
  }

  function addToCatalog(row,assets=[]) {
    const mappedAssets = (assets || []).map(asset => ({...asset,url:asset.resolved_url || asset.url || null}));
    const primary = mappedAssets.find(asset => asset.is_primary) || mappedAssets[0];
    const item = {
      id: row.id, isSupabaseContent:true, title:row.title, type:row.content_type,
      industry:row.industry || "All", genre:row.genre || "Uncategorised",
      year:row.release_year || "", rating:row.rating ?? "", language:row.language || "",
      duration:row.duration || "", poster:row.poster_url || "", backdrop:row.poster_url || "",
      description:row.description || "", cast:row.cast || "", trailer:row.trailer_url || "",
      video_url:primary?.url || (String(row.video_url||"").startsWith("private://") ? "" : row.video_url),
      media_assets:mappedAssets, is_short:row.content_type === "Short"
    };
    const list=window.VISION_HUB_DATA || (window.VISION_HUB_DATA=[]);
    const index=list.findIndex(item=>String(item.id)===String(row.id));
    if(index>=0)list[index]=item;else list.unshift(item);
  }

  async function loadPublished() {
    const {data:rows,error}=await db.from("vh_content").select("*").eq("published",true).order("created_at",{ascending:false});
    if(error){console.error("Published content load failed:",error);toast("Catalog load failed: "+error.message);return;}
    const ids=(rows||[]).map(row=>row.id).filter(id=>id!=null);
    let assetRows=[];
    if(ids.length){
      const result=await db.from("vh_media_assets").select("*").in("content_id",ids);
      if(result.error) console.warn("Media asset metadata unavailable; falling back to primary video URL:",result.error.message);
      else assetRows=result.data||[];
    }
    const grouped=new Map();
    for(const asset of assetRows){
      const url=await signedAsset(asset);
      if(!url)continue;
      const list=grouped.get(String(asset.content_id))||[];
      list.push({...asset,resolved_url:url,url});
      grouped.set(String(asset.content_id),list);
    }
    (rows||[]).forEach(row=>addToCatalog(row,grouped.get(String(row.id))||[]));
    window.renderVisionHub?.();
    renderManageList($("manageSearch")?.value||"");
    document.dispatchEvent(new CustomEvent("visionhub:content-loaded"));
  }

  function renderManageList(query="") {
    const host=$("manageList");if(!host)return;
    const term=String(query).trim().toLowerCase();
    const items=(window.VISION_HUB_DATA||[]).filter(item=>item.isSupabaseContent&&[item.title,item.type,item.genre,item.language,item.industry].join(" ").toLowerCase().includes(term));
    host.innerHTML=items.length?items.map(item=>'<article class="manage-item"><div><strong>'+esc(item.title)+'</strong><small>'+esc(item.type)+' · '+esc(item.year)+' · '+esc(item.genre)+'</small></div><button type="button" class="btn-delete" onclick="deletePublishedContent('+Number(item.id)+')">Delete</button></article>').join(""):"<p>No published content found.</p>";
  }
  window.filterManageList=value=>renderManageList(value);

  window.deletePublishedContent=async id=>{
    if(!Number.isFinite(Number(id))||!window.confirm("Delete this published item permanently?"))return;
    try{
      await requireAdmin();
      const {error}=await db.from("vh_content").delete().eq("id",Number(id));
      if(error)throw error;
      window.VISION_HUB_DATA=(window.VISION_HUB_DATA||[]).filter(item=>!(item.isSupabaseContent&&Number(item.id)===Number(id)));
      window.renderVisionHub?.();renderManageList($("manageSearch")?.value||"");toast("Content deleted.");
    }catch(error){console.error("Content delete failed:",error);toast(error.message||"Could not delete content.");}
  };

  async function publish(form,type) {
    const user=await requireAdmin();
    const isShort=type==="Short";
    const title=$(isShort?"shortTitle":"addTitle")?.value.trim();
    if(!title)throw new Error("Title required hai.");
    const provider=$(isShort?"shortStorageProvider":"addStorageProvider")?.value||"supabase";
    const primaryFile=$(isShort?"shortVideoFile":"addVideoFile")?.files?.[0]||null;
    const primaryUrl=$(isShort?"shortVideoUrl":"addVideo")?.value.trim()||"";
    const uploads=[];
    const links=[];
    if(primaryFile){
      if(provider!=="supabase")throw new Error("Direct file upload abhi private Supabase Storage par supported hai. External provider ke liye authorised direct URL dein.");
      uploads.push({resolution:"Original",file:primaryFile,is_primary:true});
    } else if(primaryUrl) links.push({resolution:"Original",url:primaryUrl,is_primary:true,storage_provider:provider});
    if(!isShort){
      document.querySelectorAll("[data-vh-quality-file]").forEach(input=>{
        const file=input.files?.[0];if(file)uploads.push({resolution:input.dataset.vhQualityFile,file,is_primary:false});
      });
      [["180p","addDl180"],["240p","addDl240"],["420p","addDl420"],["480p","addDl480"],["720p","addDl720"],["1080p","addDl1080"],["2K","addDl2k"],["4K","addDl4k"],["8K","addDl8k"]].forEach(([resolution,id])=>{
        const url=$(id)?.value.trim();if(url)links.push({resolution,url,is_primary:false,storage_provider:provider});
      });
    }
    if(!uploads.length&&!links.length)throw new Error("Video file upload karein ya authorised video URL dein.");
    const uploaded=[];
    try {
      for(const entry of uploads){const result=await uploadPrivate(entry.file,user);uploaded.push({...entry,...result,storage_provider:"supabase"});}
      const primaryUpload=uploaded.find(x=>x.is_primary)||uploaded[0];
      const primaryLink=links.find(x=>x.is_primary)||links[0];
      const primary=primaryUpload||primaryLink;
      const row={
        title,content_type:type,video_url:primaryUpload?"private://"+primaryUpload.path:primary.url,
        storage_provider:primaryUpload?"supabase":(primary.storage_provider||provider),published:true,created_by:user.id,
        poster_url:isShort?null:($("addPoster")?.value.trim()||null),
        genre:isShort?"Shorts":($("addGenre")?.value||"Drama"),
        language:isShort?"":($("addLang")?.value.trim()||""),
        release_year:isShort?new Date().getFullYear():(Number($("addYear")?.value)||null),
        rating:isShort?null:(Number($("addRating")?.value)||null),
        description:isShort?($("shortDesc")?.value.trim()||""):($("addDesc")?.value.trim()||""),
        cast:isShort?"":($("addCast")?.value.trim()||""),
        duration:isShort?"":($("addDuration")?.value.trim()||""),
        trailer_url:isShort?null:($("addTrailer")?.value.trim()||null),
        industry:isShort?"All":((($("addLang")?.value||"").toLowerCase().includes("hindi"))?"Bollywood":"All")
      };
      const {data:created,error}=await db.from("vh_content").insert(row).select("*").single();
      if(error)throw error;
      const assetRows=[
        ...uploaded.map(x=>({content_id:created.id,storage_path:x.path,storage_provider:"supabase",resolution:x.resolution,is_primary:x.is_primary,language:isShort?"":($("vhMediaLanguages")?.value.trim()||"")})),
        ...links.map(x=>({content_id:created.id,storage_path:x.url,storage_provider:x.storage_provider||provider,resolution:x.resolution,is_primary:x.is_primary,language:isShort?"":($("vhMediaLanguages")?.value.trim()||"")}))
      ];
      if(assetRows.length){
        const {error:assetError}=await db.from("vh_media_assets").insert(assetRows);
        if(assetError){
          await db.from("vh_content").delete().eq("id",created.id);
          throw new Error("Media details save nahi hue: "+assetError.message+". Supabase migration check karein.");
        }
      }
      form?.reset();
      toast(type+" successfully publish ho gaya.");
      await loadPublished();
    } catch(error) {
      if(uploaded.length){
        const paths=uploaded.map(x=>x.path);
        const {error:cleanupError}=await db.storage.from(PRIVATE_BUCKET).remove(paths);
        if(cleanupError)console.warn("Uploaded file cleanup needs attention:",cleanupError.message);
      }
      throw error;
    }
  }

  window.addMovie=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget||document.querySelector("#tab-add-movie form");
    const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{await publish(form,$("addType")?.value||"Movie");}
    catch(error){console.error("Publish failed:",error);toast(error.message||"Publish failed.");}
    finally{if(button)button.disabled=false;}
  };
  window.publishShort=async event=>{
    event?.preventDefault();const form=event?.currentTarget;const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{await publish(form,"Short");}
    catch(error){console.error("Short publish failed:",error);toast(error.message||"Short publish failed.");}
    finally{if(button)button.disabled=false;}
  };

  function ensurePlayerQualityControl(item) {
    const controls=$("playerOverlay")?.querySelector(".player-controls");
    if(!controls)return;
    let wrap=$("vhPlayerQualityWrap");
    if(!wrap){wrap=document.createElement("label");wrap.id="vhPlayerQualityWrap";wrap.className="vh-player-quality";wrap.innerHTML='<span>Quality</span><select id="vhPlayerQuality"></select>';controls.prepend(wrap);}
    const select=$("vhPlayerQuality");
    const assets=(item.media_assets||[]).filter(asset=>asset.url);
    const choices=assets.length?assets:[{resolution:"Original",url:item.video_url,is_primary:true}].filter(x=>x.url);
    select.innerHTML=choices.map((asset,index)=>'<option value="'+index+'">'+esc(asset.resolution||"Original")+'</option>').join("");
    select.onchange=()=>playAsset(item,choices[Number(select.value)]);
    const preferred=choices.findIndex(asset=>asset.is_primary);
    select.value=String(preferred>=0?preferred:0);
    if(choices.length)playAsset(item,choices[Number(select.value)]);
  }

  function playAsset(item,asset) {
    if(!asset?.url){toast("Is quality ka playable URL available nahi hai.");return;}
    activeVideo=$("playerFallback")?.querySelector("video");
    if(!activeVideo)return;
    $("playerIframe")?.classList.add("hidden");
    $("playerFallback")?.classList.add("active");
    if(activeVideo.src!==asset.url){activeVideo.pause();activeVideo.src=asset.url;activeVideo.load();}
    activeVideo.play().catch(()=>{});
    const status=$("playerOverlay")?.querySelector(".player-controls span:nth-child(2)");
    if(status)status.textContent=(asset.resolution||"Original")+" · source quality";
  }

  window.openMovie=function(id){
    const item=(window.VISION_HUB_DATA||[]).find(entry=>String(entry.id)===String(id));
    if(!item)return;
    activeItem=item;
    if(typeof originalOpenMovie==="function")originalOpenMovie(id);
    else {
      $("modalTitle").textContent=item.title;
      $("modalDesc").textContent=item.description||"";
      $("modalMeta").textContent=[item.year,item.genre,item.language,item.duration].filter(Boolean).join(" · ");
      $("modalPoster").src=item.poster||"";
      $("movieModal")?.classList.add("open");
    }
    const playButton=$("modalPlayBtn");
    if(playButton){
      playButton.onclick=()=>{
        $("movieModal")?.classList.remove("open");
        $("playerTitle").textContent="▶ "+item.title;
        $("playerOverlay")?.classList.add("open");
        ensurePlayerQualityControl(item);
      };
    }
    const downloadButton=document.querySelector("#movieModal .btn-download");
    if(downloadButton)downloadButton.onclick=()=>window.downloadMovie();
  };

  window.downloadMovie=function(){
    if(!activeItem){toast("Pehle catalog se content select karein.");return;}
    const modal=$("downloadModal");
    const host=modal?.querySelector(".res-list");
    if(!modal||!host){toast("Download panel unavailable.");return;}
    $("dlModalTitle").textContent=activeItem.title;
    $("dlModalMeta").textContent=[activeItem.year,activeItem.genre,activeItem.language,activeItem.duration].filter(Boolean).join(" · ");
    $("dlModalPoster").src=activeItem.poster||"";
    const assets=(activeItem.media_assets||[]).filter(asset=>asset.url);
    const choices=assets.length?assets:[{resolution:"Original",url:activeItem.video_url}].filter(asset=>asset.url);
    host.innerHTML=choices.length?choices.map(asset=>'<div class="res-card"><div class="res-info"><span class="res-tag">'+esc(asset.resolution||"Original")+'</span><div class="res-meta"><span>'+esc(asset.language||"Source audio")+'</span><small>Verified source link · actual supplied quality</small></div></div><div class="res-actions"><button class="btn-dl-server" type="button" data-vh-download="'+esc(asset.url)+'"><i class="fas fa-external-link-alt"></i> Open source</button></div></div>').join(""):"<p>No verified resolution links have been added for this title.</p>";
    host.querySelectorAll("[data-vh-download]").forEach(button=>button.addEventListener("click",()=>window.open(button.dataset.vhDownload,"_blank","noopener")));
    const tg=$("dlModalTelegramBtn");if(tg)tg.classList.toggle("hidden",!activeItem.telegram_url);
    modal.classList.add("open");
  };

  window.triggerDownload=(resolution,provider)=>{
    const asset=(activeItem?.media_assets||[]).find(item=>String(item.resolution).toLowerCase()===String(resolution).toLowerCase());
    if(asset?.url){window.open(asset.url,"_blank","noopener");return;}
    toast("Is resolution ka verified download link available nahi hai.");
  };
  window.playMovie=()=>{if(activeItem){$("movieModal")?.classList.remove("open");$("playerTitle").textContent="▶ "+activeItem.title;$("playerOverlay")?.classList.add("open");ensurePlayerQualityControl(activeItem);}};
  window.closePlayer=()=>{
    activeVideo=$("playerFallback")?.querySelector("video");
    if(activeVideo){activeVideo.pause();activeVideo.removeAttribute("src");activeVideo.load();}
    $("playerOverlay")?.classList.remove("open");
    $("playerIframe")?.setAttribute("src","");
  };

  document.addEventListener("DOMContentLoaded",()=>{
    ensureQualityFields();
    loadPublished();
  });
  db.auth.onAuthStateChange((_event,session)=>{if(session?.user)loadPublished();});
})();