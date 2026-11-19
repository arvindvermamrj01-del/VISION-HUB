import {json,requireGoogleContentStaff,getFreshGoogleDriveConnection,verifyGoogleState} from "../../../../lib/google-drive.js";
export async function onRequestPost({request,env}){
  const auth=await requireGoogleContentStaff(request,env);if(auth.response)return auth.response;
  try{
    const data=await request.formData(),uploadToken=String(data.get("upload_token")||"");
    const start=Number(data.get("start")),total=Number(data.get("total")),file=data.get("file"),statusOnly=String(data.get("status")||"")==="1";
    let sessionPayload;try{sessionPayload=await verifyGoogleState(uploadToken,env.GOOGLE_OAUTH_STATE_SECRET);}catch(_){return json({error:"Google Drive upload token is invalid or expired"},401);}
    if(sessionPayload.uid!==auth.user.id||Number(sessionPayload.size)!==total)return json({error:"Google Drive upload session does not belong to this user or file"},403);
    const sessionUrl=String(sessionPayload.session_url||"");
    let parsed;try{parsed=new URL(sessionUrl);}catch(_){return json({error:"Invalid Google Drive upload session"},400);}
    if(parsed.protocol!=="https:"||!parsed.hostname.endsWith(".googleapis.com")||parsed.pathname!=="/upload/drive/v3/files")return json({error:"Invalid Google Drive upload session host"},400);
    if(!Number.isSafeInteger(total)||total<=0)return json({error:"Invalid Google Drive file size"},400);
    if(!statusOnly&&(!Number.isSafeInteger(start)||start<0||!file||typeof file.arrayBuffer!=="function"||file.size<1||file.size>10*1024*1024||start+file.size>total))return json({error:"Invalid Google Drive upload chunk"},400);
    if(!statusOnly&&start+file.size<total&&file.size%(256*1024)!==0)return json({error:"Google Drive non-final chunks must be multiples of 256 KiB"},400);
    const connection=await getFreshGoogleDriveConnection(env);if(!connection)return json({error:"Google Drive account is not connected"},409);
    let response;
    if(statusOnly){
      response=await fetch(sessionUrl,{method:"PUT",headers:{"content-range":"bytes */"+total}});
    }else{
      const end=start+file.size-1;
      response=await fetch(sessionUrl,{method:"PUT",headers:{"content-type":"application/octet-stream","content-range":"bytes "+start+"-"+end+"/"+total},body:file});
    }
    if(response.status===308)return json({complete:false,range:response.headers.get("Range")||""});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.id)throw new Error(payload.error?.message||"Google Drive rejected the upload chunk.");
    const permission=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(payload.id)+"/permissions?supportsAllDrives=true&fields=id",{
      method:"POST",headers:{authorization:"Bearer "+connection.access_token,"content-type":"application/json"},body:JSON.stringify({type:"anyone",role:"reader"})
    });
    if(!permission.ok){
      await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(payload.id)+"?supportsAllDrives=true",{method:"DELETE",headers:{authorization:"Bearer "+connection.access_token}}).catch(()=>{});
      throw new Error("Upload completed, but Google Drive could not make the file public for playback. The incomplete file was removed where possible.");
    }
    return json({complete:true,file:{id:payload.id,name:payload.name||"",size:Number(payload.size||total),webViewLink:payload.webViewLink||""},preview_url:"https://drive.google.com/file/d/"+encodeURIComponent(payload.id)+"/preview"});
    const end=start+file.size-1;
    const response=await fetch(sessionUrl,{method:"PUT",headers:{"content-type":"application/octet-stream","content-range":"bytes "+start+"-"+end+"/"+total},body:file});
    if(response.status===308)return json({complete:false,range:response.headers.get("Range")||""});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.id)throw new Error(payload.error?.message||"Google Drive rejected the upload chunk.");
    const permission=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(payload.id)+"/permissions?supportsAllDrives=true&fields=id",{
      method:"POST",headers:{authorization:"Bearer "+connection.access_token,"content-type":"application/json"},body:JSON.stringify({type:"anyone",role:"reader"})
    });
    if(!permission.ok){
      await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(payload.id)+"?supportsAllDrives=true",{method:"DELETE",headers:{authorization:"Bearer "+connection.access_token}}).catch(()=>{});
      throw new Error("Upload completed, but Google Drive could not make the file public for playback. The incomplete file was removed where possible.");
    }
    return json({complete:true,file:{id:payload.id,name:payload.name||"",size:Number(payload.size||total),webViewLink:payload.webViewLink||""},preview_url:"https://drive.google.com/file/d/"+encodeURIComponent(payload.id)+"/preview"});
  }catch(error){return json({error:error.message||"Google Drive chunk upload failed"},502);}
}
