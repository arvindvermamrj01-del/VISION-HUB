/* Private social-style Posts workspace. Separate from vh_content/Movie Catalog. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE;
  const $=id=>document.getElementById(id);
  const form=$("vhPostForm");
  if(!form||!db)return;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const setStatus=(message,error=false)=>{const el=$("vhPostStatus");if(el){el.textContent=message;el.style.color=error?"#dc5555":"";}};
  async function sessionToken(){const {data:{session},error}=await db.auth.getSession();if(error||!session?.access_token)throw new Error("Admin session expired. Please sign in again.");return session.access_token;}
  async function upload(file,kind,provider,token){
    const response=await fetch("/api/media/upload-url",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({kind,fileName:file.name,contentType:file.type,fileSize:file.size,provider})});
    const signed=await response.json().catch(()=>({}));
    if(!response.ok||!signed.uploadUrl)throw new Error(signed.error||"Could not prepare secure upload.");
    const put=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers||{"Content-Type":file.type},body:file});
    if(!put.ok)throw new Error("Storage upload failed (HTTP "+put.status+"). Check provider CORS/configuration.");
    return {path:signed.key,provider};
  }
  function updateType(){
    const type=$("vhPostType").value,file=$("vhPostFile");
    file.accept=type==="video"?"video/*":type==="song"?"audio/*":"image/jpeg,image/png,image/webp";
    file.value="";
    $("vhPostFileHint").textContent=type==="video"?"Video up to 5 GB.":type==="song"?"Audio up to 1 GB.":"JPG, PNG or WebP photo up to 15 MB.";
  }
  async function loadPosts(){
    const host=$("vhPostsList");host.innerHTML="<p>Loading saved posts…</p>";
    try{
      const token=await sessionToken();
      const res=await fetch("/api/posts",{headers:{"Authorization":"Bearer "+token},cache:"no-store"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Posts could not be loaded.");
      if(!data.posts?.length){host.innerHTML="<p>No saved posts yet. Create your first private draft above.</p>";return;}
      host.innerHTML=data.posts.map(p=>'<article class="manage-item" style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px;border-bottom:1px solid var(--border-color,#444)"><div><b>'+esc(p.title)+'</b><div><small>'+esc(p.post_type)+' · '+esc(p.category||"Uncategorised")+' · '+esc(p.status)+' · '+new Date(p.created_at).toLocaleString()+'</small></div><p>'+esc(p.description||"")+'</p></div><button type="button" class="btn btn-danger" data-delete-post="'+esc(p.id)+'">Delete</button></article>').join("");
      host.querySelectorAll("[data-delete-post]").forEach(btn=>btn.addEventListener("click",()=>deletePost(btn.dataset.deletePost,btn)));
    }catch(error){host.innerHTML='<p>'+esc(error.message)+'</p>';}
  }
  async function deletePost(id,button){
    if(!window.confirm("Delete this post and its uploaded media?"))return;
    button.disabled=true;
    try{
      const token=await sessionToken();
      const res=await fetch("/api/posts/"+encodeURIComponent(id),{method:"DELETE",headers:{"Authorization":"Bearer "+token}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Post could not be deleted.");
      await loadPosts();setStatus("Post and its media were deleted.");
    }catch(error){button.disabled=false;setStatus(error.message,true);}
  }
  $("vhPostType").addEventListener("change",updateType);
  $("vhPostResetBtn").addEventListener("click",()=>{form.reset();updateType();setStatus("");});
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=$("vhPostSaveBtn"),file=$("vhPostFile").files[0],type=$("vhPostType").value;
    if(!file){setStatus("Choose a media file first.",true);return;}
    const provider=$("vhPostProvider").value;
    button.disabled=true;setStatus("Uploading media privately…");
    let uploaded=null,thumbnail=null;
    try{
      const token=await sessionToken();
      const mediaKind=type==="song"?"audio":type==="photo"?"image":"video";
      uploaded=await upload(file,mediaKind,provider,token);
      const thumbFile=$("vhPostThumbnail").files[0];
      if(thumbFile)thumbnail=await upload(thumbFile,"image",provider,token);
      setStatus("Upload complete. Saving private draft…");
      const res=await fetch("/api/posts",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({title:$("vhPostTitle").value.trim(),description:$("vhPostDescription").value.trim(),category:$("vhPostCategory").value.trim(),postType:type,storageProvider:provider,storagePath:uploaded.path,thumbnailPath:thumbnail?.path||null,fileName:file.name,fileSize:file.size})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.post)throw new Error(data.error||"Draft record could not be saved.");
      form.reset();updateType();setStatus("Saved privately as a Draft. It is not public and is not in Movie Catalog.");await loadPosts();
    }catch(error){
      setStatus(error.message||"Post upload failed.",true);
      // If upload succeeded but DB save failed, attempt to remove orphaned private objects.
      if(uploaded||thumbnail){
        try{const token=await sessionToken();for(const item of [uploaded,thumbnail].filter(Boolean))await fetch("/api/media/delete",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({storagePath:item.path,provider:item.provider})});}catch(_){}
      }
    }finally{button.disabled=false;}
  });
  updateType();
  document.addEventListener("click",event=>{const nav=event.target.closest('[onclick*="adminTab(\'posts\'"]');if(nav)setTimeout(loadPosts,0);});
  loadPosts();
})();