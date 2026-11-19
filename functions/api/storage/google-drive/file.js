import {json,requireGoogleContentStaff,getFreshGoogleDriveConnection,supabase} from "../../../lib/google-drive.js";
export async function onRequestDelete({request,env}){
  const auth=await requireGoogleContentStaff(request,env);if(auth.response)return auth.response;
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!Number.isSafeInteger(id)||id<=0)return json({error:"Valid catalogue item ID is required"},400);
  const profile=await supabase(env,"profiles?id=eq."+encodeURIComponent(auth.user.id)+"&select=role");
  if(!profile.ok)return json({error:"Could not verify staff role"},503);
  const profileRows=await profile.json(),role=profileRows?.[0]?.role;
  const lookup=await supabase(env,"vh_content?id=eq."+id+"&select=id,content_type,storage_provider,storage_path");
  if(!lookup.ok)return json({error:"Could not verify catalogue item"},503);
  const rows=await lookup.json(),item=rows?.[0];
  if(!item||item.storage_provider!=="google_drive"||!item.storage_path)return json({error:"Google Drive-backed catalogue item not found"},404);
  if(role==="content_editor"&&item.content_type!=="Movie")return json({error:"Movie-only editor cannot remove this item"},403);
  const deleted=await supabase(env,"vh_content?id=eq."+id,{method:"DELETE"});
  if(!deleted.ok)return json({error:"Could not remove catalogue item"},503);
  try{
    const connection=await getFreshGoogleDriveConnection(env);
    if(!connection)return json({ok:true,cleanup_pending:true});
    const response=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(item.storage_path),{method:"DELETE",headers:{authorization:"Bearer "+connection.access_token}});
    if(!response.ok&&response.status!==404)return json({ok:true,cleanup_pending:true});
    return json({ok:true});
  }catch(_){return json({ok:true,cleanup_pending:true});}
}
