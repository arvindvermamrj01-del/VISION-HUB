const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function sb(env,path,options={}){
  return fetch(env.SUPABASE_URL+path,{...options,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json",...(options.headers||{})}});
}
async function primaryAdmin(request,env){
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return {response:json({error:"Authentication required"},401)};
  const auth=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!auth.ok)return {response:json({error:"Invalid session"},401)};
  const user=await auth.json();
  const result=await sb(env,"/rest/v1/profiles?id=eq."+encodeURIComponent(user.id)+"&select=role");
  if(!result.ok)return {response:json({error:"Could not verify primary Admin"},503)};
  const profiles=await result.json();
  if(profiles?.[0]?.role!=="admin")return {response:json({error:"Only the primary Admin can manage staff accounts"},403)};
  return {user};
}
export async function onRequestGet({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:"Staff API is not configured"},503);
  const auth=await primaryAdmin(request,env);if(auth.response)return auth.response;
  const result=await sb(env,"/rest/v1/profiles?role=in.(sub_admin,content_editor,moderator)&select=id,fullname,role,created_at&order=created_at.desc");
  if(!result.ok)return json({error:"Could not load staff list"},503);
  return json({staff:await result.json()});
}
export async function onRequestPost({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:"Staff API is not configured"},503);
  const auth=await primaryAdmin(request,env);if(auth.response)return auth.response;
  let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON"},400);}
  const fullname=String(body.fullname||"").trim().slice(0,80);
  const email=String(body.email||"").trim().toLowerCase();
  const password=String(body.password||"");
  const role=String(body.role||"");
  if(fullname.length<2)return json({error:"Enter a valid staff name"},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Enter a valid login email"},400);
  if(password.length<12)return json({error:"Temporary password must be at least 12 characters"},400);
  if(!["sub_admin","content_editor","moderator"].includes(role))return json({error:"Invalid staff role"},400);
  const created=await fetch(env.SUPABASE_URL+"/auth/v1/admin/users",{method:"POST",headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json"},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:fullname}})});
  const account=await created.json().catch(()=>({}));
  if(!created.ok)return json({error:created.status===422?"This email may already be registered.":(account.msg||account.message||"Could not create staff account")},400);
  const uid=account.id;
  const profile=await sb(env,"/rest/v1/profiles?id=eq."+encodeURIComponent(uid),{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({fullname,role})});
  if(!profile.ok){
    await fetch(env.SUPABASE_URL+"/auth/v1/admin/users/"+encodeURIComponent(uid),{method:"DELETE",headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY}});
    return json({error:"Profile role assignment failed; the new Auth account was rolled back"},500);
  }
  return json({ok:true,staff:{id:uid,fullname,role}},201);
}
