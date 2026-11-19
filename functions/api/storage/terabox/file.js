import {json,requireContentStaff,getFreshTeraBoxConnection,postForm,teraboxFolder} from "../../../lib/terabox.js";
export async function onRequestDelete({request,env}){
  const auth=await requireContentStaff(request,env);if(auth.response)return auth.response;
  const path=new URL(request.url).searchParams.get("path")||"";
  if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox file path"},400);
  const profile=await supabase(env,"profiles?id=eq."+encodeURIComponent(auth.user.id)+"&select=role");
  if(!profile.ok)return json({error:"Could not verify staff role"},503);
  const profileRows=await profile.json();
  const role=profileRows?.[0]?.role;
  const contentQuery=new URL(env.SUPABASE_URL+"/rest/v1/vh_content");
  contentQuery.searchParams.set("storage_provider","eq.terabox");
  contentQuery.searchParams.set("storage_path","eq."+path);
  contentQuery.searchParams.set("select","id,content_type");
  contentQuery.searchParams.set("limit","1");
  const contentResponse=await supabase(env,contentQuery.pathname.replace("/rest/v1/","")+contentQuery.search);
  if(!contentResponse.ok)return json({error:"Could not verify media ownership"},503);
  const contentRows=await contentResponse.json();
  if(!contentRows.length)return json({error:"TeraBox file is not attached to a catalogue item"},404);
  if(role==="content_editor"&&contentRows[0].content_type!=="Movie")return json({error:"Movie-only editor cannot remove this media"},403);
  try{
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"TeraBox account is not connected"},409);
    const result=await postForm(connection.api_domain+"/openapi/api/filemanager?access_tokens="+encodeURIComponent(connection.access_token)+"&opera=delete&async=0",{
      filelist:JSON.stringify([path])
    });
    return json({ok:true,deleted_path:path,result});
  }catch(error){return json({error:error.message||"TeraBox file could not be deleted"},502);}
}
