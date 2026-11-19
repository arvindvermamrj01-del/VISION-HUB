import {json,requireContentStaff,getFreshTeraBoxConnection,postForm,supabase,teraboxFolder} from "../../../lib/terabox.js";
export async function onRequestDelete({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!Number.isSafeInteger(id)||id<=0)return json({error:"Valid catalogue item ID is required"},400);
  const profile=await supabase(env,"profiles?id=eq."+encodeURIComponent(auth.user.id)+"&select=role");
  if(!profile.ok)return json({error:"Could not verify staff role"},503);
  const profileRows=await profile.json(),role=profileRows?.[0]?.role;
  const lookup=await supabase(env,"vh_content?id=eq."+id+"&select=id,content_type,storage_provider,storage_path");
  if(!lookup.ok)return json({error:"Could not verify catalogue item"},503);
  const rows=await lookup.json(),item=rows?.[0];
  if(!item||item.storage_provider!=="terabox"||!item.storage_path)return json({error:"TeraBox-backed catalogue item not found"},404);
  if(role==="content_editor"&&item.content_type!=="Movie")return json({error:"Movie-only editor cannot remove this item"},403);
  if(!item.storage_path.startsWith(teraboxFolder(env))||item.storage_path.includes(".."))return json({error:"Stored TeraBox path is outside the approved app folder"},400);
  // Remove the catalogue reference first; if the provider is temporarily unavailable, leave an orphan file rather than a broken public item.
  const deleted=await supabase(env,"vh_content?id=eq."+id,{method:"DELETE"});
  if(!deleted.ok)return json({error:"Could not remove catalogue item"},503);
  try{
    const connection=await getFreshTeraBoxConnection(env);
    if(!connection)return json({ok:true,cleanup_pending:true});
    const result=await postForm(connection.api_domain+"/openapi/api/filemanager?access_tokens="+encodeURIComponent(connection.access_token)+"&opera=delete&async=0",{filelist:JSON.stringify([item.storage_path])});
    if(result.info?.some(x=>Number(x.errno||0)!==0))return json({ok:true,cleanup_pending:true});
    return json({ok:true,deleted_path:item.storage_path});
  }catch(_){return json({ok:true,cleanup_pending:true});}
}
