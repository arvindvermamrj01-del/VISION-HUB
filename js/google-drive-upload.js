/* Google Drive resumable upload client. File bytes are sent in bounded chunks through Pages Functions. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,MB=1024*1024;
  async function session(){
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session)throw new Error("Sign in with an authorized staff account before uploading.");
    return session;
  }
  async function api(url,options={}){
    const current=await session();
    const response=await fetch(url,{...options,headers:{authorization:"Bearer "+current.access_token,...(options.headers||{})}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||"Google Drive upload request failed.");
    return payload;
  }
  window.VH_GOOGLE_DRIVE_UPLOAD=async function(file){
    if(!file||!file.type.startsWith("video/"))throw new Error("Choose a valid video file.");
    const init=await api("/api/storage/google-drive/upload/init",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({file_name:file.name,mime_type:file.type||"video/mp4",size:file.size})});
    const chunkSize=Math.max(256*1024,Math.floor(Number(init.chunk_size||8*MB)/(256*1024))*256*1024);
    let final=null,completed=0,total=Math.ceil(file.size/chunkSize);
    for(let start=0;start<file.size;start+=chunkSize){
      const chunk=file.slice(start,Math.min(file.size,start+chunkSize));
      const form=new FormData();form.set("upload_token",init.upload_token);form.set("start",String(start));form.set("total",String(file.size));form.set("file",chunk,"chunk.bin");
      const result=await api("/api/storage/google-drive/upload/part",{method:"POST",body:form});
      completed++;window.dispatchEvent(new CustomEvent("vh:google-drive-upload-progress",{detail:{completed,total}}));
      if(result.complete)final=result;
    }
    if(!final?.file?.id)throw new Error("Google Drive did not confirm the completed upload.");
    return {storagePath:final.file.id,videoUrl:final.preview_url,provider:"google_drive"};
  };
})();
