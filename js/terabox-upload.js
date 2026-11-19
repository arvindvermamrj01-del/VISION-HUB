/* TeraBox direct file upload via small, sequential chunks. Tokens remain server-side. */
(() => {
  "use strict";
  const MB=1024*1024;
  const db=window.VH_SUPABASE;
  async function session(){
    if(!db)throw new Error("Supabase session service is unavailable.");
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session)throw new Error("Sign in with an authorized staff account before uploading.");
    return session;
  }
  async function api(url,options={}){
    const current=await session();
    const response=await fetch(url,{...options,headers:{authorization:"Bearer "+current.access_token,...(options.headers||{})}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||"TeraBox upload request failed.");
    return payload;
  }
  window.VH_TERABOX_UPLOAD=async function(file){
    if(!file||!file.type.startsWith("video/"))throw new Error("Choose a valid video file.");
    if(typeof window.VH_MD5_BLOB!=="function")throw new Error("TeraBox checksum helper did not load.");
    const count=file.size>8*MB?Math.ceil(file.size/(8*MB)):1;
    const chunkSize=Math.ceil(file.size/count);
    const hashes=[];
    for(let index=0;index<count;index++){
      const chunk=file.slice(index*chunkSize,Math.min(file.size,(index+1)*chunkSize));
      hashes.push(await window.VH_MD5_BLOB(chunk));
    }
    const init=await api("/api/storage/terabox/upload/init",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({file_name:file.name,size:file.size,block_md5s:hashes})});
    if(init.already_exists)return {storagePath:init.path,fileId:init.file?.fs_id||null};
    const parts=Array.isArray(init.parts)?init.parts:[];
    for(let i=0;i<parts.length;i++){
      const partseq=Number(parts[i]);
      const chunk=file.slice(partseq*chunkSize,Math.min(file.size,(partseq+1)*chunkSize));
      const form=new FormData();form.set("path",init.path);form.set("uploadid",init.uploadid);form.set("partseq",String(partseq));form.set("expected_md5",hashes[partseq]);form.set("file",chunk,"chunk.bin");
      await api("/api/storage/terabox/upload/part",{method:"POST",body:form});
      window.dispatchEvent(new CustomEvent("vh:terabox-upload-progress",{detail:{completed:i+1,total:parts.length}}));
    }
    const complete=await api("/api/storage/terabox/upload/complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:init.path,uploadid:init.uploadid,size:file.size,block_md5s:hashes})});
    return {storagePath:complete.path||init.path,fileId:complete.file?.fs_id||null};
  };
})();
