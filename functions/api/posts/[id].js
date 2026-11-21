import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignB2 } from "../../_shared/b2.js";
import { presignR2 } from "../../_shared/r2.js";

const ROLES=["admin","sub_admin","content_editor"];
const validPath=(path,userId)=>typeof path==="string"&&path.startsWith(userId+"/")&&!path.includes("..")&&!path.startsWith("/");
async function removeObject(env,provider,path){
  if(!path)return;
  const signed=provider==="backblaze_b2"?await presignB2(env,"DELETE",path,"",900):await presignR2(env,"DELETE",path,"",900);
  const response=await fetch(signed.url,{method:"DELETE",headers:signed.headers||{}});
  if(!response.ok&&response.status!==404)throw new Error("Could not delete uploaded media (HTTP "+response.status+").");
}
export async function onRequestDelete({request,env,params}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    const id=String(params?.id||"");
    if(!/^\d+$/.test(id))return json({error:"Invalid post ID."},400);
    const base=supabaseBase(env),headers=supabaseAdminHeaders(env);
    const url=new URL(base+"/rest/v1/vh_posts");
    url.search=new URLSearchParams({id:"eq."+id,created_by:"eq."+user.id,select:"id,storage_provider,storage_path,thumbnail_path"}).toString();
    const found=await fetch(url,{headers});
    if(!found.ok)return json({error:"Post ownership could not be verified."},502);
    const rows=await found.json();
    if(!rows.length)return json({error:"Post not found or not owned by this account."},404);
    const post=rows[0];
    if(!validPath(post.storage_path,user.id)||post.thumbnail_path&&!validPath(post.thumbnail_path,user.id))return json({error:"Stored media ownership check failed; nothing was deleted."},403);
    await removeObject(env,post.storage_provider,post.storage_path);
    if(post.thumbnail_path)await removeObject(env,post.storage_provider,post.thumbnail_path);
    const deleted=await fetch(base+"/rest/v1/vh_posts?id=eq."+encodeURIComponent(id)+"&created_by=eq."+encodeURIComponent(user.id),{method:"DELETE",headers:{...headers,Prefer:"return=minimal"}});
    if(!deleted.ok)return json({error:"Media removed, but the post record could not be deleted."},502);
    return json({deleted:true});
  }catch(error){return json({error:error.message||"Could not delete post."},error.status||503);}
}
