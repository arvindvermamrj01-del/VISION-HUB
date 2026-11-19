import {json,supabase,getFreshTeraBoxConnection,teraboxFolder} from "../../../../lib/terabox.js";
export async function onRequestGet({request,env}){
  const url=new URL(request.url),path=url.searchParams.get("path")||"",quality=url.searchParams.get("quality")||"1080";
  if(!path.startsWith(teraboxFolder(env))||path.includes(".."))return json({error:"Invalid TeraBox path"},400);
  const types={"480":"M3U8_AUTO_480","720":"M3U8_AUTO_720","1080":"M3U8_AUTO_1080"};
  if(!types[quality])return json({error:"Unsupported TeraBox streaming quality"},400);
  const check=new URL(env.SUPABASE_URL+"/rest/v1/vh_content");
  check.searchParams.set("storage_provider","eq.terabox");check.searchParams.set("storage_path","eq."+path);
  check.searchParams.set("published","eq.true");check.searchParams.set("select","id");check.searchParams.set("limit","1");
  const visible=await supabase(env,check.pathname+check.search);
  if(!visible.ok)return json({error:"Could not verify published media"},503);
  const rows=await visible.json();if(!rows.length)return json({error:"Published media not found"},404);
  try{
    const connection=await getFreshTeraBoxConnection(env);if(!connection)return json({error:"TeraBox account is not connected"},503);
    const streamUrl=new URL("/openapi/api/streaming",connection.api_domain);
    streamUrl.searchParams.set("access_tokens",connection.access_token);streamUrl.searchParams.set("path",path);streamUrl.searchParams.set("type",types[quality]);
    const response=await fetch(streamUrl.toString());
    const playlist=await response.text();
    if(!response.ok||!playlist.trimStart().startsWith("#EXTM3U"))throw new Error("TeraBox did not return a valid HLS playlist.");
    return new Response(playlist,{status:200,headers:{"content-type":"application/vnd.apple.mpegurl","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }catch(error){return json({error:error.message||"TeraBox stream unavailable"},502);}
}
